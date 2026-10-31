import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssistantCard, CueReply } from '@/lib/ai/assistant-limits'
import {
  ASSISTANT_MAX_TURNS,
  ASSISTANT_STORAGE_KEY,
  addTurn,
  cardsFor,
  cleanTurns,
  clearChat,
  getAssistantState,
  historyFor,
  lastWasNear,
  resetAssistantStoreForTests,
  setAssistantOpen,
} from '@/lib/assistant/store'
import { isAssistantHiddenPath } from '@/lib/assistant/routes'
import { wantsNearMe } from '@/lib/assistant/near'
import { replyStatus } from '@/components/assistant/AssistantAnswer'

// Tickets 147 and 169: the chat kept in this tab, the pages it shows on, and the small
// helpers the panel uses. Vitest runs in node, so sessionStorage is a stub.

function card(over: Partial<AssistantCard> = {}): AssistantCard {
  return {
    id: 'c1',
    name: 'Motor City Catering',
    href: '/detroit/business/motor-city-catering',
    categoryName: 'Catering',
    cityLabel: 'Detroit, MI',
    rating: 4.8,
    reviewCount: 12,
    imageSrc: 'https://example.supabase.co/storage/v1/object/public/a.jpg',
    ...over,
  }
}

function answer(over: Partial<Extract<CueReply, { kind: 'reply' }>> = {}): CueReply {
  return {
    kind: 'reply',
    text: 'Here are **2 caterers** in Detroit.',
    cards: [card(), card({ id: 'c2', name: 'Eastside Eats' })],
    actions: [],
    near: false,
    ...over,
  }
}

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

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('window', { sessionStorage: storage })
  resetAssistantStoreForTests()
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetAssistantStoreForTests()
})

describe('cleanTurns', () => {
  it('keeps good turns and drops ones with outside links or plain-http images', () => {
    const good = { id: '1', ask: 'party', reply: answer() }
    const outsideLink = { id: '2', ask: 'x', reply: { kind: 'fallback', href: 'https://evil.example', reason: 'error' } }
    const protocolRelative = { id: '3', ask: 'x', reply: { kind: 'fallback', href: '//evil.example', reason: 'error' } }
    const httpImage = {
      id: '4',
      ask: 'x',
      reply: answer({ cards: [card({ imageSrc: 'http://example.com/a.jpg' })] }),
    }
    expect(cleanTurns([good, outsideLink, protocolRelative, httpImage, 'junk']).map((t) => t.id)).toEqual(['1'])
  })

  it('returns nothing for something that is not a list', () => {
    expect(cleanTurns({ turns: [] })).toEqual([])
    expect(cleanTurns(null)).toEqual([])
  })

  it('keeps the newest 20', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: String(i), ask: `a${i}`, reply: answer() }))
    const kept = cleanTurns(many)
    expect(kept).toHaveLength(ASSISTANT_MAX_TURNS)
    expect(kept[0]?.id).toBe('5')
  })
})

describe('the chat store', () => {
  it('saves turns to this tab and reads them back after a reload', () => {
    addTurn('party in Detroit', answer())
    expect(storage.getItem(ASSISTANT_STORAGE_KEY)).not.toBeNull()

    resetAssistantStoreForTests()
    const { turns } = getAssistantState()
    expect(turns).toHaveLength(1)
    expect(turns[0]?.ask).toBe('party in Detroit')
  })

  it('Clear chat removes the saved copy', () => {
    addTurn('party', answer())
    clearChat()
    expect(getAssistantState().turns).toEqual([])
    expect(storage.getItem(ASSISTANT_STORAGE_KEY)).toBeNull()
  })

  it('keeps at most 20 turns', () => {
    for (let i = 0; i < 23; i += 1) addTurn(`ask ${i}`, answer())
    const { turns } = getAssistantState()
    expect(turns).toHaveLength(ASSISTANT_MAX_TURNS)
    expect(turns[0]?.ask).toBe('ask 3')
  })

  it('still works in memory when storage throws', () => {
    vi.stubGlobal('window', {
      get sessionStorage(): Storage {
        throw new Error('blocked')
      },
    })
    resetAssistantStoreForTests()
    addTurn('barber near me', answer())
    expect(getAssistantState().turns).toHaveLength(1)
  })

  it('does not save whether the panel is open', () => {
    setAssistantOpen(true)
    expect(getAssistantState().open).toBe(true)
    expect(storage.getItem(ASSISTANT_STORAGE_KEY)).toBeNull()
    resetAssistantStoreForTests()
    expect(getAssistantState().open).toBe(false)
  })

  it('ignores a saved copy that fails the shape check', () => {
    storage.setItem(ASSISTANT_STORAGE_KEY, '{not json')
    expect(getAssistantState().turns).toEqual([])
  })

  it('ignores a saved copy from the old chat shape', () => {
    const old = { kind: 'answer', heading: 'Your list', needs: [], nameMatches: [], actions: [], near: false }
    expect(cleanTurns([{ id: '1', ask: 'party', reply: old }])).toEqual([])
  })
})

describe('what a follow-up sends', () => {
  it('sends the last 6 turns as user and assistant text', () => {
    for (const ask of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) addTurn(ask, answer({ text: `reply ${ask}` }))
    const history = historyFor(getAssistantState().turns)
    expect(history).toHaveLength(12)
    expect(history[0]).toEqual({ role: 'user', text: 'b' })
    expect(history.at(-1)).toEqual({ role: 'assistant', text: 'reply g' })
  })

  it('skips fallbacks and empty replies', () => {
    addTurn('a', { kind: 'fallback', href: '/search?q=a', reason: 'error' })
    addTurn('b', answer({ text: '   ' }))
    addTurn('c', answer({ text: 'ok' }))
    expect(historyFor(getAssistantState().turns)).toEqual([
      { role: 'user', text: 'c' },
      { role: 'assistant', text: 'ok' },
    ])
  })

  it('sends the cards from the last reply by id and name only', () => {
    addTurn('caterers', answer())
    expect(cardsFor(getAssistantState().turns)).toEqual([
      { id: 'c1', name: 'Motor City Catering' },
      { id: 'c2', name: 'Eastside Eats' },
    ])
  })

  it('sends no cards or location after a fallback', () => {
    addTurn('near me', answer({ near: true }))
    expect(lastWasNear(getAssistantState().turns)).toBe(true)
    addTurn('more', { kind: 'fallback', href: '/search?q=more', reason: 'limited' })
    expect(cardsFor(getAssistantState().turns)).toEqual([])
    expect(lastWasNear(getAssistantState().turns)).toBe(false)
  })
})

describe('isAssistantHiddenPath', () => {
  it.each([
    '/dashboard',
    '/dashboard/billing',
    '/admin',
    '/sign-in',
    '/account',
    '/add-business',
    '/add-event/new',
    '/claim/abc',
    '/join',
    '/t/abc123',
    '/coming-soon',
  ])('hides on %s', (path) => {
    expect(isAssistantHiddenPath(path)).toBe(true)
  })

  it.each(['/', '/map', '/detroit/business/motor-city-catering', '/joinery', '/discover', '/terms'])(
    'shows on %s',
    (path) => {
      expect(isAssistantHiddenPath(path)).toBe(false)
    }
  )
})

describe('wantsNearMe', () => {
  it.each(['Barber near me', 'coffee nearby', 'closest bakery', 'tacos around me'])('asks for location on "%s"', (t) => {
    expect(wantsNearMe(t)).toBe(true)
  })

  it.each(['Barber in Atlanta', 'Nearmeville diner', 'close friends cafe'])('does not on "%s"', (t) => {
    expect(wantsNearMe(t)).toBe(false)
  })
})

describe('replyStatus', () => {
  it('reads the reply as plain text with the card count', () => {
    expect(replyStatus(answer())).toBe('Here are 2 caterers in Detroit. Showing 2 businesses.')
    expect(replyStatus(answer({ cards: [card()] }))).toMatch(/Showing 1 business\.$/)
    expect(replyStatus(answer({ cards: [] }))).toBe('Here are 2 caterers in Detroit.')
  })

  it('says when the visitor stopped it', () => {
    expect(replyStatus(answer({ text: 'Here are', cards: [], stopped: true }))).toBe('Here are Stopped.')
  })

  it('reads fixed lines for fallbacks', () => {
    expect(replyStatus({ kind: 'fallback', href: '/search?q=x', reason: 'limited' })).toMatch(/asked me a lot/)
    expect(replyStatus({ kind: 'fallback', href: '/search?q=x', reason: 'error' })).toMatch(/plain search/)
  })
})
