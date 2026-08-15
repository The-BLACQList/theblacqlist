// Sponsored placement lifecycle — the single source of truth for what a
// placement's status ACTUALLY is right now.
//
// Why this exists: `sponsored_placements.status` is written once, at creation
// (lib/actions/admin/createSponsoredPlacement.ts:43), and nothing ever moves it
// on again. There is no expiry job. So a placement whose `ends_at` passed last
// month still has status = 'active' in the row, and the admin table read
// "Active" forever — while the delivery path
// (lib/listings/query.ts, `.gt('ends_at', now)`) had correctly stopped serving
// it weeks earlier. Admin was reporting the opposite of what the site was doing.
//
// The fix is derivation, not a write: dates decide, the stored status only
// carries the states dates cannot express (canceled, inactive). That keeps admin
// and delivery answering from the same facts, and it stays correct without a
// scheduled job.

export type SponsoredEffectiveStatus =
  | 'active'
  | 'scheduled'
  | 'expired'
  | 'canceled'
  | 'inactive'

export interface SponsoredLifecycleRow {
  status: string
  starts_at: string | null
  ends_at: string | null
}

/**
 * The status a placement is in at `now`, derived from its dates.
 *
 * Precedence, and why:
 *   1. canceled  — an explicit human decision outranks any date.
 *   2. inactive  — never switched on; dates are irrelevant until it is.
 *   3. expired   — `ends_at` has passed. Wins over the stored 'active'.
 *   4. scheduled — `starts_at` is still in the future.
 *   5. active    — inside the window AND stored status says active.
 *
 * A row inside its window whose stored status is neither 'active' nor
 * 'scheduled' falls through to its stored value rather than being promoted:
 * this function narrows a placement's life, it never turns one on.
 */
export function effectiveSponsoredStatus(
  row: SponsoredLifecycleRow,
  now: Date = new Date()
): SponsoredEffectiveStatus {
  if (row.status === 'canceled') return 'canceled'
  if (row.status === 'inactive') return 'inactive'

  const t = now.getTime()
  const ends = row.ends_at ? Date.parse(row.ends_at) : NaN
  const starts = row.starts_at ? Date.parse(row.starts_at) : NaN

  if (!Number.isNaN(ends) && ends <= t) return 'expired'
  if (!Number.isNaN(starts) && starts > t) return 'scheduled'

  if (row.status === 'active') return 'active'
  if (row.status === 'scheduled') return 'active' // start date passed, delivery has begun
  if (row.status === 'expired') return 'expired'

  return 'inactive'
}

/** A placement can be canceled only while it still has time left to cancel. */
export function isCancelable(status: SponsoredEffectiveStatus): boolean {
  return status === 'active' || status === 'scheduled'
}

export const SPONSORED_STATUS_LABEL: Record<SponsoredEffectiveStatus, string> = {
  active: 'Active',
  scheduled: 'Scheduled',
  expired: 'Expired',
  canceled: 'Canceled',
  inactive: 'Inactive',
}
