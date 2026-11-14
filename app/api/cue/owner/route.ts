/**
 * POST /api/cue/owner: one owner message to the dashboard Cue, streamed back
 * (ticket 203).
 *
 * Checks, in order. Every "no" is a single `fallback` event:
 *   1. a same-site JSON request of reasonable size
 *   2. the input (lib/ai/cue/owner/ask.ts): a message of 1 to 300 characters,
 *      up to twelve earlier turns, and the page open (optional, a uuid)
 *   3. FEATURE_OWNER_CUE is on (read at request time), then the AI kill switch
 *   4. a signed-in user (getOwnerSession) who owns at least one page
 *   5. rate limit per user: 20 an hour, 100 a day (bucket 'owner_cue')
 *   6. paid calls only: the monthly AI ceiling, and the owner share (20% of
 *      the monthly call budget, each message counted as cueMessageUnits())
 *   7. one audit row: agent 'owner_cue', listing_id null so a chat never uses
 *      a page's writing allowance, created_by the owner
 *
 * Then the loop runs (lib/ai/cue/owner/run.ts). Every tool checks the page is
 * the caller's own. Drafts are pending suggestions: nothing reaches the page
 * until the owner chooses "Use this" in the panel.
 *
 * Nothing the owner typed is stored or logged. The audit row keeps the agent,
 * the model, token counts and an outcome code only. There is no console call
 * here on purpose; please keep it that way.
 */

import { OWNER_CUE_AGENT } from '@/lib/ai/agents'
import { createMockOwnerCueCall } from '@/lib/ai/cue/owner/mock'
import { anthropicCueCall } from '@/lib/ai/cue/agent'
import { CUE_TURN_MAX_CHARS } from '@/lib/ai/cue/ask'
import { ownerCueAskSchema, OWNER_CUE_MESSAGE_MAX } from '@/lib/ai/cue/owner/ask'
import { loadOwnedPages, loadPageFacts } from '@/lib/ai/cue/owner/data'
import type { OwnerCueEvent } from '@/lib/ai/cue/owner/events'
import {
  OWNER_CUE_PER_DAY,
  OWNER_CUE_PER_HOUR,
  withinOwnerCueBudget,
} from '@/lib/ai/cue/owner/limits'
import {
  buildOwnerCueMessages,
  ownerCueSystem,
  OWNER_CUE_PROMPT_VERSION,
} from '@/lib/ai/cue/owner/prompt'
import { runOwnerCue, type OwnerCueResult } from '@/lib/ai/cue/owner/run'
import { availableSections } from '@/lib/ai/cue/owner/sections'
import { newOwnerTurnState, type OwnerCueContext } from '@/lib/ai/cue/owner/tools'
import { stripLinks } from '@/lib/ai/guide'
import { loadOwnerNames } from '@/lib/ai/ownerName'
import { aiKillSwitchOn, resolveProvider } from '@/lib/ai/provider'
import { ownerNameTerms } from '@/lib/ai/redact'
import { requestSuggestion } from '@/lib/ai/requestSuggestion'
import { sanitizeForPrompt } from '@/lib/ai/sanitize'
import { CUE_CONTENT_TYPE, encodeCueEvent } from '@/lib/ai/cue/stream'
import {
  countAgentAttemptsThisMonth,
  cueMessageUnits,
  monthlyCallBudget,
  monthlyCeilingUsd,
  withinMonthlyCeiling,
} from '@/lib/ai/spend'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { getPlanAvailability, isTierOpen } from '@/lib/stripe/availability'
import { PLANS, type PlanSlug } from '@/lib/stripe/plans'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/** Four model calls and their tools, one of them a draft, fit inside this. */
export const maxDuration = 60

const MAX_BODY_BYTES = 32_000

const RESPONSE_HEADERS = {
  'Content-Type': CUE_CONTENT_TYPE,
  'Cache-Control': 'no-store',
  'X-Accel-Buffering': 'no',
} as const

function respond(events: OwnerCueEvent[]): Response {
  return new Response(events.map(encodeCueEvent).join(''), { headers: RESPONSE_HEADERS })
}

function fallback(reason: 'limited' | 'error' | 'auth'): Response {
  return respond([{ type: 'fallback', reason }])
}

/** Same check as /api/cue: another site can't spend our budget. */
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

function cleanOwnerText(text: string, max: number, terms: readonly string[]): string {
  return stripLinks(sanitizeForPrompt(text, max, { ownerNameTerms: terms })).trim()
}

function outcome(
  result: OwnerCueResult,
  replied: boolean
): { failed: boolean; code: string | null } {
  if (!replied) return { failed: true, code: result.stop }
  return { failed: false, code: result.stop === 'end' ? null : result.stop }
}

export async function POST(request: Request): Promise<Response> {
  // 1. and 2. Input.
  if (!sameSiteJson(request)) return fallback('error')
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return fallback('error')
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fallback('error')
  }
  const parsed = ownerCueAskSchema.safeParse(body)
  if (!parsed.success) return fallback('error')
  const { message, history, listingId } = parsed.data

  // 3. Flag, then kill switch.
  if (!isFeatureEnabled('ownerCue')) return fallback('error')
  if (aiKillSwitchOn()) return fallback('error')

  // 4. Signed in, and owns at least one page.
  const owner = await getOwnerSession()
  if (!owner) return fallback('auth')
  const userId = owner.user.id

  // 5. Rate limit per user. Both windows are charged on every message.
  const [hourOk, dayOk] = await Promise.all([
    checkRateLimit({
      bucket: 'owner_cue',
      identifier: `hour:${userId}`,
      limit: OWNER_CUE_PER_HOUR,
      windowSeconds: 3_600,
    }),
    checkRateLimit({
      bucket: 'owner_cue',
      identifier: `day:${userId}`,
      limit: OWNER_CUE_PER_DAY,
      windowSeconds: 86_400,
    }),
  ])
  if (!hourOk || !dayOk) return fallback('limited')

  let requestId: string
  let run: (emit: (event: OwnerCueEvent) => void, signal: AbortSignal) => Promise<OwnerCueResult>
  const service = createServiceClient()
  try {
    const supabase = await createClient()
    const pages = await loadOwnedPages(supabase, userId)
    if (!pages || pages.length === 0) return fallback('error')
    const currentId = listingId && pages.some((p) => p.id === listingId) ? listingId : null

    // The owner's name comes out of what they typed. Unreadable: send nothing.
    const names = await loadOwnerNames(userId)
    if (!names.ok) return fallback('error')
    const terms = ownerNameTerms(names.names, pages.map((p) => p.name).join(' '))
    // Throws PromptRedactionError when redaction fails; the catch falls back.
    const words = cleanOwnerText(message, OWNER_CUE_MESSAGE_MAX, terms)
    if (!words) return fallback('error')
    const earlier = history
      .map((t) => ({ role: t.role, text: cleanOwnerText(t.text, CUE_TURN_MAX_CHARS, terms) }))
      .filter((t) => t.text !== '')

    // 6. Paid calls only.
    const { provider, model } = resolveProvider(OWNER_CUE_AGENT)
    if (provider === 'anthropic') {
      if (!(await withinMonthlyCeiling())) return fallback('limited')
      const ceiling = monthlyCeilingUsd()
      if (ceiling === null) return fallback('limited')
      const used = await countAgentAttemptsThisMonth(OWNER_CUE_AGENT.agentType)
      const units = cueMessageUnits()
      if (!withinOwnerCueBudget(used * units, units, monthlyCallBudget(ceiling)))
        return fallback('limited')
    }

    const availability = await getPlanAvailability(service)
    const openTiers = new Set<PlanSlug>(
      PLANS.filter((p) => isTierOpen(availability, p.slug)).map((p) => p.slug)
    )
    const writingHelp = isFeatureEnabled('aiBeta')
    const ctx: OwnerCueContext = {
      pages,
      currentId,
      sections: new Set(availableSections(isFeatureEnabled)),
      openTiers,
      writingHelp,
      deps: {
        pageFacts: (page) => loadPageFacts(supabase, page, userId, names.names),
        requestDraft: (id, agentType) => requestSuggestion(userId, { listingId: id, agentType }),
      },
      state: newOwnerTurnState(),
    }
    const system = ownerCueSystem()
    const messages = buildOwnerCueMessages({
      history: earlier,
      message: words,
      pages,
      currentId,
      writingHelp,
    })
    const call = provider === 'mock' ? createMockOwnerCueCall() : anthropicCueCall()
    run = (emit, signal) => runOwnerCue({ call, model, system, messages, ctx, emit, signal })

    // 7. The audit row. No text.
    const { data: row, error: rowError } = await service
      .from('ai_generation_requests')
      .insert({
        listing_id: null,
        agent_type: OWNER_CUE_AGENT.agentType,
        prompt_version: OWNER_CUE_PROMPT_VERSION,
        model,
        provider,
        status: 'pending',
        created_by: userId,
      })
      .select('id')
      .single()
    if (rowError || !row) return fallback('error')
    requestId = row.id
  } catch {
    // A database outage or a redaction failure. Deliberately drops the error:
    // it could carry the message.
    return fallback('error')
  }

  const encoder = new TextEncoder()
  const stopped = new AbortController()
  const signal = AbortSignal.any([request.signal, stopped.signal])

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true
      const emit = (event: OwnerCueEvent): void => {
        if (!open) return
        try {
          controller.enqueue(encoder.encode(encodeCueEvent(event)))
        } catch {
          open = false
        }
      }

      let result: OwnerCueResult | null = null
      try {
        result = await run(emit, signal)
      } catch {
        result = null
      }

      const replied =
        !!result && (result.text !== '' || result.drafts.length > 0 || result.links.length > 0)
      if (result && replied) {
        for (const draft of result.drafts) emit({ type: 'draft', draft })
        if (result.links.length > 0) emit({ type: 'links', links: result.links })
        emit({ type: 'done', text: result.text })
      } else {
        emit({ type: 'fallback', reason: 'error' })
      }

      const { failed, code } = result
        ? outcome(result, replied)
        : { failed: true, code: 'provider_error' }
      const tokens = result
        ? { request_tokens: result.usage.inputTokens, response_tokens: result.usage.outputTokens }
        : {}
      try {
        await service
          .from('ai_generation_requests')
          .update(
            failed
              ? { status: 'failed', error_message: code, ...tokens }
              : { status: 'completed', error_message: code, ...tokens }
          )
          .eq('id', requestId)
      } catch {
        // The row stays pending. The owner already has their reply.
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
