// =============================================================================
// The quick answer above the /search grid (ticket 255)
// =============================================================================
// When Cue can't answer, the strip still does, from our own listings and with
// no model call. These pin lib/search/basicAnswer.ts: it is never empty, it
// never remarks on ownership (#299), and its links are Title Case.
// =============================================================================

import { describe, expect, it, vi } from 'vitest'

import type { AssistantCategory } from '@/lib/ai/assistant'
import type { ListingsParams } from '@/lib/listings/query'
import { buildBasicAnswer, composeBasicAnswer, SUGGEST_BUSINESS } from '@/lib/search/basicAnswer'
import { understandQuery } from '@/lib/search/understand'
import { isTitleCase } from '@/lib/text/title-case'

import { entity, ID } from './fixtures/cue'

const CATEGORIES: AssistantCategory[] = [
  { id: 'c-health', slug: 'health-wellness', name: 'Health & Wellness', parentId: null },
  {
    id: 'c-hwp',
    slug: 'health-wellness-products',
    name: 'Health & Wellness Products',
    parentId: 'c-health',
  },
  { id: 'c-retail', slug: 'retail-gifts', name: 'Retail & Gifts', parentId: null },
  { id: 'c-bath', slug: 'bath-body', name: 'Bath & Body', parentId: 'c-retail' },
  { id: 'c-pro', slug: 'professional-services', name: 'Professional Services', parentId: null },
  { id: 'c-tailor', slug: 'tailoring-alterations', name: 'Tailoring & Alterations', parentId: 'c-pro' },
]

const FOUNDER = 'How do I switch to Black Owned bathroom products'

/**
 * A search that answers by params: q, or category, or nothing. The q search
 * counts as the understood form (a rescue) unless `typed` is set, as for the
 * founder's question.
 */
function fakeSearch(by: { q?: number[]; category?: number[] | Record<string, number[]>; typed?: boolean }) {
  return vi.fn(async (p: ListingsParams) => {
    if (p.category) {
      const list = Array.isArray(by.category) ? by.category : (by.category?.[p.category] ?? [])
      return { entities: list.map((n) => entity(n)) }
    }
    if (p.q) {
      const entities = (by.q ?? []).map((n) => entity(n))
      return by.typed || entities.length === 0
        ? { entities }
        : { entities, understood: { mode: 'search' as const, words: [] } }
    }
    return { entities: [] }
  })
}

const OWNERSHIP = /black[- ]owned|black business|owned by/i

describe('buildBasicAnswer', () => {
  it("answers the founder's question with the strict matches", async () => {
    const search = fakeSearch({ q: [1, 2, 3, 4] })
    const answer = await buildBasicAnswer(FOUNDER, null, { search, categories: CATEGORIES })
    expect(answer.cards.map((c) => c.id)).toEqual([ID(1), ID(2), ID(3), ID(4)])
    expect(answer.text).toBe('Here are businesses that match “bathroom”.')
    expect(answer.exactBucket).toBe('3+')
    // Strict search runs with the visitor's words; queryListings understands them.
    expect(search.mock.calls[0]![0]).toMatchObject({ q: FOUNDER, noSponsored: true, page: 1 })
    // Three or more: no close-match search, no Suggest a Business.
    expect(search).toHaveBeenCalledTimes(1)
    expect(answer.actions).not.toContainEqual(SUGGEST_BUSINESS)
  })

  it('adds close matches from the category the words point to when strict is thin', async () => {
    const search = fakeSearch({ q: [1], category: [1, 7, 8] })
    const answer = await buildBasicAnswer(FOUNDER, null, { search, categories: CATEGORIES })
    expect(search.mock.calls[1]![0]).toMatchObject({ category: 'bath-body' })
    // The strict match first, and never twice.
    expect(answer.cards.map((c) => c.id)).toEqual([ID(1), ID(7), ID(8)])
    expect(answer.text).toContain('A few more in Bath & Body follow.')
    expect(answer.actions).toEqual([
      { kind: 'link', href: '/discover?category=bath-body', label: 'Browse Bath & Body' },
      SUGGEST_BUSINESS,
    ])
    expect(answer.exactBucket).toBe('1-2')
  })

  it('shows the closest category when nothing matches strictly', async () => {
    const search = fakeSearch({ category: [5, 6] })
    const answer = await buildBasicAnswer('where can I find a tailor', null, { search, categories: CATEGORIES })
    expect(answer.cards).toHaveLength(2)
    expect(answer.text).toBe(
      'Nothing matches “tailor” yet, so here are the closest: businesses in Tailoring & Alterations.'
    )
    expect(answer.exactBucket).toBe('0')
  })

  it('is never empty, even when every read fails', async () => {
    const search = vi.fn(async () => {
      throw new Error('down')
    })
    const answer = await buildBasicAnswer(FOUNDER, null, { search, categories: null })
    expect(answer.text).toBe(
      'Nothing matches “bathroom” yet. Try a broader word, or suggest a business you know so we can add it.'
    )
    expect(answer.cards).toEqual([])
    expect(answer.actions).toEqual([SUGGEST_BUSINESS])
  })

  it('searches near the visitor when the search has a place', async () => {
    const search = fakeSearch({ q: [1] })
    const answer = await buildBasicAnswer('tailor', { lat: 33.75, lng: -84.39 }, { search, categories: CATEGORIES })
    expect(search.mock.calls[0]![0]).toMatchObject({ lat: 33.75, lng: -84.39, sort: 'distance' })
    expect(answer.text).toBe('Here’s the business near you that matches “tailor”.')
  })

  it('drops paid slots', async () => {
    const search = vi.fn(async () => ({
      entities: [entity(1, { sponsored_placement_id: 'sp-1' } as never), entity(2)],
    }))
    const answer = await buildBasicAnswer('tailor', null, { search, categories: CATEGORIES })
    expect(answer.cards.map((c) => c.id)).toEqual([ID(2)])
  })

  it('echoes what was typed when the search as typed found it (ticket 257)', async () => {
    // "The Shop ATL" used to be echoed as “atl”: the understood words, though
    // the search as typed found the business.
    const search = fakeSearch({ q: [1], typed: true })
    const answer = await buildBasicAnswer('The Shop ATL', null, { search, categories: CATEGORIES })
    expect(answer.text).toBe('Here’s the business that matches “the shop atl”.')
  })

  it('echoes the understood words when only the understood form found it', async () => {
    const search = fakeSearch({ q: [1, 2, 3] })
    const answer = await buildBasicAnswer('where can I find a good tailor near me', null, {
      search,
      categories: CATEGORIES,
    })
    expect(answer.text).toBe('Here are businesses that match “tailor”.')
  })

  it('widens to the group when the matched category has no one in it yet (ticket 257)', async () => {
    const search = fakeSearch({ category: { 'professional-services': [5, 6] } })
    const answer = await buildBasicAnswer('where can I find a tailor', null, { search, categories: CATEGORIES })
    expect(search.mock.calls.map((c) => c[0].category).filter(Boolean)).toEqual([
      'tailoring-alterations',
      'professional-services',
    ])
    expect(answer.cards).toHaveLength(2)
    expect(answer.text).toBe(
      'Nothing matches “tailor” yet, so here are the closest: businesses in Professional Services.'
    )
    expect(answer.actions[0]).toEqual({
      kind: 'link',
      href: '/discover?category=professional-services',
      label: 'Browse Professional Services',
    })
  })

  it('keeps the category link when the group is empty too', async () => {
    const search = fakeSearch({})
    const answer = await buildBasicAnswer('where can I find a tailor', null, { search, categories: CATEGORIES })
    expect(answer.actions[0]).toMatchObject({ label: 'Browse Tailoring & Alterations' })
  })

  it('browses for an identity phrase alone, with no remark on ownership', async () => {
    const search = fakeSearch({ q: [1, 2, 3] })
    const answer = await buildBasicAnswer('black owned businesses', null, { search, categories: CATEGORIES })
    expect(answer.text).toBe(
      'Here are a few businesses to start with. Add what you need, like a kind of business or a city, to narrow it down.'
    )
    expect(answer.actions).toEqual([])
  })
})

describe('composeBasicAnswer', () => {
  const card = (n: number) => ({
    id: ID(n),
    name: `Business ${n}`,
    href: `/atlanta/business/business-${n}`,
    categoryName: 'Professional Services',
    cityLabel: 'Atlanta, GA',
    rating: null,
    reviewCount: 0,
    imageSrc: null,
  })

  it('never shows more than six cards', () => {
    const answer = composeBasicAnswer({
      query: 'tailor',
      understood: understandQuery('tailor'),
      exact: [1, 2].map(card),
      close: [3, 4, 5, 6, 7, 8].map(card),
      category: { name: 'Tailoring & Alterations', slug: 'tailoring-alterations' },
      near: false,
    })
    expect(answer.cards).toHaveLength(6)
  })

  it('cuts a long echo at a word', () => {
    const long = 'a tailor who can fix the hem on a vintage wedding dress before saturday afternoon please'
    const answer = composeBasicAnswer({
      query: long,
      understood: understandQuery('"' + long + '"'),
      exact: [],
      close: [],
      category: null,
      near: false,
    })
    expect(answer.text).toMatch(/“[^”]{1,61}…”/)
  })

  it('never remarks on ownership and keeps its links in Title Case', async () => {
    for (const q of [FOUNDER, 'black owned businesses', 'Black-Owned tailor near me', 'blackowned soap']) {
      const answer = await buildBasicAnswer(q, null, { search: fakeSearch({ q: [1] }), categories: CATEGORIES })
      expect(answer.text, q).not.toMatch(OWNERSHIP)
      for (const a of answer.actions) expect(isTitleCase(a.label), a.label).toBe(true)
    }
  })
})
