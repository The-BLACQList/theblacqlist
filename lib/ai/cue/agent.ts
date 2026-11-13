/**
 * Cue's loop (ticket 169): the model searches with tools, picks cards, then
 * writes a short reply that streams to the visitor as it is written.
 *
 * The loop itself, its bounds and its settings live in ./loop.ts, shared with
 * the owner Cue (ticket 203). This file adds the visitor's half: the search
 * tools, the cards, and the final reply check.
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

import { checkReply, cleanReply, lastFullSentence, SWAP_WITH_CARDS, type CueName } from './guard'
import { CUE_INPUT_CHAR_CAP, CUE_MAX_CALLS, CUE_MAX_TOKENS, CUE_MAX_TOOLS_PER_CALL } from './limits'
import { CueCallError, runToolLoop, type CueModelCall, type CueStop, type CueUsage } from './loop'
import type { CueEvent } from './stream'
import { CUE_MAX_CARDS, CUE_TOOLS, runCueTool, statusFor, turnOutput, type CueToolContext } from './tools'

export { CUE_INPUT_CHAR_CAP, CUE_MAX_CALLS, CUE_MAX_TOKENS, CUE_MAX_TOOLS_PER_CALL }
export { CueCallError, type CueCallErrorCode, type CueModelCall, type CueStop, type CueUsage } from './loop'

/** Cards shown when the loop ends early without choosing any. */
const EARLY_CARDS = 3

const TIMEOUT_MS = 20_000

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

export interface CueRunResult {
  text: string
  cards: AssistantCard[]
  actions: AssistantAction[]
  stop: CueStop
  swapped: boolean
  usage: CueUsage
  calls: number
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
  const { ctx } = args
  const loop = await runToolLoop({
    call: args.call,
    model: args.model,
    system: args.system,
    messages: args.messages,
    tools: CUE_TOOLS,
    runTool: (name, input) => runCueTool(name, input, ctx),
    statusFor: (name, input) => statusFor(name, input, ctx),
    emit: args.emit,
    signal: args.signal,
  })
  return finish({ ctx, names: args.names, ...loop })
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
