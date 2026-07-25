// Canonical value sets — these MUST match the LIVE DB CHECK constraints, which
// are set by migration `20260524000001_fix_entity_location_cta_constraints`
// (+ `20260622000007` re-adding 'event' to entity_type). NOTE: these differ from
// the original `20260510000000` schema — that earlier constraint was superseded.
// Do not "reconcile" against the initial schema; 20260524000001 is the truth.
export const VALID_ENTITY_TYPES = [
  'business',
  'restaurant',
  'service_provider',
  'creative',
  'professional',
  'vendor',
  'event',
] as const

// Authoritative business ownership label (listings.ownership_label CHECK, set by
// migration `20260707000000_listings_ownership_label`). Single-select, required
// at submission. 'black_owned' = majority (>=51%) Black ownership + operational
// control; 'ally' = supports Black-owned businesses, not itself Black-owned.
// Black-Owned is centered by editorial ranking only — NOT a commerce gate.
export const VALID_OWNERSHIP_LABELS = ['black_owned', 'ally'] as const

export type OwnershipLabel = (typeof VALID_OWNERSHIP_LABELS)[number]

export const OWNERSHIP_LABEL_META: Record<
  OwnershipLabel,
  { label: string; shortLabel: string }
> = {
  black_owned: { label: 'Black-Owned', shortLabel: 'Black-Owned' },
  ally: { label: 'Ally', shortLabel: 'Ally' },
}

export const VALID_LOCATION_TYPES = [
  'physical',
  'virtual',
  'hybrid',
  'service_area',
  'national',
  'traveling',
] as const

export const VALID_CTA_TYPES = [
  'book',
  'order',
  'call',
  'message',
  'visit',
  'get-quote',
  'shop',
  'subscribe',
  'contact',
  'commission',
  'inquire',
  'get-tickets',
  'rsvp',
  'register',
  'learn-more',
  'apply',
  'buy-now',
] as const

// Owner-managed flexible link types (listing_links.link_type). Lives here (a
// plain module) — NOT in the 'use server' action — because client components
// import it; a non-function export from a 'use server' file is replaced by a
// server-action reference on the client (breaking `LINK_TYPES.map`).
export const LINK_TYPES = [
  'website',
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'linkedin',
  'twitter',
  'booking',
  'menu',
  'order',
  'other',
] as const

export type LinkType = (typeof LINK_TYPES)[number]
