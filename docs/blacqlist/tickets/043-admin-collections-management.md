# Ticket 043: Admin collections management table and editor (/admin/collections)

---

## Status
Backlog

## Phase
Phase 6: Admin Review and Verification

## Priority
P2 — Medium

## Estimate
L (4–8h)

## Feature Area
Admin / Collections

---

## Context

Admins curate editorial collections of listings that appear on the `/collections` public index, on individual `/collection/[slug]` pages, and in the homepage featured collection slot. This ticket builds the full admin collections management surface: the table at `/admin/collections` and the editor at `/admin/collections/[id]` and `/admin/collections/new`.

A critical business rule governs the `homepage_featured` flag: only one collection may be featured at a time. Setting one unsets all others. This must be enforced at the service layer, not purely in the UI.

When a collection is published or updated, the Next.js ISR cache must be revalidated for the affected collection page and the collections index. If the collection is homepage-featured, the homepage ISR cache must also be revalidated.

Sources: `docs/blacqlist/ux/mvp-screen-map.md` § Admin Collections, Admin Collection Edit; `docs/blacqlist/architecture/server-actions-plan.md` §§ 4, 5, 7; `docs/blacqlist/ux/empty-loading-error-success-states.md` § 14.6.

---

## User Story

As an admin, I want to create and manage editorial collections of listings, control which collection appears on the homepage featured slot, and publish or unpublish collections, so that the platform's editorial surface stays fresh and accurately curated.

---

## Scope

**In scope:**
- `app/admin/collections/page.tsx` — Server Component; table of all collections
- Table columns: title, slug, listing count, published status badge, homepage_featured flag (star icon), created_at
- Table actions per row: "Edit" (→ `/admin/collections/[id]`), "Publish/Unpublish" toggle, "Set as Featured" (one at a time), "Delete" (soft-delete or hard-delete if no published items — confirm dialog required)
- "Create New Collection" button → `/admin/collections/new`
- `app/admin/collections/new/page.tsx` — new collection form (same editor component, no pre-filled data)
- `app/admin/collections/[id]/page.tsx` — editor for existing collection; fetches collection + member listings
- Editor form fields: title (text), slug (auto-generated from title, editable), description (textarea), cover image upload
- Listing search panel: search existing published listings by name → click to add → added listings shown in reorderable list with drag handle and remove button; display_order updated on drop
- Publish toggle (sticky footer or top-of-page banner)
- SAs: `manageCollections` and `manageCollectionItems` from `server-actions-plan.md`
- On publish/update: `revalidatePath('/collection/[slug]')` + `revalidatePath('/collections')`; if `homepage_featured` set: also `revalidatePath('/')` and `revalidatePath('/city/[citySlug]')` for any city featured by the collection
- Loading, empty, and error states per spec

**Out of scope:**
- Public-facing collection pages (Tickets 023/previous)
- Collection analytics
- Multi-image cover gallery
- Collection-specific SEO metadata editor (beyond description used as meta description)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 037 — Admin shell + auth middleware | Blocking ticket | Not started |
| Ticket 011 — `collections` and `collection_items` tables migration | Blocking ticket | Not started |
| `manageCollections` SA — `lib/actions/admin/manageCollections.ts` | Server Action | Not started |
| `manageCollectionItems` SA — `lib/actions/admin/manageCollectionItems.ts` | Server Action | Not started |
| `admin_audit_log` table migration | Database | Must exist |
| `/api/search` or admin listings search endpoint | API | Must exist for listing search panel |

---

## UX Notes

- **Screen:** Admin Collections / Admin Collection Edit — `docs/blacqlist/ux/mvp-screen-map.md` § Admin Collections
- **Routes:** `/admin/collections`, `/admin/collections/new`, `/admin/collections/[id]`
- **Layout:** Admin panel — table view on `/admin/collections`; two-section layout (metadata form top, listing management bottom) on the editor
- **Entry points:** Admin sidebar nav item "Collections"; "Edit" row action in the table
- **Exit points:** "Save" navigates back to `/admin/collections` on success; or stays on editor; breadcrumb back to table
- **Homepage featured flag:** Visually distinct in the table — star icon, highlighted row if active. Setting a new collection as featured removes the flag from any previous one; a confirmation dialog warns: "This will remove [Previous Collection Name] from the homepage featured slot."
- **Drag-to-reorder:** Uses a drag-handle icon per row; order is updated on drop (optimistic UI); SA fires in background
- **Mobile behavior:** Editor listing search panel becomes a full-width search bar above the reorderable list; drag-to-reorder uses up/down arrow buttons instead of drag-and-drop at 375px

**States from `empty-loading-error-success-states.md` § 14.6:**
- Table loading: 5 collection row stubs skeleton
- Table empty: "No collections yet" + "Create collection" button
- Table error: "Collections couldn't load" + "Retry" button
- Create form: saving spinner → success toast "Collection created." → redirect to editor
- Update: toast "Collection saved."
- Delete: confirmation dialog → success toast "Collection deleted." → row removed from table

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components:** shadcn/ui `Table`, `Button`, `Badge`, `Dialog`, `Input`, `Textarea`, `Switch` (publish toggle), `Skeleton`, `DropdownMenu` (row kebab)
- **Published badge:** Green when published, gray when draft
- **Homepage featured:** Amber Gold star icon (`StarIcon`) in the table row when `homepage_featured = true`; tooltip: "Featured on homepage"
- **Editor layout:** Two `Card` sections stacked vertically — metadata card (top), listing management card (bottom)
- **Listing search panel:** Inline search input → results below as selectable rows; added listings shown in a `DragToReorderTable` sub-component
- **Cover image upload:** Same `MediaUploadField` component as other forms; 16:9 recommended; max 5MB
- **Sticky publish toggle:** `Switch` component in a sticky bar at the bottom of the editor; label: "Published" / "Draft"
- **States to implement:** Loading, Idle, Saving, Saved, Error, Empty (table), Delete confirm

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `collections`, `collection_items`, `listings`
- **Entities involved:** `collections`, `collection_items`, `listings` (for search and preview), `admin_audit_log`
- **Operations:**
  - `manageCollections` (create): INSERT `collections`; audit log `collection_created`
  - `manageCollections` (update title/slug/description/cover/published/homepage_featured): UPDATE `collections`; if `homepage_featured = true`, UPDATE all other collections SET `homepage_featured = false` in same transaction; audit log `collection_updated`
  - `manageCollections` (delete): DELETE or soft-delete `collections`; audit log `collection_deleted`
  - `manageCollectionItems` (add): INSERT `collection_items`; audit log `collection_item_added`; revalidate collection page
  - `manageCollectionItems` (remove): DELETE `collection_items`; audit log `collection_item_removed`
  - `manageCollectionItems` (reorder): UPDATE `display_order` for all items in collection
- **Validation rules:**
  - `title`: required; max 200 chars
  - `slug`: required; max 200 chars; unique across `collections`; lowercase alphanumeric and hyphens only; auto-generated from title but editable
  - `description`: optional; max 1000 chars
  - `homepage_featured`: only one collection may have `homepage_featured = true` at a time — enforced via transaction
- **RLS policies:** Admin-only; write access via service_role client in SAs
- **Migration required:** No — `collections` and `collection_items` tables from Ticket 011

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/server-actions-plan.md` § 4 (Admin) + § 5 (Cache Invalidation)

**Server Actions involved:**

| Action | File | What it does |
|---|---|---|
| `manageCollections` | `lib/actions/admin/manageCollections.ts` | Create, update, or delete a collection; homepage_featured clear-then-set; audit log; cache revalidation |
| `manageCollectionItems` | `lib/actions/admin/manageCollectionItems.ts` | Add, remove, or reorder listings in a collection; audit log; collection page cache revalidation |

**Cache invalidation per `server-actions-plan.md` § 5:**
- `manageCollections`: `revalidatePath('/collection/[slug]')` + `revalidatePath('/collections')`
- If `homepage_featured` is being set: also `revalidatePath('/')` (homepage featured slot)
- `manageCollectionItems`: `revalidatePath('/collection/[slug]')`

**Error codes to handle:**

| Code | Condition | UI shows |
|---|---|---|
| `AUTH_REQUIRED` | Session expired | Redirect to `/sign-in?next=[current-url]` |
| `FORBIDDEN` | Not admin | Redirect to `/dashboard` |
| `VALIDATION_ERROR` | Slug not unique, title missing | Inline field errors in the form |
| `CONFLICT` | Slug already exists | Inline error: "This slug is already in use. Choose a different one." |
| `OPERATION_FAILED` | DB error | Toast: "Couldn't save. Try again." |

---

## Implementation Notes

**Files to create:**
- `app/admin/collections/page.tsx` — Server Component; collections table
- `app/admin/collections/new/page.tsx` — renders `CollectionEditor` with no initial data
- `app/admin/collections/[id]/page.tsx` — fetches collection + items; renders `CollectionEditor`
- `components/admin/collections/CollectionsTable.tsx` — table with row actions
- `components/admin/collections/CollectionEditor.tsx` — "use client"; metadata form + listing search + reorderable list + publish toggle
- `components/admin/collections/ListingSearchPanel.tsx` — "use client"; debounced search input → result rows → add to collection
- `components/admin/collections/ReorderableListingList.tsx` — "use client"; drag-and-drop reorderable rows using a lightweight DnD library (use `@dnd-kit/core` if already installed; otherwise use native HTML5 drag events — do not add a new package without checking)
- `lib/actions/admin/manageCollections.ts` — Server Action
- `lib/actions/admin/manageCollectionItems.ts` — Server Action

**Files to modify:**
- `app/admin/layout.tsx` (or sidebar) — ensure "Collections" nav item links to `/admin/collections`

**Key patterns:**
- `homepage_featured` clear-then-set: within `manageCollections`, if `homepage_featured = true`, first `UPDATE collections SET homepage_featured = false WHERE id != $collectionId`, then `UPDATE collections SET homepage_featured = true WHERE id = $collectionId` — both in the same DB transaction
- Slug auto-generation: `useEffect` on the `title` field to generate slug (`title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')`) when slug has not been manually edited; once the admin manually edits the slug field, auto-generation stops
- Drag-to-reorder: optimistic UI — reorder updates local state immediately on drop; SA fires to persist new `display_order` values; rollback on error
- Follow the 7-step Server Action pattern from `server-actions-plan.md` § 3
- `insertAuditLog` called in Step 5 for all mutations; snapshot `before_state` and `after_state` for updates

**Do not:**
- Allow more than one `homepage_featured = true` collection — enforce at service layer, not just UI
- Auto-publish a collection on creation — default `is_active = false` (draft)
- Hard-delete a collection that has linked `collection_items` without first deleting the items or confirming cascade

---

## Acceptance Criteria

- [ ] Given the admin navigates to `/admin/collections`, then a table renders with columns: title, slug, listing count, published status, homepage_featured star, created_at, and row actions
- [ ] Given the admin clicks "Create New Collection", then they are navigated to `/admin/collections/new` with an empty editor form
- [ ] Given the admin fills in title, description, and uploads a cover image, then the slug auto-generates from the title; the admin can manually override the slug
- [ ] Given the admin uses the listing search panel to add a listing, then the listing appears in the reorderable list below; dragging rows reorders them and the `display_order` is persisted on drop
- [ ] Given the admin clicks the publish toggle, then the collection's `is_active` field updates; on publish: `revalidatePath('/collection/[slug]')` and `revalidatePath('/collections')` are called
- [ ] Given the admin sets a collection as homepage-featured, then all other collections have `homepage_featured = false` and the target collection has `homepage_featured = true`; the homepage ISR cache is revalidated; the previous featured collection's star is removed in the table
- [ ] Given two collections are homepage-featured simultaneously (impossible in normal UI flow but attempted via concurrent sessions), then the service layer enforces only one at a time
- [ ] Given the admin clicks "Delete" on a collection, then a confirmation dialog opens; on confirm the collection is deleted and the row is removed from the table with a success toast
- [ ] Loading state: 5 skeleton row stubs on the table while data fetches
- [ ] Empty state: "No collections yet" + "Create collection" button (Amber Gold)
- [ ] Error state: "Collections couldn't load" + "Retry" button
- [ ] Slug uniqueness: if the admin enters a slug already in use, an inline error appears and the save is blocked
- [ ] Mobile at 375px: editor listing search and reorder list are usable; drag-to-reorder falls back to up/down arrow buttons

---

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| Save fails | DB error on create/update | Toast: "Couldn't save. Try again." Form values preserved | Retry |
| Slug conflict | Slug already in use | Inline error below slug field: "This slug is already in use." Save blocked | Change slug |
| Listing add fails | SA fails when adding listing to collection | Toast: "Couldn't add listing. Try again." | Retry |
| Reorder fails | SA fails on drop | Optimistic reorder rolls back; original order restored; toast: "Reorder failed. Try again." | Re-drag |
| Delete fails | DB error | Toast: "Couldn't delete collection. Try again." Row stays in table | Retry |
| Session expired | 401 | Redirect to `/sign-in?next=[current-url]` | Re-authenticate |
| Homepage featured conflict | Concurrent sessions try to set two featured | Second request clears the first | Expected behavior — no user error needed |

---

## Edge Cases

- Slug auto-generated from a title with special characters (e.g., "Black Entrepreneurs & Makers") — resulting slug: `black-entrepreneurs-makers`; strip `&` and consecutive hyphens
- Admin removes all listings from a collection — listing count shows `0`; collection can still be published but will show the empty collection state on the public page
- Admin deletes a collection that is currently homepage-featured — after deletion the homepage featured slot is empty; homepage should hide the slot (per screen map: if no featured collection, slot is hidden)
- Cover image upload fails mid-editor — inline upload error shown; rest of the form remains editable; save is allowed without a cover image

---

## Accessibility Notes

- [ ] All form inputs have associated labels (`htmlFor` or `aria-label`)
- [ ] Drag-to-reorder: each row has `role="listitem"` and the container has `role="list"`; at 375px the arrow button alternative is keyboard-operable
- [ ] Publish toggle has a visible label and `aria-checked` state
- [ ] Dialog (delete confirm, homepage-featured confirmation) traps focus and returns focus to the triggering button on close
- [ ] Success and error toasts use `role="alert"`
- [ ] Skeleton rows include `aria-busy="true"` on the container

---

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-1 | Create and publish collection | 1. Click "Create New Collection". 2. Fill title, slug, description. 3. Add 3 listings via search. 4. Toggle Publish. | Collection is published. `/collection/[slug]` and `/collections` ISR caches revalidated. Table shows collection with Published badge. |
| QA-2 | Homepage featured: one at a time | 1. Set Collection A as homepage-featured. 2. Set Collection B as homepage-featured. | Collection A's `homepage_featured = false`. Collection B's `homepage_featured = true`. Homepage ISR cache revalidated. Table reflects correctly. |
| QA-3 | Reorder listings | 1. Open a collection editor with 3+ listings. 2. Drag listing 3 to position 1. | `display_order` updates immediately in UI. SA persists new order. On page refresh, order is preserved. |
| QA-4 | Slug uniqueness | 1. Create collection with slug `black-owned-atlanta`. 2. Create a second collection with the same slug. | Second save blocked. Inline error: "This slug is already in use." |
| QA-5 | Mobile at 375px | 1. Open collection editor on 375px device. 2. Add a listing. 3. Reorder using arrow buttons. | Full functionality accessible without horizontal overflow. Drag fallback (arrow buttons) works. |
| QA-6 | Delete collection | 1. Click "Delete" on a collection. 2. Confirm the dialog. | Collection deleted. Row removed from table. Toast: "Collection deleted." |

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] `manageCollections` SA: create, update, delete all tested; audit log entries verified
- [ ] `manageCollectionItems` SA: add, remove, reorder all tested; audit log entries verified
- [ ] `homepage_featured` enforced: only one collection can be featured at a time (tested with concurrent sessions)
- [ ] Cache revalidation verified: `/collection/[slug]`, `/collections`, and `/` (for homepage-featured) revalidated after relevant mutations
- [ ] Slug auto-generation tested with special characters
- [ ] Drag-to-reorder tested; rollback on failure tested
- [ ] Loading, empty, error states tested
- [ ] Mobile tested at 375px — arrow button reorder fallback works
- [ ] Keyboard navigation tested — dialogs focus correctly
