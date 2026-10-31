/**
 * Cue's loop (ticket 169): the model searches with tools, picks cards, then
 * writes a short reply that streams to the visitor as it is written.
 *
 * ── Bounds ───────────────────────────────────────────────────────────────────
 * At most CUE_MAX_CALLS model calls and CUE_MAX_TOOLS_PER_CALL tools per call,
 * an input size cap checked before every call, and a small output cap. The
 * spend ceiling prices this worst case (lib/ai/spend.ts).
 *
 * ── Settings ─────────────────────────────────────────────────────────────────
 * Thinking off and low effort: this is a chat, speed matters more than depth.
 * No sampling settings and no prefill; the current models reject both.
 *
 * ── What reaches the screen ──────────────────────────────────────────────────
 * Text streams through TextGuard, which holds back links and phone numbers.
 * The finished reply then goes through checkReply; the route sends that as
 * `done`, and the panel shows it in place of what streamed.
 *
 * Nothing here logs. Errors carry a fixed code, never content.
 */

import Anthropic, { APIError, APIUserAbortError } from '@anthropic-ai/sdk'

import type { AssistantAction, AssistantCard } from '@/lib/ai/assistant-limits'

import { checkReply, cleanReply, lastFullSentence, SWAP_WITH_CARDS, TextGuard, type CueName } from './guard'
import { CUE_INPUT_CHAR_CAP, CUE_MAX_CALLS, CUE_MAX_TOKENS, CUE_MAX_TOOLS_PER_CALL } from './limits'
import { withCacheMark } from './prompt'
import type { CueEvent } from './stream'
import { CUE_MAX_CARDS, CUE_TOOLS, runCueTool, statusFor, turnOutput, type CueToolContext } from './tools'

export { CUE_INPUT_CHAR_CAP, CUE_MAX_CALLS, CUE_MAX_TOKENS, CUE_MAX_TOOLS_PER_CALL }

/** Cards shown when the loop ends early without choosing any. */
const EARLY_CARDS = 3

const TIMEOUT_MS = 20_000
const TOOLS_CHARS = JSON.stringify(CUE_TOOLS).length

export type CueCallErrorCode = 'provider_error' | 'aborted' | 'bad_json'

export class CueCallError extends Error {
  constructor(readonly code: CueCallErrorCode) {
    super(code)
    this.name = 'CueCallError'
  }
}

/** One streamed model call. Text deltas go to onText as they arrive. */
export type CueModelCall = (
  params: Anthropic.MessageStreamParams,
  onText: (delta: string) => void,
  signal: AbortSignal
) => Promise<Anthropic.Message>

/** The real call. */
export function anthropicCueCall(): CueModelCall {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: TIMEOUT_MS,
    maxRetries: 1,
  })
  return async (params, onText, signal) => {
    try {
      const stream = client.messages.stream(params, { signal })
      stream.on('text', (delta) => onText(delta))
      return await stream.finalMessage()
    } catch (err) {
      // Deliberately drops the error: its message can carry request content.
      if (signal.aborted || err instanceof APIUserAbortError) throw new CueCallError('aborted')
      if (err instanceof APIError) throw new CueCallError('provider_error')
      // Anything else is the SDK failing to read a streamed tool input.
      throw new CueCallError('bad_json')
    }
  }
}

export type CueStop =
  | 'end'
  | 'cap'
  | 'refusal'
  | 'truncated'
  | 'too_long'
  | 'data_error'
  | 'provider_error'
  | 'bad_json'
  | 'aborted'

export interface CueUsage {
  inputTokens: number
  outputTokens: number
  /** Of inputTokens, how many were read from cache. */
  cacheReadTokens: number
}

export interface CueRunResult {
  text: string
  cards: AssistantCard[]
  actions: AssistantAction[]
  stop: CueStop
  swapped: boolean
  usage: CueUsage
  calls: number
}

function asParams(content: readonly Anthropic.ContentBlock[]): Anthropic.ContentBlockParam[] {
  const out: Anthropic.ContentBlockParam[] = []
  for (const block of content) {
    if (block.type === 'text') out.push({ type: 'text', text: block.text })
    else if (block.type === 'tool_use') out.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input })
  }
  return out
}

function textOf(message: Anthropic.Message): string {
  return message.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
}

function inputChars(system: readonly Anthropic.TextBlockParam[], messages: readonly Anthropic.MessageParam[]): number {
  return TOOLS_CHARS + JSON.stringify(system).length + JSON.stringify(messages).length
}

export async function runCue(args: {
  call: CueModelCall
  model: string
  system: Anthropic.TextBlockParam[]
  messages: Anthropic.MessageParam[]
  ctx: CueToolContext
  /** Every listed business, for the name check. */
  names: readonly CueName[]
  emit: (event: CueEvent) => void
  signal: AbortSignal
}): Promise<CueRunResult> {
  const { ctx, emit, signal } = args
  const messages = [...args.messages]
  const usage: CueUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 }
  const replyParts: string[] = []
  let streamedAny = false
  let calls = 0
  let retried = false
  let stop: CueStop | null = null

  while (stop === null) {
    if (signal.aborted) {
      stop = 'aborted'
      break
    }
    if (calls >= CUE_MAX_CALLS) {
      stop = 'cap'
      break
    }
    if (inputChars(args.system, messages) > CUE_INPUT_CHAR_CAP) {
      stop = 'too_long'
      break
    }

    let emittedThisCall = false
    const guard = new TextGuard((text) => {
      if (!emittedThisCall && streamedAny) emit({ type: 'text', text: ' ' })
      emittedThisCall = true
      streamedAny = true
      emit({ type: 'text', text })
    })

    let message: Anthropic.Message
    calls++
    try {
      message = await args.call(
        {
          model: args.model,
          max_tokens: CUE_MAX_TOKENS,
          system: args.system,
          tools: [...CUE_TOOLS],
          messages: withCacheMark(messages),
          thinking: { type: 'disabled' },
          output_config: { effort: 'low' },
        },
        (delta) => guard.push(delta),
        signal
      )
    } catch (err) {
      const code = err instanceof CueCallError ? err.code : 'provider_error'
      if (code === 'bad_json' && !retried && !emittedThisCall) {
        retried = true
        continue
      }
      stop = code
      break
    }
    guard.end()

    usage.inputTokens +=
      message.usage.input_tokens +
      (message.usage.cache_creation_input_tokens ?? 0) +
      (message.usage.cache_read_input_tokens ?? 0)
    usage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0
    usage.outputTokens += message.usage.output_tokens

    if (message.stop_reason === 'refusal') {
      replyParts.length = 0
      stop = 'refusal'
      break
    }
    const text = textOf(message)
    if (text.trim()) replyParts.push(text.trim())
    if (message.stop_reason === 'max_tokens') {
      stop = 'truncated'
      break
    }

    const uses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    if (message.stop_reason !== 'tool_use' || uses.length === 0) {
      stop = 'end'
      break
    }

    emit({ type: 'status', text: statusFor(uses[0]!.name, uses[0]!.input, ctx) })
    let results: Anthropic.ToolResultBlockParam[]
    try {
      results = await Promise.all(
        uses.map(async (use, i): Promise<Anthropic.ToolResultBlockParam> => {
          if (i >= CUE_MAX_TOOLS_PER_CALL) {
            return {
              type: 'tool_result',
              tool_use_id: use.id,
              content: `Too many tools at once. Call at most ${CUE_MAX_TOOLS_PER_CALL} per turn.`,
              is_error: true,
            }
          }
          const r = await runCueTool(use.name, use.input, ctx)
          return { type: 'tool_result', tool_use_id: use.id, content: r.content, ...(r.isError ? { is_error: true } : {}) }
        })
      )
    } catch {
      stop = 'data_error'
      break
    }
    messages.push({ role: 'assistant', content: asParams(message.content) })
    messages.push({ role: 'user', content: results })
  }

  return finish({ ...args, stop: stop ?? 'end', replyParts, usage, calls })
}

function finish(args: {
  ctx: CueToolContext
  names: readonly CueName[]
  stop: CueStop
  replyParts: string[]
  usage: CueUsage
  calls: number
}): CueRunResult {
  const { ctx, stop } = args
  // Cut short before choosing cards: show the first few it found.
  if (stop !== 'end' && stop !== 'refusal' && ctx.state.shown.length === 0) {
    ctx.state.shown = [...ctx.state.seen.keys()].slice(0, Math.min(EARLY_CARDS, CUE_MAX_CARDS))
  }
  const { cards, actions } = turnOutput(ctx)

  let text = cleanReply(args.replyParts.join(' '))
  if (stop === 'refusal') text = ''
  else if (stop !== 'end') text = lastFullSentence(text)

  const allowedIds = new Set([...ctx.state.seen.keys(), ...ctx.priorIds])
  const skipNames = [
    ...[...ctx.state.seen.values()].map((e) => e.name),
    ...ctx.page.names,
    ...ctx.categories.map((c) => c.name),
    ...ctx.cities.map((c) => c.name),
  ]
  let swapped = false
  if (text) {
    const checked = checkReply({ text, hasCards: cards.length > 0, names: args.names, allowedIds, skipNames })
    text = checked.text
    swapped = checked.swapped
  }
  if (!text && cards.length > 0) text = SWAP_WITH_CARDS

  return { text, cards, actions, stop, swapped, usage: args.usage, calls: args.calls }
}
