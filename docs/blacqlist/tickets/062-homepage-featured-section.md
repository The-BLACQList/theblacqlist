# Ticket 062: Homepage featured section — featured listings and featured collection slot

## Status
Draft

## Phase
Phase 10: Editorial

## Priority
P1

## Estimate
M (2–4h)

## Feature Area
Discovery / Editorial

---

## Context

The homepage (Ticket 016) renders the core discovery shell. This ticket enhances it with the two editorial slots that give the homepage its curated personality: (1) the Featured Collection slot — a banner-style card linking to a `/collection/[slug]` page when any collection has `homepage_featured = true`; and (2) the "Trending in [City]" listings section — 4–6 listings with high recent `page_views` in the primary launch city (Atlanta), server-rendered from `entity_analytics_daily`. Both slots are strictly additive — they do not require structural changes to the existing homepage component tree; they are new sections inserted at defined positions.

Both slots are optional rendering: if no collection has `homepage_featured = true`, the collection banner is hidden and no empty state is shown. If `entity_analytics_daily` has insufficient data (< 4 qualifying rows), the trending section falls back to the most recently published listings for the city.

ISR revalidation is 6 hours (matching the homepage), triggered on-demand by `manageCollections` SA (Ticket 061) when the `homepage_featured` flag changes.

Sources: `docs/blacqlist/ux/mvp-screen-map.md` § Homepage; `docs/blacqlist/data/database-schema-plan.md` § collections, entity_analytics_daily, listings; `docs/blacqlist/architecture/server-actions-plan.md` § Cache Invalidation Patterns.

---

## User Story

As a homepage visitor, I want to see a curated editorial collection and trending local businesses highlighted on the homepage, so that I discover compelling content beyond the default search bar and category grid.

---

## Scope

**In scope:**
- `components/homepage/FeaturedCollectionSlot.tsx` — Server Component; queries `collections WHERE homepage_featured = true AND is_published = true LIMIT 1`; if no result, renders `null` (no UI); if result exists, renders a wide card with cover image, title, item count, editorial excerpt, and an Amber Gold "Explore [Collection Name] →" CTA linking to `/collection/[slug]`
- `components/homepage/TrendingInCitySection.tsx` — Server Component; queries `entity_analytics_daily` for top 4–6 listings by `page_views` in the last 7 days for the featured city (Atlanta at MVP); falls back to `listings ORDER BY published_at DESC LIMIT 6` if analytics data is sparse; renders a section heading "Trending in Atlanta" + `ListingCardGrid` (reuses existing `ListingCard` component from Ticket 016)
- Both components are added to `app/page.tsx` (the homepage Server Component), positioned as defined in the UX notes below
- ISR: homepage ISR is already 6h per Ticket 016; no change to the TTL — on-demand revalidation via `revalidatePath('/')` called by `manageCollections` SA handles freshness for the collection slot
- Wrapping each new section in `<Suspense>` with a skeleton fallback so their load does not block the hero, category grid, or city spotlight from rendering
- Loading skeletons for both slots
- Correct null / empty behavior: FeaturedCollectionSlot returns null when no featured collection; TrendingInCitySection returns null when city has zero published listings

**Out of scope:**
- The `/collection/[slug]` public page itself (that is a separate, pre-existing scope from Phase 2)
- Admin controls for which city to feature in the trending section (hardcoded to Atlanta at MVP; city configuration is V1)
- Dollar-flow teaser band (separate static section already in Ticket 016 scope)
- Animated or carousel presentation of the featured collection
- A/B testing the slot positions

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 016 — Homepage page component | Blocking ticket | Not started |
| Ticket 061 — Admin collection editor (produces `homepage_featured` flag) | Soft dependency (feature works with flag; slot just hides if flag not set) | Not started |
| Ticket 011 — `collections` and `collection_items` tables | Blocking ticket | Not started |
| Ticket 012 — `entity_analytics_daily` table | Blocking ticket | Not started |
| `ListingCard` component (from Ticket 016) | Component dependency | Not started |

---

## UX Notes

- **Screen:** Homepage `/` — `docs/blacqlist/ux/mvp-screen-map.md` § Homepage
- **Section placement order on homepage (top to bottom):**
  1. Hero + search bar
  2. Category grid
  3. City spotlight (Atlanta — curated grid + Houston/Chicago teasers)
  4. **Featured Collection slot** ← new (position 4; below city spotlight, above For Business band)
  5. **Trending in Atlanta** ← new (position 5; below featured collection, above For Business band)
  6. For Business CTA strip
  7. Footer
- **FeaturedCollectionSlot layout:** Full-width card (Cream or Deep Background card; `rounded-xl`); left side: cover image (aspect ratio 16:9, object-fit cover, `rounded-l-xl`); right side: Pale Lavender "Collection" eyebrow label, collection title in Glacial Indifference, item count in small Lato ("12 businesses"), description excerpt (2 lines, clamped), Amber Gold text link "Explore [Name] →". On mobile: image stacks above text, full-width.
- **TrendingInCitySection layout:** Section heading "Trending in Atlanta" (left-aligned, Glacial Indifference h2) + subtitle "The businesses your community is visiting this week" (Lato, Charcoal). Below: responsive grid of 4–6 `ListingCard` components. On mobile: 1-column stacked; tablet: 2-column; desktop: 3-column.
- **Null state behavior:** Both sections render `null` when no data — no "coming soon" placeholder, no empty card. The page layout must not leave a visible gap; adjacent sections should flow together naturally.
- **Mobile behavior:** FeaturedCollectionSlot collapses to a stacked card (image on top, text below). TrendingInCitySection renders as a single-column scroll on 375px.

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **FeaturedCollectionSlot components:** `Card`, `CardContent`, standard `next/image` for cover, `Button` (ghost/link variant) for CTA
- **TrendingInCitySection components:** Reuse existing `ListingCard` from the homepage; section heading with `<h2>` using Glacial Indifference styling
- **Cover image path:** `collections.cover_image_path` is a Supabase Storage path — generate public URL with `supabase.storage.from('listing-media').getPublicUrl(path)`
- **Skeleton for FeaturedCollectionSlot:** A `rounded-xl` card with a `Skeleton` block at the cover image dimensions (16:9 aspect) and three `Skeleton` lines for title / count / description
- **Skeleton for TrendingInCitySection:** 4 `ListingCardSkeleton` components (same skeleton as used in Ticket 016's featured listings)
- **States to implement:** Loading (Suspense skeleton), Null/empty (section renders nothing), Error (Suspense error boundary falls back to null — no homepage error banner for this non-critical section)

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` § collections, entity_analytics_daily, listings
- **FeaturedCollectionSlot query:**
  ```sql
  SELECT id, title, slug, description, cover_image_path,
         (SELECT COUNT(*) FROM collection_items WHERE collection_id = collections.id) AS item_count
  FROM collections
  WHERE homepage_featured = true AND is_published = true
  LIMIT 1
  ```
- **TrendingInCitySection query:**
  ```sql
  -- Primary: aggregate page_views from entity_analytics_daily for last 7 days
  SELECT l.id, l.name, l.slug, l.entity_type, l.trust_tier, l.cover_image_path, l.logo_path,
         l.avg_rating, l.review_count, l.save_count,
         c.name AS category_name, c.slug AS category_slug,
         ci.name AS city_name, ci.slug AS city_slug
  FROM entity_analytics_daily ead
  JOIN listings l ON l.id = ead.entity_id
  JOIN categories c ON c.id = l.category_id
  JOIN cities ci ON ci.id = l.city_id
  WHERE ci.slug = 'atlanta'
    AND ead.date >= (CURRENT_DATE - INTERVAL '7 days')
    AND l.status = 'published'
    AND l.deleted_at IS NULL
    AND l.flag_status = 'none'
  GROUP BY l.id, c.name, c.slug, ci.name, ci.slug
  ORDER BY SUM(ead.page_views) DESC
  LIMIT 6
  -- Fallback if fewer than 4 results:
  -- SELECT ... FROM listings WHERE city_id = [atlanta_id] AND status = 'published' ORDER BY published_at DESC LIMIT 6
  ```
- **Validation rules:** No user input — read-only data fetch
- **RLS:** Both queries use anon-level RLS (published listings + published collections only). Run with the anon Supabase client.
- **Migration required:** No new tables — uses `collections` (Ticket 011), `entity_analytics_daily` (Ticket 012), `listings` (Ticket 009)

---

## API Notes

No new Route Handlers or Server Actions. Data is fetched server-side in the Server Components using the Supabase anon client directly (or via `lib/services/` helpers if they exist).

Cache strategy: Homepage is already ISR with `revalidatePath('/')` called by `manageCollections` SA. No additional cache setup required for these sections.

---

## Implementation Notes

**Files to create:**
- `components/homepage/FeaturedCollectionSlot.tsx` — async Server Component; returns null when no featured collection
- `components/homepage/TrendingInCitySection.tsx` — async Server Component; includes fallback logic
- `components/homepage/FeaturedCollectionSlotSkeleton.tsx` — skeleton shown in Suspense fallback
- `components/homepage/TrendingInCitySkeleton.tsx` — skeleton (4× `ListingCardSkeleton`)

**Files to modify:**
- `app/page.tsx` — import and render `FeaturedCollectionSlot` and `TrendingInCitySection` inside `<Suspense>` wrappers; insert at positions 4 and 5 in the section order

**Key patterns:**
- These are Server Components — do not add `"use client"` unless a client-only feature is needed (none at MVP)
- Wrap in `<Suspense fallback={<SkeletonComponent />}>` in `app/page.tsx` — each section loads independently; a slow analytics query does not block the hero
- TrendingInCitySection implements the fallback in TypeScript (not two separate SQL calls unless Supabase ORM makes a single query natural):
  ```typescript
  let listings = await getTrendingListings('atlanta', 6)
  if (listings.length < 4) {
    listings = await getRecentListings('atlanta', 6)
  }
  ```
- Generate public URL for `cover_image_path` using `supabase.storage.from('listing-media').getPublicUrl(path)` — do not store or expose CDN URLs
- The Atlanta city slug is hardcoded as `'atlanta'` at MVP — use a named constant `FEATURED_CITY_SLUG = 'atlanta'` in `lib/config/homepage.ts` so it is easy to change

**Do not:**
- Make the featured collection slot show any UI when `homepage_featured = true` collection does not exist — return `null`
- Block the homepage hero from rendering while these sections load — they must be in Suspense boundaries
- Attempt to revalidate the homepage from within these components — that is handled by the `manageCollections` SA

---

## Acceptance Criteria

- [ ] Given a collection with `homepage_featured = true AND is_published = true` exists, when the homepage loads, then the FeaturedCollectionSlot card is visible with the correct title, excerpt, item count, cover image, and a CTA linking to `/collection/[slug]`
- [ ] Given no collection has `homepage_featured = true`, when the homepage loads, then no featured collection card is rendered — the layout flows directly from the city spotlight to the trending section (or to the For Business band if the trending section is also empty)
- [ ] Given `entity_analytics_daily` has 4+ qualifying rows for Atlanta in the last 7 days, when the homepage loads, then the TrendingInCitySection shows those listings ordered by page_views descending
- [ ] Given `entity_analytics_daily` has fewer than 4 qualifying rows for Atlanta, when the homepage loads, then TrendingInCitySection falls back to the 6 most recently published Atlanta listings
- [ ] Given the page is loading the two new sections, then Suspense skeletons are shown for each section while the server data fetches resolve — the hero, category grid, and city spotlight render immediately
- [ ] Given the homepage is served from ISR cache and a collection is set to `homepage_featured` via the admin SA, then the homepage ISR cache is invalidated and the next visitor sees the updated slot
- [ ] Mobile at 375px: FeaturedCollectionSlot image stacks above text, TrendingInCitySection renders as a single-column grid — no horizontal overflow

---

## Failure States

| Failure | User-visible behavior |
|---|---|
| Supabase query for `collections` fails | Suspense error boundary catches; FeaturedCollectionSlot renders null (hidden) — no error banner on the homepage for this non-critical section |
| Supabase query for `entity_analytics_daily` fails | TrendingInCitySection renders null; no error banner |
| `cover_image_path` is null or storage URL generation fails | FeaturedCollectionSlot renders without an image (graceful degradation — text and CTA still visible) |
| All trending and fallback queries return zero results | TrendingInCitySection renders null |

---

## Edge Cases

- `collections.cover_image_path` is null (no cover image uploaded): render the FeaturedCollectionSlot without an image — a Cream / Deep Background card with text only; do not crash
- Collection has 0 member items (`item_count = 0`): show item count as "0 businesses" — do not hide the slot
- Description is null: omit the description line from the card; title + count + CTA are still shown
- Atlanta has exactly 4 trending listings: show all 4 (do not pad with fallback listings if primary query returns ≥ 4)
- A listing in the trending set is saved/unsaved by the current user: the `ListingCard` save button should respect auth state as normal; optimistic UI applies

---

## Accessibility Notes

- [ ] FeaturedCollectionSlot card is fully keyboard-navigable (Tab reaches the CTA link)
- [ ] Cover image has descriptive `alt` text: `"${collection.title} — featured collection cover"`
- [ ] TrendingInCitySection `<h2>` heading "Trending in Atlanta" uses semantic HTML — not a styled div
- [ ] `ListingCard` components within TrendingInCitySection meet the same accessibility requirements as cards elsewhere on the homepage

---

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | Featured collection slot visible | anonymous | Set a collection to `homepage_featured = true` in the admin; visit `/` | FeaturedCollectionSlot card renders with correct title, description, and CTA |
| QA-2 | Featured collection slot hidden | anonymous | Ensure no collection has `homepage_featured = true`; visit `/` | No collection card visible; no empty card placeholder |
| QA-3 | Trending section shows analytics data | anonymous | Ensure `entity_analytics_daily` has 4+ Atlanta rows for the last 7 days; visit `/` | TrendingInCitySection shows up to 6 listings ordered by page_views desc |
| QA-4 | Trending fallback | anonymous | Empty `entity_analytics_daily` for Atlanta; visit `/` | TrendingInCitySection falls back to most recent 6 published Atlanta listings |
| QA-5 | Mobile layout at 375px | anonymous | Open homepage on a 375px viewport | FeaturedCollectionSlot image stacks above text; trending grid is single-column; no horizontal overflow |

---

## Security Notes

- Both Server Components use the anon Supabase client — RLS ensures only `is_published = true` collections and `status = 'published'` listings are returned
- No user input is processed in these components; no validation or injection risk

---

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading skeleton, null/empty, error boundary to null, success render)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
