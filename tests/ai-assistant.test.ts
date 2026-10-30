// =============================================================================
// The site assistant (ticket 147)
// =============================================================================
// Pure half (lib/ai/assistant.ts): need names, the allow-list, ranking, the
// prompt, the wording and the mock planner.
// Action half (lib/actions/ai/assistant.ts): the check order, the shared
// visitor budget, the no-match ladder, places we don't cover, follow-ups, and
// that no visitor text reaches the audit row or the console.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type Row = Record<string, unknown>

const h = vi.hoisted(() => ({
  flags: { aiAssistant: true },
  killSwitch: false,
  provider: 'mock' as 'mock' | 'anthropic',
  rateAllowed: true,
  withinCeiling: true,
  used: { visitor_guide: 0, visitor_assistant: 0 } as Record<string, number>,
  countedTypes: [] as string[],
  ceilingUsd: 10 as number | null,
  inserts: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
  insertFails: false,
  rateCalls: [] as Array<Record<string, unknown>>,
  queryCalls: [] as Array<Record<string, unknown>>,
  /** Category rows with live slugs, added for the close-kinds tests. */
  extraCategories: [] as Array<{ id: string; name: string; slug: string; parent_id: string | null }>,
  /** What a search returns. Defaults to nothing. */
  search: (_params: Record<string, unknown>): Array<Record<string, unknown>> => [],
  lookupPlace: vi.fn(),
  callAnthropic: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  isFeatureEnabled: (name: string) => (name === 'aiAssistant' ? h.flags.aiAssistant : false),
}))
vi.mock('@/lib/ai/provider', () => ({
  aiKillSwitchOn: () => h.killSwitch,
  resolveProvider: () =>
    h.provider === 'anthropic'
      ? { provider: 'anthropic', model: 'claude-test-fast' }
      : { provider: 'mock', model: 'mock-v1' },
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }),
}))
vi.mock('@/lib/security/rate-limit', () => ({
  getClientIp: (headers: Headers) => headers.get('x-forwarded-for') ?? 'unknown',
  checkRateLimit: async (opts: Record<string, unknown>) => {
    h.rateCalls.push(opts)
    return opts.bucket === 'ai_assistant' ? h.rateAllowed : true
  },
}))
vi.mock('@/lib/ai/spend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/spend')>()),
  withinMonthlyCeiling: async () => h.withinCeiling,
  monthlyCeilingUsd: () => h.ceilingUsd,
  countAgentAttemptsThisMonth: async (agentType: string) => {
    h.countedTypes.push(agentType)
    return h.used[agentType] ?? 0
  },
}))
vi.mock('@/lib/ai/anthropic', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/anthropic')>()),
  callAnthropic: h.callAnthropic,
}))
vi.mock('@/lib/listings/query', () => ({
  queryListings: async (params: Record<string, unknown>) => {
    h.queryCalls.push(params)
    const entities = h.search(params)
    // Like the real query: injected sponsored cards are not in the total.
    const total = entities.filter((e) => !e.sponsored_placement_id).length
    return { entities, total, page: 1, pageSize: 24 }
  },
}))
vi.mock('@/lib/listings/coverImage', () => ({
  resolveMediaPath: (path: string | null | undefined) => (path ? `https://media.test/${path}` : null),
}))
vi.mock('@/lib/search/placeLookup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/search/placeLookup')>()),
  lookupPlace: h.lookupPlace,
}))

const CATEGORY_ROWS = [
  { id: 'c-food', name: 'Food & Dining', slug: 'food-dining', parent_id: null },
  { id: 'c-soul', name: 'Soul Food', slug: 'soul-food', parent_id: 'c-food' },
  { id: 'c-thai', name: 'Thai', slug: 'thai', parent_id: 'c-food' },
  { id: 'c-cater', name: 'Catering', slug: 'catering', parent_id: 'c-food' },
  { id: 'c-ent', name: 'Entertainment', slug: 'entertainment', parent_id: null },
  { id: 'c-dj', name: 'DJs', slug: 'djs', parent_id: 'c-ent' },
  { id: 'c-venue', name: 'Event Venues', slug: 'event-venues', parent_id: 'c-ent' },
  { id: 'c-bake', name: 'Bakeries', slug: 'bakeries', parent_id: 'c-food' },
  { id: 'c-photo', name: 'Photographers', slug: 'photographers', parent_id: null },
  { id: 'c-decor', name: 'Party Decor', slug: 'party-decor', parent_id: null },
  { id: 'c-beauty', name: 'Beauty & Grooming', slug: 'beauty-grooming', parent_id: null },
  { id: 'c-barber', name: 'Barbershops', slug: 'barbershops', parent_id: 'c-beauty' },
]
/** The fake food subcategories the live-slug rows replace (Soul Food stays). */
const FAKE_FOOD = new Set(['c-thai', 'c-cater', 'c-bake'])
const CITY_ROWS = [
  { id: 'ci-det', name: 'Detroit', slug: 'detroit', is_active: true, latitude: 42.3314, longitude: -83.0458, states: { code: 'MI' } },
  { id: 'ci-atl', name: 'Atlanta', slug: 'atlanta', is_active: true, latitude: 33.749, longitude: -84.388, states: { code: 'GA' } },
  { id: 'ci-chi', name: 'Chicago', slug: 'chicago', is_active: true, latitude: 41.8781, longitude: -87.6298, states: { code: 'IL' } },
  { id: 'ci-gr', name: 'Grand Rapids', slug: 'grand-rapids', is_active: false, latitude: 42.9634, longitude: -85.6681, states: { code: 'MI' } },
]

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      const rows =
        table !== 'categories'
          ? CITY_ROWS
          : h.extraCategories.length > 0
            ? [...CATEGORY_ROWS.filter((c) => !FAKE_FOOD.has(c.id)), ...h.extraCategories]
            : CATEGORY_ROWS
      const done = { data: rows, error: null }
      const builder = {
        select: () => (table === 'cities' ? Promise.resolve(done) : builder),
        eq: async () => done,
      }
      return builder
    },
  }),
  createServiceClient: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        h.inserts.push(row)
        return {
          select: () => ({
            single: async () => (h.insertFails ? { data: null, error: { message: 'down' } } : { data: { id: 'req-1' }, error: null }),
          }),
        }
      },
      update: (row: Record<string, unknown>) => {
        h.updates.push(row)
        return { eq: async () => ({ error: null }) }
      },
    }),
  }),
}))

import {
  ASSISTANT_MAX_NEEDS,
  ASSISTANT_SYSTEM_PROMPT,
  applyAssistantAllowList,
  assistantAskSchema,
  buildAssistantPrompt,
  buildAssistantSummary,
  buildHeading,
  checkNeedName,
  CLOSE_KINDS,
  closeKindsFor,
  joinKinds,
  NO_LOCATION_NOTICE,
  mockAssistantAnswer,
  nearestCities,
  rankTop,
  spreadTops,
  topLimit,
  typedWords,
  visitorCallsUsed,
  weightedRating,
  type AssistantAllowList,
} from '@/lib/ai/assistant'
import { GUIDE_MAX_PROMPT_CHARS } from '@/lib/ai/guide'
import { ASSISTANT_AGENT } from '@/lib/ai/agents'
import { SYSTEM_PROMPT, ProviderCallError } from '@/lib/ai/anthropic'
import { monthlyCallBudget } from '@/lib/ai/spend'
import { askAssistant } from '@/lib/actions/ai/assistant'

/** Food subcategories with their live slugs, so CLOSE_KINDS applies. They stand in for the fake ones. */
const LIVE_FOOD = [
  { id: 'c-rest', name: 'Restaurants', slug: 'restaurants', parent_id: 'c-food' },
  { id: 'c-bps', name: 'Bakeries & Pastry Shops', slug: 'bakeries-pastry-shops', parent_id: 'c-food' },
  { id: 'c-cafe', name: 'Cafes & Coffee', slug: 'cafes-coffee', parent_id: 'c-food' },
  { id: 'c-cef', name: 'Catering', slug: 'catering-events-food', parent_id: 'c-food' },
  { id: 'c-groc', name: 'Grocery & Markets', slug: 'grocery-markets', parent_id: 'c-food' },
  { id: 'c-truck', name: 'Food Trucks', slug: 'food-trucks', parent_id: 'c-food' },
]

const ALLOW: AssistantAllowList = {
  categories: CATEGORY_ROWS.map((c) => ({ id: c.id, slug: c.slug, name: c.name, parentId: c.parent_id })),
  cities: CITY_ROWS.filter((c) => c.is_active).map((c) => ({ slug: c.slug, name: c.name })),
}

/** A listing as search returns it. */
function ENTITY(id: string, extra: Row = {}): Row {
  return {
    id,
    name: `Place ${id}`,
    slug: id,
    entity_type: 'business',
    category: { name: 'Soul Food', slug: 'soul-food' },
    city: { name: 'Detroit', slug: 'detroit', state_abbr: 'MI' },
    avg_rating: null,
    review_count: 0,
    cover_image_path: null,
    logo_path: null,
    sponsored_placement_id: null,
    ...extra,
  }
}

/** The assistant's own searches; the name search sends only q and page. */
const needCalls = () => h.queryCalls.filter((c) => 'sort' in c)

function modelSays(answer: Row): void {
  h.provider = 'anthropic'
  h.callAnthropic.mockResolvedValue({ text: JSON.stringify(answer), inputTokens: 400, outputTokens: 60 })
}

function answerOf(res: Awaited<ReturnType<typeof askAssistant>>) {
  if (res.kind !== 'answer') throw new Error(`expected an answer, got ${JSON.stringify(res)}`)
  return res
}

// ─── Pure ────────────────────────────────────────────────────────────────────

describe('need names', () => {
  it('keeps short plain names and refuses anything else', () => {
    expect(checkNeedName('  Balloon   decor ')).toBe('Balloon decor')
    expect(checkNeedName("Mom's soul food")).toBe("Mom's soul food")
    expect(checkNeedName('Visit spam.example')).toBeNull()
    expect(checkNeedName('<b>DJ</b>')).toBeNull()
    expect(checkNeedName('a'.repeat(41))).toBeNull()
    expect(checkNeedName('--')).toBeNull()
    expect(checkNeedName(null)).toBeNull()
  })
})

describe('applyAssistantAllowList', () => {
  const typed = typedWords('plan a party in detroit with a dj and soul food oxtails', [])

  it('falls back to the category name, drops unknown codes and needs with nothing to search', () => {
    const plan = applyAssistantAllowList(
      {
        city: 'detroit',
        needs: [
          { name: 'Call 555 http://x', category: 'djs' },
          { name: 'Soul food', category: 'soul-food', keywords: ['oxtails', 'invented', 'detroit', 'two words'] },
          { name: null, category: 'made-up' },
          { name: '!!', category: null },
        ],
        page: 'admin',
      },
      ALLOW,
      typed
    )
    expect(plan.city).toEqual({ slug: 'detroit', name: 'Detroit' })
    expect(plan.page).toBeNull()
    expect(plan.needs).toEqual([
      { name: 'DJs', category: ALLOW.categories[5], keywords: [], openNow: false },
      { name: 'Soul food', category: ALLOW.categories[1], keywords: ['oxtails'], openNow: false },
    ])
  })

  it('uses the name words as search terms when there is no category', () => {
    const plan = applyAssistantAllowList({ needs: [{ name: 'Balloon decor', category: null }] }, ALLOW, typed)
    expect(plan.needs[0]).toMatchObject({ name: 'Balloon decor', category: null, keywords: ['balloon', 'decor'] })
  })

  it('caps needs at six and drops repeats', () => {
    const needs = ['Catering', 'catering', 'DJ', 'Venue', 'Bakery', 'Photos', 'Decor', 'Cake'].map((name) => ({ name }))
    const plan = applyAssistantAllowList({ needs }, ALLOW, typedWords(needs.map((n) => n.name).join(' '), []))
    expect(plan.needs.map((n) => n.name)).toEqual(['Catering', 'DJ', 'Venue', 'Bakery', 'Photos', 'Decor'])
    expect(plan.needs).toHaveLength(ASSISTANT_MAX_NEEDS)
  })

  it('keeps a place only in the visitor own words, and never next to a city', () => {
    const alaska = typedWords('thai food in alaska', [])
    expect(applyAssistantAllowList({ place: 'Alaska', needs: [] }, ALLOW, alaska).place).toBe('alaska')
    expect(applyAssistantAllowList({ place: 'Anchorage', needs: [] }, ALLOW, alaska).place).toBeNull()
    expect(applyAssistantAllowList({ city: 'atlanta', place: 'Alaska', needs: [] }, ALLOW, alaska).place).toBeNull()
  })

  it('turns a place with no needs into one Places need', () => {
    const plan = applyAssistantAllowList({ city: 'detroit', needs: [] }, ALLOW, typed)
    expect(plan.needs).toEqual([{ name: 'Places', category: null, keywords: [], openNow: false }])
  })
})

describe('ranking', () => {
  it('trusts many reviews over one', () => {
    expect(weightedRating(5, 1)).toBeCloseTo(4.25)
    expect(weightedRating(4.8, 200)!).toBeGreaterThan(weightedRating(5, 1)!)
    expect(weightedRating(null, 0)).toBeNull()
  })

  it('puts rated first, best first, and keeps search order for the rest', () => {
    const items = [
      { id: 'u1', avg_rating: null, review_count: 0 },
      { id: 'one5', avg_rating: 5, review_count: 1 },
      { id: 'u2', avg_rating: null, review_count: 0 },
      { id: 'many48', avg_rating: 4.8, review_count: 200 },
    ]
    expect(rankTop(items, 3).map((i) => i.id)).toEqual(['many48', 'one5', 'u1'])
    expect(topLimit(1)).toBe(6)
    expect(topLimit(4)).toBe(3)
  })

  it('spreads cards so one business does not lead two needs, repeating only when nothing else is left', () => {
    const c = (id: string) => ({ id })
    const tops = spreadTops([[c('a'), c('b'), c('c'), c('d')], [c('a'), c('e'), c('b'), c('f')], [c('a')]], 3)
    expect(tops.map((t) => t.map((x) => x.id))).toEqual([['a', 'b', 'c'], ['e', 'f', 'a'], ['a']])
  })

  it('finds the closest cities, leaving out the ones asked', () => {
    const cities = CITY_ROWS.filter((c) => c.is_active).map((c) => ({ slug: c.slug, name: c.name, isActive: true, lat: c.latitude, lng: c.longitude }))
    const fromAnnArbor = { lat: 42.28, lng: -83.74 }
    expect(nearestCities(fromAnnArbor, cities, 3).map((c) => c.slug)).toEqual(['detroit', 'chicago', 'atlanta'])
    expect(nearestCities(fromAnnArbor, cities, 1, ['detroit']).map((c) => c.slug)).toEqual(['chicago'])
  })
})

describe('input and prompt', () => {
  it('keeps the last three earlier messages and rounds Near me', () => {
    const parsed = assistantAskSchema.parse({
      message: '  what about djs ',
      history: ['one', ' ', 'two', 'three', 'four'],
      near: { lat: 42.331427, lng: -83.045753 },
    })
    expect(parsed).toEqual({ message: 'what about djs', history: ['two', 'three', 'four'], near: { lat: 42.331, lng: -83.046 } })
    expect(assistantAskSchema.safeParse({ message: 'x', extra: 1 }).success).toBe(false)
    expect(assistantAskSchema.safeParse({ message: '   ' }).success).toBe(false)
  })

  it('stays inside the prompt limit, dropping subcategories and then old messages', () => {
    const many: AssistantAllowList = {
      categories: [
        ...ALLOW.categories,
        ...Array.from({ length: 300 }, (_, i) => ({ id: `x${i}`, slug: `sub-category-${i}`, name: `Sub ${i}`, parentId: 'c-food' })),
      ],
      cities: ALLOW.cities,
    }
    const built = buildAssistantPrompt('a party', ['earlier one', 'earlier two'], many)!
    expect(built.prompt.length).toBeLessThanOrEqual(GUIDE_MAX_PROMPT_CHARS)
    expect(built.offered.categories.every((c) => c.parentId === null)).toBe(true)
    expect(built.prompt).toContain('earlier two')
  })

  it('keeps its system prompt shorter than the owner one, so the spend bound holds', () => {
    expect(ASSISTANT_SYSTEM_PROMPT.length).toBeLessThan(SYSTEM_PROMPT.length)
  })
})

describe('wording', () => {
  it('reads the heading and the status line from fixed text', () => {
    expect(buildHeading([{ name: 'DJs' }], 'Detroit', false)).toBe('DJs in Detroit')
    expect(buildHeading([{ name: 'a' }, { name: 'b' }], null, true)).toBe('Your list near you')
    expect(
      buildAssistantSummary([
        { status: 'found', total: 4 },
        { status: 'nearest', total: 2 },
        { status: 'none', total: 0 },
      ])
    ).toBe('Found 1 of 3 needs, 1 with a close option, 1 not listed.')
    expect(buildAssistantSummary([{ status: 'found', total: 1 }])).toBe('Found 1 match.')
  })

  it('counts guide and assistant calls together', () => {
    expect(visitorCallsUsed(3, 4)).toBe(7)
    expect(visitorCallsUsed(-1, 2)).toBe(2)
  })
})

describe('close kinds', () => {
  it('lists at most two close kinds per kind, never the kind itself', () => {
    for (const [slug, close] of Object.entries(CLOSE_KINDS)) {
      expect(close.length, slug).toBeLessThanOrEqual(2)
      expect(close, slug).not.toContain(slug)
    }
  })

  it('never offers a grocery store for a bakery, or a whole group for anything', () => {
    expect(CLOSE_KINDS['bakeries-pastry-shops']).not.toContain('grocery-markets')
    const parents = new Set(CATEGORY_ROWS.filter((c) => !c.parent_id).map((c) => c.slug))
    for (const close of Object.values(CLOSE_KINDS)) for (const slug of close) expect(parents.has(slug), slug).toBe(false)
  })

  it('finds close kinds only for a subcategory, and only ones we have', () => {
    const cats = [...CATEGORY_ROWS, ...LIVE_FOOD].map((c) => ({ id: c.id, slug: c.slug, name: c.name, parentId: c.parent_id }))
    const bakery = cats.find((c) => c.slug === 'bakeries-pastry-shops')!
    expect(closeKindsFor(bakery, cats).map((c) => c.slug)).toEqual(['cafes-coffee', 'catering-events-food'])
    expect(closeKindsFor(cats.find((c) => c.slug === 'food-dining')!, cats)).toEqual([])
    expect(closeKindsFor(null, cats)).toEqual([])
    // cafes-coffee lists juice-bars-smoothies, which this list does not have.
    expect(closeKindsFor(cats.find((c) => c.slug === 'cafes-coffee')!, cats).map((c) => c.slug)).toEqual(['bakeries-pastry-shops'])
    expect(joinKinds(['Cafes & Coffee', 'Catering', 'Extra'])).toBe('Cafes & Coffee and Catering')
  })
})

describe('mock planner', () => {
  it('maps a party to the live slugs, not their near misses', () => {
    const live: AssistantAllowList = {
      categories: [
        ['c-f', 'food-dining', null],
        ['c-cb', 'catering-bar-service', 'c-f'],
        ['c-ce', 'catering-events-food', 'c-f'],
        ['c-b', 'bakeries-pastry-shops', 'c-f'],
        ['c-e', 'events-entertainment', null],
        ['c-dj', 'djs-live-music', 'c-e'],
        ['c-v', 'venue-rental', 'c-e'],
        ['c-bf', 'balloon-floral-design', 'c-e'],
        ['c-p', 'photography-videography', null],
        ['c-cp', 'commercial-photography', 'c-p'],
        ['c-ep', 'event-photography', 'c-p'],
      ].map(([id, slug, parentId]) => ({ id: id!, slug: slug!, name: slug!, parentId: parentId ?? null })),
      cities: [{ slug: 'detroit', name: 'Detroit' }],
    }
    const answer = JSON.parse(mockAssistantAnswer('plan a party in Detroit', [], live))
    expect(answer.needs.map((n: Row) => n.category)).toEqual([
      'catering-events-food',
      'djs-live-music',
      'venue-rental',
      'bakeries-pastry-shops',
      'event-photography',
      'balloon-floral-design',
    ])
  })

  it('turns a party into the usual needs and finds the city', () => {
    const answer = JSON.parse(mockAssistantAnswer('plan a party in Detroit with all Black-owned vendors', [], ALLOW))
    expect(answer.city).toBe('detroit')
    expect(answer.needs.map((n: Row) => n.name)).toEqual(['Catering', 'DJ', 'Venue', 'Bakery', 'Photographer', 'Decor'])
    expect(answer.needs.map((n: Row) => n.category)).toEqual(['catering', 'djs', 'event-venues', 'bakeries', 'photographers', 'party-decor'])
  })

  it('reads a follow-up with the city from earlier', () => {
    const answer = JSON.parse(mockAssistantAnswer('what about djs?', ['party in detroit'], ALLOW))
    expect(answer.city).toBe('detroit')
    expect(answer.needs).toEqual([{ name: 'DJ', category: 'djs', keywords: [], open_now: false }])
  })
})

// ─── The action ──────────────────────────────────────────────────────────────

describe('askAssistant', () => {
  const consoleSpies: Array<ReturnType<typeof vi.spyOn>> = []

  beforeEach(() => {
    h.flags.aiAssistant = true
    h.killSwitch = false
    h.provider = 'mock'
    h.rateAllowed = true
    h.withinCeiling = true
    h.used = { visitor_guide: 0, visitor_assistant: 0 }
    h.countedTypes.length = 0
    h.ceilingUsd = 10
    h.inserts.length = 0
    h.updates.length = 0
    h.insertFails = false
    h.rateCalls.length = 0
    h.queryCalls.length = 0
    h.extraCategories = []
    h.search = () => []
    h.lookupPlace.mockReset()
    h.lookupPlace.mockResolvedValue({ place: null, cacheable: true })
    h.callAnthropic.mockReset()
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      consoleSpies.push(vi.spyOn(console, method).mockImplementation(() => {}))
    }
  })

  afterEach(() => {
    for (const spy of consoleSpies) {
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    }
    consoleSpies.length = 0
  })

  it('sends the visitor to plain search when the flag is off', async () => {
    h.flags.aiAssistant = false
    expect(await askAssistant({ message: 'soul food & wings' })).toEqual({
      kind: 'fallback',
      href: '/search?q=soul%20food%20%26%20wings',
      reason: 'error',
    })
    expect(h.rateCalls).toHaveLength(0)
  })

  it('sends the visitor to plain search when the kill switch is on, with no row and no call', async () => {
    h.killSwitch = true
    h.provider = 'anthropic'
    expect((await askAssistant({ message: 'soul food' })).kind).toBe('fallback')
    expect(h.rateCalls).toHaveLength(0)
    expect(h.inserts).toHaveLength(0)
    expect(h.callAnthropic).not.toHaveBeenCalled()
  })

  it('rejects bad input', async () => {
    expect(await askAssistant({ message: '   ' })).toEqual({ kind: 'fallback', href: '/search', reason: 'error' })
    expect((await askAssistant({ message: 'a'.repeat(201) })).kind).toBe('fallback')
    expect(await askAssistant(42)).toEqual({ kind: 'fallback', href: '/search', reason: 'error' })
    expect(h.inserts).toHaveLength(0)
  })

  it('charges 8 a minute and 40 a day per IP and says when the visitor is limited', async () => {
    h.rateAllowed = false
    expect(await askAssistant({ message: 'soul food' })).toEqual({ kind: 'fallback', href: '/search?q=soul%20food', reason: 'limited' })
    expect(h.rateCalls).toEqual([
      { bucket: 'ai_assistant', identifier: 'min:203.0.113.9', limit: 8, windowSeconds: 60 },
      { bucket: 'ai_assistant', identifier: 'day:203.0.113.9', limit: 40, windowSeconds: 86_400 },
    ])
  })

  it('stops paid calls at the monthly ceiling', async () => {
    h.provider = 'anthropic'
    h.withinCeiling = false
    expect(await askAssistant({ message: 'soul food' })).toMatchObject({ kind: 'fallback', reason: 'limited' })
    expect(h.callAnthropic).not.toHaveBeenCalled()
  })

  it('shares one visitor budget with the home guide', async () => {
    h.provider = 'anthropic'
    const share = Math.floor(monthlyCallBudget(10) * 0.4)
    h.used = { visitor_guide: share - 1, visitor_assistant: 1 }
    expect(await askAssistant({ message: 'soul food' })).toMatchObject({ kind: 'fallback', reason: 'limited' })
    expect(h.countedTypes.sort()).toEqual(['visitor_assistant', 'visitor_guide'])
    expect(h.inserts).toHaveLength(0)
  })

  it('plans a party in Detroit: every need, top three by rating, no sponsored cards', async () => {
    h.search = (p) =>
      p.city === 'detroit'
        ? [
            ENTITY(`${p.category}-sponsored`, { sponsored_placement_id: 'sp', avg_rating: 5, review_count: 900 }),
            ENTITY(`${p.category}-one5`, { avg_rating: 5, review_count: 1 }),
            ENTITY(`${p.category}-new`),
            ENTITY(`${p.category}-best`, { avg_rating: 4.8, review_count: 200, cover_image_path: 'covers/best.jpg' }),
            ENTITY(`${p.category}-ok`, { avg_rating: 4.1, review_count: 40 }),
          ]
        : []
    const res = answerOf(await askAssistant({ message: 'Plan a party in Detroit with all Black-owned vendors' }))
    expect(res.heading).toBe('Your list in Detroit')
    expect(res.notice).toBeNull()
    expect(res.needs.map((n) => n.name)).toEqual(['Catering', 'DJ', 'Venue', 'Bakery', 'Photographer', 'Decor'])
    const catering = res.needs[0]!
    expect(catering).toMatchObject({ status: 'found', line: '4 in Detroit', total: 4, seeAllHref: '/discover?category=catering&city=detroit' })
    expect(catering.top.map((c) => c.id)).toEqual(['catering-best', 'catering-one5', 'catering-ok'])
    expect(catering.top[0]).toEqual({
      id: 'catering-best',
      name: 'Place catering-best',
      href: '/detroit/business/catering-best',
      categoryName: 'Soul Food',
      cityLabel: 'Detroit, MI',
      rating: 4.8,
      reviewCount: 200,
      imageSrc: 'https://media.test/covers/best.jpg',
    })
    expect(res.summary).toBe('Found 6 of 6 needs.')
    expect(needCalls().every((c) => c.sort === 'rating' && c.city === 'detroit')).toBe(true)
  })

  it('walks the ladder: found, then a close kind here, then the nearest city, then not listed', async () => {
    h.extraCategories = LIVE_FOOD
    modelSays({
      city: 'detroit',
      needs: [
        { name: 'Soul food', category: 'soul-food' },
        { name: 'Thai', category: 'restaurants', keywords: ['thai'] },
        { name: 'Barber', category: 'barbershops' },
        { name: 'Balloon decor', category: null, keywords: ['balloon'] },
      ],
    })
    h.search = (p) => {
      if (p.category === 'soul-food' && p.city === 'detroit') return [ENTITY('soul')]
      if (p.category === 'food-trucks' && p.city === 'detroit') return [ENTITY('truck1'), ENTITY('truck2')]
      if (p.category === 'barbershops' && p.city === 'chicago') return [ENTITY('chi-barber', { city: { name: 'Chicago', slug: 'chicago', state_abbr: 'IL' } })]
      return []
    }
    const res = answerOf(await askAssistant({ message: 'soul food, thai, a barber and balloon decor in detroit' }))
    expect(res.needs.map((n) => [n.name, n.status, n.line])).toEqual([
      ['Soul food', 'found', '1 in Detroit'],
      ['Thai', 'close', 'No Thai in Detroit yet. Close to it: Food Trucks (2)'],
      ['Barber', 'nearest', 'Not in Detroit yet. Nearest we list: Chicago (1)'],
      ['Balloon decor', 'none', 'Not on The BLACQList yet.'],
    ])
    expect(res.needs[1]!.seeAllHref).toBe('/discover?category=food-trucks&city=detroit')
    expect(res.needs[2]!.seeAllHref).toBe('/discover?category=barbershops&city=chicago')
    expect(res.needs[3]).toMatchObject({ total: 0, top: [], seeAllHref: null })
    expect(res.summary).toBe('Found 1 of 4 needs, 2 with a close option, 1 not listed.')
    // Never the city it was asked about, in the nearest step.
    expect(needCalls().filter((c) => c.category === 'barbershops').map((c) => c.city)).toEqual(['detroit', 'chicago', 'atlanta'])
    // Never the whole food group as a close option: it is only searched by words.
    expect(needCalls().some((c) => c.category === 'food-dining' && !c.q)).toBe(false)
  })

  it('is honest about a place we do not cover and offers the nearest city we do', async () => {
    modelSays({ city: null, place: null, needs: [{ name: 'Thai restaurant', category: 'thai' }] })
    h.lookupPlace.mockResolvedValue({ place: { label: 'Alaska', lat: 61.2, lng: -149.9, zoom: 4 }, cacheable: true })
    h.search = (p) => (p.category === 'thai' && p.city === 'chicago' ? [ENTITY('chi-thai')] : [])
    const res = answerOf(await askAssistant({ message: 'Black-owned Thai restaurant in Alaska' }))
    expect(res.notice).toBe("We don't list businesses in Alaska yet.")
    expect(res.heading).toBe('Thai restaurant')
    expect(res.needs[0]).toMatchObject({ status: 'nearest', line: 'Not in Alaska yet. Nearest we list: Chicago (1)' })
    expect(h.lookupPlace).toHaveBeenCalledTimes(1)
    expect(h.lookupPlace.mock.calls[0]![0]).toBe('Alaska')
  })

  it('narrows a top-level category to the subcategory that fits, and a need named for it is found', async () => {
    h.extraCategories = LIVE_FOOD
    modelSays({
      city: 'detroit',
      needs: [
        { name: 'Catering', category: 'food-dining', keywords: ['catering'] },
        { name: 'Soul food', category: 'food-dining', keywords: ['soul'] },
      ],
    })
    h.search = (p) => {
      if (p.city !== 'detroit') return []
      if (p.category === 'food-dining' && p.q === 'soul') return [ENTITY('soul')]
      if (p.category === 'catering-events-food' && !p.q) return [ENTITY('cater1'), ENTITY('cater2')]
      if (p.category === 'food-dining' && !p.q) return [ENTITY('food1'), ENTITY('food2'), ENTITY('food3')]
      return []
    }
    const res = answerOf(await askAssistant({ message: 'catering and soul food in detroit' }))
    expect(res.needs.map((n) => [n.name, n.status, n.line, n.seeAllHref])).toEqual([
      ['Catering', 'found', '2 in Detroit', '/discover?category=catering-events-food&city=detroit'],
      ['Soul food', 'found', '1 in Detroit', '/search?q=soul&category=food-dining&city=detroit'],
    ])
    expect(needCalls().some((c) => c.category === 'food-dining' && !c.q)).toBe(false)
  })

  it('offers a bakery or a cafe for a cake, never a grocery store', async () => {
    h.extraCategories = LIVE_FOOD
    modelSays({ city: 'detroit', needs: [{ name: 'Birthday cake', category: 'food-dining', keywords: ['cake'] }] })
    h.search = (p) => {
      if (p.city !== 'detroit' || p.q) return []
      if (p.category === 'cafes-coffee') return [ENTITY('cafe1')]
      if (p.category === 'grocery-markets') return [ENTITY('groc1'), ENTITY('groc2')]
      if (p.category === 'food-dining') return [ENTITY('groc1'), ENTITY('cafe1')]
      return []
    }
    const res = answerOf(await askAssistant({ message: 'a birthday cake in detroit' }))
    expect(res.needs[0]).toMatchObject({
      status: 'close',
      line: 'No Birthday cake in Detroit yet. Close to it: Cafes & Coffee (1)',
      seeAllHref: '/discover?category=cafes-coffee&city=detroit',
    })
    expect(res.needs[0]!.top.map((c) => c.id)).toEqual(['cafe1'])
    const asked = needCalls().map((c) => c.category)
    expect(asked).toContain('bakeries-pastry-shops')
    expect(asked).not.toContain('grocery-markets')
    // The food group only ever by words, never as a whole.
    expect(needCalls().filter((c) => c.category === 'food-dining').every((c) => !!c.q)).toBe(true)
  })

  it('never searches on who the business is ("black", "owned", "vendors")', async () => {
    modelSays({
      city: 'detroit',
      needs: [
        { name: 'DJ', category: 'djs-live-music', keywords: ['dj', 'black'] },
        { name: 'Black owned vendors', category: null, keywords: ['black', 'owned', 'vendors'] },
      ],
    })
    await askAssistant({ message: 'a DJ from black owned vendors in detroit' })
    expect(needCalls().every((c) => !/black|owned|vendors/.test(String(c.q ?? '')))).toBe(true)
    expect(needCalls().some((c) => c.q === 'dj')).toBe(true)
  })

  it('finds a listing filed on the parent group by the kind\'s words', async () => {
    h.extraCategories = LIVE_FOOD
    modelSays({ city: 'detroit', needs: [{ name: 'Party cakes', category: 'bakeries-pastry-shops' }] })
    h.search = (p) =>
      p.city === 'detroit' && p.category === 'food-dining' && p.q === 'cake OR cupcake OR pie OR cookie OR bread OR dessert OR pastry OR sweets'
        ? [ENTITY('good-cakes')]
        : []
    const res = answerOf(await askAssistant({ message: 'party cakes in detroit' }))
    expect(res.needs[0]).toMatchObject({
      status: 'found',
      line: '1 in Detroit',
      seeAllHref:
        '/search?q=cake+OR+cupcake+OR+pie+OR+cookie+OR+bread+OR+dessert+OR+pastry+OR+sweets&category=food-dining&city=detroit',
    })
    expect(res.needs[0]!.top.map((c) => c.id)).toEqual(['good-cakes'])
  })

  it('looks in the parent group by the need\'s own words before widening', async () => {
    h.extraCategories = LIVE_FOOD
    modelSays({ city: 'detroit', needs: [{ name: 'Thai', category: 'restaurants', keywords: ['thai'] }] })
    h.search = (p) => (p.city === 'detroit' && p.category === 'food-dining' && p.q === 'thai' ? [ENTITY('thai1')] : [])
    const res = answerOf(await askAssistant({ message: 'thai in detroit' }))
    expect(res.needs[0]).toMatchObject({
      status: 'found',
      seeAllHref: '/search?q=thai&category=food-dining&city=detroit',
    })
  })

  it('finds a close kind filed on the parent group and still names the kind', async () => {
    h.extraCategories = LIVE_FOOD
    modelSays({ city: 'detroit', needs: [{ name: 'Cake', category: 'bakeries-pastry-shops', keywords: ['birthday'] }] })
    h.search = (p) =>
      p.city === 'detroit' && p.category === 'food-dining' && p.q === 'coffee OR latte OR espresso OR tea OR cafe'
        ? [ENTITY('cafe1')]
        : []
    const res = answerOf(await askAssistant({ message: 'birthday cake in detroit' }))
    expect(res.needs[0]).toMatchObject({
      status: 'close',
      line: 'No Cake in Detroit yet. Close to it: Cafes & Coffee (1)',
      seeAllHref: '/search?q=coffee+OR+latte+OR+espresso+OR+tea+OR+cafe&category=food-dining&city=detroit',
    })
  })

  it('names both close kinds and adds their counts when both have listings', async () => {
    h.extraCategories = LIVE_FOOD
    modelSays({ city: 'detroit', needs: [{ name: 'Cake', category: 'bakeries-pastry-shops', keywords: ['cake'] }] })
    h.search = (p) => {
      if (p.city !== 'detroit' || p.q) return []
      if (p.category === 'cafes-coffee') return [ENTITY('cafe1')]
      if (p.category === 'catering-events-food') return [ENTITY('cater1'), ENTITY('cater2')]
      return []
    }
    const res = answerOf(await askAssistant({ message: 'cake in detroit' }))
    expect(res.needs[0]).toMatchObject({
      status: 'close',
      line: 'No Cake in Detroit yet. Close to it: Cafes & Coffee and Catering (3)',
      total: 3,
      seeAllHref: '/discover?category=cafes-coffee&city=detroit',
    })
  })

  it('skips the close step for a kind with no close kinds listed and goes to the nearest city', async () => {
    modelSays({ city: 'detroit', needs: [{ name: 'Thai', category: 'thai' }] })
    h.search = (p) => {
      if (p.category === 'thai' && p.city === 'chicago') return [ENTITY('chi-thai')]
      if (p.category === 'food-dining') return [ENTITY('food1')]
      return []
    }
    const res = answerOf(await askAssistant({ message: 'thai in detroit' }))
    expect(res.needs[0]).toMatchObject({ status: 'nearest', line: 'Not in Detroit yet. Nearest we list: Chicago (1)' })
    expect(needCalls().some((c) => c.category === 'food-dining')).toBe(false)
  })

  it('says the nearest city has the kind, not the thing, when only the kind matches there', async () => {
    h.extraCategories = LIVE_FOOD
    modelSays({ city: null, place: null, needs: [{ name: 'Thai restaurant', category: 'food-dining', keywords: ['thai'] }] })
    h.lookupPlace.mockResolvedValue({ place: { label: 'Alaska', lat: 61.2, lng: -149.9, zoom: 4 }, cacheable: true })
    h.search = (p) => (p.category === 'restaurants' && p.city === 'chicago' && !p.q ? [ENTITY('chi-food')] : [])
    const res = answerOf(await askAssistant({ message: 'Black-owned Thai restaurant in Alaska' }))
    expect(res.needs[0]).toMatchObject({
      status: 'close',
      line: 'No Thai restaurant in Alaska yet. Close to it in Chicago: Restaurants (1)',
      seeAllHref: '/discover?category=restaurants&city=chicago',
    })
    expect(needCalls().some((c) => c.category === 'food-dining' && !c.q)).toBe(false)
  })

  it('never asks search for paid slots', async () => {
    modelSays({ city: 'detroit', needs: [{ name: 'Soul food', category: 'soul-food' }] })
    await askAssistant({ message: 'soul food in detroit' })
    expect(needCalls().length).toBeGreaterThan(0)
    expect(needCalls().every((c) => c.noSponsored === true)).toBe(true)
  })

  it('offers listings elsewhere when the place cannot be put on a map', async () => {
    modelSays({ city: null, place: null, needs: [{ name: 'Thai restaurant', category: 'thai' }] })
    h.search = (p) => (p.category === 'thai' && !p.city ? [ENTITY('t1'), ENTITY('t2')] : [])
    const res = answerOf(await askAssistant({ message: 'thai in alaska' }))
    expect(res.notice).toBe("We don't list businesses in Alaska yet.")
    expect(res.needs[0]).toMatchObject({ status: 'nearest', line: 'Not in Alaska yet. Elsewhere on The BLACQList (2)' })
  })

  it('treats a city we have a row for but have not opened as not covered', async () => {
    modelSays({ city: null, needs: [{ name: 'Soul food', category: 'soul-food' }] })
    h.search = (p) => (p.category === 'soul-food' && p.city === 'detroit' ? [ENTITY('det')] : [])
    const res = answerOf(await askAssistant({ message: 'soul food in grand rapids' }))
    expect(res.notice).toBe("We don't list businesses in Grand Rapids yet.")
    expect(res.needs[0]).toMatchObject({ status: 'nearest', line: 'Not in Grand Rapids yet. Nearest we list: Detroit (1)' })
    expect(h.lookupPlace).not.toHaveBeenCalled()
  })

  it('answers one need like the home guide: up to six cards, name matches not repeated', async () => {
    h.search = (p) =>
      'sort' in p
        ? 'abcdefgh'.split('').map((id) => ENTITY(id, id === 'a' ? { name: 'Soul Food Kitchen' } : {}))
        : [ENTITY('a', { name: 'Soul Food Kitchen' })]
    const res = answerOf(await askAssistant({ message: 'soul food kitchen' }))
    expect(res.heading).toBe('Soul Food')
    expect(res.nameMatches.map((c) => c.id)).toEqual(['a'])
    expect(res.needs[0]!.top.map((c) => c.id)).toEqual(['b', 'c', 'd', 'e', 'f', 'g'])
  })

  it('carries a city across a follow-up from the earlier messages', async () => {
    h.search = (p) => (p.category === 'djs' ? [ENTITY('dj')] : [])
    const res = answerOf(await askAssistant({ message: 'what about DJs?', history: ['plan a party in Detroit'] }))
    expect(res.heading).toBe('DJ in Detroit')
    expect(needCalls()[0]).toMatchObject({ category: 'djs', city: 'detroit' })
  })

  it('sends earlier messages to the model with contact details taken out', async () => {
    modelSays({ city: 'detroit', needs: [{ name: 'DJ', category: 'djs' }] })
    await askAssistant({
      message: 'what about djs',
      history: ['party in detroit, email me@example.test', 'call 404-555-0101 see https://spam.example'],
    })
    const call = h.callAnthropic.mock.calls[0]![0] as { prompt: string; system: string; maxOutputChars: number }
    expect(call.system).toBe(ASSISTANT_SYSTEM_PROMPT)
    expect(call.maxOutputChars).toBe(ASSISTANT_AGENT.maxOutputChars)
    expect(call.prompt).toContain('party in detroit')
    for (const piece of ['me@example.test', '404-555-0101', 'spam.example']) expect(call.prompt).not.toContain(piece)
  })

  it('sends a Near me point to our search only, never to the model', async () => {
    modelSays({ city: null, needs: [{ name: 'Barber', category: 'barbershops' }] })
    h.search = (p) => (p.category === 'barbershops' ? [ENTITY('b1')] : [])
    const res = answerOf(await askAssistant({ message: 'barber', near: { lat: 33.748995, lng: -84.387982 } }))
    const call = h.callAnthropic.mock.calls[0]![0] as { prompt: string; system: string }
    for (const piece of ['33.7', '84.3']) expect(call.prompt + call.system).not.toContain(piece)
    expect(needCalls()[0]).toMatchObject({ category: 'barbershops', lat: 33.749, lng: -84.388, radius: 10, sort: 'distance' })
    expect(res.heading).toBe('Barber near you')
    expect(res.needs[0]!.line).toBe('1 near you')
    expect(JSON.stringify([h.inserts, h.updates])).not.toContain('33.7')
  })

  it('says the answer covers every city when "near me" comes with no location', async () => {
    modelSays({ city: null, needs: [{ name: 'Barber', category: 'barbershops' }] })
    h.search = (p) => (p.category === 'barbershops' ? [ENTITY('b1')] : [])
    const res = answerOf(await askAssistant({ message: 'barber near me', near: null }))
    expect(res.notice).toBe(NO_LOCATION_NOTICE)
    expect(needCalls()[0]).not.toHaveProperty('lat')
    const plain = answerOf(await askAssistant({ message: 'barber', near: null }))
    expect(plain.notice).toBeNull()
  })

  it('answers "near me" alone with no model call and no audit row', async () => {
    h.provider = 'anthropic'
    h.search = () => [ENTITY('n1')]
    const res = answerOf(await askAssistant({ message: 'near me open now', near: { lat: 33.749, lng: -84.388 } }))
    expect(h.callAnthropic).not.toHaveBeenCalled()
    expect(h.inserts).toHaveLength(0)
    expect(needCalls()[0]).toMatchObject({ open_now: true, sort: 'distance' })
    expect(res.heading).toBe('Places near you')
  })

  it('writes one audit row with no visitor text', async () => {
    await askAssistant({ message: 'soul food in Atlanta, call me at 404-555-0101 or me@example.test' })
    expect(h.inserts).toEqual([
      {
        listing_id: null,
        agent_type: 'visitor_assistant',
        prompt_version: 'VISITOR_ASSISTANT@1',
        model: 'mock-v1',
        provider: 'mock',
        status: 'pending',
        created_by: null,
      },
    ])
    expect(h.updates).toEqual([{ status: 'completed' }])
    const written = JSON.stringify([h.inserts, h.updates])
    for (const piece of ['soul', 'Atlanta', '404', 'example.test']) expect(written).not.toContain(piece)
  })

  it('shows name matches, or falls back, when the model fails', async () => {
    h.provider = 'anthropic'
    h.callAnthropic.mockRejectedValue(new ProviderCallError('provider_error'))
    h.search = () => [ENTITY('pc', { name: 'Peach Cobbler Factory' })]
    const res = answerOf(await askAssistant({ message: 'peach cobbler' }))
    expect(res).toMatchObject({ heading: 'Matching names', needs: [], summary: 'Found 1 matching name.' })
    expect(h.updates).toEqual([{ status: 'failed', error_message: 'provider_error' }])

    h.search = () => []
    expect(await askAssistant({ message: 'peach cobbler' })).toEqual({ kind: 'fallback', href: '/search?q=peach%20cobbler', reason: 'error' })
  })

  it('closes the row with a fixed code when the answer does not parse', async () => {
    h.provider = 'anthropic'
    h.callAnthropic.mockResolvedValue({ text: 'Sure! Here are some ideas.', inputTokens: 10, outputTokens: 5 })
    expect((await askAssistant({ message: 'soul food' })).kind).toBe('fallback')
    expect(h.updates).toEqual([{ status: 'failed', error_message: 'output_rejected:invalid_shape', request_tokens: 10, response_tokens: 5 }])
  })

  it('makes no call when the audit row cannot be written', async () => {
    h.provider = 'anthropic'
    h.insertFails = true
    expect((await askAssistant({ message: 'soul food' })).kind).toBe('fallback')
    expect(h.callAnthropic).not.toHaveBeenCalled()
  })

  it('shows a help page when that is all the words point at', async () => {
    const res = answerOf(await askAssistant({ message: 'how do I add my business' }))
    expect(res).toMatchObject({ heading: 'This page may help', needs: [], page: { label: 'Add your business', href: '/add-business' } })
    expect(needCalls()).toHaveLength(0)
  })
})
