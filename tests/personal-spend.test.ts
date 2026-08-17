// =============================================================================
// Personal spend dashboard aggregation (ledger 4.1c)
// =============================================================================
// lib/spend/personal-spend.ts turns a user's own receipt rows into the two
// rollups /account/spending renders. The rollups are pure, so they get real
// coverage here rather than being verified by looking at the page.
//
// Three of these tests are guards rather than behaviour checks — they encode
// design decisions that a later well-meaning cleanup would otherwise undo
// silently, in the same spirit as tests/account-surfaces.test.ts parsing the
// migration SQL so dropping a policy fails CI instead of emptying a page:
//
//   1. The category buckets must sum to the headline total. Dropping the
//      "not matched to a business" bucket is the obvious way to break this,
//      and the page would still look fine — the numbers just wouldn't add up.
//   2. AGGREGATE_MIN_TRANSACTIONS must never be imported here. On the
//      community page it protects other people; on this page it would hide a
//      user's own money from them.
//   3. No `new Date(...)` parsing of purchase_date. A Postgres `date` parsed as
//      UTC midnight and read back in a western local zone lands the 1st of a
//      month in the previous month.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  PERSONAL_SPEND_MONTHS,
  UNMATCHED_CATEGORY_KEY,
  buildCategoryBreakdown,
  buildMonthSeries,
  buildTotals,
  formatDollars,
  formatDollarsExact,
  monthKeyOf,
  monthLabelsOf,
  previousMonthKey,
  type PersonalReceipt,
} from '@/lib/spend/personal-spend'

function receipt(overrides: Partial<PersonalReceipt> = {}): PersonalReceipt {
  return {
    amount_cents: 1000,
    purchase_date: '2026-08-10',
    status: 'approved',
    listing_id: null,
    ...overrides,
  }
}

// ── month keys ──────────────────────────────────────────────────────────────

describe('monthKeyOf', () => {
  it('reads the month straight off the date string', () => {
    expect(monthKeyOf('2026-08-10')).toBe('2026-08')
  })

  it('keeps the 1st of a month in that month', () => {
    // The whole reason this function slices instead of parsing: `new Date(
    // '2026-03-01').getMonth()` is February anywhere west of Greenwich.
    expect(monthKeyOf('2026-03-01')).toBe('2026-03')
    expect(monthKeyOf('2026-01-01')).toBe('2026-01')
  })

  it('keeps the last day of a month in that month', () => {
    expect(monthKeyOf('2026-12-31')).toBe('2026-12')
  })

  it('returns empty string for anything not shaped like a date', () => {
    expect(monthKeyOf('')).toBe('')
    expect(monthKeyOf('not-a-date')).toBe('')
  })
})

describe('previousMonthKey', () => {
  it('steps back one month', () => {
    expect(previousMonthKey('2026-08')).toBe('2026-07')
  })

  it('rolls the year at January', () => {
    expect(previousMonthKey('2026-01')).toBe('2025-12')
  })

  it('zero-pads single-digit months', () => {
    expect(previousMonthKey('2026-10')).toBe('2026-09')
    expect(previousMonthKey('2026-02')).toBe('2026-01')
  })
})

describe('monthLabelsOf', () => {
  it('renders a human month and year', () => {
    expect(monthLabelsOf('2026-08')).toEqual({ label: 'Aug 2026', shortLabel: 'Aug' })
    expect(monthLabelsOf('2025-12')).toEqual({ label: 'Dec 2025', shortLabel: 'Dec' })
  })
})

// ── by month ────────────────────────────────────────────────────────────────

describe('buildMonthSeries', () => {
  it('returns a dense window ending at the given month, oldest first', () => {
    const series = buildMonthSeries([], '2026-08')
    expect(series).toHaveLength(PERSONAL_SPEND_MONTHS)
    expect(series[0]!.key).toBe('2025-09')
    expect(series.at(-1)!.key).toBe('2026-08')
  })

  it('keeps months with no spend as zero rows rather than omitting them', () => {
    // A sparse series drawn as bars puts March next to July and reads as two
    // consecutive months of spending.
    const series = buildMonthSeries([receipt({ purchase_date: '2026-08-10' })], '2026-08')
    const empty = series.filter((m) => m.amountCents === 0)
    expect(empty).toHaveLength(PERSONAL_SPEND_MONTHS - 1)
    expect(series.at(-1)).toMatchObject({ key: '2026-08', amountCents: 1000, receiptCount: 1 })
  })

  it('sums several receipts in the same month', () => {
    const series = buildMonthSeries(
      [
        receipt({ purchase_date: '2026-08-01', amount_cents: 2500 }),
        receipt({ purchase_date: '2026-08-28', amount_cents: 750 }),
      ],
      '2026-08'
    )
    expect(series.at(-1)).toMatchObject({ amountCents: 3250, receiptCount: 2 })
  })

  it('counts approved receipts only', () => {
    const series = buildMonthSeries(
      [
        receipt({ amount_cents: 1000, status: 'approved' }),
        receipt({ amount_cents: 9999, status: 'pending_review' }),
        receipt({ amount_cents: 9999, status: 'rejected' }),
      ],
      '2026-08'
    )
    expect(series.at(-1)).toMatchObject({ amountCents: 1000, receiptCount: 1 })
  })

  it('drops receipts older than the window instead of clamping them into the oldest bar', () => {
    const series = buildMonthSeries(
      [
        receipt({ purchase_date: '2019-04-02', amount_cents: 500_000 }),
        receipt({ purchase_date: '2026-08-02', amount_cents: 1000 }),
      ],
      '2026-08'
    )
    expect(series[0]!.amountCents).toBe(0)
    expect(series.reduce((sum, m) => sum + m.amountCents, 0)).toBe(1000)
  })

  it('ignores receipts dated after the window', () => {
    const series = buildMonthSeries([receipt({ purchase_date: '2027-01-05' })], '2026-08')
    expect(series.reduce((sum, m) => sum + m.amountCents, 0)).toBe(0)
  })

  it('honours a custom window length', () => {
    const series = buildMonthSeries([], '2026-08', 3)
    expect(series.map((m) => m.key)).toEqual(['2026-06', '2026-07', '2026-08'])
  })
})

// ── by category ─────────────────────────────────────────────────────────────

const CATEGORY_BY_LISTING = new Map<string, string | null>([
  ['listing-food', 'cat-food'],
  ['listing-beauty', 'cat-beauty'],
  ['listing-orphan', null],
  ['listing-nameless', 'cat-missing-name'],
])

const CATEGORY_NAMES = new Map<string, string>([
  ['cat-food', 'Food & Drink'],
  ['cat-beauty', 'Beauty'],
])

describe('buildCategoryBreakdown', () => {
  it('groups by the listing category, largest first', () => {
    const buckets = buildCategoryBreakdown(
      [
        receipt({ listing_id: 'listing-beauty', amount_cents: 4000 }),
        receipt({ listing_id: 'listing-food', amount_cents: 1500 }),
        receipt({ listing_id: 'listing-food', amount_cents: 1000 }),
      ],
      CATEGORY_BY_LISTING,
      CATEGORY_NAMES
    )
    expect(buckets.map((b) => [b.name, b.amountCents, b.receiptCount])).toEqual([
      ['Beauty', 4000, 1],
      ['Food & Drink', 2500, 2],
    ])
  })

  it('puts receipts with no listing in the unmatched bucket rather than dropping them', () => {
    // approveReceipt only builds flow nodes when a receipt has a listing_id, so
    // this money is invisible in every community panel. It is still the user's
    // own money on their own dashboard.
    const buckets = buildCategoryBreakdown(
      [receipt({ listing_id: null, amount_cents: 3000 })],
      CATEGORY_BY_LISTING,
      CATEGORY_NAMES
    )
    expect(buckets).toEqual([
      {
        key: UNMATCHED_CATEGORY_KEY,
        name: 'Not matched to a business',
        amountCents: 3000,
        receiptCount: 1,
      },
    ])
  })

  it('treats a listing with no category as unmatched', () => {
    const buckets = buildCategoryBreakdown(
      [receipt({ listing_id: 'listing-orphan', amount_cents: 700 })],
      CATEGORY_BY_LISTING,
      CATEGORY_NAMES
    )
    expect(buckets[0]!.key).toBe(UNMATCHED_CATEGORY_KEY)
  })

  it('treats a listing absent from the category map as unmatched', () => {
    const buckets = buildCategoryBreakdown(
      [receipt({ listing_id: 'listing-never-fetched', amount_cents: 900 })],
      CATEGORY_BY_LISTING,
      CATEGORY_NAMES
    )
    expect(buckets[0]!.key).toBe(UNMATCHED_CATEGORY_KEY)
  })

  it('falls back to Uncategorized when the category row has no name', () => {
    const buckets = buildCategoryBreakdown(
      [receipt({ listing_id: 'listing-nameless', amount_cents: 600 })],
      CATEGORY_BY_LISTING,
      CATEGORY_NAMES
    )
    expect(buckets[0]).toMatchObject({ key: 'cat-missing-name', name: 'Uncategorized' })
  })

  it('counts approved receipts only', () => {
    const buckets = buildCategoryBreakdown(
      [
        receipt({ listing_id: 'listing-food', amount_cents: 1000 }),
        receipt({ listing_id: 'listing-food', amount_cents: 9999, status: 'pending_review' }),
        receipt({ listing_id: 'listing-beauty', amount_cents: 9999, status: 'rejected' }),
      ],
      CATEGORY_BY_LISTING,
      CATEGORY_NAMES
    )
    expect(buckets).toHaveLength(1)
    expect(buckets[0]).toMatchObject({ name: 'Food & Drink', amountCents: 1000 })
  })

  it('breaks ties by name so the order is stable across renders', () => {
    const buckets = buildCategoryBreakdown(
      [
        receipt({ listing_id: 'listing-food', amount_cents: 1000 }),
        receipt({ listing_id: 'listing-beauty', amount_cents: 1000 }),
      ],
      CATEGORY_BY_LISTING,
      CATEGORY_NAMES
    )
    expect(buckets.map((b) => b.name)).toEqual(['Beauty', 'Food & Drink'])
  })

  it('returns nothing when there is nothing approved', () => {
    expect(
      buildCategoryBreakdown(
        [receipt({ status: 'pending_review' })],
        CATEGORY_BY_LISTING,
        CATEGORY_NAMES
      )
    ).toEqual([])
  })
})

// ── totals ──────────────────────────────────────────────────────────────────

describe('buildTotals', () => {
  it('sums approved money and counts pending separately', () => {
    const totals = buildTotals([
      receipt({ amount_cents: 1200, status: 'approved' }),
      receipt({ amount_cents: 800, status: 'approved' }),
      receipt({ amount_cents: 5000, status: 'pending_review' }),
    ])
    expect(totals.approvedAmountCents).toBe(2000)
    expect(totals.approvedReceiptCount).toBe(2)
    expect(totals.pendingReceiptCount).toBe(1)
  })

  it('counts rejected receipts nowhere', () => {
    const totals = buildTotals([receipt({ amount_cents: 5000, status: 'rejected' })])
    expect(totals).toMatchObject({
      approvedAmountCents: 0,
      approvedReceiptCount: 0,
      pendingReceiptCount: 0,
    })
  })

  it('counts distinct businesses behind approved receipts, ignoring unmatched ones', () => {
    const totals = buildTotals([
      receipt({ listing_id: 'a' }),
      receipt({ listing_id: 'a' }),
      receipt({ listing_id: 'b' }),
      receipt({ listing_id: null }),
      receipt({ listing_id: 'c', status: 'pending_review' }),
    ])
    expect(totals.businessCount).toBe(2)
  })
})

// ── the reconciliation invariant ────────────────────────────────────────────

describe('the breakdowns reconcile with the headline total', () => {
  const mixed: PersonalReceipt[] = [
    receipt({ listing_id: 'listing-food', amount_cents: 2500, purchase_date: '2026-08-01' }),
    receipt({ listing_id: 'listing-beauty', amount_cents: 4000, purchase_date: '2026-07-14' }),
    receipt({ listing_id: 'listing-orphan', amount_cents: 700, purchase_date: '2026-06-30' }),
    receipt({ listing_id: null, amount_cents: 1300, purchase_date: '2026-06-02' }),
    receipt({ listing_id: 'listing-food', amount_cents: 9999, status: 'pending_review' }),
    receipt({ listing_id: 'listing-food', amount_cents: 9999, status: 'rejected' }),
  ]

  it('category buckets sum to the approved total', () => {
    // If someone "tidies up" the unmatched bucket, the page keeps rendering and
    // the numbers stop adding up. This is the test that catches it.
    const totals = buildTotals(mixed)
    const byCategory = buildCategoryBreakdown(mixed, CATEGORY_BY_LISTING, CATEGORY_NAMES).reduce(
      (sum, b) => sum + b.amountCents,
      0
    )
    expect(byCategory).toBe(totals.approvedAmountCents)
    expect(byCategory).toBe(8500)
  })

  it('month buckets sum to the approved total when every receipt is inside the window', () => {
    const totals = buildTotals(mixed)
    const byMonth = buildMonthSeries(mixed, '2026-08').reduce((sum, m) => sum + m.amountCents, 0)
    expect(byMonth).toBe(totals.approvedAmountCents)
  })

  it('receipt counts agree across both breakdowns', () => {
    const totals = buildTotals(mixed)
    const categoryCount = buildCategoryBreakdown(mixed, CATEGORY_BY_LISTING, CATEGORY_NAMES).reduce(
      (sum, b) => sum + b.receiptCount,
      0
    )
    const monthCount = buildMonthSeries(mixed, '2026-08').reduce(
      (sum, m) => sum + m.receiptCount,
      0
    )
    expect(categoryCount).toBe(totals.approvedReceiptCount)
    expect(monthCount).toBe(totals.approvedReceiptCount)
  })
})

// ── design guards ───────────────────────────────────────────────────────────

describe('design guards on lib/spend/personal-spend.ts', () => {
  function source(): string {
    return readFileSync(path.resolve(process.cwd(), 'lib/spend/personal-spend.ts'), 'utf8')
  }

  function code(): string {
    // Drop the doc comments so the prose explaining these guards can't satisfy
    // or violate them.
    return source()
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
  }

  it('never applies the community aggregate threshold', () => {
    // AGGREGATE_MIN_TRANSACTIONS exists to stop the platform disclosing one
    // person's spending to everyone else. Applying it here would hide a user's
    // own money from them. Importing it into this module is a product change,
    // not a consistency fix.
    expect(code()).not.toMatch(/AGGREGATE_MIN_TRANSACTIONS/)
    expect(code()).not.toMatch(/aggregate-privacy/)
  })

  it('never parses purchase_date through Date', () => {
    // `new Date('2026-03-01')` is UTC midnight, reported back in the server's
    // local zone — which puts the 1st of a month in the month before it.
    expect(code()).not.toMatch(/new Date\(/)
    expect(code()).not.toMatch(/Date\.parse/)
  })

  it('does not read aggregate_opt_out', () => {
    // That flag excludes a receipt from the community aggregate. It was never a
    // request to be hidden from oneself.
    expect(code()).not.toMatch(/aggregate_opt_out/)
  })
})

// ── formatting ──────────────────────────────────────────────────────────────

describe('formatting', () => {
  it('renders whole dollars for headline figures', () => {
    expect(formatDollars(123_456)).toBe('$1,235')
    expect(formatDollars(0)).toBe('$0')
  })

  it('renders exact amounts where a receipt total is shown', () => {
    expect(formatDollarsExact(123_456)).toBe('$1,234.56')
    expect(formatDollarsExact(500)).toBe('$5.00')
  })
})
