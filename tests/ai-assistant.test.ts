// =============================================================================
// The site assistant's shared helpers (tickets 147 and 169)
// =============================================================================
// What lib/ai/assistant.ts still holds after the chat rebuild: the words in a
// business name, the nearest covered cities, and the shared visitor budget
// count. The chat itself is tested in tests/cue-*.test.ts.
// =============================================================================

import { describe, expect, it } from 'vitest'

import { nameWords, nearestCities, visitorCallsUsed, type PointCity } from '@/lib/ai/assistant'

const CITIES: PointCity[] = [
  { slug: 'detroit', name: 'Detroit', isActive: true, lat: 42.3314, lng: -83.0458 },
  { slug: 'atlanta', name: 'Atlanta', isActive: true, lat: 33.749, lng: -84.388 },
  { slug: 'chicago', name: 'Chicago', isActive: true, lat: 41.8781, lng: -87.6298 },
  { slug: 'grand-rapids', name: 'Grand Rapids', isActive: false, lat: 42.9634, lng: -85.6681 },
  { slug: 'nowhere', name: 'Nowhere', isActive: true, lat: null, lng: null },
]

const ANN_ARBOR = { lat: 42.28, lng: -83.74 }

describe('nearestCities', () => {
  it('lists live cities with a point, nearest first', () => {
    expect(nearestCities(ANN_ARBOR, CITIES, 3).map((c) => c.slug)).toEqual(['detroit', 'chicago', 'atlanta'])
  })

  it('skips the cities it is told to', () => {
    expect(nearestCities(ANN_ARBOR, CITIES, 1, ['detroit']).map((c) => c.slug)).toEqual(['chicago'])
  })

  it('never lists a city that is off or has no point', () => {
    const slugs = nearestCities(ANN_ARBOR, CITIES, 10).map((c) => c.slug)
    expect(slugs).not.toContain('grand-rapids')
    expect(slugs).not.toContain('nowhere')
  })
})

describe('visitorCallsUsed', () => {
  it('adds the guide and Cue counts, never below zero', () => {
    expect(visitorCallsUsed(3, 4)).toBe(7)
    expect(visitorCallsUsed(-1, 2)).toBe(2)
  })
})

describe('nameWords', () => {
  it('keeps the words worth matching on', () => {
    expect(nameWords('Law Firms & Legal Services')).toEqual(['law', 'firms', 'legal', 'services'])
    expect(nameWords('The Art of a Cut')).toEqual(['art', 'cut'])
  })
})
