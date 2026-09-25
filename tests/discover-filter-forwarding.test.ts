// =============================================================================
// Discover filter forwarding
// =============================================================================
// Three server pages read the same query string: /discover, /discover/[citySlug]
// and /search. They had drifted — /discover forwarded the full facet set while
// the other two forwarded q, type and category and dropped the rest in silence.
// Nothing errored; the page just answered wider than the address bar said, under
// the filter chips the visitor had just clicked.
//
// Half of this file is behavioral (parseDiscoverParams, buildLocationEscapeUrls
// are pure functions, so test them directly). The other half is a source
// contract, because "this page forwards every key" is a property of the call
// site and cannot be observed without rendering a Server Component against a
// live Supabase client.
// =============================================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

import {
  buildLocationEscapeUrls,
  canonicalOpenNowQuery,
  parseDiscoverParams,
  parsePage,
  type DiscoverSearchParams,
} from '@/lib/listings/discover-params'

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

const PAGES = {
  discover: 'app/(public)/discover/page.tsx',
  city: 'app/(public)/discover/[citySlug]/page.tsx',
  search: 'app/(public)/search/page.tsx',
} as const

/** A URL carrying one of every key a discover-style page reads. */
const EVERY_KEY: DiscoverSearchParams = {
  q: 'barber',
  type: 'business',
  category: 'beauty',
  city: 'atlanta',
  trust_tier: 'verified',
  location_type: 'storefront,mobile',
  ownership: 'ally',
  price: '$,$$',
  attrs: 'wheelchair-accessible',
  open_now: '1',
  lat: '33.749',
  lng: '-84.388',
  radius: '10',
  sort: 'distance',
  page: '3',
}

describe('parseDiscoverParams — every key reaches queryListings', () => {
  it('maps the full param set, not just q/type/category', () => {
    const r = parseDiscoverParams(EVERY_KEY)
    expect(r).toMatchObject({
      q: 'barber',
      type: 'business',
      category: 'beauty',
      city: 'atlanta',
      trust_tier: 'verified',
      ownership: 'ally',
      open_now: true,
      lat: 33.749,
      lng: -84.388,
      radius: 10,
      sort: 'distance',
      page: 3,
    })
  })

  it('splits the CSV keys rather than passing the raw string through', () => {
    const r = parseDiscoverParams(EVERY_KEY)
    expect(r.location_type).toEqual(['storefront', 'mobile'])
    expect(r.price).toEqual(['$', '$$'])
    expect(r.attrs).toEqual(['wheelchair-accessible'])
  })

  // An unrecognised CSV entry must survive to the query and return nothing.
  // Dropping it here would turn ?location_type=nonsense into no filter at all
  // and answer with the whole directory under the caller's filter chip.
  it('does not silently drop an unknown CSV value', () => {
    expect(parseDiscoverParams({ location_type: 'nonsense' }).location_type).toEqual(['nonsense'])
  })

  it('leaves a CSV key undefined when it is absent or empty', () => {
    expect(parseDiscoverParams({}).price).toBeUndefined()
    expect(parseDiscoverParams({ price: '' }).price).toBeUndefined()
    expect(parseDiscoverParams({ price: ',,' }).price).toBeUndefined()
  })

  it('reads open_now only from the affirmative spellings', () => {
    expect(parseDiscoverParams({ open_now: '1' }).open_now).toBe(true)
    expect(parseDiscoverParams({ open_now: 'true' }).open_now).toBe(true)
    expect(parseDiscoverParams({ open_now: '0' }).open_now).toBe(false)
    expect(parseDiscoverParams({}).open_now).toBe(false)
  })

  // The homepage "Open now" pill linked to ?open=now, which the parser never
  // read, so the pill opened an unfiltered directory.
  it('accepts the legacy open=now alias', () => {
    expect(parseDiscoverParams({ open: 'now' }).open_now).toBe(true)
    expect(parseDiscoverParams({ open: 'later' }).open_now).toBe(false)
  })

  // A partial or out-of-range triple is dropped whole: the RPC reads a NULL
  // radius as "no radius filter" and would answer the entire directory under a
  // Near You label.
  it('drops a partial location triple whole', () => {
    const r = parseDiscoverParams({ lat: '33.749', radius: '10' })
    expect(r.lat).toBeUndefined()
    expect(r.lng).toBeUndefined()
    expect(r.radius).toBeUndefined()
  })

  // NULLS LAST makes an uncoordinated distance sort fall through to the next
  // ORDER BY key, so the page would claim a proximity order it never applied.
  it('drops sort=distance when the coordinates are gone', () => {
    expect(parseDiscoverParams({ sort: 'distance' }).sort).toBeUndefined()
    expect(parseDiscoverParams({ ...EVERY_KEY }).sort).toBe('distance')
  })

  it('keeps every other sort key without coordinates', () => {
    for (const sort of ['relevance', 'rating', 'reviews', 'newest', 'name', 'saves']) {
      expect(parseDiscoverParams({ sort }).sort).toBe(sort)
    }
  })

  it('only asks for facet counts when the caller renders a sidebar', () => {
    expect(parseDiscoverParams(EVERY_KEY).withFacets).toBeUndefined()
    expect(parseDiscoverParams(EVERY_KEY, { withFacets: true }).withFacets).toBe(true)
  })
})

describe('canonicalOpenNowQuery', () => {
  it('leaves canonical and absent spellings alone', () => {
    expect(canonicalOpenNowQuery({ open_now: '1' })).toBeNull()
    expect(canonicalOpenNowQuery({})).toBeNull()
    expect(canonicalOpenNowQuery({ q: 'tacos', open_now: '0' })).toBeNull()
  })

  it('rewrites open=now and open_now=true to open_now=1, keeping other keys', () => {
    expect(canonicalOpenNowQuery({ open: 'now' })).toBe('?open_now=1')
    expect(canonicalOpenNowQuery({ open_now: 'true' })).toBe('?open_now=1')
    const kept = canonicalOpenNowQuery({ open: 'now', q: 'tacos', page: '2' })
    expect(Object.fromEntries(new URLSearchParams(kept!))).toEqual({
      open_now: '1',
      q: 'tacos',
      page: '2',
    })
  })

  it('drops an unrecognised open value instead of looping', () => {
    const once = canonicalOpenNowQuery({ open: 'later', q: 'tacos' })
    expect(once).toBe('?q=tacos')
    expect(canonicalOpenNowQuery(Object.fromEntries(new URLSearchParams(once!)))).toBeNull()
  })
})

describe('parsePage', () => {
  it('is 1-based and never below 1', () => {
    expect(parsePage(undefined)).toBe(1)
    expect(parsePage('0')).toBe(1)
    expect(parsePage('-3')).toBe(1)
    expect(parsePage('nonsense')).toBe(1)
    expect(parsePage('4')).toBe(4)
  })
})

describe('buildLocationEscapeUrls', () => {
  const located = { lat: '33.749', lng: '-84.388', radius: '10' }

  it('offers nothing when there is no location to escape', () => {
    expect(buildLocationEscapeUrls({ q: 'barber' }, '/discover')).toEqual({})
  })

  it('widens the radius and keeps the rest of the search', () => {
    const { widerRadiusUrl } = buildLocationEscapeUrls({ ...located, q: 'barber' }, '/discover')
    expect(widerRadiusUrl).toContain('q=barber')
    expect(widerRadiusUrl).toMatch(/radius=(?!10\b)\d+/)
  })

  it('drops all three location keys on the clear link', () => {
    const { clearLocationUrl } = buildLocationEscapeUrls({ ...located, q: 'barber' }, '/discover')
    expect(clearLocationUrl).toContain('q=barber')
    expect(clearLocationUrl).not.toContain('lat=')
    expect(clearLocationUrl).not.toContain('lng=')
    expect(clearLocationUrl).not.toContain('radius=')
  })

  it('drops the distance sort along with the coordinates it sorted by', () => {
    const { clearLocationUrl } = buildLocationEscapeUrls(
      { ...located, sort: 'distance' },
      '/discover'
    )
    expect(clearLocationUrl).not.toContain('distance')
  })

  it('keeps a sort that does not depend on the coordinates', () => {
    const { clearLocationUrl } = buildLocationEscapeUrls(
      { ...located, sort: 'rating' },
      '/discover'
    )
    expect(clearLocationUrl).toContain('sort=rating')
  })

  // buildPageUrl returns an empty string when nothing is left in the query,
  // which is the ordinary case here since location is usually the only filter,
  // and an empty href renders as nothing at all. The empty state would be a
  // dead end under copy promising a way out.
  it('never returns an empty href', () => {
    const { clearLocationUrl } = buildLocationEscapeUrls(located, '/discover')
    expect(clearLocationUrl).toBe('/discover')
  })

  it('falls back to the caller’s base path, not a hardcoded /discover', () => {
    const { clearLocationUrl } = buildLocationEscapeUrls(located, '/discover/atlanta')
    expect(clearLocationUrl).toBe('/discover/atlanta')
  })

  it('has no wider link at the widest radius', () => {
    const { widerRadiusUrl } = buildLocationEscapeUrls({ ...located, radius: '500' }, '/discover')
    expect(widerRadiusUrl).toBeUndefined()
  })
})

describe('all three pages forward through the shared parse', () => {
  for (const [name, path] of Object.entries(PAGES)) {
    const src = read(path)

    it(`${name} hands searchParams to parseDiscoverParams`, () => {
      expect(src).toContain('parseDiscoverParams(params')
    })

    // The regression this file exists to prevent: a page rebuilding its own
    // object literal for queryListings and forgetting half the keys.
    it(`${name} does not hand-map its own param object to queryListings`, () => {
      const call = src.match(/queryListings\(([\s\S]*?)\n\s*\)/)?.[1] ?? src
      expect(call).toContain('parseDiscoverParams')
    })

    it(`${name} declares the shared DiscoverSearchParams key set`, () => {
      expect(src).toContain('DiscoverSearchParams')
    })
  }
})

describe('all three pages surface the unavailable states', () => {
  for (const [name, path] of Object.entries(PAGES)) {
    const src = read(path)

    // An RPC that could not run returns zero rows. Without these props the grid
    // renders the ordinary empty state, and "we could not answer" reads to the
    // visitor as "there is nothing".
    it(`${name} passes radiusUnavailable and filtersUnavailable to the grid`, () => {
      expect(src).toContain('radiusUnavailable={result.radiusUnavailable')
      expect(src).toContain('filtersUnavailable={result.filtersUnavailable')
    })

    it(`${name} gives every unavailable state a way out`, () => {
      expect(src).toContain('widerRadiusUrl={widerRadiusUrl}')
      expect(src).toContain('clearLocationUrl={clearLocationUrl}')
      expect(src).toContain('clearFiltersUrl=')
    })

    it(`${name} builds its escape links from the shared builder`, () => {
      expect(src).toContain('buildLocationEscapeUrls(params')
    })
  }
})

describe('DiscoveryGrid dispatch order', () => {
  const src = read('components/discovery/DiscoveryGrid.tsx')

  it('renders a dedicated state for each unavailable cause', () => {
    expect(src).toContain('function RadiusUnavailableState')
    expect(src).toContain('function FiltersUnavailableState')
  })

  // Both arrive with zero entities. If the empty check ran first it would win
  // every time and the states would be unreachable.
  it('checks both unavailable flags before the empty check', () => {
    const radius = src.indexOf('if (radiusUnavailable)')
    const filters = src.indexOf('if (filtersUnavailable)')
    const empty = src.indexOf('if (entities.length === 0)')
    expect(radius).toBeGreaterThan(-1)
    expect(filters).toBeGreaterThan(-1)
    expect(empty).toBeGreaterThan(filters)
    expect(empty).toBeGreaterThan(radius)
  })

  it('announces both as alerts', () => {
    for (const fn of ['RadiusUnavailableState', 'FiltersUnavailableState']) {
      const body = src.slice(src.indexOf(`function ${fn}`), src.indexOf(`function ${fn}`) + 900)
      expect(body).toContain('role="alert"')
    }
  })
})

describe('the fallback query cannot answer a deep facet', () => {
  const src = read('lib/listings/query.ts')

  // legacyFacetedIds honors only the scalar filters — it cannot express
  // haversine, attribute membership, price bands or open-now at all. Falling
  // back under one of those hands the visitor a WIDER result set than the chips
  // beside it claim.
  it('gates the fallback on the whole deep-facet set, not just radius', () => {
    expect(src).toContain('searchResult.error && !deepFilter')
    expect(src).toContain('const deepRpcFailed = !!searchResult.error && deepFilter')
  })

  it('defines deepFilter as all four deep facets', () => {
    const def = src.match(/const deepFilter = !!\(([\s\S]*?)\)\n/)?.[1] ?? ''
    for (const facet of ['p_attribute_values', 'p_price_ranges', 'p_open_now', 'radiusActive']) {
      expect(def).toContain(facet)
    }
  })

  it('reports radius over filters when a request carries both', () => {
    expect(src).toContain(
      'deepRpcFailed ? (radiusActive ? { radiusUnavailable: true } : { filtersUnavailable: true })'
    )
  })
})

describe('absent facet counts do not impersonate zero', () => {
  // The sidebar disables any control whose count is 0, so an all-zero object
  // greys out the entire panel and tells the visitor that every filter in the
  // directory matches nothing.
  it('getFacetCounts flags an unreachable RPC', () => {
    const src = read('lib/listings/facets.ts')
    expect(src).toContain('countsUnavailable: true')
  })

  it('the unresolved-slug short circuit flags it too', () => {
    expect(read('lib/listings/query.ts')).toContain('countsUnavailable: true')
  })

  it('FacetSidebar keeps its controls live and drops the badges', () => {
    const src = read('components/discovery/FacetSidebar.tsx')
    expect(src).toContain('counts.countsUnavailable === true')
    // Every disabled computation and every count badge is guarded.
    expect(src).not.toMatch(/const disabled = !isActive && n === 0/)
    // The guard may be followed by further conditions (the Type badges also
    // skip the active button), as long as it leads the expression.
    expect(src).not.toMatch(/(?<!\{!countsOff && [^{}<]*)<CountTag/)
  })
})

describe('the map honors the same flag guard as every list path', () => {
  const src = read('app/api/map/listings/route.ts')

  // A listing flagged inactive, duplicate, incorrect or spam disappears from
  // every grid and used to stay on the map as a pin — the one surface a visitor
  // is most likely to drive to.
  it('excludes flagged listings', () => {
    expect(src).toContain(".eq('flag_status', 'none')")
  })

  it('still excludes unpublished and deleted listings', () => {
    expect(src).toContain(".eq('status', 'published')")
    expect(src).toContain(".is('deleted_at', null)")
  })
})
