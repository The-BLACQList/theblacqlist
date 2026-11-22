// =============================================================================
// Meaning search in Cue and the quick answer (ticket 260)
// =============================================================================
// Pins the rule in lib/search/hybrid.ts and where it is used:
//   * strict matches first, never reordered; related ones only below three
//   * related ones at least 0.45 close, best first, at most five, no repeats
//   * Cue's search tool and the quick answer only: never the grid, facets or
//     /discover
//   * off with the flag off or no key; every failure is "no related ones"
// =============================================================================

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const h = vi.hoisted(() => ({
  flags: {} as Record<string, boolean>,
  rpc: vi.fn(),
}))

vi.mock('@/lib/env', async (orig) => ({
  ...(await orig<typeof import('@/lib/env')>()),
  isFeatureEnabled: (flag: string) => h.flags[flag] ?? false,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ rpc: h.rpc }),
  createClient: async () => ({}),
}))

import { AssistantReply, RELATED_HEADING } from '@/components/assistant/AssistantAnswer'
import type { AssistantCategory } from '@/lib/ai/assistant'
import type { CueReply } from '@/lib/ai/assistant-limits'
import { runCueTool, toCard, turnOutput } from '@/lib/ai/cue/tools'
import { cleanTurns } from '@/lib/assistant/store'
import type { ListingsParams } from '@/lib/listings/query'
import { buildBasicAnswer, composeBasicAnswer } from '@/lib/search/basicAnswer'
import {
  findRelatedIds,
  pickRelated,
  RELATED_BELOW,
  RELATED_MAX,
  RELATED_MIN_SIMILARITY,
  wantsRelated,
  type RelatedDeps,
} from '@/lib/search/hybrid'
import { understandQuery } from '@/lib/search/understand'
import { clearVoyageQueryCache } from '@/lib/search/voyage'
import {
  findRelatedListings,
  meaningSearchOn,
  voyageRelatedDeps,
  withinReach,
} from '@/lib/services/relatedListings'

import { ctx, deps, entity, ID } from './fixtures/cue'

const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')

const hit = (n: number, similarity: number) => ({ listingId: ID(n), similarity })
const VECTOR = Array.from({ length: 1024 }, () => 0.01)

function fakeDeps(hits: ReturnType<typeof hit>[], over: Partial<RelatedDeps> = {}): RelatedDeps {
  return {
    embed: vi.fn(async () => VECTOR),
    nearest: vi.fn(async () => hits),
    ...over,
  }
}

beforeEach(() => {
  h.flags = {}
  h.rpc.mockReset()
  delete process.env.VOYAGE_API_KEY
  clearVoyageQueryCache()
})

// ─── The rule ─────────────────────────────────────────────────────────────────

describe('pickRelated', () => {
  it('keeps the closest first and drops anything under the bar', () => {
    const ids = pickRelated([hit(1, 0.5), hit(2, 0.9), hit(3, 0.44), hit(4, 0.7)])
    expect(ids).toEqual([ID(2), ID(4), ID(1)])
  })

  it('skips ids already in the answer and repeats', () => {
    const ids = pickRelated([hit(1, 0.9), hit(2, 0.8), hit(2, 0.8), hit(3, 0.7)], [ID(1)])
    expect(ids).toEqual([ID(2), ID(3)])
  })

  it('stops at five', () => {
    const many = Array.from({ length: 9 }, (_, i) => hit(i + 1, 0.9 - i * 0.01))
    expect(pickRelated(many)).toHaveLength(RELATED_MAX)
    expect(RELATED_MAX).toBe(5)
  })

  it('ignores a similarity that is not a number', () => {
    expect(pickRelated([hit(1, Number.NaN), hit(2, 0.6)])).toEqual([ID(2)])
  })

  it('starts at the planned bar and threshold', () => {
    expect(RELATED_MIN_SIMILARITY).toBe(0.45)
    expect(RELATED_BELOW).toBe(3)
    expect(wantsRelated(0)).toBe(true)
    expect(wantsRelated(2)).toBe(true)
    expect(wantsRelated(3)).toBe(false)
  })
})

describe('findRelatedIds', () => {
  it('embeds the words and asks for the nearest, with the city', async () => {
    const d = fakeDeps([hit(1, 0.8)])
    const ids = await findRelatedIds({ text: ' bathroom ', cityId: 'atl', exclude: [] }, d)
    expect(ids).toEqual([ID(1)])
    expect(d.embed).toHaveBeenCalledWith('bathroom')
    expect(d.nearest).toHaveBeenCalledWith(
      expect.objectContaining({ embedding: VECTOR, minSimilarity: 0.25, cityId: 'atl' })
    )
  })

  it('is empty with no words, no numbers, or a failing read', async () => {
    expect(await findRelatedIds({ text: '  ' }, fakeDeps([hit(1, 0.9)]))).toEqual([])
    expect(
      await findRelatedIds({ text: 'soap' }, fakeDeps([hit(1, 0.9)], { embed: async () => null }))
    ).toEqual([])
    const broken = fakeDeps([], {
      nearest: async () => {
        throw new Error('down')
      },
    })
    expect(await findRelatedIds({ text: 'soap' }, broken)).toEqual([])
  })
})

// ─── The server half ──────────────────────────────────────────────────────────

describe('findRelatedListings', () => {
  const on = () => {
    h.flags.semanticSearch = true
    process.env.VOYAGE_API_KEY = 'test-key'
  }

  it('is off with the flag off, or with no key', async () => {
    const load = vi.fn(async () => [entity(1)])
    expect(meaningSearchOn()).toBe(false)
    expect(await findRelatedListings({ text: 'soap' }, load, fakeDeps([hit(1, 0.9)]))).toEqual([])
    h.flags.semanticSearch = true
    expect(meaningSearchOn()).toBe(false)
    expect(await findRelatedListings({ text: 'soap' }, load, fakeDeps([hit(1, 0.9)]))).toEqual([])
    expect(load).not.toHaveBeenCalled()
  })

  it('loads the public rows in the order found', async () => {
    on()
    const load = vi.fn(async (ids: readonly string[]) =>
      ids.map((id) => entity(Number(id.slice(-3))))
    )
    const found = await findRelatedListings(
      { text: 'soap' },
      load,
      fakeDeps([hit(2, 0.6), hit(1, 0.9)])
    )
    expect(found.map((e) => e.id)).toEqual([ID(1), ID(2)])
  })

  it('near me keeps businesses within the radius, and online ones', async () => {
    on()
    const near = { lat: 33.749, lng: -84.388 }
    const close = entity(1, { lat: 33.76, lng: -84.39 })
    const far = entity(2, { lat: 29.76, lng: -95.37 })
    const online = entity(3, { location_type: 'virtual' } as never)
    const pinless = entity(4)
    expect(withinReach(close, near)).toBe(true)
    expect(withinReach(far, near)).toBe(false)
    expect(withinReach(online, near)).toBe(true)
    expect(withinReach(pinless, near)).toBe(false)
    const load = vi.fn(async () => [close, far, online, pinless])
    const found = await findRelatedListings(
      { text: 'soap', near },
      load,
      fakeDeps([hit(1, 0.9), hit(2, 0.8), hit(3, 0.7), hit(4, 0.6)])
    )
    expect(found.map((e) => e.id)).toEqual([ID(1), ID(3)])
  })

  it('a failing load is no related businesses', async () => {
    on()
    const load = vi.fn(async () => {
      throw new Error('CUE_LOAD_FAILED')
    })
    expect(await findRelatedListings({ text: 'soap' }, load, fakeDeps([hit(1, 0.9)]))).toEqual([])
  })

  it('calls the service-role search with the model and the bar', async () => {
    h.rpc.mockResolvedValue({ data: [{ listing_id: ID(1), similarity: '0.71' }], error: null })
    const rows = await voyageRelatedDeps.nearest({
      embedding: [0.1, 0.2],
      limit: 10,
      minSimilarity: 0.45,
      cityId: null,
    })
    expect(rows).toEqual([{ listingId: ID(1), similarity: 0.71 }])
    expect(h.rpc).toHaveBeenCalledWith('search_listings_semantic', {
      p_embedding: '[0.1,0.2]',
      p_model: 'voyage-4-lite',
      p_limit: 10,
      p_min_similarity: 0.45,
      p_city_id: null,
    })
  })

  it('a database error throws inside, and comes out as nothing', async () => {
    on()
    h.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(
      voyageRelatedDeps.nearest({ embedding: [0.1], limit: 10, minSimilarity: 0.45, cityId: null })
    ).rejects.toThrow('RELATED_SEARCH_FAILED')
    const embedOnly: RelatedDeps = { embed: async () => VECTOR, nearest: voyageRelatedDeps.nearest }
    expect(await findRelatedListings({ text: 'soap' }, vi.fn(), embedOnly)).toEqual([])
  })
})

// ─── Cue's search tool ────────────────────────────────────────────────────────

describe('Cue search_listings with related businesses', () => {
  const soap = entity(11, {
    name: 'Shea Soap Co',
    category: { name: 'Bath & Body', slug: 'bath-body' },
  })

  it('adds related businesses when fewer than three match the words', async () => {
    const related = vi.fn(async () => [soap])
    const c = ctx({ deps: deps({ search: vi.fn(async () => [entity(1)]), related }) })
    const result = await runCueTool(
      'search_listings',
      { words: ['bathroom products'], city: 'atlanta' },
      c
    )
    const body = JSON.parse(result.content)
    expect(body.results.map((r: { id: string }) => r.id)).toEqual([ID(1)])
    expect(body.related.results.map((r: { id: string }) => r.id)).toEqual([ID(11)])
    expect(body.related.note).toMatch(/never as exact matches/)
    expect(related).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'bathroom products',
        cityId: 'atl',
        exclude: [ID(1)],
        near: null,
      })
    )
    // Found by meaning is not found by the words: Suggest a Business still counts.
    expect(c.state.found).toBe(1)
    expect(c.state.related.has(ID(11))).toBe(true)
    expect(c.state.seen.has(ID(11))).toBe(true)
  })

  it('three or more by the words: no meaning search', async () => {
    const related = vi.fn(async () => [soap])
    const c = ctx({
      deps: deps({ search: vi.fn(async () => [entity(1), entity(2), entity(3)]), related }),
    })
    const body = JSON.parse((await runCueTool('search_listings', { words: ['lawyer'] }, c)).content)
    expect(related).not.toHaveBeenCalled()
    expect(body.related).toBeUndefined()
  })

  it('open now: no meaning search, which cannot check hours', async () => {
    const related = vi.fn(async () => [soap])
    const c = ctx({ deps: deps({ related }) })
    await runCueTool('search_listings', { words: ['soap'], open_now: true }, c)
    expect(related).not.toHaveBeenCalled()
  })

  it('near me passes the point', async () => {
    const related = vi.fn(async () => [])
    const near = { lat: 33.7, lng: -84.4 }
    await runCueTool(
      'search_listings',
      { words: ['soap'], near_me: true },
      ctx({ near, deps: deps({ related }) })
    )
    expect(related).toHaveBeenCalledWith(expect.objectContaining({ near }))
  })

  it('a failing meaning search leaves the words search as it was', async () => {
    const related = vi.fn(async () => {
      throw new Error('down')
    })
    const c = ctx({ deps: deps({ search: vi.fn(async () => [entity(1)]), related }) })
    const result = await runCueTool('search_listings', { words: ['soap'] }, c)
    expect(result.isError).toBe(false)
    expect(JSON.parse(result.content).related).toBeUndefined()
  })

  it('without the dependency, nothing changes', async () => {
    const c = ctx({ deps: deps({ search: vi.fn(async () => [entity(1)]) }) })
    const body = JSON.parse((await runCueTool('search_listings', { words: ['soap'] }, c)).content)
    expect(body.related).toBeUndefined()
  })

  it('cards found by meaning are marked related; one later matched by the words is not', async () => {
    const other = entity(12)
    const related = vi.fn(async () => [soap, other])
    const search = vi
      .fn()
      .mockResolvedValueOnce([entity(1)])
      .mockResolvedValueOnce([other])
      .mockResolvedValue([])
    const c = ctx({ deps: deps({ search, related }) })
    await runCueTool('search_listings', { words: ['bathroom'] }, c)
    await runCueTool('search_listings', { words: ['lotion'] }, c)
    await runCueTool('show_businesses', { ids: [ID(1), ID(11), ID(12)] }, c)
    const { cards } = turnOutput(c)
    expect(cards.map((card) => [card.id, !!card.related])).toEqual([
      [ID(1), false],
      [ID(11), true],
      [ID(12), false],
    ])
  })
})

// ─── The quick answer ─────────────────────────────────────────────────────────

const CATEGORIES: AssistantCategory[] = [
  { id: 'c-retail', slug: 'retail-gifts', name: 'Retail & Gifts', parentId: null },
  { id: 'c-bath', slug: 'bath-body', name: 'Bath & Body', parentId: 'c-retail' },
]
const FOUNDER = 'How do I switch to Black Owned bathroom products'
const card = (n: number) => toCard(entity(n))

function fakeSearch(q: number[], category: number[] = []) {
  return vi.fn(async (p: ListingsParams) => ({
    entities: (p.category ? category : p.q ? q : []).map((n) => entity(n)),
  }))
}

describe('quick answer: Related Businesses row', () => {
  it('asks meaning search with the understood words, not the whole question', async () => {
    const related = vi.fn(async () => [card(11)])
    const answer = await buildBasicAnswer(FOUNDER, null, {
      search: fakeSearch([1]),
      categories: CATEGORIES,
      related,
    })
    expect(related).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'bathroom', exclude: [ID(1)], near: null })
    )
    expect(answer.cards.map((c) => [c.id, !!c.related])).toEqual([
      [ID(1), false],
      [ID(11), true],
    ])
    expect(answer.related).toBe(1)
    expect(answer.text).toMatch(
      /^Here’s the business that matches “.+”\. Related businesses follow\.$/
    )
  })

  it('nothing by the words: says so and shows the related ones', async () => {
    const related = vi.fn(async () => [card(11), card(12)])
    const answer = await buildBasicAnswer(FOUNDER, null, {
      search: fakeSearch([]),
      categories: CATEGORIES,
      related,
    })
    expect(answer.text).toBe(
      'Nothing matches “bathroom” word for word yet. Here are related businesses.'
    )
    expect(answer.cards.every((c) => c.related)).toBe(true)
    expect(answer.exactBucket).toBe('0')
  })

  it('three or more by the words: no meaning search', async () => {
    const related = vi.fn(async () => [card(11)])
    const answer = await buildBasicAnswer(FOUNDER, null, {
      search: fakeSearch([1, 2, 3]),
      categories: CATEGORIES,
      related,
    })
    expect(related).not.toHaveBeenCalled()
    expect(answer.related).toBe(0)
  })

  it('browse ("black owned") sends nothing to meaning search', async () => {
    const related = vi.fn(async () => [card(11)])
    await buildBasicAnswer('black owned', null, {
      search: fakeSearch([]),
      categories: CATEGORIES,
      related,
    })
    expect(related).not.toHaveBeenCalled()
  })

  it('a failing meaning search still answers', async () => {
    const related = vi.fn(async () => {
      throw new Error('down')
    })
    const answer = await buildBasicAnswer(FOUNDER, null, {
      search: fakeSearch([1]),
      categories: CATEGORIES,
      related,
    })
    expect(answer.cards.map((c) => c.id)).toEqual([ID(1)])
    expect(answer.related).toBe(0)
  })

  it('strict first, related next, close matches fill what is left of six', () => {
    const answer = composeBasicAnswer({
      query: 'soap',
      understood: understandQuery('soap'),
      exact: [card(1)],
      close: [card(21), card(22), card(23), card(11)],
      related: [card(1), card(11), card(12), card(13)],
      category: { name: 'Bath & Body', slug: 'bath-body' },
      near: false,
    })
    // ID(1) is a strict match, never repeated as related; ID(11) is related, never repeated as close.
    expect(answer.cards.map((c) => c.id)).toEqual([ID(1), ID(21), ID(22), ID(11), ID(12), ID(13)])
    expect(answer.cards.filter((c) => c.related).map((c) => c.id)).toEqual([ID(11), ID(12), ID(13)])
  })
})

// ─── The card and the row ─────────────────────────────────────────────────────

describe('related cards on screen', () => {
  const reply: CueReply = {
    kind: 'reply',
    text: 'Here is one.',
    cards: [card(1), { ...card(11), related: true }],
    actions: [],
    near: false,
  }

  it('shows them under a Related Businesses heading, after the matches', () => {
    const html = renderToStaticMarkup(
      createElement(AssistantReply, { ask: 'soap', reply, layout: 'page' })
    )
    expect(RELATED_HEADING).toBe('Related Businesses')
    expect(html).toContain('Related Businesses')
    expect(html.indexOf('Business 1<')).toBeLessThan(html.indexOf('Related Businesses'))
    expect(html.indexOf('Related Businesses')).toBeLessThan(html.indexOf('Business 11<'))
  })

  it('no related cards: no heading', () => {
    const plain: CueReply = { ...reply, cards: [card(1)] }
    const html = renderToStaticMarkup(
      createElement(AssistantReply, { ask: 'soap', reply: plain, layout: 'page' })
    )
    expect(html).not.toContain('Related Businesses')
  })

  it('the saved thread keeps the mark', () => {
    const [turn] = cleanTurns([{ id: 't1', ask: 'soap', reply }])
    expect(turn?.reply.kind === 'reply' && turn.reply.cards[1]?.related).toBe(true)
  })
})

// ─── Where it is never used ───────────────────────────────────────────────────

describe('never in the strict grid, facets or /discover', () => {
  const STRICT = [
    'lib/listings/query.ts',
    'lib/listings/facets.ts',
    'app/(public)/search/page.tsx',
    'app/(public)/discover/(index)/page.tsx',
    'app/(public)/discover/[citySlug]/page.tsx',
  ]

  it.each(STRICT)('%s does not use meaning search', (file) => {
    const src = read(file)
    expect(src).not.toMatch(/search\/hybrid|relatedListings|search_listings_semantic|voyage/)
  })

  it('only Cue, the quick answer and the route call it', () => {
    expect(read('lib/ai/cue/data.ts')).toMatch(/findRelatedListings/)
    expect(read('app/api/cue/route.ts')).toMatch(/findRelatedListings/)
    expect(read('app/api/cue/route.ts')).toMatch(/related_used/)
  })
})
