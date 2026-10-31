// =============================================================================
// Cue's tools (ticket 169)
// =============================================================================
// The any-word query, the parent-group retry, the id checks on show and
// get_listing, and input checks. The data is faked, so no database runs.
// =============================================================================

import { describe, expect, it, vi } from 'vitest'

import {
  buildSearchQuery,
  CUE_MAX_TERMS,
  CUE_TOOLS,
  formatHours,
  runCueTool,
  turnOutput,
} from '@/lib/ai/cue/tools'
import { NO_PAGE, type PageContext } from '@/lib/assistant/page'
import type { WeeklyHours } from '@/types'

import { CATEGORIES, cat, ctx, deps, entity, ID } from './fixtures/cue'

describe('buildSearchQuery', () => {
  it('turns "lawyer" into an any-word query with the words law firms use', () => {
    const { q, terms } = buildSearchQuery({
      words: ['lawyer'],
      category: cat('law-legal-services'),
      categories: CATEGORIES,
      withName: true,
    })
    expect(terms.slice(0, 2)).toEqual(['lawyer', 'attorney'])
    expect(terms).toContain('law firm')
    expect(terms).toContain('legal')
    expect(q).toContain('lawyer OR attorney')
    expect(q).toContain('"law firm"')
    // websearch_to_tsquery only reads an uppercase OR.
    expect(q).not.toMatch(/ or /)
  })

  it('finds the law words from the typed word alone when no category is set', () => {
    const { terms } = buildSearchQuery({ words: ['lawyer'], category: null, categories: CATEGORIES })
    expect(terms).toEqual(expect.arrayContaining(['lawyer', 'attorney', 'law firm']))
  })

  it('keeps "party" for party planning', () => {
    const { terms } = buildSearchQuery({
      words: ['party planning', 'party'],
      category: cat('event-planning'),
      categories: CATEGORIES,
    })
    expect(terms).toContain('party planning')
    expect(terms).toContain('party')
  })

  it('keeps "party" with no category, since it points at event planning', () => {
    const { terms } = buildSearchQuery({ words: ['party', 'planner'], category: null, categories: CATEGORIES })
    expect(terms).toContain('party')
    expect(terms).toContain('event planner')
  })

  it('keeps occasion words on the events parent group', () => {
    const { terms } = buildSearchQuery({ words: ['birthday', 'dj'], category: cat('events-entertainment'), categories: CATEGORIES })
    expect(terms).toContain('birthday')
  })

  it('drops occasion words for a bakery: a birthday cake is a cake', () => {
    const { terms } = buildSearchQuery({
      words: ['birthday', 'cake'],
      category: cat('bakeries-pastry-shops'),
      categories: CATEGORIES,
    })
    expect(terms).not.toContain('birthday')
    expect(terms[0]).toBe('cake')
  })

  it('keeps an occasion word when it is all there is', () => {
    const { terms } = buildSearchQuery({ words: ['birthday'], category: cat('bakeries-pastry-shops'), categories: CATEGORIES })
    expect(terms[0]).toBe('birthday')
  })

  it('cleans words so they cannot change the query', () => {
    const { q } = buildSearchQuery({ words: ['"lawyer" -cheap OR'], category: null, categories: CATEGORIES })
    expect(q).toBe('"lawyer cheap"')
  })

  it('caps the terms', () => {
    const { terms } = buildSearchQuery({
      words: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'],
      category: cat('law-legal-services'),
      categories: CATEGORIES,
      withName: true,
    })
    expect(terms).toHaveLength(CUE_MAX_TERMS)
  })
})

describe('CUE_TOOLS', () => {
  it('streams every tool input and caches the list on the last tool', () => {
    expect(CUE_TOOLS.every((t) => t.eager_input_streaming === true)).toBe(true)
    expect(CUE_TOOLS.at(-1)?.cache_control).toEqual({ type: 'ephemeral' })
    expect(CUE_TOOLS.slice(0, -1).some((t) => t.cache_control)).toBe(false)
    for (const t of CUE_TOOLS) expect(t.input_schema).not.toHaveProperty('$schema')
  })
})

describe('runCueTool: input checks', () => {
  it('returns an error result for a bad input, never a throw', async () => {
    const r = await runCueTool('search_listings', { words: [] }, ctx())
    expect(r.isError).toBe(true)
    expect(r.content).toMatch(/^INVALID_INPUT/)
  })

  it('rejects a cut-short input with extra or missing fields', async () => {
    expect((await runCueTool('show_businesses', { ids: ['not-a-uuid'] }, ctx())).isError).toBe(true)
    expect((await runCueTool('find_place', { place: 'Atlanta', extra: 1 }, ctx())).isError).toBe(true)
  })

  it('returns an error result for an unknown tool', async () => {
    const r = await runCueTool('delete_everything', {}, ctx())
    expect(r.isError).toBe(true)
  })
})

describe('search_listings', () => {
  it('searches the category with the any-word query, no paid slots', async () => {
    const search = vi.fn(async () => [entity(1), entity(2, { sponsored_placement_id: 'sp-1' })])
    const c = ctx({ deps: deps({ search }) })
    const r = await runCueTool('search_listings', { words: ['lawyer'], category: 'law-legal-services', city: 'atlanta' }, c)
    expect(r.isError).toBe(false)
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'law-legal-services', city: 'atlanta', sort: 'relevance', noSponsored: true })
    )
    const body = JSON.parse(r.content)
    expect(body.results.map((x: { id: string }) => x.id)).toEqual([ID(1)])
    expect(c.state.seen.has(ID(1))).toBe(true)
    expect(c.state.seen.has(ID(2))).toBe(false)
  })

  it('looks in the parent group when the subcategory is empty, and says so', async () => {
    const search = vi.fn(async (p: { category?: string; q?: string }) =>
      p.category === 'professional-services' ? [entity(1)] : []
    )
    const c = ctx({ deps: deps({ search }) })
    const r = await runCueTool('search_listings', { words: ['lawyer'], category: 'law-legal-services', city: 'atlanta' }, c)
    const body = JSON.parse(r.content)
    expect(search).toHaveBeenCalledTimes(2)
    // The retry leaves out the parent's own name, which would match the whole group.
    const retryQ = search.mock.calls[1]![0].q!
    expect(retryQ).toContain('"law firm"')
    expect(retryQ).not.toMatch(/\bprofessional\b/)
    expect(body.note).toMatch(/Professional Services/)
    expect(body.results).toHaveLength(1)
    expect(c.state.searches).toBe(2)
  })

  it('says to try again when nothing is found', async () => {
    const r = await runCueTool('search_listings', { words: ['zebra'] }, ctx())
    const body = JSON.parse(r.content)
    expect(body.results).toEqual([])
    expect(body.next).toMatch(/other words/)
  })

  it('sends a city we do not cover to find_place', async () => {
    const r = await runCueTool('search_listings', { words: ['cake'], city: 'savannah' }, ctx())
    expect(r.isError).toBe(true)
    expect(r.content).toMatch(/find_place/)
  })

  it('refuses near me without a shared location, and sorts by distance with one', async () => {
    expect((await runCueTool('search_listings', { words: ['cake'], near_me: true }, ctx())).isError).toBe(true)
    const search = vi.fn(async () => [])
    await runCueTool('search_listings', { words: ['cake'], near_me: true }, ctx({ near: { lat: 33.7, lng: -84.4 }, deps: deps({ search }) }))
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ sort: 'distance', lat: 33.7, lng: -84.4 }))
  })

  it('rejects a category slug that is not on the list', async () => {
    const r = await runCueTool('search_listings', { words: ['cake'], category: 'made-up' }, ctx())
    expect(r.isError).toBe(true)
  })

  it('never hands the model the ownership label', async () => {
    const search = vi.fn(async () => [entity(1, { review_count: 3, avg_rating: 4.7 })])
    const r = await runCueTool('search_listings', { words: ['lawyer'] }, ctx({ deps: deps({ search }) }))
    expect(r.content).not.toMatch(/ownership|black_owned/i)
    expect(JSON.parse(r.content).results[0]).toMatchObject({ rating: 4.7, reviews: 3 })
  })
})

describe('find_place', () => {
  it('says a covered city is covered', async () => {
    const body = JSON.parse((await runCueTool('find_place', { place: 'Atlanta' }, ctx())).content)
    expect(body.covered).toBe(true)
    expect(body.cities[0]).toMatchObject({ slug: 'atlanta' })
  })

  it('offers the nearest covered cities for a place we do not have', async () => {
    const locate = vi.fn(async () => ({ label: 'Macon', point: { lat: 32.84, lng: -83.63 } }))
    const body = JSON.parse((await runCueTool('find_place', { place: 'Macon' }, ctx({ deps: deps({ locate }) }))).content)
    expect(body.covered).toBe(false)
    expect(body.nearest[0]).toMatchObject({ slug: 'atlanta' })
    expect(body.nearest[0].miles).toBeGreaterThan(0)
  })
})

describe('get_listing and show_businesses', () => {
  const hours: WeeklyHours = {
    monday: { open: '09:00', close: '17:00', closed: false },
    tuesday: { open: '09:00', close: '17:00', closed: false },
    wednesday: { open: '09:00', close: '17:00', closed: false },
    thursday: { open: '09:00', close: '17:00', closed: false },
    friday: { open: '09:00', close: '13:30', closed: false },
    saturday: { open: '09:00', close: '17:00', closed: true },
    sunday: { open: '09:00', close: '17:00', closed: true },
  }

  it('formats hours per day', () => {
    const lines = formatHours(hours)!
    expect(lines[0]).toBe('Monday: 9:00 AM to 5:00 PM')
    expect(lines[4]).toBe('Friday: 9:00 AM to 1:30 PM')
    expect(lines[6]).toBe('Sunday: closed')
  })

  it('reads details only for an id a tool returned', async () => {
    const loadDetails = vi.fn(async () => ({ entity: entity(1), hours }))
    const c = ctx({ deps: deps({ loadDetails }) })
    expect((await runCueTool('get_listing', { id: ID(1) }, c)).isError).toBe(true)
    expect(loadDetails).not.toHaveBeenCalled()

    c.state.seen.set(ID(1), entity(1))
    const body = JSON.parse((await runCueTool('get_listing', { id: ID(1) }, c)).content)
    expect(body.hours[6]).toBe('Sunday: closed')
  })

  it('reads details for a card shown last turn', async () => {
    const loadDetails = vi.fn(async () => ({ entity: entity(1), hours: null }))
    const c = ctx({ priorIds: new Set([ID(1)]), deps: deps({ loadDetails }) })
    const body = JSON.parse((await runCueTool('get_listing', { id: ID(1) }, c)).content)
    expect(body.hours).toBe('not listed')
  })

  it('shows only ids a tool returned, and reports the rest', async () => {
    const c = ctx()
    c.state.seen.set(ID(1), entity(1))
    const r = await runCueTool('show_businesses', { ids: [ID(1), ID(9)] }, c)
    expect(JSON.parse(r.content)).toEqual({ showing: 1, ignored: [ID(9)] })
    expect(c.state.shown).toEqual([ID(1)])
  })

  it('refuses when no id is known', async () => {
    const c = ctx()
    const r = await runCueTool('show_businesses', { ids: [ID(9)] }, c)
    expect(r.isError).toBe(true)
    expect(c.state.shown).toEqual([])
  })

  it('loads last turn cards again to show them', async () => {
    const loadByIds = vi.fn(async () => [entity(4)])
    const c = ctx({ priorIds: new Set([ID(4)]), deps: deps({ loadByIds }) })
    await runCueTool('show_businesses', { ids: [ID(4)] }, c)
    expect(loadByIds).toHaveBeenCalledWith([ID(4)])
    const { cards } = turnOutput(c)
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ id: ID(4), name: 'Business 4', cityLabel: 'Atlanta, GA' })
    expect(cards[0]!.href).toContain('business-4')
  })

  it('drops a prior card that is no longer published', async () => {
    const c = ctx({ priorIds: new Set([ID(4)]), deps: deps({ loadByIds: vi.fn(async () => []) }) })
    expect((await runCueTool('show_businesses', { ids: [ID(4)] }, c)).isError).toBe(true)
  })
})

describe('page_action', () => {
  const page: PageContext = {
    ...NO_PAGE,
    actions: { plans: { kind: 'scroll', ids: ['plans'], label: 'See the plans' } },
  }

  it('keeps only codes the page offers', async () => {
    const c = ctx({ page })
    const r = await runCueTool('page_action', { codes: ['plans', 'checkout'] }, c)
    expect(JSON.parse(r.content)).toEqual({ offered: ['plans'], ignored: ['checkout'] })
    expect(turnOutput(c).actions).toHaveLength(1)
  })

  it('refuses when none fit', async () => {
    expect((await runCueTool('page_action', { codes: ['checkout'] }, ctx({ page }))).isError).toBe(true)
  })
})
