// =============================================================================
// Map popup geometry, which pages are squares, and list filtering
// =============================================================================
// popupOffset(): MapLibre zeroes any anchor an offset object omits, so a partial
// object puts the card on top of the pin when it flips near a viewport edge. The
// card must also clear the 50px selected tile (standing on its caret above the
// coordinate, ticket 244) and its name pill, or a selected dot.
//
// Ticket 244, Calm Map: no rank numbers. pickTiles decides which claimed pages
// are squares, trusted first; unclaimed pages stay dots. The plan changes only
// the look of a square (hasLogoPin, pinImage, pinKey), never who gets one.
// =============================================================================

import { describe, it, expect } from 'vitest'

import {
  NAME_PILL_HEIGHT,
  SELECTED_DOT_RADIUS,
  POPUP_ANCHORS,
  SELECTED_TILE,
  TILE_CENTER_LIFT,
  TILE_TOP_LIFT,
  popupAnchor,
  popupOffset,
} from '@/lib/map/popupOffset'
import {
  TILE_LIMIT,
  hasLogoPin,
  listingPhoto,
  pickTiles,
  pinImage,
  rankListings,
} from '@/lib/map/rankListings'
import { pinInitials, pinKey } from '@/components/map/photoPin'
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
    street: null,
    state: null,
    zip: null,
    trustTier,
    logoSrc: null,
    logoPin: false,
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

  it('clears the selected tile on every side', () => {
    const reach = SELECTED_TILE / 2
    expect(offset.left[0]).toBeGreaterThan(reach)
    expect(-offset.right[0]).toBeGreaterThan(reach)
    expect(-offset.bottom[1]).toBeGreaterThan(TILE_TOP_LIFT)
  })

  it('lines a side card up with the tile, which stands above the coordinate', () => {
    expect(offset.left[1]).toBe(-TILE_CENTER_LIFT)
    expect(offset.right[1]).toBe(-TILE_CENTER_LIFT)
    expect(offset['top-left'][1]).toBe(-TILE_TOP_LIFT)
  })

  it('clears the name pill when the card sits below the pin', () => {
    expect(offset.top[1]).toBeGreaterThan(NAME_PILL_HEIGHT)
  })

  it('centres on a selected dot and clears its ring', () => {
    const dot = popupOffset('dot')
    expect(Object.keys(dot).sort()).toEqual([...POPUP_ANCHORS].sort())
    expect(dot.center).toEqual([0, 0])
    expect(dot.left[0]).toBeGreaterThan(SELECTED_DOT_RADIUS)
    expect(-dot.right[0]).toBeGreaterThan(SELECTED_DOT_RADIUS)
    expect(dot.top[1]).toBeGreaterThan(SELECTED_DOT_RADIUS)
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

  it('never moves a page up for its plan', () => {
    const ranked = rankListings([
      listing('a-free-certified', 'certified'),
      listing('b-paid-claimed', 'claimed', { logoPin: true }),
    ])
    expect(ranked.map((l) => l.id)).toEqual(['a-free-certified', 'b-paid-claimed'])
  })

  it('caps the list', () => {
    const many = Array.from({ length: 80 }, (_, i) => listing(`l${i}`, 'claimed'))
    expect(rankListings(many)).toHaveLength(60)
  })
})

describe('pickTiles', () => {
  const all = (...ids: string[]) => new Set(ids)

  it('makes a square of each claimed page standing on its own, in rank order', () => {
    const tiles = pickTiles([listing('a', 'certified'), listing('b', 'claimed')], all('a', 'b'), null)
    expect(tiles.map((l) => l.id)).toEqual(['a', 'b'])
  })

  it('leaves unclaimed pages as dots', () => {
    const tiles = pickTiles([listing('a', 'claimed'), listing('u', 'unclaimed')], all('a', 'u'), null)
    expect(tiles.map((l) => l.id)).toEqual(['a'])
  })

  it('leaves a page inside a group alone', () => {
    expect(pickTiles([listing('a', 'verified')], all(), null)).toEqual([])
  })

  it('gives the slots by trust, never by plan', () => {
    const ranked = rankListings([
      listing('paid-claimed', 'claimed', { logoPin: true }),
      listing('free-certified', 'certified'),
    ])
    const tiles = pickTiles(ranked, all('paid-claimed', 'free-certified'), null, 1)
    expect(tiles.map((l) => l.id)).toEqual(['free-certified'])
  })

  it('stops at the limit, but always keeps the selected claimed page', () => {
    const many = Array.from({ length: TILE_LIMIT + 5 }, (_, i) => listing(`l${String(i).padStart(2, '0')}`, 'verified'))
    const loose = new Set(many.map((l) => l.id))
    expect(pickTiles(many, loose, null)).toHaveLength(TILE_LIMIT)
    const last = many[many.length - 1]!.id
    const tiles = pickTiles(many, loose, last)
    expect(tiles).toHaveLength(TILE_LIMIT + 1)
    expect(tiles.some((l) => l.id === last)).toBe(true)
  })

  it('never turns a selected unclaimed page into a square', () => {
    expect(pickTiles([listing('u', 'unclaimed')], all('u'), 'u')).toEqual([])
  })
})

describe('hasLogoPin', () => {
  it('gives the logo pin to claimed pages on Starter and up', () => {
    expect(hasLogoPin('claimed', 'starter')).toBe(true)
    expect(hasLogoPin('verified', 'growth')).toBe(true)
    expect(hasLogoPin('certified', 'premium')).toBe(true)
  })
  it('never to a Free page, whatever its trust', () => {
    expect(hasLogoPin('certified', 'free')).toBe(false)
    expect(hasLogoPin('verified', null)).toBe(false)
  })
  it('never to an unclaimed page, whatever its plan', () => {
    expect(hasLogoPin('unclaimed', 'premium')).toBe(false)
  })
})

describe('pinImage', () => {
  it('shows the logo first, then the cover, on a logo pin', () => {
    expect(pinImage({ logoPin: true, logoSrc: 'l', coverSrc: 'c' })).toEqual({ src: 'l', kind: 'logo' })
    expect(pinImage({ logoPin: true, logoSrc: null, coverSrc: 'c' })).toEqual({ src: 'c', kind: 'photo' })
    expect(pinImage({ logoPin: true, logoSrc: null, coverSrc: null })).toBeNull()
  })
  it('shows nothing on a Free pin, even with a logo and photos', () => {
    expect(pinImage({ logoPin: false, logoSrc: 'l', coverSrc: 'c' })).toBeNull()
  })
})

describe('pinKey', () => {
  it('rebuilds the pin when its plan look changes', () => {
    const free = { listing: listing('a', 'verified'), selected: false, named: false }
    const paid = { ...free, listing: listing('a', 'verified', { logoPin: true }) }
    expect(pinKey(free)).not.toBe(pinKey(paid))
  })
  it('rebuilds when the name pill shows or hides', () => {
    const base = { listing: listing('a', 'verified'), selected: true, named: false }
    expect(pinKey(base)).not.toBe(pinKey({ ...base, named: true }))
  })
})

describe('pinInitials', () => {
  it('takes up to two initials', () => {
    expect(pinInitials('Ember Roast Coffee')).toBe('ER')
    expect(pinInitials("  lena's ")).toBe('L')
    expect(pinInitials('Demo — Sample & Co. (Creative)')).toBe('DS')
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
