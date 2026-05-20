# Ticket 028: City + Category Landing Pages (/[city-slug]/[category-slug])

**Ticket ID:** BLACQ-028
**Title:** City + category landing pages (/[city-slug]/[category-slug])
**Type:** Feature
**Priority:** P1 — High
**Estimate:** M (2–4h)
**Status:** Backlog
**Phase:** Phase 4: Search, Filters, City/Category Pages
**Feature Area:** Public Discovery / SEO

---

## Context

City + category pages are the most SEO-valuable page type on the platform. They directly target high-intent transactional queries like "Black-owned hair salons Atlanta" or "Black-owned restaurants Chicago." Each page is a pre-scoped discovery grid for a specific city–category combination, statically generated with ISR and optimized for Google indexing. There are potentially hundreds of these pages (cities × categories), so `generateStaticParams` handles pre-generation of active combinations, with ISR fallback for new combinations.

Source artifacts:
- `docs/blacqlist/ux/mvp-screen-map.md` — City + Category page detailed spec
- `docs/blacqlist/ux/empty-loading-error-success-states.md` — Sections 4.2, 4.3
- `docs/blacqlist/architecture/api-contract.md` — Endpoint 4: Get City + Category Page Data

This ticket depends on Ticket 027 (city pages) for shared components and the `[city-slug]` route segment.

**Critical routing note:** This page lives at `app/[city-slug]/[category-slug]/page.tsx`. The listing page lives at `app/[city-slug]/business/[listing-slug]/page.tsx`. The second segment can be either a `category-slug` OR an entity type (`business`, `professional`, etc.) followed by a `listing-slug`. Next.js resolves this by having the entity-type routes as more specific nested paths (`/[city-slug]/business/[slug]`) — the category page catches all `/[city-slug]/[second-segment]` patterns that do NOT match a more specific nested route. This requires confirming that the routing structure in `app/[city-slug]/` does not create conflicts.

---

## User Story

> As someone searching Google for "Black-owned hair salons in Atlanta," I want to land on a page showing exactly those results, pre-filtered and ready to browse, so that I can find what I need without running a separate search.

---

## Scope

**In scope:**
- `app/[city-slug]/[category-slug]/page.tsx` — Server Component, ISR `revalidate: 86400` (24 hours)
- `generateStaticParams()` — generates all active city × category combinations where `listing_count > 0`. `dynamicParams = true` for future combinations. Batch size per `Promise.all` page — do not fetch all combinations in one query if count is large.
- Data fetch: `GET /api/cities/[city-slug]/categories/[category-slug]` (Endpoint 4) — returns `city`, `category`, `listings[]` (paginated), `meta`
- Page header (SEO title block): `h1` "[Category Name] in [City Name]", listing count ("[N] businesses"), optional editorial copy from `category.description`
- Breadcrumb: Home → [City Name] → [Category Name] (semantic `<nav>` with `aria-label="Breadcrumb"`)
- Listing card grid: `ListingCard` components, 3-col desktop / 2-col tablet / 1-col mobile, 20 listings per page
- Load More button: client-side pagination (not infinite scroll), same pattern as search results page
- `generateMetadata()`: title "[Category Name] in [City Name] — Black-Owned Businesses | The BLACQList"
- Empty state (city+category has 0 listings): "No [Category] listings in [City] yet." body, "Browse all in [City]" → `/city/[city-slug]`, "Add your business" → `/add-business`. Page still renders and is indexable (has SEO value for future listings).
- `notFound()` when city slug OR category slug is invalid/inactive (Endpoint 4 returns 404)
- ISR cache tag: `city-category-[city-slug]-[category-slug]` for targeted invalidation
- Filter bar: at MVP, Sort control only ("Best Match" — non-functional, reserved for V1). Trust tier filter deferred to V1. No subcategory filter at MVP.
- `category_page_viewed` analytics event logged server-side (or via client-side fire-and-forget)

**Out of scope:**
- Subcategory filter (V1)
- Sort by Newest or Rating (V1)
- Trust tier filter (V1)
- Editorial copy editing (admin feature)
- City + category + entity type drill-down (V1)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| BLACQ-027: City landing pages (shared `[city-slug]` route segment) | Blocking ticket | Not started |
| BLACQ-015: `ListingCard` component | Blocking UI dependency | Not started |
| `GET /api/cities/[city-slug]/categories/[category-slug]` (Endpoint 4) | Blocking API dependency | Not started |
| `cities` × `categories` combinations with `listing_count > 0` seeded | Data | Must be seeded |
| Route conflict resolution between `app/[city-slug]/[category-slug]/` and `app/[city-slug]/business/[listing-slug]/` confirmed | Architecture | Risk — verify before implementation |

---

## UX Notes

- **Screen:** `/[city-slug]/[category-slug]` — Discovery grid layout
- **Flow reference:** `docs/blacqlist/ux/mvp-screen-map.md` → City + Category page; `docs/blacqlist/ux/empty-loading-error-success-states.md` → Section 4.2, 4.3
- **Entry points:** City landing page category pill clicks, Google search results, direct URL
- **Exit points:** Listing card → BLACQList Page; Breadcrumb "City" → `/city/[city-slug]`; "Browse all in [City]" → `/city/[city-slug]`; "Add your business" → `/add-business`
- **Mobile behavior (375px):** Breadcrumb on one line (truncate if needed). `h1` at top. Listing grid 1 column. Load More full-width. Empty state stacked vertically.
- **Empty state when listings exist in city but not in category:** "No [Category] listings in [City] yet. This category is growing. Check back, or browse all businesses in [City]." with "Browse all in [City]" link. Page indexed — do not 404 for empty combinations.
- **Route conflict resolution:** `app/[city-slug]/[category-slug]/page.tsx` is a catch-all for the second dynamic segment. The entity-type paths (`business`, `professional`, `creative`, `event`, `job`, `vendor`) must be handled as nested subdirectory routes in `app/[city-slug]/business/[listing-slug]/` etc. Since these are more specific routes (deeper nesting), Next.js App Router will match them first. Verify this during implementation by testing `/[city-slug]/business/[listing-slug]` still routes correctly after this file is added.
- **`dynamicParams = true`:** New city+category combinations added after build will be server-rendered on first request and cached. No 404 for uncached but valid combinations.

---

## Design Notes

- **Components to use:** `ListingCard` (Ticket 015), `ListingCardSkeleton`, `Breadcrumb` from shadcn/ui, `Button` (Load More), custom `SEOPageHeader` (h1 + count + description)
- **Page layout:** Constrained content (`max-w-5xl mx-auto px-4`), Discovery grid layout (no full-bleed hero — this is a grid page, not a hero page).
- **SEO page header:** White background. `h1` in Glacial Indifference Bold 32px desktop / 22px mobile, Brand Black. Count badge: Amber Gold outlined pill (e.g., "142 businesses"). `category.description` in Lato Regular 16px Charcoal, if set.
- **Breadcrumb:** Lato Regular 14px Charcoal. Home link → `/`. City link → `/city/[city-slug]`. Current page: category name (not a link — current page indicator). Separator: `/` or `›`.
- **Listing grid:** Same `ListingCard` grid as search results. 20 per page.
- **Load More:** `<Button variant="outline">Load 20 more ([N] remaining)</Button>` centered below the grid.
- **Empty state:** Pale Lavender card (full-width within content area, 32px padding, 8px radius). Heading Glacial Indifference Bold 22px, body Quicksand Bold Italic 15px Charcoal, two Amber Gold CTA buttons.
- **States to implement:** Loaded (grid with listings), empty (no listings in this city+category), not found (invalid city or category slug), loading skeleton.

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `listings`, `cities`, `categories`
- **Entities involved:** `cities` (city record), `categories` (category record), `listings` (filtered by city + category)
- **Operations:** SELECT only
- **Data fetch:** `GET /api/cities/[city-slug]/categories/[category-slug]` (Endpoint 4) with `page=1&limit=20`. Returns `{ city, category, listings[], meta }`.
- **`generateStaticParams`:** Query for all city × category combinations where at least 1 published listing exists. Return array of `{ 'city-slug': string, 'category-slug': string }`. Potentially large — use a Supabase `DISTINCT` query:
  ```sql
  SELECT DISTINCT cities.slug as city_slug, categories.slug as category_slug
  FROM listings
  JOIN cities ON listings.city_id = cities.id
  JOIN categories ON listings.category_id = categories.id
  WHERE listings.status = 'published' AND listings.deleted_at IS NULL
    AND cities.is_active = true AND categories.is_active = true
  ```
- **ISR:** `export const revalidate = 86400`. Tag: `city-category-[city-slug]-[category-slug]`. `revalidatePath('/[city-slug]/[category-slug]')` called when listing status changes.
- **Load More:** Client-side fetch to `GET /api/cities/[city-slug]/categories/[category-slug]?page=N&limit=20`. The page component passes city and category slugs to the client grid component for this.
- **RLS:** Public read. No auth required.
- **Migration required:** No.

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` — Endpoint 4
- **Endpoint:** `GET /api/cities/[city-slug]/categories/[category-slug]?page=1&limit=20`
- **Auth required:** No
- **Response shape:** `CityCategoryPageData` with `city`, `category`, `listings: SearchResult[]`, `meta: { total, page, limit }`
- **Error codes to handle:**
  - `NOT_FOUND` (404) — city or category slug invalid or inactive → `notFound()` in the page
  - `VALIDATION_ERROR` (400) — invalid page/limit params (should not occur with correct client code)

---

## Implementation Notes

**Files to create:**
- `app/[city-slug]/[category-slug]/page.tsx` — Server Component. `generateStaticParams`. `generateMetadata`. `revalidate = 86400`. `dynamicParams = true`. Renders `SEOPageHeader`, `Breadcrumb`, `CityCategoryListingsClient`.
- `app/[city-slug]/[category-slug]/components/CityCategoryListingsClient.tsx` — `"use client"`. Load More state. Appends results on Load More fetch. Renders `ListingCardGrid`.
- `components/seo/SEOPageHeader.tsx` — Reusable header for category pages (also used by other discovery pages). Props: `heading`, `count`, `description?`.
- `lib/services/cityCategory.ts` — `getCityCategoryPageData(citySlug, categorySlug, page, limit)` — fetches from Endpoint 4 or directly from Supabase.

**Files to modify:**
- None — new page files only

**Key patterns:**
```typescript
// app/[city-slug]/[category-slug]/page.tsx
export const dynamicParams = true
export const revalidate = 86400

export async function generateStaticParams() {
  const combinations = await getCityCategoryCombinations()
  // Returns [{ 'city-slug': 'atlanta', 'category-slug': 'hair-beauty' }, ...]
  return combinations
}

export default async function CityCategoryPage({
  params,
}: {
  params: { 'city-slug': string; 'category-slug': string }
}) {
  const data = await getCityCategoryPageData(params['city-slug'], params['category-slug'], 1, 20)
  if (!data) notFound()

  return (
    <>
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: data.city.name, href: `/city/${data.city.slug}` }, { label: data.category.name }]} />
      <SEOPageHeader heading={`${data.category.name} in ${data.city.name}`} count={data.meta.total} description={data.category.description} />
      {data.meta.total === 0
        ? <EmptyCityCategoryState city={data.city} category={data.category} />
        : <CityCategoryListingsClient
            initialListings={data.listings}
            meta={data.meta}
            citySlug={params['city-slug']}
            categorySlug={params['category-slug']}
          />
      }
    </>
  )
}
```

- Verify route conflict: after creating `app/[city-slug]/[category-slug]/page.tsx`, test that `app/[city-slug]/business/[listing-slug]/page.tsx` still routes correctly. If there is a conflict, add a route group or use a middleware-based routing check.
- The `generateStaticParams` query may return 100+ combinations at launch. This is fine — Next.js handles large `generateStaticParams` arrays. Use `Promise.all` with batched Supabase queries if needed.
- `dynamicParams = true` ensures that new city+category combinations (added after build) are handled by ISR fallback — no 404 for valid but uncached combinations.

**Do not:**
- Conflict with the listing page route. The listing page has a 3-segment path (`/[city-slug]/business/[listing-slug]`) — always more specific than the 2-segment category page.
- Use `DISTINCT ON` SQL for `generateStaticParams` if it is complex — a simple `JOIN` + `WHERE` gives the same result.
- Render subcategory filter UI (V1 only).

---

## Acceptance Criteria

- [ ] Given `/city/atlanta/hair-beauty`, the page renders `<h1>Hair & Beauty in Atlanta</h1>`, a listing count, breadcrumb (Home → Atlanta → Hair & Beauty), and a grid of listing cards filtered to Hair & Beauty businesses in Atlanta.
- [ ] Given `/city/atlanta/nonexistent-category`, the page renders the branded 404 (via `notFound()`).
- [ ] Given a valid city+category combination with 0 published listings, the page renders the empty state: "No Hair & Beauty listings in Atlanta yet." with "Browse all in Atlanta" and "Add your business" links. The page returns 200 (not 404) and is indexable.
- [ ] `generateStaticParams` generates routes for all active city+category combinations with at least 1 published listing (verified in `next build` output).
- [ ] New city+category combinations not in `generateStaticParams` (added after build) are server-rendered on first request and ISR-cached (`dynamicParams = true`).
- [ ] Navigating to `/city/atlanta/business/some-listing-slug` correctly routes to the listing page (not the category page) — route conflict does not exist.
- [ ] Clicking Load More appends the next 20 listings to the grid and updates the Load More button label with remaining count.
- [ ] The page `<title>` is "Hair & Beauty in Atlanta — Black-Owned Businesses | The BLACQList".
- [ ] Breadcrumb has `<nav aria-label="Breadcrumb">` wrapping, Home and city name are links, current page is not a link.
- [ ] The page is ISR-cached (confirmed by `x-nextjs-cache: HIT` on second request within 24h).

---

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| City or category not found | Invalid slug | Branded 404 via `notFound()` | N/A |
| API returns 500 | Server error during page render | Next.js error boundary catches; shows global error page with "Try again" | User retries |
| Load More fails | API error on pagination request | Toast: "Couldn't load more. Try again." Load More button re-enables | User retries Load More |
| No listings in city+category | Valid slugs, 0 published listings | Empty state with clear explanation and CTAs — 200 response | N/A |
| `generateStaticParams` query slow at build | Large combinations count | Build time increases — acceptable at MVP scale. Add `LIMIT 5000` if needed. | Monitor build time |

---

## Edge Cases

- Category slug matches an entity type slug (e.g., a category named "business" with slug `business`): this would conflict with the listing route pattern `/[city-slug]/business/[listing-slug]`. At MVP, ensure no category has a slug equal to any entity type (`business`, `professional`, `creative`, `event`, `job`, `vendor`). Add a database-level CHECK constraint or validation in the admin category creation form.
- Very large `generateStaticParams` result (500+ combinations): `next build` handles this, but build time may increase. If combinations exceed 1,000, limit `generateStaticParams` to the top 500 by listing count and use `dynamicParams = true` for the rest.
- City name contains accents or special characters: the slug is always URL-safe ASCII (handled by the data model). The display name can contain any Unicode — render as text.
- Category has listings but all are `is_featured = false`: the listings grid still renders (no `is_featured` filter on this page — all published listings in the city+category are shown).

---

## Accessibility Notes

- [ ] `h1` for "[Category Name] in [City Name]" is the only `h1` on the page.
- [ ] Breadcrumb: `<nav aria-label="Breadcrumb"><ol>` with `<li>` items. Current page item has `aria-current="page"`.
- [ ] Listing count badge: `aria-label="[N] businesses found"`.
- [ ] Load More button: `aria-label="Load 20 more [Category Name] listings in [City Name]"`. While loading: `disabled` + `aria-busy="true"`.
- [ ] Empty state: heading is `h2`. CTAs are semantic `<a>` or `<button>` elements.
- [ ] All listing cards keyboard-navigable (inherited from `ListingCard` component).

---

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-028-1 | Category page renders | Navigate to `/city/atlanta/hair-beauty` | h1 "Hair & Beauty in Atlanta", listing count, breadcrumb, grid of Hair & Beauty listings in Atlanta |
| QA-028-2 | Breadcrumb navigation | Click "Atlanta" in breadcrumb | Navigates to `/city/atlanta` |
| QA-028-3 | Invalid category | Navigate to `/city/atlanta/zzz-nonexistent` | Branded 404 page |
| QA-028-4 | Empty combination | Navigate to valid city+category with 0 listings | Empty state with explanatory copy and CTAs; 200 response, page is indexable |
| QA-028-5 | Route conflict test | Navigate to `/city/atlanta/business/test-listing-slug` | Correctly routes to the listing page, not the category page |
| QA-028-6 | Load More | On a category page with 25 listings | 20 cards load; Load More shows "Load 5 more (5 remaining)"; click loads remaining 5; button hidden |
| QA-028-7 | ISR cache | Load page twice within 24h | Second request has `x-nextjs-cache: HIT` |
| QA-028-8 | Mobile layout | View at 375px | Breadcrumb single line; h1 wraps if needed; grid single column |

---

## Security Notes

- Path parameters `[city-slug]` and `[category-slug]` are validated against the database via Endpoint 4. Invalid slugs → 404, not SQL injection risk.
- `category.description` from the database is rendered as plain text in JSX (not HTML) — no XSS risk.
- ISR-cached pages serve pre-rendered static content — no session data included.

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Route conflict with listing page tested and confirmed safe
- [ ] Valid city+category page renders correctly
- [ ] Invalid category slug → 404 confirmed
- [ ] Empty combination state (0 listings) renders and returns 200
- [ ] `generateStaticParams` verified in `next build` output
- [ ] `dynamicParams = true` confirmed (new combination renders on first request)
- [ ] Load More functionality tested
- [ ] ISR cache confirmed (cache header on second request)
- [ ] Mobile layout tested at 375px
- [ ] Breadcrumb `aria-current="page"` on current segment verified
