# Ticket 029: Discover / Browse Page (/discover)

**Ticket ID:** BLACQ-029
**Title:** Discover / browse page (/discover)
**Type:** Feature
**Priority:** P2 — Medium
**Estimate:** S (1–2h)
**Status:** Backlog
**Phase:** Phase 4: Search, Filters, City/Category Pages
**Feature Area:** Public Discovery

---

## Context

The Discover page serves users who have browsing intent rather than specific search intent — they want to explore what exists on the platform without committing to a keyword. It is the complement to `/search`: search is query-driven, discover is facet-driven. The page shares filter components and the listing card grid with the search results page (Ticket 026) and should reuse those components aggressively rather than rebuilding them.

Source artifacts:
- `docs/blacqlist/ux/mvp-screen-map.md` — Discover page detailed spec
- `docs/blacqlist/ux/empty-loading-error-success-states.md` — Section 2 (search/filter states, reusable here)
- `docs/blacqlist/architecture/api-contract.md` — Endpoint 1 (GET /api/search, called with no `q`)

This ticket depends on Ticket 025 (search API — called with no `q`), Ticket 026 (filter bar and listing card components to reuse), and Ticket 015 (ListingCard).

---

## User Story

> As a visitor exploring the platform without a specific search in mind, I want to browse all Black-owned businesses with optional filters for city, category, and entity type, so that I can discover businesses I didn't know to search for.

---

## Scope

**In scope:**
- `app/discover/page.tsx` — Server Component. Reads `searchParams` (city, category, type, trust_tier, page). Fetches first page from `GET /api/search` (no `q` param). No ISR — fully dynamic (`export const dynamic = 'force-dynamic'`).
- Page header: platform total listing count ("[N] businesses listed" — prominent count, not a heading), subtitle "Discover Black-owned businesses across America"
- Filter bar: City dropdown, Category dropdown, Entity Type radio/select — all `"use client"` components (reused from Ticket 026 `SearchFilterBar`). Filters update URL params immediately. Sticky on desktop scroll (using `position: sticky` on the filter bar).
- Active filter chips (reused from Ticket 026 `ActiveFilterChips`)
- Trust tier filter: at MVP, a simple "Claimed only" toggle (checkbox or switch) — maps to `?trust_tier=claimed`. Does not filter to Verified/Certified separately at MVP.
- Default sort: recency (`published_at DESC`) — no explicit sort control needed (V1 adds sort options)
- Listing card grid: 24 per page, same `ListingCardGrid` and `ListingCard` components as Ticket 026
- Load More button (identical pattern to Ticket 026)
- Empty state: "Nothing here yet" (all results filtered away) with active filter labels and "Clear all filters" Amber Gold button
- Error state: "Discover isn't working right now. Try again." with retry button
- Loading state: skeleton grid (same as Ticket 026)
- Mobile: filter bar collapses behind "Filters" button opening a bottom sheet drawer (same as Ticket 026 mobile pattern)
- Analytics: `search_performed` event (with `q: null`, `filters: { city, category, type, trust_tier }`, `result_count: N`) on every filter change

**Out of scope:**
- Keyword search on this page (users who know what to search go to `/search`)
- Sort controls beyond default recency (V1)
- Advanced filters (subcategory, price range, distance) (V1)
- Map view (V2)
- Curated featured row at top (admin feature, V1 — at MVP the discover page is pure algorithmic/recency)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| BLACQ-025: `GET /api/search` endpoint (called with no `q`) | Blocking API dependency | Not started |
| BLACQ-026: `SearchFilterBar`, `ActiveFilterChips`, `ListingCardGrid`, `ListingCardSkeleton` components | Blocking UI dependency — reuse these | Not started |
| BLACQ-015: `ListingCard` component | Blocking UI dependency | Not started |
| `POST /api/analytics/event` (Endpoint 17) | Soft dependency — fire-and-forget | Not started |

---

## UX Notes

- **Screen:** `/discover` — Discovery grid layout
- **Flow reference:** `docs/blacqlist/ux/mvp-screen-map.md` → Discover page detailed spec
- **Entry points:** Navigation "Discover" link, homepage "Browse businesses" CTA, category grid tiles, dollar-flow teaser CTA (for authenticated users)
- **Exit points:** Listing card → BLACQList Page; Breadcrumb/navigation → home; Filter chip removal → filtered discover; "Add your business" in empty state → `/add-business`
- **Mobile behavior (375px):** Filter bar behind "Filters" button (drawer), single-column grid, full-width Load More button. "Claimed only" toggle is full-width in the filter drawer.
- **Default state (no filters):** All published listings ordered by `published_at DESC`. No heading — just the count and filter bar. The absence of a query makes this distinct from `/search`.
- **Relationship to `/search`:** The discover page uses the same API endpoint and the same components. The structural difference is: `/discover` has no search bar and defaults to browsing. `/search` has a pre-filled search bar and FTS relevance ranking.
- **Filter state:** URL-driven (`?city=atlanta&category=hair-beauty`). Back button works correctly.

---

## Design Notes

- **Components to reuse:** `SearchFilterBar` (Ticket 026), `ActiveFilterChips` (Ticket 026), `ListingCardGrid` (Ticket 026), `ListingCardSkeleton` (Ticket 026), `Button` for Load More
- **New component:** `DiscoverPageHeader` — Server Component. Displays total listing count prominently and subtitle. Count from `meta.total` of the initial API response (no-filter count is the platform total).
- **"Claimed only" toggle:** shadcn/ui `Switch` with label "Show claimed businesses only". When toggled: appends `?trust_tier=claimed` to URL. When un-toggled: removes `trust_tier` from URL. Include in the filter bar inline on desktop, in the filter drawer on mobile.
- **Filter bar sticky behavior:** `position: sticky; top: [nav-height]` (approx 64px). `bg-white z-10 shadow-sm` to separate from scrolling content. On mobile, the filter bar at 375px does not stick — it scrolls with the page.
- **Layout:** No hero. Content area starts below the platform nav. `max-w-5xl mx-auto px-4`. White background.
- **States to implement:** Loading (skeleton), loaded, empty (filtered), error. Same patterns as Ticket 026.

---

## Data Notes

- **Entities involved:** `listings` (read-only via API)
- **Operations:** `GET /api/search` with no `q`, optional filters, `page=1&limit=24`
- **Data fetch strategy:** Server-side first page in `page.tsx` (same pattern as Ticket 026). Client-side Load More via `fetch('/api/search?...')`.
- **Total listing count:** From `meta.total` when no filters are active — this is the platform total. Display as "[N] businesses listed".
- **No ISR:** `export const dynamic = 'force-dynamic'` (or equivalent). The discover page must reflect current data — no stale cache acceptable for the "newest first" sort.
- **RLS:** Public read. No auth needed.
- **Migration required:** No.

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` — Endpoint 1
- **Endpoint:** `GET /api/search?city=...&category=...&type=...&trust_tier=...&page=1&limit=24` (no `q`)
- **Auth required:** No. Save button on cards requires auth (handled by `SaveButton` component).
- **Error codes to handle:** Same as Ticket 026 (VALIDATION_ERROR 400, network error 500 → error state).

---

## Implementation Notes

**Files to create:**
- `app/discover/page.tsx` — Server Component. Reads `searchParams`, fetches initial results from `GET /api/search` (no `q`), renders `DiscoverPageHeader` + `DiscoverPageClient`.
- `app/discover/components/DiscoverPageClient.tsx` — `"use client"`. Load More state. Reuses `SearchFilterBar`, `ActiveFilterChips`, `ListingCardGrid` from `app/search/components/` (or from `components/discovery/` if shared).
- `components/discover/DiscoverPageHeader.tsx` — Server Component. Props: `totalCount: number`. Displays count and subtitle.

**Files to modify:**
- If `SearchFilterBar` and `ActiveFilterChips` are in `app/search/components/`, move them to `components/discovery/` so they can be shared by both `/search` and `/discover` pages. This refactor is scoped to this ticket.

**Key patterns:**
```typescript
// app/discover/page.tsx
export const dynamic = 'force-dynamic'

export default async function DiscoverPage({ searchParams }: { searchParams: DiscoverParams }) {
  const { city, category, type, trust_tier, page } = searchParams
  const results = await fetch(
    `${env.SITE_URL}/api/search?${new URLSearchParams({
      ...(city && { city }),
      ...(category && { category }),
      ...(type && { type }),
      ...(trust_tier && { trust_tier }),
      page: '1',
      limit: '24',
    }).toString()}`
  ).then(r => r.json())
  
  return (
    <>
      <DiscoverPageHeader totalCount={results.meta.total} />
      <DiscoverPageClient
        initialResults={results.data}
        meta={results.meta}
        initialParams={{ city, category, type, trust_tier }}
      />
    </>
  )
}
```

- `DiscoverPageClient` is nearly identical to `SearchResultsClient` (Ticket 026) except: no search bar, adds "Claimed only" toggle.
- If `SearchFilterBar` is extracted to `components/discovery/SearchFilterBar.tsx` in this ticket, update the import in `app/search/` as well.
- The "Claimed only" toggle adds/removes `trust_tier=claimed` from the URL params. It is a separate control from the City/Category/Type dropdowns, but still part of the filter bar.

**Do not:**
- Build a new version of `ListingCard` or `ListingCardGrid` — import from Ticket 026's components.
- Add a keyword search bar to the Discover page — users who want keyword search go to `/search`.
- Add ISR — this page must be fully dynamic.

---

## Acceptance Criteria

- [ ] Given `/discover` with no filters, the page renders all published listings ordered by `published_at DESC`, with the total platform listing count prominently displayed.
- [ ] Given `/discover?city=atlanta`, only Atlanta listings are shown and the City filter control shows "Atlanta" as selected.
- [ ] Given the "Claimed only" toggle is turned on, the URL becomes `?trust_tier=claimed` and only claimed listings render.
- [ ] Changing any filter control updates the URL immediately (no submit button) and the listing grid re-fetches.
- [ ] Active filter chips display for any active filter. Removing a chip removes that filter and re-fetches.
- [ ] Given no listings match the active filters, the empty state shows "Nothing here yet" with the active filter labels and a "Clear all filters" Amber Gold button.
- [ ] The Load More button appends 24 more listings and updates the remaining count label.
- [ ] The filter bar is sticky on desktop scroll (stays at the top below the nav as the user scrolls through results).
- [ ] At 375px, the filter controls are behind a "Filters" button opening a drawer. The "Claimed only" toggle is in the drawer.
- [ ] The `search_performed` analytics event fires (with `q: null`) on the initial page load and on every filter change.

---

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| API returns 500 | Server error | "Discover isn't working right now. Try again." + "Try again" button | Retry re-fetches with current filters |
| Load More fails | API error on page N | Toast "Couldn't load more. Try again." — Load More button re-enables | User retries |
| API returns rate limit 429 | Too many requests | Same error state as 500 — do not expose rate limit detail | Wait and retry |
| All filters active, 0 results | Valid filters, no matches | Empty state with "Nothing here yet", active filter labels, "Clear all filters" CTA | Clear filters |

---

## Edge Cases

- User applies all four filters simultaneously (city + category + type + claimed): the API supports all four combined — no special handling needed.
- Platform has 0 published listings (empty at launch): total count shows "0 businesses listed". Grid is empty. Empty state shows "Nothing here yet" with "Add your business" CTA.
- Filter bar component moved from `app/search/components/` to `components/discovery/`: ensure the import in `app/search/` is updated and no broken imports remain.

---

## Accessibility Notes

- [ ] Total count display: `<p>` or `<span>` with `aria-live="polite"` so screen readers announce count changes when filters are applied.
- [ ] Filter bar on mobile: same `role="dialog"` and focus trap requirements as Ticket 026 filter drawer.
- [ ] "Claimed only" toggle: `<Switch aria-label="Show claimed businesses only">` with an associated visible label.
- [ ] "Clear all filters" button: `aria-label="Clear all active filters"`.
- [ ] All other accessibility requirements inherited from `ListingCard`, `SearchFilterBar`, and `ActiveFilterChips` components (Ticket 026).

---

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-029-1 | Default state | Navigate to `/discover` | All listings shown, ordered by newest first; total count displayed; no active filter chips |
| QA-029-2 | City filter | Change City dropdown to "Atlanta" | URL becomes `?city=atlanta`; only Atlanta listings shown; city chip in active filters |
| QA-029-3 | Claimed only toggle | Toggle "Claimed only" on | URL adds `trust_tier=claimed`; only claimed listings shown |
| QA-029-4 | Filter chip removal | With city filter active, click `×` | City removed from URL; results reset to all cities |
| QA-029-5 | Empty state | Apply filters with no matches | "Nothing here yet" empty state with "Clear all filters" button |
| QA-029-6 | Load More | Default state with 50+ listings | 24 cards shown; Load More shows correct remaining count; click appends next 24 |
| QA-029-7 | Mobile filter drawer | View at 375px, tap "Filters" | Drawer opens with City, Category, Type, Claimed-only controls. Filters apply on drawer close or real-time. |
| QA-029-8 | Analytics event | Apply a filter | `search_performed` event fires with `q: null` in network tab |

---

## Security Notes

- Same security considerations as Ticket 026 (search results page). Filter values are URL params validated server-side by the API.
- The discover page has no user input fields (no search bar) — XSS risk is minimal.

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Filter components confirmed reused from Ticket 026 (no duplication)
- [ ] Default state (no filters) renders correctly
- [ ] All filter types tested (city, category, type, claimed toggle)
- [ ] Active filter chips and removal tested
- [ ] Empty state tested
- [ ] Load More tested
- [ ] Mobile filter drawer tested at 375px
- [ ] Analytics event verified in network tab
- [ ] Sticky filter bar on desktop verified (scrolls page, filter bar stays visible)
