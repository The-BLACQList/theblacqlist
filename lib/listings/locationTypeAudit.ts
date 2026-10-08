/**
 * Location-type audit — pure classification, no I/O.
 *
 * The defect this exists to correct: 65 of 254 published listings have no
 * address yet are labelled `location_type='physical'`
 * [Measured — production, 2026-09-02]. The migration that shipped the
 * multi-select filter says so in its own header and draws the line explicitly:
 *
 *   "This migration makes the filter capable of expressing 'online, national,
 *    service-area, mobile'; it does not move a single listing into those
 *    buckets. That is PR 8, a founder-reviewed per-listing correction pass,
 *    not a heuristic sweep."
 *   — supabase/migrations/20260904000000_search_location_types.sql:82-87
 *
 * So this module proposes; it never decides. Every row it emits lands in a CSV
 * with a blank DECISION column, and nothing reaches the database until the
 * founder has typed APPLY next to it.
 *
 * The governing principle is borrowed from scripts/geocode-dry-run.ts:43-50 —
 * a `physical` row with no address is not an online business. It is a
 * storefront whose address nobody filled in. Guessing which of the five
 * non-physical buckets it belongs to would manufacture data. Only two signals
 * are strong enough to carry a proposal on their own (`ships_nationwide` and
 * `service_area_description`), because a human ticked the box or typed the
 * text. Everything else is surfaced for judgement with `proposed` left blank.
 *
 * The vocabulary is imported from lib/constants/listing.ts, never recopied —
 * that file's own doc comment records what happened the last time three label
 * sets disagreed.
 */

import { VALID_LOCATION_TYPES, type LocationType } from '@/lib/constants/listing'

/**
 * One published listing, joined across `listings` and
 * `listing_details_business`. `listings` carries no address columns of its
 * own, so a listing with no details row has no address evidence at all —
 * `hasDetailsRow` distinguishes that from an details row with empty fields.
 */
/** What a Postgres connection string points at. Carries no credentials, ever. */
export interface ConnectionTarget {
  kind: 'local' | 'remote' | 'unknown'
  /** The Supabase project ref, or null when the string is not a recognised Supabase target. */
  projectRef: string | null
}

// Supabase refs are lowercase alphanumeric, currently 20 characters. The range
// is deliberately loose so a future length change degrades to `projectRef: null`
// (the operator is told to check by hand) rather than to a confident wrong answer.
const SUPABASE_DIRECT_HOST = /^(?:db\.)?([a-z0-9]{16,32})\.supabase\.co$/
const SUPABASE_POOLER_HOST = /\.pooler\.supabase\.(?:com|co)$/
const SUPABASE_POOLER_USER = /^postgres\.([a-z0-9]{16,32})$/

/**
 * Read the project ref out of a Postgres connection string, so a script can say
 * which database it is about to touch before it touches it.
 *
 * This replaces a one-liner that both scripts carried:
 *
 *     const ref = host.endsWith('.supabase.co') ? host.split('.')[0] : host
 *
 * which was copied from scripts/seed-editorial-launch.ts:63, where it was
 * correct — that script parses a Supabase *API* URL (`https://<ref>.supabase.co`),
 * and there the first label really is the ref. Postgres connection strings are
 * shaped differently, in two ways the copy missed:
 *
 *   - direct:  db.<ref>.supabase.co            → the first label is "db"
 *   - pooler:  aws-0-<region>.pooler.supabase.com, with the ref in the
 *              *username* as `postgres.<ref>`  → the host has no ref at all
 *
 * So against production it printed `project ref "db"` or a pooler hostname, and
 * never the ref the operator was told to check for. A safety line that cannot
 * confirm the thing it exists to confirm is worse than no line, because it
 * stops a correct run and waves through a wrong one.
 *
 * Returns `projectRef: null` rather than guessing. Nothing from the credentials
 * is returned or printed — only the ref, which is public (it is in the
 * NEXT_PUBLIC_SUPABASE_URL).
 */
export function describeConnectionTarget(url: string): ConnectionTarget {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { kind: 'unknown', projectRef: null }
  }

  const host = parsed.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
    return { kind: 'local', projectRef: null }
  }

  const direct = SUPABASE_DIRECT_HOST.exec(host)
  if (direct) return { kind: 'remote', projectRef: direct[1] ?? null }

  if (SUPABASE_POOLER_HOST.test(host)) {
    const pooled = SUPABASE_POOLER_USER.exec(parsed.username)
    return { kind: 'remote', projectRef: pooled?.[1] ?? null }
  }

  return { kind: 'remote', projectRef: null }
}

export interface AuditListing {
  id: string
  name: string
  /** `listings.location_type`. Typed loosely on purpose — finding values outside the enum is part of the job. */
  locationType: string | null
  /** `listing_details_business.address_line_1` */
  addressLine1: string | null
  /** `listings.service_area_description` */
  serviceAreaDescription: string | null
  /**
   * `listing_details_business.ships_nationwide ?? listings.ships_nationwide`.
   * Both columns are written from the same form field
   * (lib/actions/listings/submitListing.ts:185, :208) and read details-first
   * (lib/listings/entityPage.ts:425). The caller resolves them the same way.
   */
  shipsNationwide: boolean
  /** False when no `listing_details_business` row exists for this listing. */
  hasDetailsRow: boolean
}

export type AuditVerdict = 'ok' | 'change' | 'review'

export interface Classification {
  current: string | null
  /**
   * The location type to write, or `''` when the evidence cannot decide.
   *
   * An empty string is a deliberate, load-bearing value: it puts a blank cell
   * in the CSV so the founder must type a value before that row can be
   * applied. The apply script refuses any APPLY row whose proposed value is
   * empty or outside the enum.
   */
  proposed: string
  /** A stable code from `AUDIT_REASONS`, not prose. The registry carries the verdict and the explanation. */
  reason: AuditReason
}

export interface AuditRow extends Classification {
  id: string
  name: string
  verdict: AuditVerdict
}

/**
 * Every conclusion this module can reach, with its verdict and a sentence a
 * founder can act on. `classify` returns only the code; `diff` resolves the
 * verdict here. Keeping the two apart is what lets `classify` match the shape
 * the plan specifies while the CSV still carries a readable reason.
 */
export const AUDIT_REASONS = {
  'label-consistent': {
    verdict: 'ok',
    explanation: 'The address evidence agrees with the label. No change.',
  },
  'no-address-ships-nationwide': {
    verdict: 'change',
    explanation:
      'Labelled a storefront, has no street address, and the owner ticked "ships nationwide". That is what "national" means.',
  },
  'no-address-service-area-described': {
    verdict: 'change',
    explanation:
      'Labelled a storefront, has no street address, and the owner wrote a service area. That is what "service_area" means.',
  },
  'no-address-conflicting-signals': {
    verdict: 'review',
    explanation:
      'No street address, but the owner both ticked "ships nationwide" and wrote a service area. Two answers; pick one.',
  },
  'no-address-no-signal': {
    verdict: 'review',
    explanation:
      'Labelled a storefront with no street address and nothing else to go on. Either the address is missing or the label is wrong — the data cannot say which.',
  },
  'no-details-row': {
    verdict: 'review',
    explanation:
      'Labelled as needing an address, but the listing has no business-details record at all. Nothing to check the label against.',
  },
  'hybrid-without-address': {
    verdict: 'review',
    explanation:
      'Labelled "storefront + online" with no street address. Either the address is missing, or this is online-only.',
  },
  'addressed-but-online-only': {
    verdict: 'review',
    explanation:
      'Labelled "online only" but has a street address. Could be a registered business address, could be a mislabelled storefront.',
  },
  'invalid-location-type': {
    verdict: 'review',
    explanation: 'The stored value is not one of the six valid location types.',
  },
} as const satisfies Record<string, { verdict: AuditVerdict; explanation: string }>

export type AuditReason = keyof typeof AUDIT_REASONS

const VALID = new Set<string>(VALID_LOCATION_TYPES)

/** True only for the six values `listings_location_type_check` allows. */
export function isValidLocationType(value: string | null): value is LocationType {
  return value !== null && VALID.has(value)
}

/** Treats whitespace-only as absent — a row with `address_line_1 = ' '` has no address. */
function present(value: string | null): boolean {
  return value !== null && value.trim().length > 0
}

/**
 * Classify one listing. Pure — no database, no clock, no filesystem.
 *
 * Precedence, top to bottom:
 *   1. An invalid stored value is always the finding, whatever else is true.
 *   2. With no address: `physical` is the defect class; `hybrid` is suspect;
 *      the other four are legitimately addressless.
 *   3. With an address: only `virtual` ("online only") is a contradiction.
 */
export function classify(listing: AuditListing): Classification {
  const current = listing.locationType
  const keep = isValidLocationType(current) ? current : ''

  if (!isValidLocationType(current)) {
    return { current, proposed: '', reason: 'invalid-location-type' }
  }

  const hasAddress = listing.hasDetailsRow && present(listing.addressLine1)

  if (hasAddress) {
    return current === 'virtual'
      ? { current, proposed: '', reason: 'addressed-but-online-only' }
      : { current, proposed: keep, reason: 'label-consistent' }
  }

  if (current === 'hybrid') {
    return { current, proposed: '', reason: 'hybrid-without-address' }
  }

  if (current !== 'physical') {
    // virtual, national, service_area, traveling — all legitimately addressless.
    return { current, proposed: keep, reason: 'label-consistent' }
  }

  const ships = listing.shipsNationwide
  const serviceArea = present(listing.serviceAreaDescription)

  if (ships && serviceArea) {
    return { current, proposed: '', reason: 'no-address-conflicting-signals' }
  }
  if (ships) {
    return { current, proposed: 'national', reason: 'no-address-ships-nationwide' }
  }
  if (serviceArea) {
    return { current, proposed: 'service_area', reason: 'no-address-service-area-described' }
  }
  if (!listing.hasDetailsRow) {
    return { current, proposed: '', reason: 'no-details-row' }
  }
  return { current, proposed: '', reason: 'no-address-no-signal' }
}

/**
 * Classify every listing and return only the rows that need attention.
 *
 * `ok` rows are dropped — a CSV of 254 rows where 189 say "nothing to do" is a
 * CSV nobody reviews. The caller prints the dropped count so the total still
 * reconciles.
 */
export function diff(listings: AuditListing[]): AuditRow[] {
  const rows: AuditRow[] = []
  for (const listing of listings) {
    const classification = classify(listing)
    const verdict = AUDIT_REASONS[classification.reason].verdict
    if (verdict === 'ok') continue
    rows.push({ id: listing.id, name: listing.name, verdict, ...classification })
  }
  return rows
}

/** Counts by verdict across every listing, including the `ok` rows `diff` drops. */
export function summarize(listings: AuditListing[]): Record<AuditVerdict, number> {
  const counts: Record<AuditVerdict, number> = { ok: 0, change: 0, review: 0 }
  for (const listing of listings) {
    counts[AUDIT_REASONS[classify(listing).reason].verdict] += 1
  }
  return counts
}
