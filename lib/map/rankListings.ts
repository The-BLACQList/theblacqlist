import type { MapListing, TrustTier } from '@/lib/map/types'

const TIER_ORDER: readonly TrustTier[] = ['unclaimed', 'claimed', 'verified', 'certified']

/** How many in-view listings get a numbered photo pin. */
export const PIN_LIMIT = 8

/** How many listings the panel and sheet show. */
export const LIST_LIMIT = 60

/**
 * The list order: sponsored or featured first (badged, never a bigger pin),
 * then trust tier, then name. The pins and the cards both read from this one
 * order, so number 1 on the map is the first card in the list.
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
 * Which ranked listings wear a number, and which number. Unclaimed listings
 * stay small dots: the presence ladder says identity is earned by trust, so a
 * photo pin is never handed to a business that has not claimed its page.
 * Numbers run 1..limit in ranked order and match the cards.
 */
export function pinNumbers(ranked: readonly MapListing[], limit = PIN_LIMIT): Map<string, number> {
  const numbers = new Map<string, number>()
  for (const listing of ranked) {
    if (numbers.size >= limit) break
    if (listing.trustTier === 'unclaimed') continue
    numbers.set(listing.id, numbers.size + 1)
  }
  return numbers
}

/** The image a pin or card shows: a cover when there is one, else the logo. */
export function listingPhoto(listing: Pick<MapListing, 'coverSrc' | 'logoSrc'>): string | null {
  return listing.coverSrc ?? listing.logoSrc ?? null
}
