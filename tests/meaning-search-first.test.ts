// =============================================================================
// Meaning first when nothing matches, plus its scores (ticket 263)
// =============================================================================
// Pins what 263 changed on top of ticket 260:
//   * Cue asks meaning search before the category's close matches, so related
//     businesses get the room first; close matches fill the rest, at least two
//   * a lookup reports its best score and how many reached the bar, numbers
//     only, so 0.45 can be tuned from real searches
//   * scores under the bar are counted, never shown
// =============================================================================

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({}),
  createClient: async () => ({}),
}))

import { CUE_CLOSE_MIN, CUE_CLOSE_RESULTS, mergeRelatedStats, runCueTool } from '@/lib/ai/cue/tools'
import type { AssistantCategory } from '@/lib/ai/assistant'
import type { ListingsParams } from '@/lib/listings/query'
import { buildBasicAnswer } from '@/lib/search/basicAnswer'
import {
  findRelatedIds,
  relatedCheckProps,
  relatedStats,
  RELATED_SCORE_FLOOR,
  type RelatedDeps,
  type RelatedStats,
} from '@/lib/search/hybrid'

import { ctx, deps, entity, ID } from './fixtures/cue'

const hit = (n: number, similarity: number) => ({ listingId: ID(n), similarity })
const VECTOR = [0.1, 0.2]

function fakeDeps(hits: ReturnType<typeof hit>[]): RelatedDeps {
  return { embed: vi.fn(async () => VECTOR), nearest: vi.fn(async () => hits) }
}

describe('scores (ticket 263)', () => {
  it('best score and how many reach the bar', () => {
    expect(relatedStats([hit(1, 0.3), hit(2, 0.62), hit(3, 0.45), hit(4, Number.NaN)])).toEqual({
      best: 0.62,
      hits: 2,
    })
    expect(relatedStats([])).toEqual({ best: null, hits: 0 })
  })

  it('asks the database down to the floor, reports the scores, shows only what reaches the bar', async () => {
    const d = fakeDeps([hit(1, 0.41), hit(2, 0.3)])
    let seen: RelatedStats | null = null
    const ids = await findRelatedIds({ text: 'stress relief', onStats: (s) => (seen = s) }, d)
    expect(RELATED_SCORE_FLOOR).toBe(0.25)
    expect(d.nearest).toHaveBeenCalledWith(
      expect.objectContaining({ minSimilarity: RELATED_SCORE_FLOOR })
    )
    expect(ids).toEqual([])
    expect(seen).toEqual({ best: 0.41, hits: 0 })
  })

  it('a failing score callback never costs the answer', async () => {
    const ids = await findRelatedIds(
      {
        text: 'soap',
        onStats: () => {
          throw new Error('boom')
        },
      },
      fakeDeps([hit(1, 0.8)])
    )
    expect(ids).toEqual([ID(1)])
  })

  it('no lookup, no scores: no words or no numbers', async () => {
    const onStats = vi.fn()
    await findRelatedIds({ text: ' ', onStats }, fakeDeps([hit(1, 0.9)]))
    await findRelatedIds({ text: 'soap', onStats }, { embed: async () => null, nearest: vi.fn() })
    expect(onStats).not.toHaveBeenCalled()
  })

  it('two lookups in one turn: the best score and the most hits', () => {
    expect(mergeRelatedStats(null, { best: 0.4, hits: 0 })).toEqual({ best: 0.4, hits: 0 })
    expect(mergeRelatedStats({ best: 0.4, hits: 0 }, { best: 0.6, hits: 2 })).toEqual({
      best: 0.6,
      hits: 2,
    })
    expect(mergeRelatedStats({ best: 0.7, hits: 3 }, { best: null, hits: 0 })).toEqual({
      best: 0.7,
      hits: 3,
    })
  })

  it('as analytics: whether it ran, best to 2 places, hits; never words', () => {
    expect(relatedCheckProps(null)).toEqual({
      related_checked: false,
      related_best: null,
      related_hits: 0,
    })
    expect(relatedCheckProps({ best: 0.43567, hits: 0 })).toEqual({
      related_checked: true,
      related_best: 0.44,
      related_hits: 0,
    })
    expect(relatedCheckProps({ best: null, hits: 0 }).related_best).toBeNull()
  })
})

describe('Cue: meaning first when nothing matches (ticket 263)', () => {
  // Nothing by the words; the Law category has 7, 8, 9, 10, 13.
  const search = () =>
    vi.fn(async (p: { q?: string; category?: string }) =>
      p.q ? [] : [entity(7), entity(8), entity(9), entity(10), entity(13)]
    )

  it('asks meaning search before the close matches, and close matches skip what it found', async () => {
    const order: string[] = []
    const s = search()
    const wrapped = vi.fn(async (p: { q?: string; category?: string }) => {
      order.push(p.category ? 'close' : 'words')
      return s(p)
    })
    const related = vi.fn(async (r: { onStats?: (s: RelatedStats) => void }) => {
      order.push('meaning')
      r.onStats?.({ best: 0.58, hits: 3 })
      return [entity(8), entity(11), entity(12)]
    })
    const c = ctx({ deps: deps({ search: wrapped, related }) })
    const body = JSON.parse(
      (await runCueTool('search_listings', { words: ['attorney'] }, c)).content
    )

    expect(order).toEqual(['words', 'meaning', 'close'])
    expect(related).toHaveBeenCalledWith(expect.objectContaining({ exclude: [] }))
    expect(body.related.results.map((r: { id: string }) => r.id)).toEqual([ID(8), ID(11), ID(12)])
    // 5 - 3 related = 2 close, and never one already related.
    expect(body.closeMatches.results.map((r: { id: string }) => r.id)).toEqual([ID(7), ID(9)])
    expect(body.next).toMatch(/Lead with the related businesses/)
    expect(Object.keys(body).indexOf('related')).toBeLessThan(
      Object.keys(body).indexOf('closeMatches')
    )
    expect(c.state.related.has(ID(8))).toBe(true)
    expect(c.state.relatedCheck).toEqual({ best: 0.58, hits: 3 })
  })

  it('close matches keep at least two when meaning search fills its five', async () => {
    const related = vi.fn(async () => [11, 12, 14, 15, 16].map((n) => entity(n)))
    const c = ctx({ deps: deps({ search: search(), related }) })
    const body = JSON.parse(
      (await runCueTool('search_listings', { words: ['attorney'] }, c)).content
    )
    expect(CUE_CLOSE_MIN).toBe(2)
    expect(body.closeMatches.results).toHaveLength(CUE_CLOSE_MIN)
  })

  it('nothing by meaning: close matches as before (all five)', async () => {
    const related = vi.fn(async (r: { onStats?: (s: RelatedStats) => void }) => {
      r.onStats?.({ best: 0.39, hits: 0 })
      return []
    })
    const c = ctx({ deps: deps({ search: search(), related }) })
    const body = JSON.parse(
      (await runCueTool('search_listings', { words: ['attorney'] }, c)).content
    )
    expect(body.related).toBeUndefined()
    expect(body.closeMatches.results).toHaveLength(CUE_CLOSE_RESULTS)
    expect(body.next).toMatch(/show them as close matches/)
    expect(c.state.relatedCheck).toEqual({ best: 0.39, hits: 0 })
  })

  it('related but no nearest category: told to show the ones that fit', async () => {
    const related = vi.fn(async () => [entity(11)])
    const c = ctx({ deps: deps({ search: vi.fn(async () => []), related }) })
    const body = JSON.parse((await runCueTool('search_listings', { words: ['zebra'] }, c)).content)
    expect(body.closeMatches).toBeUndefined()
    expect(body.next).toMatch(/Show the related businesses whose text fits/)
  })

  it('meaning search off: no scores', async () => {
    const c = ctx({ deps: deps({ search: search() }) })
    await runCueTool('search_listings', { words: ['attorney'] }, c)
    expect(c.state.relatedCheck).toBeNull()
  })
})

describe('quick answer scores (ticket 263)', () => {
  const CATEGORIES: AssistantCategory[] = [
    { id: 'c-retail', slug: 'retail-gifts', name: 'Retail & Gifts', parentId: null },
  ]
  const searchFor = vi.fn(async (_p: ListingsParams) => ({ entities: [] }))

  it('carries the lookup scores', async () => {
    const answer = await buildBasicAnswer('stress relief', null, {
      search: searchFor,
      categories: CATEGORIES,
      related: async (r) => {
        r.onStats?.({ best: 0.41, hits: 0 })
        return []
      },
    })
    expect(answer.relatedCheck).toEqual({ best: 0.41, hits: 0 })
  })

  it('no lookup: null', async () => {
    const answer = await buildBasicAnswer('stress relief', null, {
      search: searchFor,
      categories: CATEGORIES,
    })
    expect(answer.relatedCheck).toBeNull()
  })
})
