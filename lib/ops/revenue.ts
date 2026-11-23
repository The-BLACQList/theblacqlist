/**
 * Monthly revenue, one rule for both reports (ticket 271). Pure calculation:
 * no database, no clock. scripts/ops/weekly-kpis.ts and
 * scripts/ops/metrics-pull.ts read production (read-only) and pass rows in.
 *
 * A yearly plan counts as its yearly price / 12 (founder, 2026-11-20). Past due
 * counts as paying, and every paid plan is in the total (founder, 2026-11-23).
 * Money nobody can work out is the string UNKNOWN, never 0.
 */

export const UNKNOWN = 'UNKNOWN'
export type Cell = number | typeof UNKNOWN

export type BillingCycle = 'monthly' | 'annual'

const DAY_MS = 24 * 60 * 60 * 1000

/** Longest period read as monthly. Real months are 28 to 31 days. */
const MONTHLY_MAX_DAYS = 62
/** Shortest period read as annual. Real years are 365 or 366 days. */
const ANNUAL_MIN_DAYS = 300

/** Paid-plan statuses: the owner is paying, or their card is being retried. */
const PAYING_STATUSES: ReadonlySet<string> = new Set(['active', 'past_due'])

/** What both reports need to price one subscription. */
export interface PricedRow {
  plan_key: string | null
  price_monthly: number | null
  price_yearly: number | null
  current_period_start: string | null
  current_period_end: string | null
}

/**
 * Monthly or annual, read from the length of the Stripe billing period the
 * webhook saves. The table has no billing-cycle column. Null when the dates
 * are missing or fit neither cycle: the cycle is not guessed.
 */
export function billingCycleOf(
  row: Pick<PricedRow, 'current_period_start' | 'current_period_end'>
): BillingCycle | null {
  if (!row.current_period_start || !row.current_period_end) return null
  const days = (Date.parse(row.current_period_end) - Date.parse(row.current_period_start)) / DAY_MS
  if (Number.isNaN(days) || days <= 0) return null
  if (days <= MONTHLY_MAX_DAYS) return 'monthly'
  if (days >= ANNUAL_MIN_DAYS) return 'annual'
  return null
}

/** One subscription's monthly money, unrounded. Null when its cycle or price is not known. */
export function monthlyValue(row: PricedRow): number | null {
  const cycle = billingCycleOf(row)
  if (cycle === null) return null
  if (cycle === 'monthly') return row.price_monthly
  return row.price_yearly === null ? null : row.price_yearly / 12
}

/** Add up, then round once to cents. One unknown makes the total UNKNOWN. */
export function sumMonthly(rows: readonly PricedRow[]): Cell {
  let total = 0
  for (const row of rows) {
    const value = monthlyValue(row)
    if (value === null) return UNKNOWN
    total += value
  }
  return Math.round(total * 100) / 100
}

/** Free never bills. A plan that can't be resolved stays in, so the total says UNKNOWN. */
export function isPaidPlan(row: Pick<PricedRow, 'plan_key'>): boolean {
  return row.plan_key !== 'free'
}

// ---------------------------------------------------------------------------
// Who is left out (ticket 236)

export interface ExcludedInput {
  tours: ReadonlyArray<{ tester_user_id: string | null }>
  invites: ReadonlyArray<{ tester_user_id: string | null }>
  /** admin and super_admin rows only. */
  roles: ReadonlyArray<{ user_id: string }>
  users: ReadonlyArray<{ id: string; user_metadata?: Record<string, unknown> | null }>
}

/** Testers (tour, invite, tester_link sign-ups) and the team. */
export function excludedUserIds(input: ExcludedInput): Set<string> {
  const excluded = new Set<string>()
  for (const r of [...input.tours, ...input.invites])
    if (r.tester_user_id) excluded.add(r.tester_user_id)
  for (const r of input.roles) excluded.add(r.user_id)
  for (const u of input.users)
    if (u.user_metadata?.['signup_source'] === 'tester_link') excluded.add(u.id)
  return excluded
}

// ---------------------------------------------------------------------------
// Today's subscriptions, for metrics-pull

export interface SummaryRow extends PricedRow {
  user_id: string | null
  status: string
}

export interface SubscriptionSummary {
  byStatus: Record<string, number>
  mrr_usd: Cell
  mrr_past_due_usd: Cell
  paying_monthly: number
  paying_annual: number
  paying_cycle_unknown: number
  left_out_tester_team: number
}

export function subscriptionSummary(
  rows: readonly SummaryRow[],
  excluded: ReadonlySet<string>
): SubscriptionSummary {
  const kept = rows.filter((r) => r.user_id === null || !excluded.has(r.user_id))
  const byStatus: Record<string, number> = {}
  for (const r of kept) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1

  const paying = kept.filter((r) => PAYING_STATUSES.has(r.status) && isPaidPlan(r))
  const cycles = paying.map(billingCycleOf)
  return {
    byStatus,
    mrr_usd: sumMonthly(paying),
    mrr_past_due_usd: sumMonthly(paying.filter((r) => r.status === 'past_due')),
    paying_monthly: cycles.filter((c) => c === 'monthly').length,
    paying_annual: cycles.filter((c) => c === 'annual').length,
    paying_cycle_unknown: cycles.filter((c) => c === null).length,
    left_out_tester_team: rows.length - kept.length,
  }
}
