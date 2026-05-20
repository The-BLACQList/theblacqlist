# Ticket 059: Collections Index Page

## Status

Draft

## Phase

Phase 10: Editorial Collections, Guides, BLACQLight

## Priority

P2

## Feature Area

Editorial

## Context

Public page listing all published curated collections. Collections are admin-curated groupings of listings (guides, themed lists, city spotlights). This page gives visitors a browsable entry point into editorial content beyond raw search. Sourced from `collections` table where `is_published = true`. Server-rendered with ISR. No auth required. Depends on Ticket 011 (collections table) and Ticket 015 (app shell).

## User Story

As a visitor, I want to browse curated collections of Black-owned businesses, so that I can discover businesses through editorial context rather than just search.

## Scope

- `app/collections/page.tsx` — Server Component, ISR 1h revalidate
- Fetch all published collections: `SELECT * FROM collections WHERE is_published = true ORDER BY homepage_featured DESC, created_at DESC`
- Collection card component: cover image (Supabase Storage public URL), title, description excerpt (max 120 chars), listing count badge, `collection_type` label
- Featured collection (if `homepage_featured = true`) rendered as a larger hero card at top
- Grid layout: 3 columns desktop, 2 tablet, 1 mobile
- Empty state if no published collections
- Page title, meta description, OG tags via `generateMetadata`

## Out of Scope

- Collection creation or editing (Ticket 061)
- City guide sub-type layout (V1)
- Search or filter within collections

## Dependencies

- Depends on: Ticket 011 (collections, collection_items tables), Ticket 015 (app shell)

## UX Notes

- Route: `/collections`
- Loading: skeleton grid matching the card layout — 6 skeleton cards
- Empty: "No collections yet — check back soon." (centered, no CTA for visitors)
- Error: "Couldn't load collections." with retry button
- Success: grid of collection cards; featured card spans full width at top if present

## Design Notes

- Deep Background (`#19191E`) page background
- Collection cards: `bg-card` with Amber Gold (`#E2A428`) accent on `collection_type` badge
- Featured card: full-width banner with cover image overlay, Glacial Indifference Bold title on dark overlay
- `listing_count` badge: small pill, Amber Gold text on dark background
- Tailwind grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`

## Data Notes

- Table: `collections` — fields: `id`, `slug`, `title`, `description`, `cover_image_path`, `collection_type`, `is_published`, `homepage_featured`, `created_at`
- Table: `collection_items` — for listing count: `SELECT COUNT(*) FROM collection_items WHERE collection_id = id`
- Cover image: generate public URL from `cover_image_path` via `supabase.storage.from('listing-media').getPublicUrl(path)`
- RLS: published collections are publicly readable

## API Notes

- No dedicated API endpoint — data fetched directly in Server Component via Supabase client
- `unstable_cache` with `revalidate: 3600` and tag `collections-index`

## Implementation Notes

- `CollectionCard` component: `components/collections/collection-card.tsx`
- `CollectionHeroCard` for featured collection: `components/collections/collection-hero-card.tsx`
- Both reused on homepage featured section (Ticket 062)
- `revalidateTag('collections-index')` called by `publishCollection` SA (Ticket 061)

## Acceptance Criteria

- [ ] All published collections render as cards sorted by featured-first, then newest
- [ ] Featured collection (if any) renders as a full-width hero card above the grid
- [ ] Each card shows: cover image, title, description excerpt, listing count, collection_type label
- [ ] Page renders with ISR — no auth required, accessible without session
- [ ] Empty state renders correctly when no published collections exist
- [ ] `og:title`, `og:description`, `og:image` are present in page head
- [ ] Loading skeleton matches grid layout (6 skeleton cards)
- [ ] Mobile at 375px: single-column, cards stack correctly

## Failure States

| Failure                  | User-visible behavior                                    |
| ------------------------ | -------------------------------------------------------- |
| Supabase query fails     | "Couldn't load collections." with retry button           |
| Cover image path missing | Placeholder image rendered; no broken image icon         |
| No published collections | "No collections yet — check back soon." centered message |

## Edge Cases

- Collection with no listing_items yet: shows "0 listings" badge
- Very long title: truncates at 2 lines with ellipsis
- Cover image path in storage but file deleted: fallback placeholder image

## Accessibility Notes

- [ ] Each collection card is a single focusable `<a>` link with descriptive `aria-label`
- [ ] Cover images have alt text: the collection title
- [ ] `collection_type` badge uses text label, not color alone
- [ ] Page has a `<h1>` heading ("Collections" or "Curated Collections")
- [ ] Grid navigable by keyboard in document order

## QA Test Cases

| #   | Scenario                    | Role                 | Steps                                               | Expected result                                       |
| --- | --------------------------- | -------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| 1   | Happy path with collections | Visitor              | Navigate to /collections                            | Collection cards render in grid; featured card at top |
| 2   | Empty state                 | Visitor              | Navigate to /collections (no published collections) | Empty state message shown                             |
| 3   | Featured collection display | Visitor              | At least one collection has homepage_featured=true  | Full-width hero card renders above grid               |
| 4   | Mobile layout               | Visitor              | View at 375px                                       | Single column layout; cards full-width                |
| 5   | No auth required            | Visitor (logged out) | Navigate to /collections                            | Page renders without redirect                         |

## Security Notes

- No user input on this page — read-only, public
- Cover image URLs generated server-side; no signed URL needed for public bucket

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
