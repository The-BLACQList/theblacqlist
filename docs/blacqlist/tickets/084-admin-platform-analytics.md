# Ticket 084: Admin platform analytics dashboard — totals, growth, search analytics (`/admin/analytics`)

## Status

Draft

## Phase

Phase 16: Analytics and Reporting

## Priority

P2

## Feature Area

Admin / Analytics

---

## Context

Admins need a platform-level view of The BLACQList's health and growth. This ticket builds the `/admin/analytics` route displaying four sections: (1) summary stat cards for platform-wide counts, (2) a growth line chart showing new listings per week over the last 90 days, (3) a city leaderboard table showing the top 10 cities by listing count, and (4) a link to the search analytics detail view (Ticket 085). All data is queried on-demand at page load (no pre-aggregation needed — admin views this page infrequently and the counts are not performance-critical at MVP scale).

Source documents: `docs/blacqlist/architecture/production-architecture.md` § 12 (Admin Architecture), § 11 (Analytics Architecture); Ticket 037 (admin layout); Ticket 082 (daily aggregation).

---

## User Story

As a platform admin, I want to see key platform metrics — listing counts, growth trends, city coverage, and claim activity — on a single dashboard page, so that I can quickly assess the platform's health and identify areas that need attention.

---

## Scope

**In scope:**

- `app/(admin)/admin/analytics/page.tsx` — Server Component; all data fetched server-side via service role client; passes props to Client Component chart
- Summary stat cards (4 cards in a grid):
  - Total published listings
  - Total listings published this week / this month (two values in one card)
  - Total approved claims (all time)
  - Claim approval rate (approved / total claims, expressed as a percentage)
- Growth chart: new listings per week for the last 90 days as a `recharts` `BarChart` (not line — weekly bars are clearer than a line for sparse data); `"use client"` component
- City leaderboard: top 10 cities by published listing count; rendered as a simple `Table` (shadcn/ui); columns: Rank, City, Listings, % of total
- "View Search Analytics" prominent link card pointing to `/admin/analytics/search` (Ticket 085)
- Page-level `loading.tsx` with skeleton stat cards and a skeleton bar chart
- `error.tsx` with "Couldn't load platform analytics. Try refreshing."

**Out of scope:**

- User growth metrics (deferred)
- Revenue / subscription metrics (V1)
- Custom date range picker (deferred)
- Export to CSV (deferred)
- Search analytics detail view (Ticket 085)

---

## Dependencies

| Dependency                                           | Type                                                  | Status                             |
| ---------------------------------------------------- | ----------------------------------------------------- | ---------------------------------- |
| Ticket 037: Admin layout, navigation, and auth guard | Blocking ticket                                       | In Progress                        |
| Ticket 082: Daily analytics aggregation              | Soft dependency — growth chart data is richer with it | In Progress                        |
| `recharts` npm package                               | Dependency                                            | Must be installed (see Ticket 083) |

---

## UX Notes

- **Screen:** `/admin/analytics` — new route under admin layout
- **Entry point:** Admin sidebar nav → "Analytics" item; also linked from admin home dashboard if one exists
- **Exit points:** Admin navigates to `/admin/analytics/search` (Ticket 085) or back to `/admin/listings`
- **Layout:** Summary cards row (4 across on `lg:`, 2 across on `md:`, 1 on mobile); growth chart below (full width); city leaderboard and search analytics link card side-by-side on `lg:`, stacked on mobile
- **Mobile behavior (375px):** All sections stack single-column; stat cards are 1 per row; chart has `height={250}`; city table scrolls horizontally if needed

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components to use:** `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardDescription`, `Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell` (shadcn/ui)
- **Chart:** `recharts` `BarChart`; bar fill color `#E2A428` (Amber Gold); `XAxis` shows week labels (`"Apr 7"`, `"Apr 14"`, etc.); `Tooltip` shows `"N new listings week of [date]"`
- **Stat card secondary value:** Use `text-sm text-muted-foreground` for the "this week / this month" subtext in the listings count card
- **States to implement:** Loading (skeleton), Empty (if no data yet — unlikely for admin but handle gracefully), Error (error boundary), Success

---

## Data Notes

- **Data model:** `listings`, `claims`, `entity_analytics_daily`, `cities`
- **Entities involved:** `listings`, `claims`, `cities`
- **Operations (all via service role — bypasses RLS):**
  - `SELECT COUNT(*) FROM listings WHERE status = 'published' AND deleted_at IS NULL` — total published
  - `SELECT COUNT(*) FROM listings WHERE status = 'published' AND deleted_at IS NULL AND published_at >= NOW() - INTERVAL '7 days'` — this week
  - `SELECT COUNT(*) FROM listings WHERE status = 'published' AND deleted_at IS NULL AND published_at >= NOW() - INTERVAL '30 days'` — this month
  - `SELECT COUNT(*) FROM claims WHERE status = 'approved'` — total approved claims
  - `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'approved') AS approved FROM claims` — approval rate
  - Growth chart: `SELECT DATE_TRUNC('week', published_at) AS week, COUNT(*) FROM listings WHERE status = 'published' AND deleted_at IS NULL AND published_at >= NOW() - INTERVAL '90 days' GROUP BY week ORDER BY week ASC`
  - City leaderboard: `SELECT c.name, c.slug, COUNT(l.id) AS listing_count FROM listings l JOIN cities c ON l.city_id = c.id WHERE l.status = 'published' AND l.deleted_at IS NULL GROUP BY c.name, c.slug ORDER BY listing_count DESC LIMIT 10`
- **Migration required:** No new migrations — all queries against existing tables

---

## API Notes

- No new public API endpoints. All data fetched in the Server Component via the service role Supabase client.
- Auth required: Yes — admin or super_admin role required (enforced in `app/(admin)/layout.tsx` and verified again in the page component)

---

## Implementation Notes

**Files to create:**

- `app/(admin)/admin/analytics/page.tsx`
- `app/(admin)/admin/analytics/loading.tsx`
- `app/(admin)/admin/analytics/error.tsx`
- `app/(admin)/admin/analytics/components/PlatformGrowthChart.tsx` — `"use client"` recharts bar chart
- `app/(admin)/admin/analytics/components/CityLeaderboardTable.tsx`
- `app/(admin)/admin/analytics/components/PlatformStatCards.tsx`

**Files to modify:**

- `app/(admin)/admin/layout.tsx` — add "Analytics" to admin sidebar nav (link to `/admin/analytics`)

**Key patterns:**

- All SQL queries run in parallel using `Promise.all()` in the Server Component — do not await them sequentially
- Growth chart receives pre-processed `{week: string, count: number}[]` data as a prop from the Server Component
- Use `Intl.NumberFormat` for displaying counts (e.g., `1,234` not `1234`)
- Claim approval rate: handle division by zero (display `"N/A"` when total claims = 0)

**Do not:**

- Expose raw SQL query errors in the UI — catch at the service level and return typed error objects
- Use a Line chart for the growth chart — use a Bar chart (new listings per week is better visualized as discrete bars)

---

## Acceptance Criteria

- [ ] Given an admin navigates to `/admin/analytics`, all four stat cards display correct counts within 3 seconds
- [ ] The growth bar chart displays weekly new listing counts for the last 90 days; hovering a bar shows the week and count in a tooltip
- [ ] The city leaderboard shows the top 10 cities with listing counts and percentage of total
- [ ] A "View Search Analytics" link card is visible and navigates to `/admin/analytics/search`
- [ ] Loading skeletons are shown for stat cards and the chart while data is fetching
- [ ] Non-admin users who navigate to `/admin/analytics` are redirected (handled by admin layout auth guard)
- [ ] Claim approval rate displays as a percentage (e.g., "78%"); displays "N/A" when no claims exist
- [ ] Page renders correctly at 375px mobile width with no horizontal overflow

---

## Failure States

| Failure                                                 | User-visible behavior                                                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| One of the aggregate queries fails                      | Error boundary catches; "Couldn't load platform analytics. Try refreshing." — entire page shows error state |
| City leaderboard query returns no rows (empty platform) | Table shows "No cities with published listings yet."                                                        |
| Growth chart has fewer than 2 data points               | Chart renders with available data; if zero points, chart area shows "No listing data for this period."      |
| Recharts bundle fails to load                           | Error boundary replaces chart with "Chart unavailable. Refresh to try again."                               |

---

## Edge Cases

- Platform has zero published listings (fresh install): all stat cards show 0; growth chart empty state; city leaderboard empty state
- Claim approval rate: total claims = 0 → display "N/A" instead of dividing by zero
- Admin navigates to `/admin/analytics/search` before Ticket 085 is deployed: the link exists but results in a 404 — acceptable pre-Ticket 085

---

## Accessibility Notes

- [ ] Growth bar chart has an `aria-label` describing the data (e.g., "Weekly new listings added over the last 90 days")
- [ ] A visually hidden data table is provided alongside the chart for screen reader users
- [ ] Stat cards use semantic heading structure (`<h2>` for card titles within the landmark regions)
- [ ] City leaderboard table has correct `<th scope="col">` headers

---

## QA Test Cases

| #    | Scenario                 | Role      | Steps                                                                                                                                        | Expected result                                                                        |
| ---- | ------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| QA-1 | Happy path               | Admin     | 1. Log in as admin. 2. Navigate to `/admin/analytics`.                                                                                       | All four stat cards populated; growth chart visible; city leaderboard shows top cities |
| QA-2 | Stat card accuracy       | Admin     | 1. Note total published count on `/admin/analytics`. 2. Check `SELECT COUNT(*) FROM listings WHERE status = 'published'` in Supabase Studio. | Counts match                                                                           |
| QA-3 | Growth chart correctness | Admin     | 1. View the growth chart. 2. Compare the most recent week's bar against a direct SQL query for listings published that week.                 | Bar height matches query count                                                         |
| QA-4 | Non-admin access blocked | Supporter | 1. Log in as a supporter. 2. Navigate directly to `/admin/analytics`.                                                                        | Redirected to homepage; no analytics data visible                                      |
| QA-5 | Mobile at 375px          | Admin     | 1. Open `/admin/analytics` at 375px.                                                                                                         | Stat cards stack 1-per-row; chart visible without overflow; all content accessible     |

---

## Security Notes

- All queries use the service role client — never the anon client in admin pages
- Admin role verified at both the layout level (Ticket 037) and in the page component itself (defense in depth)
- No raw SQL error messages returned to the client

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
