// =============================================================================
// Checkpoints 1.16 + 1.17 — /api/search honors deep facets, and rejects slugs
// that do not exist instead of silently dropping the filter
// =============================================================================
// Measured on production before this change [Measured — /api/search, 2026-08-11]
// against a corpus of 254 published listings:
//
//   ?attrs=<any slug, real or invented>  → 254   (facet ignored entirely)
//   ?price=$$  ·  ?open_now=1            → 254   (facet ignored entirely)
//   ?city=definitely-not-a-city-xyz      → 254   (filter silently dropped)
//   ?category=definitely-not-a-cat-xyz   → 254   (filter silently dropped)
//
// Both defects answered 200 with a result set that looks valid, which is worse
// than an error — a caller cannot tell "254 listings match" apart from "your
// filter was thrown away."
//
// What these tests pin down:
//   * an unknown city / category / attribute slug raises UnknownFilterValueError,
//     which the route turns into 400 UNKNOWN_FILTER_VALUE (api.md envelope)
//   * a KNOWN city still resolves and still filters — the fix must not turn
//     every filter into an error
//   * attrs / price / open_now actually route through search_listings_faceted
//     and the returned page is the RPC's ids, in the RPC's order
//   * a request with no deep facet and no query takes the untouched PostgREST
//     path and never calls the faceted RPC
//
// AMENDED 2026-09-22 (20260922000000_search_recall.sql). Two tests here used to
// assert that a `q` request ran textSearch() on the listings table and then
// patched thin results through a separate search_by_similarity RPC. That was a
// SECOND definition of "what matches", parallel to the one /discover uses
// through search_listings_faceted, and the two had drifted: the founder's
// "dentist" query returned nothing on this path while the function was the
// thing being fixed. Recall now lives in exactly one place. What replaces those
// two assertions:
//   * a `q` request routes through search_listings_faceted with p_q set
//   * search_by_similarity is never called from anywhere
// The second one is the guard. Reintroducing a side path would make a query
// mean two different things depending on which page asked, which is the defect
// this amendment closes rather than a style preference.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const CITY_CHICAGO = 'city-chi-0000'
const CAT_FOOD = 'cat-food-0000'
/** A Food & Dining subcategory. Type and category filters must reach it. */
const CAT_FOOD_CHILD = 'cat-food-bake'
const CAT_RETAIL = 'cat-retail-000'
const ATTR_BLACK_WOMAN = 'attr-bwo-0000'

const h = vi.hoisted(() => ({
  /** Every table query issued, with the filters that were chained onto it. */
  queries: [] as Array<{ table: string; calls: unknown[][] }>,
  /** Every rpc() call: [fn, args]. */
  rpcs: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  /** Rows the faceted RPC should return, as {id, total_count}. */
  facetedRows: [] as Array<{ id: string; total_count: number }>,
  facetedError: null as { message: string } | null,
}))

/**
 * Five published listings across two cities. All are `business`, like prod. l5
 * sits in a Food & Dining subcategory, and l4 works online only.
 */
const CORPUS = [
  row('l1', 'Ada Bakery', CITY_CHICAGO, CAT_FOOD),
  row('l2', 'Baldwin Books', CITY_CHICAGO, CAT_RETAIL),
  row('l3', 'Carver Cafe', 'city-atl-0000', CAT_FOOD),
  row('l4', 'Dunbar Design', 'city-atl-0000', CAT_RETAIL, 'virtual'),
  row('l5', 'Eula Sweets', 'city-atl-0000', CAT_FOOD_CHILD),
]

/** The category tree the mock serves: one parent with one child, and retail. */
const CATEGORY_NODES = [
  { id: CAT_FOOD, slug: 'food-dining', parent_id: null },
  { id: CAT_FOOD_CHILD, slug: 'bakeries', parent_id: CAT_FOOD },
  { id: CAT_RETAIL, slug: 'retail', parent_id: null },
]

function row(
  id: string,
  name: string,
  cityId: string,
  categoryId: string,
  locationType = 'physical'
) {
  return {
    id,
    slug: id,
    name,
    tagline: null,
    entity_type: 'business',
    trust_tier: 'unclaimed',
    tier: 'free',
    logo_path: null,
    cover_image_path: null,
    avg_rating: null,
    review_count: 0,
    save_count: 0,
    published_at: '2026-01-01T00:00:00Z',
    status: 'published',
    city_id: cityId,
    category_id: categoryId,
    location_type: locationType,
    categories: { name: 'Food', slug: 'food-dining' },
    cities: { name: 'Chicago', slug: 'chicago-il' },
  }
}

vi.mock('@/lib/supabase/server', () => {
  // A chainable, thenable query builder. Awaiting it at any point in the chain
  // applies the recorded filters to CORPUS, so "this narrowed the set" is a real
  // assertion rather than a canned return value.
  function builder(table: string) {
    const calls: unknown[][] = []
    h.queries.push({ table, calls })

    const resolve = () => {
      if (table === 'cities') {
        const slug = eqValue(calls, 'slug')
        return { data: slug === 'chicago-il' ? { id: CITY_CHICAGO } : null, error: null }
      }
      if (table === 'categories') {
        const slug = eqValue(calls, 'slug')
        if (slug !== undefined) {
          return { data: slug === 'food-dining' ? { id: CAT_FOOD } : null, error: null }
        }
        const parentId = eqValue(calls, 'parent_id')
        if (parentId !== undefined) {
          return {
            data: CATEGORY_NODES.filter((c) => c.parent_id === parentId).map((c) => ({ id: c.id })),
            error: null,
          }
        }
        return { data: CATEGORY_NODES, error: null }
      }
      if (table === 'attribute_values') {
        const wanted = (calls.find((c) => c[0] === 'in')?.[2] as string[] | undefined) ?? []
        return {
          data: wanted.includes('black-woman-owned')
            ? [{ id: ATTR_BLACK_WOMAN, slug: 'black-woman-owned' }]
            : [],
          error: null,
        }
      }

      let rows = CORPUS.filter((r) => r.status === 'published')
      const ids = calls.find((c) => c[0] === 'in' && c[1] === 'id')?.[2] as string[] | undefined
      if (ids) rows = rows.filter((r) => ids.includes(r.id))
      const cityId = eqValue(calls, 'city_id')
      if (cityId) rows = rows.filter((r) => r.city_id === cityId)
      const categoryId = eqValue(calls, 'category_id')
      if (categoryId) rows = rows.filter((r) => r.category_id === categoryId)
      // A category filter is the category plus its children (`.in`), as of the
      // 2026-09-24 type-shortcuts change.
      const categoryIds = calls.find((c) => c[0] === 'in' && c[1] === 'category_id')?.[2] as
        | string[]
        | undefined
      if (categoryIds) rows = rows.filter((r) => categoryIds.includes(r.category_id))
      const entityType = eqValue(calls, 'entity_type')
      if (entityType) rows = rows.filter((r) => r.entity_type === entityType)
      // A mapped Type shortcut arrives as one PostgREST `.or()` string.
      const orFilter = calls.find((c) => c[0] === 'or')?.[1] as string | undefined
      if (orFilter)
        rows = rows.filter((r) => matchesOr(orFilter, r as unknown as Record<string, string>))
      const ilike = calls.find((c) => c[0] === 'ilike')?.[2] as string | undefined
      if (ilike) {
        const needle = ilike.replace(/%/g, '').toLowerCase()
        rows = rows.filter((r) => r.name.toLowerCase().includes(needle))
      }
      return { data: rows, count: rows.length, error: null }
    }

    const b: Record<string, unknown> = {}
    for (const m of [
      'select',
      'eq',
      'is',
      'in',
      'or',
      'ilike',
      'order',
      'limit',
      'range',
      'textSearch',
    ]) {
      b[m] = (...args: unknown[]) => {
        calls.push([m, ...args])
        return b
      }
    }
    b.maybeSingle = () => Promise.resolve(resolve())
    b.then = (ok: (v: unknown) => unknown, err?: (e: unknown) => unknown) =>
      Promise.resolve(resolve()).then(ok, err)
    return b
  }

  const client = {
    from: (table: string) => builder(table),
    rpc: (fn: string, args: Record<string, unknown>) => {
      h.rpcs.push({ fn, args })
      if (fn === 'search_listings_faceted') {
        return Promise.resolve({ data: h.facetedRows, error: h.facetedError })
      }
      // search_by_similarity is deliberately NOT mocked. It is gone from the
      // service as of 20260922000000, and an unmocked rpc resolves to an error
      // here, so a reintroduction fails loudly rather than quietly working.
      return Promise.resolve({ data: null, error: { message: `unmocked rpc ${fn}` } })
    },
    auth: { getUser: async () => ({ data: { user: null } }) },
  }

  return {
    createClient: async () => client,
    // logSearchEvent writes through this; it must never affect a response.
    createServiceClient: () => ({
      from: () => ({ insert: () => Promise.resolve({ error: null }) }),
    }),
  }
})

/** Enough of PostgREST's `.or()` grammar for typeOrFilter: `col.eq.v` and `col.in.(a,b)`. */
function matchesOr(filter: string, r: Record<string, string>): boolean {
  const clauses = filter.match(/[a-z_]+\.(?:eq\.[^,]+|in\.\([^)]*\))/g) ?? []
  return clauses.some((clause) => {
    const [col = '', op, ...rest] = clause.split('.')
    const value = rest.join('.')
    if (op === 'eq') return r[col] === value
    return value
      .slice(1, -1)
      .split(',')
      .includes(r[col] ?? '')
  })
}

/** The value of the first `.eq(col, …)` recorded on a builder, if any. */
function eqValue(calls: unknown[][], col: string): string | undefined {
  return calls.find((c) => c[0] === 'eq' && c[1] === col)?.[2] as string | undefined
}

const { searchListings, UnknownFilterValueError } = await import('@/lib/services/search')
const { GET } = await import('@/app/api/search/route')

const base = { page: 1, limit: 20 } as const

beforeEach(() => {
  h.queries = []
  h.rpcs = []
  h.facetedRows = []
  h.facetedError = null
})

// ── 1.17 · unresolvable ≠ not asked for ─────────────────────────────────────

describe('1.17 — unknown filter slugs are rejected, not dropped', () => {
  it('raises on an unknown city instead of returning the whole index', async () => {
    await expect(searchListings({ ...base, city: 'definitely-not-a-city-xyz' })).rejects.toThrow(
      UnknownFilterValueError
    )
  })

  it('names the offending field so the caller can fix the request', async () => {
    const err = await searchListings({ ...base, city: 'nope-xyz' }).catch((e) => e)
    expect(err).toBeInstanceOf(UnknownFilterValueError)
    expect(err.fields.city).toContain('nope-xyz')
  })

  it('raises on an unknown category (the variant 1.17 was not originally logged for)', async () => {
    const err = await searchListings({ ...base, category: 'not-a-category-xyz' }).catch((e) => e)
    expect(err).toBeInstanceOf(UnknownFilterValueError)
    expect(err.fields.category).toContain('not-a-category-xyz')
  })

  it('raises on an unknown attribute slug', async () => {
    const err = await searchListings({ ...base, attrs: ['no-such-attr'] }).catch((e) => e)
    expect(err).toBeInstanceOf(UnknownFilterValueError)
    expect(err.fields.attrs).toContain('no-such-attr')
  })

  it('reports only the slug that missed when one of two resolves', async () => {
    const err = await searchListings({ ...base, city: 'chicago-il', category: 'bad-xyz' }).catch(
      (e) => e
    )
    expect(err.fields.category).toBeDefined()
    expect(err.fields.city).toBeUndefined()
  })

  it('still filters normally on a KNOWN city — the fix must not reject everything', async () => {
    const { results } = await searchListings({ ...base, city: 'chicago-il' })
    expect(results.map((r) => r.id)).toEqual(['l1', 'l2'])
  })

  it('still filters normally on a KNOWN category, subcategories included', async () => {
    const { results } = await searchListings({ ...base, category: 'food-dining' })
    // l5 is filed under a Food & Dining subcategory. The browse path used to
    // match the parent id exactly and drop it, while /discover's RPC kept it.
    expect(results.map((r) => r.id)).toEqual(['l1', 'l3', 'l5'])
  })
})

// ── 1.16 · deep facets reach the RPC ────────────────────────────────────────

describe('1.16 — attrs / price / open_now are implemented, not ignored', () => {
  it('routes an attrs request through search_listings_faceted with resolved ids', async () => {
    h.facetedRows = [
      { id: 'l3', total_count: 2 },
      { id: 'l1', total_count: 2 },
    ]
    const { results, total } = await searchListings({ ...base, attrs: ['black-woman-owned'] })

    const rpc = h.rpcs.find((r) => r.fn === 'search_listings_faceted')
    expect(rpc?.args.p_attribute_values).toEqual([ATTR_BLACK_WOMAN])
    // The whole corpus is 4. Returning 4 here is the defect this test exists for.
    expect(total).toBe(2)
    // .in() does not preserve order — the RPC's ranking must survive hydration.
    expect(results.map((r) => r.id)).toEqual(['l3', 'l1'])
  })

  it('passes price ranges to the RPC', async () => {
    h.facetedRows = [{ id: 'l1', total_count: 1 }]
    await searchListings({ ...base, price: ['$$'] })
    expect(h.rpcs.find((r) => r.fn === 'search_listings_faceted')?.args.p_price_ranges).toEqual([
      '$$',
    ])
  })

  it('passes open_now to the RPC', async () => {
    h.facetedRows = []
    await searchListings({ ...base, open_now: true })
    expect(h.rpcs.find((r) => r.fn === 'search_listings_faceted')?.args.p_open_now).toBe(true)
  })

  it('does not silently fall back to a path that ignores the facet when the RPC fails', async () => {
    h.facetedError = { message: 'boom' }
    await expect(searchListings({ ...base, open_now: true })).rejects.toThrow()
  })
})

// ── Regression surface: the untouched path ──────────────────────────────────

describe('browse requests keep the PostgREST path', () => {
  it('never calls the faceted RPC for a plain browse with no query', async () => {
    await searchListings({ ...base, city: 'chicago-il' })
    expect(h.rpcs.some((r) => r.fn === 'search_listings_faceted')).toBe(false)
  })

  it('still narrows a browse by city on that path', async () => {
    const { total } = await searchListings({ ...base, city: 'chicago-il' })
    expect(total).toBe(2)
  })
})

// ── Type shortcuts map to categories [Decision — founder, 2026-09-24] ────────

describe('type shortcuts on the browse path', () => {
  it('Restaurants finds business listings in Food & Dining and its subcategories', async () => {
    const { results } = await searchListings({ ...base, type: 'restaurant' })
    // Every row is entity_type 'business'. An exact entity_type match returns
    // zero here, which is the founder-reported defect.
    expect(results.map((r) => r.id)).toEqual(['l1', 'l3', 'l5'])
  })

  it('Services finds listings by where they operate', async () => {
    const { results } = await searchListings({ ...base, type: 'service_provider' })
    expect(results.map((r) => r.id)).toEqual(['l4'])
  })

  it('Businesses stays an exact entity_type match', async () => {
    await searchListings({ ...base, type: 'business' })
    const listings = h.queries.find((q) => q.table === 'listings')
    expect(listings?.calls.some((c) => c[0] === 'or')).toBe(false)
    expect(listings?.calls).toContainEqual(['eq', 'entity_type', 'business'])
  })

  it('sends the mapped ids to the RPC when there is a query', async () => {
    h.facetedRows = [{ id: 'l1', total_count: 1 }]
    await searchListings({ ...base, q: 'cake', type: 'restaurant' })
    const rpc = h.rpcs.find((r) => r.fn === 'search_listings_faceted')
    expect(rpc?.args.p_type_category_ids).toEqual([CAT_FOOD, CAT_FOOD_CHILD])
    expect(rpc?.args).not.toHaveProperty('p_type_location_types')
  })
})

// ── One definition of relevance ─────────────────────────────────────────────

describe('a keyword query resolves through search_listings_faceted', () => {
  it('sends the query to the RPC rather than building its own match', async () => {
    h.facetedRows = [{ id: 'l1', total_count: 1 }]
    const { results, total } = await searchListings({ ...base, q: 'bakery' })

    expect(h.rpcs.find((r) => r.fn === 'search_listings_faceted')?.args.p_q).toBe('bakery')
    expect(results.map((r) => r.id)).toEqual(['l1'])
    expect(total).toBe(1)
  })

  it('does not run its own textSearch against the listings table', async () => {
    h.facetedRows = [{ id: 'l1', total_count: 1 }]
    await searchListings({ ...base, q: 'bakery' })
    const usedTextSearch = h.queries
      .filter((q) => q.table === 'listings')
      .some((q) => q.calls.some((c) => c[0] === 'textSearch'))
    expect(usedTextSearch).toBe(false)
  })

  it('never calls search_by_similarity', async () => {
    // The guard. This RPC was the second definition of "what matches" and it
    // disagreed with the function on the founder's own query. If this assertion
    // starts failing, a side path has come back and /api/search and /discover
    // can answer the same search differently again.
    h.facetedRows = [{ id: 'l1', total_count: 1 }]
    await searchListings({ ...base, q: 'bakery' })
    expect(h.rpcs.some((r) => r.fn === 'search_by_similarity')).toBe(false)
  })

  it('still carries scalar filters into the RPC alongside the query', async () => {
    // Routing `q` through the RPC must not drop what the PostgREST branch used
    // to apply. city and category resolve to ids; type and trust_tier pass
    // through as-is.
    h.facetedRows = []
    await searchListings({
      ...base,
      q: 'bakery',
      city: 'chicago-il',
      category: 'food-dining',
      type: 'business',
      trust_tier: 'verified',
    })

    const args = h.rpcs.find((r) => r.fn === 'search_listings_faceted')?.args
    expect(args?.p_city_id).toBe(CITY_CHICAGO)
    expect(args?.p_category_id).toBe(CAT_FOOD)
    expect(args?.p_entity_type).toBe('business')
    expect(args?.p_trust_tier).toBe('verified')
  })
})

// ── The public contract ─────────────────────────────────────────────────────

describe('GET /api/search — error envelope', () => {
  it('answers 400 UNKNOWN_FILTER_VALUE for an unknown city', async () => {
    const res = await GET(
      new Request('http://localhost/api/search?city=definitely-not-a-city-xyz') as never
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('UNKNOWN_FILTER_VALUE')
    expect(body.fields.city).toBeDefined()
  })

  it('answers 200 for a city that exists', async () => {
    const res = await GET(new Request('http://localhost/api/search?city=chicago-il') as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.meta.total).toBe(2)
  })
})
