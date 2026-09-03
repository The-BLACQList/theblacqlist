// Canonical value sets — these MUST match the LIVE DB CHECK constraints, which
// are set by migration `20260524000001_fix_entity_location_cta_constraints`
// (+ `20260622000007` re-adding 'event' and `20260813000000` re-adding 'job' to
// entity_type). NOTE: these differ from the original `20260510000000` schema —
// that earlier constraint was superseded.
// Do not "reconcile" against the initial schema; 20260524000001 is the truth.
export const VALID_ENTITY_TYPES = [
  'business',
  'restaurant',
  'service_provider',
  'creative',
  'professional',
  'vendor',
  'event',
  'job',
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

// Trust ladder (listings.trust_tier CHECK, set by the initial schema
// `20260510000000_initial_blacqlist_mvp_schema` and never superseded — verified
// against every later migration that touches trust_tier). Order is meaningful:
// it is the ladder, lowest to highest. Promotion unclaimed → claimed happens on
// claim approval; claimed → verified is a founder-only grant; verified →
// certified is automatic (see lib/services/trust/certification.ts).
export const VALID_TRUST_TIERS = ['unclaimed', 'claimed', 'verified', 'certified'] as const

export type TrustTier = (typeof VALID_TRUST_TIERS)[number]

// Tiers an admin may set by hand. Every tier is reachable: demotion back down
// the ladder is a legitimate corrective act (a bad claim, a revoked
// verification), so the manual control must not silently omit the lower rungs.
export const MANUAL_TRUST_TIERS = VALID_TRUST_TIERS

export const TRUST_TIER_META: Record<TrustTier, { label: string }> = {
  unclaimed: { label: 'Unclaimed' },
  claimed: { label: 'Claimed' },
  verified: { label: 'Verified' },
  certified: { label: 'Certified' },
}

export const VALID_LOCATION_TYPES = [
  'physical',
  'virtual',
  'hybrid',
  'service_area',
  'national',
  'traveling',
] as const

export type LocationType = (typeof VALID_LOCATION_TYPES)[number]

/**
 * Plain-language label for each location_type. The stored values are snake_case
 * enum keys ('service_area'), never hyphenated and never user-facing.
 *
 * This exists because the entity page rendered the raw value through
 * `location_type.replace(/-/g, ' ')` + `capitalize` — a no-op on all six values,
 * since none contains a hyphen — so a "Comes to you" business read
 * **"Service_area"** on its own page while Discover's facet said "Comes to you"
 * for the same row. Two other label sets already existed (the Discover facet and
 * the submit form) and disagreed with each other, so the vocabulary is settled
 * here and derived from, not recopied. Fixed 2026-09-03.
 *
 * Two surface-specific maps deliberately stay separate rather than deriving from
 * this one, because they encode placement rather than vocabulary:
 * `TemplateInfoRail.LOCATION_NOTES` (empty string = the rail says nothing, since
 * a storefront's city line is already above it) and `EntityCard.LOCATION_COPY`
 * (standalone vs. suffix against the city line).
 */
export const LOCATION_TYPE_META: Record<LocationType, { label: string }> = {
  physical: { label: 'Storefront' },
  virtual: { label: 'Online only' },
  hybrid: { label: 'Storefront + online' },
  service_area: { label: 'Comes to you' },
  national: { label: 'Ships nationwide' },
  traveling: { label: 'Mobile / pop-up' },
}

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

// ─── Job posting value sets ──────────────────────────────────────────────────
// These MUST match the CHECK constraints on `listing_details_job`, set by
// migration `20260813000000_job_entity`. Like LINK_TYPES below, they live in
// this plain module — NOT in a 'use server' action — because client forms import
// them to render <select> options.

export const JOB_EMPLOYMENT_TYPES = [
  'full-time',
  'part-time',
  'contract',
  'temporary',
  'internship',
  'volunteer',
] as const

export type JobEmploymentType = (typeof JOB_EMPLOYMENT_TYPES)[number]

export const JOB_EMPLOYMENT_TYPE_META: Record<JobEmploymentType, { label: string }> = {
  'full-time': { label: 'Full-time' },
  'part-time': { label: 'Part-time' },
  contract: { label: 'Contract' },
  temporary: { label: 'Temporary' },
  internship: { label: 'Internship' },
  volunteer: { label: 'Volunteer' },
}

export const JOB_WORKPLACE_TYPES = ['on-site', 'hybrid', 'remote'] as const

export type JobWorkplaceType = (typeof JOB_WORKPLACE_TYPES)[number]

export const JOB_WORKPLACE_TYPE_META: Record<JobWorkplaceType, { label: string }> = {
  'on-site': { label: 'On-site' },
  hybrid: { label: 'Hybrid' },
  remote: { label: 'Remote' },
}

export const JOB_SALARY_PERIODS = ['hour', 'day', 'week', 'month', 'year'] as const

export type JobSalaryPeriod = (typeof JOB_SALARY_PERIODS)[number]

// Suffix used when rendering a pay range ("$25/hr", "$65,000/yr"). Kept separate
// from the schema.org unitText mapping in the entity page, which needs HOUR/DAY/
// WEEK/MONTH/YEAR instead.
export const JOB_SALARY_PERIOD_META: Record<JobSalaryPeriod, { label: string; suffix: string }> = {
  hour: { label: 'Per hour', suffix: '/hr' },
  day: { label: 'Per day', suffix: '/day' },
  week: { label: 'Per week', suffix: '/wk' },
  month: { label: 'Per month', suffix: '/mo' },
  year: { label: 'Per year', suffix: '/yr' },
}

// The four CTA types a job listing may use — a subset of VALID_CTA_TYPES, and
// the same set as the listing_details_job.cta_type CHECK.
export const JOB_CTA_TYPES = ['apply', 'learn-more', 'visit', 'contact'] as const

export type JobCtaType = (typeof JOB_CTA_TYPES)[number]

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
