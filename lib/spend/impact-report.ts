// =============================================================================
// Community impact reports — downloadable CSV of the public aggregate
// =============================================================================
// /flow-map publishes the community's dollar flow, but it publishes the TOP TEN
// businesses and the TOP TEN cities. That truncation is a display choice, not a
// privacy choice: the privacy line is AGGREGATE_MIN_TRANSACTIONS, and it is
// drawn in lib/spend/aggregate-privacy.ts.
//
// A downloadable report is the same bounded set without the display truncation,
// so a journalist, a partner, or a community member can check the numbers
// instead of taking a headline figure on faith. "Real, defensible numbers" is
// the done-when on the board; defensible means someone else can recompute them.
//
// WHAT THIS MODULE IS AND IS NOT:
//
//   IS   — pure functions: CSV encoding, row shaping, filename construction.
//          No Supabase, no Next, no I/O. All of it unit-testable.
//   NOT  — the privacy bound. That lives in aggregate-privacy.ts and is applied
//          in the query by the route. Nothing here re-implements it, and
//          nothing here can widen it.
//
// ⚠ EXPOSURE NOTE, for whoever reviews this next:
// This module widens WHAT IS DELIVERED, not WHO CLEARS THE BAR. The page names
// ten businesses; the export names every business at or above the bound. Both
// respect the same threshold. If the review concludes the bound itself is the
// wrong line — that it should count distinct people rather than transactions —
// that finding lands on aggregate-privacy.ts and this export inherits the fix.
// See the E-3 aggregation privacy review.
// =============================================================================

/**
 * The reports on offer. The board says "reports", plural — these are the two
 * entity views /flow-map already publishes, exported whole rather than topped.
 * Edges are deliberately not exported: an edge is a business→city pair, and a
 * pair of names is a sharper disclosure than either name alone. If edges are
 * ever wanted here, that is a privacy-review question, not an add-a-case one.
 */
export const IMPACT_DATASETS = ['businesses', 'cities'] as const

export type ImpactDataset = (typeof IMPACT_DATASETS)[number]

export function isImpactDataset(value: string | null): value is ImpactDataset {
  return value !== null && (IMPACT_DATASETS as readonly string[]).includes(value)
}

/**
 * Hard ceiling on exported rows.
 *
 * The API rules forbid unbounded lists, and an export is exactly where an
 * unbounded list is tempting — completeness is the point. This is a safety cap
 * on response size, not a privacy control: the privacy control already ran in
 * the query. Set far above any plausible near-term row count so it does not
 * quietly truncate a real report; if a live export ever hits it, that is a
 * signal to add pagination, not to raise the number silently.
 */
export const IMPACT_EXPORT_MAX_ROWS = 5000

/**
 * Cache policy for the export response.
 *
 * It lives here rather than in the route because Next validates the exports of
 * a route file — only the HTTP methods and the recognised segment-config keys
 * are permitted, so a named constant exported from route.ts fails the build.
 *
 * It is set on the response rather than declared as `revalidate` because
 * `revalidate` demonstrably did not work here. The route shipped with
 * `export const revalidate = 3600`, copied from /api/flow-map/summary, and
 * production served it `x-vercel-cache: MISS` on every request while summary
 * and /api/community-spend served `PRERENDER`
 * [Measured — curl against theblacqlist.com, 2026-08-18].
 *
 * The likely cause is that this route takes a `request` argument to read
 * `?dataset=` and the other two take none, so only they stay statically
 * analyzable — since Next 15 a GET handler is dynamic by default and
 * `revalidate` only bites when the handler can be prerendered. That is
 * `[Assumption]`, not established: `next build` marks all three `ƒ (Dynamic)`
 * in its route table, so the local build does not distinguish them and no
 * claim here should rest on the mechanism. What is established is the
 * production behaviour above, and an explicit response header is the right
 * cache policy for a public aggregate regardless of which explanation holds.
 *
 *   s-maxage=3600            the CDN holds a copy for an hour
 *   stale-while-revalidate   it may serve yesterday's copy while refetching,
 *     =86400                 which is the right trade for a public aggregate
 *                            that only changes when the nightly recompute runs
 *   max-age=0                browsers do not keep their own copy — someone
 *                            re-pulling the file is re-pulling it because they
 *                            want the current numbers
 */
export const IMPACT_EXPORT_CACHE_CONTROL =
  'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'

// ── CSV encoding ────────────────────────────────────────────────────────────
// RFC 4180. Matches the conventions already set by the one other CSV route in
// the repo, app/api/admin/analytics/search/export/route.ts: quote only when
// required, double an embedded quote, CRLF between records.

export function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function buildCsvRow(fields: readonly (string | number | null | undefined)[]): string {
  return fields.map(csvEscape).join(',')
}

/** Header row plus data rows, CRLF-separated. */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[]
): string {
  return [buildCsvRow(header), ...rows.map(buildCsvRow)].join('\r\n')
}

// ── Money ───────────────────────────────────────────────────────────────────

/**
 * Cents to a plain decimal string: 123456 → "1234.56".
 *
 * Deliberately NOT the display formatter from personal-spend.ts. A CSV cell is
 * read by a spreadsheet, not a person — "$1,234.56" carries a thousands comma
 * that has to be quoted and a currency symbol that stops the cell parsing as a
 * number. Cents are exported alongside so no one has to trust this conversion.
 */
export function centsToDecimalString(cents: number): string {
  const negative = cents < 0
  const abs = Math.abs(Math.trunc(cents))
  const whole = Math.floor(abs / 100)
  const part = String(abs % 100).padStart(2, '0')
  return `${negative ? '-' : ''}${whole}.${part}`
}

// ── Row shaping ─────────────────────────────────────────────────────────────

/** A flow_nodes row joined to whatever names it. */
export type ImpactRow = {
  name: string
  slug: string
  total_amount_cents: number
  transaction_count: number
}

export const IMPACT_HEADERS: Record<ImpactDataset, readonly string[]> = {
  businesses: [
    'business_name',
    'listing_slug',
    'total_spend_usd',
    'total_spend_cents',
    'transaction_count',
  ],
  // No separate state column: a city slug is 'atlanta-ga', so the state is
  // already carried and the export avoids a third join for it.
  cities: ['city_name', 'city_slug', 'total_spend_usd', 'total_spend_cents', 'transaction_count'],
}

export function toImpactCsvRows(rows: readonly ImpactRow[]): (string | number)[][] {
  return rows.map((r) => [
    r.name,
    r.slug,
    centsToDecimalString(r.total_amount_cents),
    r.total_amount_cents,
    r.transaction_count,
  ])
}

export function buildImpactCsv(dataset: ImpactDataset, rows: readonly ImpactRow[]): string {
  return toCsv(IMPACT_HEADERS[dataset], toImpactCsvRows(rows))
}

// ── Filename ────────────────────────────────────────────────────────────────

/** e.g. blacqlist-community-impact-businesses-2026-08-17.csv */
export function impactExportFilename(dataset: ImpactDataset, isoDate: string): string {
  return `blacqlist-community-impact-${dataset}-${isoDate}.csv`
}
