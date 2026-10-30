import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssistantCard, AssistantResponse } from '@/lib/ai/assistant-limits'
import {
  ASSISTANT_MAX_TURNS,
  ASSISTANT_STORAGE_KEY,
  addTurn,
  cleanTurns,
  clearChat,
  getAssistantState,
  historyFor,
  resetAssistantStoreForTests,
  setAssistantOpen,
} from '@/lib/assistant/store'
import { isAssistantHiddenPath } from '@/lib/assistant/routes'
import { wantsNearMe } from '@/lib/assistant/near'
import { listText, replyStatus } from '@/components/assistant/AssistantAnswer'

// Ticket 147: the chat kept in this tab, the pages it shows on, and the small
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

function answer(over: Partial<Extract<AssistantResponse, { kind: 'answer' }>> = {}): AssistantResponse {
  return {
    kind: 'answer',
    heading: 'Your list in Detroit',
    opener: null,
    notice: null,
    summary: '2 needs, 1 not listed.',
    needs: [
      { name: 'Catering', status: 'found', line: '4 places in Detroit', total: 4, top: [card()], seeAllHref: '/discover?category=catering', plan: { category: 'catering', keywords: [], openNow: false } },
      { name: 'Balloon decor', status: 'none', line: "We don't have this on The BLACQList yet.", total: 0, top: [], seeAllHref: null, plan: { category: null, keywords: [], openNow: false } },
    ],
    nameMatches: [],
    page: null,
    searchHref: '/search?q=party',
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
      reply: answer({ nameMatches: [card({ imageSrc: 'http://example.com/a.jpg' })] }),
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

  it('sends only the last 3 asks as history', () => {
    for (const ask of ['a', 'b', 'c', 'd']) addTurn(ask, answer())
    expect(historyFor(getAssistantState().turns)).toEqual(['b', 'c', 'd'])
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

describe('listText and replyStatus', () => {
  it('copies each need with its top pick, and marks what is not listed', () => {
    const reply = answer()
    if (reply.kind !== 'answer') throw new Error('expected an answer')
    expect(listText(reply.needs)).toBe(
      ['Your list', '- Catering: Motor City Catering (Detroit, MI)', '- Balloon decor: not listed'].join('\n')
    )
  })

  it('marks a nearest-city pick', () => {
    const needs = [
      { name: 'Thai food', status: 'nearest' as const, line: '', total: 2, top: [card({ name: 'Bangkok House', cityLabel: 'Seattle, WA' })], seeAllHref: null, plan: { category: 'restaurants', keywords: ['thai'], openNow: false } },
    ]
    expect(listText(needs)).toBe('Your list\n- Thai food: Bangkok House (Seattle, WA) [nearest city]')
  })

  it('reads the notice before the summary, and fixed lines for fallbacks', () => {
    expect(replyStatus(answer({ notice: "We don't list businesses in Alaska yet." }))).toBe(
      "We don't list businesses in Alaska yet. 2 needs, 1 not listed."
    )
    expect(replyStatus({ kind: 'fallback', href: '/search?q=x', reason: 'limited' })).toMatch(/asked me a lot/)
    expect(replyStatus({ kind: 'fallback', href: '/search?q=x', reason: 'error' })).toMatch(/plain search/)
  })
})
