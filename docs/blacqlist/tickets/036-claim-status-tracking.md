# Ticket 036: Claim Status Tracking Page (/account/claims)

## Status

Backlog

## Phase

Phase 5: Submit / Claim / Manage Foundation

## Priority

P2

## Feature Area

Core Workflow / Claim / Account

## Context

After submitting a claim, business owners need a way to track the review status without contacting support. This page surfaces all of the current user's claims — their status, timeline, and available actions (withdraw or resubmit). It is also the landing target for the "View your claim status" link in confirmation screens and email notifications. Without this page, claimants are left with no visibility into whether their claim is progressing. Source: `docs/blacqlist/ux/mvp-screen-map.md` (Account Screens); `docs/blacqlist/architecture/api-contract.md` Section 5 endpoint 25 (`GET /api/claims/status`); `docs/blacqlist/architecture/server-actions-plan.md` `withdrawClaim` action; `docs/blacqlist/data/database-schema-plan.md` claims table.

## User Story

As a business owner who has submitted a claim, I want to see all my pending and past claims with their current status and available actions, so that I know where my ownership request stands without needing to contact support.

## Scope

**In scope:**

- `app/account/claims/page.tsx` — Server Component; fetches all claims for `auth.uid()` from `GET /api/claims/status` (list variant) or direct Supabase query; renders list; handles auth guard
- For each claim, display:
  - Listing name + cover thumbnail (64×64px or branded placeholder)
  - Claim status badge: Pending (yellow), Under Review (blue), Approved (green), Rejected (red), Withdrawn (gray)
  - Submitted date formatted as "Submitted [Month D, YYYY]"
  - Status message (contextual per status — see below)
  - Conditional action buttons (see below)
- Status messages per claim status:
  - `pending`: "Your claim is in the queue. We review claims within 3–5 business days."
  - `under_review`: "An admin is reviewing your claim. You'll be notified at [email] when a decision is made."
  - `approved`: "Your claim was approved. You now own this listing."
  - `rejected`: "[rejection_reason from claim record]. You can resubmit with updated documentation."
  - `withdrawn`: "You withdrew this claim on [withdrawn date]."
- Conditional action buttons:
  - `pending` or `under_review`: "Withdraw claim" ghost button — calls `withdrawClaim` SA; confirmation dialog before firing
  - `approved`: Amber Gold "View your dashboard →" button → `/dashboard`
  - `rejected`: "Resubmit claim →" Amber Gold link → `/claim/[listing-id]`
  - `withdrawn`: no action button
- Withdraw confirmation dialog: shadcn/ui `Dialog` — "Are you sure you want to withdraw your claim for [Listing Name]? This cannot be undone." Two buttons: "Withdraw" (red destructive) and "Cancel"
- Empty state: heading "No claims submitted yet", body "Find a business to claim and get started.", Amber Gold CTA "Claim a listing →" → `/claim`
- Page heading: "My Claims" with claims count badge `([N])`
- Loading: skeleton list (2 claim row placeholders)

**Out of scope:**

- Admin claim management (Ticket 040)
- Editing a submitted claim (not supported at MVP)
- Claim appeal workflow (post-MVP)
- `GET /api/claims/status?listing_id=` single-listing check (used in Ticket 034; not the list view)

## Dependencies

| Dependency                                                 | Type            | Status                                          |
| ---------------------------------------------------------- | --------------- | ----------------------------------------------- |
| Ticket 035 (claim form)                                    | Blocking ticket | Users arrive from claim submission confirmation |
| Ticket 011 (engagement tables migration — `claims` table)  | Blocking ticket | Claims data must exist in DB                    |
| `withdrawClaim` SA (`lib/actions/claims/withdrawClaim.ts`) | Code dependency | Must exist; follows seven-step pattern          |
| Ticket 015 (auth middleware)                               | Blocking ticket | Route requires authenticated session            |

## UX Notes

- **Screen:** Account → My Claims — route `/account/claims`
- **Flow reference:** `docs/blacqlist/ux/mvp-screen-map.md` Account Screens; follows from Ticket 035 claim confirmation
- **Entry points:** Claim form success screen "Track your claim →"; `CLAIM_ALREADY_OPEN` error banner link; claim approval / rejection email notification links; account sidebar nav "Claims" item
- **Exit points:** "View your dashboard →" (`approved` claims); "Resubmit claim →" (`rejected` claims, routes back to `/claim/[listing-id]`); "Claim a listing →" (empty state)
- **Mobile behavior (375px):**
  - Each claim row: vertical stacked layout — thumbnail top-left, name + badge row, status message, action button full-width below
  - "Withdraw claim" button: minimum 48px height
  - Withdraw confirmation dialog: full-screen bottom sheet or standard centered dialog (same as Ticket 035 pattern)

## Design Notes

- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Components to use:** shadcn/ui `Card`, `Badge`, `Button`, `Dialog`, `Skeleton`
- **Layout:** Dashboard sidebar layout (shared with `/account/saved`, `/account/settings`); sidebar nav item "Claims" active; main content area `max-w-3xl`
- **Claim status badge colors:**
  - `pending`: `bg-yellow-100 text-yellow-800`
  - `under_review`: `bg-blue-100 text-blue-800`
  - `approved`: `bg-green-100 text-green-800`
  - `rejected`: `bg-red-100 text-red-800`
  - `withdrawn`: `bg-gray-100 text-gray-500`
- **Claim row layout:** `Card` with `CardContent` — horizontal flex on desktop (`gap-4`), stacked on mobile; thumbnail left 64×64, content right; action buttons below content
- **Empty state:** Centered in main content area — icon (empty inbox or similar), heading, body, CTA button
- **Withdrawal confirmation dialog:** red `Button` variant `destructive` for confirm; standard `Button` variant `outline` for cancel
- **States to implement:** Loading (skeleton), Empty, List (one or more claims), Withdrawal confirmation (dialog), Post-withdrawal (claim status updates to `withdrawn` in the list with optimistic UI)

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `claims`, `listings`
- **Entities involved:** `claims` (SELECT, UPDATE via `withdrawClaim`), `listings` (JOIN for name + cover thumbnail)
- **Operations:**
  - SELECT: `claims WHERE claimant_user_id = auth.uid() AND deleted_at IS NULL ORDER BY submitted_at DESC`
  - JOIN: `listings` for `name`, `cover_image_path`, `slug`, `city_id`
  - UPDATE: `claims SET status = 'withdrawn'` via `withdrawClaim` SA
- **Validation rules:** Only claims owned by `auth.uid()` are returned — enforced by RLS and server-side query scope
- **RLS policies:** `authenticated` SELECT: `claimant_user_id = auth.uid()` — users can only see their own claims. `authenticated` UPDATE: not permitted directly — use `withdrawClaim` SA with service role
- **Migration required:** No — `claims` table created in Ticket 011

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` → Section 5 endpoint 25 (`GET /api/claims/status`), endpoint 26 (`withdrawClaim` SA)
- **Endpoints involved:**
  - `GET /api/claims/status` (or direct Supabase query in Server Component) — fetches all claims for current user
  - `withdrawClaim` SA (`lib/actions/claims/withdrawClaim.ts`) — transitions claim to `withdrawn`
- **Auth required:** Yes — Supporter
- **Request shape (withdrawClaim SA):** `{ claim_id: string }`
- **Response shape:** `ActionResult<void>`
- **Error codes to handle:**
  - `INVALID_STATUS_TRANSITION` (422) — claim is already approved/rejected; show: "This claim can no longer be withdrawn."
  - `NOT_FOUND` (404) — claim not found; show: "Claim not found. It may have already been withdrawn."
  - `AUTH_REQUIRED` (401) — redirect to sign-in
  - `SERVER_ERROR` (500) — "Withdrawal failed. Please try again."

## Implementation Notes

**Files to create:**

- `app/account/claims/page.tsx` — Server Component; fetches claims list; renders `ClaimsList` with claim data
- `app/account/claims/_components/ClaimsList.tsx` — Client Component; renders list with withdraw dialog and SA call
- `app/account/claims/_components/ClaimRow.tsx` — individual claim row component
- `lib/actions/claims/withdrawClaim.ts` — Server Action following the seven-step pattern

**Files to modify:**

- Account sidebar navigation component — add "Claims" link if not already present

**Key patterns for `withdrawClaim` SA:**

```typescript
// Step 1: getUser
// Step 2: safeParse { claim_id: z.string().uuid() }
// Step 3: Verify ownership — SELECT id FROM claims WHERE id = $claim_id AND claimant_user_id = auth.uid()
//   If not found: return NOT_FOUND
// Step 4: Verify status is withdrawable — status IN ('pending', 'under_review')
//   If status is 'approved' or 'rejected': return INVALID_STATUS_TRANSITION
// Step 5: UPDATE claims SET status = 'withdrawn', updated_at = now()
// Step 6: No cache invalidation (claims are not on public ISR-cached pages)
// Step 7: Return { data: undefined }
```

- Optimistic UI for withdrawal: update the claim status to `withdrawn` in local state immediately on button click (before SA returns); roll back if SA returns error
- The `rejection_reason` field from the claims table is displayed directly in the status message for rejected claims — sanitize before rendering (use Next.js default escaping, not `dangerouslySetInnerHTML`)
- Cover image URL: generate from `cover_image_path` via `supabase.storage.from('listing-media').getPublicUrl(path)` in the Server Component; pass pre-generated URL to client

**Do not:**

- Expose `verification_doc_paths` to the client — the claimant should not see their document storage paths
- Allow `status` to be set to anything other than `'withdrawn'` from this page — all other transitions are admin-only
- Show rejection reason from other users' claims — RLS ensures this cannot happen, but verify the query scope

## Acceptance Criteria

- [ ] Given an authenticated user navigates to `/account/claims`, all their claims render with status badge, submitted date, listing name, and contextual status message
- [ ] Given a claim has `status = 'pending'`, a "Withdraw claim" ghost button is visible; clicking it opens the confirmation dialog
- [ ] Given the user confirms withdrawal in the dialog, the claim row status updates to "Withdrawn" with optimistic UI and the action button disappears
- [ ] Given a claim has `status = 'approved'`, an Amber Gold "View your dashboard →" button links to `/dashboard`
- [ ] Given a claim has `status = 'rejected'`, the rejection reason is displayed and a "Resubmit claim →" link is present routing to `/claim/[listing-id]`
- [ ] Given the user has no claims, the empty state renders with heading "No claims submitted yet" and "Claim a listing →" CTA
- [ ] Given `withdrawClaim` SA returns `INVALID_STATUS_TRANSITION`, an error toast shows: "This claim can no longer be withdrawn."
- [ ] On mobile at 375px, each claim row stacks vertically with the action button full-width below the status message

## Failure States

| Failure                   | Condition                                                           | User sees                                                                             | Recovery                                                       |
| ------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Withdrawal server error   | `withdrawClaim` returns `SERVER_ERROR`                              | Toast: "Withdrawal failed. Please try again." — optimistic update rolled back         | Retry button in toast; claim status restored to previous in UI |
| INVALID_STATUS_TRANSITION | Claim already approved or rejected                                  | Toast: "This claim can no longer be withdrawn."                                       | No action — user acknowledged                                  |
| Claims fetch failure      | Server Component Supabase query fails                               | Next.js `error.tsx` with "Something went wrong" + retry                               | User refreshes page                                            |
| Listing deleted           | Associated listing was removed between claim submission and viewing | Claim row shows "[Listing Unavailable]" as the name; no thumbnail; status still shown | No recovery needed — claim status is still informative         |

## Edge Cases

- User has many claims (e.g., a consultant who helps multiple businesses): paginate at 20 claims; show Load More button
- Multiple claims for the same listing (rejected then resubmitted): both appear in the list ordered by `submitted_at DESC` — the older rejected claim shows below the newer pending claim
- User attempts to access `/account/claims` without authentication: middleware redirects to `/sign-in?next=/account/claims`
- Claim status updated by admin while user is viewing the page (e.g., claim approved while page is open): status shown is the state at page load; user must refresh to see updates — acceptable at MVP

## Accessibility Notes

- [ ] Each claim row has a descriptive accessible region: `<article aria-label="[Listing Name] claim — [status]">`
- [ ] Status badges use text labels alongside color — not color alone
- [ ] The withdrawal confirmation dialog traps focus when open; Cancel button is the default focus target; Escape key closes the dialog and cancels
- [ ] Optimistic status update after withdrawal is announced via `aria-live="polite"`: "[Listing Name] claim withdrawn."
- [ ] Empty state heading is an `<h2>` within the main content area

## QA Test Cases

| ID   | Test                  | Steps                                                                            | Expected                                                                 |
| ---- | --------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| QA-1 | Pending claim visible | Sign in as user with a pending claim → navigate to `/account/claims`             | Claim row shows "Pending" badge, submitted date, "Withdraw claim" button |
| QA-2 | Withdraw happy path   | Claim list with `status: 'pending'` → click "Withdraw claim" → confirm in dialog | Claim status updates to "Withdrawn" in UI; SA confirms status in DB      |
| QA-3 | Approved claim        | Sign in as user with approved claim                                              | Row shows "Approved" badge and "View your dashboard →" Amber Gold button |
| QA-4 | Rejected claim        | Sign in as user with rejected claim that has a rejection reason                  | Rejection reason text displayed; "Resubmit claim →" link present         |
| QA-5 | Empty state           | Sign in as user with no claims                                                   | Empty state with heading and "Claim a listing →" CTA renders             |

## Security Notes

- The page and all SA calls are scoped by `auth.uid()` — a user can never see, withdraw, or modify another user's claims
- `rejection_reason` is shown to the claimant — ensure it is HTML-escaped before rendering (Next.js default escaping handles this when using JSX)
- `verification_doc_paths` array from the claims record must never be returned to the client — omit from any query response
- `withdrawClaim` SA uses the authenticated Supabase client with a server-side ownership check — not service_role (no need to bypass RLS for this operation)

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Pending, under_review, approved, rejected, and withdrawn states each tested with seeded data
- [ ] Withdrawal flow tested end-to-end (confirm → status updates in DB)
- [ ] INVALID_STATUS_TRANSITION error tested
- [ ] Empty state tested (user with no claims)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation through claim rows and dialog tested
