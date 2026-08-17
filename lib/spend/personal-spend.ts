/**
 * Personal spend aggregation — the signed-in user's own receipts, broken down by
 * month and by category.
 *
 * ── Why this is not the community aggregate ──────────────────────────────────
 * `lib/spend/aggregate-privacy.ts` exists to stop the platform disclosing one
 * person's spending to everyone else: a business with two receipts behind it is
 * withheld because naming it next to a dollar figure can identify the shopper.
 * None of that reasoning applies here. This module only ever runs over rows the
 * caller has already filtered to `user_id = <the signed-in user>`, so the reader
 * IS the subject. Applying AGGREGATE_MIN_TRANSACTIONS on this surface would hide
 * a user's own money from them for the sake of protecting them from themselves.
 * **Do not import the threshold into this file.** The privacy obligation here is
 * a different one — never leak these rows to anyone but their owner — and it is
 * enforced by the caller's `.eq('user_id', ...)`, not by a floor on counts.
 *
 * ── Approved-only, deliberately ──────────────────────────────────────────────
 * Every figure below counts `approved` receipts only. A `pending_review` receipt
 * is a claim, not a verified amount, and folding it into the same total would
 * mean the number silently drops when an admin rejects one. Pending is surfaced
 * separately by the page as a count, never added to the money.
 *
 * ── Dates are strings, on purpose ───────────────────────────────────────────
 * `receipt_uploads.purchase_date` is a Postgres `date` — no time, no zone. Doing
 * `new Date('2026-03-01').getMonth()` parses it as UTC midnight and then reports
 * it in the server's local zone, which lands the 1st of a month in the previous
 * month anywhere west of Greenwich. Every function here slices the ISO string
 * instead. There is no `Date` parsing in this file and there should not be one.
 */

/** How many months the personal trend covers, including empty ones. */
export const PERSONAL_SPEND_MONTHS = 12

/** Bucket key for approved receipts that were never matched to a listing. */
export const UNMATCHED_CATEGORY_KEY = '__unmatched__'

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export interface PersonalReceipt {
  amount_cents: number
  /** Postgres `date` as 'YYYY-MM-DD'. */
  purchase_date: string
  status: string
  listing_id: string | null
}

export interface MonthBucket {
  /** 'YYYY-MM' */
  key: string
  /** 'Mar 2026' */
  label: string
  /** 'Mar' — for dense axes where the year is shown once. */
  shortLabel: string
  amountCents: number
  receiptCount: number
}

export interface CategoryBucket {
  key: string
  name: string
  amountCents: number
  receiptCount: number
}

export function isApproved(receipt: { status: string }): boolean {
  return receipt.status === 'approved'
}

/** 'YYYY-MM-DD' → 'YYYY-MM'. Returns '' for anything that isn't shaped like a date. */
export function monthKeyOf(purchaseDate: string): string {
  return /^\d{4}-\d{2}/.test(purchaseDate) ? purchaseDate.slice(0, 7) : ''
}

/** 'YYYY-MM' → { label: 'Mar 2026', shortLabel: 'Mar' }. */
export function monthLabelsOf(monthKey: string): { label: string; shortLabel: string } {
  const year = monthKey.slice(0, 4)
  const monthIndex = Number(monthKey.slice(5, 7)) - 1
  const name = MONTH_NAMES[monthIndex] ?? '—'
  return { label: `${name} ${year}`, shortLabel: name }
}

/** 'YYYY-MM' → the month before it, rolling the year at January. */
export function previousMonthKey(monthKey: string): string {
  const year = Number(monthKey.slice(0, 4))
  const month = Number(monthKey.slice(5, 7))
  const [prevYear, prevMonth] = month === 1 ? [year - 1, 12] : [year, month - 1]
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`
}

/**
 * The last `months` months ending at `endMonthKey`, oldest first, with **every**
 * month present even when nothing was spent in it.
 *
 * The density matters: a sparse series drawn as bars puts March next to July and
 * reads as two consecutive months of spending. Zero months have to occupy space
 * for the chart to be about cadence rather than about which months happen to
 * have rows. Receipts outside the window are dropped, not clamped into the edge
 * buckets — folding two years of history into the oldest bar would overstate it.
 */
export function buildMonthSeries(
  receipts: PersonalReceipt[],
  endMonthKey: string,
  months: number = PERSONAL_SPEND_MONTHS
): MonthBucket[] {
  const keys: string[] = []
  let cursor = endMonthKey
  for (let i = 0; i < months; i += 1) {
    keys.unshift(cursor)
    cursor = previousMonthKey(cursor)
  }

  const totals = new Map<string, { amountCents: number; receiptCount: number }>(
    keys.map((k) => [k, { amountCents: 0, receiptCount: 0 }])
  )

  for (const receipt of receipts) {
    if (!isApproved(receipt)) continue
    const bucket = totals.get(monthKeyOf(receipt.purchase_date))
    if (!bucket) continue
    bucket.amountCents += receipt.amount_cents
    bucket.receiptCount += 1
  }

  return keys.map((key) => {
    const { label, shortLabel } = monthLabelsOf(key)
    const bucket = totals.get(key)
    return {
      key,
      label,
      shortLabel,
      amountCents: bucket?.amountCents ?? 0,
      receiptCount: bucket?.receiptCount ?? 0,
    }
  })
}

/**
 * Approved spend grouped by the category of the business it was spent at,
 * largest first.
 *
 * Receipts with no `listing_id` — the user typed a business name that wasn't on
 * the platform — land in a single `UNMATCHED_CATEGORY_KEY` bucket rather than
 * being dropped. That bucket is the whole reason this breakdown differs from the
 * community one: `approveReceipt` only builds flow nodes when a receipt has a
 * `listing_id`, so unmatched money is invisible in every community panel. On the
 * user's own dashboard it is still their money and it still has to add up to the
 * total shown above it. A matched listing whose category row is missing lands in
 * the same bucket for the same reason.
 */
export function buildCategoryBreakdown(
  receipts: PersonalReceipt[],
  categoryIdByListingId: Map<string, string | null>,
  categoryNameById: Map<string, string>
): CategoryBucket[] {
  const totals = new Map<string, { amountCents: number; receiptCount: number }>()

  for (const receipt of receipts) {
    if (!isApproved(receipt)) continue
    const categoryId = receipt.listing_id
      ? (categoryIdByListingId.get(receipt.listing_id) ?? null)
      : null
    const key = categoryId ?? UNMATCHED_CATEGORY_KEY
    const bucket = totals.get(key) ?? { amountCents: 0, receiptCount: 0 }
    bucket.amountCents += receipt.amount_cents
    bucket.receiptCount += 1
    totals.set(key, bucket)
  }

  return Array.from(totals.entries())
    .map(([key, bucket]) => ({
      key,
      name:
        key === UNMATCHED_CATEGORY_KEY
          ? 'Not matched to a business'
          : (categoryNameById.get(key) ?? 'Uncategorized'),
      amountCents: bucket.amountCents,
      receiptCount: bucket.receiptCount,
    }))
    .sort((a, b) => b.amountCents - a.amountCents || a.name.localeCompare(b.name))
}

export interface PersonalSpendTotals {
  approvedAmountCents: number
  approvedReceiptCount: number
  pendingReceiptCount: number
  /** Distinct listings behind approved receipts. Unmatched receipts count for none. */
  businessCount: number
}

export function buildTotals(receipts: PersonalReceipt[]): PersonalSpendTotals {
  let approvedAmountCents = 0
  let approvedReceiptCount = 0
  let pendingReceiptCount = 0
  const listingIds = new Set<string>()

  for (const receipt of receipts) {
    if (isApproved(receipt)) {
      approvedAmountCents += receipt.amount_cents
      approvedReceiptCount += 1
      if (receipt.listing_id) listingIds.add(receipt.listing_id)
    } else if (receipt.status === 'pending_review') {
      pendingReceiptCount += 1
    }
    // 'rejected' is counted nowhere — it is not spend and it is not pending.
  }

  return {
    approvedAmountCents,
    approvedReceiptCount,
    pendingReceiptCount,
    businessCount: listingIds.size,
  }
}

/** Cents → '$1,234' (no cents shown; these are receipt-scale figures). */
export function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

/** Cents → '$1,234.56'. Used where an exact receipt amount is shown. */
export function formatDollarsExact(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
