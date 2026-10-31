/**
 * A scripted stand-in for the model (ticket 169), so Preview and CI run the
 * whole chat (tools, cards, streaming, guards) without a key or any spend.
 * `resolveProvider` picks it exactly as it picks the mock for the other agents.
 *
 * The script: search the words typed in the city named, show the first three
 * results, then say how many. It reads nothing but the messages it is given.
 */

import type Anthropic from '@anthropic-ai/sdk'

import { findPlaces, meaningfulWords, type AssistCity } from '@/lib/search/assist'

import type { CueModelCall } from './agent'

const SHOW_COUNT = 3

function blocks(message: Anthropic.MessageParam): Anthropic.ContentBlockParam[] {
  return typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content
}

/** The visitor's newest message: the last text block of the last plain user turn. */
function visitorText(messages: readonly Anthropic.MessageParam[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!
    if (m.role !== 'user') continue
    const texts = blocks(m).filter((b): b is Anthropic.TextBlockParam => b.type === 'text')
    const last = texts.at(-1)
    if (last && !last.text.startsWith('<context>')) return last.text
  }
  return ''
}

/** The tool the model called last, and what came back for it. */
function lastTool(
  messages: readonly Anthropic.MessageParam[]
): { name: string; input: unknown; result: string } | null {
  const last = messages.at(-1)
  const prev = messages.at(-2)
  if (!last || !prev || last.role !== 'user' || prev.role !== 'assistant') return null
  const result = blocks(last).find((b): b is Anthropic.ToolResultBlockParam => b.type === 'tool_result')
  if (!result) return null
  const use = blocks(prev).find(
    (b): b is Anthropic.ToolUseBlockParam => b.type === 'tool_use' && b.id === result.tool_use_id
  )
  if (!use) return null
  const content =
    typeof result.content === 'string'
      ? result.content
      : (result.content ?? []).map((c) => (c.type === 'text' ? c.text : '')).join('')
  return { name: use.name, input: use.input, result: content }
}

function resultIds(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as { results?: Array<{ id?: unknown }> }
    return (parsed.results ?? []).map((r) => r.id).filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

function message(
  model: string,
  content: Anthropic.ContentBlock[],
  stop: Anthropic.StopReason
): Anthropic.Message {
  return {
    id: 'msg_mock',
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  } as unknown as Anthropic.Message
}

export function createMockCueCall(args: { cities: readonly AssistCity[] }): CueModelCall {
  let n = 0
  const toolUse = (model: string, name: string, input: Record<string, unknown>) =>
    message(model, [{ type: 'tool_use', id: `toolu_mock_${++n}`, name, input } as Anthropic.ContentBlock], 'tool_use')

  const say = (model: string, text: string, onText: (d: string) => void) => {
    for (const piece of text.split(/(?<= )/)) onText(piece)
    return message(model, [{ type: 'text', text, citations: null } as Anthropic.ContentBlock], 'end_turn')
  }

  return async (params, onText, signal) => {
    if (signal.aborted) throw new Error('aborted')
    const model = params.model
    const tool = lastTool(params.messages)

    if (tool?.name === 'search_listings') {
      const ids = resultIds(tool.result).slice(0, SHOW_COUNT)
      if (ids.length > 0) return toolUse(model, 'show_businesses', { ids })
      return say(model, "That's not on The BLACQList yet. Try other words, or another city.", onText)
    }
    if (tool?.name === 'show_businesses') {
      const count = (tool.input as { ids?: unknown[] }).ids?.length ?? 0
      return say(model, `Here ${count === 1 ? 'is 1 place' : `are ${count} places`} that match.`, onText)
    }
    if (tool) return say(model, "Here's what I found.", onText)

    const { places, rest } = findPlaces(visitorText(params.messages), args.cities)
    const words = meaningfulWords(rest).slice(0, 8)
    if (words.length === 0) return say(model, 'What are you looking for, and in which city?', onText)
    const city = places[0]?.activeCities[0]?.slug
    return toolUse(model, 'search_listings', { words, ...(city ? { city } : {}) })
  }
}
