# Ticket 041: Admin claim review page — approve/reject (/admin/claims/[id])

---

## Status

Backlog

## Phase

Phase 6: Admin Review and Verification

## Priority

P0 — Critical

## Estimate

L (4–8h)

## Feature Area

Admin / Claims

---

## Context

Admin staff must be able to view full claim details and make an approve-or-reject decision from a dedicated review page. The claims queue (Ticket 040) surfaces the list; this ticket builds the individual claim review page at `/admin/claims/[id]`.

Approval is a five-step atomic transaction: it sets the claim to `approved`, assigns the listing's `owner_user_id`, inserts an `owner` row in `user_roles`, writes to `admin_audit_log`, and sends a Resend approval email to the claimant. Rejection requires a reason and triggers a rejection email.

Verification documents are stored in the private `verification-docs` Supabase Storage bucket. Signed URLs must be generated per-click with a 15-minute expiry using the `getVerificationDocUrl` Server Action — they must never be preloaded or persisted.

Sources: `docs/blacqlist/ux/mvp-screen-map.md` § Admin Claim Review; `docs/blacqlist/architecture/api-contract.md` §§ Admin endpoints; `docs/blacqlist/architecture/server-actions-plan.md` §§ 4, 7; `docs/blacqlist/ux/empty-loading-error-success-states.md` § 14.4.

---

## User Story

As an admin, I want to review a claim submission in full detail and approve or reject it with a single action, so that legitimate owners are granted ownership quickly and bad-faith claims are declined with a documented reason.

---

## Scope

**In scope:**

- `app/admin/claims/[id]/page.tsx` — Server Component, admin-only
- Left panel: claimant info (display_name, email, relationship_to_business, verification_notes, submitted_at)
- Right panel: listing preview (name, city, category, current trust_tier badge, current owner if any, "View live page →" link)
- Document section: list of uploaded document file names; each "View document" button calls `getVerificationDocUrl` SA on click and opens the signed URL in a new tab; signed URLs are never preloaded
- Claim history section: status change timeline rendered below the two panels
- "Approve claim" button: opens a `ConfirmDialog` → on confirm calls `approveClaim` SA
- "Reject claim" button: expands an inline panel with a required `Textarea` labeled "Reason for rejection (sent to claimant)" → "Confirm Rejection" calls `rejectClaim` SA
- Both action buttons: disabled with spinner during execution; success toast after completion; redirect to `/admin/claims` on success
- Breadcrumb: `Admin / Claims / [Claimant Name]'s claim for [Listing Name]`
- Loading skeleton: claimant info block + listing preview block + document area skeletons
- Error state: if claim ID not found, render branded 404 via `notFound()`

**Out of scope:**

- Claims list table (Ticket 040)
- Inline approve from the queue table (Ticket 040)
- Verification tier upgrade after claim approval (V1 — `updateVerificationStatus`)
- Admin editing of claim data

---

## Dependencies

| Dependency                                                                | Type            | Status                     |
| ------------------------------------------------------------------------- | --------------- | -------------------------- |
| Ticket 040 — Admin claims queue page                                      | Blocking ticket | Not started                |
| Ticket 037 — Admin shell + auth middleware                                | Blocking ticket | Not started                |
| `approveClaim` SA — `lib/actions/admin/approveClaim.ts`                   | Server Action   | Not started                |
| `rejectClaim` SA — `lib/actions/admin/rejectClaim.ts`                     | Server Action   | Not started                |
| `getVerificationDocUrl` SA — `lib/actions/admin/getVerificationDocUrl.ts` | Server Action   | Not started                |
| `admin_audit_log` table migration                                         | Database        | Must exist                 |
| `verification-docs` Supabase Storage bucket                               | Infrastructure  | Must be configured private |
| Resend `claimApproved` and `claimRejected` email templates                | Email           | Must exist                 |

---

## UX Notes

- **Screen:** Admin Claim Review — `docs/blacqlist/ux/mvp-screen-map.md` § Admin Claims Queue / Admin Claim Review
- **Route:** `/admin/claims/[id]`
- **Layout:** Admin panel — two-column on desktop (left: claim details, right: listing preview), stacked single-column on mobile
- **Entry points:** "Review" button on `/admin/claims` table row
- **Exit points:** Redirect to `/admin/claims` after approve or reject; breadcrumb link back to `/admin/claims`
- **Loading state:** Skeleton placeholders for claimant info block, listing preview block, and document list area — all must match loaded layout shape
- **Mobile behavior:** Two panels stack vertically; action buttons are full-width below both panels; rejection textarea expands below the buttons
- **Document viewing:** Clicking "View document" calls the SA, shows a brief spinner on the button, then opens the signed URL in a new tab. If the SA fails, show an inline error: "Couldn't load document. Try again." Do not expose the signed URL in the DOM before the user clicks.

**States from `empty-loading-error-success-states.md` § 14.4:**

- Loading: skeleton for claimant info, listing preview, document area
- Approve loading: "Approve" disabled with spinner; "Reject" also disabled
- Approve success: toast "Claim approved. [Claimant name] is now the owner of [Listing name]. A confirmation email has been sent." → redirect to `/admin/claims`
- Reject loading: "Reject" disabled with spinner after reason entered
- Reject success: toast "Claim rejected. [Claimant name] has been notified." → redirect to `/admin/claims`
- Action failure: persistent toast "Action failed. Try again." — buttons re-enable

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components:** shadcn/ui `Card`, `Button` (default for Approve, destructive for Reject), `Textarea`, `Dialog` (ConfirmDialog for Approve), `Badge`, `Breadcrumb`, `Skeleton`
- **Approve button:** Amber Gold (`#E2A428`) — large, prominent, full-width on mobile
- **Reject button:** Destructive variant (red) — clearly subordinate to Approve on desktop; same size on mobile
- **Trust tier badge:** Rendered using the existing `TrustBadge` component — `unclaimed` in gray, `claimed` in Amber Gold
- **Layout:** `grid grid-cols-1 lg:grid-cols-2 gap-6` for the two panels; action row below with `flex gap-4`
- **Breadcrumb:** Linked, using `text-sm` in Quicksand — `Admin` → `Claims` → `[Claimant Name]'s claim`
- **States to implement:** Loading (skeleton), Idle (ready), Approve loading, Approve success, Reject (form expanded), Reject loading, Reject success, Action error

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `listing_claims`, `listings`, `profiles`, `user_roles`, `admin_audit_log`
- **Entities involved:** `listing_claims`, `listings`, `listing_details_business`, `profiles`, `user_roles`, `admin_audit_log`
- **Operations:**
  - SELECT claim record joined to listing record and claimant profile
  - `approveClaim`: UPDATE `listing_claims.status = 'approved'`, UPDATE `listings.owner_user_id`, UPDATE `listings.trust_tier = 'claimed'`, INSERT `user_roles` (role=owner), INSERT `admin_audit_log`
  - `rejectClaim`: UPDATE `listing_claims.status = 'rejected'`, UPDATE `listing_claims.rejection_reason`, INSERT `admin_audit_log`
  - `getVerificationDocUrl`: generates signed URL via service_role — no DB write; audit log entry (`verification_doc_viewed`)
- **Validation rules:**
  - `rejection_reason`: required for reject; min 10 chars; max 1000 chars
  - Claim must be in `pending` or `under_review` status — cannot approve/reject an already-resolved claim
- **RLS policies:** Admin-only; all claim and listing data visible via service_role or admin RLS policy
- **Migration required:** No — existing tables; `admin_audit_log` migration in Ticket 012

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` → Section 9 Admin + server-actions-plan.md §§ 4, 7

**Server Actions involved:**

| Action                  | File                                         | What it does                                                                                                                                                                |
| ----------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `approveClaim`          | `lib/actions/admin/approveClaim.ts`          | 5-step atomic: set claim approved, set listing.owner_user_id, insert user_roles owner row, insert audit log entry (`claim_approved`), send `claimApproved` email via Resend |
| `rejectClaim`           | `lib/actions/admin/rejectClaim.ts`           | Set claim rejected, store rejection_reason, insert audit log entry (`claim_rejected`), send `claimRejected` email with reason                                               |
| `getVerificationDocUrl` | `lib/actions/admin/getVerificationDocUrl.ts` | Generate 15-min signed URL via service_role; log `verification_doc_viewed` to audit log; return `{ url: string }`                                                           |

**Auth required:** Yes — Admin role only (verified server-side via `user_roles`)

**`approveClaim` success response:** `{ data: { claim_id, listing_id, new_owner_user_id } }`

**`rejectClaim` request shape:** `{ claim_id: string, rejection_reason: string }`

**Error codes to handle:**

| Code                        | Condition              | UI shows                                                                     |
| --------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| `AUTH_REQUIRED`             | Session expired        | Redirect to `/sign-in?next=[current-url]`                                    |
| `FORBIDDEN`                 | Not an admin           | Redirect to `/dashboard`                                                     |
| `NOT_FOUND`                 | Claim ID invalid       | Branded 404 via `notFound()`                                                 |
| `INVALID_STATUS_TRANSITION` | Claim already resolved | Toast: "This claim has already been resolved." — disable both action buttons |
| `OPERATION_FAILED`          | DB error               | Persistent toast: "Action failed. Try again." — buttons re-enable            |

---

## Implementation Notes

**Files to create:**

- `app/admin/claims/[id]/page.tsx` — Server Component; fetches claim + listing + claimant profile; passes to client components
- `components/admin/claims/ClaimDetailPanel.tsx` — left panel: claimant info + documents + history
- `components/admin/claims/LinkedListingPreview.tsx` — right panel: listing summary card
- `components/admin/claims/ClaimActionBar.tsx` — "use client"; Approve + Reject buttons with SA calls
- `components/admin/claims/RejectPanel.tsx` — "use client"; inline rejection reason textarea + confirm button
- `lib/actions/admin/approveClaim.ts` — Server Action (7-step pattern)
- `lib/actions/admin/rejectClaim.ts` — Server Action (7-step pattern)
- `lib/actions/admin/getVerificationDocUrl.ts` — Server Action (returns signed URL via service_role)

**Files to modify:**

- `app/admin/claims/page.tsx` — "Review" button links to `/admin/claims/[id]` (if not already)

**Key patterns:**

- Follow the 7-step Server Action pattern from `server-actions-plan.md` § 3 for all three SAs
- `approveClaim` must be an atomic transaction: use a Supabase RPC function or execute all DB writes within a single service_role client block; roll back all writes if any step fails
- `insertAuditLog` called in Step 5 (after confirmed DB write); uses `sanitizeState` to strip `doc_paths` before snapshot
- `getVerificationDocUrl` must log `verification_doc_viewed` to audit log but **never** log the signed URL itself — log only `{ claim_id, document_index }`
- After `approveClaim` succeeds: call `revalidatePath('/[citySlug]/business/[listingSlug]')` to update the trust_tier badge on the public listing page
- `sendNotificationEmail` called in Step 5 (non-blocking; errors caught and logged)
- Use `isActionError` type guard in `ClaimActionBar` to branch on result

**Do not:**

- Preload or cache signed URLs — generate them only on explicit user click
- Log signed URLs to console or audit log
- Allow approve/reject if the claim is already `approved` or `rejected` — guard in the SA and disable buttons in the UI for resolved claims
- Execute approve/reject without the ConfirmDialog or rejection reason (respectively)

---

## Acceptance Criteria

- [ ] Given a valid claim ID, when the page loads, then the claimant's name, email, relationship_to_business, and verification_notes are displayed in the left panel
- [ ] Given a valid claim ID, when the page loads, then the linked listing's name, city, category, trust_tier badge, and "View live page →" link are displayed in the right panel
- [ ] Given the claim has uploaded documents, when the admin clicks "View document", then `getVerificationDocUrl` is called, a brief spinner shows on the button, and the signed URL opens in a new tab within 2 seconds
- [ ] Given the signed URL SA returns an error, then the button re-enables and shows inline error "Couldn't load document. Try again." — no URL is exposed in the DOM
- [ ] Given the admin clicks "Approve claim" and confirms the dialog, then `approveClaim` is called; during execution both action buttons are disabled with a spinner
- [ ] Given `approveClaim` succeeds, then `listing.owner_user_id` is set, an `owner` row is inserted in `user_roles`, `admin_audit_log` records `claim_approved`, a `claimApproved` email is sent via Resend, the listing page ISR cache is revalidated, a success toast appears, and the admin is redirected to `/admin/claims`
- [ ] Given the admin clicks "Reject claim", then an inline rejection reason panel expands with a required Textarea; the "Confirm Rejection" button is disabled until the Textarea has at least 10 characters
- [ ] Given a rejection reason is entered and "Confirm Rejection" is clicked, then `rejectClaim` is called; on success the `admin_audit_log` records `claim_rejected` with the reason, a `claimRejected` email is sent, a success toast appears, and the admin is redirected to `/admin/claims`
- [ ] Given the claim is already `approved` or `rejected`, then both action buttons are disabled and a status badge shows the resolved state
- [ ] Given the claim ID does not exist, then `notFound()` is called and the branded 404 page is rendered
- [ ] Loading state: all three sections (claimant info, listing preview, documents) show matching skeleton placeholders while data fetches
- [ ] Mobile: two panels stack vertically; action buttons are full-width; rejection textarea is usable with an on-screen keyboard
- [ ] Breadcrumb: links to `/admin` and `/admin/claims` are functional

---

## Failure States

| Failure                            | Condition                                       | User sees                                                                               | Recovery                           |
| ---------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------- |
| Claim not found                    | Invalid or deleted claim ID                     | Branded 404 page via `notFound()`                                                       | Link to `/admin/claims`            |
| Approve SA DB error                | Transaction fails partway                       | Persistent toast: "Action failed. Try again." Buttons re-enable.                        | Retry                              |
| Approve SA: claim already resolved | Claim status is already approved or rejected    | Toast: "This claim has already been resolved." Both buttons disabled.                   | No recovery needed — navigate back |
| Reject SA: missing reason          | "Confirm Rejection" clicked with empty textarea | "Confirm Rejection" button remains disabled; inline validation: "A reason is required." | Enter reason text                  |
| Document URL SA fails              | Storage service unavailable                     | Inline: "Couldn't load document. Try again." — button re-enables                        | Retry click                        |
| Email send failure                 | Resend API down                                 | SA still succeeds; email failure logged server-side only; user sees success toast       | V1: dead-letter retry queue        |
| Session expired mid-action         | 401 from SA                                     | Redirect to `/sign-in?next=[current-url]`                                               | Re-authenticate                    |
| Non-admin accesses page            | User without admin role                         | Middleware redirect to `/dashboard`                                                     | N/A                                |

---

## Edge Cases

- Admin opens claim review in two tabs simultaneously and approves from both — second approval attempt returns `INVALID_STATUS_TRANSITION`; handle gracefully with toast
- Claimant submitted claim with no documents — document section shows "No documents submitted" instead of an empty list
- Claim's linked listing has been soft-deleted between claim submission and admin review — listing preview shows a "Listing removed" note; Approve button is disabled with tooltip "The listing no longer exists"
- Very long rejection reason (>1000 chars) — SA validates max length; Textarea shows character counter; error displayed inline
- Admin navigates away from the rejection panel mid-entry without submitting — no confirmation dialog needed (rejection not submitted); state resets on re-open
- `owner_user_id` is already set on the listing (e.g., from a prior approved claim) — `approveClaim` SA detects this and returns `LISTING_ALREADY_CLAIMED`; UI shows toast "This listing already has an owner" and disables Approve

---

## Accessibility Notes

- [ ] All interactive elements (buttons, textarea) are keyboard-reachable in logical tab order
- [ ] "Approve claim" dialog: focus moves to the dialog on open; focus returns to the Approve button on cancel
- [ ] Rejection panel: focus moves to the Textarea when the panel expands
- [ ] All form inputs and buttons have descriptive `aria-label` attributes (e.g., `aria-label="Rejection reason — required"`)
- [ ] Error states and success toasts use `role="alert"` or `aria-live="polite"` for screen reader announcement
- [ ] Skeleton loading elements use `aria-busy="true"` on the container during load
- [ ] "View document" buttons include the document index in their label: `aria-label="View verification document 1"`
- [ ] Disabled action buttons include `aria-disabled="true"` and a visible tooltip explaining why

---

## Security Notes

- **Signed URL security:** `getVerificationDocUrl` uses the service_role client to generate the URL. The URL is returned to the admin's browser only on explicit click — it is never preloaded, never stored in component state before click, and never logged. The SA logs only `{ claim_id, document_index }` to `admin_audit_log`.
- **Signed URL expiry:** 15 minutes. If the admin takes more than 15 minutes to open the URL, they must click "View document" again to generate a fresh URL.
- **Approval atomicity:** `approveClaim` must succeed or fail as a unit. If `INSERT user_roles` fails after `UPDATE listings.owner_user_id` has succeeded, the SA must roll back the listings update. Use a Supabase RPC or a DB transaction.
- **Admin-only enforcement:** Server-side — `user_roles` is queried to confirm `role IN ('admin', 'super_admin')` for the authenticated user. Middleware also enforces the `/admin/*` route guard, but the SA independently verifies the role.
- **Audit log:** The `admin_audit_log` INSERT uses the service_role client and cannot be suppressed by RLS. `sanitizeState` strips `doc_paths` from `before_state`/`after_state` snapshots.

---

## QA Test Cases

| ID   | Test                                 | Steps                                                                                                                                                                                                                           | Expected                                                                                                                                                                                                                                       |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-1 | Happy path: approve claim            | 1. Log in as admin. 2. Navigate to `/admin/claims`. 3. Click "Review" on a pending claim. 4. Verify claimant info, listing preview, and document list display correctly. 5. Click "Approve claim". 6. Confirm the dialog.       | Claim set to approved. `user_roles` row inserted for claimant. `admin_audit_log` entry created. Approval email sent (check Resend logs). Public listing page trust_tier badge updated. Admin redirected to `/admin/claims` with success toast. |
| QA-2 | Happy path: reject claim with reason | 1. Navigate to a pending claim review. 2. Click "Reject claim". 3. Verify rejection panel expands. 4. Leave textarea empty — verify "Confirm Rejection" is disabled. 5. Enter reason (20+ chars). 6. Click "Confirm Rejection". | Claim set to rejected with reason stored. `admin_audit_log` entry created. Rejection email sent with reason. Admin redirected to `/admin/claims` with success toast.                                                                           |
| QA-3 | Document viewing                     | 1. Navigate to a claim with uploaded documents. 2. Click "View document".                                                                                                                                                       | Brief spinner on button. Signed URL opens in a new tab. URL is not present in page DOM before click.                                                                                                                                           |
| QA-4 | Already-resolved claim               | 1. Navigate to a claim with `status = 'approved'`.                                                                                                                                                                              | Both action buttons are disabled. A status badge shows "Approved". No approve/reject actions are possible.                                                                                                                                     |
| QA-5 | Concurrent approval                  | 1. Open the same claim in two admin browser tabs. 2. Approve from tab 1. 3. Approve from tab 2.                                                                                                                                 | Tab 2 receives `INVALID_STATUS_TRANSITION` error. Persistent toast: "This claim has already been resolved."                                                                                                                                    |
| QA-6 | Permission boundary                  | 1. Log in as an owner (non-admin). 2. Attempt to navigate to `/admin/claims/[id]`.                                                                                                                                              | Middleware redirects to `/dashboard`. Page is not rendered.                                                                                                                                                                                    |
| QA-7 | Mobile at 375px                      | 1. Open on a 375px viewport. 2. Scroll through the page. 3. Attempt approve and reject.                                                                                                                                         | Two panels stack vertically. Action buttons are full-width. Rejection textarea is usable. No horizontal overflow.                                                                                                                              |

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] `approveClaim` SA tested: claim approved, user_roles row inserted, audit log written, email sent, ISR cache revalidated
- [ ] `rejectClaim` SA tested: claim rejected, reason stored, audit log written, email sent
- [ ] `getVerificationDocUrl` SA tested: signed URL generated; URL not present in DOM until click; audit log entry written
- [ ] Signed URL never logged to console or audit log
- [ ] Atomic approval tested: if user_roles INSERT fails, listings.owner_user_id update is rolled back
- [ ] Already-resolved claim state: both buttons disabled
- [ ] Error states tested (SA failure, document URL failure, session expiry)
- [ ] Mobile tested at 375px — panels stack, buttons full-width, keyboard usable
- [ ] Keyboard navigation tested — confirm dialog, rejection panel focus management
- [ ] Accessibility: aria-labels on all action buttons, role="alert" on toasts
