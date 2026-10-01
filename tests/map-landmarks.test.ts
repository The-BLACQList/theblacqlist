// =============================================================================
// Map landmarks: the basemap's curated POIs and our own landmark list
// =============================================================================
// Founder feedback 2026-10-01: the map "doesn't feel detailed enough with
// recognizable landmarks for people." Two layers answer it:
//
//   • The basemap `pois` layer, narrowed to places people navigate by (parks,
//     stadiums, campuses, museums, stations). Shops and restaurants stay out
//     because our listings are the businesses on this map.
//
//   • Our own list of HBCUs and Black history and culture districts, in
//     lib/map/landmarks.ts. Every entry carries the source its coordinates were
//     checked against, and must sit inside the city it is filed under, so a
//     typo in a coordinate cannot drop a landmark in another state.
// =============================================================================

import { describe, it, expect } from 'vitest'

import { buildMapStyle, CITY_VIEWS, LANDMARK_KINDS } from '@/components/map/mapStyle'
import { LANDMARKS, toLandmarkGeoJSON } from '@/lib/map/landmarks'

/** About 35 km: wide enough for a metro, far too tight for a swapped sign or digit. */
const CITY_RADIUS_DEG = 0.35

describe('our landmark list', () => {
  it('has entries for every city the map flies to', () => {
    for (const slug of Object.keys(CITY_VIEWS)) {
      expect(LANDMARKS.some((l) => l.city === slug), slug).toBe(true)
    }
  })

  it('cites a source for every entry', () => {
    for (const l of LANDMARKS) expect(l.source, l.id).toMatch(/^https:\/\/\S+$/)
  })

  it('has unique ids', () => {
    const ids = LANDMARKS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('places every entry inside the city it is filed under', () => {
    for (const l of LANDMARKS) {
      const view = CITY_VIEWS[l.city]
      expect(view, `${l.id} has unknown city ${l.city}`).toBeDefined()
      if (!view) continue
      const [lng, lat] = view.center
      expect(Math.abs(l.lng - lng), `${l.id} lng`).toBeLessThan(CITY_RADIUS_DEG)
      expect(Math.abs(l.lat - lat), `${l.id} lat`).toBeLessThan(CITY_RADIUS_DEG)
    }
  })

  it('builds a point FeatureCollection with the label in properties', () => {
    const fc = toLandmarkGeoJSON()
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features).toHaveLength(LANDMARKS.length)
    for (const f of fc.features) {
      expect(f.geometry.type).toBe('Point')
      expect(typeof f.properties.name).toBe('string')
    }
  })
})

describe('basemap landmarks', () => {
  const style = buildMapStyle('https://example.test/tiles.pmtiles')
  const pois = style.layers.find((l) => l.id === 'pois')

  it('keeps the pois layer', () => {
    expect(pois?.type).toBe('symbol')
  })

  it('narrows it to the curated landmark kinds', () => {
    const filter = JSON.stringify(pois && 'filter' in pois ? pois.filter : null)
    expect(filter).toContain(JSON.stringify([...LANDMARK_KINDS]))
    for (const noisy of ['restaurant', 'cafe', 'bus_stop', 'supermarket']) {
      expect(filter).not.toContain(`"${noisy}"`)
    }
  })
})
