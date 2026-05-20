# Ticket 040: Admin Claims Queue (/admin/claims)

## Status
Backlog

## Phase
Phase 6: Admin Review and Verification

## Priority
P0

## Feature Area
Admin / Claims

## Context
The admin claims queue is where the platform's ownership verification happens. Every claim submitted by a business owner (Ticket 035) lands here for admin review. Approving a claim triggers the ownership transfer — it sets `listings.trust_tier = 'claimed'`, assigns the `owner` role to the claimant, and sends the approval email. This is a P0 ticket because without the ability to approve claims, no business owner can take ownership of their listing and the platform's primary business owner workflow is blocked end-to-end. Source: `docs/blacqlist/ux/mvp-screen-map.md` Admin Claims Queue and Admin Claim Review screens; `docs/blacqlist/architecture/api-contract.md` Section 9 endpoints 45–48; `docs/blacqlist/data/database-schema-plan.md` claims table; `docs/blacqlist/architecture/server-actions-plan.md` `approveClaim` and `rejectClaim` actions.

## User Story
As a platform admin, I want to view and process ownership claims in priority order, mark claims under review, and approve or reject them, so that legitimate business owners can take control of their listings and fraudulent claims are prevented.

## Scope

**In scope:**
- `app/admin/claims/page.tsx` — Server Component; reads `searchParams` for status filter; fetches claims via service_role; passes data to Client Component
- `app/admin/claims/_components/AdminClaimsTable.tsx` — Client Component; table + filter + row actions
- **Table columns:** Claimant display name, Claimant email, Listing name + city, Claim status badge, Submitted date, Verification doc count badge (e.g., "2 docs"), Actions
- **Filter:** Status chips/tabs — All, Pending (default), Under Review, Approved, Rejected. Default view: `status = 'pending'`
- **Sort:** `created_at ASC` (oldest first — FIFO review order); column header click toggles `submitted_at` ASC/DESC
- **Pagination:** 25 rows/page; prev/next controls
- **Per-row actions:**
  - "Review" button → `/admin/claims/[id]`
  - "Mark Under Review" button (only for `status = 'pending'`) — calls `markClaimUnderReview` SA (inline status update); row badge updates to "Under Review"
  - "Approve" button (Amber Gold, for `status IN ('pending', 'under_review')`) — opens inline `ApproveClaimPopover`; calls `approveClaim` SA
- **`ApproveClaimPopover`:** confirms the claim approval — "Approve [Claimant Name]'s claim for [Listing Name]?" Two buttons: "Confirm Approve" (Amber Gold) and "Cancel". On confirm: `approveClaim` SA fired; row status badge updates to "Approved"; row remains in table (disappears after page refresh unless "Approved" filter is active)
- **Reject is NOT available as an inline table action:** admin must click "Review" to navigate to `/admin/claims/[id]` to reject (rejection requires a mandatory reason — Ticket 040 note: the claim detail view is also in scope for this ticket)
- **`/admin/claims/[id]` — Admin Claim Review detail page:**
  - `app/admin/claims/[id]/page.tsx` — Server Component; fetches claim record + linked listing + claimant profile + doc count
  - Two-panel layout on desktop: left panel = claimant info + verification data; right panel = linked listing preview
  - Left panel: claimant display name, email, submitted date, `relationship_to_business` (if captured in notes), formatted `notes` field showing structured claim data, verification doc count + "View document [N]" button per doc (calls `getVerificationDocUrl` SA to generate a signed URL, opens in new tab)
  - Right panel: listing cover image, name, city, category, description excerpt, trust_tier badge, "View live listing →" link
  - Approve button (Amber Gold, full-width on mobile): calls `approveClaim` SA; on success shows inline confirmation: "Claim approved — [Claimant Name] is now the owner of [Listing Name]."
  - Reject panel (expandable below Approve): "Reject Claim" button (red) expands `Textarea` "Reason for rejection (sent to claimant via email)" (required, max 500 chars) + "Confirm Rejection" red button; calls `rejectClaim` SA
  - Breadcrumb: `Admin / Claims / [Claimant Name]'s claim for [Listing Name]`
  - Back link: "← Back to claims queue"
- **Empty state for the claims queue:** heading "No pending claims" with a subtle success illustration or checkmark icon. This is a good empty state — an empty pending queue means the team is caught up. Body text: "You're all caught up. New claims will appear here." No CTA needed
- Loading: table skeleton (5 row placeholders)

**Out of scope:**
- Bulk claim approval (post-MVP — individual review is required for trust reasons)
- Automated claim approval (no AI/automated decision at MVP)
- Claim appeal workflow (post-MVP)
- The `verification-docs` bucket configuration (infrastructure — separate ops task)

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 037 (admin layout + auth guard) | Blocking ticket | Admin shell required |
| Ticket 035 (claim form) | Blocking ticket | Claims must exist in DB from user submissions |
| Ticket 011 (engagement tables migration — `claims` table) | Blocking ticket | `claims` table must exist |
| `approveClaim` SA (`lib/actions/admin/approveClaim.ts`) | Code dependency | Must exist; 5-step atomic transaction |
| `rejectClaim` SA (`lib/actions/admin/rejectClaim.ts`) | Code dependency | Must exist; writes rejection reason + sends email |
| `getVerificationDocUrl` SA (`lib/actions/admin/getVerificationDocUrl.ts`) | Code dependency | Required for "View document" links on claim detail page |
| Resend email integration + `claimApproved` / `claimRejected` templates | Infrastructure | Required for post-decision email notifications |

## UX Notes

- **Screen:** Admin Claims Queue — `docs/blacqlist/ux/mvp-screen-map.md` Admin Screens, Admin Claims Queue row; also Admin Claim Review row
- **Flow reference:** Admin Overview → "Claims pending review: [N]" → `/admin/claims`; Row "Review" → `/admin/claims/[id]`
- **Entry points:** Admin sidebar "Claims" nav link; Overview "Needs attention" claims pending link
- **Exit points:** "Review" → `/admin/claims/[id]`; Approve → stays on queue with updated row; claim detail → "← Back to claims queue" → `/admin/claims`
- **Mobile behavior (375px):**
  - Queue table: single column showing Claimant name + Listing name + status badge + Actions (full-width "Review" button only)
  - Inline approve hidden on mobile — admins must tap "Review" to proceed to the detail page for approve/reject
  - Claim detail: stacked (not two-panel); claimant info first, listing preview below, actions at bottom
  - Approve + Reject buttons: full-width stacked (Approve Amber Gold above, Reject red below)

## Design Notes

- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Components to use:** shadcn/ui `Table`, `TableRow`, `TableHead`, `TableCell`, `Badge`, `Button`, `Popover`, `Dialog`, `Textarea`, `Card`, `Separator`, `Skeleton`
- **Claim status badge colors:**
  - `pending`: `bg-yellow-100 text-yellow-800`
  - `under_review`: `bg-blue-100 text-blue-800`
  - `approved`: `bg-green-100 text-green-800`
  - `rejected`: `bg-red-100 text-red-700`
  - `withdrawn`: `bg-gray-100 text-gray-500`
- **Doc count badge:** `bg-[#E2A428]/20 text-[#E2A428] font-mono text-xs` — e.g., "2 docs"
- **"Mark Under Review" button:** `variant="outline"` (ghost with border) — secondary action
- **Approve button (popover):** `bg-[#E2A428] text-[#000000]`; popover with white background
- **Empty state:** Centered in main content area; subtle checkmark or inbox-zero illustration; heading "You're all caught up"; no CTA button
- **Claim detail — left panel:** `max-w-md w-full` Card; right panel: `max-w-md w-full` Card with listing thumbnail at top
- **States to implement:** Loading (skeleton), Loaded, Empty (pending filter), Approving (button spinner), Approved inline confirmation, Reject expanded panel

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `claims`, `listings`, `listing_details_business`, `profiles` (for display_name), `auth.users` (for email — admin access only)
- **Entities involved:** `claims` (SELECT + UPDATE), `listings` (JOIN for name + city), `profiles` (JOIN for claimant display_name), `auth.users` (email — admin-only via service_role), `user_roles` (INSERT on approval), `admin_audit_log` (INSERT via SAs), `moderation_queue` (UPDATE on approval — resolved)
- **Operations (server-side, service_role):**
  - SELECT: `claims JOIN listings JOIN profiles JOIN auth.users` (email from auth schema requires service_role)
  - UPDATE: `approveClaim` SA — 5 atomic steps (claims, listings, user_roles, moderation_queue, admin_audit_log)
  - UPDATE: `rejectClaim` SA — claims status + rejection_reason + audit log + email
  - UPDATE: `markClaimUnderReview` SA — simple `claims SET status = 'under_review'`
  - SELECT: `getVerificationDocUrl` SA — signed URL from `verification-docs` bucket (service_role storage client)
- **Validation rules:** `rejection_reason` required max 500 chars; `claim_id` required UUID; claim must be in correct status for each action
- **RLS policies:** All operations use service_role — bypasses RLS. Admin role enforced in `layout.tsx`
- **Migration required:** No

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` → Section 9 endpoints 45–48
- **Endpoints involved:**
  - `GET /api/admin/claims` — or direct service_role query in Server Component (preferred)
  - `approveClaim` SA (`lib/actions/admin/approveClaim.ts`)
  - `rejectClaim` SA (`lib/actions/admin/rejectClaim.ts`)
  - `getVerificationDocUrl` SA (`lib/actions/admin/getVerificationDocUrl.ts`)
  - `markClaimUnderReview` SA — not in API contract; create following seven-step pattern
- **Auth required:** Admin
- **Request shape (approveClaim SA):** `{ claim_id: string, notes?: string }`
- **Response shape:** `ActionResult<{ claim_id: string, status: 'approved', listing_id: string }>`
- **Error codes to handle:**
  - `INVALID_STATUS_TRANSITION` (422) — toast: "This claim cannot be approved in its current state."
  - `LISTING_ALREADY_OWNED` (409) — toast: "This listing already has an owner. Review the claim detail before proceeding."
  - `FORBIDDEN` (403) — unexpected (layout enforces this); log and show generic error
  - `SERVER_ERROR` — toast: "Action failed. Please try again."

**`approveClaim` atomic transaction steps (from API contract):**
1. `UPDATE claims SET status='approved', reviewed_by=auth.uid(), reviewed_at=now()`
2. `UPDATE listings SET trust_tier='claimed', owner_user_id=$claimant_user_id, claim_id=$claim_id`
3. `INSERT INTO user_roles (user_id=$claimant_user_id, role='owner', listing_id=$listing_id, granted_by=auth.uid())` ON CONFLICT DO NOTHING
4. `UPDATE moderation_queue SET status='resolved', resolved_at=now()` for this claim
5. `INSERT INTO admin_audit_log (...)`
6. Non-blocking: `sendNotificationEmail('claimApproved', { claimant_email, listing_name })`
Then: `revalidatePath('/[city-slug]/business/[listing-slug]')`

## Implementation Notes

**Files to create:**
- `app/admin/claims/page.tsx` — Server Component; fetches claims with joins
- `app/admin/claims/_components/AdminClaimsTable.tsx` — Client Component; table + filter tabs + row actions
- `app/admin/claims/_components/ApproveClaimPopover.tsx` — inline approve confirmation
- `app/admin/claims/[id]/page.tsx` — Server Component; fetches full claim + listing + claimant
- `app/admin/claims/[id]/_components/ClaimDetailPanel.tsx` — Client Component; two-panel layout + approve/reject actions
- `app/admin/claims/[id]/_components/RejectClaimPanel.tsx` — expandable reject form
- `lib/actions/admin/approveClaim.ts` — Server Action (5-step atomic transaction)
- `lib/actions/admin/rejectClaim.ts` — Server Action
- `lib/actions/admin/getVerificationDocUrl.ts` — Server Action (service_role storage signed URL)
- `lib/actions/admin/markClaimUnderReview.ts` — Server Action (simple status update)

**Files to modify:**
- `app/admin/overview/page.tsx` — confirm the "Claims pending review: [N]" count query uses the correct filter (`status IN ('pending', 'under_review')`)

**Key patterns for `getVerificationDocUrl` SA:**
```typescript
// lib/actions/admin/getVerificationDocUrl.ts
// STEP 1: getUser + admin role check
// STEP 2: safeParse { claim_id, doc_path }
// STEP 3: Verify doc_path is in the claim's verification_doc_paths array
//   SELECT verification_doc_paths FROM claims WHERE id = $claim_id AND status IN ('pending', 'under_review')
//   If not found or path not in array: return NOT_FOUND
// STEP 4: Generate signed URL using SERVICE ROLE storage client
//   const { data, error } = await serviceStorageClient
//     .storage.from('verification-docs')
//     .createSignedUrl(doc_path, 900)  // 900 seconds = 15 minutes
// STEP 5: Write audit log entry (doc_path NOT included in audit log snapshot)
// STEP 7: Return { data: { signed_url, expires_at } }
// CRITICAL: Never log signed_url. Never cache signed_url. Return it once.
```

**Do not:**
- Return `verification_doc_paths` array in any list or detail API response — return only `verification_doc_count` in the table view and generate signed URLs on demand in the detail view
- Cache signed URLs — they expire in 15 minutes and must be regenerated on every "View document" click
- Allow bulk approval from the table — each claim requires individual admin review to prevent fraudulent approval
- Expose the `notes` field (internal admin notes) in any email to the claimant — only `rejection_reason` is sent

## Acceptance Criteria

- [ ] Given an admin navigates to `/admin/claims`, the table renders with all claims filtered to `status = 'pending'` by default, sorted oldest-first
- [ ] Given the "Under Review" filter tab is selected, only claims with `status = 'under_review'` render
- [ ] Given an admin clicks "Mark Under Review" on a pending claim, the row's status badge updates to "Under Review" and the `markClaimUnderReview` SA is called
- [ ] Given an admin clicks "Approve" on a pending/under-review claim and confirms in the popover, `approveClaim` SA fires; the claim row's status badge updates to "Approved"; the linked listing's `trust_tier` in the DB is updated to `'claimed'`; the claimant receives an approval email
- [ ] Given no pending claims exist, the empty state renders: "You're all caught up." without a CTA
- [ ] Given an admin navigates to `/admin/claims/[id]`, the claim detail shows claimant name, email, submitted date, notes, and doc count; the linked listing preview shows name, city, category
- [ ] Given a verification document was uploaded with the claim, a "View document [N]" button calls `getVerificationDocUrl` SA and opens the signed URL in a new tab
- [ ] Given an admin submits a rejection reason on the claim detail page, `rejectClaim` SA is called; the claimant receives a rejection email with the reason
- [ ] The signed URL for verification documents expires after 15 minutes — it is not stored in the DB or logged
- [ ] On mobile at 375px, the queue table shows only claimant name, listing name, status, and a full-width "Review" button; inline approve is not available on mobile

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| INVALID_STATUS_TRANSITION on approve | Claim already approved or withdrawn | Toast: "This claim cannot be approved in its current state." | Admin reviews current status |
| LISTING_ALREADY_OWNED on approve | Listing already has a different owner | Toast: "This listing already has an owner." | Admin reviews listing + existing claim on detail page |
| Signed URL generation fails | Storage error in `getVerificationDocUrl` | Toast: "Couldn't load document. Try again." | Admin retries; button re-enabled |
| Rejection without reason | Admin submits rejection with empty textarea | Inline error: "Rejection reason is required" | Admin enters reason and resubmits |
| Network error during approve | `approveClaim` SA times out | Toast: "Approval failed. Please try again." | Admin retries; optimistic update reverted |
| Claims fetch failure | Service_role query fails | Next.js `error.tsx` with retry | Admin refreshes page |

## Edge Cases

- Claim for a listing that was soft-deleted between submission and admin review: `approveClaim` SA should check `listings.deleted_at IS NULL` before proceeding; return `NOT_FOUND` if the listing was deleted; admin sees "Listing no longer exists" in the detail view
- Admin approves a claim while another admin simultaneously approves it: second `approveClaim` call hits `LISTING_ALREADY_OWNED` — safe
- Claimant deleted their account between submitting the claim and admin review: `claimant_user_id` is SET NULL on `auth.users` delete (per schema); `approveClaim` SA should check `claimant_user_id IS NOT NULL` before proceeding; return appropriate error
- Very long claimant `notes` (all form fields concatenated): truncate display in the detail panel at 500 chars with "Show more" expand — do not truncate the stored value
- Admin is reviewing a claim detail page when another admin simultaneously approves it from the queue table: page does not auto-refresh; admin sees stale state. When they click Approve: `INVALID_STATUS_TRANSITION` returned; toast explains; admin can navigate back to see updated status

## Accessibility Notes

- [ ] The status filter tabs use `role="tablist"` with `role="tab"` items and `aria-selected`; the active filter has `aria-selected="true"`
- [ ] The "Mark Under Review" and "Approve" buttons have unique `aria-label` per row: "Mark [Claimant Name]'s claim under review" to distinguish in screen reader context
- [ ] The `ApproveClaimPopover` traps focus when open; Escape closes it without confirming
- [ ] The reject reason `Textarea` has `aria-required="true"` and an associated `<label>`; errors use `aria-live="assertive"`
- [ ] "View document [N]" links open in a new tab and include `aria-label="View verification document [N] for this claim (opens in new tab)"`
- [ ] The empty state "You're all caught up." is an `<h2>` — not just a paragraph — so screen readers announce the page state correctly

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-1 | Queue default view | Admin navigates to `/admin/claims` | Table shows pending claims sorted oldest-first; "Under Review" and other statuses are filtered out |
| QA-2 | Inline approve | Click "Approve" on a pending claim row → confirm | `approveClaim` fires; row badge → Approved; DB: `claims.status = 'approved'`, `listings.trust_tier = 'claimed'`, `user_roles` row inserted for claimant; approval email sent |
| QA-3 | Mark under review | Click "Mark Under Review" on a pending claim | Row badge → Under Review; `claims.status = 'under_review'` in DB |
| QA-4 | Claim detail — reject | Navigate to `/admin/claims/[id]` → expand reject → enter reason → Confirm | `rejectClaim` fires; claim `status = 'rejected'`; `rejection_reason` stored; rejection email sent to claimant |
| QA-5 | Verification document view | Navigate to claim detail with uploaded doc → click "View document 1" | `getVerificationDocUrl` SA called; signed URL opens in new tab; URL expires after 15 minutes |
| QA-6 | Empty state | Filter to Pending with no pending claims | "You're all caught up." empty state renders with no CTA button |

## Security Notes

- `verification_doc_paths` array is NEVER returned in any API response — only the count is returned in the table view; individual signed URLs are generated on demand via `getVerificationDocUrl` SA with full admin audit logging
- Signed URLs for verification documents must not be logged, cached, or stored anywhere — they exist only in the Server Action response, returned once to the admin browser
- The `approveClaim` SA uses service_role for all 5 DB operations — this bypasses RLS, which is correct for admin operations; the admin role check in Step 3 of the SA is the authoritative gate
- `claimant_user_id`'s email is fetched from `auth.users` via service_role — this is admin-only PII access; it must never be exposed in any public API response
- All `approveClaim` and `rejectClaim` actions write to `admin_audit_log` atomically — every ownership transfer is auditable by listing the claim_id, admin_user_id, and before/after states
- The `doc_path` argument to `getVerificationDocUrl` is validated server-side against the claim's actual `verification_doc_paths` array — an admin cannot request a signed URL for an arbitrary path by manipulating the request

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Claims queue renders with seeded pending claims
- [ ] `approveClaim` SA tested end-to-end — all 5 DB operations confirmed + ISR revalidation + email
- [ ] `rejectClaim` SA tested — rejection reason stored + email sent
- [ ] `getVerificationDocUrl` SA tested — signed URL returned; opens in new tab; expires after 15 min
- [ ] Empty state tested (apply "Pending" filter with no pending claims)
- [ ] LISTING_ALREADY_OWNED error tested (seed a claim for an already-owned listing)
- [ ] Mobile tested at 375px — reduced columns, full-width Review button, no inline approve
- [ ] Keyboard navigation through queue table and claim detail page tested
