/**
 * POST /api/cue: one visitor message to Cue, streamed back (ticket 169).
 *
 * Checks, in the old assistant's order. Every "no" is a single `fallback`
 * event that sends the visitor to plain search:
 *   0. a same-site JSON request of reasonable size
 *   1. the input (lib/ai/cue/ask.ts): a message of 1 to 200 characters, up to
 *      twelve earlier turns, the last reply's cards, the page path, and an
 *      optional Near me position (rounded to about 110 m)
 *   2. FEATURE_AI_ASSISTANT is on (read again here, at request time)
 *   3. the AI kill switch is off
 *   4. rate limit per IP: 8 a minute, 40 a day (bucket 'ai_assistant')
 *   5. the category and city lists, and the listing names for the reply check
 *   6. paid calls only: the monthly AI ceiling
 *   7. paid calls only: the visitor share. Guide and Cue together stay under
 *      40% of the monthly call budget. One visitor message counts as one call,
 *      and spend.ts prices it at the loop's worst case.
 *
 * Then Cue runs (lib/ai/cue/agent.ts): up to four model calls with tools that
 * read published listings only. The response is newline-delimited JSON
 * (lib/ai/cue/stream.ts): `status` and `text` while Cue works, then `cards`,
 * `actions` and `done`. A reply with no words and no cards becomes a
 * `fallback` instead.
 *
 * Nothing the visitor typed is stored or logged. The audit row keeps the
 * agent, the model, token counts and an outcome code only: `completed` when
 * the visitor got a reply (with a note such as `cap` or `swapped` when it was
 * cut short or replaced), `failed` with the stop code otherwise. There is no
 * console call here on purpose; please keep it that way.
 */

import { ASSISTANT_AGENT, GUIDE_AGENT } from '@/lib/ai/agents'
import { ASSISTANT_PER_DAY, ASSISTANT_PER_MINUTE, visitorCallsUsed } from '@/lib/ai/assistant'
import { anthropicCueCall, runCue, type CueRunResult } from '@/lib/ai/cue/agent'
import { cueAskSchema, CUE_MESSAGE_MAX, CUE_TURN_MAX_CHARS } from '@/lib/ai/cue/ask'
import { cueDeps, listingNames, loadLists, loadPage } from '@/lib/ai/cue/data'
import { createMockCueCall } from '@/lib/ai/cue/mock'
import { buildCueMessages, cleanTurnText, cueSystem, CUE_PROMPT_VERSION } from '@/lib/ai/cue/prompt'
import { CUE_CONTENT_TYPE, encodeCueEvent, type CueEvent } from '@/lib/ai/cue/stream'
import { newTurnState, type CueToolContext } from '@/lib/ai/cue/tools'
import { fallbackHref, withinGuideBudget } from '@/lib/ai/guide'
import { aiKillSwitchOn, resolveProvider } from '@/lib/ai/provider'
import {
  countAgentAttemptsThisMonth,
  cueMessageUnits,
  monthlyCallBudget,
  monthlyCeilingUsd,
  withinMonthlyCeiling,
} from '@/lib/ai/spend'
import { parsePagePath } from '@/lib/assistant/page'
import { isFeatureEnabled } from '@/lib/env'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createServiceClient } from '@/lib/supabase/server'

/** Four model calls and their tools fit well inside this. */
export const maxDuration = 60

/** Bodies bigger than this are not a chat message. */
const MAX_BODY_BYTES = 32_000

const RESPONSE_HEADERS = {
  'Content-Type': CUE_CONTENT_TYPE,
  'Cache-Control': 'no-store',
  'X-Accel-Buffering': 'no',
} as const

function respond(events: CueEvent[]): Response {
  return new Response(events.map(encodeCueEvent).join(''), { headers: RESPONSE_HEADERS })
}

function fallback(text: string, reason: 'limited' | 'error'): Response {
  return respond([{ type: 'fallback', href: fallbackHref(text), reason }])
}

function rawMessage(input: unknown): string {
  if (input && typeof input === 'object' && 'message' in input && typeof input.message === 'string') {
    return input.message.slice(0, CUE_MESSAGE_MAX)
  }
  return ''
}

/**
 * A browser on another site can't spend our budget. Same-origin fetches send
 * an Origin that matches the host; a JSON body forces a preflight we never
 * answer.
 */
function sameSiteJson(request: Request): boolean {
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) return false
  const origin = request.headers.get('origin')
  if (!origin) return true
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/** The audit outcome: failed when the visitor got no reply. */
function outcome(result: CueRunResult, replied: boolean): { failed: boolean; code: string | null } {
  if (!replied) return { failed: true, code: result.stop }
  if (result.swapped) return { failed: false, code: 'swapped' }
  return { failed: false, code: result.stop === 'end' ? null : result.stop }
}

export async function POST(request: Request): Promise<Response> {
  // 0. and 1. Input.
  if (!sameSiteJson(request)) return fallback('', 'error')
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return fallback('', 'error')
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fallback('', 'error')
  }
  const parsed = cueAskSchema.safeParse(body)
  if (!parsed.success) return fallback(rawMessage(body), 'error')
  const { message, history, near, page: pagePath, cards: priorCards } = parsed.data

  // 2. Flag. 3. Kill switch.
  if (!isFeatureEnabled('aiAssistant')) return fallback(message, 'error')
  if (aiKillSwitchOn()) return fallback(message, 'error')

  // 4. Rate limit per IP. Both windows are charged on every message.
  const ip = getClientIp(request.headers)
  const [minuteOk, dayOk] = await Promise.all([
    checkRateLimit({
      bucket: 'ai_assistant',
      identifier: `min:${ip}`,
      limit: ASSISTANT_PER_MINUTE,
      windowSeconds: 60,
    }),
    checkRateLimit({
      bucket: 'ai_assistant',
      identifier: `day:${ip}`,
      limit: ASSISTANT_PER_DAY,
      windowSeconds: 86_400,
    }),
  ])
  if (!minuteOk || !dayOk) return fallback(message, 'limited')

  let requestId: string
  let run: (emit: (event: CueEvent) => void, signal: AbortSignal) => Promise<CueRunResult>
  const supabase = createServiceClient()
  try {
    // 5. Lists and names. No reply goes out unchecked.
    const [lists, names] = await Promise.all([loadLists(), listingNames()])
    if (!lists || !names) return fallback(message, 'error')

    // Throws PromptRedactionError when redaction fails; the catch falls back.
    const words = cleanTurnText(message, CUE_MESSAGE_MAX)
    if (!words) return fallback(message, 'error')
    const earlier = history
      .map((t) => ({ role: t.role, text: cleanTurnText(t.text, CUE_TURN_MAX_CHARS) }))
      .filter((t) => t.text !== '')

    // 6. and 7. Paid calls only.
    const { provider, model } = resolveProvider(ASSISTANT_AGENT)
    if (provider === 'anthropic') {
      if (!(await withinMonthlyCeiling())) return fallback(message, 'limited')
      const ceiling = monthlyCeilingUsd()
      if (ceiling === null) return fallback(message, 'limited')
      const [guideUsed, assistantUsed] = await Promise.all([
        countAgentAttemptsThisMonth(GUIDE_AGENT.agentType),
        countAgentAttemptsThisMonth(ASSISTANT_AGENT.agentType),
      ])
      if (!withinGuideBudget(visitorCallsUsed(guideUsed, assistantUsed * cueMessageUnits()), monthlyCallBudget(ceiling))) {
        return fallback(message, 'limited')
      }
    }

    const page = await loadPage(parsePagePath(pagePath))
    const cards = priorCards.map((c) => ({ id: c.id, name: cleanTurnText(c.name, 200) }))
    const ctx: CueToolContext = {
      categories: lists.categories,
      cities: lists.cities,
      near,
      page,
      priorIds: new Set(cards.map((c) => c.id)),
      state: newTurnState(),
      deps: cueDeps,
    }
    const system = cueSystem(lists.categories, lists.cities)
    const messages = buildCueMessages({
      history: earlier,
      message: words,
      page,
      nearShared: near !== null,
      priorCards: cards,
    })
    const call = provider === 'mock' ? createMockCueCall({ cities: lists.cities }) : anthropicCueCall()
    run = (emit, signal) => runCue({ call, model, system, messages, ctx, names, emit, signal })

    const { data: row, error: rowError } = await supabase
      .from('ai_generation_requests')
      .insert({
        listing_id: null,
        agent_type: ASSISTANT_AGENT.agentType,
        prompt_version: CUE_PROMPT_VERSION,
        model,
        provider,
        status: 'pending',
        created_by: null,
      })
      .select('id')
      .single()
    if (rowError || !row) return fallback(message, 'error')
    requestId = row.id
  } catch {
    // A database outage or a redaction failure. Deliberately drops the error:
    // it could carry the message.
    return fallback(message, 'error')
  }

  const encoder = new TextEncoder()
  const stopped = new AbortController()
  const signal = AbortSignal.any([request.signal, stopped.signal])

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true
      const emit = (event: CueEvent): void => {
        if (!open) return
        try {
          controller.enqueue(encoder.encode(encodeCueEvent(event)))
        } catch {
          open = false
        }
      }

      let result: CueRunResult | null = null
      try {
        result = await run(emit, signal)
      } catch {
        result = null
      }

      const replied = !!result && (result.text !== '' || result.cards.length > 0)
      if (result && replied) {
        if (result.cards.length > 0) emit({ type: 'cards', cards: result.cards })
        if (result.actions.length > 0) emit({ type: 'actions', actions: result.actions })
        emit({ type: 'done', text: result.text })
      } else {
        emit({ type: 'fallback', href: fallbackHref(message), reason: 'error' })
      }

      const { failed, code } = result ? outcome(result, replied) : { failed: true, code: 'provider_error' }
      const tokens = result
        ? { request_tokens: result.usage.inputTokens, response_tokens: result.usage.outputTokens }
        : {}
      try {
        await supabase
          .from('ai_generation_requests')
          .update(
            failed
              ? { status: 'failed', error_message: code, ...tokens }
              : { status: 'completed', error_message: code, ...tokens }
          )
          .eq('id', requestId)
      } catch {
        // The row stays pending. The visitor already has their reply.
      }

      if (open) {
        try {
          controller.close()
        } catch {
          // Already closed by the client going away.
        }
      }
    },
    cancel() {
      stopped.abort()
    },
  })

  return new Response(stream, { headers: RESPONSE_HEADERS })
}
