# Ticket 083: Owner analytics dashboard — 7/30-day charts, per-metric breakdown (`/dashboard/analytics`)

## Status
Draft

## Phase
Phase 16: Analytics and Reporting

## Priority
P2

## Feature Area
Owner Dashboard

---

## Context

Business owners currently see only basic lifetime totals on the owner dashboard home (Ticket 050). This ticket builds a full analytics detail view at `/dashboard/analytics` where owners can see time-series trends for their listing's performance: page views, CTA clicks, saves, shares, and search impressions — with a 7-day / 30-day toggle. Data is sourced from `entity_analytics_daily` (populated by Ticket 082). Top search queries that surfaced this listing are shown as a secondary table sourced from `search_events`.

Charts use `recharts`. The route is protected: only the authenticated owner of the listing may access their own analytics — no cross-listing visibility.

Source documents: `docs/blacqlist/architecture/production-architecture.md` § 11 (Analytics Architecture); Ticket 050 (owner dashboard home); Ticket 082 (daily aggregation).

---

## User Story

As a business owner, I want to see trend charts and a period breakdown for my listing's page views, CTA clicks, saves, and search impressions, so that I can understand which days and weeks drive the most engagement and make informed decisions about my listing content.

---

## Scope

**In scope:**
- `app/(dashboard)/dashboard/analytics/page.tsx` — Server Component; fetches the owner's listing ID from the session, queries `entity_analytics_daily` for the selected period (default 30 days), passes data to Client Components
- `GET /api/dashboard/analytics` Route Handler — accepts `listing_id` and `period` (`7d` / `30d`) query params; validates ownership (`listings.owner_user_id = auth.uid()`); returns time-series data from `entity_analytics_daily` plus top search queries from `search_events`
- `app/(dashboard)/dashboard/analytics/components/AnalyticsPeriodToggle.tsx` — `"use client"` component; 7d / 30d toggle using `useRouter` + `useSearchParams`; updates URL param `?period=7d|30d`
- `app/(dashboard)/dashboard/analytics/components/MetricLineChart.tsx` — reusable `recharts` `LineChart` component; accepts `data: {date: string, value: number}[]` and `label: string`; includes tooltip showing exact value on hover; responsive via `ResponsiveContainer`
- Five chart instances rendered: one per metric (`page_views`, `cta_clicks`, `saves`, `shares`, `search_impressions`)
- Summary stat cards above the charts: total for the selected period per metric
- `app/(dashboard)/dashboard/analytics/components/TopSearchQueriesTable.tsx` — table of top 10 search queries that resulted in this listing appearing in results (from `search_events WHERE listing_id = [id]`, last 30 days, grouped by query, sorted by count DESC)
- Loading skeleton for each chart section (`loading.tsx` at the route segment level)
- Empty state: if the listing has fewer than 2 days of aggregated data, show an informational empty state ("Analytics data starts accumulating after your listing is published. Check back in 24 hours.")

**Out of scope:**
- Referrer breakdown (deferred)
- Comparison to prior period (V1)
- Export to CSV (deferred)
- Multi-listing aggregate view (deferred — owners with multiple listings see per-listing data only)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 050: Owner dashboard home | Blocking ticket | In Progress |
| Ticket 082: Daily analytics aggregation Edge Function | Blocking ticket — data source | Must produce rows before charts show data |
| `recharts` npm package | Dependency | Must be installed (`npm install recharts`) |
| `GET /api/dashboard/analytics` Route Handler | New Route Handler | Created within this ticket |

---

## UX Notes

- **Screen:** `/dashboard/analytics` — new route under the owner dashboard
- **Entry point:** "View Analytics" link on `/dashboard` home (Ticket 050); also linked from the sidebar nav under "My Listing"
- **Exit points:** User navigates back to `/dashboard` or to `/dashboard/page` (page editor)
- **Layout:** Single-column on mobile; 2-column grid on `lg:` for charts (page views + CTAs in one row, saves + shares in next, search impressions full-width)
- **Period toggle:** Sticky below the page heading; toggling immediately re-fetches and re-renders charts
- **Mobile behavior (375px):** Charts stack single-column; `ResponsiveContainer` with `height={200}`; period toggle spans full width; top queries table scrolls horizontally if needed

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Brand colors for chart lines:** Amber Gold `#E2A428` for primary metric (page views); Pale Lavender `#E9E9F7` fill under the line; remaining metrics use muted brand palette variants
- **Components to use:** `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardDescription` (shadcn/ui) wrapping each chart; `Skeleton` for loading states
- **Chart library:** `recharts` — `LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `CartesianGrid`, `ResponsiveContainer`
- **Typography:** Chart labels use `text-sm text-muted-foreground` (Lato); metric totals use `text-3xl font-bold` (Glacial Indifference Bold equivalent via Tailwind)
- **States to implement:** Loading (skeleton charts), Empty (< 2 days of data), Error (fetch failed — show "Couldn't load analytics. Try refreshing."), Success (charts rendered)

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `entity_analytics_daily`, `search_events`, `listings`
- **Entities involved:** `entity_analytics_daily`, `search_events`, `listings`
- **Operations:**
  - `SELECT listing_id, date, page_views, cta_clicks, saves, shares, search_impressions FROM entity_analytics_daily WHERE listing_id = [id] AND date >= NOW() - INTERVAL '[7 or 30] days' ORDER BY date ASC`
  - `SELECT query, COUNT(*) AS impressions FROM search_events WHERE listing_id = [id] AND created_at >= NOW() - INTERVAL '30 days' GROUP BY query ORDER BY impressions DESC LIMIT 10`
  - `SELECT owner_user_id FROM listings WHERE id = [listing_id]` — ownership verification before returning any data
- **Validation rules:** `period` must be `'7d'` or `'30d'`; `listing_id` must be a valid UUID; `listings.owner_user_id` must equal `auth.uid()` — return 403 if not
- **RLS policies:** Route Handler uses authenticated Supabase client; RLS on `entity_analytics_daily` must allow owner to SELECT own listing rows (`listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid())`)
- **Migration required:** Yes — add RLS policy to `entity_analytics_daily` allowing owners to SELECT rows for their own listings (migration filename: `rls-entity-analytics-daily-owner-select`)

---

## API Notes

- **API contract:** Route Handler at `app/api/dashboard/analytics/route.ts`
- **Endpoint:** `GET /api/dashboard/analytics?listing_id=[uuid]&period=7d|30d`
- **Auth required:** Yes — Supabase session required; `owner_user_id` check enforced
- **Response shape:**
  ```json
  {
    "data": {
      "series": [
        { "date": "2026-04-30", "page_views": 12, "cta_clicks": 3, "saves": 1, "shares": 0, "search_impressions": 5 }
      ],
      "totals": { "page_views": 145, "cta_clicks": 28, "saves": 9, "shares": 4, "search_impressions": 62 },
      "top_queries": [
        { "query": "natural hair atlanta", "impressions": 14 }
      ]
    }
  }
  ```
- **Error codes to handle:**
  - `403 FORBIDDEN` — listing does not belong to the authenticated user → show "You do not have access to this listing's analytics."
  - `404 NOT_FOUND` — listing ID not found → redirect to `/dashboard`
  - `400 VALIDATION_ERROR` — invalid `period` param → default to `30d`
  - `500` — show generic error with retry button

---

## Implementation Notes

**Files to create:**
- `app/(dashboard)/dashboard/analytics/page.tsx`
- `app/(dashboard)/dashboard/analytics/loading.tsx`
- `app/(dashboard)/dashboard/analytics/components/AnalyticsPeriodToggle.tsx`
- `app/(dashboard)/dashboard/analytics/components/MetricLineChart.tsx`
- `app/(dashboard)/dashboard/analytics/components/TopSearchQueriesTable.tsx`
- `app/(dashboard)/dashboard/analytics/components/AnalyticsChartSkeleton.tsx`
- `app/api/dashboard/analytics/route.ts`
- `supabase/migrations/[timestamp]_rls-entity-analytics-daily-owner-select.sql`

**Files to modify:**
- `app/(dashboard)/dashboard/page.tsx` — add "View Full Analytics" link pointing to `/dashboard/analytics`
- `app/(dashboard)/dashboard/layout.tsx` — add "Analytics" item to the sidebar nav (if not already present)

**Key patterns:**
- Page component is a Server Component that reads `listing_id` from the authenticated session (`profiles JOIN user_roles` or `listings WHERE owner_user_id = auth.uid()`) — do not accept `listing_id` as a URL param (prevents IDOR)
- Charts must include `aria-label` on `ResponsiveContainer` and a visually hidden data table fallback for screen readers
- Period toggle uses `useSearchParams` + `router.push` to update URL; Server Component re-renders with new period on navigation
- Do not install `@recharts/*` sub-packages — import from `recharts` directly

**Do not:**
- Accept `listing_id` as a user-controlled URL parameter — derive it server-side from `auth.uid()`
- Render `recharts` in a Server Component — it requires the browser environment; wrap in `"use client"`
- Show analytics data for a listing the authenticated user does not own

---

## Acceptance Criteria

- [ ] Given a business owner navigates to `/dashboard/analytics`, they see line charts for page views, CTA clicks, saves, shares, and search impressions for the last 30 days (default period)
- [ ] Given the owner toggles to "7 days," all charts re-render with data for the last 7 days and the URL updates to `?period=7d`
- [ ] Summary stat cards above the charts show the correct total for the selected period
- [ ] Top search queries table shows up to 10 queries that surfaced this listing in search results (last 30 days, regardless of period toggle)
- [ ] Given the listing has fewer than 2 days of aggregated data, the empty state message is shown instead of charts
- [ ] Given the Route Handler is called with a `listing_id` belonging to a different owner, it returns 403 and the page shows an access denied message
- [ ] Loading skeletons are shown while chart data is fetching
- [ ] Charts are responsive at 375px width with `height={200}` and no horizontal overflow
- [ ] `recharts` is not bundled in the initial server-side render — it is a Client Component import

---

## Failure States

| Failure | User-visible behavior |
|---|---|
| Route Handler returns 403 | "You do not have access to this listing's analytics." — no chart rendered |
| Route Handler returns 500 | Error card with "Couldn't load analytics. Try refreshing." and a Retry button that re-fetches |
| No aggregated data yet (new listing, < 1 day old) | Empty state with explanation; no chart rendered |
| `recharts` bundle fails to load | Error boundary catches; shows empty state with retry |
| Network timeout fetching analytics data | Same as 500 — error card with retry |

---

## Edge Cases

- Owner with no listing (supporter who navigated directly to `/dashboard/analytics`): redirect to `/dashboard` with a toast "Set up your listing to access analytics."
- Listing exists but has never been published: show empty state (no analytics events for unpublished listings)
- All metrics are zero for the selected period: charts render with flat zero lines — do not show empty state (the data exists, just zero)
- Period toggle on mobile: ensure the toggle does not cause a full page reload; use client-side navigation

---

## Accessibility Notes

- [ ] Charts have `aria-label` attributes describing the metric (e.g., "Page views over the last 30 days")
- [ ] A visually hidden `<table>` with the chart data is provided as a screen reader alternative for each chart
- [ ] Period toggle buttons are keyboard-reachable and have visible focus states
- [ ] Stat card values are announced correctly (e.g., "145 page views this period" not just "145")
- [ ] Tooltip in the chart is not the only way to read individual data points — the data table alternative provides this

---

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | Happy path — 30-day view | Owner | 1. Log in as owner with a published listing with 30 days of aggregated data. 2. Navigate to `/dashboard/analytics`. | Five charts rendered with data; summary stat totals correct; top queries table populated |
| QA-2 | Period toggle to 7 days | Owner | 1. On `/dashboard/analytics`, click "7 days" toggle. | All charts re-render with 7-day data; URL updates to `?period=7d`; totals update |
| QA-3 | Empty state — new listing | Owner | 1. Log in as owner with a listing published today (no aggregated data yet). 2. Navigate to `/dashboard/analytics`. | Empty state message shown; no charts rendered |
| QA-4 | IDOR prevention | Owner | 1. Construct a URL with a `listing_id` belonging to a different owner. 2. Attempt to access via direct URL. | 403 response; "You do not have access" message shown |
| QA-5 | Mobile at 375px | Owner | 1. Open `/dashboard/analytics` at 375px. 2. Check chart layout. | Charts stack single-column; no horizontal overflow; period toggle full-width |

---

## Security Notes

- `listing_id` is derived server-side from `auth.uid()` — never from URL parameters
- The Route Handler verifies `listings.owner_user_id = auth.uid()` before returning any data
- `search_events` query reveals only which queries surfaced this specific listing — no cross-listing data exposure

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
