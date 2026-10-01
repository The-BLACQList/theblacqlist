import { isOpenNow } from '@/lib/listings/openStatus'
import type { MapFilters, MapListing } from '@/lib/map/types'

export type { MapFilters }

export const NO_FILTERS: MapFilters = {
  openNow: false,
  trustOnly: false,
  categorySlug: '',
  entityType: '',
  query: '',
}

/** How many filters are switched on. The search text is not counted. */
export function activeFilterCount(f: MapFilters): number {
  return [f.openNow, f.trustOnly, f.categorySlug !== '', f.entityType !== ''].filter(Boolean).length
}

export function filterListings(listings: readonly MapListing[], f: MapFilters): MapListing[] {
  const q = f.query.trim().toLowerCase()
  return listings.filter((l) => {
    if (f.openNow && !(l.hours && isOpenNow(l.hours).open)) return false
    if (f.trustOnly && l.trustTier !== 'verified' && l.trustTier !== 'certified') return false
    if (f.categorySlug && l.categorySlug !== f.categorySlug) return false
    if (f.entityType && l.entityType !== f.entityType) return false
    if (q && !`${l.name} ${l.category ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })
}
