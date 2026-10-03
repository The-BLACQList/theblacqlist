// =============================================================================
// Near me on the home hero and the map (2026-10-02)
// =============================================================================
// Founder: "There should be a button in the hero header on the home page with a
// near me option/filter. Same for the map page."
//
// The hero chip hands off to Discover's existing radius search through
// nearMeHref(). The map filters in the browser, because it already holds every
// pinned listing, so the distance math here has to agree with the RPC's
// haversine closely enough that the two never disagree about a 1 mile radius.
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

import { DEFAULT_RADIUS_MILES, nearMeHref } from '@/lib/listings/location-params'
import { distanceMiles, formatMiles, radiusBounds, radiusRing } from '@/lib/map/distance'
import { NO_FILTERS, activeFilterCount, filterListings, sortByDistance } from '@/lib/map/filterListings'
import type { MapListing } from '@/lib/map/types'

const ROOT = path.resolve(__dirname, '..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

// A fixed test origin. One degree of latitude is about 69 miles.
const ORIGIN = { lat: 33.75, lng: -84.39 }
const north = (miles: number) => ({ lat: ORIGIN.lat + miles / 69.05, lng: ORIGIN.lng })

function listing(id: string, at: { lat: number; lng: number }): MapListing {
  return {
    id,
    name: id,
    entityType: 'business',
    href: `/b/${id}`,
    category: 'Beauty',
    categorySlug: 'beauty',
    citySlug: 'atlanta-ga',
    cityName: 'Atlanta',
    trustTier: 'claimed',
    logoSrc: null,
    ownershipLabel: 'black_owned',
    avgRating: null,
    reviewCount: 0,
    isFeatured: false,
    isSponsored: false,
    priceRange: null,
    hours: null,
    coverSrc: null,
    ...at,
  }
}

describe('distanceMiles', () => {
  it('is zero to itself and the same both ways', () => {
    expect(distanceMiles(ORIGIN, ORIGIN)).toBe(0)
    const b = { lat: 33.8, lng: -84.3 }
    expect(distanceMiles(ORIGIN, b)).toBeCloseTo(distanceMiles(b, ORIGIN), 10)
  })

  it('measures a degree of latitude as about 69 miles', () => {
    expect(distanceMiles(ORIGIN, { lat: ORIGIN.lat + 1, lng: ORIGIN.lng })).toBeCloseTo(69.09, 1)
  })

  it('shrinks a degree of longitude away from the equator', () => {
    const east = distanceMiles(ORIGIN, { lat: ORIGIN.lat, lng: ORIGIN.lng + 1 })
    expect(east).toBeGreaterThan(55)
    expect(east).toBeLessThan(60)
  })
})

describe('radiusBounds and radiusRing', () => {
  it('the box reaches the radius in every direction', () => {
    const [[w, s], [e, n]] = radiusBounds(ORIGIN, 5)
    for (const edge of [
      { lat: n, lng: ORIGIN.lng },
      { lat: s, lng: ORIGIN.lng },
      { lat: ORIGIN.lat, lng: e },
      { lat: ORIGIN.lat, lng: w },
    ]) {
      expect(distanceMiles(ORIGIN, edge)).toBeGreaterThanOrEqual(4.95)
    }
  })

  it('the ring is closed and every point sits on the radius', () => {
    const ring = radiusRing(ORIGIN, 10, 32)
    expect(ring).toHaveLength(33)
    expect(ring[0]![0]).toBeCloseTo(ring[32]![0], 10)
    expect(ring[0]![1]).toBeCloseTo(ring[32]![1], 10)
    for (const [lng, lat] of ring) {
      expect(distanceMiles(ORIGIN, { lat, lng })).toBeCloseTo(10, 0)
    }
  })
})

describe('formatMiles', () => {
  it('shows tenths under 10 miles and whole miles above', () => {
    expect(formatMiles(0.44)).toBe('0.4 mi')
    expect(formatMiles(3)).toBe('3.0 mi')
    expect(formatMiles(12.6)).toBe('13 mi')
  })
})

describe('filterListings with near', () => {
  const close = listing('close', north(0.5))
  const mid = listing('mid', north(4))
  const far = listing('far', north(12))
  const all = [far, mid, close]

  it('keeps only listings inside the radius', () => {
    const near = { ...ORIGIN, radiusMiles: 5 }
    expect(filterListings(all, { ...NO_FILTERS, near }).map((l) => l.id).sort()).toEqual(['close', 'mid'])
    expect(filterListings(all, { ...NO_FILTERS, near: { ...near, radiusMiles: 1 } }).map((l) => l.id)).toEqual([
      'close',
    ])
  })

  it('keeps everything once near is cleared', () => {
    expect(filterListings(all, NO_FILTERS)).toHaveLength(3)
    expect(NO_FILTERS.near).toBeNull()
  })

  it('counts as an active filter', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0)
    expect(activeFilterCount({ ...NO_FILTERS, near: { ...ORIGIN, radiusMiles: 10 } })).toBe(1)
  })

  it('sorts nearest first and respects the list limit', () => {
    expect(sortByDistance(all, ORIGIN).map((l) => l.id)).toEqual(['close', 'mid', 'far'])
    expect(sortByDistance(all, ORIGIN, 2).map((l) => l.id)).toEqual(['close', 'mid'])
  })
})

describe('nearMeHref', () => {
  it('opens Discover at the default radius, nearest first, with rounded coordinates', () => {
    const href = nearMeHref(33.7490123, -84.3879876)
    const url = new URL(href, 'https://example.test')
    expect(url.pathname).toBe('/discover')
    expect(url.searchParams.get('lat')).toBe('33.749')
    expect(url.searchParams.get('lng')).toBe('-84.388')
    expect(url.searchParams.get('radius')).toBe(String(DEFAULT_RADIUS_MILES))
    expect(url.searchParams.get('sort')).toBe('distance')
  })
})

describe('Near me placement', () => {
  it('leads the home hero quick filters and keeps the hero a server component', () => {
    const hero = read('components/home/HomeHero.tsx')
    expect(hero).not.toMatch(/^'use client'/)
    expect(hero).toContain('<HeroQuickFilters filters={QUICK_FILTERS} />')
    const chips = read('components/home/HeroQuickFilters.tsx')
    expect(chips.indexOf("'Near me'")).toBeLessThan(chips.indexOf('filters.map('))
    expect(chips).toContain('nearMeHref(pos.coords.latitude, pos.coords.longitude)')
  })

  // Founder 2026-10-03: no settings message between the visitor and results.
  it('a blocked or failed location still opens Discover, with no settings message', () => {
    const chips = read('components/home/HeroQuickFilters.tsx')
    expect(chips).toContain("const FALLBACK_HREF = '/discover'")
    expect(chips).toContain('() => router.push(FALLBACK_HREF)')
    expect(chips).not.toMatch(/browser settings/i)
  })

  it('on phones the hero copy sits below her face', () => {
    const hero = read('components/home/HomeHero.tsx')
    expect(hero).toContain('flex items-end md:items-center')
    expect(hero).toContain('object-[80%_0%] md:object-[center_20%]')
    expect(hero).toContain('pt-[200px] pb-10 md:py-20')
  })

  it('leads the map quick filters as a pressed toggle', () => {
    const src = read('components/map/MapFilterControls.tsx')
    expect(src).toMatch(/aria-pressed=\{near !== null\}/)
    expect(src.indexOf("'Near me'")).toBeLessThan(src.indexOf('Open now'))
  })

  it('never logs the position', () => {
    for (const rel of [
      'components/home/HeroQuickFilters.tsx',
      'components/map/MapExplore.tsx',
      'components/map/useNearMeOverlay.ts',
    ]) {
      expect(read(rel)).not.toMatch(/console\.\w+\([^)]*(coords|near\b|lat\b|lng\b)/)
    }
  })
})
