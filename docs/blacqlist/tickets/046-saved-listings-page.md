# Ticket 046: Saved listings page (/account/saved)

---

## Status
Backlog

## Phase
Phase 7: Saves, Reviews, Corrections, Sharing

## Priority
P1 — High

## Estimate
M (2–4h)

## Feature Area
Account / Saves

---

## Context

Authenticated users need a dedicated page to view and manage all their saved listings. This is the "bookmark shelf" of the platform — it should feel fast, familiar, and satisfying to browse. The page uses the same `ListingCard` component already built for search and discovery, with one key difference: every card has an active (filled) save button that unsaves on click, removing the card from the grid with an optimistic UI.

This page is a core part of the authenticated supporter experience. It is linked in the account sidebar nav and in the bottom nav bar on mobile.

Sources: `docs/blacqlist/ux/mvp-screen-map.md` § Saved Listings; `docs/blacqlist/architecture/api-contract.md` § 16 (List Saved Entities); `docs/blacqlist/ux/empty-loading-error-success-states.md` § 12.

---

## User Story

As a logged-in supporter, I want to see all the listings I've saved in one place and remove any I no longer want, so that I can quickly get back to businesses I'm interested in.

---

## Scope

**In scope:**
- `app/account/saved/page.tsx` — Server Component; authenticated; fetches first page of saved listings via `GET /api/saves`
- Grid of listing cards using the existing `ListingCard` component; each card renders `SaveButton` with `initialSaved={true}`
- Unsave from this page: clicking the save button on a card calls `DELETE /api/saves`, removes the card from the grid optimistically; toast "Removed from saved listings." with 5-second "Undo" action
- Undo: calls `POST /api/saves` to re-add; card reappears in the grid
- Pagination: "Load More" button below the grid; 24 cards per page; button hidden when all saves fit on one page; button label shows remaining count: "Load 24 more (18 remaining)"
- Sort: saved_at DESC (most recently saved first) — no sort control at MVP
- Page heading: "Saved" with a count badge showing total save count
- Account sidebar nav: "Saved" item is active on this route
- Loading state: 6–8 listing card skeletons (matching `ListingCardSkeleton`)
- Empty state: "Nothing saved yet." + body copy + "Start exploring" button (Amber Gold → `/discover`) + "Search for something specific" text link → `/search`
- Error state: "Couldn't load your saved listings" + "Try again" button (retries the fetch)

**Out of scope:**
- Save/unsave from other pages (Ticket 045)
- Filtering or sorting saved listings (post-MVP)
- Organizing saves into folders or lists (V1)
- Bulk unsave

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 045 — Save/unsave API routes and SaveButton component | Blocking ticket | Not started |
| Ticket 013 — Auth middleware (authenticated route guard) | Blocking ticket | Not started |
| Ticket 014 — Account sidebar layout | Blocking ticket | Not started |
| `GET /api/saves` Route Handler | API | Implemented in Ticket 045 |
| `ListingCard` component | Component | Must exist from search/discovery tickets |
| `ListingCardSkeleton` component | Component | Must exist from search/discovery tickets |

---

## UX Notes

- **Screen:** Saved Listings — `docs/blacqlist/ux/mvp-screen-map.md` § Account Screens
- **Route:** `/account/saved`
- **Layout:** Dashboard sidebar — fixed sidebar left (desktop), bottom nav bar (mobile)
- **Entry points:** Account sidebar nav "Saved" link; bottom nav bar "Saved" icon (mobile)
- **Exit points:** Clicking a listing card navigates to the BLACQList Page; "Start exploring" → `/discover`; "Search for something specific" → `/search`
- **Mobile behavior:** 1-column card grid at 375px; bottom nav bar active item: "Saved"; cards are full-width

**Unsave from this page (from `empty-loading-error-success-states.md` § 12):**

| State | What user sees |
|---|---|
| Tap unsave | Heart spinner briefly; card removed from grid optimistically |
| Unsave success | Card gone. Toast: "Removed from saved listings." with 5-second "Undo" action |
| Unsave error | Card reappears in grid. Toast: "Couldn't remove. Try again." |
| Undo: tap | `POST /api/saves` called; card reappears at its original position (or top of grid if position not tracked); toast: "Listing saved." |

**Load More behavior:** The button displays the count of remaining saves: "Load 24 more (N remaining)". When the last page is loaded and no more saves exist, the button is hidden. If a `Load More` fetch fails, show an inline error below the grid: "Couldn't load more. Try again." — the existing grid remains visible.

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components:** `ListingCard` (existing), `SaveButton` (Ticket 045), `LoadMoreButton` (inline button below grid), `ListingCardSkeleton` (existing), shadcn/ui `Button`
- **Grid layout:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` — same as search results
- **Page heading:** `h1` "Saved" in Glacial Indifference Bold; count badge: `<span>` with total count in Amber Gold-tinted badge style
- **Empty state:** Centered in the main content area; "Nothing saved yet." as `h2`; body in Quicksand; Amber Gold "Start exploring" button; smaller text link below
- **Load More button:** `Button` variant `outline`; centered below the grid; label updates dynamically
- **Toast:** 5-second auto-dismiss for "Removed from saved listings." with Undo action button; persistent for errors
- **States to implement:** Loading (skeleton grid), Empty, Error (full-page grid error), Success, Unsave loading (per card), Unsave success (toast + removal), Unsave error (card reappear + toast), Load More loading (spinner on button), Load More error

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `saves`, `listings`, `listing_details_business`
- **Entities involved:** `saves`, `listings`
- **Operations:**
  - GET `/api/saves?page=1&limit=24`: returns `SavedListingCard[]` (extends `SearchResult` with `saved_at`); ordered by `saves.created_at DESC`; excludes listings with `deleted_at IS NOT NULL`
  - Unsave: `DELETE /api/saves?listing_id=[id]` (from Ticket 045)
  - Undo: `POST /api/saves` with `{ listing_id }` (from Ticket 045)
  - Load More: GET `/api/saves?page=N&limit=24`
- **Validation rules:** None additional beyond Ticket 045 Route Handlers
- **RLS policies:** `saves` scoped to `user_id = auth.uid()`; listing data filtered to `deleted_at IS NULL`
- **Migration required:** No

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` § 16 (`GET /api/saves`)

**Endpoint:**

`GET /api/saves?page=1&limit=24`

Response envelope:
```typescript
{
  data: SavedListingCard[],  // extends SearchResult + saved_at
  meta: { total: number, page: number, limit: number }
}
```

**Errors:**

| Code | HTTP | UI behavior |
|---|---|---|
| `AUTH_REQUIRED` | 401 | Middleware redirects to `/sign-in?next=/account/saved` before page renders |
| `VALIDATION_ERROR` | 400 | Should not occur with UI-controlled parameters; log and show error state |
| Network / 500 | — | Full-page error state: "Couldn't load your saved listings" + "Try again" button |

**Load More pagination:** Client-side `useState` for the current page; on "Load More" click, fetch the next page and append results to the existing array. Do not use `router.push` — keep the page URL clean.

---

## Implementation Notes

**Files to create:**
- `app/account/saved/page.tsx` — Server Component; fetches page 1 of saves; renders `SavedListingsGrid` with initial data
- `components/account/SavedListingsGrid.tsx` — "use client"; manages local grid state, optimistic unsave, undo, load more pagination

**Files to modify:**
- Account sidebar nav component — ensure "Saved" item is active on `/account/saved`
- Mobile bottom nav bar component — ensure "Saved" tab is active on `/account/saved`

**Key patterns:**

```typescript
// Optimistic unsave in SavedListingsGrid
const [saves, setSaves] = useState(initialSaves)

function handleUnsave(listingId: string) {
  const removed = saves.find(s => s.id === listingId)
  setSaves(prev => prev.filter(s => s.id !== listingId)) // optimistic remove
  fetch(`/api/saves?listing_id=${listingId}`, { method: 'DELETE' })
    .then(res => {
      if (!res.ok) throw new Error()
      toast("Removed from saved listings.", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => handleUndo(removed)
        }
      })
    })
    .catch(() => {
      setSaves(prev => [removed, ...prev]) // rollback
      toast.error("Couldn't remove. Try again.")
    })
}

function handleUndo(listing: SavedListingCard) {
  setSaves(prev => [listing, ...prev]) // optimistic re-add
  fetch('/api/saves', { method: 'POST', body: JSON.stringify({ listing_id: listing.id }) })
    .catch(() => {
      setSaves(prev => prev.filter(s => s.id !== listing.id)) // rollback
      toast.error("Couldn't undo. Try again.")
    })
}
```

- Server Component fetches page 1 and passes to the Client Component as `initialSaves`
- Client Component manages all subsequent pages in local state — no SSR after initial load
- `SaveButton` receives `initialSaved={true}` and `onUnsave` callback; the card remains in the grid until the unsave network call completes (optimistic removal handled at the grid level, not inside `SaveButton`)
- Use the `listingName` prop on `SaveButton` for accessible labels: "Remove [Business Name] from saved"

**Do not:**
- Re-fetch the full list after each unsave — remove from local state and sync in background
- Show a loading state on the full page while Load More is in progress — only the Load More button should show a spinner
- Navigate the user away on unsave

---

## Acceptance Criteria

- [ ] Given an authenticated user navigates to `/account/saved`, then a grid of their saved listings renders with the correct count badge in the heading
- [ ] Given the user has no saved listings, then the empty state renders: heading "Nothing saved yet.", body copy, Amber Gold "Start exploring" button → `/discover`, and a "Search for something specific" text link → `/search`
- [ ] Given the save data fetch fails, then the error state renders: "Couldn't load your saved listings" with a "Try again" button that retries the fetch
- [ ] Given the user clicks the save button on a card, then the card is removed from the grid immediately (optimistic); a success toast shows "Removed from saved listings." with a 5-second "Undo" action
- [ ] Given the user clicks "Undo" within 5 seconds, then the listing reappears at the top of the grid
- [ ] Given the unsave request fails, then the card reappears in the grid; a toast shows "Couldn't remove. Try again."
- [ ] Given there are more than 24 saved listings, then a "Load more" button appears below the grid showing the remaining count; clicking it appends the next page to the grid
- [ ] Given all saved listings have been loaded, then the "Load more" button is hidden
- [ ] Loading state: 6–8 `ListingCardSkeleton` components render while the initial fetch completes
- [ ] Mobile at 375px: 1-column grid; full-width cards; bottom nav "Saved" tab is active
- [ ] Page is fully authenticated — unauthenticated users are redirected to `/sign-in?next=/account/saved` by middleware before the page renders

---

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| Initial fetch fails | Network error or 500 | "Couldn't load your saved listings." + "Try again" button | Retry re-runs the fetch |
| Load More fetch fails | Network error on pagination | Inline below grid: "Couldn't load more. Try again." — existing cards remain | Retry button re-runs the pagination fetch |
| Unsave fails | DELETE returns error | Card reappears in grid; toast: "Couldn't remove. Try again." | None needed — card is visible again |
| Session expired | 401 | Middleware redirect to `/sign-in?next=/account/saved` | Re-authenticate; returns to saved page |
| Undo fails | POST after undo fails | Toast: "Couldn't undo. Try again." — card was already removed from grid | User can re-save from any listing card |

---

## Edge Cases

- User opens the page in two tabs and unsaves from both — second unsave returns 204 (idempotent); no visible error
- User has 0 saved listings despite having saved in a previous session (listings were unpublished by admin) — these are excluded from the API response; grid correctly shows 0 items even if the save rows exist in the DB
- User saves a listing on the BLACQList Page and then navigates to `/account/saved` — the newly saved listing appears because the page fetches fresh data on each navigation
- "Load More" is clicked while a previous Load More is in progress — button is disabled during the in-flight request; second click ignored
- User unsaves the last item on the last page after loading all pages — grid becomes empty; empty state renders

---

## Accessibility Notes

- [ ] Page heading `h1 "Saved"` is the first heading on the page; count badge is visually associated and announced with `aria-label`
- [ ] Each listing card has sufficient information for screen readers (business name, category, city)
- [ ] Save button on each card: `aria-label="Remove [Business Name] from saved"`, `aria-pressed="true"`
- [ ] Undo action in toast is keyboard-accessible (focusable button within the toast)
- [ ] Load More button: `aria-label="Load 24 more saved listings"` — updates dynamically with remaining count
- [ ] Loading skeleton: container has `aria-busy="true"` during initial fetch
- [ ] Empty state CTAs are keyboard-reachable with descriptive link text

---

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-1 | Happy path: view saves | 1. Log in with an account that has 5+ saved listings. 2. Navigate to `/account/saved`. | Grid renders with correct count badge. All saved listing cards display. |
| QA-2 | Unsave with undo | 1. Click the save button on a card. 2. Click "Undo" in the toast within 5 seconds. | Card removed immediately on click. Toast with Undo appears. Card reappears on Undo click. |
| QA-3 | Load More pagination | 1. Log in with 30+ saved listings. 2. Scroll to the bottom of the first page. 3. Click "Load 24 more (N remaining)". | Next page of cards appends to the grid. Button label updates. Hidden when all loaded. |
| QA-4 | Empty state | 1. Log in with an account that has zero saves. 2. Navigate to `/account/saved`. | Empty state renders: "Nothing saved yet." + "Start exploring" button + search link. |
| QA-5 | Unauthenticated access | 1. Log out. 2. Navigate to `/account/saved`. | Middleware redirects to `/sign-in?next=/account/saved`. |
| QA-6 | Mobile at 375px | 1. Open on 375px device. 2. Scroll, unsave a card, use Load More. | 1-column grid. Full-width cards. Bottom nav "Saved" tab active. All actions functional. |

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Initial server-side fetch tested: page 1 renders correctly
- [ ] Optimistic unsave tested: card removed immediately; rolls back on fetch failure
- [ ] Undo action tested: card reappears; rolls back if undo fetch fails
- [ ] Load More tested: cards appended; button hidden when all loaded; error state on pagination failure
- [ ] Empty state tested
- [ ] Error state (initial fetch failure) tested
- [ ] Unauthenticated redirect tested
- [ ] Mobile tested at 375px — 1-column layout, bottom nav active state
- [ ] Keyboard navigation tested — all interactive elements reachable
- [ ] `aria-label` on save buttons includes business name
