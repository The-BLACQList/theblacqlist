/**
 * The wire format between /api/cue and the chat panel (ticket 169).
 *
 * One JSON object per line. The server writes `status` and `text` while Cue
 * works, then `cards`, `actions` and `done`, or a single `fallback` when Cue
 * can't answer at all. `done.text` is the checked reply: the panel replaces
 * the streamed text with it, which is how a swapped reply reaches the screen.
 *
 * Shared by the route and the browser, so no server imports.
 */

import type { AssistantAction, AssistantCard } from '@/lib/ai/assistant-limits'

export type CueEvent =
  | { type: 'status'; text: string }
  | { type: 'text'; text: string }
  | { type: 'cards'; cards: AssistantCard[] }
  | { type: 'actions'; actions: AssistantAction[] }
  | { type: 'done'; text: string }
  | { type: 'fallback'; href: string; reason: 'limited' | 'error' }

const TYPES: ReadonlySet<string> = new Set(['status', 'text', 'cards', 'actions', 'done', 'fallback'])

export const CUE_CONTENT_TYPE = 'application/x-ndjson; charset=utf-8'

export function encodeCueEvent(event: CueEvent): string {
  return `${JSON.stringify(event)}\n`
}

function parseLine(line: string): CueEvent | null {
  if (!line.trim()) return null
  try {
    const value: unknown = JSON.parse(line)
    if (!value || typeof value !== 'object') return null
    const type = (value as { type?: unknown }).type
    return typeof type === 'string' && TYPES.has(type) ? (value as CueEvent) : null
  } catch {
    return null
  }
}

/**
 * Reads events out of decoded text chunks, however the network split them.
 * A line that isn't a known event is skipped.
 */
export function createCueParser(): { push(chunk: string): CueEvent[]; end(): CueEvent[] } {
  let buffer = ''
  return {
    push(chunk) {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      return lines.map(parseLine).filter((e): e is CueEvent => e !== null)
    },
    end() {
      const last = parseLine(buffer)
      buffer = ''
      return last ? [last] : []
    },
  }
}
