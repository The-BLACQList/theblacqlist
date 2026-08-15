import { describe, it, expect } from 'vitest'
import { searchSchema } from '@/lib/validations/search'
import {
  resolveFacetParams,
  SORT_KEYS,
  SORT_OPTIONS,
  DISTANCE_SORT_OPTION,
} from '@/lib/listings/facets'

// resolveFacetParams only touches supabase when category/city/attrs are present.
// With none supplied it uses Promise.resolve fallbacks, so a bare stub is safe.
const stub = {} as unknown as Parameters<typeof resolveFacetParams>[0]

/** Mirrors app/api/search/route.ts: raw string params off the URL. */
function parse(qs: string) {
  return searchSchema.safeParse(Object.fromEntries(new URLSearchParams(qs)))
}

function fieldErrors(qs: string): Record<string, string[] | undefined> {
  const r = parse(qs)
  if (r.success) throw new Error(`expected ${qs} to fail validation, but it parsed`)
  return r.error.flatten().fieldErrors
}

describe('searchSchema — Near You coordinates', () => {
  it('accepts lat, lng and radius together', () => {
    const r = parse('lat=29.9511&lng=-90.0715&radius=5')
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.lat).toBe(29.9511)
    expect(r.data.lng).toBe(-90.0715)
    expect(r.data.radius).toBe(5)
  })

  it('accepts lat and lng with no radius (locate without filtering)', () => {
    expect(parse('lat=29.9511&lng=-90.0715').success).toBe(true)
  })

  it('leaves all three undefined when none are supplied', () => {
    const r = parse('q=coffee')
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.lat).toBeUndefined()
    expect(r.data.lng).toBeUndefined()
    expect(r.data.radius).toBeUndefined()
  })

  // The core done-when: a location filter the server cannot honor FAILS. It is
  // never silently dropped, because the RPC short-circuits a NULL radius to TRUE
  // and would answer 200 with the entire directory under a "near you" heading.
  it('rejects a radius with no coordinates', () => {
    expect(fieldErrors('radius=5').radius).toBeDefined()
  })

  it('rejects lat without lng', () => {
    expect(fieldErrors('lat=29.9511&radius=5').lng).toBeDefined()
  })

  it('rejects lng without lat', () => {
    expect(fieldErrors('lng=-90.0715&radius=5').lat).toBeDefined()
  })

  // z.coerce.number('') is 0, and lat=0/lng=0 is a real point in the Gulf of
  // Guinea — so an empty coordinate must read as absent, not as Null Island.
  it('treats an empty coordinate as absent rather than coercing it to 0', () => {
    const r = parse('lat=&lng=')
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.lat).toBeUndefined()
    expect(r.data.lng).toBeUndefined()
  })

  it('rejects a radius whose coordinates are empty strings', () => {
    expect(fieldErrors('radius=5&lat=&lng=').radius).toBeDefined()
  })

  it('rejects out-of-range coordinates and radii', () => {
    expect(fieldErrors('lat=91&lng=0&radius=5').lat).toBeDefined()
    expect(fieldErrors('lat=0&lng=181&radius=5').lng).toBeDefined()
    expect(fieldErrors('lat=29.95&lng=-90.07&radius=501').radius).toBeDefined()
    expect(fieldErrors('lat=29.95&lng=-90.07&radius=0').radius).toBeDefined()
  })

  it('rejects a non-numeric coordinate', () => {
    expect(fieldErrors('lat=here&lng=-90.07&radius=5').lat).toBeDefined()
  })
})

describe('searchSchema — distance sort', () => {
  it('accepts sort=distance when coordinates are present', () => {
    const r = parse('lat=29.9511&lng=-90.0715&sort=distance')
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.sort).toBe('distance')
  })

  // NULLS LAST makes an uncoordinated distance sort fall through to the next
  // ORDER BY key, so 200 would be an arbitrary order wearing the label the
  // caller asked for.
  it('rejects sort=distance with no coordinates', () => {
    expect(fieldErrors('sort=distance').sort).toBeDefined()
  })

  it('still accepts every pre-existing sort key without coordinates', () => {
    for (const key of ['relevance', 'rating', 'reviews', 'newest', 'name', 'saves']) {
      expect(parse(`sort=${key}`).success).toBe(true)
    }
  })

  it('rejects a sort key the RPC does not implement', () => {
    expect(fieldErrors('sort=nearest').sort).toBeDefined()
  })
})

describe('sort key lists', () => {
  it('SORT_KEYS accepts distance', () => {
    expect(SORT_KEYS).toContain('distance')
  })

  // SORT_OPTIONS is the dropdown. Distance is only meaningful once the visitor
  // has shared a location, so C3.3 appends DISTANCE_SORT_OPTION conditionally
  // rather than the control offering a sort that cannot be honored.
  it('SORT_OPTIONS does not offer distance unconditionally', () => {
    expect(SORT_OPTIONS.map((o) => o.value)).not.toContain('distance')
  })

  it('exposes the distance option separately for conditional rendering', () => {
    expect(DISTANCE_SORT_OPTION.value).toBe('distance')
    expect(DISTANCE_SORT_OPTION.label.length).toBeGreaterThan(0)
  })

  it('every SORT_OPTIONS value is an accepted key', () => {
    for (const o of SORT_OPTIONS) expect(SORT_KEYS).toContain(o.value)
  })
})

describe('resolveFacetParams — Near You passthrough', () => {
  it('maps lat/lng/radius onto the RPC argument names', async () => {
    const { params: r } = await resolveFacetParams(stub, {
      lat: 29.9511,
      lng: -90.0715,
      radius: 5,
    })
    expect(r.p_lat).toBe(29.9511)
    expect(r.p_lng).toBe(-90.0715)
    expect(r.p_radius_miles).toBe(5)
  })

  it('is null on all three when no location was supplied', async () => {
    const { params: r } = await resolveFacetParams(stub, {})
    expect(r.p_lat).toBeNull()
    expect(r.p_lng).toBeNull()
    expect(r.p_radius_miles).toBeNull()
  })

  // A NULL radius short-circuits the RPC predicate to TRUE, which is what makes
  // the three params backward compatible with every existing call site.
  it('leaves the radius null when coordinates are supplied without one', async () => {
    const { params: r } = await resolveFacetParams(stub, { lat: 29.9511, lng: -90.0715 })
    expect(r.p_lat).toBe(29.9511)
    expect(r.p_radius_miles).toBeNull()
  })

  it('does not disturb the other resolved params', async () => {
    const { params: r } = await resolveFacetParams(stub, {
      ownership: 'ally',
      lat: 29.9511,
      lng: -90.0715,
      radius: 10,
    })
    expect(r.p_ownership_label).toBe('ally')
    expect(r.p_radius_miles).toBe(10)
  })

  // lat=0/lng=0 is a legitimate coordinate. It must survive as 0, not be
  // ?? -collapsed to null the way a falsy-check would collapse it.
  it('preserves a zero coordinate rather than treating it as absent', async () => {
    const { params: r } = await resolveFacetParams(stub, { lat: 0, lng: 0, radius: 5 })
    expect(r.p_lat).toBe(0)
    expect(r.p_lng).toBe(0)
  })
})
