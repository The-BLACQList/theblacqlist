// =============================================================================
// Map on the whole country (PR 3)
// =============================================================================
// Tester feedback 2026-10-14: "Would have loved to know earlier there was a
// map," and the map opened on Atlanta, so the rest of the country looked empty.
//
//   • The basemap stacks two files: a country file drawn below DETAIL_ZOOM and
//     the metro file from DETAIL_ZOOM up. These tests keep the two from drawing
//     the same thing twice.
//   • /map opens on All cities unless ?city= names a city it knows.
//   • The homepage picture projects its dots with the same math that drew the
//     outline. The dots are illustration only (founder, 2026-10-14): no counts,
//     no names, spread coast to coast.
// =============================================================================

import { describe, it, expect } from 'vitest'

import {
  ALL_CITIES,
  buildMapStyle,
  CITY_CHOICES,
  CITY_VIEWS,
  DETAIL_ZOOM,
  initialCity,
} from '@/components/map/mapStyle'
import { projectUS } from '@/lib/map/albers'
import { tileTemplate } from '@/lib/map/tileUrls'
import { US_VIEWBOX } from '@/components/home/usOutline'
import { BAND_DOTS } from '@/components/home/HomeMapBand'

describe('stacked basemap', () => {
  const style = buildMapStyle(tileTemplate('https://example.test', 'metros'), tileTemplate('https://example.test', 'us'))

  it('reads the country file through its own source, as plain cacheable tiles', () => {
    const us = style.sources['protomaps-us']
    expect(us && 'tiles' in us ? us.tiles : null).toEqual([tileTemplate('https://example.test', 'us')])
  })

  it('never asks for metro tiles at country zoom', () => {
    const metro = style.sources['protomaps']
    expect(metro && 'minzoom' in metro ? metro.minzoom : null).toBe(DETAIL_ZOOM)
  })

  it('has exactly one background', () => {
    expect(style.layers.filter((l) => l.type === 'background')).toHaveLength(1)
  })

  it('keeps country land and water at every zoom', () => {
    for (const id of ['us-earth', 'us-water']) {
      const layer = style.layers.find((l) => l.id === id)
      expect(layer).toBeDefined()
      expect(layer?.maxzoom).toBeUndefined()
    }
  })

  it('hands the rest of the country file off at DETAIL_ZOOM', () => {
    const country = style.layers.filter(
      (l) => 'source' in l && l.source === 'protomaps-us' && !['us-earth', 'us-water'].includes(l.id)
    )
    expect(country.length).toBeGreaterThan(0)
    for (const l of country) {
      expect(l.id.startsWith('us-')).toBe(true)
      expect(l.maxzoom).toBe(DETAIL_ZOOM)
    }
  })

  it('draws no points of interest from the country file', () => {
    expect(style.layers.some((l) => l.id === 'us-pois')).toBe(false)
  })

  it('leaves out the stock green landcover, so country zoom stays sand', () => {
    expect(style.layers.some((l) => l.id === 'us-landcover')).toBe(false)
  })

  it('starts every metro layer at DETAIL_ZOOM or later', () => {
    const metro = style.layers.filter((l) => 'source' in l && l.source === 'protomaps')
    expect(metro.length).toBeGreaterThan(0)
    for (const l of metro) expect(l.minzoom ?? 0).toBeGreaterThanOrEqual(DETAIL_ZOOM)
  })

  it('never repeats a layer id', () => {
    const ids = style.layers.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('initialCity', () => {
  it('opens on All cities by default', () => {
    expect(initialCity(null)).toBe(ALL_CITIES)
    expect(initialCity(undefined)).toBe(ALL_CITIES)
    expect(initialCity('')).toBe(ALL_CITIES)
  })

  it('keeps a deep link to a known city', () => {
    expect(initialCity('chicago-il')).toBe('chicago-il')
  })

  it('ignores a city the map does not know', () => {
    expect(initialCity('atlantis')).toBe(ALL_CITIES)
    expect(initialCity('__proto__')).toBe(ALL_CITIES)
  })

  it('lists All cities first, then every city view', () => {
    expect(CITY_CHOICES[0]).toEqual({ slug: ALL_CITIES, label: 'All cities' })
    expect(CITY_CHOICES.slice(1).map((c) => c.slug)).toEqual(Object.keys(CITY_VIEWS))
  })
})

describe('homepage projection', () => {
  // Expected values from d3-geo geoAlbers with the outline's scale and
  // translate, checked when the outline was generated.
  it.each([
    ['Atlanta', -84.388, 33.749, 709.47, 402.08],
    ['Los Angeles', -118.2437, 34.0522, 75.02, 359.66],
    ['New York', -73.9857, 40.7484, 865.93, 209.92],
    ['New Orleans', -90.0715, 29.951, 607.88, 499.24],
  ])('places %s where d3 does', (_name, lng, lat, x, y) => {
    const [px, py] = projectUS(lng, lat)
    expect(px).toBeCloseTo(x, 1)
    expect(py).toBeCloseTo(y, 1)
  })

  it('puts every city the map flies to inside the outline', () => {
    for (const { center } of Object.values(CITY_VIEWS)) {
      const [x, y] = projectUS(center[0], center[1])
      expect(x).toBeGreaterThan(0)
      expect(x).toBeLessThan(US_VIEWBOX.width)
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThan(US_VIEWBOX.height)
    }
  })

})

describe('homepage picture', () => {
  const points = BAND_DOTS.map((d) => projectUS(d.lng, d.lat))

  it('keeps every dot inside the outline', () => {
    for (const [x, y] of points) {
      expect(x).toBeGreaterThan(20)
      expect(x).toBeLessThan(US_VIEWBOX.width - 20)
      expect(y).toBeGreaterThan(20)
      expect(y).toBeLessThan(US_VIEWBOX.height - 20)
    }
  })

  it('reaches every part of the country, not just a few cities', () => {
    const third = US_VIEWBOX.width / 3
    const west = points.filter(([x]) => x < third).length
    const middle = points.filter(([x]) => x >= third && x < 2 * third).length
    const east = points.filter(([x]) => x >= 2 * third).length
    expect(west).toBeGreaterThanOrEqual(6)
    expect(middle).toBeGreaterThanOrEqual(6)
    expect(east).toBeGreaterThanOrEqual(6)
  })
})
