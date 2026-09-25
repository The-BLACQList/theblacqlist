// =============================================================================
// Discover: type shortcuts, the pre-migration fallback, and sponsored on search
// =============================================================================
// PR3 ships code that must work on both sides of 20260924000000. These tests
// pin the three things that make that true, plus the sponsored rule:
//
//   * rpcArgs never sends the two new keys as NULL, so a call without a mapped
//     type is byte-for-byte the call the old signatures accept
//   * when the new keys ARE sent and the RPC rejects them (migration not yet
//     applied), the call is retried once without them
//   * no `cell` rows means no category/type counts, never "every category is 0"
//   * a keyword search never queries sponsored placements [Decision — founder,
//     2026-09-24], and under a Type shortcut an off-type placement is dropped
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const FOOD = 'c0000001-0000-0000-0000-000000000001'
const BAKERY = 'c0000001-0000-0000-0000-00000000b001'
const RETAIL = 'c0000001-0000-0000-0000-000000000002'

const h = vi.hoisted(() => {
  const state: {
    tables: Record<string, unknown[]>
    rpc: Array<(args: Record<string, unknown>) => { data: unknown; error: unknown }>
  } = { tables: {}, rpc: [] }
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const fromCalls: string[] = []
  return { state, rpcCalls, fromCalls }
})

function fakeClient() {
  function builder(table: string) {
    const rows = () => h.state.tables[table] ?? []
    const b: Record<string, unknown> = {}
    for (const m of [
      'select',
      'eq',
      'is',
      'in',
      'or',
      'lte',
      'gt',
      'order',
      'limit',
      'range',
      'textSearch',
    ]) {
      b[m] = () => b
    }
    b.maybeSingle = () => Promise.resolve({ data: rows()[0] ?? null, error: null })
    b.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows(), error: null, count: rows().length }).then(ok, bad)
    return b
  }
  return {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: (table: string) => {
      h.fromCalls.push(table)
      return builder(table)
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      h.rpcCalls.push({ fn, args })
      const next = h.state.rpc.shift()
      return next ? next(args) : { data: [], error: null }
    },
  }
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fakeClient() }))

const { rpcArgs, searchFacetedIds, getFacetCounts, resolveFacetParams } =
  await import('@/lib/listings/facets')
const { queryListings } = await import('@/lib/listings/query')

type Client = Parameters<typeof resolveFacetParams>[0]
const client = () => fakeClient() as unknown as Client

const CATEGORIES = [
  { id: FOOD, slug: 'food-dining', parent_id: null },
  { id: BAKERY, slug: 'bakeries', parent_id: FOOD },
  { id: RETAIL, slug: 'retail-gifts', parent_id: null },
]

function raw(id: string, category_id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    slug: id,
    name: id,
    tagline: null,
    entity_type: 'business',
    location_type: 'physical',
    category_id,
    trust_tier: 'unclaimed',
    tier: 'free',
    ownership_label: 'black_owned',
    is_featured: false,
    is_sponsored: false,
    logo_path: null,
    cover_image_path: null,
    avg_rating: null,
    review_count: 0,
    save_count: 0,
    categories: null,
    cities: null,
    listing_details_business: null,
    ...extra,
  }
}

const rejectUnknownParam = () => ({
  data: null,
  error: { code: 'PGRST202', message: 'Could not find the function with those parameters' },
})

beforeEach(() => {
  h.state.tables = {}
  h.state.rpc = []
  h.rpcCalls.length = 0
  h.fromCalls.length = 0
})

describe('rpcArgs', () => {
  it('drops the type keys when they are null and keeps every other key', () => {
    const out = rpcArgs({
      p_q: null,
      p_entity_type: 'business',
      p_type_category_ids: null,
      p_type_location_types: null,
    })
    expect(out).toEqual({ p_q: null, p_entity_type: 'business' })
  })

  it('keeps the type keys when they carry values', () => {
    const out = rpcArgs({ p_type_category_ids: [FOOD], p_type_location_types: ['virtual'] })
    expect(out).toEqual({ p_type_category_ids: [FOOD], p_type_location_types: ['virtual'] })
  })
})

describe('resolveFacetParams and the type mapping', () => {
  it('sends the mapped parent and its children for a mapped type', async () => {
    h.state.tables.categories = CATEGORIES
    const { params } = await resolveFacetParams(client(), { type: 'restaurant' })
    expect(params.p_entity_type).toBe('restaurant')
    expect(params.p_type_category_ids?.sort()).toEqual([BAKERY, FOOD].sort())
    expect(params.p_type_location_types).toBeNull()
  })

  it('sends location types for Services', async () => {
    const { params } = await resolveFacetParams(client(), { type: 'service_provider' })
    expect(params.p_type_category_ids).toBeNull()
    expect(params.p_type_location_types?.length).toBeGreaterThan(0)
  })

  it('costs no category query for an exact type', async () => {
    const { params } = await resolveFacetParams(client(), { type: 'business' })
    expect(h.fromCalls).not.toContain('categories')
    expect(params.p_type_category_ids).toBeNull()
    expect(params.p_type_location_types).toBeNull()
  })
})

describe('searchFacetedIds: pre-migration fallback', () => {
  async function resolvedFor(type: string) {
    h.state.tables.categories = CATEGORIES
    return (await resolveFacetParams(client(), { type })).params
  }

  it('retries once without the type keys when the new signature is missing', async () => {
    const resolved = await resolvedFor('restaurant')
    h.state.rpc = [rejectUnknownParam, () => ({ data: [{ id: 'a', total_count: 1 }], error: null })]

    const out = await searchFacetedIds(client(), resolved, 'relevance', 24, 0)

    expect(out).toEqual({ ids: ['a'], total: 1, error: false })
    expect(h.rpcCalls).toHaveLength(2)
    expect(h.rpcCalls[0]!.args).toHaveProperty('p_type_category_ids')
    expect(h.rpcCalls[1]!.args).not.toHaveProperty('p_type_category_ids')
    expect(h.rpcCalls[1]!.args).not.toHaveProperty('p_type_location_types')
    expect(h.rpcCalls[1]!.args.p_entity_type).toBe('restaurant')
  })

  it('does not retry a call that never carried the type keys', async () => {
    const resolved = await resolvedFor('business')
    h.state.rpc = [rejectUnknownParam]

    const out = await searchFacetedIds(client(), resolved, 'relevance', 24, 0)

    expect(out.error).toBe(true)
    expect(h.rpcCalls).toHaveLength(1)
    expect(h.rpcCalls[0]!.args).not.toHaveProperty('p_type_category_ids')
  })
})

describe('getFacetCounts', () => {
  const base = async () => {
    h.state.tables.categories = CATEGORIES
    return (await resolveFacetParams(client(), {})).params
  }

  it('leaves category and type counts undefined when no cells come back', async () => {
    const resolved = await base()
    h.state.rpc = [
      () => ({ data: [{ facet_kind: 'price', facet_key: '$', facet_count: 3 }], error: null }),
    ]
    const counts = await getFacetCounts(client(), resolved)
    expect(counts.price).toEqual({ $: 3 })
    expect(counts.category).toBeUndefined()
    expect(counts.type).toBeUndefined()
    expect(counts.countsUnavailable).toBeUndefined()
  })

  it('rolls cells up into category and type counts', async () => {
    const resolved = await base()
    h.state.rpc = [
      () => ({
        data: [
          { facet_kind: 'cell', facet_key: `business|${FOOD}|physical`, facet_count: 4 },
          { facet_kind: 'cell', facet_key: `business|${BAKERY}|physical`, facet_count: 1 },
          { facet_kind: 'cell', facet_key: `business|${RETAIL}|virtual`, facet_count: 2 },
          { facet_kind: 'cell', facet_key: 'not-a-cell', facet_count: 99 },
        ],
        error: null,
      }),
    ]
    const counts = await getFacetCounts(client(), resolved)
    expect(counts.category?.['food-dining']).toBe(5)
    expect(counts.category?.bakeries).toBe(1)
    expect(counts.type?.restaurant).toBe(5)
    expect(counts.type?.business).toBe(7)
    expect(counts.type?.service_provider).toBe(2)
  })

  it('reports counts as unavailable, not zero, when the RPC fails', async () => {
    const resolved = await base()
    h.state.rpc = [() => ({ data: null, error: { message: 'boom' } })]
    const counts = await getFacetCounts(client(), resolved)
    expect(counts.countsUnavailable).toBe(true)
  })

  it('never sends the ownership arg facet_counts does not take', async () => {
    const resolved = { ...(await base()), p_ownership_label: 'ally' }
    await getFacetCounts(client(), resolved)
    expect(h.rpcCalls[0]!.args).not.toHaveProperty('p_ownership_label')
  })
})

describe('queryListings: sponsored placements', () => {
  const organic = raw('organic-1', RETAIL)
  const onType = raw('sp-food', BAKERY)
  const offType = raw('sp-retail', RETAIL)

  beforeEach(() => {
    h.state.tables.categories = CATEGORIES
    h.state.tables.listings = [organic]
    h.state.tables.sponsored_placements = [
      { id: 'place-off', position: 1, listings: offType },
      { id: 'place-on', position: 2, listings: onType },
    ]
    h.state.rpc = [() => ({ data: [{ id: 'organic-1', total_count: 1 }], error: null })]
  })

  it('never queries sponsored placements on a keyword search', async () => {
    const res = await queryListings({ q: 'photographer' })
    expect(h.fromCalls).not.toContain('sponsored_placements')
    expect(res.entities.some((e) => e.is_sponsored)).toBe(false)
  })

  it('still injects sponsored placements when browsing', async () => {
    const res = await queryListings({})
    expect(h.fromCalls).toContain('sponsored_placements')
    expect(res.entities.filter((e) => e.is_sponsored).map((e) => e.id)).toEqual([
      'sp-retail',
      'sp-food',
    ])
  })

  it('drops an off-type placement under a Type shortcut', async () => {
    const res = await queryListings({ type: 'restaurant' })
    const sponsored = res.entities.filter((e) => e.is_sponsored).map((e) => e.id)
    expect(sponsored).toEqual(['sp-food'])
  })
})
