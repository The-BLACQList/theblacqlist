# Discovery Foundation Implementation Report

**Product:** The BLACQList
**Date:** 2026-05-11
**Status:** Complete — TypeScript zero errors, lint zero errors

---

## What Was Built

The first working public discovery experience for The BLACQList. Users can browse and filter 12 mock listings across `/discover` and `/search`. Entity type and category filters are functional; city, availability, and trust tier filters are stubs with "coming soon" labels.

---

## Data Source

**Mock data** — `data/mock-entities.ts`

`supabase/seed.sql` contains states, cities, categories, and subscription plans but **no listing records**. Mock data was required. All category slugs match the actual seed categories. When Supabase listings are seeded, the filter and render logic in `app/(public)/discover/page.tsx` and `app/(public)/search/page.tsx` can be replaced with a real `SELECT` query or `/api/search` call with no component changes.

---

## Files Created

| File                                        | What it is                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `data/mock-entities.ts`                     | `DiscoveryEntity` type + 12 mock records (6 cities, 4 entity types, 10 categories, all location types) |
| `components/entities/EntityCard.tsx`        | Discovery-optimized entity card                                                                        |
| `components/discovery/SearchBar.tsx`        | Client Component — search form; updates `?q=` param on submit                                          |
| `components/discovery/DiscoveryFilters.tsx` | Client Component — sidebar filters (type + category functional; city, availability, trust tier stubs)  |
| `components/discovery/DiscoveryGrid.tsx`    | Server Component — result grid with loading/empty/error states                                         |

## Files Modified

| File                             | Change                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `app/(public)/discover/page.tsx` | Replaced placeholder with full discover page: SearchBar + DiscoveryFilters sidebar + DiscoveryGrid |
| `app/(public)/search/page.tsx`   | Replaced placeholder with full search page: SearchBar + no-query state + DiscoveryGrid results     |

---

## EntityCard Anatomy

Each card renders:

- **Cover image area** — initials placeholder (cover_image_path not used until real images are uploaded)
- **Top-left badge** — Featured (amber) or Sponsored (dark gray), shown when applicable
- **Top-right save button** — visual placeholder; non-functional until auth is built (ticket 014)
- **Entity type pill** — e.g., "Business", "Creative", "Professional"
- **Trust badge** — `StatusBadge` component (unclaimed / claimed / verified / certified)
- **Name** — linked to `/{city-slug}/business/{slug}` or `/business/{slug}` for national listings
- **Category · Location** — e.g., "Food & Dining · Atlanta, GA" or "Technology · Online"
- **Description** — 2-line truncated preview
- **"View Page" CTA** — links to entity detail route (404 until BLACQList Pages are built — tickets 020–024)

---

## Filter Behavior

All filters update URL search params immediately (no submit button). State is URL-driven so results are shareable and survive refresh.

| Filter       | State      | Params key | Notes                                     |
| ------------ | ---------- | ---------- | ----------------------------------------- |
| Entity type  | Functional | `type`     | Button group — press to toggle            |
| Category     | Functional | `category` | Select dropdown — 25 categories from seed |
| City         | Stub       | `city`     | Select disabled with "coming soon"        |
| Availability | Stub       | —          | Checkboxes disabled with "Soon" label     |
| Trust tier   | Stub       | —          | Checkbox disabled with "Soon" label       |

Sidebar filters are hidden on mobile (< 768px). A note reads "Filters available on desktop · Full mobile filters coming in V1."

---

## Route Pages

### `/discover`

- SearchBar at top (submits to `/discover`)
- Sidebar filter column (md+) + DiscoveryGrid
- Filters `MOCK_ENTITIES` by `q`, `type`, `category`, `city` from URL params
- Shows all 12 entities by default; narrows on filter change

### `/search`

- SearchBar at top (stays on `/search`)
- No-query empty state with prompt and link to `/discover`
- On query: filters `MOCK_ENTITIES` and renders DiscoveryGrid
- Active query shown in result count and empty state messages

---

## DiscoveryEntity Type

Mirrors the `/api/search` response shape from `docs/blacqlist/architecture/api-contract.md`, with `description` added as a flattened field (it lives in `listing_details_business` in the schema, not in `listings` base table).

```ts
interface DiscoveryEntity {
  id: string
  name: string
  slug: string
  entity_type: 'business' | 'professional' | 'creative' | 'event' | 'job' | 'vendor'
  tagline: string
  description: string // from listing_details_business — flattened for display
  category: { name: string; slug: string }
  city: { name: string; slug: string; state_abbr: string } | null
  location_type: 'physical' | 'online' | 'hybrid' | 'virtual-services' | 'ships-nationwide'
  trust_tier: 'unclaimed' | 'claimed' | 'verified' | 'certified'
  tier: 'free' | 'standard' | 'premium'
  is_featured: boolean
  is_sponsored: boolean
  logo_path: string | null
  cover_image_path: string | null
  avg_rating: number | null
  review_count: number
  save_count: number
}
```

---

## Components Used (all pre-existing)

| Component     | File                              |
| ------------- | --------------------------------- |
| `StatusBadge` | `components/ui/status-badge.tsx`  |
| `CardGrid`    | `components/ui/card-grid.tsx`     |
| `Container`   | `components/layout/container.tsx` |
| `Skeleton`    | `components/ui/skeleton.tsx`      |
| `Button`      | `components/ui/button.tsx`        |
| `Badge`       | `components/ui/badge.tsx`         |

No new packages installed.

---

## States Implemented

| State              | Where         | How                                                              |
| ------------------ | ------------- | ---------------------------------------------------------------- |
| Loading            | DiscoveryGrid | 6-card skeleton grid matching card structure                     |
| Empty (no results) | DiscoveryGrid | Message tailored to whether a query was active                   |
| Empty (no query)   | SearchPage    | Prompt to enter a query with link to /discover                   |
| Error              | DiscoveryGrid | Alert with message (wired; currently not triggered by mock data) |
| Success            | DiscoveryGrid | Result count + card grid                                         |

---

## What Was NOT Built

| Item                                   | Reason                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| Real Supabase reads                    | No listing records in seed.sql; mock data used                               |
| `lib/entities/queries.ts`              | Not needed — filtering happens inline against mock array                     |
| Mobile filter drawer                   | V1 ticket — filter sidebar hidden on mobile with a note                      |
| Pagination                             | Load more button is a visual stub; full pagination requires API (ticket 025) |
| Sort controls                          | Requires API (ticket 025)                                                    |
| Save button functionality              | Requires auth (ticket 014)                                                   |
| Entity detail pages                    | BLACQList Pages build (tickets 020–024); links currently go to 404           |
| Real cover images / logos              | Requires Supabase Storage setup and real listing data                        |
| City, availability, trust tier filters | Requires API filtering support (ticket 025)                                  |

---

## Verification

```bash
pnpm tsc --noEmit  # ✅ zero errors
pnpm lint          # ✅ zero errors
```

### Manual verification checklist

- [ ] `pnpm dev` — dev server starts without errors
- [ ] `/discover` — SearchBar renders, sidebar filters visible on desktop
- [ ] All 12 mock entities appear in grid on first load
- [ ] Filter by type "Business" — non-business entities removed from grid
- [ ] Filter by category "Food & Dining" — only Peach & Rye Kitchen shows
- [ ] Clear all filters — all 12 entities return
- [ ] `/search` with no query — no-query state shown with link to /discover
- [ ] `/search?q=salon` — Crown & Coil Studio appears
- [ ] `/search?q=xyz` — no-results empty state shown
- [ ] Entity card: Featured badge on Peach & Rye Kitchen and Sable Fitness
- [ ] Entity card: Sponsored badge on Melanin Law Group
- [ ] Entity card: "Online" shown for Rooted Tech Solutions (no city)
- [ ] Entity card: "Ships Nationwide" shown for Calabash Candles
- [ ] Entity card: "Atlanta, GA · Hybrid" shown for Melanin Law Group (hybrid, city set)
- [ ] Save button visible on every card but non-functional
- [ ] Filter sidebar hidden at 375px
- [ ] All cards pass 44px minimum touch target on "View Page" button
- [ ] Focus rings visible on all interactive elements

---

## Known Limitations

- **"View Page" links will 404** until BLACQList Page routes are built (tickets 020–024).
- **Save button is visual only** until auth is built (ticket 014).
- **Cover images show initials placeholder** until real listing images are uploaded to Supabase Storage.
- **Mock text search is basic substring match** — does not rank or weight results. Replace with `/api/search` (ticket 025) for production.
- **All 12 mock records returned in a single in-memory array** — "Load more" button is disabled. Full pagination requires ticket 025.
- **Mobile filters are unavailable** — sidebar hidden on small screens; full mobile filter drawer is a V1 follow-up.

---

## Next Tickets to Build

| Priority | Ticket  | Description                                               |
| -------- | ------- | --------------------------------------------------------- |
| P1       | 014     | Auth flows — unlocks save button and owner dashboard      |
| P1       | 020–024 | BLACQList Page — entity detail page; makes card CTAs work |
| P1       | 025–026 | Search API + real DB reads — replaces mock data           |
| P1       | 032–033 | Add Business form — lets owners create listings           |
| P2       | 027–028 | City landing pages — city-level discovery                 |
| P2       | 029     | Full Discover page — pagination, sort, mobile filters     |
