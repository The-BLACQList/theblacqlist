# Ticket 085: Search analytics — trending queries, zero-result queries (`/admin/analytics/search`)

## Status
Draft

## Phase
Phase 16: Analytics and Reporting

## Priority
P2

## Feature Area
Analytics / Admin

---

## Context

The `search_events` table records every search query submitted on the platform — including the query text, the result count, filters applied, and city context. This data is the most actionable analytics signal available to the content team: trending queries reveal what users are looking for, and zero-result queries reveal content gaps where the platform has no matching listings. This ticket builds the `/admin/analytics/search` route displaying two tables: (1) top 50 search queries by volume and (2) zero-result queries sorted by frequency. Both tables include city and date range filters. A CSV download is available for both tables.

Source documents: `docs/blacqlist/architecture/production-architecture.md` § 11 (Analytics Architecture); Ticket 025 (search API — writes `search_events`); Ticket 084 (admin analytics dashboard — links here).

---

## User Story

As a platform admin, I want to see which search queries are most popular and which queries return zero results, so that I can identify content gaps, prioritize which listings to add, and improve the platform's search coverage.

---

## Scope

**In scope:**
- `app/(admin)/admin/analytics/search/page.tsx` — Server Component; reads filter params from URL search params; queries `search_events` via service role client
- Table 1: **Top queries** — top 50 search queries by occurrence count; columns: Query, Count, Avg results returned, Cities (top city for this query), Period
- Table 2: **Zero-result queries** — queries where `results_count = 0`, sorted by frequency DESC, top 50; columns: Query, Count (how many times it returned zero results), Last searched
- Filter bar: Date range (7 days / 30 days / 90 days — `Select` component); City filter (`Select` from seeded cities list); both filters apply to both tables simultaneously
- Filters persist in URL params (`?period=30d&city=atlanta-ga`) so views are shareable and survive refresh
- CSV export for each table independently: a `<form>` with a server-side `action` that streams the CSV file; no external service; columns match the visible table columns; filename: `top-queries-[date].csv` / `zero-result-queries-[date].csv`
- Page-level `loading.tsx` with table skeleton

**Out of scope:**
- Click-through from a query to the search results page pre-filled with that query (deferred)
- Saved / bookmarked query views (deferred)
- Trend over time for individual queries (deferred)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 025: Search API endpoint (writes `search_events`) | Blocking ticket — data source | In Progress |
| Ticket 084: Admin platform analytics (links to this page) | Soft dependency | In Progress |
| Ticket 037: Admin layout and auth guard | Blocking ticket | In Progress |

---

## UX Notes

- **Screen:** `/admin/analytics/search` — child route under `/admin/analytics`
- **Entry point:** "View Search Analytics" link card on `/admin/analytics` (Ticket 084)
- **Breadcrumb:** Analytics > Search Analytics
- **Exit points:** Admin navigates back to `/admin/analytics` or to `/admin/listings` to add listings for a missing category
- **Filter bar:** Positioned above both tables; date range `Select` on the left; city `Select` on the right; "Clear filters" text link appears when any non-default filter is active
- **Table behavior:** Tables do not paginate at MVP (top 50 results is sufficient); if < 50 rows exist, show all; no load-more
- **Mobile behavior (375px):** Both tables scroll horizontally; filter bar stacks vertically (full-width selects); CSV download buttons are full-width below each table

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components to use:** `Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell`, `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `Button` (shadcn/ui)
- **Zero-result row highlight:** Rows in the zero-result table where count > 10 are highlighted with `bg-amber-50` to surface high-frequency content gaps
- **CSV button:** `Button` with `variant="outline"` and a download icon; positioned above each table on the right side
- **States to implement:** Loading (table skeleton), Empty (no search events yet), Error (query failed — show error with retry), Success

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `search_events`, `cities`
- **Entities involved:** `search_events`, `cities`
- **Operations (service role — bypasses RLS):**
  - Top queries: `SELECT query, COUNT(*) AS count, ROUND(AVG(results_count), 0) AS avg_results, MODE() WITHIN GROUP (ORDER BY city_id) AS top_city FROM search_events WHERE created_at >= NOW() - INTERVAL '[period]' [AND city_id = [city_id]] GROUP BY query ORDER BY count DESC LIMIT 50`
  - Zero-result queries: `SELECT query, COUNT(*) AS count, MAX(created_at) AS last_searched FROM search_events WHERE results_count = 0 AND created_at >= NOW() - INTERVAL '[period]' [AND city_id = [city_id]] GROUP BY query ORDER BY count DESC LIMIT 50`
  - Both queries parameterized — never string-interpolated
- **CSV export query:** Same queries with `LIMIT 50` removed (return all matching rows for the active filter); streamed to a CSV file
- **Validation rules:** `period` must be `'7d'`, `'30d'`, or `'90d'`; `city` must be a valid city slug from the `cities` table; validate before querying
- **Migration required:** No — `search_events` table and columns (`query`, `results_count`, `city_id`) must exist per Ticket 025 schema

---

## API Notes

- No new public API endpoints. All data fetched in the Server Component via service role client.
- **CSV export:** Implemented as a Server Action or a Route Handler at `GET /api/admin/analytics/search/export?table=top|zero&period=30d&city=atlanta-ga`; sets response headers `Content-Type: text/csv` and `Content-Disposition: attachment; filename="[name].csv"`; admin role verified before streaming data
- **Auth required:** Yes — admin or super_admin role

---

## Implementation Notes

**Files to create:**
- `app/(admin)/admin/analytics/search/page.tsx`
- `app/(admin)/admin/analytics/search/loading.tsx`
- `app/(admin)/admin/analytics/search/components/SearchQueryTable.tsx` — reusable table component used for both top queries and zero-result queries; accepts `rows`, `columns`, and `exportUrl` props
- `app/api/admin/analytics/search/export/route.ts` — CSV export Route Handler

**Files to modify:**
- None — the filter components are self-contained in the page

**Key patterns:**
- Filters are URL-based (`useSearchParams` in a `"use client"` filter component; Server Component reads `searchParams` prop): allows sharing filter state via URL
- Both tables are rendered in the same Server Component with parallel data fetching via `Promise.all()`
- CSV export route streams data using Node.js `Readable` or returns a pre-built string — do not load the entire dataset into memory as a JSON object before writing CSV
- Sanitize CSV values: wrap any field containing commas or quotes in double quotes; escape internal double quotes

**Do not:**
- Use a CSV generation library — implement the simple two-column CSV manually to avoid adding a dependency
- Block the page render on the CSV export — the export is a separate request triggered by clicking the button

---

## Acceptance Criteria

- [ ] Given an admin navigates to `/admin/analytics/search`, two tables are displayed: top queries and zero-result queries
- [ ] Top queries table shows query text, occurrence count, and average results for the default period (30 days, no city filter)
- [ ] Zero-result queries table shows query text, count, and last searched date; zero-result rows with count > 10 are highlighted
- [ ] Changing the period filter updates both tables without a full page reload; URL updates with `?period=[value]`
- [ ] Changing the city filter updates both tables to show only queries from that city
- [ ] CSV download button for each table generates a correctly formatted CSV file with all matching rows (not capped at 50 for the export)
- [ ] Non-admin users cannot access this route (admin layout guard handles this)
- [ ] Tables display an empty state message when no search events match the active filters
- [ ] Both tables scroll horizontally at 375px without horizontal page overflow

---

## Failure States

| Failure | User-visible behavior |
|---|---|
| Database query fails | Error state with "Couldn't load search analytics. Try refreshing." |
| CSV export fails | "Download failed. Try again." toast; no partial file downloaded |
| Invalid filter param in URL | Default to 30-day period, no city filter; do not throw an error |
| `search_events` table has no rows | Empty state on both tables: "No search data yet. Data appears after users begin searching." |

---

## Edge Cases

- Query text containing special characters (`"`, `,`, newlines): sanitized correctly in CSV export
- Very long query strings (> 200 chars): truncate display to 80 chars with `…` in the table; full value in CSV
- City filter selected but that city has no search events: both tables show empty state; do not error
- Admin exports CSV with no rows returned: CSV file contains only the header row; no error

---

## Accessibility Notes

- [ ] Tables have `<caption>` elements describing their purpose ("Top 50 search queries by volume in the last 30 days")
- [ ] `<th scope="col">` used on all column headers
- [ ] Filter selects have visible `<label>` associations
- [ ] CSV download buttons have descriptive `aria-label` attributes ("Download top queries as CSV")
- [ ] Highlighted zero-result rows (amber background) also include a text indicator — not color alone

---

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | Top queries displayed correctly | Admin | 1. Navigate to `/admin/analytics/search`. 2. Compare top query count against a direct `search_events` DB query. | Table matches DB query result |
| QA-2 | Zero-result queries | Admin | 1. Submit a search for "zzz_nonexistent_business" (should return 0 results). 2. Navigate to `/admin/analytics/search`. | The submitted query appears in the zero-result queries table |
| QA-3 | Period filter | Admin | 1. Set period to "7 days." 2. Note query counts. 3. Set period to "90 days." | Counts differ appropriately; URL params update |
| QA-4 | City filter | Admin | 1. Set city to "Atlanta." | Both tables update to show only Atlanta queries |
| QA-5 | CSV export | Admin | 1. Click "Download CSV" on the top queries table. | CSV file downloads; opens correctly in a spreadsheet app; column headers match table; all rows present (not capped at 50) |

---

## Security Notes

- All queries use service role client — never anon
- CSV export endpoint verifies admin role before streaming data
- Query text stored in `search_events` may contain user-generated content — render as plain text in the table, never as HTML
- The CSV export Route Handler must not accept arbitrary SQL or field-name parameters from the client — parameters are limited to `table`, `period`, and `city`

---

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
