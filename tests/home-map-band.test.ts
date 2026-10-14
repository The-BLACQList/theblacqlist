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
//   • The homepage picture projects cities with the same math that drew the
//     outline, so a dot lands on its city.
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
import { US_VIEWBOX } from '@/components/home/usOutline'
import { dotRadius, placeLabels, type Box, type Circle } from '@/components/home/HomeMapBand'

describe('stacked basemap', () => {
  const style = buildMapStyle('https://example.test/metros.pmtiles', 'https://example.test/us.pmtiles')

  it('reads the country file through its own source', () => {
    const us = style.sources['protomaps-us']
    expect(us && 'tiles' in us ? us.tiles : null).toEqual(['pmtiles://https://example.test/us.pmtiles/{z}/{x}/{y}'])
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

  it('sizes dots so a bigger city is never drawn smaller', () => {
    expect(dotRadius(160)).toBeGreaterThan(dotRadius(44))
    expect(dotRadius(1)).toBeGreaterThan(18)
  })
})

describe('homepage city names', () => {
  // Prod on 2026-10-14: six live cities and seven coming soon, at their
  // seeded coordinates.
  const live: Array<[string, number, number, number]> = [
    ['Atlanta', -84.388, 33.749, 160],
    ['Houston', -95.3698, 29.7604, 61],
    ['Chicago', -87.6298, 41.8781, 56],
    ['Washington DC', -77.036873, 38.907192, 51],
    ['New Orleans', -90.071533, 29.951065, 49],
    ['Los Angeles', -118.243683, 34.052235, 44],
  ]
  const soon: Array<[number, number]> = [
    [-74.005974, 40.712776],
    [-75.165222, 39.952583],
    [-96.796988, 32.776664],
    [-83.045754, 42.331427],
    [-76.612189, 39.290385],
    [-90.048981, 35.149532],
    [-80.843124, 35.227085],
  ]
  const liveCircles = live.map(([name, lng, lat, count]) => {
    const [x, y] = projectUS(lng, lat)
    return { name, x, y, r: dotRadius(count) }
  })
  const soonCircles: Circle[] = soon.map(([lng, lat]) => {
    const [x, y] = projectUS(lng, lat)
    return { x, y, r: 12 }
  })
  const spots = placeLabels(liveCircles, soonCircles)

  const hits = (b: Box, c: Circle) => {
    const dx = c.x - Math.max(b.x0, Math.min(c.x, b.x1))
    const dy = c.y - Math.max(b.y0, Math.min(c.y, b.y1))
    return dx * dx + dy * dy < c.r * c.r
  }

  it('keeps every name clear of every other dot', () => {
    for (const s of spots) {
      for (const [j, c] of [...liveCircles, ...soonCircles].entries()) {
        if (c !== liveCircles.find((l) => l.name === s.name)) {
          expect(hits(s.label.box, c), `${s.name} over dot ${j}`).toBe(false)
        }
      }
    }
  })

  it('keeps names apart and on the picture', () => {
    spots.forEach(({ label: a }, i) => {
      expect(a.box.x0).toBeGreaterThanOrEqual(0)
      expect(a.box.x1).toBeLessThanOrEqual(US_VIEWBOX.width)
      spots.slice(i + 1).forEach(({ label: b }) => {
        const apart = a.box.x1 <= b.box.x0 || b.box.x1 <= a.box.x0 || a.box.y1 <= b.box.y0 || b.box.y1 <= a.box.y0
        expect(apart).toBe(true)
      })
    })
  })

  it('moves Houston off New Orleans', () => {
    expect(spots.find((s) => s.name === 'Houston')?.label.anchor).not.toBe('start')
  })
})
