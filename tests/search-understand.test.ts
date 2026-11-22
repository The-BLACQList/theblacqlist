// =============================================================================
// Query understanding for the /search grid (ticket 254)
// =============================================================================
// "How do I switch to Black Owned bathroom products" found nothing on
// production (founder, 2026-11-21): the RPC needs every word, and "switch",
// "black", "owned" and "products" can never all be on a listing. These pin the
// rules in lib/search/understand.ts and the rescue in queryListings.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

import { echoWords, understandQuery, INTENT_FAMILIES, withTechIt } from '@/lib/search/understand'

describe('understandQuery', () => {
  it("turns the founder's question into the bathroom words", () => {
    const u = understandQuery('How do I switch to Black Owned bathroom products')
    expect(u.mode).toBe('search')
    expect(u.words).toEqual(['bathroom'])
    expect(u.identityRemoved).toBe(true)
    expect(u.tsQuery).toBe('bathroom OR bath OR soap OR lotion OR toiletries')
  })

  it('browses when only an identity phrase is left', () => {
    for (const q of ['black owned', 'Black-Owned businesses near me', 'blackowned', 'owned by black people']) {
      expect(understandQuery(q).mode, q).toBe('browse')
    }
  })

  it('keeps a lone "black": it names things', () => {
    expect(understandQuery('where can I get black seed oil').words).toEqual(['black', 'seed', 'oil'])
    expect(understandQuery('Black Tie Catering').mode).toBe('none')
  })

  it('leaves search syntax alone, including the OR queries Cue sends', () => {
    expect(understandQuery('"shea butter"').mode).toBe('none')
    expect(understandQuery('soap OR lotion').mode).toBe('none')
    expect(understandQuery('bakery -cake').mode).toBe('none')
  })

  it('does nothing when there is nothing to take out', () => {
    expect(understandQuery('tailor').mode).toBe('none')
    expect(understandQuery('').mode).toBe('none')
    expect(understandQuery(undefined).mode).toBe('none')
  })

  it('does nothing for an all-filler name like "The Shop"', () => {
    expect(understandQuery('The Shop').mode).toBe('none')
  })

  it('drops question words and keeps what carries the search', () => {
    const u = understandQuery('where can I find a good tailor near me?')
    expect(u.mode).toBe('search')
    expect(u.tsQuery).toBe('tailor')
  })

  it('adds word families (ticket 172) to what is left', () => {
    expect(understandQuery('I need to switch to a black owned dentist').tsQuery).toBe(
      'dentist OR dental OR dentistry'
    )
  })

  it('every remaining word still has to match', () => {
    const u = understandQuery('looking to buy black owned candles atlanta')
    expect(u.tsQuery).toBe('candles atlanta')
  })

  it('drops generic objects only when something else is left', () => {
    expect(understandQuery('black owned hair products').words).toEqual(['hair'])
    expect(understandQuery('switch products').words).toEqual(['products'])
  })

  it('never adds bath words to an auto body search', () => {
    const u = understandQuery('where is a good auto body shop')
    expect(u.tsQuery).toBe('auto body')
    expect(u.tsQuery).not.toMatch(/soap|bath|lotion/)
  })

  it('"support" is dropped as a verb but kept as a noun', () => {
    expect(understandQuery('support black owned bakeries').words).toEqual(['bakeries'])
    expect(understandQuery('I want to support black owned bakeries').words).toEqual(['bakeries'])
    expect(understandQuery('computer support for my black owned business').words).toEqual([
      'computer',
      'support',
    ])
  })

  it('keeps place words, including "new" in New Orleans', () => {
    expect(understandQuery('black owned coffee in new orleans').words).toEqual([
      'coffee',
      'new',
      'orleans',
    ])
  })

  it('folds plurals onto an intent family', () => {
    expect(understandQuery('black owned toiletries').tsQuery).toContain('soap')
    expect(understandQuery('where to buy groceries').tsQuery).toContain('market')
  })

  it('stays under the combination cap by dropping families, never the words', () => {
    const u = understandQuery('black owned clothes makeup coffee jewelry')
    expect(u.mode).toBe('search')
    expect(u.tsQuery!.split(' OR ').length).toBeLessThanOrEqual(12)
    expect(u.tsQuery!.split(' OR ')[0]).toBe('clothes makeup coffee jewelry')
  })

  it('intent families are short, lowercase, and never add "body" or "hair" alone', () => {
    for (const [key, words] of Object.entries(INTENT_FAMILIES)) {
      expect(key).toMatch(/^[a-z]+$/)
      expect(words.length).toBeLessThanOrEqual(4)
      expect(words).not.toContain('body')
      expect(words).not.toContain('hair')
    }
  })
})

describe('withTechIt (ticket 257)', () => {
  // Postgres drops "it", so "IT support" searched "support" alone.
  it('reads "it" before a trade word as the trade', () => {
    expect(withTechIt('IT support')).toBe('technology support')
    expect(withTechIt('it services for my office')).toBe('technology services for my office')
    expect(withTechIt('I need an IT guy')).toBe('I need an technology guy')
    expect(withTechIt('Byte Fix IT Support')).toBe('Byte Fix technology Support')
  })

  it('reads a capital "IT" that ends the search as the trade', () => {
    expect(withTechIt('help with IT')).toBe('help with technology')
  })

  it('leaves the pronoun alone', () => {
    for (const q of [
      'where can I get it',
      'can it support two cars',
      'make it work',
      'IT Works Salon',
      'IT WORKS',
      'HELP WITH IT',
      'it is a soap shop',
      "it's a bakery",
    ]) {
      expect(withTechIt(q), q).toBe(q)
    }
  })

  it('carries through to the words a search keeps', () => {
    expect(understandQuery('IT support').words).toEqual(['technology', 'support'])
    expect(understandQuery('who does IT support for small offices').words).toContain('technology')
  })
})

describe('echoWords (ticket 257)', () => {
  it('echoes a name as typed, without the question it opened with', () => {
    expect(echoWords('The Shop ATL')).toBe('the shop atl')
    expect(echoWords('where can I find The Shop ATL')).toBe('the shop atl')
  })

  it('never echoes an identity phrase', () => {
    expect(echoWords('black owned barbers in atlanta')).toBe('barbers in atlanta')
    expect(echoWords('Black-Owned soap')).toBe('soap')
  })

  it('falls back to the words that carry the search', () => {
    expect(echoWords('where can I get')).toBe('')
    expect(echoWords('can I get a haircut')).toBe('haircut')
  })

  it('takes the follow-up opening off too (ticket 258)', () => {
    expect(echoWords('What about lotion?')).toBe('lotion')
    expect(echoWords('how about shea butter')).toBe('shea butter')
    expect(echoWords('and lotion?')).toBe('lotion')
    expect(echoWords('do you have body wash')).toBe('body wash')
    expect(echoWords('what else is there')).toBe('')
    // A name that starts with "about" keeps it.
    expect(echoWords('About Face Salon')).toBe('about face salon')
  })
})

describe('intent families after the live eval (ticket 257)', () => {
  it('a mechanic never searches a lone "auto" (auto insurance)', () => {
    const alts = understandQuery('a good mechanic').tsQuery!.split(' OR ')
    expect(alts).not.toContain('auto')
    expect(alts).toContain('auto repair')
    expect(understandQuery('car help').tsQuery!.split(' OR ')).not.toContain('auto')
  })
})

// ─── The rescue in queryListings ──────────────────────────────────────────────

const h = vi.hoisted(() => {
  const state: {
    rpc: Array<(args: Record<string, unknown>) => { data: unknown; error: unknown }>
  } = { rpc: [] }
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
  return { state, rpcCalls }
})

function fakeClient() {
  function builder() {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'in', 'or', 'lte', 'gt', 'order', 'limit', 'range', 'textSearch']) {
      b[m] = () => b
    }
    b.maybeSingle = () => Promise.resolve({ data: null, error: null })
    b.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null, count: 0 }).then(ok, bad)
    return b
  }
  return {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => builder(),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      h.rpcCalls.push({ fn, args })
      const next = h.state.rpc.shift()
      return next ? next(args) : { data: [], error: null }
    },
  }
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fakeClient() }))

const { queryListings } = await import('@/lib/listings/query')

const searches = () => h.rpcCalls.filter((c) => c.fn === 'search_listings_faceted')
const empty = () => ({ data: [], error: null })
const found = () => ({ data: [{ id: 'l1', total_count: 1 }], error: null })

beforeEach(() => {
  h.state.rpc = []
  h.rpcCalls.length = 0
})

describe('queryListings rescue', () => {
  it('runs the understood form when the search as typed finds nothing', async () => {
    h.state.rpc = [empty, found]
    const result = await queryListings({
      q: 'How do I switch to Black Owned bathroom products',
    })
    expect(searches().map((c) => c.args.p_q)).toEqual([
      'How do I switch to Black Owned bathroom products',
      'bathroom OR bath OR soap OR lotion OR toiletries',
    ])
    expect(result.total).toBe(1)
    expect(result.understood).toEqual({ mode: 'search', words: ['bathroom'] })
  })

  it('never runs a second search when the first found something', async () => {
    h.state.rpc = [found]
    const result = await queryListings({ q: 'The Shop ATL' })
    expect(searches()).toHaveLength(1)
    expect(result.understood).toBeUndefined()
  })

  it('browses with no keyword for "black owned businesses"', async () => {
    h.state.rpc = [empty, found]
    const result = await queryListings({ q: 'black owned businesses' })
    expect(searches()[1]!.args.p_q).toBeNull()
    expect(result.understood).toEqual({ mode: 'browse', words: [] })
  })

  it('reports the original zero when the rescue finds nothing too', async () => {
    h.state.rpc = [empty, empty]
    const result = await queryListings({ q: 'how do I switch my bathroom products' })
    expect(searches()).toHaveLength(2)
    expect(result.total).toBe(0)
    expect(result.understood).toBeUndefined()
  })

  it('searches "IT support" as technology support, not support alone', async () => {
    h.state.rpc = [found]
    await queryListings({ q: 'IT support' })
    expect(searches()[0]!.args.p_q).toBe('technology support')
  })

  it('never rescues an outage', async () => {
    h.state.rpc = [() => ({ data: null, error: { code: 'XX000', message: 'boom' } })]
    await queryListings({ q: 'how do I switch my bathroom products' })
    expect(searches()).toHaveLength(1)
  })
})
