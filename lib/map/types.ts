import type { WeeklyHours } from '@/types'

export type TrustTier = 'unclaimed' | 'claimed' | 'verified' | 'certified'

/** One business on the map, flattened from the /api/map/listings GeoJSON. */
export interface MapListing {
  id: string
  name: string
  entityType: string
  href: string
  category: string | null
  categorySlug: string | null
  citySlug: string | null
  cityName: string | null
  trustTier: TrustTier
  logoSrc: string | null
  ownershipLabel: string
  avgRating: number | null
  reviewCount: number
  isFeatured: boolean
  isSponsored: boolean
  priceRange: string | null
  hours: WeeklyHours | null
  coverSrc: string | null
  lng: number
  lat: number
}

export const TIER_LABEL: Record<TrustTier, string> = {
  certified: 'Certified',
  verified: 'Verified',
  claimed: 'Claimed',
  unclaimed: 'Unclaimed',
}

/** The visitor's own position and how far from it to look. Never leaves the browser. */
export interface NearMe {
  lat: number
  lng: number
  radiusMiles: number
}

export interface MapFilters {
  openNow: boolean
  trustOnly: boolean
  categorySlug: string
  entityType: string
  query: string
  near: NearMe | null
}

export interface MapOption {
  value: string
  label: string
}

/** Everything the search and filter controls need, shared by panel and phone bar. */
export interface MapFilterProps {
  filters: MapFilters
  onFilters: (patch: Partial<MapFilters>) => void
  categories: MapOption[]
  entityTypes: MapOption[]
  citySlug: string
  onCity: (slug: string) => void
  /** Asks the browser for a position and turns Near me on. */
  onNearMe: () => void
  /** Changes the Near me radius and refits the map to it. */
  onRadius: (miles: number) => void
  /** True while the browser is still working out where the visitor is. */
  locating: boolean
}

/** What the results list (desktop panel or phone sheet) needs. */
export interface MapResultsProps {
  /** Ranked listings in view, same order the pins are numbered from. Nearest first while Near me is on. */
  listings: MapListing[]
  numbers: Map<string, number>
  inViewCount: number
  loading: boolean
  loadError: boolean
  selectedId: string | null
  onHover: (id: string | null) => void
  onSelect: (listing: MapListing) => void
  /** Set while Near me is on: cards show their distance, and the empty state offers a wider radius. */
  near: NearMe | null
  onRadius: (miles: number) => void
}
