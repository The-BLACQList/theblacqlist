# Core User Flows — The BLACQList

**Last updated:** 2026-05-07
**Status:** Source of truth
**Owner:** UX / Product
**Audience:** Engineering, Design, QA

This document maps the 20 MVP-critical user flows across The BLACQList platform. Each flow covers the complete path from trigger to completion — including every decision point, all four states (loading, empty, error, success), error recovery, mobile behavior, accessibility requirements, abuse risks, and analytics instrumentation.

Flows are written from the user's perspective. System responses are documented at each step. No flow documents only the happy path.

**Phase key:** MVP = launch-required | Beta = feature-flagged post-launch | V1 = 8–12 weeks post-MVP

---

## Flow 1: Public User Searches Nationally

**Phase:** MVP
**User type:** Anonymous Visitor or Supporter
**Starting point:** `/` (homepage) or direct navigation to `/search`
**Goal:** Find a Black-owned business by keyword across all cities, without applying a city filter.

**User journey:** A visitor arrives on The BLACQList homepage — likely from a Google search or a shared link. They have a category or keyword in mind but no specific city. They enter their search term, scan results from across the country, and click through to a listing page. The critical moment is the results page: if results feel thin or irrelevant, the user bounces. Success looks like clicking into at least one listing. The most likely point of failure is a query returning zero results when the platform's listing density is low at MVP launch.

### Happy Path

**Step 1: User arrives at homepage**

- User action: Opens `theblacqlist.com` or `/search` directly.
- System response: Homepage renders with a prominent search bar in the hero. The search bar `placeholder` text reads "Search Black-owned businesses, restaurants, salons…". Below the hero, the city spotlight section shows Atlanta as the featured city. No city pre-filter is active.
- Next: Step 2

**Step 2: User types a search query**

- User action: Clicks into the search bar and types a keyword (e.g., "bookstore", "natural hair", "tax preparation").
- System response: As the user types, the search bar remains active. At MVP there is no autocomplete. The input field uses `type="search"` and triggers `inputMode="text"` on mobile. The search bar is full-width on mobile and centered on desktop.
- Next: Step 3

**Step 3: User submits the search**

- User action: Taps the search icon button or presses Enter / Return.
- System response: Browser navigates to `/search?q=[encoded-query]`. No city filter parameter is appended. The search results page begins loading. A skeleton layout renders immediately: three placeholder listing cards in the grid, the filter bar area showing gray pill placeholders.
- Next: Step 4

**Step 4: Search results load**

- User action: User waits while results load (target: under 2 seconds).
- System response: Results populate. The results count appears: "142 results for 'bookstore'". Listing cards render with: primary image (or a branded placeholder if no image), business name, category pill, city label, claimed/verified badge where applicable, and a Save button (heart icon). The filter bar above the grid shows: a "City" filter (currently showing "All cities"), a "Category" filter, and a "Clear filters" link (inactive since no filters are applied). No sort control at MVP.
- Decision: Did the query return results?
  - Yes → Step 5
  - No → Empty state (documented in States section below)
- Next: Step 5

**Step 5: User scans results**

- User action: User scrolls the results grid, reading names, categories, and cities. If they see a listing from an unexpected city that looks relevant, they may note the city. Mobile: single-column card stack. Desktop: 2–3 column grid.
- System response: As the user scrolls toward the bottom, the next page of results loads (pagination controls or infinite scroll — to be confirmed in implementation). Page controls appear at the bottom on desktop.
- Next: Step 6

**Step 6: User clicks a listing card**

- User action: Taps or clicks anywhere on a listing card (the entire card surface is clickable, not just the title).
- System response: Browser navigates to `/[city-slug]/business/[listing-slug]`. The BLACQList Page begins loading. (See Flow 4 for what happens on the listing page.)
- Next: End state — user is on a BLACQList Page.

### Decision Points

- **Query returns zero results:** User sees the empty state (see States below). The system suggests alternate keywords and shows top categories as visual shortcuts.
- **User has a city in mind after seeing results:** User can tap the "City" filter chip in the filter bar to narrow results without leaving the page. Filter applies immediately and the URL updates to `/search?q=[query]&city=[city-slug]`. (This transitions to Flow 3.)
- **User is not signed in and taps Save on a result card:** Auth-gate modal appears. (See Flow 5 for the save auth-gate flow.)
- **User's browser autocorrects or misspells the query:** The search engine uses PostgreSQL full-text search with `pg_trgm` trigram matching to return fuzzy matches. If the corrected query returns results, a "Showing results for '[corrected term]'" notice appears above the results. At MVP, if the raw query returns zero results and no fuzzy match is found, the empty state renders.

### Required Data

- From the user: search query string (minimum 1 character to submit)
- From the system: listing records with fields — name, city, category, primary image path, claimed status, verified status, listing slug, city slug
- From the DB: `listings` table with `status = 'published'`; full-text search via `tsvector` index on name + description + category; join to `cities` and `categories` tables

### Auth Requirements

No authentication required to search or view results. The Save button on each listing card is visible to anonymous users. Tapping Save while anonymous triggers the auth-gate flow (Flow 5). All other card interactions (click to view, category link, city label link) are available without auth.

### States

| State type                    | Screen / moment                        | What the user sees                                                                                                                                                                                                                                                                                  |
| ----------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading                       | Results page initial load              | Skeleton layout: 3–6 placeholder cards with gray image area, gray text bars, no content. Filter bar shows gray pill shapes. Results count area shows a single gray bar. Skeleton appears immediately on navigation; no blank white screen.                                                          |
| Empty — no results            | After search returns 0 matches         | Full-width message: "No results for '[query]'" in large type. Below: "Try a different keyword, or browse by category." Two rows of category pills below as shortcuts. No other call to action. The search bar remains visible and pre-filled with the query so the user can edit without re-typing. |
| Empty — partial (low density) | Query returns 1–3 results              | Normal results layout renders with the results that exist. No special state — do not artificially inflate or hide low-count results.                                                                                                                                                                |
| Error — search API fails      | `/api/search` returns 5xx or times out | Full-width error banner below the filter bar: "Something went wrong. We couldn't complete your search." Retry button that re-fires the same query. The search bar remains visible. User input is preserved.                                                                                         |
| Error — network offline       | User has no connection when submitting | Browser-level behavior; additionally: if the fetch fails with a network error, same error banner as above with retry.                                                                                                                                                                               |
| Success                       | Results loaded with at least 1 result  | Results grid renders. Count label is visible. Cards are interactive.                                                                                                                                                                                                                                |

### Permission Issues

No permission checks required for national search. The search API is public and rate-limited by IP. If a rate limit is hit, the user sees: "Too many requests. Please wait a moment before searching again." No redirect.

### Mobile Behavior

- Search bar in the homepage hero is full-width on mobile. Tapping it focuses the input and raises the keyboard.
- On `/search`, the filter bar is a horizontal scrollable row of pill buttons. On desktop it is a static row. No drawer or modal required for filters at MVP (the filter set is small: City, Category).
- Listing cards stack in a single column on mobile (375px). Each card is at minimum 80px tall with a left-aligned thumbnail, right-side text. The entire card surface is the tap target — no separate "View" button needed.
- The search bar persists at the top of the `/search` page (sticky on scroll for mobile, fixed header behavior).
- Keyboard type for the search input: `type="search"` on mobile opens the standard text keyboard with a search/go action key.

### Accessibility Considerations

- The search input must have an explicit `<label>` — not placeholder-only. The label can be visually hidden (`sr-only`) but must be present in the DOM.
- The search button must be a `<button type="submit">` inside a `<form>`, not a `<div>` with `onClick`.
- Results count ("142 results for 'bookstore'") must be announced via `aria-live="polite"` region so screen reader users hear the update after the search completes.
- Each listing card must be a single focusable element (`<a>` wrapping the card content) — not multiple nested links. The "Save" button inside the card must not be inside the card's primary `<a>` tag; use a wrapper structure that separates the card link from the save action.
- If the empty state renders, it must be in the `aria-live` region so it is announced.
- Skeleton loading: skeletons should have `aria-hidden="true"` and `aria-busy="true"` on the results container while loading.

### Abuse / Spam Risks

| Risk                                                                    | Mitigation                                                                                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Search scraping (bulk programmatic queries to harvest all listing data) | Rate-limit `/api/search` by IP: 60 requests per minute. Return `429` with `Retry-After` header.                                                                    |
| XSS via search query rendered in the page                               | All query values must be HTML-escaped before rendering in the results count label. Use Next.js default escaping — never dangerously set innerHTML with user input. |
| SEO keyword stuffing via manipulated listing data surfacing in search   | Search results rank by relevance score from PostgreSQL FTS, not by keyword frequency in description alone. Admin can flag and unpublish manipulated listings.      |

### Analytics Events to Track

| Event name                 | When fired                         | Properties                                                                                                                                   |
| -------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_query`             | On search submit                   | `{ query: string, city_filter: string \| null, category_filter: string \| null, result_count: number, source: 'homepage' \| 'search_page' }` |
| `search_result_click`      | On listing card click from results | `{ listing_id: string, listing_slug: string, position: number, query: string }`                                                              |
| `search_empty_state_shown` | When results = 0                   | `{ query: string, city_filter: string \| null }`                                                                                             |

---

## Flow 2: Public User Searches by City

**Phase:** MVP
**User type:** Anonymous Visitor or Supporter
**Starting point:** `/` homepage city grid, `/city/[city-slug]`, or `/search` with a city filter
**Goal:** Discover Black-owned businesses scoped to a specific city.

**User journey:** A visitor knows what city they are interested in — either because they live there, are traveling, or were referred by a city-specific share link. They land on the city page or select a city from the homepage grid, scan what is available in that city, and click into listings. Success is clicking a listing from within the city context. The most likely failure is landing on a city page for a city with very few listings at MVP launch (Houston or Chicago at 50 listings each).

### Happy Path

**Step 1: User selects a city from the homepage**

- User action: On the homepage, user clicks a city in the city spotlight section or a featured city pill (e.g., "Atlanta", "Houston", "Chicago").
- System response: Browser navigates to `/city/[city-slug]` (e.g., `/city/atlanta`). The city landing page begins loading.
- Alternative entry: User types a city name into the search bar on the homepage and submits → `/search?city=atlanta`. Or user arrives at `/city/atlanta` directly via a link.
- Next: Step 2

**Step 2: City landing page loads**

- User action: User waits for page load (city page is statically generated with ISR — target load: under 1 second from CDN).
- System response: City page renders with: city name in the hero ("Black-owned businesses in Atlanta"), a category grid showing top categories for that city with listing counts, a "Browse all" link to `/search?city=atlanta`, and a featured listings grid (6–8 admin-curated listings for that city). A breadcrumb at the top shows: `The BLACQList > Atlanta`.
- Next: Step 3

**Step 3: User browses the city page**

- User action: User scans the category grid and/or the featured listings grid. They may click a category pill (e.g., "Restaurants") or a listing card.
- System response for category click: Navigates to `/city/atlanta/restaurants`. Category + city page loads (Flow 3 handles this).
- System response for listing card click: Navigates to `/[city-slug]/business/[listing-slug]` (Flow 4 handles this).
- Next: Step 4 (if they use the search bar on the city page)

**Step 4: User searches within the city context**

- User action: User types a keyword into the search bar on the city page.
- System response: Search bar on the city page pre-populates the city filter. Submitting the search navigates to `/search?q=[query]&city=atlanta`. Results are scoped to Atlanta. The filter bar shows "Atlanta" as an active city chip with a remove (×) button.
- Next: Step 5

**Step 5: City-scoped results load**

- User action: User scans results scoped to the selected city.
- System response: Results grid renders. Count label reads: "38 results for 'salon' in Atlanta". City chip is visible in the filter bar as an active filter. User can remove the city filter by clicking (×) to expand results nationally.
- Next: User clicks a listing card → Flow 4, or Flow ends.

### Decision Points

- **City has fewer than 10 listings:** City page renders normally. The featured listings section shows what exists. If fewer than 6 listings exist for the city, the grid fills with the available listings and does not pad with empty cells. No "Sorry, not much here yet" message — simply show what is available.
- **User removes the city filter from search results:** URL updates to `/search?q=[query]` without a city param. Results expand to national. The city chip disappears from the filter bar.
- **User navigates to a city that has no seed data:** The city page returns `not-found.tsx` behavior (404). This should not occur if city pages are only generated for cities with at least 1 published listing via `generateStaticParams`. If a city slug is typed manually with no listings, redirect to `/discover` with an explanation: "We haven't launched in [city] yet."

### Required Data

- From the user: city selection (via click or URL parameter)
- From the system: city record by slug; top categories for city (listing count per category); featured listings for city (admin-curated `is_featured` flag or highest-completeness score); city name and meta description for OG tags
- From the DB: `cities` table; `listings` JOIN `categories` WHERE `city_id = [id]` AND `status = 'published'`; `analytics_events` for view count ordering (V1)

### Auth Requirements

No authentication required. City pages are fully public and server-rendered.

### States

| State type                         | Screen / moment                                | What the user sees                                                                                                                                                                                                                                                |
| ---------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading                            | City page first load                           | ISR-cached page loads from CDN — no loading state visible in normal conditions. If the page is being regenerated (cache miss), Next.js streaming shows a skeleton for the listings grid section only, while the static hero and category grid render immediately. |
| Empty — city page with no listings | City slug has no published listings            | Redirect to `/discover` with a banner: "We haven't launched in [City] yet — but we're growing. Explore all cities." No 404 error page.                                                                                                                            |
| Empty — city search returns 0      | City-scoped search for query returns 0 results | "No results for '[query]' in Atlanta. Try removing the city filter or searching nationally." Link to the same query without city filter: `/search?q=[query]`.                                                                                                     |
| Error — city page fails to load    | ISR failure or data fetch error                | Next.js `error.tsx` boundary renders: "Something went wrong loading this page." Retry button.                                                                                                                                                                     |
| Success                            | City page loaded with listings                 | Hero renders with city name, category grid populates with counts, featured listings grid renders.                                                                                                                                                                 |

### Permission Issues

None. City pages are public. No role checks.

### Mobile Behavior

- City page category grid: 2-column grid on mobile (375px), 4-column on desktop. Each category cell shows: category icon, category name, listing count badge.
- Featured listings grid: single-column card stack on mobile.
- City hero: full-width image or gradient background with city name as large text. Search bar is centered and full-width on mobile.
- Breadcrumb: displayed on desktop. Hidden on mobile to reduce clutter (city name in the hero is sufficient context).

### Accessibility Considerations

- City page title (`<h1>`) must include the city name: "Black-owned businesses in Atlanta".
- Category grid items must be `<a>` elements with descriptive `aria-label`: "Restaurants in Atlanta — 42 listings".
- The city name in filter pills must be readable by screen readers with context: `aria-label="Remove Atlanta city filter"` on the remove (×) button.

### Abuse / Spam Risks

| Risk                                                | Mitigation                                                                                                                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crawlers generating thousands of city page requests | `robots.txt` allows city pages; CDN caching absorbs load; `generateStaticParams` limits pages to known cities only; unknown city slugs return 404 (not dynamic DB lookup). |

### Analytics Events to Track

| Event name            | When fired                              | Properties                                                        |
| --------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| `city_page_view`      | On city landing page load               | `{ city_slug: string, city_name: string, listing_count: number }` |
| `city_category_click` | On category pill click from city page   | `{ city_slug: string, category_slug: string }`                    |
| `city_search_submit`  | On search submit from city page context | `{ query: string, city_slug: string }`                            |

---

## Flow 3: Public User Filters by Entity Type / Category / Location

**Phase:** MVP
**User type:** Anonymous Visitor or Supporter
**Starting point:** `/search` results page or `/city/[city-slug]` page
**Goal:** Narrow a discovery session to a specific combination of entity type, category, and/or location.

**User journey:** A visitor has landed on the search results page or a city page and wants to narrow what they see. They interact with the filter controls — selecting a category, a city, or clearing a filter they added — and the results update without a full page navigation. Success is a filtered results set that feels useful and responsive. The most likely failure is a filter combination that returns zero results, leaving the user stuck.

### Happy Path

**Step 1: User arrives at search results with no active filters**

- User action: User is on `/search?q=hair` or `/search` (no query) — the discover/browse state.
- System response: Results grid shows all matching listings. Filter bar is visible above the grid: "City" chip (inactive), "Category" chip (inactive). A "Clear all filters" link is not shown when no filters are active.
- Next: Step 2

**Step 2: User taps a filter chip**

- User action: User taps the "Category" chip in the filter bar.
- System response: A dropdown or bottom sheet (mobile) opens listing all available top-level categories with listing counts. Categories with 0 results for the current query are shown but dimmed. Desktop: dropdown panel opens below the chip. Mobile: a bottom sheet slides up from the screen bottom.
- Next: Step 3

**Step 3: User selects a category**

- User action: User taps "Restaurants" in the category list.
- System response: The bottom sheet or dropdown closes. The filter bar updates: "Restaurants" chip is now active (filled, with Amber Gold background). URL updates immediately to `/search?q=hair&category=restaurants` (or `?category=restaurants` if no text query). Results grid reloads with skeleton loading for a moment, then new results render. Results count updates: "12 results for 'hair' in Restaurants".
- Next: Step 4

**Step 4: User adds a city filter on top of the category filter**

- User action: User taps the "City" chip.
- System response: City dropdown or bottom sheet opens. Shows cities with listing counts for the current filtered query.
- User action: User selects "Atlanta".
- System response: URL updates to `/search?q=hair&category=restaurants&city=atlanta`. Filter bar now shows two active chips: "Restaurants ×" and "Atlanta ×". Results reload. Count: "4 results for 'hair' in Restaurants in Atlanta."
- Next: Step 5

**Step 5: User removes one filter**

- User action: User taps the (×) on the "Restaurants" chip to remove just the category filter.
- System response: URL updates to `/search?q=hair&city=atlanta`. Only the "Atlanta" city chip remains active. Results reload to show all categories in Atlanta matching the query. Count updates.
- Next: Flow ends (user clicks a listing → Flow 4) or continues filtering.

### Decision Points

- **Filter combination returns 0 results:** Empty state renders. System shows: "No results for these filters." Below: two actions — "Remove all filters" (clears to the base query or to no filters at all) and individual "Remove [filter name]" links for each active filter.
- **User navigates to a city+category page directly:** `/city/atlanta/restaurants` is a static page, not a filtered search page. It shows the same visual pattern but is a separate server-rendered route. Filters on this page scope to that city+category combination.
- **User selects "All cities" from the city filter dropdown:** Equivalent to removing the city filter. URL param is cleared.
- **Category has no subcategories at MVP:** No subcategory UI is shown. Category filter is single-level at MVP.

### Required Data

- From the user: filter selections (category slug, city slug)
- From the system: category list with listing counts for the current query; city list with listing counts for the current query
- From the DB: dynamic counts require either a count query on filter change, or pre-computed counts via a materialized view (implementation decision for engineering)

### Auth Requirements

No authentication required. Filters are applied entirely client-side via URL params; the search API is public.

### States

| State type                 | Screen / moment                         | What the user sees                                                                                                                                                                                |
| -------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading                    | After a filter is applied               | Skeleton rows/cards in the results area. The filter bar does not change during loading — the newly selected chip appears immediately (optimistic UI for the chip state), but results are loading. |
| Empty — filter combination | Active filters return 0 results         | "No results for these filters." + "Remove all filters" link + individual filter remove links. The filter chips remain visible so the user understands why results are empty.                      |
| Error — filter API fails   | `/api/search` fails after filter change | Results area shows error banner: "Couldn't load results. Try again." The previously selected filters remain in the URL. Retry button.                                                             |
| Success                    | Filtered results load                   | Results count updates, cards populate, active filter chips are visible in the bar.                                                                                                                |

### Permission Issues

None. Filtering is public.

### Mobile Behavior

- Filter chips are horizontally scrollable on mobile — the row does not wrap. Users swipe left to see additional chips.
- When a filter chip is tapped on mobile, a bottom sheet (modal sheet) slides up from the bottom of the screen, showing the filter options as a scrollable list. The sheet has a drag handle at the top. Tapping outside the sheet or dragging it down closes it.
- Category and city option rows in the bottom sheet are at minimum 48px tall for tap targets.
- The "Clear all filters" link appears in the bottom sheet header row when any filter is active.
- Active chips are visually distinct (Amber Gold fill, white text) so the user can identify them in the scrollable bar.

### Accessibility Considerations

- Filter chip buttons must have `aria-pressed="true/false"` state.
- The category bottom sheet / dropdown must be a `role="dialog"` with `aria-modal="true"`. Focus must move into the sheet when it opens and return to the triggering chip when it closes.
- When results reload after a filter change, the `aria-live` results count region must announce the new count.
- "Remove filter" buttons inside active chips must have `aria-label="Remove [filter name] filter"`.

### Abuse / Spam Risks

| Risk                                                                  | Mitigation                                                                                                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Programmatic filter enumeration to map all category+city combinations | Rate limiting on `/api/search`. Static generation of city+category pages means the common combinations are served from CDN without hitting the API. |

### Analytics Events to Track

| Event name                 | When fired                | Properties                                                                                               |
| -------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `filter_applied`           | On each filter selection  | `{ filter_type: 'category' \| 'city' \| 'entity_type', filter_value: string, existing_filters: object }` |
| `filter_removed`           | On filter chip (×) click  | `{ filter_type: string, filter_value: string }`                                                          |
| `filter_all_cleared`       | On "Clear all filters"    | `{ prior_filters: object }`                                                                              |
| `filter_empty_state_shown` | When filtered results = 0 | `{ active_filters: object }`                                                                             |

---

## Flow 4: Public User Opens a BLACQList Page

**Phase:** MVP
**User type:** Anonymous Visitor or Supporter
**Starting point:** Listing card in search results, city page, or collection; or direct URL
**Goal:** View the full BLACQList Page for a business, evaluate it, and take an action (call, visit website, save, share, get directions).

**User journey:** A visitor clicks a listing card and lands on a BLACQList Page. This is the most important screen in the platform — the core product. Their goal is to evaluate the business: Does this look legit? Is it what I need? How do I contact them or get there? The critical moment is whether the page loads with enough quality content (cover image, description, contact info) to feel meaningfully better than a Google Business listing. Success looks like clicking the primary CTA, saving, or sharing. The most likely failure is a page with no cover image, no description, and no contact info — a stub listing with nothing to act on.

### Happy Path

**Step 1: User clicks a listing card**

- User action: User taps a listing card on the search results page, city page, or a collection.
- System response: Browser navigates to `/[city-slug]/business/[listing-slug]`. Page begins loading. Because BLACQList Pages are statically generated with ISR, the page typically loads from CDN in under 1 second. During loading, the `loading.tsx` skeleton renders.
- Next: Step 2

**Step 2: BLACQList Page renders**

- User action: User begins scanning the page.
- System response: Page renders with the following sections in order:
  1. **Navigation bar** — The BLACQList wordmark, back arrow or breadcrumb back to prior page (if navigated from search), city context.
  2. **Hero** — Full-width cover image. If no cover image is set, a branded gradient placeholder with the business name initial letter. Overlaid on the bottom of the hero: business name (H1), tagline (if set), claimed/verified badge.
  3. **Primary CTA button** — Rendered immediately below the hero, full-width on mobile. Label reflects the owner's configured CTA type: "Book Now", "Order Online", "Visit Website", or "Contact Us". Amber Gold button background.
  4. **Quick-actions bar** — A sticky bar that appears below the CTA on mobile and becomes fixed at the top of the viewport when the user scrolls past the hero. Contains: Save (heart icon), Share (share icon), Call (phone icon, only if phone number is set), Directions (map pin icon, only if address is set).
  5. **About** — Business description.
  6. **Contact & Hours** — Phone, email, website, address. Hours of operation rendered as a weekly grid with today highlighted.
  7. **Social links** — Icon row for Instagram, Facebook, LinkedIn, TikTok, YouTube (only icons for links that are set).
  8. **Services** — List of offered services with optional descriptions.
  9. **Gallery** — Image grid (up to 12 images). Tapping any image opens a lightbox. If no gallery images, this section is omitted.
  10. **Category + location breadcrumb** — Linked back to the city + category page.
- Next: Step 3

**Step 3: User takes an action**

- User action option A: Taps the primary CTA button ("Visit Website").
  - System response: Opens the business's website URL in a new tab (`target="_blank"`, `rel="noopener noreferrer"`). Fires `cta_click` analytics event.
- User action option B: Taps the phone icon in the quick-actions bar.
  - System response: Opens `tel:[phone-number]` on mobile, initiating a call. On desktop, shows the phone number in a tooltip or small popover.
- User action option C: Taps "Save" (heart icon). See Flow 5 for the auth gate.
- User action option D: Taps "Share". See Flow 6 for the share flow.
- User action option E: Taps "Directions" (map pin).
  - System response: Opens a Google Maps or Apple Maps URL with the address pre-filled in a new tab.
- Next: End state (action taken) or user continues browsing.

### Decision Points

- **Listing has no cover image:** Hero renders with a branded gradient placeholder (Deep Background `#19191E` with the business name initial in Amber Gold `#E2A428`). The page does not look broken. The "Upload a photo" nudge is shown only to the owner when logged in.
- **Listing is unclaimed:** A subtle banner appears below the hero (not the primary CTA area): "Is this your business? Claim this Page." Linked to `/claim/[listing-id]`. The page is otherwise fully functional for visitors.
- **Listing is claimed but not verified:** Claimed badge renders (e.g., "Claimed" checkmark). No "Verified" badge. No special message to the visitor.
- **Listing has no phone number:** Phone icon is hidden from the quick-actions bar entirely (not shown as disabled).
- **Listing has no address (online-only or service-area business):** Directions icon is hidden. Contact & Hours section shows "Online / Service Area" instead of an address.
- **Gallery has images:** Image grid renders. First image is larger (featured). Remaining images are a uniform grid.
- **User arrives via direct URL (not from search):** No breadcrumb back arrow. Breadcrumb shows: `The BLACQList > Atlanta > Restaurants > Sweet Auburn BBQ`.

### Required Data

- Full listing record: name, tagline, description, cover_image_path, logo_path, category, city, address, phone, email, website, hours, social_links, cta_type, cta_url, claimed status, verified status, listing_slug, city_slug
- `listing_details_business`: services list, gallery image paths
- `media_attachments`: gallery images for this listing
- `categories`: category name for breadcrumb
- `cities`: city name and slug for breadcrumb and OG tags
- `saves` count for the listing (displayed near the Save button as a count — optional at MVP)

### Auth Requirements

No authentication required to view any part of the BLACQList Page. The Save button is visible to anonymous users. Tapping it while anonymous triggers the auth-gate modal (Flow 5). The phone, website, and directions actions are all available without auth.

### States

| State type                  | Screen / moment                            | What the user sees                                                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Loading                     | Page initial load (cache miss)             | Skeleton: a gray rectangle where the hero image will be, gray bars for the business name, gray block for the about section, gray placeholders for the quick-actions bar icons. The skeleton matches the page structure exactly so the transition from skeleton to content is smooth. |
| Empty — no description      | Listing has no business description        | The "About" section is omitted entirely. No "No description available" placeholder shown to visitors.                                                                                                                                                                                |
| Empty — no services         | No services added                          | Services section is omitted entirely.                                                                                                                                                                                                                                                |
| Empty — no gallery          | No gallery images                          | Gallery section is omitted entirely.                                                                                                                                                                                                                                                 |
| Error — listing not found   | Listing slug does not match any record     | `not-found.tsx` renders: "This page doesn't exist." + "Search The BLACQList" button leading to `/search`.                                                                                                                                                                            |
| Error — listing unpublished | Listing exists but `status != 'published'` | Same `not-found.tsx` behavior. Do not reveal that the listing exists in an unpublished state.                                                                                                                                                                                        |
| Error — page fetch failure  | Server error during ISR regeneration       | Next.js `error.tsx` boundary: "Something went wrong loading this page." + Retry button.                                                                                                                                                                                              |
| Success                     | Page loads with complete listing data      | Hero, CTA, quick-actions, and at minimum one of: description, phone, or website are all visible.                                                                                                                                                                                     |

### Permission Issues

No permission required to view. If the user is authenticated as the owner of this listing, the page renders with an additional "Edit this page" button in the quick-actions bar (leading to `/dashboard/page/edit`). Non-owners and anonymous users do not see this button.

### Mobile Behavior

- Hero image is full-width, 56vw height on mobile (approximately 210px on a 375px screen). No landscape-forcing or aspect ratio cropping distortion.
- Primary CTA button: full-width, 56px tall, Amber Gold background, Black text. This is the largest tap target on the page and is in the thumb zone immediately below the hero.
- Quick-actions bar: 4 icons in a row, each at least 44×44px tap target. The bar becomes sticky at the top of the viewport after the user scrolls past the primary CTA.
- Gallery: 2-column grid on mobile. Tapping an image opens a full-screen lightbox (native-feeling swipe navigation between images).
- Hours: displayed as an accordion on mobile (collapsed by default, with today's hours visible in the header row). Expanded on tap to show the full weekly schedule.
- Social link icons: at least 44×44px each. Row is horizontally scrollable if many links are set.

### Accessibility Considerations

- `<h1>` is the business name. No other element on the page should be an H1.
- Cover image must have a descriptive `alt` attribute: "[Business name] cover photo" or, if the image is purely decorative, `alt=""`.
- Gallery lightbox: when it opens, focus moves into the lightbox. When closed, focus returns to the thumbnail that was tapped. The lightbox must have `role="dialog"`, `aria-modal="true"`, and a close button with `aria-label="Close gallery"`.
- Quick-actions sticky bar: each icon button must have an `aria-label`. "Save [Business Name]", "Share [Business Name]", "Call [Business Name]", "Get directions to [Business Name]".
- The hours accordion must be keyboard operable: toggle with Enter or Space. State indicated by `aria-expanded`.
- The primary CTA button label must be specific and not just "Click here". It reads: "Book Now", "Order Online", "Visit Website", or "Contact Us" — each of which is descriptive.

### Abuse / Spam Risks

| Risk                                         | Mitigation                                                                                                                                                                                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inflating CTA click counts                   | Analytics event is server-side (fired via `/api/analytics/event`) — not purely client-side. Rate limiting on the endpoint. IP deduplication for the same listing+event within a session window.                                                                                          |
| Scrapers harvesting all listing contact data | Contact info is rendered server-side. Phone numbers are displayed as text. At V1: consider rendering phone numbers with CSS content obfuscation or click-to-reveal for non-authenticated users. At MVP: accept the risk — accessibility of contact info to visitors is the product goal. |
| Competitor submitting false listing data     | Admin review + claim workflow (Flows 14, 15). Community correction flag (Flow 13).                                                                                                                                                                                                       |

### Analytics Events to Track

| Event name          | When fired                  | Properties                                                                                                                               |
| ------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `listing_page_view` | On page load                | `{ listing_id: string, listing_slug: string, city_slug: string, category_slug: string, has_cover_image: boolean, claim_status: string }` |
| `cta_click`         | On primary CTA button click | `{ listing_id: string, cta_type: string, cta_url: string }`                                                                              |
| `phone_click`       | On phone icon tap           | `{ listing_id: string }`                                                                                                                 |
| `directions_click`  | On directions icon tap      | `{ listing_id: string }`                                                                                                                 |
| `website_click`     | On website link click       | `{ listing_id: string }`                                                                                                                 |
| `gallery_open`      | On first gallery image tap  | `{ listing_id: string, image_count: number }`                                                                                            |

---

## Flow 5: Public User Saves a Listing (Auth-Gate Moment)

**Phase:** MVP
**User type:** Anonymous Visitor (converting to Supporter)
**Starting point:** Save button on a BLACQList Page or listing card in search results
**Goal:** Save a listing to their personal saved list. The auth gate is the mechanism that converts anonymous visitors to registered Supporters.

**User journey:** An anonymous visitor sees a business they want to return to and taps the Save button. They have not signed in. The platform needs to capture their intent, route them through authentication, and return them to the same listing with the save completed. The critical moment is the return: if the save does not persist after auth, or if the user lands on an unrelated page after sign-in, the conversion is a failure. Success is a seamless "you're back on the listing page, and it's saved." The most likely failure is losing the user's context during auth and landing them on `/dashboard` with no memory of the save.

### Happy Path

**Step 1: Anonymous user taps Save on a listing card or BLACQList Page**

- User action: Taps the heart icon (Save button) on a listing card in search results, or on the quick-actions bar of a BLACQList Page.
- System response: Because the user is anonymous, the save action does not fire immediately. Instead, a modal appears over the current page (not a redirect). The modal content:
  - Heading: "Save this to your list"
  - Subtext: "Create a free account to save and keep track of Black-owned businesses."
  - Primary button (Amber Gold): "Sign up — it's free"
  - Secondary link: "Already have an account? Sign in"
  - Close button (×) in the top-right corner of the modal
- The URL does not change. The user's current page remains visible behind the modal overlay.
- The `listing_id` and `listing_slug` of the listing the user tried to save are stored in `sessionStorage` under key `pending_save`.
- Next: Step 2

**Step 2: User taps "Sign up — it's free"**

- User action: Taps the primary button in the modal.
- System response: Modal closes. User is redirected to `/sign-up?next=[current-page-url]&action=save&listing_id=[listing-id]`. The `next` parameter encodes the full current URL (e.g., `/atlanta/business/sweet-auburn-bbq-atlanta`). The `action=save` and `listing_id` parameters ensure the save is re-triggered after auth.
- Next: Step 3 (sign-up) or Step 3b (sign-in)

**Step 3: User completes sign-up**

- User action: User fills in email, password, display name on `/sign-up`. Submits. (Full sign-up flow is Flow 7.)
- System response: Account is created. Email verification is triggered (user receives a verification email). The session is established. The system reads the `next`, `action`, and `listing_id` URL parameters.
- Decision: Is email verification required before saving?
  - At MVP: email verification is required before a session is fully active. The user is redirected to `/verify-email` after sign-up with the `next` and `listing_id` params preserved.
  - After verification, the session is established and the user is redirected to the `next` URL with the save action pending.
- Next: Step 4

**Step 3b: Existing user taps "Sign in" instead**

- User action: Taps "Already have an account? Sign in" in the modal.
- System response: User is redirected to `/sign-in?next=[current-page-url]&action=save&listing_id=[listing-id]`.
- User action: Completes sign-in form. Submits.
- System response: Session established. `next`, `action`, `listing_id` params are read from the URL.
- Next: Step 4

**Step 4: Post-auth redirect fires the save**

- User action: (Automatic — no user action required.)
- System response: After auth completes, middleware reads the `action=save` and `listing_id` parameters. Before redirecting to the `next` URL, the server fires the save: `POST /api/saves` with `{ listing_id: [id] }` using the new session. The save record is created in the `saves` table.
- System response: User is redirected to the `next` URL (the original BLACQList Page or search results page they came from).
- Next: Step 5

**Step 5: User lands back on the original listing page, save is reflected**

- User action: User is back on the BLACQList Page (e.g., `/atlanta/business/sweet-auburn-bbq-atlanta`).
- System response: The heart icon in the quick-actions bar is now filled/active (indicating the listing is saved). A toast notification appears at the bottom of the screen: "Saved to your list. View saved →" with a link to `/account/saved`. The toast auto-dismisses after 4 seconds. The user can tap the toast link to go to their saved list.
- Next: End state — listing is saved, user is informed, user remains on the Page.

### Decision Points

- **User closes the auth modal without signing in:** The `pending_save` in `sessionStorage` persists for the duration of the session. If they tap Save again later in the same session, the modal reopens. If they navigate away, the pending save is lost (by design — we do not want to surprise the user with an unexpected save if they create an account later for a different reason).
- **Sign-up fails (email already in use):** Sign-up form shows inline error: "That email is already registered. Sign in instead." Link to `/sign-in` with the same `next` and `listing_id` params preserved.
- **User already has the listing saved:** If the user signs in and the listing is already in their saves, the save action is idempotent — `POST /api/saves` uses `INSERT ... ON CONFLICT DO NOTHING`. The heart icon shows as filled. No "already saved" error is surfaced to the user.
- **Save API call fails after auth:** If the post-auth save API call fails (server error), the user is still redirected to the listing page, but the heart icon is not filled. A toast appears: "Couldn't save. Tap the heart to try again." The save can be retried manually.

### Required Data

- From the user: listing they tried to save (listing_id, derived from the page they were on)
- From the system: `next` URL (the page to return to after auth); `listing_id` (the listing to save); user session after auth
- From the DB: `saves` table with `(user_id, listing_id)` unique constraint; `listings` table to validate the listing_id

### Auth Requirements

This flow is specifically the auth-gate flow. It is triggered by an unauthenticated save attempt. The save button is available to all users but the save action requires authentication. After auth, the save fires automatically.

### States

| State type                   | Screen / moment                           | What the user sees                                                                                                                                                                                                                                          |
| ---------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading                      | Post-auth redirect and save API call      | The listing page loads normally (from ISR cache). The save API call is fast (< 200ms). The user sees the listing page, and the heart icon updates from unfilled to filled within a few hundred milliseconds. No visible loading state needed for this step. |
| Empty                        | n/a — not applicable to this flow         | —                                                                                                                                                                                                                                                           |
| Error — save fails post-auth | `/api/saves` returns 5xx                  | Toast: "Couldn't save. Tap the heart to try again." Heart icon remains unfilled.                                                                                                                                                                            |
| Error — sign-up fails        | Email already in use, or validation error | Inline error on the sign-up form. `next` and `listing_id` params preserved in the URL. User corrects and retries.                                                                                                                                           |
| Success                      | Save completed + user on listing page     | Heart icon is filled (Amber Gold). Toast at bottom: "Saved to your list. View saved →". Toast auto-dismisses after 4 seconds.                                                                                                                               |

### Permission Issues

Only authenticated users can save. The save API (`POST /api/saves`) validates the session server-side and returns `401` if no valid session is found. There is no client-side bypass.

### Mobile Behavior

- The auth modal must be a full-screen bottom sheet on mobile (not a centered modal). It slides up from the bottom of the screen with a rounded top edge and a drag handle. Behind it, the listing page is dimmed but visible.
- "Sign up" and "Sign in" buttons are full-width in the bottom sheet, at least 52px tall.
- After auth, the redirect back to the listing page should feel instantaneous from the user's perspective. No unnecessary loading screens.
- The success toast anchors to the bottom of the screen (above the device's safe area inset on iOS). It does not cover the quick-actions bar.

### Accessibility Considerations

- The auth modal / bottom sheet must be a `role="dialog"` with `aria-modal="true"` and `aria-labelledby` pointing to the modal heading.
- When the modal opens, focus moves to the modal heading or the first interactive element (the primary button).
- When the modal closes (dismissed or after redirect begins), focus returns to the Save button that triggered it.
- The toast notification must be in an `aria-live="polite"` region so screen readers announce it when it appears.
- "Sign up" and "Sign in" buttons must have explicit `aria-label` if the button text alone is insufficient in context.

### Abuse / Spam Risks

| Risk                                      | Mitigation                                                                                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Creating throwaway accounts to test saves | Rate limiting on `/sign-up` (5 accounts per IP per day). Email verification required before a session is fully active.                                                                   |
| Injecting malicious `next` URL parameters | The `next` parameter must be validated server-side to ensure it is a same-origin relative URL (starts with `/`). Reject any `next` value that is an absolute URL or contains a protocol. |
| Padding save counts artificially          | Each user can save a listing once (unique constraint on `(user_id, listing_id)`). Save count displayed on the listing page reflects unique saves only.                                   |

### Analytics Events to Track

| Event name                 | When fired                                     | Properties                                                                 |
| -------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| `save_auth_gate_shown`     | When auth modal opens after anonymous save tap | `{ listing_id: string, source: 'listing_page' \| 'search_card' }`          |
| `save_auth_gate_dismissed` | When modal is closed without action            | `{ listing_id: string }`                                                   |
| `listing_saved`            | When save is successfully created              | `{ listing_id: string, user_id: string, source: 'post_auth' \| 'direct' }` |
| `listing_unsaved`          | When save is removed                           | `{ listing_id: string, user_id: string }`                                  |

---

## Flow 6: Public User Shares a Listing

**Phase:** MVP
**User type:** Anonymous Visitor or Supporter
**Starting point:** BLACQList Page quick-actions bar
**Goal:** Share a BLACQList Page URL externally so it renders with a correct preview on social media, in messaging apps, or via copy-link.

**User journey:** A user is on a BLACQList Page and wants to share it with someone. They tap the Share icon. The platform must produce a URL that (a) is clean and shareable, (b) renders a correct OpenGraph preview image and metadata when pasted into iMessage, WhatsApp, Twitter/X, or Instagram DMs, and (c) takes as few taps as possible. On mobile, the OS native share sheet is the ideal UX. Success is the other person receiving a link that previews with the business name, a photo, and the BLACQList branding. The most likely failure is a missing OG image, which causes the preview to show only a URL with no visual context.

### Happy Path

**Step 1: User taps the Share icon on the quick-actions bar**

- User action: Taps the share icon (outward-pointing arrow or box-with-arrow icon) in the quick-actions bar.
- System response:
  - On mobile (where `navigator.share` is available): The OS native share sheet opens immediately. It shows: the URL of the listing page, the page title ("Sweet Auburn BBQ — The BLACQList"), and the OG description (pulled from the `<meta>` tag). The user can share to any installed app: iMessage, WhatsApp, Instagram DMs, copy to clipboard, etc.
  - On desktop (where `navigator.share` is not available or is clipboard-only): A small popover or toast appears with: the listing URL pre-selected in a read-only input, a "Copy link" button, and (optionally) social share buttons for Twitter/X and Facebook.
- Next: Step 2

**Step 2: User selects a share destination (mobile) or copies the link (desktop)**

- User action (mobile): Selects a target app in the OS share sheet (e.g., WhatsApp). Sends the message.
- User action (desktop): Clicks "Copy link".
- System response (mobile): OS handles the share. The sheet closes. No confirmation toast needed — the OS share sheet provides its own confirmation.
- System response (desktop after copy): The popover shows a brief in-place confirmation: the copy button label changes to "Copied!" for 2 seconds, then reverts to "Copy link". No separate toast.
- Fires `listing_shared` analytics event.
- Next: End state — share complete.

**Step 3: Recipient receives and opens the link**

- (This step is outside the platform but is documented for completeness.)
- The recipient opens the link in their browser. Because the BLACQList Page has correct OG meta tags (`og:title`, `og:description`, `og:image`, `og:url`), messaging apps and social platforms render a preview card with: the business cover photo (served via the `/og/[...params]` dynamic image generation route), the business name, the tagline or first 120 characters of the description, and the The BLACQList domain.
- Next: Recipient arrives on the BLACQList Page (Flow 4 begins for them).

### Decision Points

- **`navigator.share` is not available (desktop Chrome, older Android):** Fall back to the copy-link + optional social buttons UI. No native share sheet. The copy-link mechanism uses `navigator.clipboard.writeText()`.
- **`navigator.clipboard.writeText()` is not available (older browsers or non-HTTPS):** Fall back to `document.execCommand('copy')` with a `<textarea>` select trick. If even this fails, show the URL in the input as text so the user can manually select and copy.
- **Listing has no cover image:** The OG image route (`/og/[...params]`) generates a branded fallback image with the business name on a Deep Background gradient with the Amber Gold wordmark. The share preview never shows a blank image.
- **Share from a search results card (not from the full listing page):** The share icon on a listing card in search results (if present) links to the listing's canonical URL, not to the search results URL. The listing's full URL is what gets shared.

### Required Data

- From the system: the canonical URL of the BLACQList Page (current `window.location.href` or the listing's known canonical URL)
- From the listing: `og:title` = "[Business Name] — The BLACQList"; `og:description` = first 155 characters of the business description; `og:image` = URL pointing to `/og/atlanta/sweet-auburn-bbq-atlanta` (dynamic OG image route)
- OG image route data: business name, cover image path (from Supabase Storage CDN URL), category, city

### Auth Requirements

No authentication required to share. Share functionality is available to all users, anonymous or signed in.

### States

| State type                        | Screen / moment                                             | What the user sees                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Loading                           | Between tapping Share and the OS sheet or popover appearing | Native share sheet appears instantly (OS handles it). Desktop popover appears instantly (no async operation). No loading state required. |
| Empty                             | n/a                                                         | —                                                                                                                                        |
| Error — clipboard write fails     | `navigator.clipboard.writeText()` rejects                   | The URL input remains visible. A small error note: "Couldn't copy automatically — select the link above and copy manually."              |
| Error — `navigator.share` rejects | User cancels the OS share sheet                             | OS sheet closes. No error state — user cancellation is not an error.                                                                     |
| Success — mobile                  | OS share sheet opened                                       | Sheet opens. Native confirmation when user completes the share in the target app.                                                        |
| Success — desktop                 | Link copied                                                 | Copy button label changes to "Copied!" for 2 seconds.                                                                                    |

### Permission Issues

No permission required. Share is available to all users on any page.

### Mobile Behavior

- The native OS share sheet (`navigator.share`) is the primary pattern on mobile. It requires no custom UI and handles all share destinations natively.
- The Share icon in the sticky quick-actions bar must be at least 44×44px tap target.
- On iOS, the share sheet appears from the bottom of the screen. No additional UI is needed from the platform.

### Accessibility Considerations

- The Share button must have `aria-label="Share [Business Name]"`.
- The desktop copy-link popover must be a `role="tooltip"` or small `role="dialog"` accessible via keyboard (Tab to reach the copy button, Enter to activate).
- After the copy action, the state change (button label to "Copied!") must be announced via `aria-live="polite"`.

### Abuse / Spam Risks

| Risk                                                    | Mitigation                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Share count inflation via automated share button clicks | `listing_shared` event is debounced client-side: the same user cannot fire more than one share event for the same listing within a 30-second window. Server-side analytics deduplication is applied for the owner dashboard. |

### Analytics Events to Track

| Event name       | When fired                                          | Properties                                                                                                     |
| ---------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `listing_shared` | On share button tap (before OS sheet or after copy) | `{ listing_id: string, share_method: 'native_share' \| 'copy_link', source: 'listing_page' \| 'search_card' }` |

---

## Flow 7: User Creates an Account

**Phase:** MVP
**User type:** Anonymous Visitor (becoming Supporter or Business Owner)
**Starting point:** `/sign-up` — arrived via nav CTA, the auth-gate modal, `/claim` redirect, or `/add-business` redirect
**Goal:** Create a BLACQList account, verify email, complete a brief onboarding step, and land at a role-appropriate destination.

**User journey:** A visitor decides to create an account — either to save a listing (Supporter) or to claim/create a listing (Business Owner). They fill out a short form, verify their email, and answer one onboarding question. Success is landing on the right destination: a Supporter lands at `/account/saved` with a next-step prompt; a Business Owner lands at `/claim` or `/add-business` with context preserved from before they signed up. The most likely failure is a broken "return to what you were doing" redirect that drops the user's context after email verification.

### Happy Path

**Step 1: User arrives at `/sign-up`**

- User action: Arrives from the nav "Sign up" button, the auth-gate modal, or a direct link.
- System response: Sign-up form renders with three fields: Email address (`type="email"`, `autocomplete="email"`), Password (`type="password"`, `autocomplete="new-password"`, show/hide toggle), Display name (`type="text"`, `autocomplete="name"`). Below the fields: a role selector — two radio-card style buttons: "I'm here to discover" (Supporter) and "I have a business" (Business Owner). Default: "I'm here to discover" is selected. Primary CTA button: "Create account". Below: "Already have an account? Sign in" link. Terms acceptance: "By creating an account you agree to our Terms of Service and Privacy Policy." (links to `/terms` and `/privacy`).
- URL params present: `next=[return-url]` and (if applicable) `action=save&listing_id=[id]`.
- Next: Step 2

**Step 2: User fills in the form and selects a role**

- User action: Fills in email, password (minimum 8 characters), display name. Selects "I have a business" if they are a Business Owner.
- System response: Inline validation on blur: email format check, password minimum length indicator, display name non-empty check. No server-side validation fires until submit.
- Next: Step 3

**Step 3: User submits the form**

- User action: Taps "Create account".
- System response: The button shows a spinner and is disabled. A server action (or API route) calls Supabase Auth `signUp` with the email and password. The display name and role selection are stored to the `users` table upon successful auth creation.
- Decision: Did the signup succeed?
  - Success → Step 4
  - Email already in use → Inline error below the email field: "That email is already registered. Sign in instead." Link to `/sign-in` with the `next` param preserved. Button re-enables.
  - Validation error → Inline errors below the relevant fields. Button re-enables.
  - Server error → Error banner at top of form: "Something went wrong. Please try again." Retry. Input is preserved.
- Next: Step 4

**Step 4: Email verification email is sent**

- User action: (Automatic — triggered by Supabase.)
- System response: Supabase sends a verification email to the address the user provided. The page transitions to a verification pending state: the form is replaced with a message: "Check your inbox — we sent a verification link to [email]." A "Resend email" link is present. A note: "Didn't receive it? Check your spam folder."
- The `next`, `action`, and `listing_id` URL parameters are stored in the Supabase auth session metadata so they survive the email verification redirect.
- Next: Step 5

**Step 5: User opens the verification email and clicks the link**

- User action: Switches to their email client and clicks the verification link.
- System response: Browser opens `/verify-email?token=[token]&next=[next-url]&action=[action]&listing_id=[id]`. Supabase validates the token. Session is established.
- Decision: Token valid?
  - Valid → Redirect to `/onboarding?role=[selected-role]&next=[next-url]&action=[action]&listing_id=[id]`
  - Expired or invalid → `/verify-email` page shows: "This link has expired. Request a new one." Button: "Resend verification email" (re-sends using the stored email in session). If no session, shows a form to re-enter the email address.
- Next: Step 6

**Step 6: User completes onboarding**

- User action: On `/onboarding`, user sees a 2-step mini-flow.
  - Step 1: Confirmation of their city (or "I'm everywhere / national"). City selector dropdown. Skip link: "Skip for now."
  - Step 2 (if Business Owner): "Ready to claim or create your BLACQList Page?" with two buttons: "Search for my listing" (→ `/claim`) and "Add my business" (→ `/add-business`). Skip link: "I'll do this later."
  - Step 2 (if Supporter): "What are you looking for today?" with category pills as a light personalization step. Skip link: "Skip."
- System response: User progress indicator shows "Step 1 of 2" and "Step 2 of 2".
- Next: Step 7

**Step 7: Onboarding completes, user lands at destination**

- User action: Completes or skips onboarding steps.
- System response:
  - If `action=save` and `listing_id` params are present: The save fires (see Flow 5, Step 4), and user is redirected to the `next` URL (the listing page) with the listing saved.
  - If `next` URL is present (e.g., `/claim/[listing-id]`): User is redirected to that URL.
  - If Supporter with no pending action: User is redirected to `/account/saved` with a welcome banner: "Welcome to The BLACQList. Start saving businesses you love."
  - If Business Owner with no pending action: User is redirected to `/claim` with a prompt: "Search for your business to claim your free BLACQList Page."

### Decision Points

- **User selects "I have a business" on sign-up:** Role is set to Business Owner in the `users` table. The onboarding Step 2 shows business-specific options.
- **User navigates away from the email verification pending screen:** The session is not yet active. If they return to `/sign-up`, the form is blank (new sign-up). If they return to `/sign-in`, they will receive an "Email not verified" error when attempting to sign in — with a "Resend verification" option.
- **User attempts to sign in before verifying email:** Supabase returns an "email not confirmed" error. The sign-in page shows: "Please verify your email first. Check your inbox or resend the verification link." A "Resend verification email" form (email input + submit) appears.
- **User arrives at `/sign-up` but is already authenticated:** Middleware redirects to `/dashboard` (if Owner) or `/account/saved` (if Supporter).

### Required Data

- From the user: email, password, display name, role selection
- From the system: `next` URL, `action`, `listing_id` from URL params
- From the DB: `users` table (insert on account creation); Supabase Auth (manages credentials + verification token)

### Auth Requirements

`/sign-up` is a public route. If already authenticated, middleware redirects away from it.

### States

| State type                    | Screen / moment                          | What the user sees                                                                                                    |
| ----------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Loading                       | On form submit                           | The submit button shows a spinner and is disabled. The form fields are not disabled — only the button.                |
| Empty                         | n/a                                      | —                                                                                                                     |
| Error — email in use          | After submit                             | Inline error below email field: "That email is already registered." Sign-in link. Button re-enables. Input preserved. |
| Error — validation            | Field blur or submit                     | Inline errors below each failing field. Button does not submit again until errors are corrected.                      |
| Error — server error          | Supabase or network failure              | Banner at top of form: "Something went wrong. Please try again." Input preserved.                                     |
| Success — account created     | After submit, before verification        | Form replaced by: "Check your inbox — we sent a verification link to [email]." Resend link.                           |
| Success — verified            | After email verification link is clicked | Session active. Redirect chain to onboarding begins.                                                                  |
| Success — onboarding complete | After onboarding steps                   | Redirect to role-appropriate destination.                                                                             |

### Permission Issues

No role required to create an account. If a user attempts to access `/dashboard` before completing onboarding or before their claim is approved, middleware redirects them to `/onboarding` (if incomplete) or `/account/saved` (if Supporter).

### Mobile Behavior

- Sign-up form: single-column, full-width on mobile. Fields are stacked vertically with 16px gaps.
- Password field has a show/hide toggle (eye icon) — at least 44px tap target, positioned at the right edge of the input.
- Role selector radio cards are stacked vertically on mobile (side-by-side on desktop). Each card is at least 64px tall with a clear label, a one-line description, and a radio indicator.
- Email verification message: the "Check your inbox" screen on mobile should show a large mail icon, the instruction text, and the resend link. No form elements — just action links.
- Onboarding steps: each step is full-screen on mobile (no sidebar, no multi-column layout). Progress indicator is a simple "Step 1 of 2" text label at the top.

### Accessibility Considerations

- All form inputs must have explicit `<label>` elements — not placeholder-only.
- Password show/hide toggle must have `aria-label="Show password"` / `aria-label="Hide password"`.
- The role selector radio cards must use `<input type="radio">` with `<label>` wrapping each card, grouped in a `<fieldset>` with a `<legend>` of "I am joining as:".
- Error messages must be linked to their fields via `aria-describedby`.
- The submit button spinner state must be announced: `aria-label="Creating your account"` replaces the button label while loading.
- The verification pending screen is a new page state — it must have a clear `<h1>` heading so screen reader users understand the context has changed.

### Abuse / Spam Risks

| Risk                                | Mitigation                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Throwaway account creation for spam | Email verification required before session is active. Rate limit: 5 sign-up attempts per IP per hour. Supabase Auth handles bot detection. |
| Automated account creation          | CAPTCHA consideration at MVP (not required if Supabase's built-in rate limiting is sufficient). Flag for V1 review if abuse is observed.   |
| `next` URL parameter injection      | Validate `next` server-side — must be a same-origin relative URL. Reject absolute or external URLs.                                        |

### Analytics Events to Track

| Event name             | When fired                     | Properties                                                               |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| `sign_up_started`      | On `/sign-up` page load        | `{ source: string, has_next_param: boolean, has_action_param: boolean }` |
| `sign_up_submitted`    | On form submit                 | `{ role_selected: 'supporter' \| 'owner' }`                              |
| `sign_up_completed`    | On successful account creation | `{ role: string, source: string }`                                       |
| `email_verified`       | On verification link click     | `{ user_id: string }`                                                    |
| `onboarding_completed` | On onboarding final step       | `{ role: string, steps_completed: number, steps_skipped: number }`       |

---

## Flow 8: User Submits a New Business Entity

**Phase:** MVP
**User type:** Authenticated user (any role; becomes Business Owner upon submission)
**Starting point:** `/add-business` — arrived from onboarding, nav "Add your business" link, or `/for-business` marketing page CTA
**Goal:** Create a new BLACQList Page for a business that does not yet exist in the platform and publish it live.

**User journey:** A business owner who could not find their listing in the claim flow (or who knows their business is not in the directory) starts the creation flow. They complete a multi-step form: entity type, basic info, contact, category and city, media upload, CTA configuration, and preview. Before final submission, the platform checks for a potential duplicate listing. If none is found, the listing is created with `status: pending_review` and either auto-published (at MVP) or queued for admin review. Success is seeing their listing page live on the platform. The most likely failure is abandoning the form midway due to too many required fields.

### Happy Path

**Step 1: User arrives at `/add-business`**

- User action: Arrives from the onboarding flow, the `/for-business` marketing page, or the dashboard nav.
- System response: Multi-step form renders. Step indicator: "Step 1 of 7". The first step shows entity type selection: "What kind of entity are you adding?" Options (at MVP): Business only. (Professional, Creative, Event, Job are V1+.) At MVP, this step is either pre-selected as "Business" and skipped, or shown with Business as the only selectable option. At MVP, this step skips to Step 2 automatically.
- Next: Step 2

**Step 2: Basic information**

- User action: Fills in — Business name (required), Tagline / short description (optional, max 120 chars), Business description (required, min 50 chars, max 2000 chars).
- System response: Character count shown below the description field. Fields save to draft in `sessionStorage` on blur (autosave behavior to protect against accidental navigation).
- Step indicator: "Step 2 of 7"
- Next: Step 3

**Step 3: Contact information**

- User action: Fills in — Phone number (optional, `type="tel"`), Email (optional, `type="email"`), Website URL (optional, `type="url"`), Address (optional — structured: street, city, state, zip; OR toggle "This business operates online / by service area" which hides the address fields). At least one contact method (phone, email, or website) is required.
- System response: The address fields accept freeform text at MVP (structured parsing is V1). Service area toggle hides address fields and sets `location_type = 'service_area'` in the data model.
- Next: Step 4

**Step 4: Category and city**

- User action: Selects a primary category from a dropdown list (required). Selects a city from a dropdown (required, or toggles "Online only / no city" for online-only businesses). Optionally selects subcategory (if subcategories exist for the chosen category — at MVP, top-level only).
- System response: Category dropdown is searchable (type-ahead filtering in the dropdown). City dropdown is also searchable. Selecting "Online only" sets `location_type = 'online'` and populates a special "Online" city record.
- Next: Step 5

**Step 5: Media upload**

- User action: Uploads a logo (optional) and/or a cover image (optional). The upload UI shows two dropzone areas: "Logo" and "Cover image". Each accepts JPG, PNG, WebP. Max size: 5MB per image. On mobile, the camera icon is present in the dropzone to trigger the device camera directly (`capture="environment"` for cover, `capture="user"` for logo if applicable — or just file picker; both open camera on mobile).
- System response: On file selection, the image is uploaded to Supabase Storage via `/api/upload`. A preview thumbnail renders in the dropzone after upload. A "Remove" button appears on the preview. Upload progress: a progress bar appears while the upload is in progress. If the upload fails: "Upload failed. Try again." The step does not block on upload failure — images are optional.
- Next: Step 6

**Step 6: Primary CTA configuration**

- User action: Selects the CTA type from a button group: "Book Now", "Order Online", "Visit Website", "Contact Us". Enters the CTA URL (required if CTA type is Book Now, Order Online, or Visit Website; optional for Contact Us — if blank, Contact Us CTA triggers a mailto link or shows the contact info on the page). Hours of operation: user fills in open/closed status and hours for each day of the week (optional at MVP — hours can be added later from the dashboard).
- Next: Step 7

**Step 7: Preview and submit**

- User action: A read-only preview of the BLACQList Page renders showing all the information the user has entered. The layout matches the actual BLACQList Page template. An "Edit" link beside each section navigates back to the relevant step.
- System response: Before the user can submit, a server-side duplicate check runs: `POST /api/listings/duplicate-check` with the business name and city. If a potential duplicate is found, Step 7 shows a warning panel above the submit button (see Decision Points).
- User action: Reviews the preview, taps "Publish my Page".
- System response: Submission fires. At MVP, listings are published immediately (`status: published`) without admin review (to reduce friction). The `submitted_by` field is set to the current user's ID. The user's role is updated to include `business_owner` in `user_roles`. The listing `owner_id` is set to the current user. Email confirmation is sent via Resend.
- Next: Step 8

**Step 8: Success state**

- User action: (Automatic — no action needed.)
- System response: A dedicated success screen renders (not just a toast): heading: "Your BLACQList Page is live!" Sub-text: "Here's your page:" with the full BLACQList Page URL as a clickable link. Two buttons: "View my Page" (links to `/[city-slug]/business/[listing-slug]`) and "Go to my dashboard" (links to `/dashboard`). A share prompt: "Share your new page:" with copy-link and social share options.
- Next: End state. User's BLACQList Page is live.

### Decision Points

- **Potential duplicate detected before final submit:** A warning panel appears above the submit button on Step 7: "We found a listing that might already exist: [Business Name] in [City] — Is this your business?" Two options: "Claim this existing listing instead" (links to `/claim/[existing-listing-id]`) or "This is a different business — publish mine" (continues with original submission). The choice is logged.
- **User navigates away mid-form:** The draft state (from `sessionStorage` autosave) is preserved for the duration of the browser session. On returning to `/add-business`, a "Continue where you left off?" banner appears with a "Restore draft" button. Drafts do not persist across browser sessions at MVP — the `sessionStorage` is cleared when the tab or browser closes.
- **Image upload fails:** The user can proceed without an image. The listing is created with a branded placeholder cover image. An email reminder is sent 48 hours post-publish: "Add a photo to your BLACQList Page" (V1 feature — not at MVP).
- **User is not authenticated when they arrive at `/add-business`:** Middleware redirects to `/sign-up?next=/add-business`. After sign-up, they are redirected back to `/add-business` to continue.

### Required Data

- From the user: business name, description, at least one contact method, category, city or online toggle, media (optional), CTA type + URL
- From the system: duplicate check result from `listings` table (name + city fuzzy match); slug generation from business name + city
- From the DB: `listings` table (insert); `business_pages` table (insert); `categories`, `cities` tables (read for dropdowns); `user_roles` table (update)

### Auth Requirements

Authentication required. If the user is anonymous when they arrive, they are redirected to `/sign-up?next=/add-business`. After sign-up and email verification, they are returned to `/add-business`.

### States

| State type                                   | Screen / moment                                           | What the user sees                                                                                                                                                |
| -------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading — image upload                       | During image upload in Step 5                             | Progress bar appears below the dropzone. The dropzone label changes to "Uploading…". The Next button is not disabled during upload (the upload is non-blocking).  |
| Loading — duplicate check                    | Between Step 7 preview render and submit button appearing | A brief spinner in the duplicate check area: "Checking for duplicates…" (< 500ms target).                                                                         |
| Loading — final submit                       | After tapping "Publish my Page"                           | Full-page overlay with spinner: "Publishing your Page…". The button is disabled.                                                                                  |
| Empty — preview with missing optional fields | User skips logo, gallery, hours                           | Preview renders with placeholder for missing images. Missing sections are shown with a grey "Not added" label and an "Add" link.                                  |
| Error — duplicate found                      | Duplicate check returns a match                           | Warning panel on Step 7: "A similar listing exists." Two options shown. Submission is not blocked — user can override.                                            |
| Error — required field missing               | Submit attempt with empty required field                  | Inline validation error on the relevant step. The step indicator highlights the incomplete step. Submission does not proceed until required fields are completed. |
| Error — server error on submit               | 5xx on listing creation API                               | "Something went wrong publishing your page. Your progress has been saved. Try again." Retry button.                                                               |
| Success                                      | Listing created and published                             | Dedicated success screen with "Your BLACQList Page is live!" heading, live URL, and two action buttons.                                                           |

### Permission Issues

Any authenticated user can create a listing. Business Owner role is assigned upon successful listing creation. A user who already owns a listing can create a second listing — each listing is a separate entity. (Admin review may apply for duplicate business owners in V1.)

### Mobile Behavior

- Multi-step form: each step is full-screen on mobile. The progress indicator is a horizontal step bar at the top (not a sidebar). The Next button is a full-width Amber Gold button pinned to the bottom of the screen (sticky bottom bar pattern), always visible without scrolling.
- Image upload: both logo and cover dropzones show a large "Tap to upload" target. On mobile, tapping opens the OS file picker which includes the camera option.
- The description textarea on Step 2: sets `inputMode="text"` and allows multi-line input. The textarea auto-expands as the user types up to a max height, then becomes scrollable.
- Step navigation (Back): a "Back" text button in the top-left of each step, not an icon. Always accessible at 44px minimum touch target.

### Accessibility Considerations

- Each step has an `<h1>` reflecting the step's purpose: "Add basic information", "Add contact details", etc.
- The step indicator (1 of 7) must have `aria-label="Step 2 of 7: Contact information"` on the active step marker.
- File upload inputs must have `<label>` associations and keyboard-accessible focus.
- On the duplicate warning panel, focus should move to the warning heading when it renders so screen reader users hear the warning before the submit button.
- The publish spinner overlay: `aria-live="assertive"` with "Publishing your page…" text for screen readers.

### Abuse / Spam Risks

| Risk                                            | Mitigation                                                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Spam listings (fake or low-quality submissions) | At MVP: listings are published immediately but can be flagged and unpublished by admins. Future: spam score based on profile completeness + contact info validity. |
| Duplicate listings                              | Server-side duplicate check before final submit. User must explicitly choose to override. Admin can dedup via the admin listings view.                             |
| Malicious URLs in CTA or website fields         | Server-side URL validation: must be a valid `https://` URL. No `javascript:` or `data:` URIs. Phishing detection is V1.                                            |

### Analytics Events to Track

| Event name                             | When fired                           | Properties                                                                                                      |
| -------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `add_business_started`                 | On Step 1 load                       | `{ source: 'onboarding' \| 'nav' \| 'for_business_page' \| 'direct' }`                                          |
| `add_business_step_completed`          | On each step advance                 | `{ step_number: number, step_name: string }`                                                                    |
| `add_business_step_abandoned`          | When user navigates away mid-form    | `{ last_step: number }`                                                                                         |
| `add_business_duplicate_warning_shown` | When duplicate is found              | `{ existing_listing_id: string }`                                                                               |
| `add_business_duplicate_override`      | When user proceeds despite duplicate | `{ existing_listing_id: string }`                                                                               |
| `listing_created`                      | On successful listing creation       | `{ listing_id: string, city_slug: string, category_slug: string, has_cover_image: boolean, has_logo: boolean }` |

---

## Flow 9: Owner Claims an Existing Page

**Phase:** MVP
**User type:** Anonymous Visitor (with auth gate) or Supporter (already authenticated), becoming Business Owner
**Starting point:** `/claim` — arrived from the "Is this your business? Claim this Page" banner on a BLACQList Page, the onboarding flow, the `/for-business` CTA, or the nav
**Goal:** Find their existing listing and submit a claim request for admin verification.

**User journey:** A business owner discovers their business already exists in the directory — either seeded from public data or added by a community member. They want to take ownership so they can edit the page, upload their real photos, and configure their CTA. They search for their listing, identify the correct one, submit a claim with verification information, and wait for admin approval. The critical moment is finding their listing in the search — if the search doesn't surface their business clearly, they will give up and create a duplicate. Success is a claim submitted with `status: pending` and a confirmation email received. The most likely failure is finding a listing that doesn't exist yet (→ they should use Flow 8 instead).

### Happy Path

**Step 1: User arrives at `/claim`**

- User action: Arrives from a "Claim this Page" banner on a BLACQList Page (in which case the listing is pre-identified), or navigates to `/claim` from the nav or onboarding.
- System response — arrived from BLACQList Page banner: The URL is `/claim/[listing-id]`. Skip Steps 2–3 and go directly to Step 4.
- System response — arrived from `/claim` without a pre-identified listing: A search form renders. Heading: "Claim your BLACQList Page". Instructions: "Search for your business name to get started." Search input + Search button.
- Auth check: If the user is not authenticated, the form renders but submitting it will trigger the auth gate (Step 2a).
- Next: Step 2

**Step 2: User searches for their listing**

- User action: Types the business name into the search input. Optionally types the city. Submits.
- System response: A results list renders below the search bar showing matching listings. Each result shows: business name, category, city, current claimed/unclaimed status. Results are ordered by name relevance. Maximum 10 results shown.
- Decision: Does their business appear in the results?
  - Yes → Step 3
  - No → User sees: "Don't see your business? Add it instead." Link to `/add-business`. End of this flow branch.
- Next: Step 3

**Step 2a: Auth gate (if not authenticated when searching)**

- User action: Submits the search form while anonymous.
- System response: Browser redirects to `/sign-in?next=/claim&q=[encoded-business-name]`. After sign-in or sign-up (Flow 7), user is returned to `/claim?q=[query]` and the search results are pre-populated.
- Next: Step 2 (results visible post-auth)

**Step 3: User identifies their listing and clicks "Claim this Page"**

- User action: Scans the results, identifies their business, clicks "Claim this Page" next to it.
- System response: Browser navigates to `/claim/[listing-id]`. The listing's name and city are shown at the top as a confirmation header: "Claiming: Sweet Auburn BBQ — Atlanta". Auth is checked: if not authenticated (they skipped Step 2a somehow), redirect to `/sign-in?next=/claim/[listing-id]`.
- Decision: Does the user already have a pending or approved claim on this listing?
  - Existing pending claim for this user: Show "You already have a pending claim for this listing. Check your dashboard for status." Link to `/dashboard`.
  - Listing already has an approved owner: Show "This listing has already been claimed. If you believe this is incorrect, contact us." (No claim form rendered.)
  - No existing claim: Continue to Step 4.
- Next: Step 4

**Step 4: User fills in verification information**

- User action: Completes the verification form:
  - Business email (required — must match a recognized business contact method, or the user explains below)
  - Business phone (optional)
  - Role at the business: radio — "Owner", "Manager", "Authorized representative"
  - Document upload (optional at MVP — accepted file types: JPG, PNG, PDF; examples: business license, utility bill, social media screenshot showing ownership)
  - Optional note: "Anything else that helps us verify?" (free text, max 500 chars)
- Next: Step 5

**Step 5: User submits the claim**

- User action: Reviews the form and taps "Submit claim".
- System response: The claim record is created in the `claims` table with `status: pending`, `listing_id`, `user_id`, `submitted_email`, `submitted_phone`, `role_at_business`, `document_path` (if uploaded), `notes`. A confirmation email is sent to the user's account email via Resend: "Your claim for [Business Name] has been submitted. We'll review it within 2–3 business days."
- The page transitions to a confirmation state: heading: "Claim submitted!" Sub-text: "We're reviewing your claim for [Business Name]. We'll email you at [account email] once it's approved." Two links: "Return to [Business Name]'s page" and "Go to my dashboard" (which shows the claim status).
- Next: End state — claim is pending. User waits for admin approval (Flow 15).

### Decision Points

- **User's business is not in the search results:** Redirect to Flow 8 (Add your business). The claim flow must handle this gracefully — not abandon the user.
- **User has already claimed a different listing and tries to claim a second:** At MVP, one owner per listing and one primary listing per owner. If the user already has an active owner role, show: "You already manage a BLACQList Page. To claim an additional listing, contact us." (Multi-listing management is a V1 feature.)
- **User uploads a document:** Document is uploaded to Supabase Storage in a private bucket (not publicly accessible). Only admins can view documents from the admin panel. Document path is stored in the `claims` table, not the URL.
- **User arrives at `/claim/[listing-id]` for a listing that doesn't exist:** `not-found.tsx` renders.

### Required Data

- From the user: search query; business email (verification); phone (optional); role at business; optional document; optional notes
- From the system: listing_id from URL; current claim status of the listing; authenticated user's ID and account email
- From the DB: `listings` table (read); `claims` table (insert); `users` table (read for account email)

### Auth Requirements

Authentication is required before submitting a claim. An anonymous user can reach `/claim` and search for their listing, but submitting a claim requires a session. The auth gate appears when the user attempts to click "Claim this Page" on a search result.

### States

| State type                      | Screen / moment                                   | What the user sees                                                                                            |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Loading                         | Search results loading                            | Skeleton list below the search input: 3–5 placeholder rows.                                                   |
| Loading — claim submit          | On submit                                         | Button spinner, disabled. "Submitting your claim…"                                                            |
| Empty — no search results       | Business name not found in listings               | "No listings found for '[query]'." Below: "Don't see your business? Add it instead." Link to `/add-business`. |
| Error — listing already claimed | Navigating to `/claim/[id]` for a claimed listing | "This listing has already been claimed. Contact us if you believe this is incorrect." No claim form.          |
| Error — server error            | Claim submission fails                            | "Something went wrong. Your information wasn't lost — please try again." Retry. Form preserved.               |
| Success                         | Claim submitted                                   | "Claim submitted!" screen with next steps and dashboard link. Confirmation email sent.                        |

### Permission Issues

- Supporters can submit claims (becoming Business Owners upon approval). Anonymous users are auth-gated mid-flow. Admins are not expected to use this flow (they manage claims from `/admin/claims`).
- If a user is already a Business Owner for a different listing, the claim form shows a warning (as noted in Decision Points). At MVP, the restriction is one primary listing per owner user.

### Mobile Behavior

- The claim search input is full-width, with a large "Search" button to the right. On mobile, the input and button stack vertically (button is below the input at 375px, full-width).
- Search results list: each result is a 64px-tall row with business name, city label, claimed status badge, and a "Claim" button (48px minimum height). The "Claim" button is right-aligned on desktop, full-width below the listing info on mobile.
- Document upload: on mobile, tapping the upload zone opens the OS file picker. Camera option included for taking a photo of a document.
- Verification form: single-column, all fields visible without horizontal scrolling.

### Accessibility Considerations

- The search input must have `<label>Search for your business</label>` (not placeholder-only).
- Search results list items must be keyboard-navigable. The "Claim" button within each result must be reachable via Tab and activatable via Enter.
- The "Claim already pending" and "Already claimed" states must have clear `<h2>` headings and not just a paragraph of text. Screen reader users need to understand the page context changed.
- The document upload input must have an accessible label and describe accepted file types in the label text or `aria-describedby`.

### Abuse / Spam Risks

| Risk                                                      | Mitigation                                                                                                                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fraudulent claims (competitor claiming a rival's listing) | Admin reviews all claims before approval. Document upload (optional but encouraged). Email match against the listing's known contact email is a signal (not enforced as a hard block). |
| Claim flooding (submitting claims on many listings)       | Rate limit: 3 pending claims per user at MVP. If a user has 3 pending claims, they must wait for one to be resolved before submitting another.                                         |
| Fake document uploads                                     | Documents are stored privately and only viewed by admins. Admin is responsible for assessing authenticity. Automated document verification is V1+.                                     |

### Analytics Events to Track

| Event name                            | When fired                         | Properties                                                                |
| ------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| `claim_search_submitted`              | On search form submit              | `{ query: string }`                                                       |
| `claim_search_result_selected`        | On "Claim" button click in results | `{ listing_id: string }`                                                  |
| `claim_submitted`                     | On claim form submit               | `{ listing_id: string, has_document: boolean, role_at_business: string }` |
| `claim_no_results_add_business_click` | On "Add it instead" link click     | `{ query: string }`                                                       |

---

## Flow 10: Owner Edits a Claimed BLACQList Page

**Phase:** MVP
**User type:** Business Owner (claim approved)
**Starting point:** `/dashboard/page` or `/dashboard`
**Goal:** Update the BLACQList Page — change description, add photos, update hours, configure CTA — and publish the changes live.

**User journey:** An approved business owner logs in to update their page. They navigate to the page editor, make changes in the relevant section, save, and the live page reflects the updates. The critical moment is the save — the owner needs to feel confident that their changes persisted and that the live page looks correct. Success is the live BLACQList Page showing the updated content. The most likely failure is unsaved changes if the owner edits one section and navigates to another section without saving.

### Happy Path

**Step 1: Owner navigates to the page editor**

- User action: Signs in (if not already). Navigates to `/dashboard`. Sees a "Edit my Page" quick-action button on the dashboard home. Clicks it.
- System response: Browser navigates to `/dashboard/page/edit`. The full page editor loads. The editor is organized into collapsible sections mirroring the BLACQList Page layout: Hero (cover image, logo), Basic Info (name, tagline, description), Contact & Hours, Social Links, Services, Gallery, CTA, Publish Settings.
- Next: Step 2

**Step 2: Owner edits a section**

- User action: Owner scrolls to a section (e.g., "About"). The section is pre-populated with current field values. They update the description text.
- System response: The form uses `react-hook-form`. Field changes are tracked. An autosave indicator appears in the section header: "Unsaved changes" when the field is dirty. On field blur: the form autosaves the section to `draft` status locally (via `sessionStorage`) and queues a server save after 2 seconds of inactivity.
- On successful server save: the indicator updates to "Saved" with a timestamp.
- Next: Step 3

**Step 3: Owner uploads a new cover image**

- User action: In the Hero section, clicks "Replace cover image". An upload dialog opens. Selects a file from their device or camera.
- System response: Upload begins via `/api/upload`. Progress bar renders in the upload area. After upload completes, a preview of the new image renders in the Hero section of the editor. The old image is visually replaced. The new image path is stored but the listing record is not yet updated on the live page until the owner publishes.
- Decision: Upload fails (file too large, wrong type)?
  - Error renders in the upload area: "Upload failed. Images must be JPG, PNG, or WebP under 5MB." The previous image is unchanged.
- Next: Step 4

**Step 4: Owner previews the page**

- User action: Clicks "Preview" button (top-right of the editor, visible without scrolling).
- System response: A new browser tab opens (or a split-panel if design supports it) showing the BLACQList Page with the saved draft data applied. A banner at the top of the preview: "Preview mode — this is not your live page." Close preview tab to return to editor.
- Next: Step 5

**Step 5: Owner publishes changes**

- User action: Returns to the editor tab. Clicks the "Publish changes" button (Amber Gold, pinned to the top-right of the editor or in a sticky bottom bar on mobile).
- System response: All pending draft changes are written to the `listings` and `business_pages` tables. `status` is set or remains `published`. The live BLACQList Page at `/[city-slug]/business/[listing-slug]` is updated via ISR revalidation triggered server-side (`revalidatePath`). A toast at the bottom of the screen: "Changes published. View live page →". The toast links to the live BLACQList Page.
- Next: End state — changes are live.

### Decision Points

- **Owner navigates away from the editor with unsaved changes:** A browser `beforeunload` dialog is shown: "You have unsaved changes. Leave and lose them?" On mobile, `beforeunload` is unreliable — the autosave system (server-save on blur) is the primary protection. The editor also shows a persistent "Unsaved changes" badge in the header when there are unpublished edits.
- **Owner publishes while a section is still uploading:** The publish button is disabled while any upload is in progress. Tooltip on the disabled button: "Finish uploading before publishing."
- **Owner toggles the listing to "Unpublish":** A toggle in the Publish Settings section allows the owner to set `status: unlisted`. The live page returns `not-found.tsx` while unpublished. A warning dialog confirms: "Unpublishing will hide your page from search and direct links. Continue?" The dashboard shows an "Unpublished" status badge.
- **Owner's claim is still pending:** The dashboard nav link to the editor is visible but shows a lock icon. Clicking it shows: "Your page is locked until your claim is approved." Link to claim status. The owner cannot edit until the claim is approved.

### Required Data

- From the user: updated field values, new media uploads
- From the system: current listing data pre-populated in form; user's session and owner relationship to the listing
- From the DB: `listings`, `business_pages`, `media_attachments` (read and write); ISR revalidation of the live listing page URL

### Auth Requirements

Authentication required. Business Owner role required. If a Supporter (not an owner) navigates to `/dashboard/page/edit`, middleware redirects to `/account/saved`. Server-side validation on each save action also confirms the requesting user is the `owner_id` of the listing being edited.

### States

| State type                      | Screen / moment                             | What the user sees                                                                                                                                |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading — editor initial load   | Page load                                   | Skeleton: gray blocks for each section header, gray input outlines. The editor structure appears immediately; data populates within 1–2 seconds.  |
| Loading — autosave              | After field blur                            | Section header shows "Saving…" spinner for < 500ms, then "Saved" with timestamp.                                                                  |
| Loading — image upload          | During upload                               | Progress bar in the upload area. Upload percentage visible.                                                                                       |
| Loading — publish               | After "Publish changes" tap                 | Button spinner. Disabled. "Publishing…" label. Full page overlay not shown — in-button spinner is sufficient since publish is fast (< 2 seconds). |
| Empty — new owner, blank fields | Owner claims listing with minimal seed data | Form fields are blank (not pre-filled). Each section shows helper text: e.g., "Add your business description to help customers find you."         |
| Error — autosave fails          | Server returns error during background save | "Unsaved changes — couldn't save automatically. Try manually saving." A "Save now" link appears. The form data is not lost.                       |
| Error — publish fails           | 5xx on publish action                       | Toast: "Couldn't publish. Your draft is saved. Try again."                                                                                        |
| Success                         | Publish completes                           | Toast: "Changes published. View live page →". The "Unsaved changes" badge clears.                                                                 |

### Permission Issues

Only the owner of the specific listing can edit it. Admin can also edit any listing from `/admin/listings/[id]/edit`. A Business Owner navigating to `/dashboard/page/edit` for a listing they do not own will be returned a 403 server-side and shown: "You don't have permission to edit this page."

### Mobile Behavior

- The editor on mobile is a single-column scrolling form. Each section is a collapsible accordion (closed by default except the currently active section). This keeps the form manageable on a small screen.
- The "Publish changes" button is a sticky bottom bar on mobile: full-width Amber Gold button, always visible. It appears above the device safe area inset.
- Image upload in the Gallery section: on mobile, dragging images is replaced by a tap-to-select interaction. Gallery images can be reordered via a long-press and drag pattern (or a simpler "move up / move down" control if drag-reorder is complex at MVP).
- Autosave confirmation toasts appear at the bottom of the screen, above the sticky publish button.

### Accessibility Considerations

- The editor must be navigable by keyboard: Tab through all section headers (accordion controls), into form fields, through upload controls.
- Accordion section headers must use `<button>` with `aria-expanded` and `aria-controls` pointing to the section content `id`.
- The "Unsaved changes" badge must be an `aria-live="polite"` region so screen reader users are informed when the save state changes.
- Image previews in the gallery must have `alt` text (user-provided or auto-generated as "[Business name] gallery image [n]").
- The "Publish changes" button disabled state (during upload) must communicate why it is disabled: `aria-describedby` pointing to "Finish uploading before publishing" text.

### Abuse / Spam Risks

| Risk                                                                 | Mitigation                                                                                                                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner replacing a legitimate listing with spam or competitor content | All field updates are written to the listing with `updated_by` audit trail. Admins can review recent changes and roll back. In V1: change history is preserved. |
| Injecting malicious URLs in CTA or website fields                    | Server-side URL validation on save. Only `https://` URLs accepted.                                                                                              |
| Large image uploads (DoS via storage)                                | Max 5MB per image enforced server-side. Max 12 gallery images. Total storage per listing: 100MB cap (enforced at the API level).                                |

### Analytics Events to Track

| Event name            | When fired                 | Properties                                                           |
| --------------------- | -------------------------- | -------------------------------------------------------------------- |
| `page_editor_opened`  | On editor page load        | `{ listing_id: string }`                                             |
| `page_section_edited` | On any field change        | `{ listing_id: string, section: string }`                            |
| `page_image_uploaded` | On successful image upload | `{ listing_id: string, image_type: 'cover' \| 'logo' \| 'gallery' }` |
| `page_previewed`      | On "Preview" button click  | `{ listing_id: string }`                                             |
| `page_published`      | On successful publish      | `{ listing_id: string, sections_changed: string[] }`                 |

---

## Flow 11: Owner Views Basic Dashboard

**Phase:** MVP
**User type:** Business Owner (claim approved)
**Starting point:** `/dashboard` — arrived via sign-in redirect, nav, or post-claim-approval email link
**Goal:** Understand how their BLACQList Page is performing, confirm their claim and page status, and take the next most relevant action.

**User journey:** A business owner signs in and lands on their dashboard. They want to know: Is my page live? Is anyone seeing it? What should I do next? At MVP, the dashboard has basic counts (views, CTA clicks, saves, shares) and quick-action links. The critical moment is the status banner — a pending claim owner must understand why they cannot edit their page yet. An approved owner must see an invitation to act (edit the page, share it, view it). Success is the owner taking one action from the dashboard: viewing their live page, clicking "Edit my Page", or sharing their page link. The most likely failure is a dashboard that shows nothing actionable — especially for newly approved owners who have not yet enriched their page.

### Happy Path

**Step 1: Owner signs in and lands at `/dashboard`**

- User action: Signs in at `/sign-in`. Session established. Middleware reads role: `business_owner`. Redirects to `/dashboard`.
- System response: Dashboard renders. The top of the page shows a status banner (see below). Below: the page preview card, analytics strip, and quick-action buttons.
- Next: Step 2

**Step 2: Owner reads the status banner**

- System response:
  - Claim status = `pending`: Banner (amber/warning style): "Your claim for [Business Name] is under review. We'll notify you by email when it's approved. Estimated: 2–3 business days." No editing buttons are enabled.
  - Claim status = `approved` / listing `status = published`: Banner (green/success style): "Your BLACQList Page is live!" with a "View live page" link. If the page has low completeness (no cover image, no description), the banner adds: "Add a photo to get noticed."
  - Claim status = `rejected`: Banner (red/error style): "Your claim was not approved. Reason: [admin-provided reason]. Questions? Contact us." Link to support email.
  - No claim (user created a listing directly): No claim banner. Status banner shows the listing's publish status.
- Next: Step 3

**Step 3: Owner views the page preview card**

- System response: A card shows a thumbnail of the BLACQList Page (cover image if set, or the branded placeholder), the business name, the live URL (e.g., `theblacqlist.com/atlanta/business/sweet-auburn-bbq-atlanta`), and two buttons: "View live page" (external link) and "Edit my Page" (link to `/dashboard/page/edit`).
- User action: Clicks "View live page" or "Edit my Page".
- Next: Flow 10 (if editing) or Flow 4 (viewing the live page). Flow continues for the analytics steps below.

**Step 4: Owner views analytics summary strip**

- System response: A row of 4 stat cards renders below the page preview card:
  - Page views (last 7 days)
  - CTA clicks (last 7 days)
  - Saves (total)
  - Shares (total)
  - At MVP: these are count-only metrics from the `analytics_events` table. No trend graphs. No comparison to prior periods. Each card shows: metric name, number in large type, and a "Last 7 days" or "All time" label.
  - If the page was just created and has 0 views: each card shows "0" with no special state — this is not an error.
- Next: Step 5

**Step 5: Owner views the completion checklist and quick actions**

- System response: Below the analytics strip, a completion checklist shows Page completeness:
  - [ ] Add a cover image
  - [ ] Write a business description
  - [ ] Add your hours
  - [ ] Add a contact method (phone, email, or website)
  - [ ] Set your primary CTA
  - [ ] Upload a logo
  - Each checked item shows a checkmark. Each unchecked item links directly to the relevant section of the page editor (`/dashboard/page/edit#[section]`).
- Quick-action buttons below the checklist: "Share my Page" (triggers Flow 6), "Add a service" (links to `/dashboard/services/new`).
- User action: Taps a checklist item or a quick-action button.
- Next: End state — user navigated to next task.

### Decision Points

- **Claim status is pending:** Edit button is disabled. Checklist items are visible but greyed out with a note: "Available after your claim is approved." The "View live page" button is also hidden (page may not be published yet during pending status).
- **User has no listing yet (landed at `/dashboard` without a claim or created listing):** This should not occur if onboarding redirects correctly. If it does: dashboard shows: "You haven't claimed or created a listing yet." Two buttons: "Claim my business" (→ `/claim`) and "Add my business" (→ `/add-business`).
- **Analytics show 0 across all metrics for a newly live page:** All stat cards display 0. No empty state illustration — 0 is valid data. A contextual tip below the analytics strip: "Share your page link to start getting views."

### Required Data

- From the system: user session; owner's listing record (`owner_id` join); claim record for that listing; analytics event aggregates for the listing (grouped by event type, filtered to last 7 days); media_attachments (for page preview thumbnail); completeness flags
- From the DB: `listings`, `claims`, `analytics_events` (aggregate query), `media_attachments`

### Auth Requirements

Authentication required. Business Owner role required. If a Supporter navigates to `/dashboard`, middleware redirects to `/account/saved`.

### States

| State type                         | Screen / moment                             | What the user sees                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Loading                            | Dashboard initial load                      | Skeleton: gray rectangle for the status banner area, gray placeholders for the 4 stat cards, gray block for the page preview card. Skeleton renders immediately.                     |
| Empty — newly approved owner       | All analytics = 0, page has minimal content | 0 values in stat cards (not an error). Completion checklist shows most items unchecked. No special illustration — functional empty state with clear call to action.                  |
| Error — analytics fetch fails      | `analytics_events` aggregate query fails    | Stat cards show "—" instead of numbers. Small error note below the strip: "Couldn't load stats. Try refreshing." Retry link. The rest of the dashboard renders normally.             |
| Error — listing data fails to load | Listing record fetch fails                  | Error boundary renders for the page preview card section: "Couldn't load your page info. Try refreshing." The status banner and checklist still render if their data is independent. |
| Success                            | Dashboard loaded with live page             | Status banner shows "Your page is live!" Analytics strip shows numbers (even if all 0). Page preview card shows thumbnail and URL. Checklist shows current completion state.         |

### Permission Issues

Non-owners navigating to `/dashboard` are redirected to `/account/saved`. An owner can only see dashboard data for listings they own. The analytics query is server-side and scoped to `listing_id WHERE owner_id = auth.uid()`.

### Mobile Behavior

- Dashboard on mobile: all sections stack vertically in a single column. No sidebar.
- The status banner is full-width and appears first, before the page preview card.
- The 4 stat cards form a 2×2 grid on mobile (2 per row), each card full-width within its column.
- The completion checklist items are 52px-tall rows with the item label, a status indicator (check or circle), and a right arrow (→) leading to the editor section.
- The quick-action buttons are stacked vertically on mobile (full-width each).

### Accessibility Considerations

- The status banner must have an appropriate ARIA role: `role="status"` for informational banners, `role="alert"` for rejection banners. The rejection banner must be announced immediately on page load.
- Stat cards: each number must have a text label that screen readers can read as a complete phrase — not just the number. Use `aria-label="142 page views in the last 7 days"` on each card.
- Checklist items that link to editor sections must have descriptive link text: "Add a cover image to your BLACQList Page" — not just "Add cover image".

### Abuse / Spam Risks

No direct abuse vectors on the dashboard itself. Analytics data is read-only for the owner. Inflated view counts via bot traffic are mitigated at the analytics ingestion layer (IP deduplication in `/api/analytics/event`).

### Analytics Events to Track

| Event name                       | When fired                | Properties                                                                      |
| -------------------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| `dashboard_viewed`               | On dashboard page load    | `{ listing_id: string, claim_status: string, page_completeness_score: number }` |
| `dashboard_view_live_page`       | On "View live page" click | `{ listing_id: string }`                                                        |
| `dashboard_edit_page_click`      | On "Edit my Page" click   | `{ listing_id: string }`                                                        |
| `dashboard_checklist_item_click` | On checklist item click   | `{ listing_id: string, item: string }`                                          |

---

## Flow 12: User Writes a Review

**Phase:** Beta (review display) / MVP queue only (review intake)
**User type:** Supporter (logged in)
**Starting point:** Business BLACQList Page — on a claimed listing
**Goal:** Submit a star rating and written review for a business the user has visited or transacted with.

**User journey:** A logged-in supporter is on a BLACQList Page for a business they have experience with. They want to share their experience. They tap "Write a review", fill in a star rating and text, and submit. At MVP, reviews are stored in a `reviews` table with `status: pending` — they are never displayed publicly until an admin-moderated review queue is operational (V1). The user receives confirmation that their review was received. Success is a submitted review with a clear status message. The most likely failure is a user submitting a review and then expecting to see it immediately on the page — the deferred display must be communicated clearly.

### Happy Path

**Step 1: User taps "Write a Review" on a BLACQList Page**

- User action: User is on a claimed BLACQList Page (reviews are only available on claimed listings at MVP — unclaimed listings do not show the "Write a Review" button). The "Reviews" section of the page shows a placeholder: "No reviews yet. Be the first." and a "Write a review" button.
- Auth check: If not logged in, the auth-gate modal appears (Flow 5 pattern, adapted for reviews). URL preserves `action=review&listing_id=[id]`.
- System response: A review form expands inline (or a bottom sheet on mobile). The form contains: a 5-star rating selector (required), a text area for the review body (required, minimum 20 chars, maximum 1000 chars), and a Submit button.
- Next: Step 2

**Step 2: User fills in the review**

- User action: Taps a star rating (1–5 stars). Taps each star in the star selector to select it. Types their review in the text area.
- System response: Stars become highlighted as the user taps (all stars up to the selected rating fill with Amber Gold). Character count shown below the text area: "350 / 1000 characters". No inline validation while typing — validation fires on submit.
- Next: Step 3

**Step 3: User submits the review**

- User action: Taps "Submit review".
- System response: Submit button shows a spinner and is disabled. Server-side validation: rating is between 1 and 5, text is non-empty and meets minimum length. If validation passes: review record is created with `status: pending`, `listing_id`, `user_id`, `rating`, `body`, `created_at`. Submit button state resolves.
- Next: Step 4

**Step 4: Confirmation message**

- System response: The review form is replaced by a confirmation message (inline, where the form was): "Thanks for your review of [Business Name]. We'll publish it after a quick check — usually within 48 hours." A "Write another review" link is not shown — one review per user per listing is enforced. The "Write a review" button is now hidden for this user on this listing (replaced by "You reviewed this business").
- Next: End state.

### Decision Points

- **User has already reviewed this listing:** The "Write a review" button is replaced by "You reviewed this business" (for logged-in users). Clicking it shows their submitted review text with its current status (pending / published / rejected).
- **Review text is too short (under 20 chars):** Inline error below the text area on submit: "Your review is too short. Please share at least a sentence about your experience." Submit does not proceed.
- **User submits without selecting a star rating:** Inline error on the star selector: "Please select a star rating." (The star selector should make the default state visually clear — no stars selected is the initial state, not 3-stars-default.)
- **User is not logged in:** Auth-gate modal appears (same pattern as Flow 5). After auth, the review form re-appears. The `action=review&listing_id=[id]` params in the URL ensure the page re-opens with the review form visible.
- **Listing is unclaimed:** Review button is not shown. Reviews are only meaningful for claimed listings where an owner can be notified. Unclaimed listings display: "This listing hasn't been claimed yet. Reviews will be available once an owner has verified their information."

### Required Data

- From the user: star rating (1–5), review body text, listing_id
- From the system: user session (user_id); check for existing review by this user for this listing
- From the DB: `reviews` table (insert); unique check on `(user_id, listing_id)`

### Auth Requirements

Authentication required to submit a review. The "Write a review" button is visible to anonymous users on claimed listings, but triggers the auth-gate on tap.

### States

| State type                 | Screen / moment                      | What the user sees                                                                                             |
| -------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Loading                    | On review submit                     | Button spinner. Disabled.                                                                                      |
| Empty — no reviews on page | First review for this listing        | "No reviews yet. Be the first." + "Write a review" button.                                                     |
| Error — validation failure | Short text or no rating              | Inline errors below the relevant fields. Form preserved.                                                       |
| Error — server error       | 5xx on review submit                 | "Something went wrong. Your review wasn't submitted. Try again." Input preserved.                              |
| Error — already reviewed   | User tries to submit a second review | "You've already reviewed this business." Their existing review status shown.                                   |
| Success                    | Review submitted                     | Inline confirmation: "Thanks for your review. We'll publish it after a quick check — usually within 48 hours." |

### Permission Issues

- Any authenticated Supporter or Business Owner can submit a review on any claimed listing except their own. A Business Owner cannot review their own listing — server-side check: if `user_id` matches the `owner_id` of the listing, return `403` with message: "You can't review your own business."
- Admin can view all pending reviews from `/admin/reviews` (V1).

### Mobile Behavior

- On mobile, the review form opens as a bottom sheet (full-height drawer) rather than expanding inline. This gives the user a focused writing environment.
- The star selector uses large tap targets: each star is at least 44×44px. Stars in a horizontal row. Stars fill left-to-right as the user taps.
- The text area is at least 120px tall by default, auto-expanding as the user types.
- The submit button is full-width at the bottom of the bottom sheet, sticky above the device safe area.

### Accessibility Considerations

- The star rating selector must not be purely visual. Use `<input type="radio">` inputs for each star value (1–5), styled to look like filled/unfilled stars. Each radio must have a label: "1 star — Poor", "2 stars — Fair", etc.
- The text area must have a visible `<label>`: "Your review".
- After submission, the inline confirmation must be announced via `aria-live="polite"`.
- The bottom sheet (mobile) must be `role="dialog"` with `aria-modal="true"` and focus management.

### Abuse / Spam Risks

| Risk                                                                  | Mitigation                                                                                                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Fake reviews (competitors, bots)                                      | All reviews go to `status: pending` — no public display until admin moderation (V1). At MVP, reviews are collected but never shown. |
| Review flooding (one user posting many reviews on different listings) | Rate limit: 5 review submissions per user per day. Enforced server-side.                                                            |
| Review text injection (script tags, malicious content)                | All text content is HTML-escaped before storage and rendering. Server-side sanitization on the review body field.                   |

### Analytics Events to Track

| Event name           | When fired               | Properties                                                            |
| -------------------- | ------------------------ | --------------------------------------------------------------------- |
| `review_form_opened` | On "Write a review" tap  | `{ listing_id: string, auth_status: 'authenticated' \| 'anonymous' }` |
| `review_submitted`   | On successful submission | `{ listing_id: string, rating: number, body_length: number }`         |

---

## Flow 13: User Reports Incorrect Information

**Phase:** MVP (intake only; corrections queue is V1)
**User type:** Anonymous Visitor or Supporter
**Starting point:** BLACQList Page — "Is this info incorrect?" link in the page footer area
**Goal:** Flag specific incorrect or outdated information on a listing for admin review.

**User journey:** A visitor notices that the phone number is disconnected, the business has moved, the business is permanently closed, or the hours are wrong. They tap the correction link, select what is incorrect, optionally add a note, and submit. Success is a correction record created in the queue and a "Thank you" confirmation shown to the user. The most likely failure is the user not finding the reporting link (it must be visible, not buried).

### Happy Path

**Step 1: User taps "Is this info incorrect?" on the BLACQList Page**

- User action: Scrolls to the bottom of the BLACQList Page. Sees a small link: "Report incorrect information" (or "Is this info incorrect?"). Taps it.
- System response: A bottom sheet (mobile) or modal (desktop) opens. Heading: "Report a problem with this listing." Instructions: "Help us keep The BLACQList accurate."
- No auth required to view or submit the report.
- Next: Step 2

**Step 2: User selects what is incorrect**

- User action: Selects one or more checkboxes from a list:
  - Business name is wrong
  - Address / location is wrong
  - Phone number is wrong or disconnected
  - Hours are wrong
  - Website link is broken
  - Category is wrong
  - This business is permanently closed
  - This is a duplicate listing
  - Other
- System response: If "Other" is checked, a text field appears: "Please describe the issue (optional)."
- Next: Step 3

**Step 3: User submits the report**

- User action: Taps "Submit report".
- System response: A `corrections` record is created (even at MVP, the table can exist and intake can work; moderation queue is V1 UI work). Record contains: `listing_id`, `reporter_user_id` (if authenticated, else null), `reporter_ip_hash` (hashed for privacy), `issue_types` (array of selected issues), `notes` (optional free text), `status: pending`, `created_at`.
- The bottom sheet / modal transitions to a confirmation message: "Thanks — we're on it." Sub-text: "Our team reviews all reports. We'll update the listing if the information is incorrect." Close button.
- No email confirmation to the reporter (to avoid creating an expectation of a follow-up that cannot be met at MVP scale).
- Next: End state.

### Decision Points

- **"This business is permanently closed" is selected:** In addition to creating the correction record, a flag is added to the listing: `flagged_as_closed: true`. This surfaces the listing in a "Possibly closed" queue in the admin dashboard at MVP. An admin can confirm the closure and update the listing status accordingly.
- **User selects no checkboxes and tries to submit:** Submit button is disabled until at least one checkbox is selected. Inline note: "Select at least one issue before submitting."
- **Same user submits multiple reports for the same listing:** The system accepts multiple reports. Each is a separate `corrections` record. Rate limit: 3 reports per IP hash per listing per 24 hours to prevent spam.

### Required Data

- From the user: listing_id (from page context), selected issue types, optional notes
- From the system: user_id (if authenticated, else null); IP hash (for rate limiting)
- From the DB: `corrections` table (insert); `listings` table (update `flagged_as_closed` if applicable)

### Auth Requirements

No authentication required. Anonymous reports are accepted. The reporter's IP hash is stored for rate limiting and spam mitigation only — it is never displayed to the listing owner or used for identification.

### States

| State type           | Screen / moment  | What the user sees                                                     |
| -------------------- | ---------------- | ---------------------------------------------------------------------- |
| Loading              | On submit        | Button spinner, disabled.                                              |
| Empty                | n/a              | —                                                                      |
| Error — server error | 5xx on submit    | "Something went wrong. Please try again." Retry.                       |
| Success              | Report submitted | "Thanks — we're on it." Confirmation in the modal/sheet. Close button. |

### Permission Issues

Any user (anonymous or authenticated) can submit a correction report. Business owners cannot suppress or remove reports about their own listing — all reports go to the admin queue. Admins review corrections from `/admin/corrections` (V1 queue) or via direct DB access at MVP.

### Mobile Behavior

- The report link ("Is this info incorrect?") must be visible on mobile without requiring the user to scroll to the extreme bottom. Place it near the end of the listing content, above the breadcrumb.
- The bottom sheet on mobile: single column, checkboxes are at least 44px tall rows (checkbox + label). The submit button is full-width at the bottom.
- "Other" free-text field expands the sheet height slightly when it appears. The sheet is scrollable if needed.

### Accessibility Considerations

- Each checkbox must be a real `<input type="checkbox">` with an associated `<label>`.
- The "Other" text field must have a `<label>`: "Describe the issue".
- The modal/sheet must be `role="dialog"` with `aria-modal="true"` and a heading (`<h2>`): "Report a problem with this listing."
- When the confirmation message replaces the form, focus must move to the confirmation heading.

### Abuse / Spam Risks

| Risk                                                 | Mitigation                                                                                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Competitor mass-flagging a rival's listing as closed | IP hash rate limiting (3 reports per listing per IP per 24 hours). Admin reviews all "closed" flags before acting. No automated unpublishing based on reports alone. |
| Spam notes in the free text field                    | Free text is stripped of HTML and limited to 500 characters. Not rendered publicly.                                                                                  |

### Analytics Events to Track

| Event name                    | When fired           | Properties                                                          |
| ----------------------------- | -------------------- | ------------------------------------------------------------------- |
| `correction_report_opened`    | On report link tap   | `{ listing_id: string }`                                            |
| `correction_report_submitted` | On successful submit | `{ listing_id: string, issue_types: string[], has_notes: boolean }` |

---

## Flow 14: Admin Reviews a Submitted Entity

**Phase:** MVP
**User type:** Admin or Super Admin
**Starting point:** `/admin/listings` — listings table filtered to `status: pending`
**Goal:** Review a newly submitted business listing for quality and legitimacy, then approve (publish) or reject it.

**User journey:** An admin opens the listings management view, filters to pending submissions, selects a listing, reviews all submitted fields, and makes an approve/reject decision. At MVP, new listings created via `/add-business` are published immediately (auto-approve) to reduce friction, but flagged listings and any listing the system marks for review still come through this queue. The admin may also use this flow to review listings seeded from external data that need a quality pass before going live. Success is a listing approved and published, or rejected with a reason that is communicated to the submitter. The most likely failure is an admin approving a listing without sufficient information due to time pressure.

### Happy Path

**Step 1: Admin navigates to the listings queue**

- User action: Signs in at `/sign-in`. Role: admin. Redirected to `/admin/overview`. Clicks "Listings" in the admin sidebar nav.
- System response: `/admin/listings` loads. A filterable table renders with all listings. Admin applies the status filter: "Pending". The table updates to show only `status: pending` listings. Columns: listing name, category, city, submitted by (user display name), submitted date, actions (Review button).
- Next: Step 2

**Step 2: Admin selects a listing to review**

- User action: Clicks "Review" on a pending listing row. Or clicks anywhere on the row.
- System response: Navigates to `/admin/listings/[id]`. The full listing detail view renders: all fields (name, description, contact info, category, city, hours, social links, media, CTA), submission metadata (submitted by user, submitted at timestamp, source: 'web' | 'mobile'), and any media uploaded (logo, cover image displayed inline). Two action buttons are visible: "Approve" (green/Amber Gold) and "Reject" (outlined red).
- Next: Step 3

**Step 3: Admin reviews the listing**

- User action: Reads through all submitted fields. Checks for: completeness, legitimacy (is this a real business?), appropriateness (no spam, offensive content), category accuracy, duplicate risk.
- System response: A duplicate check indicator is shown: "Possible duplicates: none found" or "Possible duplicate: [Listing Name] in [City]" with a link to the potential duplicate.
- The admin can also make direct edits to any field before approving: the field edit is inline — clicking a field in the detail view makes it editable. Any edit is auto-saved.
- Next: Step 4

**Step 4: Admin approves or rejects**

**Approve path:**

- User action: Clicks "Approve".
- System response: A confirmation dialog: "Approve this listing? It will be published immediately and indexed by search engines." Confirm button: "Yes, publish it". Cancel button.
- User action: Clicks "Confirm".
- System response: Listing `status` is updated to `published`. `updated_by` is set to the admin's user_id. The listing page is triggered for ISR revalidation. An email is sent to the submitter (if a user account is associated): "[Business Name] is now live on The BLACQList!" with the live URL.
- Admin is returned to the `/admin/listings` queue, with a success toast: "[Business Name] published."

**Reject path:**

- User action: Clicks "Reject".
- System response: A rejection reason modal opens. A dropdown: "Select a reason" — options: "Incomplete information", "Not a real business", "Duplicate listing", "Inappropriate content", "Category mismatch", "Other". A text area: "Additional notes (shown to the submitter)". Confirm: "Reject and notify" button.
- User action: Selects reason, optionally adds notes, confirms.
- System response: Listing `status` updated to `rejected`. Email sent to submitter: "Your submission for [Business Name] was not approved. Reason: [reason]. [Notes if provided]. You can resubmit with the corrections at [link]."
- Admin returns to the queue. Toast: "[Business Name] rejected."
- Next: End state.

### Decision Points

- **Listing is a duplicate:** Admin sees the duplicate link in the detail view. They can reject with reason "Duplicate listing" and link the submitter to the existing listing. Or they can merge data from the submission into the existing listing and reject the submission (manual process at MVP — merge UI is V1).
- **Admin wants to edit before approving:** Inline field editing is available on the detail view. Admin can correct the category, description, or contact info before approving.
- **Listing has flagged content (e.g., a report was submitted):** A yellow banner at the top of the detail view: "This listing has been reported. Reason: [issue type]." Admin can review the report alongside the listing.

### Required Data

- From the system: admin session + role; listing record with all fields; submission metadata; media attachments; duplicate check result; any correction reports on this listing
- From the DB: `listings` + `business_pages` (read and write); `users` (submitter info); `media_attachments`; `corrections` (if any); email send via Resend

### Auth Requirements

Authentication required. Admin or Super Admin role required. All page loads and all mutation actions (approve, reject, edit) verify the session role server-side. A valid session without admin role results in a redirect to `/` with no explanation.

### States

| State type                          | Screen / moment          | What the user sees                                                                                                |
| ----------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Loading                             | Listings table load      | Skeleton rows in the table.                                                                                       |
| Empty — no pending listings         | Filter returns 0 results | "No pending listings. All caught up." No empty state illustration needed — this is a success state for the admin. |
| Error — listing detail fails        | 5xx on detail page load  | Error boundary: "Couldn't load this listing. Try refreshing."                                                     |
| Error — approve/reject action fails | 5xx on status update     | Toast: "Action failed. Try again." Listing status is not changed.                                                 |
| Success — approved                  | After approve confirm    | Toast: "[Business Name] published." Admin returned to the queue.                                                  |
| Success — rejected                  | After reject confirm     | Toast: "[Business Name] rejected." Admin returned to the queue.                                                   |

### Permission Issues

Admin and Super Admin only. Business Owners cannot view or interact with `/admin/listings`. The admin detail page does not expose other users' private data beyond what was submitted for the listing (no user email, phone, or payment data visible to admins from this view — only the submitter's display name).

### Mobile Behavior

The admin interface is primarily desktop-optimized. On mobile (375px), the listings table collapses to a card list view (each pending listing as a card with name, city, category, and "Review" button). The detail view is a single-column scrolling form. The approve/reject buttons are a sticky bottom bar on mobile. Mobile use of admin tools is not the primary use case but must not be broken at 375px.

### Accessibility Considerations

- The listings table must have proper `<th>` column headers with `scope="col"`.
- Approve and reject buttons must have distinct visual styling (not differentiated by color alone). Approve: checkmark icon + "Approve" label. Reject: X icon + "Reject" label.
- The rejection reason modal must be `role="dialog"` with focus management.
- Status filter chips must have `aria-pressed` state.

### Abuse / Spam Risks

| Risk                                    | Mitigation                                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin approving without adequate review | UX friction: confirmation dialog on approve. Inline duplicate check shown. At V1: admin action audit log records every approve/reject with timestamp and admin user_id. |

### Analytics Events to Track

| Event name               | When fired         | Properties                                                                 |
| ------------------------ | ------------------ | -------------------------------------------------------------------------- |
| `admin_listing_approved` | On approve confirm | `{ listing_id: string, admin_user_id: string, time_in_review_ms: number }` |
| `admin_listing_rejected` | On reject confirm  | `{ listing_id: string, admin_user_id: string, rejection_reason: string }`  |

---

## Flow 15: Admin Approves or Rejects a Claim

**Phase:** MVP
**User type:** Admin or Super Admin
**Starting point:** `/admin/claims` — claim review queue
**Goal:** Evaluate a pending claim request, verify the claimant's connection to the business, and approve (granting owner access) or reject (with reason).

**User journey:** An admin opens the claims queue, selects a pending claim, reviews the verification info the claimant submitted (email, phone, role at business, and any uploaded documents), cross-checks against the listing's known contact info, and makes an approve/reject decision. On approval: the user's role is updated to `business_owner` for that listing, the listing's `owner_id` is set, and the claimed badge is shown on the listing page. On rejection: the claimant receives an email with the reason. The most likely failure is approving a fraudulent claim where someone claims a business they don't own.

### Happy Path

**Step 1: Admin navigates to the claims queue**

- User action: In the admin sidebar, clicks "Claims".
- System response: `/admin/claims` loads. A table of all claims, filtered to `status: pending` by default. Columns: listing name, city, claimant display name, submitted date, verification email, status. Each row has a "Review" button.
- Next: Step 2

**Step 2: Admin selects a claim**

- User action: Clicks "Review" on a pending claim row.
- System response: `/admin/claims/[id]` loads. Two panels:
  - Left/top panel: The listing being claimed — listing name, city, category, current contact info (phone, email, website), current claimed status, listing thumbnail.
  - Right/bottom panel: The claim request — claimant's display name, account email, submitted verification email, submitted phone, stated role at business, uploaded document (if any — rendered as an inline image preview for images, or a download link for PDFs), optional notes from the claimant.
- A signal indicator: "Verification email matches listing contact email: Yes / No" (simple string match — not guaranteed accuracy).
- Two action buttons: "Approve claim" and "Reject claim".
- Next: Step 3

**Step 3: Admin evaluates the claim**

- User action: Reviews both panels. Opens the document if one was uploaded (full-screen document viewer or download link). Checks whether the submitted email matches the listing's email. Notes whether the listing's phone or email is a real business contact.
- System response: No automated approval — the admin makes a judgment call.
- Next: Step 4

**Step 4a: Admin approves the claim**

- User action: Clicks "Approve claim".
- System response: Confirmation dialog: "Approve this claim? [Claimant name] will become the owner of [Business Name]. This grants them full editing access to the BLACQList Page." Confirm button.
- User action: Confirms.
- System response:
  1. `claims` table: `status = 'approved'`, `reviewed_by = admin_user_id`, `reviewed_at = now()`
  2. `listings` table: `owner_id = claimant_user_id`, `claimed_status = 'claimed'`
  3. `user_roles` table: insert `(user_id: claimant_user_id, role: 'business_owner', listing_id: [id])`
  4. Email to claimant via Resend: "Your claim for [Business Name] has been approved! Your BLACQList Page is ready. Log in to start customizing it." Link to `/dashboard`.
  5. ISR revalidation triggered for the listing page (to update the claimed badge).
- Admin is returned to the claims queue. Toast: "Claim approved. [Claimant name] is now owner of [Business Name]."
- Next: End state.

**Step 4b: Admin rejects the claim**

- User action: Clicks "Reject claim".
- System response: Rejection modal opens. Reason dropdown — "Insufficient verification information", "Claimant does not appear to be associated with this business", "Document does not match the listing", "Duplicate claim from a different user", "Other". Text area for additional notes. Confirm: "Reject and notify".
- User action: Selects reason, optionally adds notes, confirms.
- System response:
  1. `claims` table: `status = 'rejected'`, `rejection_reason`, `rejection_notes`, `reviewed_by`, `reviewed_at`
  2. Email to claimant: "Your claim for [Business Name] was not approved. Reason: [reason]. [Notes]. If you believe this is a mistake, reply to this email."
- Admin returned to claims queue. Toast: "Claim rejected."
- Next: End state.

### Decision Points

- **Multiple pending claims for the same listing from different users:** Admin sees all pending claims for the listing. They must approve at most one and reject the others. The admin detail view for the listing shows: "Other pending claims for this listing: [n]" with links to each.
- **Claimant submitted a document:** Document is shown as an inline image (if JPG/PNG) or a download link (if PDF). The admin opens it in a new tab to inspect.
- **Claimant's verification email matches the listing's contact email exactly:** A green checkmark indicator. Provides confidence but is not definitive.
- **Admin wants to request more information from the claimant before deciding:** At MVP, the admin can send a manual email to the claimant (no in-app messaging system). A "Copy claimant email" button on the claim detail page copies the claimant's account email to clipboard. In-app messaging is V1.

### Required Data

- From the system: admin session; full claim record; linked listing record; linked user record (claimant); any uploaded document storage path
- From the DB: `claims`, `listings`, `users`, `user_roles` (read and write); document from Supabase Storage (admin-accessible private bucket)

### Auth Requirements

Admin or Super Admin role required. All actions (approve, reject) validated server-side.

### States

| State type                          | Screen / moment                         | What the user sees                                                          |
| ----------------------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| Loading                             | Claim detail page load                  | Skeleton for both panels.                                                   |
| Empty — no pending claims           | Queue is empty                          | "No pending claims. All caught up."                                         |
| Error — document fails to load      | Private document URL cannot be resolved | "Document couldn't be loaded. Download it instead." Download link fallback. |
| Error — approve/reject action fails | 5xx on status update                    | "Action failed. The claim status was not changed. Try again."               |
| Success — approved                  | After confirm                           | Toast + return to queue. Email sent to claimant.                            |
| Success — rejected                  | After confirm                           | Toast + return to queue. Email sent to claimant.                            |

### Permission Issues

Admin and Super Admin only. Business Owners cannot access `/admin/claims`. The claimant's personal data (account email, submitted phone) is visible to admins for verification purposes only. This data is not displayed to any other user type.

### Mobile Behavior

The two-panel layout on desktop becomes a tabbed view on mobile: "Listing info" tab and "Claim details" tab. The approve/reject buttons are a sticky bottom bar visible on both tabs.

### Accessibility Considerations

- The two panels (listing info + claim details) must be clearly labeled with headings: `<h2>Listing: [Business Name]</h2>` and `<h2>Claim submitted by [Claimant name]</h2>`.
- The "email match" indicator must not rely on color alone — include a text label: "Verification email matches listing email: Yes" or "No match".
- Rejection reason dropdown: standard `<select>` element with a `<label>`.

### Abuse / Spam Risks

| Risk                                                   | Mitigation                                                                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Fraudulent claims with fake documents                  | Admin judgment is the primary defense at MVP. Document upload is encouraged but not required. In V1: automated document verification services. |
| Admin account compromise granting fraudulent ownership | Admin accounts require strong passwords. Super Admin reviews Admin actions in the audit log.                                                   |

### Analytics Events to Track

| Event name             | When fired         | Properties                                                                                  |
| ---------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| `admin_claim_approved` | On approve confirm | `{ claim_id: string, listing_id: string, admin_user_id: string }`                           |
| `admin_claim_rejected` | On reject confirm  | `{ claim_id: string, listing_id: string, admin_user_id: string, rejection_reason: string }` |

---

## Flow 16: Admin Updates Verification Status

**Phase:** Beta
**User type:** Admin or Super Admin
**Starting point:** `/admin/verification` — verification document review queue
**Goal:** Review verification documents submitted by a claimed business owner and grant (or deny) the Verified badge for their listing.

**User journey:** A business owner who has submitted verification documents (a step beyond claiming — this confirms they are a real, operating Black-owned business) has their submission reviewed by an admin. The admin inspects the documents, cross-checks the listing data, and either grants Verified status (which causes the "Verified" badge to appear on the listing page) or declines with a reason. This is distinct from claim approval (Flow 15) — claiming means "I own this business". Verification means "We've confirmed this is a real, operating Black-owned business."

### Happy Path

**Step 1: Admin navigates to the verification queue**

- User action: In the admin sidebar, clicks "Verification".
- System response: `/admin/verification` loads. Table of all verification submissions filtered to `status: pending`. Columns: listing name, city, owner display name, submission date, documents uploaded (count), verification type. Each row has a "Review" button.
- Next: Step 2

**Step 2: Admin selects a verification submission**

- User action: Clicks "Review" on a pending row.
- System response: `/admin/verification/[id]` loads. Panels:
  - Listing panel: listing name, category, city, current badge status, owner name, owner account email.
  - Verification submission panel: documents uploaded (inline preview for images, download link for PDFs), owner's stated verification type (business license, utility bill, social media verification, etc.), optional owner note.
  - Signal checks: "Listing is claimed: Yes/No", "Owner has an active account: Yes".
- Action buttons: "Grant Verified badge" and "Decline verification".
- Next: Step 3

**Step 3: Admin reviews documents**

- User action: Opens each document. Confirms it references the same business and address as the listing.
- Next: Step 4

**Step 4a: Admin grants Verified status**

- User action: Clicks "Grant Verified badge".
- System response: Confirmation dialog: "Grant the Verified badge to [Business Name]? This indicates the business has been verified as a real, operating Black-owned business." Confirm button.
- User action: Confirms.
- System response:
  1. `listings` table: `verified_status = 'verified'`, `verified_at = now()`, `verified_by = admin_user_id`
  2. Email to owner: "[Business Name] is now Verified on The BLACQList! Your Verified badge is live on your page." Link to the live page.
  3. ISR revalidation triggered for the listing page.
- Toast: "[Business Name] is now Verified."

**Step 4b: Admin declines verification**

- User action: Clicks "Decline verification".
- System response: Decline modal: reason dropdown + optional notes. "Decline and notify" confirm.
- System response: `verification_submissions` record status updated to `declined`. Email to owner: "We couldn't verify [Business Name] at this time. Reason: [reason]. [Notes]. You may resubmit with additional documentation." Resubmit link in email.
- Toast: "Verification declined for [Business Name]."
- Next: End state.

### Decision Points

- **Owner submits a second verification attempt after a decline:** The admin sees both submissions in the verification queue, linked to the same listing. The previous declined submission is visible with its reason. Admin reviews the new documents independently.
- **Verification document is expired (e.g., expired business license):** Admin declines with reason: "Document appears to be expired. Please provide a current document."

### Required Data

- From the system: admin session; verification submission record; linked listing; linked owner user; documents from private Supabase Storage
- From the DB: `verification_submissions`, `listings`, `users` (read and write)

### Auth Requirements

Admin or Super Admin only.

### States

| State type                       | Screen / moment       | What the user sees                                                                 |
| -------------------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| Loading                          | Detail page load      | Skeleton panels.                                                                   |
| Empty — no pending verifications | Queue is empty        | "No pending verifications."                                                        |
| Error — document load fails      | Storage URL fails     | "Document couldn't be loaded. Download it instead."                                |
| Success — verified               | After grant confirm   | Toast + return to queue. Email sent to owner. Verified badge live on listing page. |
| Success — declined               | After decline confirm | Toast + return to queue. Email sent to owner.                                      |

### Permission Issues

Admin and Super Admin only. Business owners cannot see the verification queue. The Verified badge on the listing page is controlled solely by the `verified_status` field on the listing record — owners cannot set it directly.

### Mobile Behavior

Same pattern as Flow 15 — two panels become tabs on mobile. Sticky bottom bar for action buttons.

### Accessibility Considerations

Same requirements as Flow 15. Document previews must have descriptive alt text or a text description: "Uploaded document: business_license.jpg".

### Abuse / Spam Risks

| Risk                               | Mitigation                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| Doctored or edited document images | Admin judgment. At V1: third-party document verification API integration is on the roadmap. |

### Analytics Events to Track

| Event name                    | When fired         | Properties                                                      |
| ----------------------------- | ------------------ | --------------------------------------------------------------- |
| `admin_verification_granted`  | On grant confirm   | `{ listing_id: string, admin_user_id: string }`                 |
| `admin_verification_declined` | On decline confirm | `{ listing_id: string, admin_user_id: string, reason: string }` |

---

## Flow 17: User Uploads a Receipt for Community Spend Beta

**Phase:** MVP (beta — intake only, no visualization)
**User type:** Supporter (logged in)
**Starting point:** `/account/receipts`
**Goal:** Upload a photo of a receipt from a Black-owned business purchase to contribute to the community spend tracking initiative.

**User journey:** A logged-in supporter navigates to the receipts section of their account. They upload a receipt photo — either from their camera roll or by taking a new photo. The platform uses OCR to suggest the business name, amount, and date (at MVP, OCR is a stub — the user enters these manually). The user confirms or edits the values and submits. Their spend record is stored. Success is a confirmed `spend_event` record and a visible entry in their receipts list. The most likely failure is a user not knowing what to do with the OCR suggestion or submitting inaccurate data inadvertently.

### Happy Path

**Step 1: User navigates to `/account/receipts`**

- User action: Navigates to their account. Clicks "Receipts" in the account nav.
- System response: The receipts page loads. If no receipts have been uploaded: empty state (see States below). If receipts exist: a list of previous uploads with date, amount, business name, and status badge (Pending Review / Reviewed).
- Primary action: An "Upload a receipt" button. On desktop: positioned as a full-width button above the list. On mobile: a FAB (floating action button) in the Amber Gold brand color, bottom-right of the screen.
- Next: Step 2

**Step 2: User taps "Upload a receipt"**

- User action: Taps the button or FAB.
- System response: An upload panel opens (bottom sheet on mobile, modal on desktop). Two options: "Take a photo" (triggers `capture="environment"` on mobile, opening the device rear camera) and "Choose from library" (triggers the OS file picker). On desktop: only "Choose from library" (no camera capture prompt since desktop webcams are not useful for receipts).
- Next: Step 3

**Step 3: User selects or captures a receipt photo**

- User action: Takes a photo of the receipt or selects one from their camera roll. File types accepted: JPG, PNG, WebP, HEIC. Max 10MB.
- System response: The image is uploaded to Supabase Storage via `/api/receipts`. A progress indicator shows "Uploading…" with a progress bar. After upload: the receipt image is displayed as a thumbnail in the panel.
- At MVP: OCR is a stub — no automated extraction. The user sees a note: "We'll extract the details automatically in a future update. For now, please enter them below."
- Next: Step 4

**Step 4: User enters receipt details**

- User action: The panel below the receipt thumbnail shows a manual entry form:
  - Business name (required, `type="text"`) — with a note: "Start typing to search for a BLACQList business" (type-ahead search against published listings — if the business is found, auto-fills the `listing_id`; if not found, stores the raw name as text)
  - Amount spent ($) (required, `inputMode="decimal"`, `type="number"`)
  - Date of purchase (required, `type="date"`, defaults to today)
  - Category (optional, pre-filled if the business matched a listing with a known category)
- User action: Fills in the form.
- Next: Step 5

**Step 5: User submits**

- User action: Taps "Submit".
- System response: A `spend_event` record is created with: `user_id`, `listing_id` (if matched) or `raw_business_name`, `amount`, `purchase_date`, `image_path`, `status: pending_review`, `source: 'receipt_upload'`, `submitted_by`, `created_at`. The receipt image path in Supabase Storage is stored (not the URL — the URL is generated at read time).
- The panel transitions to a confirmation: "Receipt saved." Below: the receipt thumbnail, the entered amount, business name, and date. A "View all receipts" link.
- The receipts list updates to show the new entry with a "Pending review" badge.
- Next: End state.

### Decision Points

- **User uploads a file that is not an image:** File picker is filtered to image types. If a non-image file gets through: server-side type check rejects it. Error: "Only image files are accepted (JPG, PNG, WebP)."
- **User uploads an image that is too large (> 10MB):** Server-side size check. Error: "This file is too large. Maximum size is 10MB. Try compressing the image or taking a new photo."
- **Business name does not match any listing:** The `listing_id` is left null. The `raw_business_name` is stored as text. This is valid — spend at a Black-owned business that is not yet in the directory is still community spend data.
- **User tries to upload a second receipt for the same business and date:** No duplicate block — multiple receipts from the same business on the same day are allowed (different transactions).

### Required Data

- From the user: receipt image, business name, amount, date
- From the system: user session; listing search for business name type-ahead; image upload to Supabase Storage
- From the DB: `spend_events` table (insert); `listings` (read for business name search); `media_attachments` for receipt storage path

### Auth Requirements

Authentication required. `/account/receipts` is behind session middleware. The receipt upload API (`POST /api/receipts`) validates the session server-side.

### States

| State type              | Screen / moment      | What the user sees                                                                                                                                     |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Loading — image upload  | During file upload   | Progress bar in the upload panel. "Uploading…" label.                                                                                                  |
| Loading — form submit   | On submit            | Button spinner, disabled.                                                                                                                              |
| Empty — no receipts yet | No receipts uploaded | "No receipts uploaded yet." Description: "Upload receipts from Black-owned businesses to contribute to our community spend data." Upload button below. |
| Error — file too large  | On upload            | "This file is too large. Maximum 10MB."                                                                                                                |
| Error — wrong file type | On upload            | "Only image files are accepted."                                                                                                                       |
| Error — server error    | On submit            | "Couldn't save your receipt. Try again." Form preserved.                                                                                               |
| Success                 | Receipt submitted    | "Receipt saved." Confirmation in panel with thumbnail, amount, business, date.                                                                         |

### Permission Issues

Only the authenticated user can see their own receipts. The `/account/receipts` page is scoped to `user_id = auth.uid()`. Admins review receipts from `/admin/receipts` (Flow 18) — they see all receipts across all users but not the user's full account.

### Mobile Behavior

- The FAB is the primary action trigger on mobile: bottom-right, 56×56px, Amber Gold, camera/plus icon.
- The upload bottom sheet is full-screen on mobile: "Take a photo" button (large, full-width, camera icon) and "Choose from library" button (large, full-width) are the two visible options. Both are at least 64px tall.
- The camera capture opens the rear camera directly (`capture="environment"`). The user takes the photo and it populates the upload panel.
- The manual entry form below the receipt thumbnail uses appropriate keyboards: amount field is `inputMode="decimal"` for a numeric keyboard with decimal point. Date field is `type="date"` which triggers the OS date picker.
- The receipts list on mobile: each receipt is a card with: a small thumbnail (60×60px), business name, date, amount, and status badge.

### Accessibility Considerations

- The FAB must have `aria-label="Upload a receipt"`.
- The "Take a photo" and "Choose from library" options in the bottom sheet must be `<button>` elements with descriptive labels.
- The receipt upload input (`<input type="file">`) must have an explicit `<label>`.
- Amount input must have `aria-label="Amount spent in dollars"` (not just a placeholder).
- The success confirmation must be announced via `aria-live="polite"`.

### Abuse / Spam Risks

| Risk                                                    | Mitigation                                                                                                                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fake receipt uploads to inflate community spend figures | All receipts enter `status: pending_review`. Admin spot-checks. Amounts are not aggregated into public stats until `status: reviewed`. Rate limit: 20 receipt uploads per user per day. |
| Uploading receipts for non-Black-owned businesses       | No automated verification at MVP. Admin spot-checks a percentage of submissions. The data is private to the user at MVP — no public aggregation yet.                                    |

### Analytics Events to Track

| Event name               | When fired           | Properties                                               |
| ------------------------ | -------------------- | -------------------------------------------------------- |
| `receipt_upload_started` | On upload panel open | `{ source: 'fab' \| 'button' }`                          |
| `receipt_submitted`      | On successful submit | `{ has_listing_match: boolean, amount_entered: number }` |

---

## Flow 18: Admin Reviews a Receipt Submission

**Phase:** MVP (beta)
**User type:** Admin or Super Admin
**Starting point:** `/admin/receipts`
**Goal:** Spot-check incoming receipt submissions for accuracy and mark them as reviewed or flag them for correction.

**User journey:** An admin opens the receipts review queue, which shows all `spend_event` records with `status: pending_review`. They view the receipt image, the user-entered data (business name, amount, date), and any OCR suggestions (stub at MVP). They confirm the data looks accurate and mark it reviewed, or flag it if the data appears inaccurate (e.g., the amount doesn't match the visible total on the receipt). This is a lightweight quality gate — admins are not expected to review every submission, only a spot-check percentage.

### Happy Path

**Step 1: Admin navigates to `/admin/receipts`**

- User action: Clicks "Receipts" in the admin sidebar.
- System response: A table of `spend_events` with `status: pending_review`. Columns: user display name, business name (entered), amount, purchase date, upload date, receipt thumbnail (small). Each row has "Review" and "Flag" actions.
- Next: Step 2

**Step 2: Admin reviews a receipt row**

- User action: Clicks "Review" on a row.
- System response: A side panel or modal opens (no full-page navigation needed for this lightweight task). Shows:
  - Receipt image (full size, with zoom support).
  - User-entered data: business name, amount, date.
  - Matched listing (if the business name search matched a listing): listing name with a link to the listing page.
  - Note: "Admin actions here do not change the user's data — only the review status."
- Two action buttons: "Mark reviewed" and "Flag for correction".
- Next: Step 3

**Step 3: Admin marks the receipt reviewed**

- User action: Receipt data looks accurate. Clicks "Mark reviewed".
- System response: `spend_event.status` updated to `reviewed`. Row disappears from the pending queue. Toast: "Receipt marked as reviewed."
- Next: End state (admin moves to next item in queue).

**Step 3b: Admin flags a receipt for correction**

- User action: Receipt data looks inaccurate (e.g., amount entered as $200 but receipt shows $20.00). Clicks "Flag for correction".
- System response: A small note field: "Describe the issue (optional)". Confirm: "Flag".
- System response: `spend_event.status` updated to `flagged`. The user can see the flagged status on their receipts list (their entry shows "Flagged" badge with no explanation — at MVP, no in-app messaging to the user about flags; this is a data quality mechanism, not a user notification).
- Toast: "Receipt flagged."
- Next: End state.

### Decision Points

- **Admin cannot read the receipt image:** If the image is too small, blurry, or otherwise unreadable, the admin flags it with a note: "Image not readable." The `spend_event` remains in a flagged state.
- **Admin wants to update the user-entered data:** Admin does NOT edit the user's data. The admin's role is to review and flag — not to correct user submissions. Corrections (in a future version) would be communicated back to the user via a notification.

### Required Data

- From the system: admin session; all `spend_events` with `status: pending_review`; receipt image from Supabase Storage (private bucket — admin-accessible)
- From the DB: `spend_events` (read and write); `listings` (for matched listing link); `users` (display name only)

### Auth Requirements

Admin or Super Admin only.

### States

| State type                  | Screen / moment     | What the user sees                                            |
| --------------------------- | ------------------- | ------------------------------------------------------------- |
| Loading                     | Table load          | Skeleton rows.                                                |
| Empty — no pending receipts | Queue is empty      | "No receipts pending review. All caught up."                  |
| Error — image load fails    | Storage URL error   | "Receipt image couldn't be loaded."                           |
| Success — reviewed          | After mark reviewed | Toast. Row removed from queue.                                |
| Success — flagged           | After flag          | Toast. Row removed from pending queue (goes to flagged view). |

### Permission Issues

Admin and Super Admin only. The user's account information beyond display name is not visible to admins in this view. The admin cannot see the user's full account or other spend events from this queue.

### Mobile Behavior

The receipt review queue is designed for desktop use. On mobile, the table collapses to a card list. The receipt image panel opens as a full-screen overlay on mobile.

### Accessibility Considerations

- Receipt image must be accessible with a zoom function (CSS transform or a `<details>` expansion pattern).
- "Mark reviewed" and "Flag for correction" buttons must be keyboard-accessible and have distinct labels.

### Abuse / Spam Risks

No significant abuse risks for this admin-only flow. The admin is a trusted internal actor.

### Analytics Events to Track

| Event name               | When fired       | Properties                                          |
| ------------------------ | ---------------- | --------------------------------------------------- |
| `admin_receipt_reviewed` | On mark reviewed | `{ spend_event_id: string, admin_user_id: string }` |
| `admin_receipt_flagged`  | On flag          | `{ spend_event_id: string, admin_user_id: string }` |

---

## Flow 19: User Views Saved Listings

**Phase:** MVP
**User type:** Supporter or Business Owner (logged in)
**Starting point:** `/account/saved` — arrived via account nav, the post-save toast link, or the account dashboard redirect
**Goal:** Review the listings the user has saved, visit any of them, or remove listings they no longer want to track.

**User journey:** A logged-in supporter navigates to their saved list to find a business they bookmarked earlier. They scan the list, find the business they want, and click through to the listing page. Or they declutter their list by removing entries they no longer need. Success is navigating from the saved list to a BLACQList Page, or successfully removing a saved listing. The most likely failure is an empty state for a new user who signed up to save a listing but has not yet saved anything — they need an invitation to go discover.

### Happy Path

**Step 1: User navigates to `/account/saved`**

- User action: Clicks "Saved" in the account navigation.
- System response: The saved listings page loads. A list renders of all listings the user has saved. Each row/card shows: business primary image (thumbnail, 60×60px), business name, category, city, claimed/verified status badge, and a "Remove" button (trash or filled-heart toggle icon).
- On desktop: a list layout (each row is the full width of the content area). On mobile: a card stack (each saved listing is a card).
- Next: Step 2

**Step 2: User scans the list and clicks a saved listing**

- User action: Taps on a listing card/row.
- System response: Navigates to the BLACQList Page for that listing (`/[city-slug]/business/[listing-slug]`). The flow continues as Flow 4.
- Next: End state (user is on the BLACQList Page).

**Step 3: User removes a saved listing**

- User action: Taps the "Remove" button (or filled heart icon — toggling the save off) on a listing in the list.
- System response: An optimistic UI update removes the listing from the visible list immediately. A `DELETE /api/saves` request fires in the background with the `listing_id`. A brief toast at the bottom of the screen: "[Business Name] removed from your list." The toast has an "Undo" action for 5 seconds. If the user taps "Undo": a `POST /api/saves` fires to re-save the listing, and it reappears in the list.
- Decision: If the DELETE API call fails (network error): the listing is re-added to the list (UI rolls back). A toast: "Couldn't remove [Business Name]. Try again."
- Next: End state (listing removed from saved list).

### Decision Points

- **User's saved list is empty:** Empty state renders (see States below). The list page does not show an error — it shows an invitation to discover.
- **A saved listing has been unpublished or deleted since it was saved:** The listing record still exists in the `saves` table but the listing `status` is no longer `published`. On the saved list, the entry renders with a "Listing no longer available" indicator in place of the thumbnail and name. A "Remove" button is shown so the user can clean up the entry. No error state.
- **A saved listing's cover image has changed:** The thumbnail on the saved list shows the current cover image (fetched fresh from the listing record, not cached from the time of saving).

### Required Data

- From the system: user session; all `saves` records for `user_id = auth.uid()`; listing records (name, category, city, primary image path, claimed status, slug, city_slug) for each saved listing_id
- From the DB: `saves` JOIN `listings` WHERE `saves.user_id = auth.uid()` AND `listings.status = 'published'` (plus a union for any saved listings that are no longer published, to show the "no longer available" state)

### Auth Requirements

Authentication required. Middleware protects `/account/saved`. If not authenticated, redirect to `/sign-in?next=/account/saved`.

### States

| State type                          | Screen / moment                                      | What the user sees                                                                                                                                                                   |
| ----------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Loading                             | Page initial load                                    | Skeleton: 3–5 placeholder card rows.                                                                                                                                                 |
| Empty — no saved listings           | User has never saved a listing, or removed all saves | Centered message: "You haven't saved anything yet." Sub-text: "Find Black-owned businesses, restaurants, services, and more." Primary button: "Discover businesses" (→ `/discover`). |
| Empty — after removing last listing | User removes their final saved listing               | Same empty state as above, appearing after the last card disappears from the list.                                                                                                   |
| Error — listing no longer available | A saved listing is unpublished                       | Entry renders with a gray placeholder thumbnail, "Listing no longer available" text, and a Remove button. Does not prevent the rest of the list from rendering.                      |
| Error — saves list fetch fails      | API error loading saves                              | Error message: "Couldn't load your saved listings. Try refreshing." Retry button.                                                                                                    |
| Success — listing removed           | After DELETE                                         | Optimistic UI removes the card. Toast with Undo option.                                                                                                                              |

### Permission Issues

Users can only see and manage their own saved listings. The saves API is scoped to `auth.uid()` server-side. No user can remove another user's saves.

### Mobile Behavior

- On mobile, each saved listing is a card (full-width). Left side: 60×60px thumbnail. Right side: business name, category, city, status badge. Bottom-right of card: remove button (heart-filled icon or X icon, at least 44×44px touch target).
- The "Undo" toast appears at the bottom of the screen above the safe area inset. The "Undo" button in the toast is at least 44px wide.
- The page does not have pagination at MVP (the saved list is expected to be small: < 100 entries for most users). If the list exceeds 50 items, infinite scroll or simple pagination is added at V1.

### Accessibility Considerations

- Each listing card must be a focusable `<a>` element for the navigate-to-listing action. The Remove button must be a separate `<button>` outside the `<a>` tag's click area.
- Remove button must have `aria-label="Remove [Business Name] from saved list"` — not just a generic trash icon.
- When a listing is removed from the list, the focus should move to the next item in the list (or to the empty state heading if the list is now empty).
- The "Undo" toast button must be reachable via keyboard and announced via `aria-live="polite"`.

### Abuse / Spam Risks

| Risk                                                        | Mitigation                                                                                                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Bulk-saving thousands of listings to stress the saves table | Rate limit: 200 save operations per user per day. Enforced server-side. The `/api/saves` endpoint validates the session and enforces the limit. |

### Analytics Events to Track

| Event name                  | When fired            | Properties                                 |
| --------------------------- | --------------------- | ------------------------------------------ |
| `saved_list_viewed`         | On page load          | `{ saved_count: number }`                  |
| `saved_listing_clicked`     | On listing card click | `{ listing_id: string, position: number }` |
| `saved_listing_removed`     | On remove action      | `{ listing_id: string }`                   |
| `saved_listing_undo_remove` | On undo tap           | `{ listing_id: string }`                   |

---

## Flow 20: User Browses Collections and Guides

**Phase:** MVP (collections); V1 (guides)
**User type:** Anonymous Visitor or Supporter
**Starting point:** Homepage editorial teaser, `/collections`, or direct link to `/collection/[slug]`
**Goal:** Discover a curated list of Black-owned businesses around a specific theme or editorial angle, and click through to individual BLACQList Pages.

**User journey:** A visitor sees a collection feature on the homepage or on social media: "10 Black-owned bookstores worth visiting." They click through to the collection page, read the editorial intro, scan the listing grid, and tap one or two businesses that interest them. Success is clicking through to at least one BLACQList Page from within the collection context. The most likely failure is a collection page with too few listings or an intro that doesn't create any editorial context — making the collection feel like just another search results page.

### Happy Path

**Step 1: User sees a collection link and clicks it**

- User action: On the homepage, the user sees an editorial teaser section (at MVP, this may be a single "Featured Collection" card with a title, cover image, and listing count). They click it.
- Alternative entry: User arrives at `/collection/[slug]` directly from a shared link on social media. The collection URL was shared with a full OG preview: collection title, cover image, editorial description.
- System response: Browser navigates to `/collection/[slug]`. The collection page begins loading (ISR-generated).
- Next: Step 2

**Step 2: Collection page renders**

- User action: User begins reading and scanning.
- System response: Collection page renders with:
  1. **Collection header:** Full-width cover image, collection title (H1) (e.g., "10 Black-owned bookstores worth visiting"), short editorial intro paragraph (50–200 words written by the admin/editor).
  2. **Listing count and city info:** "12 businesses across Atlanta, Chicago, and Houston."
  3. **Listing grid:** Each collection member renders as a listing card: cover image, business name, category, city, claimed/verified badge, Save button (auth-gate if anonymous). Cards are in the admin-curated order (not sorted by relevance or distance).
  4. **Share this collection:** A small share link below the header. Clicking it runs Flow 6 with the collection URL as the share target.
- Next: Step 3

**Step 3: User scans the listing grid**

- User action: Scrolls through the listing cards. The collection at MVP has 6–20 listings. No pagination needed at MVP.
- System response: The grid is static (no filtering or sorting on collection pages at MVP). On desktop: 3-column grid. On mobile: single-column stack.
- Next: Step 4

**Step 4: User clicks a listing card**

- User action: Taps a listing card.
- System response: Browser navigates to `/[city-slug]/business/[listing-slug]` — the full BLACQList Page for that listing. The page loads as in Flow 4.
- From the BLACQList Page, the user can navigate back to the collection using the browser back button. The collection page is in the navigation history. There is no in-page "Back to collection" breadcrumb on the listing page at MVP (this is a V1 refinement — a "Featured in [Collection Name]" attribution on the listing page).
- Next: End state — user is on a BLACQList Page.

### Decision Points

- **Collection has been archived or unpublished by admin:** The route returns `not-found.tsx`. "This collection is no longer available." Link to `/collections` (index page) and `/discover`.
- **A listing within a collection has been unpublished:** The listing card renders with a "No longer available" indicator (placeholder thumbnail, no clickable link). The card is not removed from the collection grid — the collection preserves its original curation. An admin should periodically audit collections for unpublished members.
- **User wants to Save a listing from the collection:** Same as saving from search results — if unauthenticated, the auth-gate modal appears (Flow 5). The `next` URL is the collection page URL so the user returns to the collection after auth, not to the listing page.
- **Collection page has fewer than 6 listings:** The collection renders normally with whatever listings are present. No minimum listing count is enforced at display time (that is an editorial quality standard, not a rendering requirement).

### Required Data

- From the system: collection slug from URL; collection record (title, description, cover image path, slug, listing_id list with ordering); linked listing records (name, category, city, primary image path, claimed status, slug, city_slug)
- From the DB: `collections` JOIN `collection_members` JOIN `listings` WHERE `collections.slug = [slug]` AND `collections.status = 'published'` AND `listings.status = 'published'`
- OG tags for the collection URL: `og:title` = collection title, `og:description` = editorial intro (first 155 chars), `og:image` = collection cover image

### Auth Requirements

No authentication required to view a collection or click listings within it. The Save button on listing cards triggers the auth-gate for anonymous users.

### States

| State type                                   | Screen / moment                             | What the user sees                                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading                                      | Collection page initial load                | Skeleton: gray rectangle for the header/cover image, gray text bars for the title and intro, 3–4 placeholder listing card outlines in the grid. ISR means this is typically < 1 second from CDN.    |
| Empty — collection has no published listings | All members have been unpublished           | "This collection doesn't have any listings right now." Link to `/collections` for other collections. (This state should not occur if admins maintain collections; it is a fallback for edge cases.) |
| Error — collection not found                 | Slug doesn't match any published collection | `not-found.tsx`: "This collection is no longer available." Link to `/collections`.                                                                                                                  |
| Error — page load failure                    | ISR fetch or server error                   | `error.tsx`: "Something went wrong loading this page." Retry button.                                                                                                                                |
| Success                                      | Page loads with listings                    | Header, intro, and listing grid all render. Cards are interactive.                                                                                                                                  |

### Permission Issues

No permission required. Collections are public. Admins create and manage collections from `/admin/collections` (MVP). There is no user-facing "create a collection" functionality — collections are editorial, admin-only at MVP.

### Mobile Behavior

- Collection header cover image: full-width, 50vw height on mobile (approximately 188px on a 375px screen).
- Collection title (H1): large, high-contrast text overlaid on the cover image bottom or rendered below the cover image with good typographic hierarchy.
- Listing grid: single-column on mobile. Each card is a full-width row with a 80×80px thumbnail, name, category, city, and Save button.
- The editorial intro text is readable at base font size (16px). No truncation or "Read more" collapse — the intro is short enough to display in full on mobile.
- Share link below the header: a small "Share this collection" text link with a share icon. On mobile, tapping triggers the OS native share sheet with the collection URL.

### Accessibility Considerations

- Collection title must be an `<h1>`. Listing names within the grid must be `<h3>` (or appropriate heading level within the card component — one level below the section heading).
- The cover image must have a descriptive `alt` attribute: "[Collection title] — curated collection cover image." Or `alt=""` if it is purely decorative and the title is conveyed by the `<h1>` text.
- Listing cards must be fully keyboard-navigable: each card is a single `<a>` element. The Save button within the card must be separately focusable (not nested inside the card's `<a>` tag).
- The "No longer available" card variant must be announced to screen readers as "Listing no longer available" — not visually indistinguishable from an available listing.

### Abuse / Spam Risks

| Risk                                                                              | Mitigation                                                                                                                                                     |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scraping all collection member URLs to harvest listing data                       | Collection pages are server-rendered and rate-limited like all public pages. No unique data is exposed that cannot be found via search or direct listing URLs. |
| Fake community-created collections (if user-created collections are added in V1+) | At MVP and V1, collections are admin-only. No user-created collections. This risk is evaluated when user-generated collections are scoped.                     |

### Analytics Events to Track

| Event name                 | When fired              | Properties                                                                                                                    |
| -------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `collection_page_view`     | On collection page load | `{ collection_slug: string, listing_count: number, source: 'homepage' \| 'collections_index' \| 'direct' \| 'social_share' }` |
| `collection_listing_click` | On listing card click   | `{ collection_slug: string, listing_id: string, position: number }`                                                           |
| `collection_shared`        | On share action         | `{ collection_slug: string, share_method: 'native_share' \| 'copy_link' }`                                                    |
