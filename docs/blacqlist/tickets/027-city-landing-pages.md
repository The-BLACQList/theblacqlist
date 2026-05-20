# Ticket 027: City Landing Pages (/[city-slug])

**Ticket ID:** BLACQ-027
**Title:** City landing pages (/[city-slug])
**Type:** Feature
**Priority:** P1 — High
**Estimate:** M (2–4h)
**Status:** Backlog
**Phase:** Phase 4: Search, Filters, City/Category Pages
**Feature Area:** Public Discovery / SEO

---

## Context

City landing pages are both discovery surfaces and SEO assets. Each page is built to capture "Black-owned businesses in [City]" search intent from Google, while providing in-platform visitors a locally-scoped entry point to browse featured listings and explore by category. At launch, Atlanta, Houston, and Chicago are the primary cities — each needs a well-formed, fast-loading city page. These pages are statically generated with ISR for performance.

Source artifacts:
- `docs/blacqlist/ux/mvp-screen-map.md` — City Landing page detailed spec
- `docs/blacqlist/ux/empty-loading-error-success-states.md` — Section 4 (city page states)
- `docs/blacqlist/architecture/api-contract.md` — Endpoint 3: Get City Page Data

This ticket depends on Ticket 025 (search API) and Ticket 015 (ListingCard component). Ticket 028 (City + Category pages) depends on this ticket.

---

## User Story

> As someone searching for Black-owned businesses in my city, I want to land on a page dedicated to my city that shows featured businesses, the most active categories, and easy navigation to browse deeper, so that I can discover local Black-owned businesses without having to construct a search.

---

## Scope

**In scope:**
- `app/[city-slug]/page.tsx` — Server Component, ISR `revalidate: 86400` (24 hours)
- `generateStaticParams()` — generates routes for all active cities from the `cities` table at build time. At launch: Atlanta, Houston, Chicago. `dynamicParams = true` for cities added after build.
- Data fetch: `GET /api/cities/[slug]` (Endpoint 3) — returns `city`, `categories` (with `listing_count`), `featured_listings` (up to 6), `total_listings`
- City hero section: city name in Glacial Indifference Bold (h1), subheadline "[N]+ Black-owned businesses" (count from `total_listings`), category shortcut pill row (top 5–6 categories by `listing_count`, each links to `/[city-slug]/[category-slug]`)
- Featured listings grid: 6–12 `ListingCard` components (from `featured_listings`), or 8 admin-curated / highest-engagement listings; responsive 3-col desktop / 2-col tablet / 1-col mobile grid
- Category shortcuts section: 6 category cards with category name, icon, listing count badge, links to `/[city-slug]/[category-slug]`
- City stats line: "Across [N] categories — from [Category A] to [Category B]" + "View all in [City] →" link to `/search?city=[city-slug]`
- SEO: `generateMetadata()` — title "Black-Owned Businesses in [City] | The BLACQList", description template, canonical URL `/[city-slug]`
- `notFound()` when city slug returns 404 from the API (invalid or inactive city)
- Low-listing state: when `total_listings < 10`, replace the featured listings grid with: "We're building out [City]. Be the first to claim your page here." + "Claim Your Page" Amber Gold link → `/add-business?city=[slug]`
- ISR cache tag: `city-[slug]` for targeted invalidation when listing status changes in the city
- Loading state: Suspense boundaries on the featured listings section (skeleton grid of 6 cards)

**Out of scope:**
- City + Category page (Ticket 028)
- City edit/admin (admin panel ticket)
- User-generated city collections (V1)
- Events or jobs browse by city (Beta)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| BLACQ-025: Search API (for "View all" link destination) | Soft dependency | Not started — the page links to `/search?city=...` not the search API directly |
| BLACQ-015: `ListingCard` component | Blocking UI dependency | Not started |
| `GET /api/cities/[slug]` (Endpoint 3) must be implemented | Blocking API dependency | Not started — this Route Handler may need to be built as part of this ticket |
| `cities` table seeded with Atlanta, Houston, Chicago and `is_active = true` | Data | Must be seeded |
| ISR revalidation: `revalidateTag('city-[slug]')` called from listing publish/unpublish actions | Integration | Must be wired after this ticket |

**Assumption:** If `GET /api/cities/[slug]` is not yet implemented as a Route Handler, the city page can fetch directly from Supabase in `page.tsx` using a Server Component database call. Flag this if the Route Handler approach is preferred for separation of concerns.

---

## UX Notes

- **Screen:** `/[city-slug]` — Full-bleed hero layout
- **Flow reference:** `docs/blacqlist/ux/mvp-screen-map.md` → City Landing page detailed spec; `docs/blacqlist/ux/empty-loading-error-success-states.md` → Section 4
- **Entry points:** Homepage city spotlight links ("Explore Atlanta →"), search bar results, Google search ("Black-owned businesses in Atlanta"), direct URL
- **Exit points:** Category shortcut pill → `/[city-slug]/[category-slug]`, Featured listing card → BLACQList Page, "View all in [City]" → `/search?city=[city-slug]`, "Claim Your Page" (low-listing state) → `/add-business`
- **Mobile behavior (375px):** Hero: city name at top, listing count subtitle, category pills scroll horizontally (not wrapped). Featured listings grid: 1 column. Category shortcuts: 2-column grid. City stats line stacks vertically.
- **Low-listing state (< 10 listings):** At launch this applies to Houston and Chicago if not fully seeded. The message must be encouraging, not apologetic: "We're building out [City]. Be the first to claim your page here."
- **Invalid city slug:** `notFound()` renders the branded 404 page. Per `empty-loading-error-success-states.md` Section 4.4: at MVP, redirect unknown city slugs to `/discover` — use `redirect('/discover')` instead of `notFound()` for unknown cities. For known but inactive cities, use `notFound()`.

---

## Design Notes

- **Components to use:** `ListingCard` (from Ticket 015), `ListingCardSkeleton`, custom `CategoryCard` (icon + name + count), shadcn/ui `Badge` (listing count on category cards), `Button` (claim CTA)
- **City hero:** Full-bleed hero section. Background: Deep Background (`#19191E`). City name: Glacial Indifference Bold, 48px desktop / 32px mobile, White. Subheadline: Lato Regular 20px Pale Lavender. Category pill row: horizontal scroll row of `Badge`-style pills (Pale Lavender background, Brand Black text, 36px height), Amber Gold on hover/active.
- **Featured listings grid:** Same `ListingCard` used in search results. Grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` inside `max-w-5xl mx-auto px-4`.
- **Category shortcuts grid:** `grid grid-cols-2 md:grid-cols-3 gap-4`. Each card: White background, 1px Pale Lavender border, 8px radius, 24px padding. Category icon (Charcoal, 32px), category name (Glacial Indifference Bold 16px), count badge (Amber Gold outlined pill).
- **Loading skeleton for featured listings:** 6 `ListingCardSkeleton` components in the grid. Wrapped in `<Suspense>` so the hero and category section render immediately.
- **Empty/low-listing state:** Replace listing grid with a Pale Lavender card (full width, 32px padding): heading in Glacial Indifference Bold 22px, body in Quicksand Bold Italic 15px Charcoal, Amber Gold CTA button.
- **States to implement:** Hero (always loads immediately — static), Featured listings — loading skeleton, loaded, low-listing message. Category grid — loaded (always fast, included in main data fetch). City not found — branded 404 or redirect.

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `cities`, `listings`, `categories`
- **Entities involved:** `cities` (single record), `categories` (list with listing counts), `listings` (featured 6–12)
- **Operations:** SELECT only (all reads)
- **Data fetch:** `GET /api/cities/[slug]` returns `CityPageData` with all needed data in one request. Response includes `city`, `categories[]` (with `listing_count`), `featured_listings[]` (SearchResult shape), `total_listings`.
- **`generateStaticParams`:** Query `cities` table for all `is_active = true` cities at build time. Return `[{ 'city-slug': 'atlanta' }, ...]`.
- **ISR:** `export const revalidate = 86400` (24 hours). `unstable_cache` with tag `city-[slug]` for targeted revalidation.
- **Cover image CDN URLs:** Generated from storage paths in the ListingCard component or in the page Server Component.
- **RLS:** Public read — no auth required.
- **Migration required:** No.

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` — Endpoint 3: Get City Page Data
- **Endpoints involved:**
  - `GET /api/cities/[slug]` — fetches all city page data in one request
- **Auth required:** No
- **Response shape:** `CityPageData` with `city`, `categories[]`, `featured_listings[]`, `total_listings`
- **Error codes to handle:**
  - `NOT_FOUND` (404) — `notFound()` or `redirect('/discover')` depending on whether the city is known/inactive or completely unknown
- **ISR invalidation:** When any listing in a city is published or unpublished, `revalidateTag('city-[slug]')` must be called from the listing status-change action. This wiring is done by the action that changes listing status (not in this ticket), but the cache tag setup is here.

---

## Implementation Notes

**Files to create:**
- `app/[city-slug]/page.tsx` — Server Component with `generateStaticParams`, `generateMetadata`, `revalidate = 86400`. Fetches `CityPageData`, renders hero + listings grid + category grid + stats line.
- `app/[city-slug]/components/CityHero.tsx` — Hero section with city name, count, category pill row. Server Component.
- `app/[city-slug]/components/CategoryShortcutsGrid.tsx` — Category cards grid. Server Component.
- `app/[city-slug]/components/CityFeaturedListings.tsx` — Featured listings grid, wrapped in `<Suspense>` with skeleton fallback. Server Component.
- `app/[city-slug]/components/LowListingBand.tsx` — Claim prompt for cities with <10 listings. Server Component.

**Files to modify:**
- `app/[city-slug]/business/[listing-slug]/page.tsx` — already exists from Ticket 020. No changes needed for this ticket. (Note: the `[city-slug]` dynamic segment is shared — ensure route conflict resolution between `/[city-slug]/page.tsx` and `/[city-slug]/business/[listing-slug]/page.tsx` works correctly. Next.js handles this by matching more specific routes first.)

**Key patterns:**
```typescript
// app/[city-slug]/page.tsx
export const revalidate = 86400

export async function generateStaticParams() {
  const cities = await getCities() // SELECT slug FROM cities WHERE is_active = true
  return cities.map(c => ({ 'city-slug': c.slug }))
}

export async function generateMetadata({ params }: { params: { 'city-slug': string } }) {
  return {
    title: `Black-Owned Businesses in ${cityName} | The BLACQList`,
    description: `Discover ${total} Black-owned businesses in ${cityName}...`,
  }
}

export default async function CityPage({ params }: { params: { 'city-slug': string } }) {
  const data = await getCityPageData(params['city-slug'])
  if (!data) redirect('/discover')  // Unknown city slug
  if (!data.city.is_active) notFound()  // Known but inactive
  
  return (
    <>
      <CityHero city={data.city} totalListings={data.total_listings} categories={data.categories} />
      <Suspense fallback={<ListingCardGridSkeleton count={6} />}>
        <CityFeaturedListings listings={data.featured_listings} lowListing={data.total_listings < 10} citySlug={params['city-slug']} />
      </Suspense>
      <CategoryShortcutsGrid categories={data.categories} citySlug={params['city-slug']} />
    </>
  )
}
```

- `getCityPageData()` in `lib/services/cities.ts` fetches from the Route Handler or directly from Supabase (if Route Handler not yet implemented). Use `unstable_cache` with tag `city-[slug]`.
- Route conflict: `app/[city-slug]/page.tsx` must not conflict with `app/[city-slug]/business/[listing-slug]/page.tsx`. In Next.js App Router, the more specific nested route wins — no conflict.
- Category pill row in `CityHero`: top 5–6 categories sorted by `listing_count DESC`. If a category has 0 listings in this city, do not show the pill.

**Do not:**
- Hardcode city names or slugs — all data driven from the `cities` table.
- Show the city page with an incomplete data fetch — if the API returns 404 for the city slug, redirect or show 404 immediately.
- Use `useEffect` for data fetching — all data fetched server-side.

---

## Acceptance Criteria

- [ ] Given `/city/atlanta`, the page renders a hero with "Atlanta" as the h1, a listing count ("[N]+ Black-owned businesses"), and a horizontal row of category pills linking to `/city/atlanta/[category-slug]`.
- [ ] Given `generateStaticParams` runs at build time, routes for all `is_active = true` cities are pre-generated (verify by checking Next.js build output for the city slugs).
- [ ] Given a city with 15+ published listings, the featured listings grid renders 6 `ListingCard` components. No "build out this city" message.
- [ ] Given a city with fewer than 10 published listings, the featured listings grid is replaced by the low-listing message with "Claim Your Page" CTA.
- [ ] Given a completely unknown city slug (e.g., `/city/fakecity999`), the user is redirected to `/discover`.
- [ ] The page `<title>` is "Black-Owned Businesses in [City Name] | The BLACQList".
- [ ] The category shortcuts grid shows up to 6 categories with listing counts. Each card links to `/[city-slug]/[category-slug]`. Categories with 0 listings are not shown.
- [ ] The "View all in [City]" link navigates to `/search?city=[city-slug]`.
- [ ] The page is statically generated (ISR) — confirmed by checking `x-nextjs-cache: HIT` header on second load.
- [ ] At 375px, category pills scroll horizontally, featured listings are single column, category shortcuts are 2-column.
- [ ] The city hero `h1` is the only `h1` on the page. Section headings use `h2`.

---

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| City API returns 404 | Unknown city slug | Redirect to `/discover` | N/A |
| City API returns 404 (inactive city) | Known city with `is_active = false` | Branded 404 page via `notFound()` | N/A |
| Featured listings API fails | Network or server error | Low-listing message shown instead of skeleton failure (graceful degradation) — or inline "Listings couldn't load. Try again." within the section | Retry link within the section |
| 0 featured listings returned (city active, listings exist but none flagged featured) | Admin configuration gap | Listings grid shows top recent listings by `published_at DESC` (the API falls back to this when no `is_featured` listings exist) | Admin sets `is_featured` for listings |
| All category counts are 0 | New city, no published listings | Category shortcuts grid shows 0 count badges; low-listing message shows above it | N/A |

---

## Edge Cases

- City name contains special characters or non-ASCII (e.g., future expansion to "Montréal"): slug is URL-safe ASCII (generated by the data model). `generateStaticParams` uses the slug, not the name.
- City has exactly 10 listings: the threshold is "fewer than 10" so 10 listings shows the regular grid (not the low-listing message).
- `total_listings` count and actual `featured_listings` array length differ (race condition): `total_listings` count in the hero is from the API's aggregation; it may differ from the rendered card count. This is acceptable — do not compute count from the array.
- Category with 0 listings in this city should not appear in the pill row or shortcuts grid. Filter in the component: `categories.filter(c => c.listing_count > 0)`.
- Page is hit by a crawler before the ISR cache warms up (`dynamicParams = true` with a new city): Next.js server-renders on first request, caches for 24 hours. This is correct and expected.

---

## Accessibility Notes

- [ ] City name is `h1`. "Featured Businesses" section heading is `h2`. "Browse by Category" section heading is `h2`.
- [ ] Category pill links in the hero: `<a>` elements with descriptive `aria-label` if the pill text alone is ambiguous (it is not — "Restaurants (24)" is self-describing).
- [ ] Category shortcut cards: `<a>` wrapping the card. `aria-label="[Category Name] — [N] businesses in [City Name]"`.
- [ ] Skeleton loading: `aria-busy="true"` on the listings grid container while loading, `aria-live="polite"` to announce when loaded.
- [ ] "Claim Your Page" button: `aria-label="Claim your BLACQList page in [City Name]"` for context.
- [ ] All interactive elements keyboard-navigable with visible focus states.

---

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-027-1 | City page renders | Navigate to `/city/atlanta` | Hero with "Atlanta" h1, listing count, category pills, featured listing grid, category shortcuts |
| QA-027-2 | Category pill navigation | Click a category pill in the hero | Navigates to `/city/atlanta/[category-slug]` |
| QA-027-3 | "View all" link | Click "View all in Atlanta →" | Navigates to `/search?city=atlanta` |
| QA-027-4 | Low-listing message | Navigate to a seeded city with < 10 listings | Featured listings grid replaced by "We're building out [City]" message with "Claim Your Page" CTA |
| QA-027-5 | Unknown city slug | Navigate to `/city/fakecity999` | Redirect to `/discover` (no 404 page) |
| QA-027-6 | ISR cache | Load city page twice; check response headers | Second load has `x-nextjs-cache: HIT` header |
| QA-027-7 | Mobile layout | View `/city/atlanta` at 375px | Category pills scroll horizontally; listings single column; categories 2-column grid |
| QA-027-8 | SEO title | Check `<title>` element | "Black-Owned Businesses in Atlanta | The BLACQList" |

---

## Security Notes

- `[city-slug]` path parameter is validated against the `cities` table — unknown slugs redirect or 404 (no SQL injection risk via path params because they are used in a parameterized query).
- No user input is rendered as HTML — city name and category names from the database are text nodes in JSX.
- ISR cache serves static content — no session or user data included in the cached page.

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Atlanta, Houston, Chicago city pages tested
- [ ] `generateStaticParams` builds routes at build time (verify in `next build` output)
- [ ] ISR cache confirmed (cache headers on second request)
- [ ] Low-listing state tested with a city having < 10 listings
- [ ] Unknown city slug → redirect to `/discover` tested
- [ ] Mobile layout tested at 375px
- [ ] SEO title verified
- [ ] Category pills link to correct `/[city-slug]/[category-slug]` routes
- [ ] "View all" links to `/search?city=[slug]`
