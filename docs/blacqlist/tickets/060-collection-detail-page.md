# Ticket 060: Collection Detail Page

## Status

Draft

## Phase

Phase 10: Editorial Collections, Guides, BLACQLight

## Priority

P2

## Feature Area

Editorial

## Context

Public detail page for a curated collection. Shows the collection's editorial content (title, description, cover image) and the full grid of listings in the collection. `generateStaticParams` for all published collection slugs. ISR 1h. `collection_viewed` analytics event fires fire-and-forget on load. 404 via `notFound()` if slug not found or collection is not published. Depends on Ticket 059 (collections index) for shared components.

## User Story

As a visitor, I want to view a curated collection of Black-owned businesses, so that I can discover businesses through editorial context and browse to individual listing pages.

## Scope

- `app/collection/[slug]/page.tsx` — Server Component, ISR 1h, `generateStaticParams`
- `generateStaticParams`: fetch all published collection slugs at build time
- Data fetch: collection record + collection_items JOIN listings (published only)
- Page sections: hero (cover image, title, description, listing count), listing grid
- Listing grid: reuses `ListingCard` component from search/discovery pages
- `notFound()` if collection is not found or `is_published = false`
- `generateMetadata` for `og:title`, `og:description`, `og:image`
- Fire-and-forget `collection_viewed` analytics event (POST /api/analytics/event)
- Breadcrumb: Home > Collections > [Collection Title]

## Out of Scope

- Comments or community contributions to collections
- Voting or reordering by visitors
- Collection sharing beyond OG tags

## Dependencies

- Depends on: Ticket 059 (collections index, shared components)
- Depends on: Ticket 049 (analytics event API for collection_viewed event)

## UX Notes

- Route: `/collection/[slug]`
- Loading: full-page skeleton — hero skeleton + 6 listing card skeletons
- Empty: if collection has 0 items, show "This collection is being curated — check back soon." in place of the grid
- Error: "Couldn't load this collection." with retry button
- Success: hero + full listing grid

## Design Notes

- Hero: full-width cover image with dark gradient overlay; Glacial Indifference Bold title (white); description in Lato Regular (Cream `#FCFAF4`); listing count badge in Amber Gold `#E2A428`
- Listing grid: same `ListingCard` used on search results — consistent experience
- Breadcrumb: small text, Charcoal `#595758`, above hero
- `collection_type` label: Amber Gold pill below the title

## Data Notes

- Tables: `collections` (id, slug, title, description, cover_image_path, collection_type, is_published), `collection_items` (collection_id, listing_id, display_order), `listings` (joined — published only)
- Query: `SELECT listings.* FROM collection_items JOIN listings ON collection_items.listing_id = listings.id WHERE collection_items.collection_id = [id] AND listings.status = 'published' ORDER BY collection_items.display_order ASC`
- Cover image URL: `supabase.storage.from('listing-media').getPublicUrl(cover_image_path)`
- RLS: collections and listings publicly readable when published

## API Notes

- No dedicated API endpoint — Server Component fetches directly
- Analytics: fire-and-forget `POST /api/analytics/event` with `{ event_name: 'collection_viewed', entity_type: 'collection', entity_id: collection.id }`
- Cache tag: `collection-${slug}` — revalidated by `publishCollection` SA

## Implementation Notes

- `app/collection/[slug]/page.tsx` — reuse `ListingCard` from `components/listings/listing-card.tsx`
- `generateStaticParams` returns `[{ slug: 'atlanta-best-restaurants' }, ...]`
- On-demand ISR: `revalidateTag(\`collection-${slug}\`)` called when admin publishes/edits

## Acceptance Criteria

- [ ] Published collection page renders with hero, description, and listing grid
- [ ] Listings in the grid link to their correct `/[city-slug]/[entity-type]/[listing-slug]` pages
- [ ] Unpublished collection returns 404
- [ ] Non-existent slug returns 404
- [ ] `collection_viewed` analytics event fires on page load (fire-and-forget)
- [ ] OG tags are correct: title = collection title, image = cover image
- [ ] Breadcrumb renders: Home > Collections > [Collection Title]
- [ ] Empty collection (0 items) shows the "being curated" message, not an empty grid
- [ ] Mobile at 375px: hero stacks correctly, listing grid is single column

## Failure States

| Failure                             | User-visible behavior                               |
| ----------------------------------- | --------------------------------------------------- |
| Collection not found or unpublished | 404 not-found page                                  |
| Listings query fails                | Error message with retry button; hero still renders |
| Analytics event fails               | Silent — fire-and-forget, user unaffected           |
| Cover image missing                 | Placeholder hero background color                   |

## Edge Cases

- Collection with `homepage_featured = true` — no special display difference on the detail page itself
- Listing in collection that has since been unpublished or deleted — exclude from JOIN (filter `listings.status = 'published'`)
- Very long collection description — truncate at 300 chars with "Read more" expansion

## Accessibility Notes

- [ ] Page `<h1>` is the collection title
- [ ] Breadcrumb uses `<nav aria-label="Breadcrumb">` with structured links
- [ ] Each listing card in the grid is keyboard-navigable
- [ ] Cover image has `alt` text: the collection title
- [ ] `collection_type` badge uses text, not color alone

## QA Test Cases

| #   | Scenario               | Role    | Steps                                          | Expected result                                                       |
| --- | ---------------------- | ------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| 1   | Happy path             | Visitor | Navigate to /collection/[valid-published-slug] | Hero and listing grid render correctly                                |
| 2   | Unpublished collection | Visitor | Navigate to /collection/[unpublished-slug]     | 404 page shown                                                        |
| 3   | Invalid slug           | Visitor | Navigate to /collection/does-not-exist         | 404 page shown                                                        |
| 4   | Empty collection       | Visitor | Navigate to collection with 0 items            | Hero renders; "being curated" message in grid area                    |
| 5   | Listing links          | Visitor | Click a listing card                           | Navigates to correct /[city-slug]/[type]/[slug] page                  |
| 6   | Analytics event        | Visitor | Load the page                                  | POST /api/analytics/event fires in network tab with collection_viewed |

## Security Notes

- Read-only public page — no user input
- Analytics event payload validated server-side by Ticket 049 handler

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
