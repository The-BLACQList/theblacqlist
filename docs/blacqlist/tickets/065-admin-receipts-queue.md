# Ticket 065: Admin receipts review queue (/admin/receipts)

## Status

Draft

## Phase

Phase 11: Receipt Upload and Community Spend Beta

## Priority

P2

## Estimate

M (2–4h)

## Feature Area

Admin / Spend

---

## Context

After supporters submit receipts (Ticket 064), an admin must review and either approve or reject each submission before it contributes to community spend analytics. This ticket builds the admin-facing review queue at `/admin/receipts`: a filterable table of `receipt_uploads` rows with per-row actions, and a detail modal where the admin sees the uploaded receipt image (via a fresh signed URL generated on modal open), the submitted metadata, and the approve/reject controls. Approving or rejecting calls the `approveReceipt` or `rejectReceipt` Server Actions, which update `receipt_uploads.status` and write to `admin_audit_log`.

The receipt image is **never pre-loaded or cached as a URL** — a signed URL is generated fresh from Supabase Storage (`receipts` bucket, private) each time the modal opens. The URL must not be stored anywhere.

Sources: `docs/blacqlist/ux/mvp-screen-map.md` § Admin screens; `docs/blacqlist/data/database-schema-plan.md` § receipt_uploads, admin_audit_log; `docs/blacqlist/architecture/server-actions-plan.md` § Spend (`getReceiptImageUrl`); `docs/blacqlist/architecture/error-handling-standard.md`.

---

## User Story

As an admin, I want to review submitted receipts and approve or reject them with a reason, so that only legitimate community spend is attributed to Black-owned businesses in the platform's impact data.

---

## Scope

**In scope:**

- `app/admin/receipts/page.tsx` — Server Component; queries `receipt_uploads` with filters; renders `ReceiptsQueueTable`
- `components/admin/receipts/ReceiptsQueueTable.tsx` — Client Component (`"use client"`); data table with columns: submitter display name, business name (from `listings.name` if `listing_id` is set, else "Unknown"), amount (formatted as dollars), purchase date, status badge, submitted_at
- Filter bar: status filter (`pending_review`, `approved`, `rejected`; default: `pending_review`), date range filter (from/to date inputs); filters update URL search params, not local state
- Row click → opens `ReceiptDetailModal`
- `components/admin/receipts/ReceiptDetailModal.tsx` — Client Component; on open, calls `getReceiptImageUrl` SA to get a fresh 15-minute signed URL; displays the image, all submitted metadata fields, and Approve / Reject actions
- `approveReceipt` SA (`lib/actions/admin/approveReceipt.ts`): sets `receipt_uploads.status = 'approved'`; sets `updated_by`; writes to `admin_audit_log` (`action: 'receipt_approved'`); returns `ActionResult<{ id: string }>`
- `rejectReceipt` SA (`lib/actions/admin/rejectReceipt.ts`): requires `rejection_reason` text (non-empty); sets `receipt_uploads.status = 'rejected'`; sets `rejection_reason` field; sets `updated_by`; writes to `admin_audit_log` (`action: 'receipt_rejected'`); returns `ActionResult<{ id: string }>`
- `getReceiptImageUrl` SA (`lib/actions/spend/getReceiptImageUrl.ts`): admin-only; generates a 15-minute signed URL for the given receipt's `file_path` using `createServiceRoleClient()`; writes `admin_audit_log` (`action: 'receipt_viewed'`); returns `ActionResult<{ signed_url: string; expires_at: string }>`
- Reject action requires a reason text field in the modal before confirming — inline textarea, required
- Pagination: 20 rows per page; URL-param-driven (`?page=N`)
- Loading, empty, and error states

**Out of scope:**

- Bulk approve/reject of multiple receipts (V1)
- OCR re-processing trigger (V2)
- Email notification to the supporter on approve/reject (V1 — note for future ticket)
- Spend event auto-creation on approval (Ticket 067 handles this via a DB trigger)

---

## Dependencies

| Dependency                                                                                  | Type                                              | Status                         |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------ |
| Ticket 037 — Admin layout, nav, auth guard                                                  | Blocking ticket                                   | Not started                    |
| Ticket 063 — Receipt upload API (populates `receipt_uploads` table)                         | Blocking ticket                                   | Not started                    |
| Ticket 064 — Receipt submission form (populates test data)                                  | Soft dependency (can test with direct DB inserts) | Not started                    |
| `receipt_uploads` table with `status`, `rejection_reason`, `client_idempotency_key` columns | Database                                          | Must exist                     |
| `admin_audit_log` table (Ticket 012) — INSERT-only trigger must be in place                 | Database                                          | Must exist                     |
| `getReceiptImageUrl` SA — `lib/actions/spend/getReceiptImageUrl.ts`                         | Server Action                                     | Must be created in this ticket |
| `approveReceipt` SA — `lib/actions/admin/approveReceipt.ts`                                 | Server Action                                     | Must be created in this ticket |
| `rejectReceipt` SA — `lib/actions/admin/rejectReceipt.ts`                                   | Server Action                                     | Must be created in this ticket |

---

## UX Notes

- **Screen:** Admin Receipts Queue — admin panel layout (sidebar nav + main content)
- **Route:** `/admin/receipts`
- **Entry points:** Admin sidebar nav item "Receipts" (add to admin nav in `app/admin/layout.tsx`)
- **Exit points:** Modal close → back to queue table
- **Table interaction:** Row click opens the detail modal (not a new page) so the admin stays in context and can review multiple receipts in sequence
- **Detail modal layout (top to bottom):**
  1. Receipt image (centered, max-height 400px, with a loading spinner while the signed URL is being fetched)
  2. Metadata section: business name, amount, purchase date, submitter name, submission date, notes (if any)
  3. Action section: Approve button (Amber Gold) | Reject button (destructive outline) — side by side
  4. On Reject click: a textarea appears below the buttons labeled "Rejection reason (required)" — the Reject button remains disabled until text is entered
- **Status badge colors:** `pending_review` → Amber (yellow), `approved` → Green, `rejected` → Red (use the standard badge color map from design-system.md)
- **Filter persistence:** Status and date filters are URL search params; page refresh preserves filter state; shareable links work
- **Mobile:** Admin queue is a desktop-first view. Basic mobile functionality required (readable table, modal opens). Table columns may collapse to show only business name + status on narrow viewports.

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components to use:** shadcn/ui `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `Badge`, `Button`, `Dialog`, `DialogContent`, `DialogHeader`, `Textarea`, `Label`, `Select` (for status filter), `Input` (type="date" for date filters), `Skeleton` (for image loading in modal)
- **Receipt image in modal:** Render with `next/image` using `unoptimized` (signed URL is temporary — Next.js image optimization cannot cache it); set `alt="Submitted receipt"`. Show `Skeleton` while fetching the signed URL.
- **States to implement:** Loading (table skeleton — 5 row stubs), Empty (filter returns no results), Error (error banner if SA fails), Success (status badge updates on row after approve/reject without page reload)
- **Optimistic update:** After approve or reject, update the row's status badge in the table immediately (optimistic); if the SA fails, revert and show an error toast

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` § receipt_uploads, admin_audit_log
- **Entities involved:** `receipt_uploads`, `listings` (JOIN for business name), `profiles` (JOIN for submitter display name), `admin_audit_log`
- **Table query:**
  ```sql
  SELECT
    ru.id, ru.status, ru.amount_cents, ru.purchase_date, ru.notes,
    ru.client_idempotency_key, ru.file_path, ru.created_at, ru.rejection_reason,
    l.name AS listing_name,
    p.display_name AS submitter_name
  FROM receipt_uploads ru
  LEFT JOIN listings l ON l.id = ru.listing_id
  LEFT JOIN profiles p ON p.id = ru.user_id
  WHERE (:status IS NULL OR ru.status = :status)
    AND (:from_date IS NULL OR ru.purchase_date >= :from_date)
    AND (:to_date IS NULL OR ru.purchase_date <= :to_date)
  ORDER BY ru.created_at DESC
  LIMIT 20 OFFSET (:page - 1) * 20
  ```
- **`approveReceipt` SA fields to update:** `status = 'approved'`, `updated_by = auth.uid()`, `updated_at = now()` (via trigger)
- **`rejectReceipt` SA fields to update:** `status = 'rejected'`, `rejection_reason = [text]`, `updated_by = auth.uid()`
- **`admin_audit_log` entries:** `action: 'receipt_approved'` or `'receipt_rejected'` or `'receipt_viewed'`; `target_type: 'receipt_upload'`; `target_id: receipt.id`; `admin_id: auth.uid()`
- **RLS:** `receipt_uploads` admin reads via service role (bypasses RLS); `approveReceipt` and `rejectReceipt` SAs use service role client for writes
- **Migration required:** No — `receipt_uploads` table exists; `rejection_reason text` column must be verified in the migration. If it is not present, add it in this ticket's migration scope with `ALTER TABLE receipt_uploads ADD COLUMN rejection_reason text`.

---

## API Notes

### `approveReceipt` SA (`lib/actions/admin/approveReceipt.ts`)

```typescript
// Input
interface ApproveReceiptInput {
  receipt_id: string // UUID
}
// Returns: ActionResult<{ id: string }>
// Auth: admin or super_admin
// Audit: yes — action: 'receipt_approved'
```

### `rejectReceipt` SA (`lib/actions/admin/rejectReceipt.ts`)

```typescript
// Input
interface RejectReceiptInput {
  receipt_id: string // UUID
  rejection_reason: string // Required; min 10 chars; max 500 chars
}
// Returns: ActionResult<{ id: string }>
// Auth: admin or super_admin
// Audit: yes — action: 'receipt_rejected'
```

### `getReceiptImageUrl` SA (`lib/actions/spend/getReceiptImageUrl.ts`)

```typescript
// Input
interface GetReceiptImageUrlInput {
  receipt_id: string // UUID
}
// Returns: ActionResult<{ signed_url: string; expires_at: string }>
// Auth: admin or super_admin
// Generates: supabase.storage.from('receipts').createSignedUrl(file_path, 900)
// Audit: yes — action: 'receipt_viewed'
// Cache: No — signed URL is ephemeral
```

---

## Implementation Notes

**Files to create:**

- `app/admin/receipts/page.tsx` — Server Component; server-side initial fetch with URL search params; renders `ReceiptsQueueTable`
- `components/admin/receipts/ReceiptsQueueTable.tsx` — Client Component; table + filter bar
- `components/admin/receipts/ReceiptDetailModal.tsx` — Client Component; modal with signed URL fetch, metadata, and actions
- `lib/actions/admin/approveReceipt.ts` — Server Action
- `lib/actions/admin/rejectReceipt.ts` — Server Action
- `lib/actions/spend/getReceiptImageUrl.ts` — Server Action

**Files to modify:**

- `app/admin/layout.tsx` — add "Receipts" nav item to the admin sidebar

**Key patterns:**

- Follow the seven-step Server Action pattern for `approveReceipt`, `rejectReceipt`, and `getReceiptImageUrl`
- `getReceiptImageUrl` must use `createServiceRoleClient()` — the `receipts` bucket is private; anon/authenticated client cannot generate signed URLs
- `admin_audit_log` is INSERT-only (DB trigger blocks UPDATE/DELETE) — use `createServiceRoleClient()` for audit log writes; never attempt to UPDATE or DELETE audit rows
- Filter state in URL: use `useSearchParams()` and `useRouter()` in the Client Component to read/write filter params without a page reload
- Signed URL fetch in modal: call `getReceiptImageUrl` SA on `Dialog` open (`onOpenChange` callback); do not pre-fetch; re-fetch if the modal is closed and reopened
- Optimistic status update: on SA success, update the row in local state using `useState` or `useOptimistic`

**Do not:**

- Store the signed URL anywhere (not in state across modal close, not in a cookie, not in the DB)
- Call `revalidatePath` from `approveReceipt` or `rejectReceipt` — receipt status changes do not affect any ISR-cached public page at MVP
- Use `getSession()` — use `getUser()` in all SAs

---

## Acceptance Criteria

- [ ] Given an admin visits `/admin/receipts`, then a table of `pending_review` receipts is shown by default (status filter pre-set to `pending_review`)
- [ ] Given the admin changes the status filter to `approved`, then the table reloads showing only approved receipts — filter state is reflected in the URL
- [ ] Given the admin clicks a row, then the detail modal opens; while the signed URL is being fetched, a skeleton/spinner is shown in place of the receipt image
- [ ] Given the signed URL resolves, then the receipt image is rendered in the modal — the URL is not stored anywhere
- [ ] Given the admin clicks Approve on a pending receipt, then `receipt_uploads.status` is set to `'approved'`, an `admin_audit_log` row is inserted, and the table row's status badge updates to "Approved" without a full page reload
- [ ] Given the admin clicks Reject, then a "Rejection reason" textarea appears; the Reject confirm button is disabled until text is entered (min 1 character)
- [ ] Given the admin enters a rejection reason and confirms, then `receipt_uploads.status = 'rejected'` and `rejection_reason` is set; `admin_audit_log` row inserted; table row updates
- [ ] Empty state: given no receipts match the current filter, then "No receipts found" with a "Clear filters" button is shown
- [ ] Loading state: table shows 5 row skeletons while the initial server-side fetch completes
- [ ] Mobile at 375px: table is readable (may collapse to fewer columns); modal opens and is scrollable

---

## Failure States

| Failure                               | User-visible behavior                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `getReceiptImageUrl` SA fails         | Error message inside the modal: "Could not load receipt image." Approve/Reject actions still available. |
| `approveReceipt` SA returns error     | Error toast: "Could not approve receipt. Please try again." Status badge reverts to previous state.     |
| `rejectReceipt` SA returns error      | Error toast: "Could not reject receipt. Please try again."                                              |
| Page load query fails                 | Error banner: "Could not load receipts queue. Please refresh the page."                                 |
| `rejection_reason` is empty on submit | Reject confirm button remains disabled — no submission possible                                         |

---

## Edge Cases

- Receipt has `listing_id = null` (user did not select a business): show "Unknown business" in the listing name column and in the modal
- Admin approves the same receipt twice (e.g., double-click): second SA call finds `status` already `'approved'`; service layer should be idempotent — check current status before UPDATE, return success if already in target state
- Receipt image file no longer exists in storage (orphaned record): signed URL generation will fail; show "Receipt image unavailable" in the modal; allow approve/reject without viewing the image
- Large amount (e.g., $1,000,000): display formatted as "$1,000,000.00" — use `Intl.NumberFormat` with `style: 'currency'`
- Signed URL expires while the modal is open (after 15 minutes): the image will stop loading; no automatic refresh at MVP — show a stale URL error and a "Refresh image" button

---

## Accessibility Notes

- [ ] The receipts table has proper `<thead>` with `<th scope="col">` headers
- [ ] Modal (`Dialog`) traps focus when open and returns focus to the row when closed
- [ ] Status badges have `aria-label` describing the status (not color-only: e.g., `aria-label="Pending review"`)
- [ ] The Reject confirm button uses `aria-disabled="true"` when the reason textarea is empty
- [ ] Error toasts use `role="alert"` for screen reader announcement

---

## QA Test Cases

| #    | Scenario                         | Role  | Steps                                                                                | Expected result                                                                                    |
| ---- | -------------------------------- | ----- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| QA-1 | Default table view               | admin | Navigate to `/admin/receipts`                                                        | Table shows `pending_review` receipts; status filter shows "Pending Review"                        |
| QA-2 | View receipt image               | admin | Click any row                                                                        | Modal opens; receipt image loads (may take a moment); metadata fields displayed                    |
| QA-3 | Approve receipt                  | admin | Open a `pending_review` receipt modal; click Approve                                 | Modal closes; row status badge changes to "Approved"; `receipt_uploads.status = 'approved'` in DB  |
| QA-4 | Reject receipt — reason required | admin | Open a `pending_review` receipt modal; click Reject; try to confirm without a reason | Confirm button disabled; no submission                                                             |
| QA-5 | Reject receipt — with reason     | admin | Enter rejection reason; confirm                                                      | Row status badge changes to "Rejected"; `rejection_reason` populated in DB; audit log row inserted |
| QA-6 | Filter by date range             | admin | Set from/to date filters; submit                                                     | Table shows only receipts within the date range; URL params updated                                |

---

## Security Notes

- Auth check in all three SAs: query `user_roles` for `role IN ('admin', 'super_admin')` — never trust JWT claims
- `getReceiptImageUrl` uses `createServiceRoleClient()` — the service role key must not be exposed to the browser
- `admin_audit_log` INSERT-only: the DB trigger blocks UPDATE and DELETE; the SA only INSERTs
- Signed URL generation: the 15-minute URL grants temporary read access to a private file; it must not be logged or stored
- Admin cannot read another admin's `admin_audit_log` entries through this UI — the audit log is for the internal operations table only

---

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading skeleton, empty filter state, error banner/toast, success optimistic update)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested (table rows, modal, reject textarea)
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
