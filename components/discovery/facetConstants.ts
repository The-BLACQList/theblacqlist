import { LOCATION_TYPE_META, VALID_LOCATION_TYPES } from '@/lib/constants/listing'
import type { EntityType, LocationType } from '@/types'

export const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: 'business', label: 'Businesses' },
  { value: 'restaurant', label: 'Restaurants' },
  { value: 'service_provider', label: 'Services' },
  { value: 'professional', label: 'Professionals' },
  { value: 'creative', label: 'Creatives' },
  { value: 'event', label: 'Events' },
  { value: 'job', label: 'Jobs' },
  { value: 'vendor', label: 'Vendors' },
]

/**
 * Where a business operates — the axis that answers "show me the online-only and
 * no-permanent-address businesses". Values are the live `listings.location_type`
 * CHECK (migration 20260524000001); labels are plain language, not the raw slugs.
 * No per-option counts, matching Ownership and Trust Level below.
 *
 * Derived from LOCATION_TYPE_META rather than recopied: this list and the entity
 * page disagreed about what to call a `service_area` business until 2026-09-03.
 * The chip order is the CHECK's own order.
 */
export const LOCATION_TYPES: { value: LocationType; label: string }[] =
  VALID_LOCATION_TYPES.map((value) => ({ value, label: LOCATION_TYPE_META[value].label }))

export const TRUST_TIERS: { value: string; label: string }[] = [
  { value: 'claimed', label: 'Claimed' },
  { value: 'verified', label: 'Verified' },
  { value: 'certified', label: 'BLACQList Certified' },
]

export const OWNERSHIP_LABELS: { value: string; label: string }[] = [
  { value: 'black_owned', label: 'Black-Owned' },
  { value: 'ally', label: 'Ally' },
]

// Every entity_type the DB serves now has a chip above, so this map needs no
// extra entries. It previously carried 'restaurant' and 'service_provider' as
// hand-added overrides under a comment calling them "DB-only types outside the
// TS union" — that comment was stale from 2026-08-13, when the union gained both.
export const ENTITY_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  ENTITY_TYPES.map((t) => [t.value, t.label])
)

export const LOCATION_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  LOCATION_TYPES.map((t) => [t.value, t.label])
)

export const TRUST_TIER_LABEL: Record<string, string> = Object.fromEntries(
  TRUST_TIERS.map((t) => [t.value, t.label])
)

export const OWNERSHIP_LABEL_MAP: Record<string, string> = Object.fromEntries(
  OWNERSHIP_LABELS.map((t) => [t.value, t.label])
)
