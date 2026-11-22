// =============================================================================
// Follow-ups inside the /search answer strip (ticket 258)
// =============================================================================
// The thread's rules (lib/search/answerThread.ts) and the strip as drawn
// (AnswerThreadView), rendered to markup without a browser:
//
//   * the strip holds six turns; the follow-up box shows below that, the
//     "continue in the chat" line at it
//   * Continue in Chat shows once Cue wrote something, and never hands the
//     chat a turn twice
//   * earlier answers fold; the newest is always open
//   * a follow-up answered by the quick answer says so
//   * this tab's threads come back for Back, with links checked, ten at most
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }))

import type { CueReply } from '@/lib/ai/assistant-limits'
import type { AssistantTurn } from '@/lib/assistant/store'
import {
  canFollowUp,
  hasCueTurn,
  keepThread,
  readThread,
  SEARCH_THREAD_MAX_TURNS,
  shouldKeepThread,
  THREAD_CACHE_KEY,
  threadKey,
  turnsForChat,
} from '@/lib/search/answerThread'
import {
  AnswerThreadView,
  FOLLOW_UP_LABEL,
  THREAD_FULL_LINE,
  type PendingTurn,
} from '@/components/discovery/CueSearchAnswer'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
}

function reply(text: string, extra: Partial<Extract<CueReply, { kind: 'reply' }>> = {}): CueReply {
  return { kind: 'reply', text, cards: [], actions: [], near: false, mode: 'ai', ...extra }
}

function turn(n: number, r: CueReply = reply(`Answer number ${n}.`)): AssistantTurn {
  return { id: `t${n}`, ask: `Question number ${n}`, reply: r }
}

function thread(n: number): AssistantTurn[] {
  return Array.from({ length: n }, (_, i) => turn(i + 1))
}

// ─── The rules ────────────────────────────────────────────────────────────────

describe('answer thread rules', () => {
  it('takes follow-ups until six turns', () => {
    expect(SEARCH_THREAD_MAX_TURNS).toBe(6)
    expect(canFollowUp([])).toBe(true)
    expect(canFollowUp(thread(5))).toBe(true)
    expect(canFollowUp(thread(6))).toBe(false)
  })

  it('has something for the chat only once Cue wrote a turn', () => {
    expect(hasCueTurn([])).toBe(false)
    expect(hasCueTurn([turn(1, reply('Quick.', { mode: 'basic' }))])).toBe(false)
    expect(hasCueTurn([turn(1, { kind: 'fallback', href: '/search?q=x', reason: 'limited' })])).toBe(false)
    expect(hasCueTurn([turn(1, reply('Quick.', { mode: 'basic' })), turn(2)])).toBe(true)
    // Replies from before ticket 255 carry no mode: they were Cue's.
    expect(hasCueTurn([turn(1, reply('Old.', { mode: undefined }))])).toBe(true)
  })

  it('hands the chat only the turns it has not had', () => {
    const t = thread(4)
    expect(turnsForChat(t, 0)).toEqual(t)
    expect(turnsForChat(t, 3).map((x) => x.id)).toEqual(['t4'])
    expect(turnsForChat(t, 4)).toEqual([])
    expect(turnsForChat(t, 9)).toEqual([])
  })

  it('keeps finished Cue answers and any thread with a follow-up', () => {
    expect(shouldKeepThread([])).toBe(false)
    expect(shouldKeepThread([turn(1)])).toBe(true)
    expect(shouldKeepThread([turn(1, reply('Quick.', { mode: 'basic' }))])).toBe(false)
    expect(shouldKeepThread([turn(1, reply('Half', { stopped: true }))])).toBe(false)
    expect(shouldKeepThread([turn(1, reply('Quick.', { mode: 'basic' })), turn(2)])).toBe(true)
  })

  it('keys a search by its words and place', () => {
    expect(threadKey('soap', null)).toBe('|soap')
    expect(threadKey('soap', { lat: 33.7, lng: -84.4 })).toBe('33.7,-84.4|soap')
  })
})

describe('answer thread cache', () => {
  let store: MemoryStorage
  beforeEach(() => {
    store = new MemoryStorage()
    vi.stubGlobal('window', { sessionStorage: store })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('brings a thread back for the same search only', () => {
    keepThread('|soap', thread(3))
    expect(readThread('|soap')?.map((t) => t.id)).toEqual(['t1', 't2', 't3'])
    expect(readThread('|lotion')).toBeNull()
  })

  it('drops a thread that is not worth keeping', () => {
    keepThread('|soap', thread(1))
    keepThread('|soap', [turn(1, reply('Quick.', { mode: 'basic' }))])
    expect(readThread('|soap')).toBeNull()
  })

  it('keeps the ten newest searches', () => {
    for (let i = 0; i < 12; i++) keepThread(`|q${i}`, thread(1))
    expect(readThread('|q0')).toBeNull()
    expect(readThread('|q1')).toBeNull()
    expect(readThread('|q2')).not.toBeNull()
    expect(readThread('|q11')).not.toBeNull()
    expect(JSON.parse(store.getItem(THREAD_CACHE_KEY)!)).toHaveLength(10)
  })

  it('throws out tampered links and junk', () => {
    // The chat's own check: a turn with an off-site link is dropped whole.
    const bad = turn(2, reply('Go here.', { actions: [{ kind: 'link', label: 'Click', href: 'https://evil.example' }] }))
    store.setItem(
      THREAD_CACHE_KEY,
      JSON.stringify([
        { key: '|soap', turns: [turn(1), bad] },
        { key: '|evil', turns: [bad] },
        { key: 7, turns: [turn(1)] },
        'junk',
        null,
      ])
    )
    expect(readThread('|soap')?.map((t) => t.id)).toEqual(['t1'])
    expect(readThread('|evil')).toBeNull()
    expect(readThread('7')).toBeNull()
  })

  it('never throws when storage is broken', () => {
    store.setItem(THREAD_CACHE_KEY, '{not json')
    expect(readThread('|soap')).toBeNull()
    vi.stubGlobal('window', {
      get sessionStorage(): Storage {
        throw new Error('blocked')
      },
    })
    expect(() => keepThread('|soap', thread(2))).not.toThrow()
    expect(readThread('|soap')).toBeNull()
  })
})

// ─── The strip as drawn ───────────────────────────────────────────────────────

function view(props: {
  turns: AssistantTurn[]
  pending?: PendingTurn | null
  failed?: string | null
  unfolded?: Set<string>
}): string {
  const noop = () => {}
  return renderToStaticMarkup(
    createElement(AnswerThreadView, {
      turns: props.turns,
      pending: props.pending ?? null,
      failed: props.failed ?? null,
      unfolded: props.unfolded ?? new Set<string>(),
      draft: '',
      handlers: {},
      onDraft: noop,
      onSubmit: noop,
      onStop: noop,
      onRetry: noop,
      onContinue: noop,
      onFold: noop,
    })
  )
}

const count = (html: string, needle: string) => html.split(needle).length - 1

describe('AnswerThreadView', () => {
  it('streams the first ask with no bubble and no box yet', () => {
    const html = view({ turns: [], pending: { id: 'search', ask: 'soap', status: 'Looking…', text: '' } })
    expect(html).toContain('data-mode="streaming"')
    expect(html).not.toContain('You asked:')
    expect(html).not.toContain(FOLLOW_UP_LABEL)
    expect(html).not.toContain('Continue in Chat')
  })

  it('offers a follow-up and the chat after the first Cue answer', () => {
    const html = view({ turns: thread(1) })
    expect(html).toContain('data-mode="ai"')
    expect(html).toContain('data-turns="1"')
    expect(html).toContain(`placeholder="${FOLLOW_UP_LABEL}"`)
    expect(html).toContain('Continue in Chat')
    expect(html).toContain('Answer number 1.')
    // The first ask is the search itself: no bubble for it.
    expect(html).not.toContain('You asked:')
  })

  it('folds earlier answers and keeps the newest open', () => {
    const html = view({ turns: thread(3) })
    expect(count(html, 'You asked:')).toBe(2)
    expect(count(html, 'Show Answer')).toBe(2)
    expect(count(html, 'aria-expanded="false"')).toBe(2)
    expect(html).toContain('Answer number 3.')
    // Folded answers still show their opening words.
    expect(html).toContain('Answer number 1.')
    expect(html).not.toContain('id="search-answer-t1"')
    expect(html).toContain('id="search-answer-t3"')
  })

  it('opens an earlier answer the visitor unfolded', () => {
    const html = view({ turns: thread(3), unfolded: new Set(['t1']) })
    expect(html).toContain('id="search-answer-t1"')
    expect(html).toContain('Hide Answer')
    expect(html).toContain('aria-expanded="true"')
  })

  it('shows the follow-up being answered under the thread, with Stop', () => {
    const html = view({
      turns: thread(2),
      pending: { id: 'p', ask: 'Any open Sunday?', status: 'Looking…', text: '' },
    })
    expect(html).toContain('Any open Sunday?')
    expect(count(html, 'You asked:')).toBe(2)
    expect(html).toContain('Stop')
    // While Cue answers, the chat hand-off waits.
    expect(html).not.toContain('Continue in Chat')
    // Every finished answer folds while the new one streams.
    expect(count(html, 'Show Answer')).toBe(2)
  })

  it('gives way to Continue in Chat at six turns', () => {
    const html = view({ turns: thread(6) })
    expect(html).not.toContain(FOLLOW_UP_LABEL)
    expect(html).toContain(THREAD_FULL_LINE)
    expect(html).toContain('Continue in Chat')
  })

  it('labels a follow-up the quick answer gave', () => {
    const html = view({ turns: [turn(1), turn(2, reply('From our listings.', { mode: 'basic' }))] })
    expect(html).toContain('data-mode="ai"')
    expect(html).toContain('Quick Answer <span')
  })

  it('labels the strip by its first answer, and keeps the chat for Cue', () => {
    const html = view({ turns: [turn(1, reply('From our listings.', { mode: 'basic' }))] })
    expect(html).toContain('data-mode="basic"')
    expect(html).toContain('aria-label="Quick answer"')
    expect(html).toContain(FOLLOW_UP_LABEL)
    expect(html).not.toContain('Continue in Chat')
  })

  it('says when the first ask failed, with Try Again and the results', () => {
    const html = view({ turns: [], failed: "We couldn't load an answer just now." })
    expect(html).toContain('data-mode="failed"')
    expect(html).toContain('Try Again')
    expect(html).toContain('href="#search-results"')
    expect(html).not.toContain(FOLLOW_UP_LABEL)
  })
})
