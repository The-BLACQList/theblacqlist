# Ticket 038: Admin Listings Table (/admin/listings)

## Status
Backlog

## Phase
Phase 6: Admin Review and Verification

## Priority
P1

## Feature Area
Admin / Listings

## Context
The admin listings table is the primary moderation surface for platform content. Admins use it to review pending submissions, search for specific listings, filter by status or city, and perform inline approve/reject actions. It is the most frequently used admin screen after the claims queue. Without this screen, admins cannot approve submitted listings, and the platform's supply of published content cannot grow. Source: `docs/blacqlist/ux/mvp-screen-map.md` Admin Listings screen; `docs/blacqlist/architecture/api-contract.md` Section 9 endpoints 42–44; `docs/blacqlist/data/database-schema-plan.md` listings table.

## User Story
As a platform admin, I want to view, filter, and search all listings regardless of status, and approve or reject pending listings directly from the table, so that I can efficiently manage the submission queue without navigating to each listing's detail page for routine actions.

## Scope

**In scope:**
- `app/admin/listings/page.tsx` — Server Component; reads `searchParams` for filters; passes to Client Component; handles pagination
- `app/admin/listings/_components/AdminListingsTable.tsx` — Client Component; renders the table with filter controls and row actions
- **Table columns:** Checkbox (bulk select), Name (clickable → `/admin/listings/[id]`), Entity Type badge, City, Category, Status badge (color-coded), Trust Tier badge, Created date (`MM/DD/YYYY`), Actions kebab menu
- **Filter controls above table:**
  - Status filter: tabs or chips — All, Draft, Pending, Published, Rejected, Archived, Flagged. Default: All
  - City select (searchable, clears to All)
  - Category select (searchable, clears to All)
  - Entity type select (Business, Professional, Creative, Event, Job)
  - Search input: searches by listing name (`ILIKE %query%`)
  - "Clear filters" text link (visible when any non-default filter is active)
- Filter state in URL search params: `?status=pending&city=atlanta&q=hair`
- **Pagination:** 50 rows/page; page controls at bottom: prev/next buttons + current page indicator "Page N of M"
- **Sort:** `created_at DESC` default; clicking column headers for Name, Created, Status toggles sort direction; `?sort=created_at&order=asc` in URL
- **Inline actions per row (in Actions kebab `DropdownMenu`):**
  - "Review" → `/admin/listings/[id]`
  - "Approve" (only shown for `status = 'pending'`) — opens `ApproveConfirmPopover`
  - "Reject" (only shown for `status = 'pending'`) — opens `RejectReasonDialog`
  - "Delete" (shown for all) — opens `DeleteConfirmDialog`
- **Inline Approve popover:** `Popover` or `AlertDialog` — "Approve [Name]?" with "Confirm Approve" Amber Gold button; calls `approveEntity` SA on confirm; row status badge updates optimistically to Published
- **Inline Reject dialog:** `Dialog` with `Textarea` "Rejection reason (sent to submitter)" (required); "Confirm Rejection" red button; calls `rejectEntity` SA; row status badge updates optimistically to Rejected
- **Delete dialog:** `Dialog` — "Delete [Name]? This is permanent." Red "Delete permanently" button; calls a `deleteListingAdmin` SA (hard delete); row removed from table optimistically
- **Bulk select:** checkbox in header selects all 50 on current page; bulk action: "Flag selected" — opens bulk flag dialog (reason + flag type select); calls bulk flag SA
- Empty state: "No listings match your filters." with "Clear filters" button
- Loading: table skeleton (10 row placeholders with gray cells)

**Out of scope:**
- Admin Listing Detail edit form (Ticket 039)
- Claims management (Ticket 040)
- Bulk approve or bulk reject (deferred — flag only at MVP)
- Export to CSV (post-MVP)
- Inline editing of listing fields from the table

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 037 (admin layout + auth guard) | Blocking ticket | Admin shell must exist before this page can render |
| `GET /api/admin/listings` Route Handler | Blocking ticket | Must be implemented (or replaced with direct server-side Supabase query in the Server Component) |
| `approveEntity` SA (`lib/actions/admin/approveEntity.ts`) | Code dependency | Must exist for inline approve |
| `rejectEntity` SA (`lib/actions/admin/rejectEntity.ts`) | Code dependency | Must exist for inline reject |
| `lib/admin/serviceRoleClient.ts` | Code dependency | Stats and listings queries use service_role |

## UX Notes

- **Screen:** Admin Listings — `docs/blacqlist/ux/mvp-screen-map.md` Admin Listings row
- **Flow reference:** Admin arrives at `/admin/overview` → clicks "Listings pending review: [N]" → `/admin/listings?status=pending`
- **Entry points:** Admin sidebar "Listings" nav link; Overview "Needs attention" pending review link
- **Exit points:** Row "Review" action → `/admin/listings/[id]`; inline approve/reject returns to same table with updated row status
- **Mobile behavior (375px):**
  - Table collapses: show Name, Status badge, and Actions kebab only on mobile; other columns hidden (`hidden md:table-cell`)
  - Filter controls: collapse into a "Filters" button that opens a bottom drawer/Sheet with the full filter form
  - Pagination: full-width prev/next buttons; page number shown between them
  - Bulk select: hidden on mobile — bulk actions are desktop-only at MVP

## Design Notes

- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Components to use:** shadcn/ui `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `Checkbox`, `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `Dialog`, `AlertDialog`, `Popover`, `Select`, `Input`, `Button`, `Badge`, `Skeleton`
- **Status badge colors:**
  - `draft`: `bg-gray-100 text-gray-600`
  - `pending`: `bg-yellow-100 text-yellow-800`
  - `published`: `bg-green-100 text-green-800`
  - `rejected`: `bg-red-100 text-red-700`
  - `archived`: `bg-gray-200 text-gray-500`
  - `flagged`: `bg-orange-100 text-orange-800`
- **Trust tier badge:**
  - `unclaimed`: `bg-gray-100 text-gray-500`
  - `claimed`: `bg-[#E2A428] text-[#000000]`
  - `verified`: `bg-green-600 text-white`
- **Table header:** `bg-[#000000] text-[#FCFAF4]/70 text-xs uppercase tracking-wide`
- **Table row hover:** `hover:bg-[#E2A428]/5`
- **Approve button (in popover):** `bg-[#E2A428] text-[#000000]`
- **Reject/Delete buttons:** `variant="destructive"` (red)
- **States to implement:** Loading (skeleton rows), Loaded, Empty (filter no match), Confirming approve, Confirming reject (dialog with textarea), Confirming delete

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `listings`, `listing_details_business`, `cities`, `categories`
- **Entities involved:** `listings` (SELECT, UPDATE via SAs), `cities` (JOIN for city name), `categories` (JOIN for category name), `admin_audit_log` (INSERT via SAs)
- **Operations:**
  - SELECT: `listings` LEFT JOIN `cities` LEFT JOIN `categories` (for city_name, category_name in response) — service_role client, no RLS; all statuses including deleted when `include_deleted=true`
  - UPDATE via `approveEntity` SA: `status = 'published'`, `published_at = now()`
  - UPDATE via `rejectEntity` SA: `status = 'rejected'` (note: listings do not have a `'rejected'` status in the schema CHECK constraint — confirm with schema plan; if `'rejected'` is not valid, use `moderation_notes` + keep `status = 'pending'` or set to `'archived'`)
  - DELETE via `deleteListingAdmin` SA: hard delete (set `deleted_at = now()` — soft delete per schema conventions)
- **Validation rules:** Filter values validated server-side; `status` must be a valid enum value; `city` and `category` validated against tables
- **RLS policies:** All admin listing queries use service_role — bypasses RLS intentionally. Admin role checked in `layout.tsx` (Ticket 037) before this page renders
- **Migration required:** No

**Note on `rejectEntity` and status:** The `listings.status` field CHECK constraint includes `'draft'`, `'pending'`, `'published'`, `'unpublished'`, `'flagged'`, `'archived'` — there is no `'rejected'` value. The `rejectEntity` SA should set `status = 'archived'` and write the rejection reason to `moderation_notes`. This must be confirmed against the schema before implementation — flag as an assumption.

**Assumption:** `rejectEntity` SA sets `listings.status = 'archived'` and writes `reason` to `listings.moderation_notes`. The admin UI shows this as "Rejected" using a display label mapped from `status = 'archived'` + `moderation_notes IS NOT NULL`. Flag for team confirmation.

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` → Section 9 endpoints 42–44
- **Endpoints involved:**
  - `GET /api/admin/listings` — or direct service_role query in Server Component (preferred for Next.js Server Components)
  - `approveEntity` SA (`lib/actions/admin/approveEntity.ts`)
  - `rejectEntity` SA (`lib/actions/admin/rejectEntity.ts`)
  - `deleteListingAdmin` SA — not in the API contract; must be created following the same seven-step pattern
- **Auth required:** Admin role (enforced in layout)
- **Request shape for approveEntity:** `{ listing_id: string, notes?: string }`
- **Request shape for rejectEntity:** `{ listing_id: string, reason: string, notes?: string }`
- **Error codes to handle:**
  - `INVALID_STATUS_TRANSITION` (422) — "This listing cannot be approved in its current state." Toast error; row not updated
  - `FORBIDDEN` (403) — should not occur since layout enforces admin; treat as unexpected error
  - `SERVER_ERROR` — "Action failed. Please try again." Toast; optimistic update rolled back

## Implementation Notes

**Files to create:**
- `app/admin/listings/page.tsx` — Server Component; reads `searchParams`; calls service_role Supabase query; passes data + pagination to Client Component
- `app/admin/listings/_components/AdminListingsTable.tsx` — Client Component; table, filters, filter URL params, row actions
- `app/admin/listings/_components/ApproveConfirmPopover.tsx` — inline approve confirmation
- `app/admin/listings/_components/RejectReasonDialog.tsx` — reject dialog with reason textarea
- `app/admin/listings/_components/DeleteConfirmDialog.tsx` — delete confirmation
- `lib/actions/admin/approveEntity.ts` — Server Action (if not already created)
- `lib/actions/admin/rejectEntity.ts` — Server Action (if not already created)

**Files to modify:**
- None

**Key patterns:**
- Filter state in URL: use `useSearchParams` + `useRouter` + `usePathname` for filter controls in the Client Component; changing any filter calls `router.push` with updated params — see frontend rules for the filter pattern
- Optimistic updates for approve/reject: update the row's `status` in local state immediately; roll back if SA returns error
- Service_role query in Server Component:
  ```typescript
  const serviceClient = createServiceRoleClient()
  const { data, count } = await serviceClient
    .from('listings')
    .select('id, name, slug, entity_type, status, trust_tier, created_at, ...', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  ```
- Pass filter values from `searchParams` to the query: `if (status) query = query.eq('status', status)`

**Do not:**
- Revalidate the homepage or listing pages from this table — the `approveEntity` SA handles `revalidatePath` and `revalidateTag` internally
- Allow bulk delete from this table — too high a risk of accidental mass data loss; bulk delete is Super Admin-only and out of scope for MVP
- Show the `admin_notes` column in the table — it is internal and should only appear in the detail view

## Acceptance Criteria

- [ ] Given an admin navigates to `/admin/listings`, a table of all listings renders with the columns: checkbox, name, entity type, city, category, status badge, trust tier badge, created date, actions
- [ ] Given filters are applied (e.g., `?status=pending`), only matching listings render; the URL reflects the applied filters
- [ ] Given an admin clicks "Approve" on a pending listing in the actions kebab, the confirmation popover renders; clicking "Confirm Approve" calls `approveEntity` SA and the row's status badge updates to Published
- [ ] Given an admin clicks "Reject" on a pending listing, the rejection reason dialog renders; submitting a reason calls `rejectEntity` SA and the row status updates
- [ ] Given a valid approval action completes, a success toast confirms "Listing approved and published."
- [ ] Given `INVALID_STATUS_TRANSITION` is returned, a toast error shows and the row's status badge reverts to its pre-action state
- [ ] Given the "Delete" action is confirmed, the row is removed from the table (soft delete in DB); a destructive toast confirms "[Name] deleted."
- [ ] Given no filters are applied, all listing statuses are shown; the "All" filter tab is active
- [ ] On mobile at 375px, the table shows only Name, Status badge, and Actions; other columns are hidden

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| Approve INVALID_STATUS_TRANSITION | Listing is not in `pending` status | Toast: "This listing cannot be approved in its current state." | No action needed; row state rolled back |
| Reject missing reason | Admin submits rejection with empty textarea | Inline error: "Rejection reason is required" | Admin enters reason and resubmits |
| SA SERVER_ERROR | Approve or reject returns 500 | Toast: "Action failed. Please try again." | Admin retries; optimistic update reverted |
| Delete confirmation skipped | Accidental click on "Delete permanently" | Dialog requires explicit "Delete permanently" button click — can't be accidentally triggered by one click | Admin clicks Cancel |
| Filter combination returns 0 | No listings match applied filters | "No listings match your filters." with Clear filters button | Admin clears filters |
| Listings fetch failure | Service_role query fails on page load | Next.js `error.tsx` with retry | Admin refreshes page |

## Edge Cases

- Listing name is very long (200 chars): truncate in table cell with `text-ellipsis overflow-hidden max-w-[200px]`; full name visible in the detail view
- Admin approves a listing that was already approved by another admin simultaneously: `INVALID_STATUS_TRANSITION` — handled
- 0 listings on page (all deleted between page load and current render): empty state renders; not a 404
- Admin applies a filter with an invalid status value (URL manipulation): server-side zod validation on `searchParams`; invalid values ignored or return `400` which shows the empty state
- Bulk select → Flag: selecting all 50 on current page shows a bar "50 selected" with "Flag selected" button; navigating to next page clears selection

## Accessibility Notes

- [ ] The table has `<caption>` or `aria-label="Admin listings"` on the `<table>` element
- [ ] Sortable column headers are `<button>` elements within the `<th>` — not styled spans
- [ ] Each row's checkbox has `aria-label="Select [Listing Name]"`
- [ ] The header checkbox has `aria-label="Select all listings on this page"` and `aria-checked="mixed"` when partially selected
- [ ] Approve/reject/delete dialogs trap focus and return focus to the triggering button on close
- [ ] Toast notifications use `role="status"` or `role="alert"` depending on urgency

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-1 | Table loads | Admin navigates to `/admin/listings` | Table renders with rows, all columns visible, pagination controls present |
| QA-2 | Status filter | Apply `status=pending` filter | Only pending listings show; URL updates to `?status=pending` |
| QA-3 | Inline approve | Kebab → Approve → Confirm on a pending listing | Row status badge changes to "Published"; success toast shown |
| QA-4 | Inline reject | Kebab → Reject → enter reason → Confirm on a pending listing | Row status updates; rejection reason stored in `moderation_notes` |
| QA-5 | Delete confirmation | Kebab → Delete → "Delete permanently" | Row removed from table; soft delete confirmed in DB (`deleted_at` set) |

## Security Notes

- All mutations (`approveEntity`, `rejectEntity`) use service_role client in the SA and write to `admin_audit_log` atomically — every approval and rejection is auditable
- The admin role check in `layout.tsx` (Ticket 037) is the primary gate; this page does not duplicate the check but relies on it
- `include_deleted` filter is admin-only functionality — it is not exposed in any public API; ensure the Route Handler (if used) validates admin role before honoring `include_deleted=true`
- Rejection reason is stored as `moderation_notes` and emailed to the submitter — ensure it is stored as plain text and rendered safely on the owner-facing side

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Table renders with seeded listings data
- [ ] All filter combinations tested
- [ ] Inline approve SA tested — confirm `status = 'published'` + ISR revalidation fires
- [ ] Inline reject SA tested — confirm `moderation_notes` set + email sent
- [ ] Delete tested — confirm `deleted_at` set in DB
- [ ] Optimistic update + rollback tested (stub SA to fail)
- [ ] Mobile at 375px — reduced columns, filter drawer
- [ ] Keyboard navigation through table rows and menus tested
