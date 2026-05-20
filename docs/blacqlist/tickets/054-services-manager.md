# Ticket 054: Services manager — CRUD + drag-to-reorder (`/dashboard/services`)

## Status
Draft

## Phase
Phase 8: Owner Dashboard

## Priority
P1

## Feature Area
Owner Dashboard

## Context
The `/dashboard/services` screen lets business owners manage the list of services they offer. Services are displayed on the public BLACQList Page in a structured list. This ticket implements Create, Read, Update, and Delete operations for `services` table rows, plus drag-to-reorder via `@dnd-kit`. Each service has: `name` (required), `description` (optional), `price_note` (free-text price display, optional — e.g., "Starting at $50"), `display_order`, and `is_visible`. Add/edit is done inline (no separate edit page — an expandable row form). Delete has an undo toast (optimistic delete with a 5-second undo window before the SA fires). Maximum 20 services per listing (enforced client-side before `createService` SA is called). All mutations trigger `revalidatePath` for the public listing page.

Source documents: `docs/blacqlist/ux/mvp-screen-map.md` (Services Manager), `docs/blacqlist/architecture/server-actions-plan.md` (`addService`, `updateService`, `deleteService`, `reorderServices`), `docs/blacqlist/data/database-schema-plan.md` (`services`).

## User Story
As a business owner, I want to add, edit, reorder, and delete the services my business offers, so that customers can see exactly what I provide and at what price.

## Scope
- `app/dashboard/services/page.tsx` — Server Component that fetches all services for the owner's listing and renders the manager
- `app/dashboard/services/components/ServicesList.tsx` — Client Component: dnd-kit sortable list of service rows
- `app/dashboard/services/components/ServiceRow.tsx` — Client Component: read mode (drag handle, name, optional price, edit icon, delete icon) + edit mode (inline expanded form)
- `app/dashboard/services/components/AddServiceForm.tsx` — Client Component: inline form at the top of the list or a modal triggered by "Add a Service" button; fields: name (required), description (optional), price_note (optional)
- `lib/actions/dashboard/addService.ts`, `updateService.ts`, `deleteService.ts`, `reorderServices.ts` — Server Actions implementing the 7-step pattern
- Max 20 services: "Add a Service" button disabled when count = 20; tooltip explains the limit
- Undo-delete: optimistic delete removes the row from state immediately; a persistent toast shows "Service deleted. Undo?" for 5 seconds; clicking Undo calls a restore path; if undo window expires, the SA fires the actual soft-delete

## Out of Scope
- Per-service CTA type and URL (V1 feature per `services.cta_type`, `services.cta_url`)
- Per-service price with numeric value, price_type, duration_minutes (V1 features per schema)
- `is_visible` toggle per service (deferred — all services visible at MVP)
- Bulk delete

## Dependencies
- Depends on: Ticket 050 (owner dashboard layout, sidebar nav, owner auth guard)
- Depends on: Ticket 010 (`services` table — `id`, `listing_id`, `name`, `description`, `price_note`, `display_order`, `is_visible`)
- Depends on: Ticket 013 (RLS — `services` INSERT/UPDATE/DELETE for authenticated owner), Ticket 014 (auth)
- Note: Ticket 051 page editor has a "Services" section that links to `/dashboard/services` — this ticket implements the target of that link

## UX Notes
- **Screen:** Services Manager — `docs/blacqlist/ux/mvp-screen-map.md` → "Services Manager (`/dashboard/services`)"
- **Route:** `/dashboard/services`
- **Layout:** Dashboard sidebar layout; same sidebar as Dashboard Home and Page Editor
- **Entry points:** Dashboard sidebar nav "Services" item; Page Editor "Services" section link
- **Exit points:** Sidebar nav items
- **Page header:** "Services" heading + count badge ("4 services") + "Add a Service" Amber Gold button (right-aligned)
- **Service rows:** Each row in read mode shows: drag handle (left), service name in Lato Medium, optional price_note in Amber Gold text, edit icon (pencil), delete icon (trash). The entire row is not a link.
- **Edit mode:** Clicking the pencil icon expands an inline form below the row (accordion-style); the row background changes to Pale Lavender `#E9E9F7`. Fields: Name (required), Description (textarea, optional), Price (text input, optional — "e.g., Starting at $50, $75/hr, Free"). Save and Cancel buttons inline.
- **Add form:** Clicking "Add a Service" shows the same inline form at the top of the list (or as a modal at mobile). After saving, the new service appears at the top of the list with display_order = 0 (or at the end — implementation choice, but must be consistent).
- **Drag-to-reorder:** Drag handle (6-dot icon) is visible on hover (desktop) or always visible (mobile). On drop, optimistic reorder updates the list; `reorderServices` SA fires with the new ordered array of IDs.
- **Empty state:** "No services yet. Add your first service to help customers understand what you offer." + "Add a Service" Amber Gold button centered.
- **Mobile (375px):** Service rows are card-style (full width, padding `p-4`). Drag handle is always visible. Edit form expands full-width below the row. "Add a Service" button is full-width at the top.
- **Loading state:** Skeleton rows (gray lines matching service row height)
- **Error state:** SA failure shows a section-level toast with retry
- **Success state:** "Service saved." toast after add/edit; "Service deleted. Undo?" persistent toast after delete

## Design Notes
- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Colors:** Amber Gold `#E2A428` for price_note text and "Add a Service" button; Pale Lavender `#E9E9F7` for expanded edit row background; red destructive for delete confirm button
- **Fonts:** Glacial Indifference Bold for "Services" page heading; Lato Medium for service names; Lato Regular for descriptions; Quicksand Bold Italic for "Add a Service" CTA
- **Components:** shadcn/ui `Input`, `Textarea`, `Label`, `Button` (default, ghost, destructive), `Badge` (count), `Card` for mobile row cards; `@dnd-kit/core` + `@dnd-kit/sortable` for drag; `lucide-react` for edit/delete/drag icons (`GripVertical`, `Pencil`, `Trash2`)
- **States to implement:** Empty, Loading skeleton, Populated list, Edit-mode (row expanded), Dragging (elevation shadow), Deleting (fade out with undo toast), Error, Success (toast)

## Data Notes
- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `services`
- **Fields involved:** `id`, `listing_id`, `name`, `description`, `price_note`, `display_order`, `is_visible` (default true), `created_at`, `updated_at`
- **Operations:**
  - SELECT: `services WHERE listing_id = [id] AND is_visible = true ORDER BY display_order ASC` — fetched in Server Component
  - INSERT via `addService` SA: `name`, `description`, `price_note`, `listing_id`, `display_order = (MAX display_order + 1)`, `is_visible = true`
  - UPDATE via `updateService` SA: `name`, `description`, `price_note`, `updated_at` (trigger)
  - DELETE via `deleteService` SA: soft delete (`is_visible = false` or `deleted_at`) — **Note:** `services` schema has `is_visible` boolean; use `is_visible = false` for "deleted" state since there is no `deleted_at` column on `services` per the schema; confirm with schema plan; alternatively use hard delete if the business rule allows it (services have no FK referencing them at MVP)
  - REORDER via `reorderServices` SA: UPDATE `display_order` for each ID in the ordered array
- **Validation rules:** `name`: required, max 200 chars; `description`: optional, max 500 chars; `price_note`: optional, max 100 chars (free-text)
- **Max services:** 20 — enforced in `addService` SA (COUNT check before INSERT); also enforced client-side (button disabled)
- **RLS:** `services` INSERT/UPDATE/DELETE: only where `listings.owner_user_id = auth.uid()` (join required in policy or service-layer ownership check)
- **Migration required:** No — `services` table exists from Ticket 010

## API Notes
- **Server Actions plan:** `docs/blacqlist/architecture/server-actions-plan.md` → `addService`, `updateService`, `deleteService`, `reorderServices` (all in `lib/actions/dashboard/`)
- **`addService(input)`:** `{ listingId, name, description?, price_note? }` → `ActionResult<{ serviceId: string }>` + `revalidatePath` for listing page
- **`updateService(input)`:** `{ serviceId, listingId, name, description?, price_note? }` → `ActionResult<{ serviceId: string }>` + `revalidatePath`
- **`deleteService(input)`:** `{ serviceId, listingId }` → `ActionResult<{ deleted: true }>` + `revalidatePath` — sets `is_visible = false` (or hard deletes if no referential constraints)
- **`reorderServices(input)`:** `{ listingId, orderedIds: string[] }` → `ActionResult<{ updated: number }>` + `revalidatePath`
- **Auth:** All SAs verify `listings.owner_user_id = auth.uid()` server-side
- **Cache invalidation:** All SAs call `revalidatePath('/[citySlug]/business/[listingSlug]')` when listing is published
- **Error codes:** `AUTH_REQUIRED`, `NOT_FOUND` (service or listing not owned), `VALIDATION_ERROR`, `CONFLICT` (max services reached), `OPERATION_FAILED`

## Implementation Notes
**Files to create:**
- `app/dashboard/services/page.tsx`
- `app/dashboard/services/components/ServicesList.tsx`
- `app/dashboard/services/components/ServiceRow.tsx`
- `app/dashboard/services/components/AddServiceForm.tsx`
- `lib/actions/dashboard/addService.ts`
- `lib/actions/dashboard/updateService.ts`
- `lib/actions/dashboard/deleteService.ts`
- `lib/actions/dashboard/reorderServices.ts`
- `lib/validations/listing.ts` — add `serviceSectionSchema` (name, description, price_note)

**Files to modify:**
- `app/dashboard/layout.tsx` — confirm "Services" nav item routes to `/dashboard/services`

**Key patterns:**
- `@dnd-kit/core` + `@dnd-kit/sortable` — install if not already present (may be added in Ticket 053). Use `SortableContext` + `useSortable` per service row. Use `DndContext` with `PointerSensor` (desktop) and `TouchSensor` (mobile).
- Undo-delete pattern: set a `deletingId` state; use `setTimeout(5000)` to delay the SA call; "Undo" clears `deletingId` before the timeout fires; the row is hidden (opacity 0) during the undo window, then removed on SA success
- `reorderServices` SA updates all `display_order` values by index position; pass `orderedIds` array; SA runs UPDATE in a loop or uses a CASE WHEN expression for batch update
- Keep `ServiceRow` small (under 150 lines); extract the inline edit form as a separate component
- `addService` assigns `display_order = services.length` (append to end) or `0` (prepend); use append to end to avoid reordering all existing rows on every add

**Do not:**
- Use a separate edit page — edit is always inline within the services list
- Hard-delete without a defined business reason — use `is_visible = false` unless the schema plan explicitly allows hard-delete for services
- Show V1 fields (price numeric, price_type, duration_minutes, cta_type) in the MVP form — use only `price_note` (free text)

## Acceptance Criteria
- [ ] `/dashboard/services` renders for an owner with their existing services sorted by `display_order`
- [ ] Empty state shows when no services exist
- [ ] Count badge in the page header shows the current count ("4 services")
- [ ] "Add a Service" button opens the inline add form; filling in only a name and submitting creates a new service row
- [ ] Name field is required; submitting with an empty name shows inline error: "Service name is required."
- [ ] Optional description and price_note fields save correctly when provided
- [ ] Clicking edit (pencil) on a row expands the inline edit form pre-filled with current values; saving updates the row and collapses the form
- [ ] Drag-to-reorder works; dropping fires `reorderServices`; the new order is reflected immediately (optimistic) and confirmed after SA success
- [ ] Deleting a service shows an undo toast for 5 seconds; the row is hidden immediately; confirming (letting the timer expire) fires `deleteService` SA
- [ ] Clicking "Undo" within 5 seconds restores the row; the SA is NOT called
- [ ] When 20 services exist, the "Add a Service" button is disabled with tooltip: "Maximum of 20 services reached."
- [ ] All mutations trigger `revalidatePath` when the listing is published; the public page updates
- [ ] Mobile (375px): service rows display as cards; drag handle visible; edit form expands full-width
- [ ] `tsc --noEmit` and `npm run lint` pass with zero errors

## Failure States
| Failure | User-visible behavior |
|---|---|
| `addService` returns `CONFLICT` (max services reached) | Toast: "You've reached the maximum of 20 services." |
| `addService` / `updateService` returns `VALIDATION_ERROR` | Inline field error below the affected field |
| `deleteService` SA fails | Undo toast replaces with "Couldn't delete service. Try again." Row is restored. |
| `reorderServices` SA fails | Order reverts to previous state; toast: "Couldn't save the new order. Try again." |
| `addService` / `updateService` returns `OPERATION_FAILED` | Toast: "Couldn't save service. Please try again." |
| Session expired | SA returns `AUTH_REQUIRED`; toast with sign-in link |

## Edge Cases
- Owner submits the add form with only whitespace in the name field — trim before validation; zod `.trim().min(1)` catches this
- Owner reorders while another save is in flight — disable the drag handles during an in-progress SA call to avoid race conditions
- Owner has exactly 19 services and adds one more — button state updates to disabled at exactly 20; the new service's row appears
- Two browser tabs with the same owner editing services — last write wins; no conflict detection at MVP; the `updated_at` trigger records the correct timestamp
- Service with very long `price_note` (>100 chars) — SA returns `VALIDATION_ERROR` with field-level message; form shows the error inline
- Owner edits a service while drag-to-reorder is in progress — prevent by disabling edit actions during an active drag

## Accessibility Notes
- [ ] Each service row's edit button has `aria-label="Edit [service name]"`
- [ ] Each service row's delete button has `aria-label="Delete [service name]"`
- [ ] Drag handle has `aria-label="Drag to reorder [service name]"`; dnd-kit keyboard sensor allows reordering with arrow keys
- [ ] The inline edit form has `role="form"` and `aria-label="Edit [service name]"`
- [ ] Error messages are linked to inputs via `aria-describedby`
- [ ] "Undo" button in the toast is keyboard-focusable; toast has `role="alert"` so screen readers announce it
- [ ] Page heading "Services" is `<h1>`; "Add a Service" is a `<button>` not a link

## QA Test Cases
| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| 1 | Add service | Owner | 1. Click "Add a Service". 2. Enter name "Haircuts" and price "From $45". 3. Submit. | New row appears at bottom; count badge increments; SA fires; `revalidatePath` fires if published |
| 2 | Edit service | Owner | 1. Click pencil on first service. 2. Change name. 3. Save. | Row updates inline; toast "Service saved."; SA fires |
| 3 | Delete with undo | Owner | 1. Click delete on a service. 2. Immediately click "Undo". | Row is restored; `deleteService` SA is NOT called |
| 4 | Delete without undo | Owner | 1. Click delete. 2. Wait 5 seconds. | SA fires; row is removed from DB; public page revalidated |
| 5 | Max limit | Owner (20 services) | 1. Try to click "Add a Service". | Button disabled; tooltip visible |

## Security Notes
- All SAs verify ownership server-side; the `listingId` from the client is cross-checked against `listings.owner_user_id = auth.uid()`
- `serviceId` from the client is cross-checked to ensure it belongs to the owner's listing before UPDATE or DELETE
- `display_order` values are set server-side based on the provided ordered array; client-supplied values are not trusted directly

## Completion Checklist
- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading skeleton, empty, populated, error/success toasts)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested (including dnd-kit keyboard sensor)
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
