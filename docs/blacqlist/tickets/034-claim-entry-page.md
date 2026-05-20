# Ticket 034: Claim Entry Page (/claim)

## Status

Backlog

## Phase

Phase 5: Submit / Claim / Manage Foundation

## Priority

P1

## Feature Area

Core Workflow / Claim

## Context

The claim flow is the primary mechanism by which Black business owners establish ownership of their BLACQList Page. The claim entry page is the starting point: authenticated users search for their listing, see its current status, and choose to claim it. Without this page, business owners cannot take ownership of their listing records. This is the first of two claim-flow screens; the claim form is Ticket 035. Source: `docs/blacqlist/ux/mvp-screen-map.md` Claim Entry screen; `docs/blacqlist/ux/core-user-flows.md` Flow 9 (Claim a Listing); `docs/blacqlist/architecture/api-contract.md` Section 1 endpoint 1 (search); `docs/blacqlist/data/database-schema-plan.md` listings and claims tables.

## User Story

As a business owner, I want to search for my business on The BLACQList so that I can find my existing listing and initiate a claim, or learn that my business is not yet listed and add it instead.

## Scope

**In scope:**

- `app/claim/page.tsx` — Server Component for initial render; reads `searchParams` for pre-filled query
- `app/claim/_components/ClaimSearch.tsx` — Client Component (`"use client"`): name input + optional city `Select` filter, submit triggers `GET /api/search` with `q` + `city` params
- Results list: each result is a listing card showing name, city, category, cover image thumbnail (or placeholder), trust_tier badge (`Unclaimed` = gray, `Claimed` = Amber Gold, `Pending` = yellow). Per result: "Claim this page" button navigating to `/claim/[listing-id]`
- Disabled states per listing status:
  - `trust_tier = 'claimed'` or `'verified'`: button shows "Already claimed" badge, `disabled`, `cursor-not-allowed`
  - Current user has an open claim for this listing (`GET /api/claims/status?listing_id=`): button shows "Claim pending", `disabled`
  - Listing is not `trust_tier = 'unclaimed'`: disabled with appropriate label
- Auth guard: middleware redirects unauthenticated users to `/sign-in?next=/claim`; page does not render for unauthenticated users
- "Can't find your business?" section: shown when results are empty OR always visible below results. Two options: "Search again" (clear form, refocus input) and "Add your business instead →" (link to `/add-business`)
- Empty state (no search entered yet): heading "Search for your business" + search bar prominent, no results grid
- Loading state: skeleton list (3 cards) while search results load
- Error state: "Search failed. Please try again." with retry

**Out of scope:**

- The claim verification form (`/claim/[listing-id]`) — Ticket 035
- Admin claim management — Ticket 040
- Claiming a listing that has been deleted or archived (404 on claim form — handled in Ticket 035)

## Dependencies

| Dependency                                                 | Type            | Status                                                      |
| ---------------------------------------------------------- | --------------- | ----------------------------------------------------------- |
| Ticket 015 (auth middleware)                               | Blocking ticket | Required for auth guard redirect                            |
| Ticket 025 (listings tables)                               | Blocking ticket | Search endpoint queries `listings` table                    |
| `GET /api/search` Route Handler (Ticket from Search phase) | Blocking ticket | Used to fetch listing results                               |
| `GET /api/claims/status` Route Handler                     | Blocking ticket | Used to check if current user has an open claim per listing |
| `cities` table seeded                                      | Data            | Required for city filter select options                     |

## UX Notes

- **Screen:** `Claim Entry` — `docs/blacqlist/ux/mvp-screen-map.md` Section 4 (Claim + Create Screens)
- **Flow reference:** `docs/blacqlist/ux/core-user-flows.md` → Flow 9 (Claim a Listing)
- **Entry points:** Homepage "Claim Yours Free" button → `/claim`; For Business page → `/claim`; Dashboard empty state "Search for my business to claim" → `/claim`; Onboarding Step 2A → `/claim`; BLACQList Page "Claim this page" link → `/claim?q=[business-name]`
- **Exit points:** "Claim this page" → `/claim/[listing-id]`; "Add your business instead" → `/add-business`; Back navigation → wherever user came from
- **Mobile behavior (375px):**
  - Layout: `max-w-xl mx-auto px-4` — constrained content, no sidebar
  - Search input: full-width; city select stacked below on mobile (not inline)
  - Results list: single-column card stack; "Claim this page" button is full-width below the listing info on mobile (minimum 48px height)
  - "Can't find your business?" section: always visible below results, Amber Gold text link style

## Design Notes

- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Components to use:** shadcn/ui `Input`, `Select`, `Button`, `Badge`, `Card`, `Skeleton`
- **Layout:** Constrained content — `max-w-xl mx-auto`; heading centered; search bar full-width; results list below
- **Typography:**
  - Page heading: Glacial Indifference Bold `text-3xl`: "Claim Your BLACQList Page"
  - Subheading: Quicksand `text-base text-[#6B6B6B]`: "Search for your business to get started"
  - Result card business name: Glacial Indifference, `text-lg font-bold`
  - Result card meta (city, category): Quicksand, `text-sm text-[#6B6B6B]`
- **Trust tier badges:**
  - Unclaimed: `bg-gray-100 text-gray-700 border border-gray-300`
  - Claimed: `bg-[#E2A428] text-[#000000]`
  - Pending: `bg-yellow-100 text-yellow-800`
  - Verified: `bg-green-100 text-green-800`
- **"Claim this page" button:** `bg-[#E2A428] text-[#000000] hover:bg-[#c8911f]`; disabled variant: `bg-gray-200 text-gray-500 cursor-not-allowed`
- **States to implement:** Idle (search form only), Loading (skeleton), Results, Empty results, Error

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `listings`, `claims`, `cities`
- **Entities involved:** `listings` (read via search API), `claims` (read via claims status API)
- **Operations:** SELECT only — no writes on this page
- **Validation rules:** Search query minimum 1 character before submitting; city is optional filter
- **RLS policies:** `GET /api/search` returns only `status = 'published'` listings. `GET /api/claims/status` returns only the current user's claims (`claimant_user_id = auth.uid()`)
- **Migration required:** No

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` → Section 1 endpoint 1 (search), Section 5 endpoint 25 (claim status)
- **Endpoints involved:**
  - `GET /api/search?q=[name]&city=[city-slug]` — returns matching published listings
  - `GET /api/claims/status?listing_id=[id]` — called per visible listing to check if the current user has a pending claim; batched where possible or called after results render
- **Auth required:** Yes — Supporter session
- **Request shape:** `{ q: string, city?: string }` as query params
- **Response shape from search:** `{ data: SearchResult[], meta: { total, page, limit } }` — `SearchResult` includes `id`, `name`, `slug`, `city`, `category`, `trust_tier`, `cover_image_path`
- **Error codes to handle:**
  - `401 AUTH_REQUIRED` — middleware handles redirect before page renders; this code should not reach the page
  - `429 RATE_LIMITED` — show "Too many searches. Please wait a moment." message
  - `5xx` — show error state with retry button

## Implementation Notes

**Files to create:**

- `app/claim/page.tsx` — Server Component; reads session; reads `cities` for city filter options; renders `ClaimSearch` client component
- `app/claim/_components/ClaimSearch.tsx` — Client Component; manages search state, results, loading, error; fetches search API on submit
- `app/claim/_components/ClaimResultsList.tsx` — renders the list of listing cards with claim status per item
- `app/claim/_components/ClaimResultCard.tsx` — individual listing card with claim button and trust tier badge

**Files to modify:**

- None — standalone route

**Key patterns:**

- Use URL `searchParams` to allow pre-filling the search input: `?q=business+name` — set `defaultValue` on the input from `searchParams.q`
- Fetch claim status for visible listings using `GET /api/claims/status?listing_id=` after search results render — do NOT block search results rendering on claim status; render results first, then load claim status asynchronously and update button states
- Use `useTransition` for the search fetch to show a loading state without blocking the UI
- The city filter select options are fetched server-side in `page.tsx` and passed to `ClaimSearch` as props

**Do not:**

- Render the claim form on this page — the form is a separate route (Ticket 035)
- Allow unauthenticated users to see search results — the auth guard in middleware handles this, but confirm with `supabase.auth.getUser()` in the server component as a second layer
- Show archived or draft listings in results — `GET /api/search` already filters to `status = 'published'`

## Acceptance Criteria

- [ ] Given an unauthenticated user navigates to `/claim`, they are redirected to `/sign-in?next=/claim`
- [ ] Given an authenticated user types "Hair Studio" and submits the search, a list of matching published listings renders with name, city, category, cover image, and trust_tier badge
- [ ] Given a search result has `trust_tier = 'claimed'`, the "Claim this page" button is replaced with a disabled "Already claimed" badge
- [ ] Given the current user has a pending claim for a listed result, that result's button shows "Claim pending" and is disabled
- [ ] Given a search returns no results, the "Can't find your business?" section is prominently visible with "Add your business instead →" link
- [ ] Given an authenticated user clicks "Claim this page" on an unclaimed listing, they are navigated to `/claim/[listing-id]`
- [ ] The search input is pre-filled when the URL contains `?q=[query]` (e.g., arriving from a BLACQList Page "Claim this page" link)
- [ ] Loading skeleton (3 card placeholders) renders while search results are fetching
- [ ] On mobile at 375px, the city select renders below the name input (stacked, full-width), and the "Claim this page" button is full-width below each card

## Failure States

| Failure                  | Condition                                      | User sees                                                                                                                   | Recovery                                                 |
| ------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Search API failure       | `GET /api/search` returns 5xx                  | "Search failed. Please try again." with a Retry button                                                                      | User clicks Retry — re-fires the same query              |
| Rate limited             | 60+ requests/min from this user                | "Too many searches. Please wait a moment and try again."                                                                    | User waits and retries                                   |
| Claim status check fails | `GET /api/claims/status` fails for one listing | Button defaults to "Claim this page" (enabled) — no error shown; the claim form (Ticket 035) will handle the conflict check | User proceeds to claim form which catches the open claim |
| City data unavailable    | `cities` fetch fails on page load              | Next.js `error.tsx` boundary with retry                                                                                     | User retries page load                                   |

## Edge Cases

- User arrives from `/sign-in?next=/claim` after being redirected from an unauthenticated visit — the `next` param is handled by the sign-in flow; user lands on `/claim` authenticated
- Search returns more than 20 results: pagination or "Load more" is deferred — at MVP show the first 20 results with a "Show more" button (calls the same endpoint with `page=2`)
- Listing `cover_image_path` is null: render a branded placeholder image (platform default cover image) in the card thumbnail
- User searches with only whitespace: trim before sending to API; if trimmed value is empty, show inline validation "Please enter a business name" without firing the API
- Multiple listings with identical names in the same city: all render as separate cards — the user selects the correct one

## Accessibility Notes

- [ ] The search form uses `<form>` with `onSubmit`; the submit button is `<button type="submit">` — not a div with onClick
- [ ] The search input has `<label>` "Search for your business" (visually visible, not sr-only on this page — it is the primary action)
- [ ] Results list is a `<ul>` with `<li>` items — not a div stack; each item is semantically a list item
- [ ] Each "Claim this page" button has a unique accessible name: `aria-label="Claim [Business Name] in [City]"` to distinguish buttons in the list
- [ ] Disabled buttons have `aria-disabled="true"` and a visible reason label ("Already claimed" or "Claim pending")
- [ ] The loading skeleton has `aria-busy="true"` on the results container and `aria-hidden="true"` on skeleton elements
- [ ] After search results load, the result count is announced via `aria-live="polite"`: "[N] results for '[query]'"

## QA Test Cases

| ID   | Test                    | Steps                                                                               | Expected                                                                                                           |
| ---- | ----------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| QA-1 | Happy path              | Sign in as authenticated user → navigate to `/claim` → search "Atlanta Hair Studio" | Results list renders with matching listings, trust tier badges, and "Claim this page" button on unclaimed listings |
| QA-2 | Already claimed listing | Search for a listing with `trust_tier = 'claimed'`                                  | "Already claimed" badge shown; button is disabled                                                                  |
| QA-3 | Unauthenticated access  | Open incognito → navigate to `/claim`                                               | Redirect to `/sign-in?next=/claim`                                                                                 |
| QA-4 | No results              | Search for an unusual name with no matches                                          | "Can't find your business?" section visible; "Add your business instead →" link present                            |
| QA-5 | Pre-filled query        | Navigate to `/claim?q=Cozy+Coffee`                                                  | Name input pre-filled with "Cozy Coffee"; search auto-triggers if `searchParams.q` is present on page load         |

## Security Notes

- Auth guard is enforced both at middleware and in the Server Component (`supabase.auth.getUser()`)
- Search results only include `status = 'published'` listings — draft or pending listings are not revealed to claimants
- `GET /api/claims/status` is scoped by `claimant_user_id = auth.uid()` server-side — a user cannot check another user's claim status
- The listing ID in the "Claim this page" link navigates to the claim form (Ticket 035) which performs its own server-side existence and status checks

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Happy path search + results tested in browser
- [ ] "Already claimed" state tested (seed a claimed listing)
- [ ] Empty results state tested
- [ ] Pre-filled query via `?q=` tested
- [ ] Unauthenticated redirect tested
- [ ] Mobile tested at 375px — stacked city select, full-width claim button
- [ ] Keyboard navigation tested — tab through results, claim buttons reachable
