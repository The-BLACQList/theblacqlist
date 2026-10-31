// =============================================================================
// Cue's prompt and messages (ticket 169)
// =============================================================================
// The system prompt is fixed apart from the lists, so it caches. History is
// trimmed to whole exchanges, and the context block rides on the last message.
// =============================================================================

import { describe, expect, it } from 'vitest'

import {
  buildCueMessages,
  CUE_HISTORY_MAX_CHARS,
  CUE_HISTORY_TURNS,
  cueSystem,
  normalizeHistory,
  withCacheMark,
  type CueTurn,
} from '@/lib/ai/cue/prompt'
import { NO_PAGE } from '@/lib/assistant/page'

import { CATEGORIES, CITIES } from './fixtures/cue'

describe('cueSystem', () => {
  it('is the same for the same lists, in any order, so it caches', () => {
    const a = cueSystem(CATEGORIES, CITIES)
    const b = cueSystem([...CATEGORIES].reverse(), [...CITIES].reverse())
    expect(a).toEqual(b)
    expect(a.at(-1)?.cache_control).toEqual({ type: 'ephemeral' })
  })

  it('lists only the cities we cover', () => {
    const lists = cueSystem(CATEGORIES, CITIES).at(-1)!.text
    expect(lists).toContain('atlanta: Atlanta, GA')
    expect(lists).not.toContain('savannah')
    expect(lists).toContain('law-legal-services: Law & Legal Services (in professional-services)')
  })

  it('never names ownership labels as something to filter by', () => {
    const rules = cueSystem(CATEGORIES, CITIES)[0]!.text
    expect(rules).not.toContain('ownership_label')
    expect(rules).not.toMatch(/—/)
  })
})

describe('normalizeHistory', () => {
  const turn = (role: CueTurn['role'], text: string): CueTurn => ({ role, text })

  it('merges repeats, drops empties, and starts and ends on the right turn', () => {
    const out = normalizeHistory([
      turn('assistant', 'Hi.'),
      turn('user', 'lawyer'),
      turn('user', 'in atlanta'),
      turn('assistant', ''),
      turn('assistant', 'Here are two.'),
      turn('user', 'unanswered'),
    ])
    expect(out).toEqual([turn('user', 'lawyer\nin atlanta'), turn('assistant', 'Here are two.')])
  })

  it('keeps the newest turns only', () => {
    const many: CueTurn[] = []
    for (let i = 0; i < 10; i++) many.push(turn('user', `q${i}`), turn('assistant', `a${i}`))
    const out = normalizeHistory(many)
    expect(out).toHaveLength(CUE_HISTORY_TURNS)
    expect(out.at(-1)).toEqual(turn('assistant', 'a9'))
    expect(out[0]?.role).toBe('user')
  })

  it('drops whole exchanges until it fits the character cap', () => {
    const big = 'x'.repeat(CUE_HISTORY_MAX_CHARS / 2)
    const out = normalizeHistory([turn('user', big), turn('assistant', big), turn('user', 'q'), turn('assistant', 'a')])
    expect(out).toEqual([turn('user', 'q'), turn('assistant', 'a')])
  })
})

describe('buildCueMessages', () => {
  it('ends with the context block, then the message', () => {
    const messages = buildCueMessages({
      history: [{ role: 'user', text: 'lawyer in atlanta' }, { role: 'assistant', text: 'Here are two.' }],
      message: 'what about houston?',
      page: NO_PAGE,
      nearShared: false,
      priorCards: [{ id: 'id-1', name: 'Peach Law Group' }],
    })
    expect(messages).toHaveLength(3)
    const last = messages.at(-1)!
    expect(last.role).toBe('user')
    const blocks = last.content as Array<{ type: 'text'; text: string }>
    expect(blocks[0]!.text).toMatch(/^<context>/)
    expect(blocks[0]!.text).toContain('Location shared: no')
    expect(blocks[0]!.text).toContain('id-1 Peach Law Group')
    expect(blocks[1]!.text).toBe('what about houston?')
  })
})

describe('withCacheMark', () => {
  it('marks only the last block, on a copy', () => {
    const messages = buildCueMessages({ history: [], message: 'hi', page: NO_PAGE, nearShared: false, priorCards: [] })
    const marked = withCacheMark(messages)
    const blocks = marked.at(-1)!.content as Array<{ cache_control?: unknown }>
    expect(blocks.at(-1)!.cache_control).toEqual({ type: 'ephemeral' })
    expect(blocks[0]!.cache_control).toBeUndefined()
    expect((messages.at(-1)!.content as Array<{ cache_control?: unknown }>).at(-1)!.cache_control).toBeUndefined()
  })

  it('turns a plain string message into a marked text block', () => {
    const marked = withCacheMark([{ role: 'user', content: 'hi' }])
    expect(marked[0]!.content).toEqual([{ type: 'text', text: 'hi', cache_control: { type: 'ephemeral' } }])
  })
})
