# Ticket 026: Search Results Page (/search)

**Ticket ID:** BLACQ-026
**Title:** Search results page (/search)
**Type:** Feature
**Priority:** P1 — High
**Estimate:** M (2–4h)
**Status:** Backlog
**Phase:** Phase 4: Search, Filters, City/Category Pages
**Feature Area:** Search / Public Discovery

---

## Context

The search results page is the primary destination for users who arrive with specific intent — they know what they are looking for. It must present results clearly, allow filtering without friction, and communicate zero-result states honestly. All filter and query state lives in the URL so back-button navigation and link sharing work correctly. This is a high-frequency page that must be fast and keyboard-accessible.

Source artifacts:
- `docs/blacqlist/ux/mvp-screen-map.md` — Search Results page detailed spec
- `docs/blacqlist/ux/empty-loading-error-success-states.md` — Section 2 (all search states)
- `docs/blacqlist/architecture/api-contract.md` — Endpoint 1 (GET /api/search), Endpoint 17 (analytics)

This ticket depends on Ticket 025 (search API endpoint) and Ticket 015 (ListingCard component). It shares filter components with Ticket 029 (Discover page) — coordinate to avoid duplication.

---

## User Story

> As a visitor searching for Black-owned businesses, I want to see ranked results for my keyword query, filter by city and category, and understand immediately how many results exist and what query was run, so that I can find the right business without unnecessary friction.

---

## Scope

**In scope:**
- `app/search/page.tsx` — Server Component, reads `searchParams` (q, city, category, type, page), fetches first page server-side via `GET /api/search`
- Search bar at top of content area: pre-filled with current `q` value; submitting a new query updates the URL; new search triggers navigation (`router.push` with new `q`)
- Filter bar: City dropdown, Category dropdown, Entity Type radio/select group — all Client Components; changing any filter updates URL params immediately (no submit button required); current filter values shown in the controls
- Active filter chips row: one chip per active filter (city, category, type), each with a `×` remove button; "Clear all" link when 2+ filters active; removing a chip removes that param from the URL
- Result count bar: "[N] results [in City] [for 'query']" — Lato Regular, Charcoal; Sort control (shadcn/ui `Select`, "Best Match" only at MVP — non-functional but present for visual completeness; V1 adds Newest and Rating)
- Listing card grid: 24 cards per page, 3-col desktop / 2-col tablet / 1-col mobile, `ListingCard` component (from Ticket 015 or defined here if not yet built); each card: cover image (16:9), business name (Glacial Indifference Bold), category badge, city text, trust badge (small), save button
- Load More button: loads next page client-side (not infinite scroll); shows "Load [N] more ([M] remaining)"; hidden when all results are loaded; appends to the existing grid
- Skeleton loading state: 8–12 `ListingCardSkeleton` components in the grid while results load; result count bar shows a skeleton rectangle
- No-query state (user visits `/search` with no `q`): shows a prominent search bar, category suggestion pills ("Restaurants", "Hair & Beauty", "Wellness", "Professionals", "Creatives"), no result grid
- Zero-result state: heading "No results for '[query]'", body "Try different keywords, or browse by category below.", "Clear search" link, category pill suggestions
- Zero-result with filters state: heading "No listings match your filters", body "Try removing a filter.", "Clear all filters" Amber Gold button
- Search API failure state: heading "Search isn't working right now", "Try again" button
- Analytics: `search_performed` event with `{ query: q, filters: { city, category, type }, result_count: N }` fired on every search/filter change (client-side, fire-and-forget)
- No ISR/caching — fully dynamic (`export const dynamic = 'force-dynamic'` or equivalent)

**Out of scope:**
- Autosuggest / typeahead dropdown (V1)
- Sort by Newest or Rating (V1)
- Saved searches (V1)
- Map view of results (V2)
- Advanced filters (subcategory, price range, etc.) (V1)
- Infinite scroll (deferred — Load More used at MVP)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| BLACQ-025: `GET /api/search` endpoint | Blocking API dependency | Not started |
| BLACQ-015: `ListingCard` component (or define here) | UI component | Not started — if not yet built, define `ListingCard` and `ListingCardSkeleton` in this ticket |
| `cities` and `categories` data available for filter dropdowns | Data | Must be seeded |
| shadcn/ui `Select`, `Badge`, `Button` components | UI dependency | Must be installed |
| URL routing with `useSearchParams` and `useRouter` (Next.js App Router) | Framework | Available |
| `POST /api/analytics/event` (Endpoint 17) | API dependency | Fire-and-forget; stub if not implemented |

---

## UX Notes

- **Screen:** `/search` — Discovery grid layout
- **Flow reference:** `docs/blacqlist/ux/mvp-screen-map.md` → Search Results page detailed spec; `docs/blacqlist/ux/empty-loading-error-success-states.md` → Section 2
- **Entry points:** Homepage search bar (submits to `/search?q=...&city=...`), nav search bar (any page), category pill clicks (from any page with `?category=...`)
- **Exit points:** Listing card click → BLACQList Page; Clear filters → `/search` (no params); Browse city → `/city/[slug]`; Category suggestion pill → `/discover?category=[slug]`
- **Mobile behavior (375px):** Filter bar stacks vertically or collapses behind a "Filters" button (drawer) — see Design Notes. Result grid is single column. Load More button is full-width. Active filter chips wrap but do not overflow the viewport.
- **Back button behavior:** Filter state lives in the URL — back button correctly returns to the previous search state. No client-side history manipulation needed.
- **Filter change navigation:** Use `router.push` (not `router.replace`) for filter changes so the user can back-navigate through filter states.

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md` (for ListingCard design)
- **Components to use:** shadcn/ui `Select` (City, Category dropdowns), `Badge` (trust badge, category tags, active filter chips), `Button` (Load More, Clear All), `Skeleton` (loading state), `Card` (listing card wrapper)
- **ListingCard (if building here):** `Card` container, `next/image` for cover (16:9 aspect ratio), business name in Glacial Indifference Bold 15px, category badge (small, Pale Lavender `#E9E9F7`), city text (Lato Regular 13px Charcoal), trust badge (small variant per design system Section 9.1), save button (Heart icon) in upper-right corner of image. Full card is a click target.
- **ListingCardSkeleton:** Matches `ListingCard` layout exactly. Image block: `Skeleton` component at correct aspect ratio. Name line: `Skeleton className="h-4 w-3/4"`. Category + city line: `Skeleton className="h-3 w-1/2"`.
- **Active filter chips:** `Badge` with `variant="outline"` + `×` button. `"Clear all"` link in Amber Gold text, right-aligned.
- **Filter bar mobile:** At `md:` breakpoint, filters inline. Below `md:` (mobile): "Filters" button opens a `Sheet` (shadcn/ui drawer) from the bottom containing the filter controls stacked vertically. Active filter count shown on the Filters button as a numeric badge.
- **Sort control:** shadcn/ui `Select` with single option "Best Match" — renders but selecting it does nothing (V1 will add Newest, Rating). Include it now for visual completeness and to reserve the layout space.
- **States to implement:** No-query idle, loading (skeleton grid), results loaded, zero results (query), zero results (filters), API error, Load More loading (spinner on button).

---

## Data Notes

- **Data model:** Consumed from `GET /api/search` response — no direct database access in this page
- **Entities involved:** `listings` (read-only, via API)
- **Operations:** `GET` only
- **Data fetch strategy:** First page fetched server-side in `page.tsx` using `searchParams`. Subsequent pages fetched client-side in the Load More handler using `fetch('/api/search?...')`. Pass first-page results as props to the Client Component grid; append subsequent pages via `useState`.
- **Cities and categories for filter dropdowns:** Fetch separately from `GET /api/cities` (list) and `GET /api/categories` (list) — or from a combined endpoint if available. These are small, relatively static datasets — can be fetched in parallel with the search query using `Promise.all`.
- **Image URLs:** Cover image and logo paths from the API are Supabase Storage paths. Generate CDN URLs client-side via `getPublicUrl()` in the ListingCard component.
- **RLS:** Not applicable — public reads through the search API.
- **Migration required:** No.

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` — Endpoint 1
- **Endpoints involved:**
  - `GET /api/search` — primary query on every filter change and page load
  - `POST /api/analytics/event` — `search_performed` event on every search/filter action (fire-and-forget)
  - `GET /api/cities` (list of all active cities for filter dropdown) — may need to be implemented in this sprint if not yet available
  - `GET /api/categories` (list of all active categories) — same
- **Auth required:** No for search. Save button on cards requires auth (handled by the save button component — shows sign-in modal for anonymous users, per global save state spec).
- **Request shape:** `?q=...&city=...&category=...&type=...&page=...&limit=24`
- **Response shape:** `{ data: SearchResult[], meta: { total, page, limit } }`
- **Error codes to handle:**
  - `VALIDATION_ERROR` (400) → should not occur with well-formed client requests; log and show API error state
  - `RATE_LIMITED` (429) → show "Search isn't working right now. Try again." state
  - Network error / 500 → show API error state with "Try again" button

---

## Implementation Notes

**Files to create:**
- `app/search/page.tsx` — Server Component; reads `searchParams`; fetches first page + cities/categories; renders `<SearchResultsClient>` with props
- `app/search/components/SearchResultsClient.tsx` — `"use client"`; manages Load More state, filter changes, URL updates; renders grid + filter bar + chips
- `app/search/components/SearchFilterBar.tsx` — `"use client"`; City Select, Category Select, Type radio/select; updates URL params on change
- `app/search/components/ActiveFilterChips.tsx` — `"use client"`; renders active filter chips with remove buttons
- `app/search/components/SearchEmptyState.tsx` — Server Component; renders the no-results and no-query states
- `components/listing/ListingCard.tsx` — If not built in Ticket 015, define here: card with cover image, name, category, city, trust badge, save button
- `components/listing/ListingCardSkeleton.tsx` — Skeleton version matching ListingCard layout
- `components/listing/ListingCardGrid.tsx` — Grid wrapper with responsive column classes

**Files to modify:**
- None at the page level if Ticket 015 ListingCard exists

**Key patterns:**
```typescript
// app/search/page.tsx (Server Component)
export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, city, category, type, page } = searchParams
  const [results, cities, categories] = await Promise.all([
    q || city || category || type
      ? fetch(`${env.SITE_URL}/api/search?${new URLSearchParams({ q, city, category, type, page: '1', limit: '24' }).toString()}`)
        .then(r => r.json())
      : Promise.resolve({ data: [], meta: { total: 0 } }),
    fetchCities(),
    fetchCategories(),
  ])
  return <SearchResultsClient initialResults={results} cities={cities} categories={categories} initialParams={searchParams} />
}
```

```typescript
// SearchResultsClient.tsx (Client Component)
// Filter bar changes: 
function handleFilterChange(key: string, value: string) {
  const params = new URLSearchParams(searchParams.toString())
  if (value) params.set(key, value)
  else params.delete(key)
  params.delete('page')  // Reset to page 1 on filter change
  router.push(`/search?${params.toString()}`)
}
// Load More:
async function handleLoadMore() {
  const nextPage = currentPage + 1
  const res = await fetch(`/api/search?${buildQueryString({ ...currentParams, page: nextPage })}`)
  const more = await res.json()
  setAllResults(prev => [...prev, ...more.data])
  setCurrentPage(nextPage)
}
```

- The search bar on this page is a `"use client"` component that calls `router.push('/search?q=...')` on submit.
- `ListingCard` must receive CDN URL props (not storage paths). Either compute in the Server Component before passing props, or compute in the `ListingCard` component using `createClient().storage.from('listing-media').getPublicUrl(path)`.
- Save button on each card: reuse `SaveButton` from Ticket 024 (or a card-specific variant). Pass `initialIsSaved = false` for all cards (we do not fetch save state for every card on the search results page — this is a performance tradeoff at MVP).
- Never use `useEffect` for the initial data fetch — fetch server-side in `page.tsx` and pass as props.

**Do not:**
- Implement infinite scroll — Load More button only at MVP.
- Fetch cities and categories inside the Client Component on mount — fetch server-side in `page.tsx` and pass as props to avoid client-side waterfall.
- Put business logic (pagination offsets, filter logic) in the React component — put it in a `lib/utils/search.ts` helper.
- Implement sort functionality (V1 — just render the control with "Best Match" as the only option).

---

## Acceptance Criteria

- [ ] Given `GET /search?q=barbershop&city=atlanta`, the page renders search results pre-filtered by "barbershop" query and Atlanta city, with the search bar pre-filled and City filter showing "Atlanta".
- [ ] Given `GET /search` with no params, the page shows a prominent search bar and category suggestion pills — no empty result grid or skeleton.
- [ ] Changing the City filter dropdown updates the URL to `?city=[slug]` and triggers a new search without a submit button.
- [ ] An active filter chip appears for each active filter. Clicking the `×` removes that filter from the URL and triggers a new search.
- [ ] "Clear all" link removes all filters and navigates to `/search` (empty params).
- [ ] Given a search returns 48 results, 24 cards render and a "Load 24 more (24 remaining)" button appears. Clicking it appends 24 more cards to the grid.
- [ ] Given a search returns 0 results, the empty state shows "No results for '[query]'" heading, body text, "Clear search" link, and category suggestion pills.
- [ ] Given the API returns a 5xx error, the error state shows "Search isn't working right now" with a "Try again" button that retries the same query.
- [ ] While a search is in progress, 8–12 skeleton cards render matching the `ListingCard` layout exactly.
- [ ] The `search_performed` analytics event fires with `{ query, filters, result_count }` on every search and filter change.
- [ ] Back-button navigation returns to the previous search state (URL is the source of truth).
- [ ] At 375px, the filter controls are accessible via a "Filters" button that opens a drawer, and the result grid is single column.

---

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| Search API returns 500 | Server error | "Search isn't working right now. We're looking into it. Try again in a moment." + "Try again" button | "Try again" retries the current query |
| Search API returns 429 (rate limited) | Too many requests | Same "Search isn't working right now" message — do not expose the rate limit detail to users | Retry after cooldown |
| Load More fails | API error on page 2+ | Toast: "Couldn't load more results. Try again." + Load More button re-enables | User retries Load More |
| Cities/categories API fails | Dropdowns cannot populate | Filter dropdowns show a single "Loading…" option — search still works without filters | Filter dropdowns degraded; search functional |
| Network offline | `navigator.onLine = false` | Offline banner from global state system; search input disabled | Restore connection |

---

## Edge Cases

- User clears the search bar and presses Enter: navigates to `/search` with no params (no-query state).
- User types a query in the search bar and simultaneously changes a filter: both actions fire `router.push` — last write wins (URL contains both changes if sequential; rapid simultaneous clicks are harmless).
- `q` contains special URL characters (`&`, `?`, `#`): encoded via `URLSearchParams` — `encodeURIComponent` is applied automatically.
- Result count says "48 results" but clicking Load More returns 0 new results: count was stale. Show toast "No more results" and hide Load More button.
- User changes a filter while Load More is in progress: cancel the Load More fetch (use `AbortController`) and run a fresh page-1 query with the new filters.
- Save button on a card — anonymous user: shows sign-in modal (from `SaveButton` component), does not navigate away from the search results page.

---

## Accessibility Notes

- [ ] Search bar has a visible `<label>` ("Search The BLACQList") or `aria-label`.
- [ ] Filter dropdowns have associated `<label>` elements with descriptive text ("Filter by city").
- [ ] Active filter chips have `aria-label="Remove [filter name] filter"` on the `×` button.
- [ ] Listing cards are keyboard-navigable: the entire card is an `<a>` element wrapping the card content. `tabindex` not manually set — natural document order.
- [ ] Load More button is a semantic `<button>` with clear visible label. When loading, it shows spinner + "Loading…" and is `disabled`.
- [ ] Skeleton cards have `aria-busy="true"` on the container while loading and `aria-live="polite"` to announce when results load.
- [ ] Zero-result state heading is an `<h2>` or appropriate heading level (not a `<div>`).
- [ ] Filter drawer (mobile): `role="dialog"`, `aria-modal="true"`, focus trapped when open, focus returns to Filters button on close.

---

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-026-1 | Keyword search | Navigate to `/search?q=barbershop` | Search bar pre-filled "barbershop"; result cards rendered; result count shows correct number |
| QA-026-2 | City filter change | On results page, change City dropdown to "Atlanta" | URL updates to `?city=atlanta`; results re-fetch filtered to Atlanta; City chip appears in active filters |
| QA-026-3 | Remove active filter chip | With city filter active, click `×` on the city chip | URL loses `city` param; results re-fetch without city filter |
| QA-026-4 | Load More | Search returning 48 results | 24 cards load, Load More button shows "Load 24 more (24 remaining)"; clicking appends 24 more cards |
| QA-026-5 | Zero results | Search for `zzzznonexistent12345` | Empty state with "No results for 'zzzznonexistent12345'" heading and category suggestions |
| QA-026-6 | API error | Mock search API to return 500 | Error state with "Search isn't working right now" and "Try again" button |
| QA-026-7 | No-query state | Navigate to `/search` (no params) | Prominent search bar, category suggestion pills, no result grid or skeleton |
| QA-026-8 | Back navigation | Run search A, apply filter, run search B, press Back | Browser returns to search B state (URL with filter). Press Back again → search A state. |

---

## Security Notes

- Search query `q` is passed to the API as a query parameter — never interpolated into SQL client-side.
- Filter values (city slug, category slug) are URL params that the API validates server-side. Invalid slugs return empty results (not errors).
- The page does not render user-supplied `q` values as HTML — display as text only (React's JSX string interpolation prevents XSS by default).
- External listing page links open in the same tab (`<a>` without `target="_blank"`) — no `rel="noopener noreferrer"` needed for same-origin navigation.

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Keyword search tested with real data
- [ ] City + category filter tested (filter updates URL, results update)
- [ ] Active filter chip removal tested
- [ ] Load More tested (appends cards, button shows correct remaining count)
- [ ] Zero-results state tested (keyword and filter paths)
- [ ] API error state tested (mock 500 response)
- [ ] No-query state tested (bare `/search`)
- [ ] Mobile filter drawer tested at 375px
- [ ] Back button navigation tested
- [ ] Skeleton matches ListingCard layout (compare side-by-side)
- [ ] Analytics `search_performed` event fires (check network tab)
