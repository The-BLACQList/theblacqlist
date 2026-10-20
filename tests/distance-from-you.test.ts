// =============================================================================
// lib/listings/distanceFromYou.ts: distanceFromYouLabel
// =============================================================================
// The listing page's "About X mi from you" line (tester ask, 2026-10-19).
// =============================================================================

import { describe, it, expect } from 'vitest'

import { cardDistanceLabel, distanceFromYouLabel } from '@/lib/listings/distanceFromYou'

// Union Station, Washington DC, and a point about 1.4 miles north.
const UNION_STATION = { lat: 38.8973, lng: -77.0063 }

describe('distanceFromYouLabel', () => {
  it('gives one decimal under 10 miles', () => {
    expect(distanceFromYouLabel(UNION_STATION, { lat: 38.9175, lng: -77.0063 })).toBe(
      'About 1.4 mi from you'
    )
  })

  it('rounds to whole miles from 10 up', () => {
    // BWI Marshall airport, about 27 miles from Union Station as the crow flies.
    const label = distanceFromYouLabel(UNION_STATION, { lat: 39.1774, lng: -76.6684 })
    expect(label).toMatch(/^About \d+ mi from you$/)
    expect(label).toBe('About 27 mi from you')
  })

  it('never says 0.0 mi', () => {
    expect(distanceFromYouLabel(UNION_STATION, { lat: 38.8974, lng: -77.0063 })).toBe(
      'Less than 0.1 mi from you'
    )
  })

  it('is null when the listing has no pin', () => {
    expect(distanceFromYouLabel(UNION_STATION, { lat: null, lng: -77 })).toBeNull()
    expect(distanceFromYouLabel(UNION_STATION, { lat: 38.9, lng: null })).toBeNull()
  })
})

// Ticket 141: the same line on Discover and Search cards.
describe('cardDistanceLabel', () => {
  const pinned = { location_type: 'physical' as const, lat: 38.9175, lng: -77.0063 }

  it('matches the listing page wording', () => {
    expect(cardDistanceLabel(UNION_STATION, pinned)).toBe('About 1.4 mi from you')
  })

  it('is null without a position, so the card reads as before', () => {
    expect(cardDistanceLabel(null, pinned)).toBeNull()
  })

  it('is null when the listing has no pin', () => {
    expect(cardDistanceLabel(UNION_STATION, { ...pinned, lat: null, lng: null })).toBeNull()
    expect(cardDistanceLabel(UNION_STATION, { location_type: 'physical' })).toBeNull()
  })

  it('is null for online-only and ships-nationwide listings, even with a pin', () => {
    expect(cardDistanceLabel(UNION_STATION, { ...pinned, location_type: 'virtual' })).toBeNull()
    expect(cardDistanceLabel(UNION_STATION, { ...pinned, location_type: 'national' })).toBeNull()
  })

  it('shows for the place-based types', () => {
    for (const location_type of ['hybrid', 'service_area', 'traveling'] as const) {
      expect(cardDistanceLabel(UNION_STATION, { ...pinned, location_type })).toBe(
        'About 1.4 mi from you'
      )
    }
  })
})
