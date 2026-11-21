import { canAccess, locationLimit } from '@/lib/stripe/features'
import { buildEntityUrl } from '@/lib/listings/url'
import type { LocationLink } from '@/types'

// Multi-location accounts (ticket 110). Pure rules shared by the owner actions
// and the public page loader. On Premium an owner links a main page (the
// primary) and up to 2 more locations, and each shows the others under Also
// At. Since ticket 238 links are display only: the owner's plan, not a link,
// decides which pages are covered.

export const LOCATION_LINK_COLUMNS = 'location_listing_id, primary_listing_id, created_at'

export interface LocationLinkRow {
  location_listing_id: string
  primary_listing_id: string
  created_at: string
}

/** Locations a page on this plan can link, not counting itself. */
export function linkedSlots(tier: string | null): number {
  const limit = locationLimit(tier)
  if (limit === null) return Number.POSITIVE_INFINITY
  return Math.max(0, limit - 1)
}

/** Whether a page on this plan covers linked locations at all. */
export function coversLocations(tier: string | null): boolean {
  return canAccess(tier, 'multi_location') && linkedSlots(tier) > 0
}

/** Drops malformed rows and sorts oldest link first (the order slots are given in). */
export function toLocationLinkRows(rows: unknown): LocationLinkRow[] {
  if (!Array.isArray(rows)) return []
  const out: LocationLinkRow[] = []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const row = r as Record<string, unknown>
    if (
      typeof row.location_listing_id !== 'string' ||
      typeof row.primary_listing_id !== 'string' ||
      typeof row.created_at !== 'string'
    ) {
      continue
    }
    out.push({
      location_listing_id: row.location_listing_id,
      primary_listing_id: row.primary_listing_id,
      created_at: row.created_at,
    })
  }
  return out.sort((a, b) => a.created_at.localeCompare(b.created_at))
}

// ── The public "Also At" list ────────────────────────────────────────────────

export interface LocationListingRow {
  id: string
  slug: string
  name: string
  entity_type: string
  cities: { name: string; slug: string } | null
  listing_details_business: {
    address_line_1: string | null
    city_text: string | null
    lat: number | null
    lng: number | null
  } | null
}

/**
 * The group's other published pages, primary first then in link order.
 * `order` is the group's ids in that order; `rows` are whatever the read
 * returned (unpublished or deleted pages are simply absent).
 */
export function toLocationLinks(
  selfId: string,
  order: string[],
  rows: LocationListingRow[]
): LocationLink[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const out: LocationLink[] = []
  for (const id of order) {
    if (id === selfId) continue
    const row = byId.get(id)
    if (!row || !row.slug) continue
    const det = Array.isArray(row.listing_details_business)
      ? (row.listing_details_business[0] ?? null)
      : row.listing_details_business
    out.push({
      id: row.id,
      label: row.name,
      cityName: row.cities?.name ?? det?.city_text ?? '',
      addressLine: det?.address_line_1 ?? null,
      href: buildEntityUrl(row.entity_type, row.cities?.slug, row.slug),
      lat: typeof det?.lat === 'number' ? det.lat : null,
      lng: typeof det?.lng === 'number' ? det.lng : null,
    })
  }
  return out
}
