// ============================================================================
// lib/search/assist.ts + lib/services/searchAssist.ts: a search never ends in
// a blank (PR 5).
// ============================================================================
//
// Three layers:
//   1. The pure rules: filler words, plurals, places, the category matcher.
//   2. Every related-words key is a real category slug, read from seed.sql and
//      the category migrations, so a renamed category fails here loudly.
//   3. Twenty awkward searches run through the whole ladder against a small
//      fixture database. Each one must come back with something to do next.

import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ASSIST_BELOW,
  editDistance,
  findPlaces,
  looseQuery,
  matchCategories,
  meaningfulWords,
  nearestCity,
  normalizeQuery,
  shouldAssist,
  stem,
  type AssistCategory,
  type AssistCity,
} from '@/lib/search/assist'
import { CATEGORY_KEYWORDS } from '@/lib/search/categoryKeywords'
import type { ResolvedFacetParams } from '@/lib/listings/facets'
import type { ListingsParams } from '@/lib/listings/query'

const REPO_ROOT = path.resolve(__dirname, '..')

// ─── The real category list, read from SQL ──────────────────────────────────

function loadCategories(): AssistCategory[] {
  const files = [
    path.join(REPO_ROOT, 'supabase/seed.sql'),
    ...readdirSync(path.join(REPO_ROOT, 'supabase/migrations'))
      .filter((f) => f.endsWith('.sql'))
      .map((f) => path.join(REPO_ROOT, 'supabase/migrations', f)),
  ]
  // ('<uuid>', 'Name', 'slug', NULL | '<parent uuid>' | '<parent slug>', ...
  const row = /\(\s*'([0-9a-f-]{36})',\s*'((?:[^']|'')+)',\s*'([a-z0-9-]+)',\s*(NULL|'[^']+')/g
  const raw: Array<{ id: string; name: string; slug: string; parent: string | null }> = []
  for (const file of files) {
    const sql = readFileSync(file, 'utf8')
    if (!/INSERT INTO categories/i.test(sql)) continue
    for (const m of sql.matchAll(row)) {
      raw.push({
        id: m[1]!,
        name: m[2]!.replace(/''/g, "'"),
        slug: m[3]!,
        parent: m[4] === 'NULL' ? null : m[4]!.slice(1, -1),
      })
    }
  }
  const bySlug = new Map(raw.map((r) => [r.slug, r]))
  const seen = new Set<string>()
  const out: AssistCategory[] = []
  for (const r of raw) {
    if (seen.has(r.slug)) continue
    seen.add(r.slug)
    const parentId = r.parent == null ? null : /^[0-9a-f-]{36}$/.test(r.parent) ? r.parent : (bySlug.get(r.parent)?.id ?? null)
    out.push({ id: r.id, name: r.name, slug: r.slug, parentId })
  }
  return out
}

const CATEGORIES = loadCategories()
const slugsOf = (matches: ReturnType<typeof matchCategories>) => matches.map((m) => m.category.slug)

// ─── Fixture cities ─────────────────────────────────────────────────────────

const CITIES: AssistCity[] = [
  { id: 'c-atl', name: 'Atlanta', slug: 'atlanta-ga', isActive: true, lat: 33.749, lng: -84.388, stateCode: 'GA' },
  { id: 'c-chi', name: 'Chicago', slug: 'chicago-il', isActive: true, lat: 41.878, lng: -87.63, stateCode: 'IL' },
  { id: 'c-hou', name: 'Houston', slug: 'houston-tx', isActive: true, lat: 29.76, lng: -95.37, stateCode: 'TX' },
  { id: 'c-dc', name: 'Washington', slug: 'washington-dc', isActive: true, lat: 38.907, lng: -77.037, stateCode: 'DC' },
  { id: 'c-det', name: 'Detroit', slug: 'detroit-mi', isActive: false, lat: 42.331, lng: -83.046, stateCode: 'MI' },
  { id: 'c-nyc', name: 'New York', slug: 'new-york-ny', isActive: false, lat: 40.713, lng: -74.006, stateCode: 'NY' },
  { id: 'c-nola', name: 'New Orleans', slug: 'new-orleans-la', isActive: true, lat: 29.951, lng: -90.072, stateCode: 'LA' },
]

// ─── 1. Pure rules ──────────────────────────────────────────────────────────

describe('normalizeQuery and stem', () => {
  it('lowercases, strips accents, apostrophes and symbols', () => {
    expect(normalizeQuery("  Mother's Day Café!! ")).toBe('mothers day cafe')
    expect(normalizeQuery('🍕🍕')).toBe('')
  })

  it('caps very long input', () => {
    expect(normalizeQuery('a'.repeat(5000)).length).toBeLessThanOrEqual(300)
  })

  it('folds the plurals people type', () => {
    expect(stem('plumbers')).toBe('plumber')
    expect(stem('braids')).toBe('braid')
    expect(stem('classes')).toBe('class')
    expect(stem('therapies')).toBe('therapy')
    expect(stem('dress')).toBe('dress')
    expect(stem('bus')).toBe('bus')
  })
})

describe('meaningfulWords and looseQuery', () => {
  it('drops the filler from a question', () => {
    expect(meaningfulWords('How do I travel solo to Japan?')).toEqual(['travel', 'solo', 'japan'])
    expect(meaningfulWords('best plumber near me open now')).toEqual(['plumber'])
  })

  it('treats "black owned" as filler, since every listing is', () => {
    expect(meaningfulWords('black owned')).toEqual([])
    expect(meaningfulWords('Black-owned bakery')).toEqual(['bakery'])
  })

  it('drops ZIP codes, single letters and repeats, and keeps at most six', () => {
    expect(meaningfulWords('barber 30303 x barbers')).toEqual(['barber'])
    expect(meaningfulWords('one two three four five six seven eight nine ten')).toHaveLength(6)
  })

  it('builds an any-of search, or nothing', () => {
    expect(looseQuery(['travel', 'solo'])).toBe('travel OR solo')
    expect(looseQuery([])).toBeNull()
  })
})

describe('shouldAssist', () => {
  const base = { q: 'plumber', total: 0, page: 1 }
  it('helps a thin first page of a real search', () => {
    expect(shouldAssist(base)).toBe(true)
    expect(shouldAssist({ ...base, total: ASSIST_BELOW - 1 })).toBe(true)
  })
  it('stays out of the way otherwise', () => {
    expect(shouldAssist({ ...base, total: ASSIST_BELOW })).toBe(false)
    expect(shouldAssist({ ...base, page: 2 })).toBe(false)
    expect(shouldAssist({ ...base, q: '   ' })).toBe(false)
    expect(shouldAssist({ ...base, q: undefined })).toBe(false)
  })
  it('never talks over a filter that could not run', () => {
    expect(shouldAssist({ ...base, radiusUnavailable: true })).toBe(false)
    expect(shouldAssist({ ...base, filtersUnavailable: true })).toBe(false)
  })
})

describe('findPlaces', () => {
  it('reads a live city and takes it out of the search', () => {
    const { places, rest } = findPlaces('barber Atlanta', CITIES)
    expect(places).toHaveLength(1)
    expect(places[0]!.activeCities.map((c) => c.slug)).toEqual(['atlanta-ga'])
    expect(rest).toBe('barber')
  })

  it('knows the nicknames people type', () => {
    expect(findPlaces('wings atl', CITIES).places[0]!.label).toBe('Atlanta')
    expect(findPlaces('nola brunch', CITIES).places[0]!.label).toBe('New Orleans')
    expect(findPlaces('lawyer dmv', CITIES).places[0]!.label).toBe('Washington')
  })

  it('reads a city we do not cover yet as uncovered', () => {
    const { places, rest } = findPlaces('plumber detroit', CITIES)
    expect(places[0]!.label).toBe('Detroit')
    expect(places[0]!.activeCities).toEqual([])
    expect(rest).toBe('plumber')
  })

  it('reads a state by name, never by a bare code', () => {
    expect(findPlaces('plumber ohio', CITIES).places[0]!.label).toBe('Ohio')
    expect(findPlaces('plumber georgia', CITIES).places[0]!.activeCities.map((c) => c.slug)).toEqual(['atlanta-ga'])
    // "in", "me", "or", "ok" are codes and words. Words win.
    expect(findPlaces('open now in me or ok', CITIES).places).toEqual([])
  })

  it('reads Washington State apart from Washington, DC', () => {
    expect(findPlaces('coffee washington state', CITIES).places[0]!.label).toBe('Washington State')
  })

  it('does not read tai chi as Chicago', () => {
    expect(findPlaces('tai chi class', CITIES).places).toEqual([])
  })
})

describe('nearestCity', () => {
  it('finds the closest live city, never an inactive one', () => {
    const fromDetroit = nearestCity({ lat: 42.331, lng: -83.046 }, CITIES)
    expect(fromDetroit!.city.slug).toBe('chicago-il')
    expect(fromDetroit!.miles).toBeGreaterThan(200)
    expect(fromDetroit!.miles).toBeLessThan(260)
  })
  it('returns null with nothing live', () => {
    expect(nearestCity({ lat: 0, lng: 0 }, CITIES.filter((c) => !c.isActive))).toBeNull()
  })
})

describe('editDistance', () => {
  it('counts edits and stops early', () => {
    expect(editDistance('plumber', 'plumbr', 1)).toBe(1)
    expect(editDistance('barber', 'barbre', 2)).toBe(2)
    expect(editDistance('abc', 'xyzxyz', 1)).toBe(2)
  })
})

describe('matchCategories', () => {
  it('matches a category by its name, plural or not', () => {
    expect(slugsOf(matchCategories('barbers', CATEGORIES))).toContain('barber-shops')
    expect(slugsOf(matchCategories('dentist', CATEGORIES))[0]).toBe('dentists')
  })

  it('matches by related words', () => {
    expect(slugsOf(matchCategories('how do I travel solo to Japan', CATEGORIES))).toContain('travel-agencies')
    expect(slugsOf(matchCategories('plumber near me', CATEGORIES))).toContain('plumbing')
    expect(slugsOf(matchCategories('SAT prep', CATEGORIES))).toContain('test-preparation')
  })

  it('forgives typos', () => {
    expect(slugsOf(matchCategories('plumbr', CATEGORIES))).toContain('plumbing')
    expect(slugsOf(matchCategories('resturant', CATEGORIES))).toContain('restaurants')
  })

  it('matches a related phrase only when the whole phrase is there', () => {
    expect(slugsOf(matchCategories('my water heater broke', CATEGORIES))).toContain('plumbing')
    expect(slugsOf(matchCategories("gift for mother's day", CATEGORIES))).toContain('gift-shops')
  })

  it('offers nothing for nonsense or filler, and at most four', () => {
    expect(matchCategories('asdfgh', CATEGORIES)).toEqual([])
    expect(matchCategories('black owned near me', CATEGORIES)).toEqual([])
    expect(matchCategories('food hair fitness clothing plumber lawyer', CATEGORIES).length).toBeLessThanOrEqual(4)
  })
})

// ─── 2. Every related-words key is a real category ─────────────────────────

describe('categoryKeywords.ts', () => {
  it('found the category list in seed.sql and the migrations', () => {
    expect(CATEGORIES.length).toBeGreaterThan(150)
  })

  it('uses only real category slugs', () => {
    const real = new Set(CATEGORIES.map((c) => c.slug))
    const missing = Object.keys(CATEGORY_KEYWORDS).filter((slug) => !real.has(slug))
    expect(missing).toEqual([])
  })
})

// ─── 3. The whole ladder against a fixture database ────────────────────────

// Published listings in the fixture, as the words they would match.
const LISTINGS: Array<{ id: string; text: string; city: string; online?: boolean }> = [
  { id: 'l-1', text: 'sweet auburn barbers barber fade', city: 'atlanta-ga' },
  { id: 'l-2', text: 'peach state plumbing plumber drain', city: 'atlanta-ga' },
  { id: 'l-3', text: 'southside plumbing plumber', city: 'chicago-il' },
  { id: 'l-4', text: 'gumbo house restaurant creole', city: 'new-orleans-la' },
  { id: 'l-5', text: 'smile dental dentist', city: 'houston-tx' },
  { id: 'l-6', text: 'kente gift shop gift', city: 'washington-dc' },
  { id: 'l-7', text: 'wanderlust group travel tours', city: 'atlanta-ga', online: true },
  { id: 'l-8', text: 'soul food kitchen restaurant', city: 'atlanta-ga' },
]

// National counts by category slug. Travel Agencies stays at zero on purpose.
const NATIONAL: Record<string, number> = {
  'food-dining': 80,
  restaurants: 40,
  'beauty-grooming': 60,
  'barber-shops': 12,
  plumbing: 3,
  dentists: 2,
  'gift-shops': 5,
  'travel-agencies': 0,
}

const parse = (q: string | null) =>
  q ? q.toLowerCase().split(/\s+or\s+|\s+/).filter((w) => w && w !== 'or') : []

function matches(q: string | null, mode: 'any' | 'all', where: { city?: string | null; online?: boolean }) {
  const words = parse(q).map((w) => w.replace(/s$/, ''))
  return LISTINGS.filter((l) => {
    if (where.city && l.city !== where.city) return false
    if (where.online && !l.online) return false
    if (words.length === 0) return true
    const hit = (w: string) => l.text.includes(w)
    return mode === 'any' ? words.some(hit) : words.every(hit)
  })
}

const supabaseMock = {
  from(table: string) {
    const data =
      table === 'categories'
        ? CATEGORIES.map((c, i) => ({ id: c.id, name: c.name, slug: c.slug, parent_id: c.parentId, display_order: i }))
        : CITIES.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            is_active: c.isActive,
            latitude: c.lat == null ? null : String(c.lat),
            longitude: c.lng,
            states: { code: c.stateCode },
          }))
    const result = Promise.resolve({ data, error: null })
    const chain = { eq: () => result, then: result.then.bind(result) }
    return { select: () => chain }
  },
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabaseMock }))

vi.mock('@/lib/listings/query', () => ({
  queryListings: vi.fn(async (p: ListingsParams) => {
    const hits = matches(p.q ?? null, / OR /.test(p.q ?? '') ? 'any' : 'all', { city: p.city })
    return {
      entities: hits.map((h) => ({ id: h.id, name: h.text })),
      total: hits.length,
      page: 1,
      pageSize: 24,
    }
  }),
}))

vi.mock('@/lib/listings/facets', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/listings/facets')>()
  return {
    ...real,
    resolveFacetParams: vi.fn(async (_s: unknown, raw: { city?: string; lat?: number; lng?: number; radius?: number }) => ({
      params: {
        p_city_id: raw.city ?? null,
        p_lat: raw.lat ?? null,
        p_lng: raw.lng ?? null,
        p_radius_miles: raw.radius ?? null,
      } as Partial<ResolvedFacetParams>,
      unresolved: {},
    })),
    getFacetCounts: vi.fn(async (_s: unknown, r: ResolvedFacetParams) => ({
      attribute: {},
      price: {},
      openNow: 0,
      // A place shows half of each national count, rounded down.
      category: r.p_city_id || r.p_lat != null
        ? Object.fromEntries(Object.entries(NATIONAL).map(([k, v]) => [k, Math.floor(v / 2)]))
        : NATIONAL,
    })),
    searchFacetedIds: vi.fn(async (_s: unknown, r: ResolvedFacetParams) => {
      const hits = matches(r.p_q, / OR /.test(r.p_q ?? '') ? 'any' : 'all', {
        online: !!r.p_location_types?.includes('virtual'),
      })
      return { ids: hits.slice(0, 1).map((h) => h.id), total: hits.length, error: false }
    }),
  }
})

const { getSearchAssist } = await import('@/lib/services/searchAssist')

async function runSearch(q: string, extra: Partial<ListingsParams> = {}) {
  const params: ListingsParams = { q, ...extra }
  // No fixture listing sits inside a radius search, so those find nothing.
  const hits = extra.lat != null ? [] : matches(q, 'all', { city: extra.city })
  return getSearchAssist({ params, exactIds: hits.map((h) => h.id), exactTotal: hits.length })
}

type Assist = Awaited<ReturnType<typeof getSearchAssist>>
function helpful(a: Assist): boolean {
  return !!(
    a.close ||
    a.chips.length ||
    a.gaps.length ||
    a.uncovered.length ||
    a.nearestToYou ||
    a.elsewhere ||
    a.online ||
    (a.explore && (a.explore.categories.length || a.explore.cities.length))
  )
}

describe('getSearchAssist: twenty awkward searches', () => {
  beforeEach(() => vi.clearAllMocks())

  const AWKWARD: Array<[string, Partial<ListingsParams>?]> = [
    ['How do I travel solo to Japan?'],
    ['plumber near me'],
    ['black owned'],
    ['gift for my mom'],
    ['asdfgh'],
    ['🍕🍕🍕'],
    ['x'.repeat(300)],
    ['plumbr'],
    ['barbers'],
    ['plumber detroit'],
    ['plumber ohio'],
    ['coffee washington state'],
    ['barber atl'],
    ['vegan soul food wedding catering'],
    ['tai chi class'],
    ['30303'],
    ['?!'],
    ['restaurant', { city: 'houston-tx' }],
    ['dentist', { lat: 32.84, lng: -83.63, radius: 25 }],
    ['the best of the best'],
  ]

  it.each(AWKWARD)('%s gets something to do next', async (q, extra) => {
    expect(helpful(await runSearch(q, extra))).toBe(true)
  })

  it('travel solo: says plainly we have no travel agencies yet', async () => {
    const a = await runSearch('How do I travel solo to Japan?')
    expect(a.gaps).toContain('Travel Agencies')
    expect(a.chips.map((c) => c.slug)).not.toContain('travel-agencies')
    expect(a.close?.words).toEqual(['travel', 'solo', 'japan'])
    expect(a.close?.entities.map((e) => e.id)).toEqual(['l-7'])
  })

  it('plumber near me: offers Plumbing with its real count', async () => {
    const a = await runSearch('plumber near me')
    const chip = a.chips.find((c) => c.slug === 'plumbing')
    expect(chip?.nationalCount).toBe(3)
    expect(chip?.href).toBe('/discover?category=plumbing')
  })

  it('black owned: no words left, so it shows ways to explore', async () => {
    const a = await runSearch('black owned')
    expect(a.close).toBeNull()
    expect(a.explore?.cities.map((c) => c.slug)).toContain('atlanta-ga')
    expect(a.explore?.cities.map((c) => c.slug)).not.toContain('detroit-mi')
    expect(a.explore?.categories[0]?.slug).toBe('food-dining')
  })

  it('plumber detroit: names the gap and the nearest city we cover', async () => {
    const a = await runSearch('plumber detroit')
    expect(a.uncovered).toEqual([
      { label: 'Detroit', nearest: expect.objectContaining({ name: 'Chicago', href: '/discover/chicago-il' }) },
    ])
  })

  it('barber atl: scopes the follow-ups to Atlanta', async () => {
    const a = await runSearch('barber atl')
    expect(a.scopeLabel).toBe('in Atlanta')
    const chip = a.chips.find((c) => c.slug === 'barber-shops')
    expect(chip?.localCount).toBe(6)
    expect(chip?.href).toBe('/discover?category=barber-shops&city=atlanta-ga')
  })

  it('a radius with nothing in it points at the nearest live city', async () => {
    const a = await runSearch('dentist', { lat: 32.84, lng: -83.63, radius: 25 })
    expect(a.scopeLabel).toBe('within 25 miles')
    expect(a.nearestToYou?.name).toBe('Atlanta')
    expect(a.nearestToYou!.miles).toBeGreaterThan(25)
    expect(a.elsewhere).toEqual({ count: 1, href: '/search?q=dentist' })
  })

  it('never repeats a listing the exact search already showed', async () => {
    const a = await runSearch('soul food restaurant')
    const shown = matches('soul food restaurant', 'all', {}).map((h) => h.id)
    expect(shown).toEqual(['l-8'])
    expect(a.close?.entities.map((e) => e.id) ?? []).not.toContain('l-8')
  })

  it('keeps the page filters on the looser search', async () => {
    const { queryListings } = await import('@/lib/listings/query')
    await runSearch('vegan soul food', { category: 'restaurants', price: ['$$'] })
    expect(queryListings).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'vegan OR soul OR food', category: 'restaurants', price: ['$$'], page: 1 })
    )
  })
})
