# Ticket 068: Community spend aggregate API and public display widget

## Status
Draft

## Phase
Phase 12: Flow Map Data and MVP Visualization

## Priority
P3

## Estimate
S (1–2h)

## Feature Area
Flow Map

---

## Context

The Dollar Flow Map full visualization is a V3 feature, but the community spend aggregate statistics can be surfaced at MVP to build anticipation and demonstrate early platform impact. This ticket builds:

1. `GET /api/community-spend` — a public Route Handler that returns aggregate spend statistics: total dollars invested all-time and in the last 30 days, top 5 cities by spend, and total transaction count. Cached with `unstable_cache` (revalidate 1 hour) — the data is always slightly stale, which is acceptable for aggregate statistics.

2. A compact `CommunitySpendWidget` component — a stats bar (not an interactive visualization) embeddable on the homepage and on city landing pages. Shows "X dollars invested" with a "See the full flow map →" link placeholder that will route to `/flow-map` in V3. No chart, no diagram — just numbers.

Sources: `docs/blacqlist/data/database-schema-plan.md` § spend_events, flow_nodes; `docs/blacqlist/architecture/api-contract.md` § Flow Map section.

---

## User Story

As a homepage visitor, I want to see how much money the community has collectively spent at Black-owned businesses, so that I feel the platform's social impact and am motivated to participate.

---

## Scope

**In scope:**
- `app/api/community-spend/route.ts` — GET Route Handler; no auth required; queries `spend_events` and `flow_nodes`; uses `unstable_cache` with `revalidate: 3600` (1 hour); returns aggregate stats
- `components/homepage/CommunitySpendWidget.tsx` — Server Component (or Client Component if it needs to animate the count-up); renders a compact band or stats row
- Adding `CommunitySpendWidget` to the homepage (`app/page.tsx`) in the dollar-flow teaser section (position: the "Your receipts are already counting." band area from the screen map)
- Adding the same widget (smaller variant) to city landing page template (`app/city/[city-slug]/page.tsx`) with `city_slug` filter applied
- API response caching: `unstable_cache` or Route Handler-level `revalidate` — no on-demand revalidation (stale by up to 1 hour is acceptable)

**Out of scope:**
- Interactive Dollar Flow Map visualization (V3)
- Individual listing spend attribution badge (V2 event: `spend_attributed_badge_click`)
- Real-time spend updates via Supabase Realtime (V3)
- Export or download of spend data
- Spend data breakdown below city level (neighborhoods — V2)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 067 — Flow map data model (`spend_events`, `flow_nodes` tables) | Blocking ticket | Not started |
| Ticket 016 — Homepage (to add the widget) | Blocking ticket | Not started |
| Ticket 027 — City landing pages (to add the city-scoped widget) | Soft dependency | Not started |

---

## UX Notes

- **Homepage placement:** Replaces or augments the static dollar-flow teaser band from Ticket 016's scope. The teaser band reads "Your receipts are already counting." — the `CommunitySpendWidget` adds one or two data lines below this copy: the total amount and the "See the flow map →" CTA.
- **Widget design:** Not a dashboard; not a chart. A single bold stat line: "**$[amount]** invested in Black-owned businesses" in Glacial Indifference (large). Below it, a supporting line in Lato: "[N] transactions · across [M] cities". Below that, an Amber Gold text link "See the full dollar flow →" (placeholder — routes to `/flow-map` which does not exist at MVP; use `href="#"` or `href="/account/receipts"` as the interim destination).
- **City-scoped variant:** On city landing pages, show: "**$[amount]** invested in [City Name]" with a city-scoped total pulled from the `?city=[slug]` query param.
- **Empty state / zero data:** If `spend_events` has zero rows, the widget shows: "$0 invested — be the first to upload a receipt →" (links to `/account/receipts/new`). No hiding of the widget when zero.
- **Mobile:** The widget is full-width. The stat line wraps naturally. No minimum height constraint.

---

## Design Notes

- **Components to use:** Standard Tailwind classes; no special shadcn/ui components needed for a stats display — use semantic HTML (`<p>`, `<strong>`, `<a>`)
- **Typography:** Total amount in Glacial Indifference Bold, `text-4xl` on desktop, `text-2xl` on mobile. Supporting line in Lato Regular, `text-sm`, Charcoal. CTA in Quicksand Bold Italic, Amber Gold.
- **Background:** Inherits from the teaser band — Deep Background (`#19191E`) with Cream/White text
- **Count-up animation (optional):** If the total amount is non-zero, a simple count-up from 0 to the value over 1.5 seconds on scroll-into-view adds visual interest. This is optional and should be skipped if it requires adding a new npm package. Use a CSS animation or a simple `useEffect` with `requestAnimationFrame` if implementing.
- **States to implement:** Zero data (first launch), Populated (with real spend data), Loading (Skeleton — shown while the API response resolves in the Suspense boundary)

---

## Data Notes

- **Tables:** `spend_events`, `flow_nodes` (Ticket 067)
- **`GET /api/community-spend` query:**
  ```sql
  -- All-time total
  SELECT
    COALESCE(SUM(amount_cents), 0) AS total_amount_cents_all_time,
    COUNT(*) AS transaction_count_all_time
  FROM spend_events;

  -- Last 30 days total
  SELECT
    COALESCE(SUM(amount_cents), 0) AS total_amount_cents_30d
  FROM spend_events
  WHERE created_at >= now() - INTERVAL '30 days';

  -- Top 5 cities by total spend (from flow_nodes of type 'city')
  SELECT fn.entity_id AS city_id, fn.total_amount_cents, fn.transaction_count,
         c.name AS city_name, c.slug AS city_slug
  FROM flow_nodes fn
  JOIN cities c ON c.id = fn.entity_id
  WHERE fn.node_type = 'city'
  ORDER BY fn.total_amount_cents DESC
  LIMIT 5;
  ```
- **City-scoped query (for city landing page variant):**
  ```sql
  SELECT COALESCE(SUM(se.amount_cents), 0) AS total_amount_cents
  FROM spend_events se
  WHERE se.city_id = (SELECT id FROM cities WHERE slug = :city_slug);
  ```
- **Caching:** `unstable_cache(() => query(), ['community-spend'], { revalidate: 3600 })` for the all-time and 30-day stats. City-scoped query can also be cached per city slug.
- **RLS:** `spend_events` is publicly readable (anon SELECT allowed per Ticket 067) — no auth needed for the Route Handler
- **Migration required:** No — uses tables from Ticket 067

---

## API Notes

### GET /api/community-spend

**Type:** Route Handler
**Auth:** Anonymous
**Caching:** `unstable_cache` with `revalidate: 3600` (1 hour)

**Request:**
```typescript
interface CommunitySpendQueryParams {
  city_slug?: string  // Optional — if provided, returns city-scoped stats
}
```

**Response:**
```typescript
interface CommunitySpendStats {
  total_amount_cents: number         // All-time (or city-scoped if city_slug provided)
  total_amount_cents_30d: number     // Last 30 days
  transaction_count: number          // All-time transaction count
  top_cities: Array<{
    city_id: string
    city_name: string
    city_slug: string
    total_amount_cents: number
    transaction_count: number
  }>                                 // Empty array if city_slug provided (city-scoped response has no sub-breakdown)
}
// Envelope: { data: CommunitySpendStats }
```

**Errors:**

| Code | HTTP | When |
|---|---|---|
| `OPERATION_FAILED` | 500 | DB query fails |

---

## Implementation Notes

**Files to create:**
- `app/api/community-spend/route.ts` — GET Route Handler with caching
- `components/homepage/CommunitySpendWidget.tsx` — the stats display component

**Files to modify:**
- `app/page.tsx` — wrap `CommunitySpendWidget` in `<Suspense>` in the dollar-flow teaser band area
- `app/city/[city-slug]/page.tsx` (Ticket 027 scope — if merged first) — add city-scoped `CommunitySpendWidget` below the hero

**Key patterns:**
- Use `unstable_cache` (Next.js 14 API) for Route Handler caching — alternative: use `fetch` with `next: { revalidate: 3600 }` inside `CommunitySpendWidget` if it is a Server Component
- `CommunitySpendWidget` should be a Server Component where possible — call the API via `fetch` with `revalidate` in the component itself rather than making a client-side fetch
- Amount formatting: `new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(total_amount_cents / 100)` — omit cents for display (e.g., "$12,450")
- "See the full flow map →" link: use `href="/account/receipts"` as the MVP interim destination; add a `// TODO: Update to /flow-map when V3 is live` comment

**Do not:**
- Add a chart library for this ticket — the widget is text-only at MVP
- Make `CommunitySpendWidget` depend on real-time data — 1-hour cache is acceptable
- Show individual transaction details or user attribution in the public widget

---

## Acceptance Criteria

- [ ] Given `GET /api/community-spend` is called with no params, then it returns `total_amount_cents`, `total_amount_cents_30d`, `transaction_count`, and `top_cities` (up to 5)
- [ ] Given `GET /api/community-spend?city_slug=atlanta` is called, then `total_amount_cents` reflects only Atlanta spend; `top_cities` is an empty array
- [ ] Given the API response is fresh (< 1h), repeated requests return the cached response (no new DB query)
- [ ] Given `spend_events` has zero rows, then `CommunitySpendWidget` shows "$0 invested — be the first to upload a receipt →" with a link to `/account/receipts/new`
- [ ] Given `spend_events` has populated rows, then `CommunitySpendWidget` shows the formatted total amount prominently
- [ ] The widget renders in the homepage dollar-flow teaser section inside a Suspense boundary with a skeleton fallback
- [ ] Mobile at 375px: the stat line wraps naturally; no horizontal overflow

---

## Failure States

| Failure | User-visible behavior |
|---|---|
| DB query fails | API returns 500 `OPERATION_FAILED`; `CommunitySpendWidget` Suspense error boundary renders null (widget hidden) — homepage is not broken |
| `top_cities` query returns zero rows | `top_cities: []` in response; widget does not show city breakdown |

---

## Edge Cases

- `total_amount_cents` = 0 (no approved receipts yet): display "$0 invested" — not hidden, not an error
- `city_slug` provided but no matching city: return zeroed stats (no 404) — the city landing page can still render
- `amount_cents` NULL rows in `spend_events`: `COALESCE(SUM(...), 0)` handles correctly

---

## Accessibility Notes

- [ ] The stat number uses `<strong>` or `<b>` for semantic emphasis — not just visual styling
- [ ] The "See the full flow map" link is keyboard-navigable and has descriptive text (not "click here")
- [ ] `CommunitySpendWidget` does not flash or animate in a way that violates WCAG 2.3 (no rapid flashing); if count-up animation is used, it must respect `prefers-reduced-motion`

---

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | API with data | anonymous | Approve 3 receipts; GET /api/community-spend | Response includes non-zero `total_amount_cents` and `transaction_count: 3` |
| QA-2 | API — zero data | anonymous | GET /api/community-spend on a fresh DB | `total_amount_cents: 0`, `transaction_count: 0`, `top_cities: []` |
| QA-3 | Widget on homepage | anonymous | Visit homepage | CommunitySpendWidget renders in dollar-flow section with correct total |
| QA-4 | City-scoped API | anonymous | GET /api/community-spend?city_slug=atlanta | Returns Atlanta-only total; `top_cities` is empty array |
| QA-5 | Caching | anonymous | GET /api/community-spend twice in quick succession; approve a receipt between calls | Second call returns the cached (pre-approval) response — cache not yet expired |

---

## Security Notes

- Route Handler is public (Anonymous) — RLS on `spend_events` is public SELECT, which aligns
- No PII is exposed — `user_id` is not stored on `spend_events` (Ticket 067 design rule)
- No auth token is required or accepted — this is fully public aggregate data

---

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading skeleton, zero data, error → null, populated)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested
- [ ] Accessibility requirements met (reduced motion for count-up if used)
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
