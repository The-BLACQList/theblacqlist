// =============================================================================
// Community impact reports — downloadable CSV
// =============================================================================
// The board's done-when for this row is "real, defensible numbers". Defensible
// means someone outside the company can pull the file and recompute the
// headline. That puts two things under test here:
//
//   1. The encoding is correct. A CSV that mangles a business name containing a
//      comma or an apostrophe-quote publishes a wrong number under a wrong
//      name, and does it silently — a spreadsheet will happily open a broken
//      file and shift every column right.
//   2. The money is formatted for a machine, not a person. A public number is
//      only checkable if the cell parses as a number — no currency symbol, no
//      thousands separator, both decimal places always present.
//
// The privacy bound is NOT tested here. It is applied in the query, and it is
// guarded — for this route as well as the other four surfaces — by the SURFACES
// list in tests/aggregate-privacy.test.ts, which this change extends. Testing
// it twice in two ways would give the false impression that this file is the
// thing keeping the promise. It is not.
//
// NON-VACUITY. All of this code is new, so stashing it proves nothing. Four
// mutations were applied to the source and the suite re-run:
//
//   dropped the quote-doubling in csvEscape          → 1 test failed  ✓
//   joined records with '\n' instead of '\r\n'       → 4 tests failed ✓
//   removed the .gte() from the export route         → 1 test failed  ✓ (in
//                                                       aggregate-privacy)
//   swapped the money math for (cents/100).toFixed(2) → 0 tests failed ✗
//
// The cache-header assertions added afterward are covered differently. That
// change edits pre-existing files, so a stash is a real control rather than a
// no-op: with app/api/flow-map/export/route.ts and lib/spend/impact-report.ts
// stashed, all 6 of the new assertions fail and the 39 that predate them still
// pass [Observed — git stash push, 2026-08-18].
//
// The fourth mutation above is recorded as a miss rather than quietly dropped,
// because the reason matters: it is not a gap in the tests. For integer cents
// the float
// divide is exact — checked across every value from 0 to 2,000,000 cents with
// zero mismatches, and at 999999999. The integer implementation in the module
// is a readability choice, not a correctness fix, and this suite cannot tell
// the two apart because there is nothing to tell apart. Anyone tempted to add a
// test "proving" the float version is broken should confirm a failing value
// first; there isn't one in any range this product will see.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  IMPACT_DATASETS,
  IMPACT_EXPORT_CACHE_CONTROL,
  IMPACT_EXPORT_MAX_ROWS,
  IMPACT_HEADERS,
  buildCsvRow,
  buildImpactCsv,
  centsToDecimalString,
  csvEscape,
  impactExportFilename,
  isImpactDataset,
  toCsv,
  toImpactCsvRows,
  type ImpactRow,
} from '@/lib/spend/impact-report'

// ── CSV encoding ────────────────────────────────────────────────────────────

describe('csvEscape', () => {
  it('leaves an ordinary value unquoted', () => {
    expect(csvEscape('Sweet Auburn Bakery')).toBe('Sweet Auburn Bakery')
  })

  it('quotes a value containing a comma — the common case for business names', () => {
    expect(csvEscape('Ricks Barbecue, Inc.')).toBe('"Ricks Barbecue, Inc."')
  })

  it('doubles an embedded quote and wraps the field', () => {
    // Without the doubling this emits "The "Spot" Cafe", which terminates the
    // field early and shifts every remaining column one to the left.
    expect(csvEscape('The "Spot" Cafe')).toBe('"The ""Spot"" Cafe"')
  })

  it('quotes a value containing a newline', () => {
    expect(csvEscape('Line one\nLine two')).toBe('"Line one\nLine two"')
  })

  it('quotes a value containing a carriage return', () => {
    expect(csvEscape('Line one\rLine two')).toBe('"Line one\rLine two"')
  })

  it('renders null and undefined as an empty field, not the string "null"', () => {
    expect(csvEscape(null)).toBe('')
    expect(csvEscape(undefined)).toBe('')
  })

  it('renders a number without quoting it, so the cell stays numeric', () => {
    expect(csvEscape(4200)).toBe('4200')
    expect(csvEscape(0)).toBe('0')
  })
})

describe('buildCsvRow', () => {
  it('joins fields with commas, escaping only what needs it', () => {
    expect(buildCsvRow(['Ricks, Inc.', 'ricks', '12.50', 1250, 7])).toBe(
      '"Ricks, Inc.",ricks,12.50,1250,7'
    )
  })

  it('handles an empty field list', () => {
    expect(buildCsvRow([])).toBe('')
  })
})

describe('toCsv', () => {
  it('puts the header first and separates records with CRLF', () => {
    const csv = toCsv(['a', 'b'], [
      [1, 2],
      [3, 4],
    ])
    expect(csv).toBe('a,b\r\n1,2\r\n3,4')
  })

  it('emits a header-only file when there are no rows', () => {
    // An empty report is a correct outcome, not an error: before launch there
    // may be no entity above the threshold at all.
    expect(toCsv(['a', 'b'], [])).toBe('a,b')
  })
})

// ── Money ───────────────────────────────────────────────────────────────────

describe('centsToDecimalString', () => {
  it('converts whole dollars', () => {
    expect(centsToDecimalString(120000)).toBe('1200.00')
  })

  it('keeps both decimal places, including a leading zero in the cents', () => {
    expect(centsToDecimalString(1205)).toBe('12.05')
    expect(centsToDecimalString(1250)).toBe('12.50')
  })

  it('handles values under a dollar', () => {
    expect(centsToDecimalString(0)).toBe('0.00')
    expect(centsToDecimalString(5)).toBe('0.05')
    expect(centsToDecimalString(99)).toBe('0.99')
    expect(centsToDecimalString(100)).toBe('1.00')
  })

  it('stays exact at the top of any plausible range', () => {
    // ~$10M. Not a float-drift case — see the non-vacuity note in the header —
    // but the upper boundary is worth pinning regardless.
    expect(centsToDecimalString(999999999)).toBe('9999999.99')
  })

  it('handles a negative amount without losing the sign or the cents', () => {
    expect(centsToDecimalString(-1250)).toBe('-12.50')
  })

  it('emits no thousands separator, so the cell parses as a number', () => {
    expect(centsToDecimalString(123456789)).not.toContain(',')
  })
})

// ── Dataset validation ──────────────────────────────────────────────────────

describe('isImpactDataset', () => {
  it.each(IMPACT_DATASETS)('accepts %s', (d) => {
    expect(isImpactDataset(d)).toBe(true)
  })

  it('rejects a missing parameter', () => {
    expect(isImpactDataset(null)).toBe(false)
  })

  it('rejects an unknown dataset', () => {
    expect(isImpactDataset('edges')).toBe(false)
    expect(isImpactDataset('users')).toBe(false)
  })

  it('rejects a near-miss, so the route 400s instead of silently defaulting', () => {
    expect(isImpactDataset('Businesses')).toBe(false)
    expect(isImpactDataset('business')).toBe(false)
  })

  it('does not export an edges dataset — a business→city pair is a sharper disclosure', () => {
    expect(IMPACT_DATASETS).not.toContain('edges')
  })
})

// ── Report shaping ──────────────────────────────────────────────────────────

const SAMPLE: ImpactRow[] = [
  { name: 'Sweet Auburn Bakery', slug: 'sweet-auburn-bakery', total_amount_cents: 481230, transaction_count: 42 },
  { name: 'Ricks Barbecue, Inc.', slug: 'ricks-barbecue', total_amount_cents: 96500, transaction_count: 12 },
]

describe('toImpactCsvRows', () => {
  it('emits both a formatted dollar figure and the raw cents', () => {
    // Cents travel alongside the dollars so a reader does not have to trust the
    // conversion — they can re-derive it.
    const [first] = toImpactCsvRows(SAMPLE)
    expect(first).toEqual(['Sweet Auburn Bakery', 'sweet-auburn-bakery', '4812.30', 481230, 42])
  })

  it('preserves input order — the route orders by spend descending', () => {
    expect(toImpactCsvRows(SAMPLE).map((r) => r[0])).toEqual([
      'Sweet Auburn Bakery',
      'Ricks Barbecue, Inc.',
    ])
  })

  it('carries transaction_count into every row', () => {
    // Every exported row is at or above the bound by construction, and shipping
    // the count is what lets a reader verify that for themselves.
    for (const row of toImpactCsvRows(SAMPLE)) {
      expect(typeof row[4]).toBe('number')
    }
  })
})

describe('buildImpactCsv', () => {
  it('leads with the businesses header', () => {
    expect(buildImpactCsv('businesses', SAMPLE).split('\r\n')[0]).toBe(
      'business_name,listing_slug,total_spend_usd,total_spend_cents,transaction_count'
    )
  })

  it('leads with the cities header', () => {
    expect(buildImpactCsv('cities', SAMPLE).split('\r\n')[0]).toBe(
      'city_name,city_slug,total_spend_usd,total_spend_cents,transaction_count'
    )
  })

  it('escapes a name containing a comma inside the assembled file', () => {
    expect(buildImpactCsv('businesses', SAMPLE)).toContain('"Ricks Barbecue, Inc.",ricks-barbecue')
  })

  it('emits one line per row plus the header', () => {
    expect(buildImpactCsv('businesses', SAMPLE).split('\r\n')).toHaveLength(3)
  })

  it('emits a header-only file for an empty result', () => {
    expect(buildImpactCsv('cities', []).split('\r\n')).toHaveLength(1)
  })

  it('has a header for every dataset, with matching column counts', () => {
    for (const dataset of IMPACT_DATASETS) {
      expect(IMPACT_HEADERS[dataset]).toHaveLength(toImpactCsvRows(SAMPLE)[0]!.length)
    }
  })
})

describe('impactExportFilename', () => {
  it('names the dataset and the date it was pulled', () => {
    expect(impactExportFilename('businesses', '2026-08-17')).toBe(
      'blacqlist-community-impact-businesses-2026-08-17.csv'
    )
  })

  it('contains no character that needs quoting in a Content-Disposition header', () => {
    for (const dataset of IMPACT_DATASETS) {
      expect(impactExportFilename(dataset, '2026-08-17')).toMatch(/^[a-z0-9-]+\.csv$/)
    }
  })
})

// ── The route ───────────────────────────────────────────────────────────────
// Source-parsed for the same reason tests/aggregate-privacy.test.ts parses its
// four surfaces: vitest runs environment: 'node', and a Route Handler that
// builds a Supabase service client cannot be invoked here.

describe('the export route', () => {
  const src = readFileSync(
    path.resolve(process.cwd(), 'app/api/flow-map/export/route.ts'),
    'utf8'
  )

  it('rejects an unknown dataset with a 400 rather than defaulting to one', () => {
    // Defaulting would mean a typo silently hands back the wrong report.
    expect(src).toContain('isImpactDataset(dataset)')
    expect(src).toContain('status: 400')
  })

  it('caps the row count', () => {
    expect(src).toContain('.limit(IMPACT_EXPORT_MAX_ROWS)')
    expect(IMPACT_EXPORT_MAX_ROWS).toBeGreaterThan(0)
  })

  it('sends the file as an attachment with a csv content type', () => {
    expect(src).toContain("'Content-Type': 'text/csv; charset=utf-8'")
    expect(src).toContain('Content-Disposition')
    expect(src).toContain('attachment; filename=')
  })

  it('does not select any column beyond the three the report needs', () => {
    // flow_nodes carries no PII today, but an export is the wrong place to
    // discover that it has started to. Pin the projection.
    expect(src).toContain("select('entity_id, total_amount_cents, transaction_count')")
  })

  it('returns an error envelope, not a partial CSV, when the query fails', () => {
    // A 200 with a truncated CSV would look like a real report of a smaller
    // community.
    expect(src).toContain('nodesError')
    expect(src).toContain('status: 500')
  })

  // ── Caching ───────────────────────────────────────────────────────────────
  // The route originally declared `export const revalidate = 3600`, copying the
  // pattern from /api/flow-map/summary. It did nothing: production served this
  // route x-vercel-cache: MISS on every request while the two argument-less
  // siblings served PRERENDER
  // [Measured — curl against theblacqlist.com, 2026-08-18]. See
  // lib/spend/impact-report.ts for why, and for what that reasoning does not
  // establish.
  //
  // These assertions exist because the failure mode is silent. Nothing breaks
  // when a cache header is absent — the file is still correct, it is just
  // rebuilt from the database every time, and the source comment claims
  // otherwise. Only a test notices.

  it('sets the cache policy on the response', () => {
    expect(src).toContain("'Cache-Control': IMPACT_EXPORT_CACHE_CONTROL")
  })

  it('does not declare revalidate, which is inert on a handler that reads the request', () => {
    // Anchored to the start of a line so it matches a declaration and not the
    // comment above GET, which quotes the phrase while explaining why it is
    // gone. Guards against the pattern being re-copied from a sibling route —
    // if this ever fails, delete the line rather than loosening the assertion.
    expect(src).not.toMatch(/^\s*export\s+const\s+revalidate/m)
  })
})

describe('IMPACT_EXPORT_CACHE_CONTROL', () => {
  it('lets shared caches hold the file for an hour', () => {
    expect(IMPACT_EXPORT_CACHE_CONTROL).toContain('s-maxage=3600')
  })

  it('allows a stale copy to be served while a fresh one is fetched', () => {
    expect(IMPACT_EXPORT_CACHE_CONTROL).toContain('stale-while-revalidate=')
  })

  it('keeps browsers off their own stale copy', () => {
    // Someone re-downloading the report is doing it to get the current numbers.
    // The CDN copy is the one that absorbs the load; the browser's would only
    // hand back yesterday's file with no way to tell.
    expect(IMPACT_EXPORT_CACHE_CONTROL).toContain('max-age=0')
  })

  it('is public — this is an aggregate, not a per-user response', () => {
    expect(IMPACT_EXPORT_CACHE_CONTROL).toMatch(/^public,/)
    expect(IMPACT_EXPORT_CACHE_CONTROL).not.toContain('private')
  })
})
