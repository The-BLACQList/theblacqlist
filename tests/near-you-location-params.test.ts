import { describe, it, expect } from 'vitest'

import {
  parseLocationParams,
  widerRadius,
  roundCoord,
  RADIUS_OPTIONS,
  DEFAULT_RADIUS_MILES,
} from '@/lib/listings/location-params'
import { clearEntries, LOCATION_KEYS, FACET_KEYS } from '@/components/discovery/useFacetParams'

/**
 * C3.3 — the "Near You" UI contract.
 *
 * The API route is protected by searchSchema (tests/search-radius-params.test.ts).
 * Server-rendered pages hand-parse their searchParams instead, so the same
 * guarantee has to be re-established here: a partial or out-of-range location
 * never reaches the RPC, because the RPC short-circuits its radius predicate to
 * TRUE on any NULL and would answer the whole directory under a proximity label.
 */
describe('parseLocationParams', () => {
  it('returns the triple when all three are present and in range', () => {
    expect(parseLocationParams({ lat: '29.951', lng: '-90.071', radius: '10' })).toEqual({
      lat: 29.951,
      lng: -90.071,
      radius: 10,
    })
  })

  it('drops the whole location when radius is missing', () => {
    expect(parseLocationParams({ lat: '29.951', lng: '-90.071' })).toBeNull()
  })

  it('drops the whole location when only one coordinate is present', () => {
    expect(parseLocationParams({ lat: '29.951', radius: '10' })).toBeNull()
    expect(parseLocationParams({ lng: '-90.071', radius: '10' })).toBeNull()
  })

  it('treats an empty string as absent rather than as zero', () => {
    // Number('') is 0, and lat=0/lng=0 is a real point in the Gulf of Guinea —
    // so a naive coercion would search Null Island and return an honest-looking
    // zero results instead of no location filter at all.
    expect(parseLocationParams({ lat: '', lng: '', radius: '10' })).toBeNull()
    expect(parseLocationParams({ lat: '29.951', lng: '-90.071', radius: '  ' })).toBeNull()
  })

  it('accepts a genuine zero coordinate', () => {
    expect(parseLocationParams({ lat: '0', lng: '0', radius: '5' })).toEqual({
      lat: 0,
      lng: 0,
      radius: 5,
    })
  })

  it('rejects out-of-range values instead of clamping them', () => {
    expect(parseLocationParams({ lat: '91', lng: '0', radius: '10' })).toBeNull()
    expect(parseLocationParams({ lat: '0', lng: '181', radius: '10' })).toBeNull()
    expect(parseLocationParams({ lat: '0', lng: '0', radius: '501' })).toBeNull()
    expect(parseLocationParams({ lat: '0', lng: '0', radius: '0' })).toBeNull()
  })

  it('rejects non-numeric input', () => {
    expect(parseLocationParams({ lat: 'here', lng: '-90.071', radius: '10' })).toBeNull()
    expect(parseLocationParams({ lat: '29.951', lng: '-90.071', radius: 'near' })).toBeNull()
  })
})

describe('the radius options the UI offers', () => {
  it('every option is inside the schema range the server enforces', () => {
    for (const option of RADIUS_OPTIONS) {
      expect(parseLocationParams({ lat: '0', lng: '0', radius: String(option) })).not.toBeNull()
    }
  })

  it('the default applied by "Use my location" is one of the offered options', () => {
    expect(RADIUS_OPTIONS).toContain(DEFAULT_RADIUS_MILES)
  })

  it('widerRadius steps up, and returns null at the widest', () => {
    expect(widerRadius(1)).toBe(5)
    expect(widerRadius(10)).toBe(25)
    // No "Search a wider area" link is offered when there is nowhere wider to go.
    expect(widerRadius(25)).toBeNull()
    expect(widerRadius(400)).toBeNull()
  })
})

describe('roundCoord', () => {
  it('keeps three decimals — finer than any radius, coarser than a doorstep', () => {
    expect(roundCoord(29.9510648)).toBe(29.951)
    expect(roundCoord(-90.0715309)).toBe(-90.072)
  })

  it('leaves an already-coarse coordinate alone', () => {
    expect(roundCoord(29.95)).toBe(29.95)
    expect(roundCoord(0)).toBe(0)
  })
})

describe('clearEntries', () => {
  it('blanks every key it is given', () => {
    expect(clearEntries(LOCATION_KEYS, null)).toEqual({ lat: '', lng: '', radius: '' })
  })

  it('takes sort=distance with the coordinates', () => {
    // A distance sort outliving its coordinates is a lie the server cannot catch
    // loudly: the RPC orders NULLS LAST and falls through to another key while
    // the control still reads "Nearest".
    expect(clearEntries(LOCATION_KEYS, 'distance')).toEqual({
      lat: '',
      lng: '',
      radius: '',
      sort: '',
    })
  })

  it('leaves any other sort in place', () => {
    expect(clearEntries(LOCATION_KEYS, 'rating')).not.toHaveProperty('sort')
  })

  it('clears the facet keys and the location keys together on "Clear all"', () => {
    const entries = clearEntries([...FACET_KEYS, ...LOCATION_KEYS], 'distance')
    for (const key of [...FACET_KEYS, ...LOCATION_KEYS]) expect(entries[key]).toBe('')
    expect(entries.sort).toBe('')
  })

  it('keeps the location keys out of FACET_KEYS', () => {
    // Three URL keys, one filter. Counting them alongside the facets would show
    // "3 filters" on the mobile badge for a single "within 10 miles".
    for (const key of LOCATION_KEYS) expect(FACET_KEYS).not.toContain(key)
  })
})
