# Ticket 016: Homepage Page Component

## Status
Draft

## Phase
Phase 2: Public Marketing and Discovery Shell

## Priority
P1

## Feature Area
Discovery

## Context
The homepage is the national front door of the BLACQList platform. It is the first impression for every new visitor from organic search, social media, and word of mouth. It must render fast, communicate purpose immediately, and drive users toward discovery within two seconds of arrival. Source: `docs/blacqlist/ux/mvp-screen-map.md` section 1 (Homepage detailed spec), `docs/blacqlist/ux/empty-loading-error-success-states.md` section 1.

## User Story
As a visitor, I want to see a clear, inviting homepage that immediately communicates what The BLACQList is and lets me search for or browse Black-owned businesses, so that I can start discovering within seconds of arriving.

## Scope
- `app/page.tsx` — Server Component with ISR (`export const revalidate = 21600` = 6 hours)
- Hero section: headline in Glacial Indifference ("Find & Be Found."), subheadline in Lato, full-width `HeroSearchBar` Client Component with city selector + keyword input → navigate to `/search`
- Category grid: five category tiles (Products & Services, Professionals, Creatives, Events, Jobs) with icons — each links to `/discover?type=[slug]`
- Featured listings section: up to 6 listing cards fetched from `GET /api/listings/featured?limit=6` wrapped in `<Suspense>` with skeleton fallback
- City spotlight section: Atlanta featured city with admin-curated listing count and category pill row — also wrapped in `<Suspense>`
- Featured collection slot: if a collection with `is_active = true` exists (admin-selected by `display_order = 0`), renders a wide editorial card; section is hidden entirely if no collection exists
- Dollar-flow teaser band: static visual band with copy "Your receipts are already counting." and CTA → `/account/receipts` (authenticated) or `/sign-up?next=/account/receipts` (anonymous)
- For Business CTA strip: Brand Black band with headline "You deserve a better page." and two buttons
- `generateMetadata` with homepage SEO (title, description, OG tags)
- `<main id="main-content">` wrapper for skip-to-content accessibility

## Out of Scope
- Search functionality itself (covered by Ticket 018)
- City landing page (separate ticket)
- Collections index page (separate ticket)
- Dynamic listing cards inside the City spotlight beyond count and category pills (city spotlight cards are in the city landing page ticket)
- Dollar-flow live data visualization (V3)

## Dependencies
- Depends on: Ticket 015 — App shell layout (root layout with nav and footer must exist)
- Depends on: Ticket 009 — Core entity tables (listings, categories, cities data must be seeded)

## UX Notes
- **Screen:** Homepage (`/`) — Full-bleed hero layout
- **Route:** `/`
- **Entry points:** Direct URL, search engines, social media links
- **Exit points:** Search (`/search`), Discover (`/discover?type=...`), City page (`/city/[slug]`), BLACQList Pages (via featured listing cards), Collection page, For Business page (`/for-business`), Sign Up (`/sign-up`)
- **Mobile behavior at 375px:**
  - Hero: full-viewport-width, headline wraps to 2 lines, search bar stacks city selector above keyword input (single column), CTA button full-width below
  - Category grid: wraps to 2 columns or horizontal scroll row (not single column list)
  - Featured listings: single column card stack
  - For Business band: buttons stacked vertically
- **Loading states (from `docs/blacqlist/ux/empty-loading-error-success-states.md` 1.1–1.3):**
  - Featured listings: 6 `ListingCardSkeleton` components matching exact card layout while fetching
  - City spotlight: city name line + 6 category pill skeletons
  - Featured collection slot: collection card skeleton (cover image block + title line + listing count line)
- **Empty state:** Featured listings section hidden if no listings are `is_featured = true`. Collection slot hidden if no active collection exists. No empty state banner shown to public users — sections collapse silently.
- **Error state:** Featured listings error → section collapses (no error banner for supplementary element). City spotlight error → section collapses silently.

## Design Notes
- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Hero section:**
  - Background: full-bleed dark hero image or `bg-[#19191E]` if no image configured
  - Headline: `text-5xl md:text-7xl font-bold text-white` in Glacial Indifference, max-w-3xl
  - Subheadline: `text-lg md:text-xl text-gray-300` in Lato
  - Search bar container: `max-w-2xl w-full mt-8`
  - City selector: `bg-white/10 backdrop-blur text-white border-white/20` on dark hero
  - Search button: `bg-[#E2A428] text-black font-bold px-6 py-3 rounded-r-full`
- **Category grid:**
  - Container: `grid grid-cols-2 md:grid-cols-5 gap-3 max-w-4xl mx-auto`
  - Each tile: `flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white cursor-pointer`
  - Icon: 32×32px line art SVG, `text-[#E2A428]`
- **Featured listings section:** `bg-[#FCFAF4]` (cream) background, `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
- **For Business band:** `bg-black py-16 px-4 text-center`. Headline `text-3xl font-bold text-white`. Primary button `bg-[#E2A428] text-black`. Secondary button `border border-white text-white bg-transparent hover:bg-white/10`.
- **Components to use:** shadcn/ui `Card`, `CardContent`, `CardHeader`, `Button`, `Input`, `Select`
- **Listing card component:** `ListingCard` — reusable across search results, city pages, collections; renders cover image, name, category badge, city, trust badge, save button

## Data Notes
- **Data model:** `docs/blacqlist/data/database-schema-plan.md` — `listings`, `categories`, `cities`, `collections`, `collection_items`
- **Tables read:** `listings` (featured), `categories` (category grid), `cities` (city spotlight), `collections` (featured collection), `collection_items`
- **Operations:** SELECT only; all server-side in the page component
- **RLS:** Anon SELECT applies — only published, non-deleted listings visible
- **Data fetching pattern:**
  - Featured listings: `GET /api/listings/featured?limit=6` (ISR 30 min, separate from page ISR)
  - City spotlight data: `GET /api/cities/atlanta` (city slug hardcoded at MVP for launch city)
  - Featured collection: `GET /api/collections` (returns first item from ordered list)
  - Category list: static data (5 categories hardcoded for the homepage grid, no DB fetch needed at MVP)
- **Migration required:** No — requires seed data for listings and collections (separate seed data ticket)

## API Notes
- **API contract:** `docs/blacqlist/architecture/api-contract.md` — endpoints 2 (Get Featured Entities), 3 (Get City Page Data), 7 (List Collections)
- **Endpoints involved:**
  - `GET /api/listings/featured?limit=6` — featured listings grid
  - `GET /api/cities/atlanta` — city spotlight data (hardcoded for launch)
  - `GET /api/collections` — featured collection (use `data[0]` if it exists)
- **Auth required:** No — all three are public endpoints
- **Error handling:** If any endpoint returns non-200, the corresponding section collapses silently. No error state is shown to the user for supplementary homepage sections.
- **ISR note:** Homepage has a 6-hour ISR TTL (`revalidate = 21600`). Admin changes to featured listings or collections trigger `revalidatePath('/')` immediately via the admin actions service.

## Implementation Notes

**Files to create:**
- `app/page.tsx` — Server Component with `export const revalidate = 21600`
- `components/home/HeroSearchBar.tsx` — `"use client"` — city selector + keyword input; on submit, calls `router.push('/search?q=[query]&city=[city]')`
- `components/home/CategoryGrid.tsx` — Server Component (static 5 categories)
- `components/home/FeaturedListingsSection.tsx` — Server Component; fetches featured listings; wrapped in `Suspense` by parent
- `components/home/CitySpotlight.tsx` — Server Component; fetches city data; wrapped in `Suspense`
- `components/home/FeaturedCollectionSlot.tsx` — Server Component; fetches collections; returns null if none found
- `components/home/ForBusinessBand.tsx` — Server Component (static)
- `components/home/DollarFlowTeaser.tsx` — Server Component with auth-conditional CTA
- `components/listings/ListingCard.tsx` — Reusable listing card component (used across homepage, search, city pages)
- `components/listings/ListingCardSkeleton.tsx` — Skeleton matching `ListingCard` layout

**Files to modify:**
- `app/layout.tsx` — Ensure `<main id="main-content">` is placed correctly (may already be done in Ticket 015; confirm)

**Page structure in `app/page.tsx`:**
```tsx
export const revalidate = 21600

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'The BLACQList — Find & Be Found',
    description: 'Discover Black-owned businesses, professionals, creatives, and events near you.',
    openGraph: { ... }
  }
}

export default async function HomePage() {
  // Parallel data fetches — do not await sequentially
  const [featuredListings, cityData, collections] = await Promise.all([
    fetchFeaturedListings({ limit: 6 }),
    fetchCityData('atlanta'),
    fetchCollections(),
  ])

  return (
    <main id="main-content">
      <HeroSection />  {/* Static + HeroSearchBar Client Component */}
      <CategoryGrid />
      <Suspense fallback={<FeaturedListingsSkeleton />}>
        <FeaturedListingsSection listings={featuredListings} />
      </Suspense>
      <Suspense fallback={<CitySpotlightSkeleton />}>
        <CitySpotlight cityData={cityData} />
      </Suspense>
      {collections[0] && <FeaturedCollectionSlot collection={collections[0]} />}
      <DollarFlowTeaser />
      <ForBusinessBand />
    </main>
  )
}
```

**`HeroSearchBar` submit behavior:**
```tsx
function onSubmit(e: React.FormEvent) {
  e.preventDefault()
  const params = new URLSearchParams()
  if (query.trim()) params.set('q', query.trim())
  if (city) params.set('city', city)
  router.push(`/search?${params.toString()}`)
}
```

**Key patterns:**
- Use `Promise.all()` for parallel server-side data fetches — do not waterfall
- Each Suspense boundary covers one data-dependent section; the hero, category grid, and static bands render immediately on first paint
- `ListingCard` must accept a `listing: SearchResult` prop matching the API contract response shape

**Do not:**
- Fetch data inside Client Components — all data fetching happens in Server Components
- Show an empty state or error message for supplementary sections (featured listings, city spotlight, collection slot) — collapse silently on error or empty

## Acceptance Criteria
- [ ] Homepage renders at `/` with hero, category grid, featured listings (or skeleton while loading), city spotlight, and for-business band
- [ ] Featured listings section shows up to 6 listing cards fetched from `/api/listings/featured?limit=6`; shows 6 skeleton cards while fetching via Suspense
- [ ] If no featured listings exist, the featured listings section is hidden entirely — no empty-state banner shown to public users
- [ ] Category grid tiles link to correct `/discover?type=[slug]` routes (Products & Services, Professionals, Creatives, Events, Jobs)
- [ ] HeroSearchBar navigates to `/search?q=[query]&city=[city]` on submit; city selector without keyword navigates to `/search?city=[city]`
- [ ] For Business band CTA "Claim Yours Free →" links to `/for-business` or the claim flow
- [ ] Dollar-flow teaser CTA routes to `/sign-up?next=/account/receipts` for anonymous users and `/account/receipts` for authenticated users
- [ ] `generateMetadata` returns correct `<title>` and `<meta name="description">` (verified in DevTools Elements panel)
- [ ] Page scores Largest Contentful Paint under 2.5s at "Good" in Lighthouse on a simulated 4G connection
- [ ] Homepage renders correctly at 375px — no horizontal overflow, category grid wraps or scrolls, search bar is usable with one hand

## Failure States

| Failure | User-visible behavior |
|---|---|
| Featured listings API returns error or timeout | Featured listings section collapses silently — skeleton is replaced by nothing. Rest of the page renders normally. |
| City spotlight API returns error | City spotlight section collapses silently. No error banner. |
| Featured collection slot — no active collection | Section is hidden entirely. No "empty" message shown to users. |
| ISR stale cache serves old data after admin changes | Admin triggers `revalidatePath('/')` after any featured listing or collection change — stale window is under 30 seconds |

## Edge Cases
- Homepage with no seeded listings at all (development environment): featured listings section collapses, city spotlight shows listing count of 0, category grid still renders (it is static)
- User arrives via `/` with an active session that has expired (stale cookie): `supabase.auth.getUser()` in the root layout returns null; nav renders unauthenticated state; no error shown
- `HeroSearchBar` city selector with only 1 city available (early launch): single option pre-selected, city selector may render as a static chip rather than a dropdown

## Accessibility Notes
- [ ] Hero section headline is `<h1>` — only one `<h1>` per page
- [ ] Category grid tiles are `<a>` elements with descriptive text (icon + label) — not `<div>` click handlers
- [ ] `HeroSearchBar` city selector has a visible `<label>` ("City") and keyword input has a visible `<label>` ("Search")
- [ ] Featured listing cards each have descriptive link text (business name) — cover image has alt text matching business name
- [ ] Skeleton elements use `aria-hidden="true"` and `aria-busy="true"` on their container so screen readers announce "loading" state correctly
- [ ] `ListingCard` save button has `aria-label="Save [business name]"` or `aria-label="Unsave [business name]"`

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | Homepage renders all sections | Anonymous | Load `/`; scroll through full page | Hero, category grid, featured listings (or skeleton), city spotlight, dollar-flow teaser, for-business band, footer all visible |
| QA-2 | HeroSearchBar navigates correctly | Anonymous | Enter "hair salon" in keyword field, select "Atlanta" in city selector, submit | Navigates to `/search?q=hair+salon&city=atlanta` |
| QA-3 | Featured listings skeleton shows while loading | Anonymous | Throttle network to Slow 3G; load `/` | 6 skeleton cards appear in featured listings area; real cards replace them after load |
| QA-4 | Homepage at 375px | Anonymous | Set browser viewport to 375px; load `/` | No horizontal overflow; category grid visible (2-col or horizontal scroll); search bar single column; for-business buttons stacked |
| QA-5 | generateMetadata | Anonymous | View page source or inspect `<head>` | `<title>` and `<meta name="description">` present and non-empty |

## Security Notes
- No user data is read on the homepage — all fetches are public, anonymous-accessible endpoints
- The `HeroSearchBar` query input must be sanitized before including in the URL — use `encodeURIComponent` or `URLSearchParams` which handles encoding automatically
- No auth tokens or session data are passed to any component on the homepage (session is read only in the root layout for nav state)

## Completion Checklist
- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading via Suspense skeletons, empty via section collapse, error via section collapse, success)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested — search bar, category tiles, listing cards all reachable
- [ ] Accessibility requirements met — h1, labels, alt text, skeleton aria attributes
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
