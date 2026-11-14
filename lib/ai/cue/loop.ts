/**
 * The model loop both Cues run (tickets 169 and 203): call the model, run the
 * tools it asks for, repeat, until it answers or a bound stops it.
 *
 * ── Bounds ───────────────────────────────────────────────────────────────────
 * At most CUE_MAX_CALLS model calls and CUE_MAX_TOOLS_PER_CALL tools per call,
 * an input size cap checked before every call, and a small output cap. The
 * spend ceiling prices this worst case (lib/ai/spend.ts), whichever Cue runs.
 *
 * ── Settings ─────────────────────────────────────────────────────────────────
 * Thinking off and low effort: this is a chat, speed matters more than depth.
 * No sampling settings and no prefill; the current models reject both.
 *
 * ── What reaches the screen ──────────────────────────────────────────────────
 * Text streams through TextGuard, which holds back links and phone numbers.
 * What the caller does with the finished reply (checks, cards, drafts) is the
 * caller's own; this loop only gathers the words.
 *
 * Nothing here logs. Errors carry a fixed code, never content.
 */

import type Anthropic from '@anthropic-ai/sdk'

import { TextGuard } from './guard'
import { CUE_INPUT_CHAR_CAP, CUE_MAX_CALLS, CUE_MAX_TOKENS, CUE_MAX_TOOLS_PER_CALL } from './limits'
import { withCacheMark } from './prompt'

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

export interface CueToolRun {
  content: string
  isError?: boolean
}

/** The two events the loop writes while it works. */
export type CueProgressEvent = { type: 'status'; text: string } | { type: 'text'; text: string }

export interface ToolLoopArgs {
  call: CueModelCall
  model: string
  system: Anthropic.TextBlockParam[]
  messages: Anthropic.MessageParam[]
  tools: readonly Anthropic.Tool[]
  runTool: (name: string, input: unknown) => Promise<CueToolRun>
  /** The line shown while a tool runs. */
  statusFor: (name: string, input: unknown) => string
  emit: (event: CueProgressEvent) => void
  signal: AbortSignal
  /** Streamed between one call's words and the next's. The visitor Cue runs
   *  them on as one paragraph (' '); the owner Cue starts a new one ('\n\n'). */
  partBreak?: string
}

export interface ToolLoopResult {
  /** The text of each call, trimmed, in order. Empty after a refusal. */
  replyParts: string[]
  stop: CueStop
  usage: CueUsage
  calls: number
}

function asParams(content: readonly Anthropic.ContentBlock[]): Anthropic.ContentBlockParam[] {
  const out: Anthropic.ContentBlockParam[] = []
  for (const block of content) {
    if (block.type === 'text') out.push({ type: 'text', text: block.text })
    else if (block.type === 'tool_use')
      out.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input })
  }
  return out
}

function textOf(message: Anthropic.Message): string {
  return message.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
}

export async function runToolLoop(args: ToolLoopArgs): Promise<ToolLoopResult> {
  const { emit, signal } = args
  const toolsChars = JSON.stringify(args.tools).length
  const inputChars = (messages: readonly Anthropic.MessageParam[]) =>
    toolsChars + JSON.stringify(args.system).length + JSON.stringify(messages).length

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
    if (inputChars(messages) > CUE_INPUT_CHAR_CAP) {
      stop = 'too_long'
      break
    }

    let emittedThisCall = false
    const guard = new TextGuard((text) => {
      if (!emittedThisCall && streamedAny) emit({ type: 'text', text: args.partBreak ?? ' ' })
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
          tools: [...args.tools],
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

    emit({ type: 'status', text: args.statusFor(uses[0]!.name, uses[0]!.input) })
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
          const r = await args.runTool(use.name, use.input)
          return {
            type: 'tool_result',
            tool_use_id: use.id,
            content: r.content,
            ...(r.isError ? { is_error: true } : {}),
          }
        })
      )
    } catch {
      stop = 'data_error'
      break
    }
    messages.push({ role: 'assistant', content: asParams(message.content) })
    messages.push({ role: 'user', content: results })
  }

  return { replyParts, stop: stop ?? 'end', usage, calls }
}
