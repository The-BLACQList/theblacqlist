import { isOpenNow } from '@/lib/listings/openStatus'
import { distanceMiles } from '@/lib/map/distance'
import { LIST_LIMIT } from '@/lib/map/rankListings'
import type { MapFilters, MapListing } from '@/lib/map/types'

export type { MapFilters }

export const NO_FILTERS: MapFilters = {
  openNow: false,
  trustOnly: false,
  categorySlug: '',
  entityType: '',
  query: '',
  near: null,
}

/** How many filters are switched on. The search text is not counted. */
export function activeFilterCount(f: MapFilters): number {
  return [f.openNow, f.trustOnly, f.categorySlug !== '', f.entityType !== '', f.near !== null].filter(Boolean).length
}

export function filterListings(listings: readonly MapListing[], f: MapFilters): MapListing[] {
  const q = f.query.trim().toLowerCase()
  return listings.filter((l) => {
    if (f.openNow && !(l.hours && isOpenNow(l.hours).open)) return false
    if (f.trustOnly && l.trustTier !== 'verified' && l.trustTier !== 'certified') return false
    if (f.categorySlug && l.categorySlug !== f.categorySlug) return false
    if (f.entityType && l.entityType !== f.entityType) return false
    if (q && !`${l.name} ${l.category ?? ''}`.toLowerCase().includes(q)) return false
    if (f.near && distanceMiles(f.near, l) > f.near.radiusMiles) return false
    return true
  })
}

/** Nearest first, for the list and the pin numbers while Near me is on. */
export function sortByDistance(
  listings: readonly MapListing[],
  from: { lat: number; lng: number },
  limit = LIST_LIMIT
): MapListing[] {
  return listings
    .map((l) => ({ l, d: distanceMiles(from, l) }))
    .sort((a, b) => a.d - b.d || a.l.name.localeCompare(b.l.name))
    .slice(0, limit)
    .map(({ l }) => l)
}
