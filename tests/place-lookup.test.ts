// Ticket 142: the map's place lookup. Our own cities first, then OpenStreetMap
// (Nominatim) for states, towns and ZIPs. Founder 2026-10-20: free, on Enter
// only, cached and rate limited.

import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssistCity } from '@/lib/search/assist'

const h = vi.hoisted(() => ({
  allowed: true,
  limitCalls: [] as Array<{ bucket: string; identifier: string; limit: number }>,
  cityRows: [] as unknown[],
}))

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: async (opts: { bucket: string; identifier: string; limit: number }) => {
    h.limitCalls.push(opts)
    return opts.bucket === 'place_lookup' ? h.allowed : true
  },
  getClientIp: (headers: Headers) => headers.get('x-forwarded-for') ?? 'unknown',
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({ select: async () => ({ data: h.cityRows, error: null }) }),
  }),
}))

const { lookupPlace, matchLocalCity, matchStateName, toPlace } =
  await import('@/lib/search/placeLookup')
const { GET } = await import('@/app/api/places/lookup/route')

const CITIES: AssistCity[] = [
  {
    id: 'c1',
    name: 'Atlanta',
    slug: 'atlanta-ga',
    isActive: true,
    lat: 33.749,
    lng: -84.388,
    stateCode: 'GA',
  },
  {
    id: 'c2',
    name: 'Columbus',
    slug: 'columbus-oh',
    isActive: true,
    lat: 39.961,
    lng: -82.999,
    stateCode: 'OH',
  },
  {
    id: 'c3',
    name: 'Columbus',
    slug: 'columbus-ga',
    isActive: false,
    lat: 32.461,
    lng: -84.988,
    stateCode: 'GA',
  },
  {
    id: 'c4',
    name: 'Nowhere Yet',
    slug: 'nowhere-tx',
    isActive: false,
    lat: null,
    lng: null,
    stateCode: 'TX',
  },
]

const DECATUR = {
  lat: '33.7748',
  lon: '-84.2963',
  name: 'Decatur',
  addresstype: 'city',
  address: { city: 'Decatur', state: 'Georgia', 'ISO3166-2-lvl4': 'US-GA' },
}
const ZIP_30030 = {
  lat: '33.77',
  lon: '-84.29',
  name: '30030',
  addresstype: 'postcode',
  address: { postcode: '30030', city: 'Decatur', 'ISO3166-2-lvl4': 'US-GA' },
}
const OHIO = {
  lat: '40.22',
  lon: '-82.68',
  name: 'Ohio',
  addresstype: 'state',
  address: { state: 'Ohio', 'ISO3166-2-lvl4': 'US-OH' },
}
const COFFEE_SHOP = {
  lat: '33.7',
  lon: '-84.3',
  name: 'Starbucks',
  addresstype: 'amenity',
  address: { 'ISO3166-2-lvl4': 'US-GA' },
}

function fakeFetch(answer: unknown, ok = true) {
  return vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) => ({
    ok,
    json: async () => answer,
  })) as unknown as typeof fetch & ReturnType<typeof vi.fn>
}

function calledUrl(f: ReturnType<typeof vi.fn>): URL {
  return f.mock.calls[0]![0] as URL
}

describe('matchLocalCity and matchStateName', () => {
  it('matches a city by name, nickname, code and state name', () => {
    expect(matchLocalCity('Atlanta', CITIES)?.slug).toBe('atlanta-ga')
    expect(matchLocalCity('atl', CITIES)?.slug).toBe('atlanta-ga')
    expect(matchLocalCity('Atlanta, GA', CITIES)?.slug).toBe('atlanta-ga')
    expect(matchLocalCity('atlanta georgia', CITIES)?.slug).toBe('atlanta-ga')
  })

  it('prefers the live city when two share a name, and the state when given', () => {
    expect(matchLocalCity('Columbus', CITIES)?.slug).toBe('columbus-oh')
    expect(matchLocalCity('Columbus GA', CITIES)?.slug).toBe('columbus-ga')
  })

  it('needs the whole words, and a city with a point', () => {
    expect(matchLocalCity('atlanta bakery', CITIES)).toBeNull()
    expect(matchLocalCity('Nowhere Yet', CITIES)).toBeNull()
  })

  it('reads exact state names only, never two-letter codes', () => {
    expect(matchStateName('Ohio')?.code).toBe('OH')
    expect(matchStateName('washington state')?.code).toBe('WA')
    expect(matchStateName('OH')).toBeNull()
    expect(matchStateName('ohio plumber')).toBeNull()
  })
})

describe('toPlace', () => {
  it('labels a town with its state code', () => {
    expect(toPlace(DECATUR)).toEqual({
      label: 'Decatur, GA',
      lat: 33.7748,
      lng: -84.2963,
      zoom: 11,
    })
  })

  it('labels a ZIP with its town', () => {
    expect(toPlace(ZIP_30030)).toMatchObject({ label: '30030, Decatur, GA', zoom: 12 })
  })

  it('refuses anything that is not a place', () => {
    expect(toPlace(COFFEE_SHOP)).toBeNull()
    expect(toPlace(null)).toBeNull()
    expect(toPlace({ ...DECATUR, lat: 'nope' })).toBeNull()
  })
})

describe('lookupPlace', () => {
  it('answers our own city with no upstream call', async () => {
    const fetchImpl = fakeFetch([DECATUR])
    for (const q of ['atl', 'Atlanta']) {
      const out = await lookupPlace(q, CITIES, { fetchImpl })
      expect(out).toEqual({
        place: { label: 'Atlanta, GA', lat: 33.749, lng: -84.388, zoom: 11 },
        cacheable: true,
      })
    }
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('sends a state name to a structured state search at state zoom', async () => {
    const fetchImpl = fakeFetch([OHIO])
    const out = await lookupPlace('Ohio', CITIES, { fetchImpl })
    expect(out.place).toMatchObject({ label: 'Ohio', zoom: 6 })
    const url = calledUrl(fetchImpl)
    expect(url.searchParams.get('state')).toBe('Ohio')
    expect(url.searchParams.get('countrycodes')).toBe('us')
    expect(url.searchParams.get('q')).toBeNull()
  })

  it('falls back to one of our cities when the state search fails, without caching', async () => {
    const out = await lookupPlace('Ohio', CITIES, { fetchImpl: fakeFetch(null, false) })
    expect(out).toEqual({
      place: { label: 'Ohio', lat: 39.961, lng: -82.999, zoom: 6 },
      cacheable: false,
    })
  })

  it('uses the postal code search for a 5-digit ZIP', async () => {
    const fetchImpl = fakeFetch([ZIP_30030])
    const out = await lookupPlace('30030', CITIES, { fetchImpl })
    expect(out.place?.label).toBe('30030, Decatur, GA')
    expect(calledUrl(fetchImpl).searchParams.get('postalcode')).toBe('30030')
  })

  it('uses a US settlement search for other words', async () => {
    const fetchImpl = fakeFetch([DECATUR])
    const out = await lookupPlace('Decatur', CITIES, { fetchImpl })
    expect(out).toEqual({
      place: { label: 'Decatur, GA', lat: 33.7748, lng: -84.2963, zoom: 11 },
      cacheable: true,
    })
    const url = calledUrl(fetchImpl)
    expect(url.searchParams.get('q')).toBe('Decatur')
    expect(url.searchParams.get('featureType')).toBe('settlement')
    expect(url.searchParams.get('countrycodes')).toBe('us')
    const init = fetchImpl.mock.calls[0]![1] as RequestInit & { next?: { revalidate?: number } }
    expect(new Headers(init.headers).get('User-Agent')).toMatch(/^TheBLACQList/)
    expect(init.next?.revalidate).toBe(604800)
  })

  it('answers a cacheable miss when nothing matches', async () => {
    expect(await lookupPlace('zzqxv', CITIES, { fetchImpl: fakeFetch([]) })).toEqual({
      place: null,
      cacheable: true,
    })
    expect(await lookupPlace('Starbucks', CITIES, { fetchImpl: fakeFetch([COFFEE_SHOP]) })).toEqual(
      {
        place: null,
        cacheable: true,
      }
    )
  })

  it('answers an uncached miss when the upstream fails or throws', async () => {
    expect(await lookupPlace('Decatur', CITIES, { fetchImpl: fakeFetch(null, false) })).toEqual({
      place: null,
      cacheable: false,
    })
    const throwing = vi.fn(async () => {
      throw new Error('timeout')
    }) as unknown as typeof fetch
    expect(await lookupPlace('Decatur', CITIES, { fetchImpl: throwing })).toEqual({
      place: null,
      cacheable: false,
    })
  })

  it('skips the upstream when the shared ceiling is spent', async () => {
    const fetchImpl = fakeFetch([DECATUR])
    const out = await lookupPlace('Decatur', CITIES, {
      fetchImpl,
      allowUpstream: async () => false,
    })
    expect(out).toEqual({ place: null, cacheable: false })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('GET /api/places/lookup', () => {
  const realFetch = globalThis.fetch
  let fetchSpy: ReturnType<typeof fakeFetch>
  const logSpies: Array<ReturnType<typeof vi.spyOn>> = []

  beforeEach(() => {
    h.allowed = true
    h.limitCalls = []
    h.cityRows = [
      {
        id: 'c1',
        name: 'Atlanta',
        slug: 'atlanta-ga',
        is_active: true,
        latitude: '33.749',
        longitude: '-84.388',
        states: { code: 'GA' },
      },
    ]
    fetchSpy = fakeFetch([DECATUR])
    globalThis.fetch = fetchSpy
    for (const m of ['log', 'info', 'warn', 'error'] as const) logSpies.push(vi.spyOn(console, m))
  })

  afterEach(() => {
    globalThis.fetch = realFetch
    logSpies.splice(0).forEach((s) => s.mockRestore())
  })

  function get(q: string | null, ip = '203.0.113.9') {
    const url = new URL('http://localhost/api/places/lookup')
    if (q !== null) url.searchParams.set('q', q)
    return GET(new NextRequest(url, { headers: { 'x-forwarded-for': ip } }))
  }

  it('answers a place from our cities, cacheable at the CDN', async () => {
    const res = await get('atl')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: { label: 'Atlanta, GA', lat: 33.749, lng: -84.388, zoom: 11 },
    })
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=86400')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('answers an upstream place', async () => {
    const res = await get('Decatur')
    expect(await res.json()).toEqual({
      data: { label: 'Decatur, GA', lat: 33.7748, lng: -84.2963, zoom: 11 },
    })
    expect(h.limitCalls.map((c) => c.bucket)).toEqual(['place_lookup', 'place_lookup_upstream'])
    expect(h.limitCalls[0]).toMatchObject({ identifier: '203.0.113.9', limit: 30 })
    expect(h.limitCalls[1]).toMatchObject({ identifier: 'nominatim', limit: 50 })
  })

  it('answers 400 VALIDATION_ERROR under 2 or over 100 characters', async () => {
    for (const q of [null, 'a', ' a ', 'x'.repeat(101)]) {
      const res = await get(q)
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
      })
    }
  })

  it('answers 429 RATE_LIMITED over the per-IP limit', async () => {
    h.allowed = false
    const res = await get('Decatur')
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'Too many requests.', code: 'RATE_LIMITED' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('answers 200 null, uncached, when the upstream fails, and logs nothing', async () => {
    globalThis.fetch = fakeFetch(null, false)
    const res = await get('Decatur')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: null })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    for (const spy of logSpies) expect(spy).not.toHaveBeenCalled()
  })
})
