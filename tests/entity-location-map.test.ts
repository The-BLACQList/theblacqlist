import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildExampleEntity } from '@/lib/example/fixtures'
import { locationPins } from '@/lib/listings/locationPins'

const NOW = new Date('2026-11-13T12:00:00Z')
const source = (path: string) => readFileSync(path, 'utf8')

describe('locationPins', () => {
  const entity = buildExampleEntity('storefront', NOW)

  it('puts the main location first and skips locations with no coordinates', () => {
    const pins = locationPins(entity)
    expect(pins[0]).toMatchObject({
      id: entity.id,
      primary: true,
      lat: entity.details.lat,
      lng: entity.details.lng,
    })
    expect(pins.slice(1).every((p) => !p.primary)).toBe(true)
    const withCoords = (entity.locations ?? []).filter((l) => l.lat != null && l.lng != null)
    expect(pins).toHaveLength(1 + withCoords.length)
    expect(pins.map((p) => p.id)).toEqual([entity.id, ...withCoords.map((l) => l.id)])
  })

  it('is empty when nothing has coordinates', () => {
    const bare = { ...entity, details: { ...entity.details, lat: null, lng: null }, locations: [] }
    expect(locationPins(bare)).toEqual([])
    expect(locationPins({ ...bare, locations: undefined })).toEqual([])
  })

  it('still pins the other locations when only the main one lacks coordinates', () => {
    const pins = locationPins({ ...entity, details: { ...entity.details, lat: null, lng: null } })
    expect(pins.length).toBeGreaterThan(0)
    expect(pins.every((p) => !p.primary)).toBe(true)
  })
})

describe('the Visit map stays out of the page bundle and off live pages', () => {
  it('loads MapLibre through next/dynamic with SSR off, and keeps Open in Maps server-rendered', () => {
    const src = source('components/entity-page/EntityLocationMap.tsx')
    expect(src).toContain("from 'next/dynamic'")
    expect(src).toContain('ssr: false')
    expect(src).not.toContain("from 'maplibre-gl'")
    expect(src).not.toContain('@/components/map/mapStyle')
    expect(src).toContain('Open in Maps')
  })

  it('the canvas reads the self-hosted tiles, never zooms on page scroll and hides its picture', () => {
    const src = source('components/entity-page/LocationMapCanvas.tsx')
    expect(src).toContain("tileTemplate(window.location.origin, 'metros')")
    expect(src).toContain("tileTemplate(window.location.origin, 'us')")
    expect(src).toContain('cooperativeGestures: true')
    expect(src).toContain("setAttribute('aria-hidden', 'true')")
    expect(src).toContain('map.remove()')
  })

  it('At a Glance builds pins in example mode only, until ticket 190 flips live pages on', () => {
    const src = source('components/entity-page/EntityAtAGlance.tsx')
    expect(src).toMatch(/mode === 'example' \? locationPins\(entity\) : \[\]/)
    expect(src).toContain('<SectionMark id="map">')
    expect(src).toContain('<SectionMark id="hours-overrides">')
  })
})
