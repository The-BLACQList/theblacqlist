/**
 * URL contract for /admin/entities.
 *
 * Pure and node-testable on purpose: the page itself is an async server
 * component that calls `requireAdmin()` and the service client, so none of it
 * can be exercised in vitest. Everything that can get the URL wrong lives
 * here instead — parsing, clamping, sanitising, and href construction.
 *
 * The href builder is the load-bearing piece. The bug it exists to prevent is
 * silent: a status tab or a Prev/Next link that forgets to carry `q` drops the
 * founder's search the moment they click anything, and nothing errors.
 */

import { VALID_ENTITY_TYPES, VALID_LOCATION_TYPES } from '@/lib/constants/listing'
import type { EntityType, LocationType } from '@/types'

/**
 * The seven values `listings.status` can actually hold.
 *
 * ⚠ Must match the live CHECK constraint in
 * `20260813020000_listings_rejected_status.sql:39-42` — the initial schema
 * (`20260510000000:287`) predates `rejected` and is NOT the authority. Same
 * discipline as the header on `VALID_ENTITY_TYPES`.
 *
 * The queue only ever offered pending/published/rejected, so `draft`,
 * `unpublished`, `flagged` and `archived` rows were unreachable from the admin
 * UI entirely. `all` makes them reachable.
 */
export const ADMIN_ENTITY_STATUSES = [
  'draft',
  'pending',
  'published',
  'unpublished',
  'flagged',
  'archived',
  'rejected',
] as const

export type AdminEntityStatus = (typeof ADMIN_ENTITY_STATUSES)[number]

/** `all` is a UI-only value: it means "do not filter on status at all". */
export type AdminEntityStatusFilter = AdminEntityStatus | 'all'

export const ADMIN_ENTITY_STATUS_ALL = 'all' as const

/** Matches components/spend/ListingCombobox.tsx:47 — one typeahead convention. */
export const MIN_ADMIN_QUERY_LENGTH = 2

/** Long enough for any business name; short enough that nobody probes with it. */
const MAX_ADMIN_QUERY_LENGTH = 100

export const ADMIN_ENTITIES_PATH = '/admin/entities'

/**
 * Strip the characters that break a PostgREST `.or()` expression.
 *
 * ⚠ This is NOT `escapeLikePattern` and does not replace it. Two different
 * problems, applied in sequence:
 *
 *   * `.or('name.ilike.%x%,tagline.ilike.%x%')` is a COMMA-DELIMITED string
 *     parsed by PostgREST, which also treats `(` `)` as grouping and `"` as
 *     value quoting. A query containing any of them corrupts the expression —
 *     a 400 or, worse, a filter that silently means something else. That is
 *     this function.
 *   * `%` and `_` are `ilike` wildcards, so "50%" would over-match. That is
 *     `escapeLikePattern` (lib/db/like.ts), applied to the output of this.
 *
 * Neither is an injection fix — PostgREST parameterises the value. Both are
 * correctness fixes, and skipping either produces a wrong result rather than
 * an error.
 */
export function sanitizeAdminQuery(raw: string | undefined | null): string {
  if (!raw) return ''
  return raw
    .replace(/[,()"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ADMIN_QUERY_LENGTH)
    .trim()
}

/** True when the query is long enough to be worth sending to the database. */
export function isSearchableAdminQuery(q: string): boolean {
  return q.length >= MIN_ADMIN_QUERY_LENGTH
}

export interface AdminEntityParams {
  status: AdminEntityStatusFilter
  q: string
  page: number
  entityType: EntityType | null
  locationType: LocationType | null
}

export interface AdminEntityRawParams {
  status?: string
  page?: string
  q?: string
  type?: string
  location_type?: string
}

function isStatusFilter(value: string): value is AdminEntityStatusFilter {
  return (
    value === ADMIN_ENTITY_STATUS_ALL ||
    (ADMIN_ENTITY_STATUSES as readonly string[]).includes(value)
  )
}

/**
 * The default status when the URL does not name one.
 *
 * ⚠ Deliberate asymmetry, and the one product decision in this file: with a
 * search term and no explicit status, the scope is ALL statuses. "Find it
 * quickly" was the ask, and a search that hides the answer because the listing
 * happens to be `archived` is worse than no search. The Status column keeps
 * the mixed result legible.
 *
 * With no search term the queue behaves exactly as it always has — `pending`.
 */
function defaultStatus(q: string): AdminEntityStatusFilter {
  return isSearchableAdminQuery(q) ? ADMIN_ENTITY_STATUS_ALL : 'pending'
}

export function parseAdminEntityParams(raw: AdminEntityRawParams): AdminEntityParams {
  const q = sanitizeAdminQuery(raw.q)

  const requested = raw.status?.trim() ?? ''
  // An unknown status falls back rather than 400s: an admin editing the URL by
  // hand should land on a usable page, not an error.
  const status = isStatusFilter(requested) ? requested : defaultStatus(q)

  const parsedPage = Number.parseInt(raw.page ?? '', 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const type = raw.type?.trim() ?? ''
  const entityType = (VALID_ENTITY_TYPES as readonly string[]).includes(type)
    ? (type as EntityType)
    : null

  const loc = raw.location_type?.trim() ?? ''
  const locationType = (VALID_LOCATION_TYPES as readonly string[]).includes(loc)
    ? (loc as LocationType)
    : null

  return { status, q, page, entityType, locationType }
}

/**
 * Build an /admin/entities href, carrying every active filter.
 *
 * `status` is ALWAYS emitted, even when it equals the default. Omitting it
 * would make the href depend on `defaultStatus()`, so `?q=carter` with no
 * status would silently re-derive `all` — correct today, and a trap the first
 * time that default changes.
 *
 * `page` is dropped whenever anything else changes (the caller passes
 * `{ page: 1 }`), matching useFacetParams.ts:18 — a new filter with page 7
 * still applied shows an empty table.
 */
export function adminEntitiesHref(
  current: AdminEntityParams,
  overrides: Partial<AdminEntityParams> = {}
): string {
  const next = { ...current, ...overrides }
  const params = new URLSearchParams()

  params.set('status', next.status)
  if (next.q) params.set('q', next.q)
  if (next.page > 1) params.set('page', String(next.page))
  if (next.entityType) params.set('type', next.entityType)
  if (next.locationType) params.set('location_type', next.locationType)

  return `${ADMIN_ENTITIES_PATH}?${params.toString()}`
}

/** True when any filter beyond the status tab is active — drives "Clear". */
export function hasActiveAdminFilters(params: AdminEntityParams): boolean {
  return Boolean(params.q || params.entityType || params.locationType)
}
