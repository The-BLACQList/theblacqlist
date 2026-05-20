# Ticket 035: Claim Form and Verification Document Upload (/claim/[listing-id])

## Status

Backlog

## Phase

Phase 5: Submit / Claim / Manage Foundation

## Priority

P1

## Feature Area

Core Workflow / Claim

## Context

After a business owner finds their listing on the claim entry page (Ticket 034), they must complete the claim verification form to submit an ownership claim. This form collects the claimant's relationship to the business, contact details, and an optional verification document. On submission, the claim record is created in the database and enters the admin review queue (Ticket 040). This page is the second and final step of the user-facing claim flow. Source: `docs/blacqlist/ux/mvp-screen-map.md` Claim Form screen; `docs/blacqlist/ux/core-user-flows.md` Flow 9; `docs/blacqlist/architecture/api-contract.md` Section 5 endpoints 23–24; `docs/blacqlist/data/database-schema-plan.md` claims table; `docs/blacqlist/architecture/server-actions-plan.md` `createClaim` action.

## User Story

As a business owner, I want to complete the claim verification form for my listing and optionally upload a proof document, so that the BLACQList team can review and approve my ownership request.

## Scope

**In scope:**

- `app/claim/[listing-id]/page.tsx` — Server Component; validates `listing_id` param, fetches the listing, checks if listing is published, renders page or redirects
- `app/claim/[listing-id]/_components/ClaimForm.tsx` — Client Component; `react-hook-form` + `zod` validation
- **Listing preview card** at top: read-only card showing the listing being claimed — cover image thumbnail, business name, city, category, trust_tier badge. "Not this listing? Go back →" link (routes to `/claim`)
- **Claim form fields:**
  - `full_name` (text, required, max 100 chars): "Your full name"
  - `business_email` (email, required): "Email address associated with this business"
  - `business_phone` (tel, required, `inputMode="tel"`): "Phone number for this business"
  - `relationship_to_business` (required, shadcn/ui `Select`): options — Owner, Co-owner, Manager, Authorized Representative
  - `verification_document_upload` (optional, file input): "Upload proof of ownership — business license, utility bill, or website screenshot (optional but speeds up review)". `accept="image/jpeg,image/png,application/pdf"`, max 10MB. Calls `POST /api/upload` with `bucket=verification-docs`, `entity_id=[temp-uuid]`
- Document upload: shows file name + size after selection; progress bar during upload; "Remove" link to clear; upload errors shown inline
- Submit button: "Submit Claim" — Amber Gold, full-width on mobile. Calls `createClaim` SA
- Form-level error handling: if `CLAIM_ALREADY_OPEN` returned, show a full-width error banner: "You already have a pending claim for this listing. [View your claim status →]" (link to `/account/claims`)
- Confirmation state: after successful submit, replace form content with inline success state (no redirect): green checkmark icon, heading "Claim submitted.", body "We'll review your claim within 3–5 business days and notify you at [user.email]. Your listing page is available for visitors in the meantime.", two action links: "View your listing →" and "Track your claim →" (`/account/claims`)

**Out of scope:**

- Admin review of the claim (Ticket 040, 039)
- Claim approval or rejection emails (handled in admin actions)
- The claims status tracking page `/account/claims` (Ticket 036)
- Document preview for admins (Ticket 040 admin claims queue)

## Dependencies

| Dependency                                                | Type            | Status                                                                     |
| --------------------------------------------------------- | --------------- | -------------------------------------------------------------------------- |
| Ticket 034 (claim entry page)                             | Blocking ticket | Users arrive from the entry page; claim form depends on a valid listing_id |
| Ticket 030 (media upload Route Handler)                   | Blocking ticket | Document upload calls `POST /api/upload` with `bucket=verification-docs`   |
| Ticket 011 (engagement tables migration — `claims` table) | Blocking ticket | `createClaim` SA inserts into `claims` table                               |
| `createClaim` SA (`lib/actions/claims/createClaim.ts`)    | Code dependency | Must exist; follows seven-step pattern from `server-actions-plan.md`       |
| `lib/email/resend.ts` + `claimReceived` template          | Code dependency | `createClaim` SA sends notification email to admin on submit               |

## UX Notes

- **Screen:** `Claim Form` — `docs/blacqlist/ux/mvp-screen-map.md` Section 4 (Claim + Create Screens), Claim Form row
- **Flow reference:** `docs/blacqlist/ux/core-user-flows.md` → Flow 9, Steps 4–7
- **Entry points:** `/claim` search results "Claim this page" button → `/claim/[listing-id]`
- **Exit points:** Success → `/account/claims` (claim tracking) or `/[city-slug]/business/[slug]` (listing page); "Not this listing? Go back →" → `/claim`; `CLAIM_ALREADY_OPEN` → `/account/claims`
- **Mobile behavior (375px):**
  - Listing preview card: horizontal layout — thumbnail left (64×64px), text right; full-width
  - Form: single-column, all fields stacked; `relationship_to_business` select full-width
  - Document upload: full-width tap zone, minimum 64px tall; tap opens file picker; camera option for photos of documents (`capture="environment"`)
  - Submit button: full-width Amber Gold, 56px height, fixed at bottom or inline bottom of form

## Design Notes

- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Components to use:** shadcn/ui `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`, `Input`, `Select`, `Button`, `Card`, `Alert`
- **Layout:** Constrained content — `max-w-lg mx-auto px-4`; listing preview card full-width at top; form below; submit button at bottom
- **Listing preview card:** `rounded-lg border bg-[#FCFAF4] p-4` with flex row layout
- **Document upload zone:** dashed border `border-2 border-dashed border-[#E2A428] rounded-md p-4`, Cream background, upload icon + label text + accepted formats hint
- **Success state:** replaces form content — `flex flex-col items-center gap-4 py-8`; green checkmark SVG or `CheckCircle` icon in Lucide; heading Glacial Indifference `text-2xl`
- **Error banner (`CLAIM_ALREADY_OPEN`):** shadcn/ui `Alert` variant destructive; contains link to `/account/claims`
- **States to implement:** Default (form), Uploading (document upload progress), Submit loading (button spinner), Success (full replacement), Error (CLAIM_ALREADY_OPEN, SERVER_ERROR)

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `claims` table, `listings` table
- **Entities involved:** `claims` (INSERT), `listings` (SELECT — read to display preview card and validate listing exists + is claimable)
- **Operations:**
  - SELECT: `listings` JOIN `listing_details_business` WHERE `id = $listing_id AND status = 'published' AND deleted_at IS NULL`
  - INSERT: `claims` — fields: `listing_id`, `claimant_user_id` (from `auth.uid()`), `status = 'pending'`, `notes` (concatenation of `full_name`, `business_email`, `business_phone`, `relationship_to_business` as structured text), `verification_doc_paths` (array with uploaded path if any), `submitted_at = now()`
- **Validation rules:** `full_name` required min 2 max 100; `business_email` required valid email; `business_phone` required; `relationship_to_business` required one of the four enum values; document optional max 10MB, MIME must be `image/jpeg|image/png|application/pdf`
- **RLS policies:** `authenticated` INSERT into `claims` where `claimant_user_id = auth.uid()`. `authenticated` SELECT on `listings` for `status = 'published'` listings only
- **Migration required:** No — `claims` table created in Ticket 011

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` → Section 5 endpoints 23–24
- **Endpoints involved:**
  - `POST /api/upload` — document upload to `verification-docs` bucket (Ticket 030)
  - `createClaim` SA (`lib/actions/claims/createClaim.ts`) — creates claim record
- **Auth required:** Yes — Supporter
- **Request shape (createClaim SA):**
  ```typescript
  {
    listing_id: string,
    full_name: string,
    business_email: string,
    business_phone: string,
    relationship_to_business: 'owner' | 'co-owner' | 'manager' | 'representative',
    verification_doc_path?: string   // Storage path from prior upload, if any
  }
  ```
- **Response shape:** `ActionResult<{ claim_id: string, status: 'pending' }>`
- **Error codes to handle:**
  - `CLAIM_ALREADY_OPEN` (409) — full-width error banner with link to `/account/claims`
  - `LISTING_ALREADY_CLAIMED` (422) — show: "This listing has already been claimed by another user. If you believe this is an error, contact support."
  - `RATE_LIMITED` (429) — "You've reached the maximum number of pending claims. Please wait for one to be resolved before submitting a new one."
  - `AUTH_REQUIRED` (401) — redirect to `/sign-in?next=/claim/[listing-id]`
  - `NOT_FOUND` (404 from server) — show: "This listing could not be found. It may have been removed."
  - `SERVER_ERROR` (500) — "Submission failed. Please try again. Your information was not lost."

## Implementation Notes

**Files to create:**

- `app/claim/[listing-id]/page.tsx` — Server Component: fetches listing by `params.listingId`; returns `notFound()` if listing not found or `status != 'published'`; passes listing data to `ClaimForm`
- `app/claim/[listing-id]/_components/ClaimForm.tsx` — Client Component with form state, upload handling, SA call
- `lib/actions/claims/createClaim.ts` — Server Action following the seven-step pattern

**Files to modify:**

- `lib/validations/claim.ts` — create file with zod schema for the claim form

**Key patterns for `createClaim` SA:**

```typescript
// Step 1: getUser
// Step 2: safeParse input
// Step 3: Verify listing exists and is claimable
//   SELECT id, trust_tier, owner_user_id FROM listings WHERE id = $listing_id AND status = 'published' AND deleted_at IS NULL
//   If not found: return NOT_FOUND
//   If owner_user_id = auth.uid(): return LISTING_ALREADY_CLAIMED
// Step 4: Check for existing open claim
//   SELECT id FROM claims WHERE claimant_user_id = auth.uid() AND listing_id = $listing_id AND status IN ('pending', 'under_review')
//   If exists: return CLAIM_ALREADY_OPEN with existing claim_id
// Step 5: Check rate limit — max 3 open claims
//   SELECT COUNT(*) FROM claims WHERE claimant_user_id = auth.uid() AND status IN ('pending', 'under_review')
//   If count >= 3: return RATE_LIMITED
// Step 6: INSERT INTO claims
// Step 7: Send admin notification email (non-blocking)
// Step 8: Return { data: { claim_id, status: 'pending' } }
```

- Document upload: call `POST /api/upload` when file is selected (before form submit); store returned path in state; include path in `createClaim` SA payload
- Listing data: fetch in Server Component, pass as `listingData` prop to `ClaimForm` — do NOT re-fetch in the Client Component
- If listing `trust_tier` is already `'claimed'` or `'verified'`: show an inline banner at the top of the page: "This listing is already claimed. If you believe this is incorrect, contact support." — do not show the claim form

**Do not:**

- Allow `claimant_user_id` to be provided by the client — always set `auth.uid()` server-side
- Upload documents before the user's session is verified
- Show the raw document storage path in any response to the client
- Emit the claim submission email to the claimant in this SA — send admin notification only; claimant email is handled by the success state showing the user's email address

## Acceptance Criteria

- [ ] Given an authenticated user navigates to `/claim/[listing-id]` for a published, unclaimed listing, the listing preview card renders with the correct name, city, category, and trust_tier badge
- [ ] Given the form is submitted with valid required fields and no document, `createClaim` SA inserts a claim record with `status = 'pending'` and the success state renders
- [ ] Given the form is submitted after a document is uploaded, the `verification_doc_path` is included in the claim record (`verification_doc_paths` array has 1 item)
- [ ] Given the user already has an open claim for this listing, on submit the `CLAIM_ALREADY_OPEN` error banner renders with a link to `/account/claims`
- [ ] Given `listing_id` does not correspond to an existing published listing, the page returns Next.js `notFound()` (404 page)
- [ ] Given a user uploads a document exceeding 10MB, an inline error renders: "File must be under 10MB" — the upload does not proceed
- [ ] Given successful claim submission, the success state shows the user's email address in the confirmation message
- [ ] Given the listing already has `trust_tier = 'claimed'`, the form is hidden and an inline banner reads "This listing is already claimed"
- [ ] On mobile at 375px, the submit button is full-width and at minimum 56px tall

## Failure States

| Failure                 | Condition                                                       | User sees                                                                                         | Recovery                                            |
| ----------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| CLAIM_ALREADY_OPEN      | User already has pending or under_review claim for this listing | Error banner: "You already have a pending claim for this listing." with link to `/account/claims` | User views their existing claim status              |
| LISTING_ALREADY_CLAIMED | Listing already has an approved owner                           | Error banner: "This listing has already been claimed." with support contact                       | User contacts support if they believe it's an error |
| RATE_LIMITED            | User has 3+ open claims                                         | Error banner: "Maximum open claims reached. Resolve an existing claim first."                     | User waits for a claim to be resolved               |
| Document upload failure | Network error during upload                                     | Inline error below upload zone: "Upload failed. Try again." Retry button                          | User retries upload; form data not lost             |
| Document wrong type     | Non-image/non-PDF uploaded                                      | Inline error: "Accepted formats: JPG, PNG, PDF"                                                   | User selects correct file type                      |
| SERVER_ERROR on submit  | 500 from createClaim SA                                         | Error banner: "Submission failed. Please try again."                                              | Retry Submit button re-fires the SA                 |
| NOT_FOUND listing       | listing_id is invalid or listing deleted                        | Next.js `notFound()` — 404 page with "That page doesn't exist" + search bar                       | User searches for their listing again from `/claim` |

## Edge Cases

- User navigates directly to `/claim/[listing-id]` without going through the search page: the page renders normally (server component fetches the listing); "Not this listing? Go back →" links to `/claim` where they can search
- User's phone number in Step 3 of Add Business was entered in an unusual format: do not pre-fill `business_phone` from step 3 data — the claim form's `business_phone` is a fresh field requiring the business's public contact number
- Document upload succeeds but `createClaim` fails: the document is orphaned in `verification-docs` storage. At MVP, clean up is a manual admin task. Log the orphaned path in the server-side error log
- User submits the form while a document upload is still in progress: Submit button must be disabled while any upload is in progress; `aria-describedby` tooltip: "Wait for your document to finish uploading"
- Listing transitions from `unclaimed` to `claimed` between the user loading the page and submitting: `createClaim` SA checks `owner_user_id IS NULL` before inserting; returns `LISTING_ALREADY_CLAIMED`

## Accessibility Notes

- [ ] All form inputs have visible `<FormLabel>` elements — not placeholder-only
- [ ] The `relationship_to_business` Select has a descriptive label: "Your relationship to this business"
- [ ] The document upload input has a label describing accepted formats: `aria-describedby` pointing to "Accepted formats: JPG, PNG, PDF. Maximum 10MB."
- [ ] Error banners use `role="alert"` so they are announced immediately by screen readers when they appear
- [ ] The success state heading uses `<h1>` or `<h2>` and is announced as the new page state
- [ ] The Submit button disabled state (during upload) communicates via `aria-describedby`: "Finish uploading before submitting"
- [ ] "Not this listing? Go back →" is a proper `<a>` element — not a button

## QA Test Cases

| ID   | Test                       | Steps                                                                                     | Expected                                                                                               |
| ---- | -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| QA-1 | Happy path — no document   | Sign in → navigate to `/claim/[unclaimed-listing-id]` → fill all required fields → Submit | Claim record created with `status: 'pending'`; success state renders; user email shown in confirmation |
| QA-2 | Happy path — with document | Same as QA-1 but upload a valid PDF before Submit                                         | `verification_doc_paths` array has 1 item in the claims record; success state renders                  |
| QA-3 | Already claimed listing    | Navigate to `/claim/[claimed-listing-id]`                                                 | Page renders with "This listing is already claimed" banner; form is not shown                          |
| QA-4 | CLAIM_ALREADY_OPEN         | Submit claim for a listing that current user already has a pending claim on               | Error banner rendered: "You already have a pending claim"; link to `/account/claims` present           |
| QA-5 | Invalid listing_id         | Navigate to `/claim/[non-existent-uuid]`                                                  | Next.js 404 page renders                                                                               |

## Security Notes

- The document upload target is the `verification-docs` bucket which must be configured as **private** in Supabase Storage — no public access; only admin via service_role can retrieve documents
- Document storage path format: `claims/[claim_id]/[uuid].[ext]` — the `claim_id` segment ties the document to a specific claim record for admin retrieval
- At MVP, verification documents are uploaded with a temporary path prefix before the claim ID is known: use `claims/pending/[user_id]/[uuid].[ext]` and update the path after the claim record is created; or alternatively create the claim record first (without doc) and then update with the doc path in a second SA call
- `claimant_user_id` is always set to `auth.uid()` server-side; the client cannot supply a different user ID
- The `listing_id` from the URL is validated server-side for existence and correct status before any insert — path parameter manipulation is handled
- Rejection reason from a prior claim is never shown to the claimant on this page — it is private admin data

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Happy path tested (no doc and with doc)
- [ ] CLAIM_ALREADY_OPEN error tested (seed an open claim for the test user)
- [ ] LISTING_ALREADY_CLAIMED tested (seed a claimed listing)
- [ ] Document upload error tested (oversized file)
- [ ] Invalid `listing_id` 404 tested
- [ ] `createClaim` SA tested independently — confirm DB row in `claims` table
- [ ] Mobile tested at 375px — upload zone tap, full-width submit button
- [ ] Keyboard navigation through form tested
