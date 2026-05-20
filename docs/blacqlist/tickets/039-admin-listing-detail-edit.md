# Ticket 039: Admin Listing Detail and Edit (/admin/listings/[id])

## Status
Backlog

## Phase
Phase 6: Admin Review and Verification

## Priority
P1

## Feature Area
Admin / Listings

## Context
When a listing requires more than an inline approve or reject, admins need a full detail view to read all fields, edit any content, manage media, and take moderation actions with notes. This page is also where complex cases are handled — listings that need content corrections before approval, media that needs individual moderation, or listings that require a flag with a specific reason. It is the counterpart to the owner's Page Editor, but with admin-only controls (status override, flag reason, hard delete, moderation notes). Source: `docs/blacqlist/ux/mvp-screen-map.md` Admin Listing Detail row; `docs/blacqlist/architecture/api-contract.md` Section 9 endpoints 43–44 + 50; `docs/blacqlist/data/database-schema-plan.md` listings + listing_details_business tables; `docs/blacqlist/architecture/server-actions-plan.md`.

## User Story
As a platform admin, I want to view and edit any listing's full content, change its status, moderate its media, and approve or reject it with notes, so that I can ensure listing quality before content goes live and handle complex moderation cases that require more than an inline action.

## Scope

**In scope:**
- `app/admin/listings/[id]/page.tsx` — Server Component; fetches full listing record (service_role); fetches listing_details_business; fetches media_attachments; passes all to Client Component
- `app/admin/listings/[id]/_components/AdminListingEditForm.tsx` — Client Component; multi-section form matching BLACQList Page sections; all fields editable
- Form sections (matching the owner's Page Editor layout but admin-extended):
  - Hero: name (text), tagline (text), logo upload, cover image upload
  - About: description (textarea)
  - Location: address fields OR service area; location type select
  - Contact: phone, email, website
  - Social links: Instagram, Facebook, LinkedIn, TikTok, YouTube
  - CTA: cta_type select + cta_url input
  - Hours: day-by-day open/close times or "Closed" toggle per day
  - **Admin-only section — Moderation:**
    - Status override select: all valid status values (`'draft'`, `'pending'`, `'published'`, `'unpublished'`, `'archived'`, `'flagged'`)
    - Flag status select: `'none'`, `'inactive'`, `'duplicate'`, `'incorrect'`, `'spam'`
    - `moderation_notes` textarea (shown to owner on rejection/flag — label says this)
    - `admin_notes` textarea (internal only — never shown to owner — label says this clearly)
  - **Media section:** shows all `media_attachments` for this listing. Per image: thumbnail, file type badge, "Approved" / "Rejected" toggle (calls `moderateMedia` SA); "Remove" button
- Save button: "Save changes" — calls `updateListingContent` SA; triggers ISR revalidation if listing is published; success toast
- Approve button (Amber Gold, shown if `status = 'pending'`): calls `approveEntity` SA; on success: status badge updates, ISR revalidated, approval email sent
- Reject button (red destructive, shown if `status = 'pending'`): opens `RejectReasonDialog` (same component as Ticket 038); calls `rejectEntity` SA; on success: status updates, rejection email sent
- Delete button (red destructive, bottom of page): `DeleteConfirmDialog` with "Type the listing name to confirm"; calls hard-delete SA; on success: redirect to `/admin/listings`
- Breadcrumb: `Admin / Listings / [Listing Name]` with linked segments
- Audit log section (read-only, bottom of page): last 10 `admin_audit_log` entries for this listing — action type, admin email, timestamp

**Out of scope:**
- Claims history panel (deferred — Ticket 040 focuses on claims; linking from listing detail to its claims is V1)
- Verification status management (V1 per server-actions-plan.md)
- Gallery drag-to-reorder (owner-facing feature; admins can approve/reject images but not reorder)
- Publishing listings through a draft → pending → published path that bypasses `approveEntity` SA (all publishing goes through `approveEntity`)

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 038 (admin listings table) | Blocking ticket | Users arrive from the table via "Review" action |
| Ticket 037 (admin layout + auth guard) | Blocking ticket | Admin shell required |
| `updateListingContent` SA (`lib/actions/dashboard/updateListingContent.ts`) | Code dependency | Used for content field saves; same SA as owner editor — admin uses same action, role check must allow admin |
| `approveEntity` SA (`lib/actions/admin/approveEntity.ts`) | Code dependency | Used for Approve button |
| `rejectEntity` SA (`lib/actions/admin/rejectEntity.ts`) | Code dependency | Used for Reject button |
| `moderateMedia` SA (`lib/actions/admin/moderateMedia.ts`) | Code dependency | Used for per-image approve/reject toggles |
| `lib/admin/serviceRoleClient.ts` | Code dependency | Fetches full listing data (bypasses RLS) |
| `admin_audit_log` table (Ticket 012) | Blocking ticket | Audit entries must exist for the log section to render |

## UX Notes

- **Screen:** Admin Listing Detail — `docs/blacqlist/ux/mvp-screen-map.md` Admin Listing Detail row
- **Flow reference:** Admin Listings table (Ticket 038) → kebab "Review" → this page
- **Entry points:** `/admin/listings` table "Review" action; direct URL navigation to `/admin/listings/[uuid]`
- **Exit points:** Save (stays on page with success toast); Approve/Reject (stays on page, status badge updates); Delete (redirects to `/admin/listings`); Breadcrumb "Listings" → `/admin/listings`
- **Mobile behavior (375px):**
  - Form sections: accordion-style collapsible (same pattern as owner Page Editor); only Moderation section is expanded by default for admin
  - Approve and Reject buttons: full-width stacked at bottom of page above Delete button
  - Audit log section: horizontally scrollable or card list on mobile

## Design Notes

- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Components to use:** shadcn/ui `Form`, `FormField`, `Input`, `Textarea`, `Select`, `Switch`, `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Button`, `Dialog`, `Badge`, `Separator`, `Accordion`
- **Admin-only section styling:** `Card` with `border-2 border-[#E2A428]/30 bg-[#E2A428]/5 rounded-lg` to visually distinguish from standard content fields
- **Moderation notes textarea:** `border-amber-400` highlight to remind admin this text is visible to the owner
- **Admin notes textarea:** gray border; label: "Internal notes (never shown to listing owner)"
- **Media moderation toggles:** per-image `Switch` — ON = "Approved" (green), OFF = "Rejected" (red); switch fires `moderateMedia` SA immediately on toggle (not on form Save)
- **Audit log:** `Table` with columns: Date/Time, Admin, Action, Notes. `text-xs` text; most recent first
- **Delete button:** visually separated from other actions by a `Separator` component; preceded by destructive intent text "Danger zone"
- **States to implement:** Loading (page skeleton), Loaded, Saving (button spinner), Save success (toast), Approve success (badge update + toast), Reject dialog open, Delete confirmation open

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `listings`, `listing_details_business`, `media_attachments`, `admin_audit_log`
- **Entities involved:** `listings` (SELECT + UPDATE), `listing_details_business` (SELECT + UPDATE), `media_attachments` (SELECT + UPDATE via `moderateMedia`), `admin_audit_log` (SELECT for log section; INSERT via SAs)
- **Operations:**
  - SELECT: full `listings` record + `listing_details_business` JOIN using service_role
  - SELECT: `media_attachments WHERE entity_id = $listing_id AND entity_type = 'listing'`
  - SELECT: `admin_audit_log WHERE target_id = $listing_id ORDER BY created_at DESC LIMIT 10`
  - UPDATE: `updateListingContent` SA for content fields; `approveEntity`/`rejectEntity` SAs for status; `moderateMedia` SA for image approval
  - DELETE: soft delete via `deleted_at = now()` in a `deleteListingAdmin` SA
- **Validation rules:** All field validations same as listing creation; `status` must be a valid enum value; `flag_status` must be a valid enum value
- **RLS policies:** All reads and writes use service_role client — bypasses RLS. Admin role is confirmed in `layout.tsx` (Ticket 037)
- **Migration required:** No

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` → Section 9 endpoints 43, 44, 50
- **Endpoints involved (all Server Actions):**
  - `updateListingContent` SA — saves content field changes; triggers ISR revalidation if `status = 'published'`
  - `approveEntity` SA — status pending → published; writes audit log; sends email; triggers ISR
  - `rejectEntity` SA — status update; writes audit log; sends rejection email with reason
  - `moderateMedia` SA — updates `media_attachments.is_approved`; writes audit log; triggers ISR revalidation if listing is published
- **Auth required:** Admin (all SAs enforce admin role check + use service_role for DB writes)
- **Error codes to handle:**
  - `INVALID_STATUS_TRANSITION` (422) — toast: "This listing cannot be approved in its current state."
  - `VALIDATION_ERROR` — display field-level errors inline
  - `NOT_FOUND` (404) — redirect to `/admin/listings` with toast: "Listing not found."
  - `SERVER_ERROR` — toast: "Action failed. Please try again."

## Implementation Notes

**Files to create:**
- `app/admin/listings/[id]/page.tsx` — Server Component; fetches all data; handles `notFound()` if `id` invalid
- `app/admin/listings/[id]/_components/AdminListingEditForm.tsx` — Client Component; full form with SA calls
- `app/admin/listings/[id]/_components/MediaModerationSection.tsx` — media grid with per-image approve/reject toggles
- `app/admin/listings/[id]/_components/AdminAuditLogSection.tsx` — read-only audit log table
- `app/admin/listings/[id]/_components/ModerationSection.tsx` — admin-only moderation fields card
- `lib/actions/admin/moderateMedia.ts` — Server Action (if not already created)

**Files to modify:**
- `lib/actions/dashboard/updateListingContent.ts` — confirm it allows admin role (not just owner) — if it currently checks `owner_user_id = auth.uid()`, add a secondary check for admin role via service_role; OR create a separate `lib/actions/admin/updateListingAdmin.ts` that uses service_role without the ownership check
- `lib/actions/admin/approveEntity.ts` — confirm the `revalidatePath` call is correct for city-slug + listing-slug pattern

**Key patterns:**
- The admin edit form should reuse the same zod schemas from `lib/validations/listing.ts` for content fields, with an additional schema for admin-only fields (`moderation_notes`, `admin_notes`, `status`, `flag_status`)
- Media moderation: each image toggle is a controlled `Switch` that fires the `moderateMedia` SA immediately on change (not batched with form Save). Use `useTransition` or a loading state per switch to prevent double-firing
- Delete confirmation: require the admin to type the listing name exactly to enable the "Delete permanently" button — use `onInput` to compare the typed value to the listing name before enabling
- Audit log: fetched server-side in the Server Component; rendered as a static table in the page — no client-side fetch needed

**Do not:**
- Allow `owner_user_id` to be changed from this form — ownership is managed through the claims workflow only
- Expose `admin_notes` content to the owner via `moderation_notes` — they are separate fields; `moderation_notes` is shown to owners, `admin_notes` is not
- Trigger ISR revalidation for content saves on unpublished listings — only revalidate when `status = 'published'`

## Acceptance Criteria

- [ ] Given an admin navigates to `/admin/listings/[id]`, the full listing record renders across all form sections with current values pre-filled
- [ ] Given an admin edits the description field and clicks Save, `updateListingContent` SA is called; a success toast confirms "Changes saved."
- [ ] Given an admin saves changes on a published listing, ISR revalidation fires for the listing's public URL
- [ ] Given an admin clicks Approve on a pending listing, `approveEntity` SA is called; the status badge updates to Published and a success toast renders
- [ ] Given an admin submits a rejection reason, `rejectEntity` SA is called; the status updates and the reason is stored in `moderation_notes`
- [ ] Given an admin toggles a media image to "Rejected", `moderateMedia` SA is called immediately; the toggle shows Rejected state
- [ ] Given an admin clicks Delete and types the listing name correctly, the delete confirmation button becomes enabled; confirming soft-deletes the record and redirects to `/admin/listings`
- [ ] The audit log section shows the last 10 admin actions on this listing with action type, admin identity, and timestamp
- [ ] The `admin_notes` textarea is clearly labeled as "Internal only — never shown to listing owner"
- [ ] On mobile at 375px, form sections are collapsible accordions; Approve and Reject buttons are full-width

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| Listing not found | `listing_id` does not exist or deleted | `notFound()` — Next.js 404 page | Admin navigates back to `/admin/listings` |
| Save fails | `updateListingContent` SA returns `SERVER_ERROR` | Toast: "Save failed. Please try again." — form data not lost | Admin retries Save |
| Approve INVALID_STATUS_TRANSITION | Listing not in `pending` state | Toast: "This listing cannot be approved in its current state." | Admin reviews current status; no action needed |
| Media moderation fails | `moderateMedia` SA returns error | Toggle reverts to previous state; toast: "Media moderation failed." | Admin re-toggles; retries |
| Delete confirmation name mismatch | Admin typed name doesn't match listing name | Delete permanently button remains disabled | Admin types exact name |

## Edge Cases

- Listing has no `listing_details_business` record (admin-created listing without details): form renders with empty detail fields — no null pointer errors
- Listing has 0 media attachments: Media section shows empty state: "No images uploaded" — no error
- Admin edits a field that the owner simultaneously edits (race condition): last write wins (PostgreSQL row-level update); `updated_at` trigger resolves which save was last; no conflict detection at MVP — acceptable
- Very long `admin_notes` (admin pastes a long note): `admin_notes` field has no length limit in the DB (plain `text`); the textarea should show a soft recommendation "Keep notes concise" at 500+ chars but not block save
- `moderation_notes` already populated from a prior rejection: admin edits are preserved on the next save — form pre-fills with existing value

## Accessibility Notes

- [ ] Form sections use `<fieldset>` + `<legend>` for logical grouping of related fields (e.g., Contact fieldset, Social Links fieldset)
- [ ] The Admin-only section card has `aria-label="Moderation controls — admin only"` to distinguish it from content fields
- [ ] Media moderation switches have accessible labels: `aria-label="[Image filename] — approve or reject"`
- [ ] The delete confirmation text input has `aria-label="Type the listing name to confirm deletion"` with `aria-describedby` pointing to the instruction text
- [ ] Save, Approve, Reject, and Delete buttons all have loading states with `aria-busy="true"` during SA execution
- [ ] Breadcrumb uses `<nav aria-label="Breadcrumb">` with `aria-current="page"` on the last segment

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-1 | Load full record | Admin navigates to `/admin/listings/[id]` for a listing with all fields populated | All form sections pre-filled with correct values; audit log shows relevant entries |
| QA-2 | Save content change | Edit description → Save | `updateListingContent` called; toast "Changes saved."; DB record updated |
| QA-3 | Approve flow | Navigate to pending listing → click Approve → confirm | `approveEntity` SA called; status badge → Published; ISR revalidation triggered; approval email sent |
| QA-4 | Media moderation | Toggle a media image to "Rejected" | `moderateMedia` SA fires immediately; toggle shows Rejected; audit log entry written |
| QA-5 | Delete confirmation | Click Delete → type wrong name → attempt to click "Delete permanently" | Button remains disabled; after typing correct name, button enables; confirming deletes record |

## Security Notes

- `admin_notes` is marked "never shown to listing owner" — ensure `updateListingContent` SA (owner-facing version) never reads or writes `admin_notes`; the admin-specific save SA must use service_role and a separate field list
- All admin mutations write to `admin_audit_log` atomically — if the audit log insert fails, the entire mutation rolls back (use a DB transaction)
- Media moderation: `moderateMedia` SA writes an audit log entry for each approval/rejection decision — these create an access record for any moderated content
- The delete confirmation name-match check is client-side (enables the button) and is NOT a server-side check — a sufficiently determined admin could bypass it. The server-side SA executes the delete regardless; the name-match is a UX safeguard against accidental clicks only
- `SUPABASE_SERVICE_ROLE_KEY` used in all server-side operations for this page — confirm it is not exposed to the client bundle

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Full listing detail loads with all sections populated from seeded data
- [ ] Save content changes tested — DB and ISR revalidation confirmed
- [ ] Approve flow tested end-to-end (status → published, email sent)
- [ ] Reject flow tested — rejection reason stored in `moderation_notes`
- [ ] Media moderation toggle tested — `is_approved` updated in DB + audit log entry
- [ ] Delete confirmation name-match tested — button disabled until exact name typed
- [ ] Mobile accordion sections tested at 375px
- [ ] Keyboard navigation through form and dialog tested
