import { canAccess } from '@/lib/stripe/features'
import type { MapListing, TrustTier } from '@/lib/map/types'

const TIER_ORDER: readonly TrustTier[] = ['unclaimed', 'claimed', 'verified', 'certified']

/**
 * Most claimed pages drawn as squares at once (ticket 244, Calm Map). Past
 * this, the rest stay dots until the visitor zooms in. Picked by trust.
 */
export const TILE_LIMIT = 40

/** How many listings the panel and sheet show. */
export const LIST_LIMIT = 60

/**
 * The list order: sponsored or featured first (badged, never a bigger pin),
 * then trust tier, then name. The cards read this order, and the squares on
 * the map are picked from it, so a higher-trust page always wins a slot.
 */
export function rankListings(listings: readonly MapListing[], limit = LIST_LIMIT): MapListing[] {
  return [...listings]
    .sort((a, b) => {
      const promo = Number(b.isSponsored || b.isFeatured) - Number(a.isSponsored || a.isFeatured)
      if (promo !== 0) return promo
      const tier = TIER_ORDER.indexOf(b.trustTier) - TIER_ORDER.indexOf(a.trustTier)
      return tier !== 0 ? tier : a.name.localeCompare(b.name)
    })
    .slice(0, limit)
}

/**
 * Which listings are drawn as squares (ticket 244, Calm Map, founder's pick
 * 2026-11-21). A square is a claimed page standing on its own: `loose` holds
 * the ids the map is not folding into a group at this zoom. Unclaimed pages
 * stay dots. Past `limit` the rest stay dots too, in `ranked` order, so trust
 * decides who gets a square and paying never does: the plan only changes how
 * a square looks. The selected page is always a square when it is claimed.
 *
 * Returned in rank order; the map stacks earlier ones on top.
 */
export function pickTiles(
  ranked: readonly MapListing[],
  loose: ReadonlySet<string>,
  selectedId: string | null,
  limit = TILE_LIMIT
): MapListing[] {
  const tiles: MapListing[] = []
  for (const listing of ranked) {
    if (listing.trustTier === 'unclaimed') continue
    const selected = listing.id === selectedId
    if (!selected && (tiles.length >= limit || !loose.has(listing.id))) continue
    tiles.push(listing)
  }
  return tiles
}

/** The image a pin or card shows: a cover when there is one, else the logo. */
export function listingPhoto(listing: Pick<MapListing, 'coverSrc' | 'logoSrc'>): string | null {
  return listing.coverSrc ?? listing.logoSrc ?? null
}

/**
 * Whether a page's pin is the logo tile (ticket 244): claimed or higher, and
 * on Starter or up. `tier` is the page's plan slug from the listings row.
 */
export function hasLogoPin(trustTier: string, tier: string | null): boolean {
  return trustTier !== 'unclaimed' && canAccess(tier, 'map_logo_pin')
}

/**
 * The image a pin shows (ticket 244). Only a logo pin (Starter and up) shows
 * one: the logo first, else the cover photo. A Free page's pin is the plain
 * numbered tile, so it gets null even when the page has photos.
 */
export function pinImage(
  listing: Pick<MapListing, 'logoPin' | 'logoSrc' | 'coverSrc'>
): { src: string; kind: 'logo' | 'photo' } | null {
  if (!listing.logoPin) return null
  if (listing.logoSrc) return { src: listing.logoSrc, kind: 'logo' }
  if (listing.coverSrc) return { src: listing.coverSrc, kind: 'photo' }
  return null
}
