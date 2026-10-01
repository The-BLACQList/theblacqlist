// =============================================================================
// Map popup geometry, pin numbering and list filtering
// =============================================================================
// popupOffset(): MapLibre zeroes any anchor an offset object omits, so a partial
// object puts the card on top of the pin when it flips near a viewport edge. The
// card must also clear the 64px selected pin and its name pill.
//
// rankListings / pinNumbers: the numbers on the map and the numbers on the cards
// come from one ordering, and unclaimed listings never get a photo pin.
// =============================================================================

import { describe, it, expect } from 'vitest'

import {
  NAME_PILL_HEIGHT,
  POPUP_ANCHORS,
  SELECTED_PIN_RADIUS,
  popupAnchor,
  popupOffset,
} from '@/lib/map/popupOffset'
import { PIN_LIMIT, listingPhoto, pinNumbers, rankListings } from '@/lib/map/rankListings'
import { NO_FILTERS, activeFilterCount, filterListings } from '@/lib/map/filterListings'
import type { MapListing, TrustTier } from '@/lib/map/types'

function listing(id: string, trustTier: TrustTier, extra: Partial<MapListing> = {}): MapListing {
  return {
    id,
    name: id,
    entityType: 'business',
    href: `/b/${id}`,
    category: 'Beauty',
    categorySlug: 'beauty',
    citySlug: 'atlanta-ga',
    cityName: 'Atlanta',
    trustTier,
    logoSrc: null,
    ownershipLabel: 'black_owned',
    avgRating: null,
    reviewCount: 0,
    isFeatured: false,
    isSponsored: false,
    priceRange: null,
    hours: null,
    coverSrc: null,
    lng: -84.4,
    lat: 33.7,
    ...extra,
  }
}

describe('popupOffset', () => {
  const offset = popupOffset()

  it('defines every anchor MapLibre can flip to', () => {
    for (const anchor of POPUP_ANCHORS) expect(offset[anchor]).toBeDefined()
    expect(Object.keys(offset).sort()).toEqual([...POPUP_ANCHORS].sort())
  })

  it('clears the selected pin on every side', () => {
    expect(offset.left[0]).toBeGreaterThan(SELECTED_PIN_RADIUS)
    expect(-offset.right[0]).toBeGreaterThan(SELECTED_PIN_RADIUS)
    expect(-offset.bottom[1]).toBeGreaterThan(SELECTED_PIN_RADIUS)
  })

  it('clears the name pill when the card sits below the pin', () => {
    expect(offset.top[1]).toBeGreaterThan(SELECTED_PIN_RADIUS + NAME_PILL_HEIGHT)
  })
})

describe('popupAnchor', () => {
  it('opens beside the pin, to its right, by default', () => {
    expect(popupAnchor(400, 400, 1000, 800)).toBe('left')
  })
  it('flips left near the right edge', () => {
    expect(popupAnchor(900, 400, 1000, 800)).toBe('right')
  })
  it('shifts down near the top and up near the bottom', () => {
    expect(popupAnchor(400, 40, 1000, 800)).toBe('top-left')
    expect(popupAnchor(900, 780, 1000, 800)).toBe('bottom-right')
  })
})

describe('rankListings', () => {
  it('puts sponsored first, then higher trust, then name', () => {
    const ranked = rankListings([
      listing('b-claimed', 'claimed'),
      listing('a-certified', 'certified'),
      listing('c-sponsored', 'unclaimed', { isSponsored: true }),
      listing('a-claimed', 'claimed'),
    ])
    expect(ranked.map((l) => l.id)).toEqual(['c-sponsored', 'a-certified', 'a-claimed', 'b-claimed'])
  })

  it('caps the list', () => {
    const many = Array.from({ length: 80 }, (_, i) => listing(`l${i}`, 'claimed'))
    expect(rankListings(many)).toHaveLength(60)
  })
})

describe('pinNumbers', () => {
  it('numbers in ranked order starting at 1', () => {
    const nums = pinNumbers([listing('a', 'certified'), listing('b', 'verified')])
    expect([...nums.entries()]).toEqual([
      ['a', 1],
      ['b', 2],
    ])
  })

  it('never numbers an unclaimed listing and keeps numbers contiguous', () => {
    const nums = pinNumbers([listing('a', 'claimed'), listing('u', 'unclaimed'), listing('b', 'claimed')])
    expect(nums.has('u')).toBe(false)
    expect(nums.get('b')).toBe(2)
  })

  it('stops at the pin limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => listing(`l${i}`, 'verified'))
    expect(pinNumbers(many).size).toBe(PIN_LIMIT)
  })
})

describe('listingPhoto', () => {
  it('prefers the cover, falls back to the logo, then null', () => {
    expect(listingPhoto({ coverSrc: 'c', logoSrc: 'l' })).toBe('c')
    expect(listingPhoto({ coverSrc: null, logoSrc: 'l' })).toBe('l')
    expect(listingPhoto({ coverSrc: null, logoSrc: null })).toBeNull()
  })
})

describe('filterListings', () => {
  const all = [
    listing('Crown and Coil', 'verified'),
    listing('Soul Kitchen', 'claimed', { category: 'Food', categorySlug: 'food', entityType: 'restaurant' }),
  ]

  it('returns everything with no filters', () => {
    expect(filterListings(all, NO_FILTERS)).toHaveLength(2)
    expect(activeFilterCount(NO_FILTERS)).toBe(0)
  })

  it('searches name and category, ignoring case', () => {
    expect(filterListings(all, { ...NO_FILTERS, query: 'crown' }).map((l) => l.id)).toEqual(['Crown and Coil'])
    expect(filterListings(all, { ...NO_FILTERS, query: 'FOOD' }).map((l) => l.id)).toEqual(['Soul Kitchen'])
  })

  it('applies trust, category and type filters together', () => {
    expect(filterListings(all, { ...NO_FILTERS, trustOnly: true })).toHaveLength(1)
    expect(filterListings(all, { ...NO_FILTERS, categorySlug: 'food', entityType: 'restaurant' })).toHaveLength(1)
    expect(activeFilterCount({ ...NO_FILTERS, trustOnly: true, categorySlug: 'food' })).toBe(2)
  })
})
