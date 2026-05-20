# Ticket 061: Admin collection editor — create, add/remove/reorder listings, publish

## Status

Draft

## Phase

Phase 10: Editorial

## Priority

P2

## Estimate

L (4–8h)

## Feature Area

Editorial / Admin

---

## Context

Ticket 043 built the admin collections table at `/admin/collections` — the list view where collections are browsed and high-level actions (publish toggle, set featured) are triggered. This ticket builds the full editor that lives behind that list: the `/admin/collections/[id]` route and the `/admin/collections/new` route. The editor is where admins author the collection itself (title, slug, description, cover image, collection type) and manage its member listings (search, add, reorder via drag-to-reorder, remove).

This is distinct from Ticket 043 because Ticket 043 is the list view; this is the per-collection detail editor. A developer can complete this ticket after Ticket 043 is merged without touching the list view.

Sources: `docs/blacqlist/ux/mvp-screen-map.md` § Admin Collection Edit; `docs/blacqlist/architecture/server-actions-plan.md` §§ 4, 5; `docs/blacqlist/data/database-schema-plan.md` § collections, collection_items.

---

## User Story

As an admin, I want to create a collection, add and reorder listings within it, and publish it, so that curated editorial content surfaces to platform visitors in the collections index, individual collection pages, and the homepage featured slot.

---

## Scope

**In scope:**

- `app/admin/collections/new/page.tsx` — new collection form (blank editor)
- `app/admin/collections/[id]/page.tsx` — editor for an existing collection; fetches collection data + current member listings server-side
- `components/admin/collections/CollectionEditorForm.tsx` — shared form component used by both new and edit routes
- Form fields: title (text, required), slug (auto-generated from title on create, manually editable, validated for URL-safety), description (textarea, optional), cover image upload (calls `POST /api/upload` → `listing-media` bucket, stores path, renders preview), `collection_type` (Select — values defined in `collections` schema)
- Listing search panel: typeahead input querying published listings by name (debounced — 300ms — against `/api/search` or a service-layer DB query); results list showing listing name + category + city; click to add → appends to member list
- Member listing list: shows current `collection_items` ordered by `display_order`; drag-to-reorder (use `@dnd-kit/core` or native HTML5 drag — check if already installed before adding a new package); remove (×) button per item; `display_order` is a 1-indexed integer updated on drop
- Publish/unpublish toggle: sets `is_published` on `collections`; disabled on new (unsaved) collection
- `homepage_featured` toggle: checkbox or toggle switch; only one collection may be `homepage_featured = true` at a time — enforced in `manageCollections` SA (sets all others to false before setting the new one); UI reflects current state
- On save/update: call `manageCollections` SA; on member add/remove/reorder: call `manageCollectionItems` SA
- On publish/update: `revalidatePath('/collection/[slug]')` + `revalidatePath('/collections')` (handled inside SAs per server-actions-plan.md §5); if `homepage_featured` set: also `revalidatePath('/')` (handled by SA)
- Inline success toast after each SA call
- All four states (loading skeleton, empty for new collection, error banner, success toast)

**Out of scope:**

- Public-facing collection page UI (separate ticket, Phase 2 scope)
- Collection analytics / view counts
- Multi-image cover gallery (single cover image only at MVP)
- Bulk-import listings into a collection via CSV
- Collection duplicate / copy action

---

## Dependencies

| Dependency                                                                | Type                                              | Status      |
| ------------------------------------------------------------------------- | ------------------------------------------------- | ----------- |
| Ticket 037 — Admin layout, nav, auth guard                                | Blocking ticket                                   | Not started |
| Ticket 043 — Admin collections table (`/admin/collections`)               | Blocking ticket (provides navigation entry point) | Not started |
| Ticket 011 — `collections` and `collection_items` tables                  | Blocking ticket                                   | Not started |
| `manageCollections` SA (`lib/actions/admin/manageCollections.ts`)         | Server Action                                     | Not started |
| `manageCollectionItems` SA (`lib/actions/admin/manageCollectionItems.ts`) | Server Action                                     | Not started |
| `POST /api/upload` Route Handler — Ticket 030                             | Blocking ticket (cover image upload)              | Not started |
| `admin_audit_log` table (Ticket 012)                                      | Database                                          | Must exist  |
| Search endpoint or internal listing search helper                         | API                                               | Must exist  |

---

## UX Notes

- **Screen:** Admin Collection Edit — `docs/blacqlist/ux/mvp-screen-map.md` § Admin Collection Edit
- **Routes:** `/admin/collections/new`, `/admin/collections/[id]`
- **Entry points:** "Create New Collection" button on `/admin/collections`; "Edit" button on a collection row in the table
- **Exit points:** After save → stays on editor with success toast; breadcrumb "← Collections" navigates back to `/admin/collections`
- **Publish toggle placement:** Sticky footer bar OR top-right header area — must always be visible without scrolling so admin does not have to scroll to the bottom to publish
- **Slug field:** Auto-generates from title on first keystroke (replace spaces with hyphens, lowercase, strip special chars); becomes manually editable after first save; show a preview URL: `theblacqlist.com/collection/[slug]`
- **Cover image:** Show upload dropzone when no image exists; show image preview + "Replace" button when an image is uploaded; store path only, generate URL at render time
- **Member listing drag-to-reorder:** Drag handle icon (grip dots, `GripVertical` from lucide-react) on the left of each member row; full row is draggable; visual drop indicator on drag-over
- **Mobile:** The editor is admin-only and primarily used on desktop. A functional mobile layout is required but not optimized for frequent mobile use. Stack form fields single-column. Drag-to-reorder degrades to up/down arrow buttons on touch devices.

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components to use:** `Card`, `CardHeader`, `CardContent`, `Input`, `Textarea`, `Label`, `Button`, `Select`, `Switch`, `Badge`, shadcn/ui `Separator`, `ScrollArea` (for the member listing list if it grows long), `Skeleton` for loading states
- **Cover image upload:** Use the same upload pattern as Ticket 030 — `<input type="file" accept="image/*">` triggers upload to `/api/upload`; on response, store the returned `file_path` in form state and render `<Image>` preview
- **Member listing list item:** `flex` row — `GripVertical` icon (Charcoal, 20px) | listing name (Lato, 14px, truncated) | category badge (Pale Lavender `Badge`) | city text (Charcoal, 12px) | `X` remove button (Ghost `Button`, right-aligned)
- **Publish toggle:** `Switch` component with label "Published" — Amber Gold when on, gray when off; accompanied by status text: "Published" / "Draft"
- **States to implement:** Loading skeleton (form fields + member list), Error (SA error banner at top of form), Success (toast notification)

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` § collections, collection_items, listings
- **Entities involved:** `collections`, `collection_items`, `listings`, `media_attachments` (cover image path stored on `collections.cover_image_path`)
- **Operations:**
  - SELECT `collections` by ID (server-side page load)
  - SELECT `collection_items` WHERE `collection_id = ?` ORDER BY `display_order` (server-side)
  - SELECT `listings` by IDs from collection_items (JOIN for names + categories + cities)
  - INSERT into `collections` (`manageCollections` SA)
  - UPDATE `collections` (`manageCollections` SA)
  - INSERT into `collection_items` (`manageCollectionItems` SA)
  - DELETE from `collection_items` (`manageCollectionItems` SA)
  - UPDATE `collection_items.display_order` bulk update on reorder (`manageCollectionItems` SA — array of `{id, display_order}` pairs)
  - UPDATE `collections.homepage_featured = false` WHERE `id != ?` (inside `manageCollections` SA when `homepage_featured` is set)
- **Key fields on `collections`:** `id`, `title`, `slug` (UNIQUE), `description`, `cover_image_path`, `collection_type`, `is_published`, `homepage_featured`, `created_at`, `updated_at`
- **Key fields on `collection_items`:** `id`, `collection_id`, `listing_id`, `display_order` (integer, 1-indexed), `created_at`
- **Validation rules:**
  - `title`: required, max 100 chars
  - `slug`: required, URL-safe (`/^[a-z0-9-]+$/`), unique across `collections` — check before save, return `DUPLICATE` error if taken
  - `description`: optional, max 500 chars
  - `collection_type`: required, must be a valid enum value from `collections.collection_type`
  - `display_order`: positive integer; must be contiguous after reorder (1, 2, 3, ... N)
- **Migration required:** No — `collections` and `collection_items` tables are created in Ticket 011

---

## API Notes

- **SA: `manageCollections`** (`lib/actions/admin/manageCollections.ts`)
  - Auth required: `admin` or `super_admin` role (checked by querying `user_roles` server-side)
  - Handles: create collection, update collection fields, publish/unpublish, set/unset `homepage_featured`
  - On `homepage_featured = true`: updates all other `collections.homepage_featured = false` in the same transaction
  - Writes to `admin_audit_log` (action: `collection_created` or `collection_updated`)
  - On success: `revalidatePath('/collection/[slug]')` + `revalidatePath('/collections')` + `revalidatePath('/')` if homepage_featured changed
  - Returns: `ActionResult<{ id: string; slug: string }>`

- **SA: `manageCollectionItems`** (`lib/actions/admin/manageCollectionItems.ts`)
  - Auth required: `admin` or `super_admin` role
  - Handles: add item (INSERT), remove item (DELETE), reorder items (bulk UPDATE of `display_order`)
  - Reorder input: `{ collectionId: string; items: Array<{ id: string; display_order: number }> }`
  - On success: `revalidatePath('/collection/[slug]')` (slug fetched from `collections` using `collectionId`)
  - Writes to `admin_audit_log`

- **`POST /api/upload`** (Ticket 030) — for cover image upload to `listing-media` bucket
  - Request: `multipart/form-data` with `file` and `entity_type: 'listing'`
  - Response: `{ data: { file_path: string } }`

---

## Implementation Notes

**Files to create:**

- `app/admin/collections/new/page.tsx` — new collection page (renders `CollectionEditorForm` with no initial data)
- `app/admin/collections/[id]/page.tsx` — edit page (fetches collection + items server-side, passes as props to `CollectionEditorForm`)
- `components/admin/collections/CollectionEditorForm.tsx` — Client Component (`"use client"`); handles all form state, drag-to-reorder, SA calls
- `components/admin/collections/CollectionMemberList.tsx` — drag-to-reorder member listing list (subcomponent of editor)
- `components/admin/collections/ListingSearchPanel.tsx` — typeahead search panel for adding listings

**Files to modify:**

- `app/admin/collections/page.tsx` — add "Edit" link per row pointing to `/admin/collections/[id]` (if not already present from Ticket 043)

**Key patterns:**

- Follow the seven-step Server Action pattern from `docs/blacqlist/architecture/server-actions-plan.md` § 3 in both SAs
- Return `ActionResult<T>` — never throw; use `'error' in result` to branch in the form component
- Use `react-hook-form` + `zod` for all form validation in `CollectionEditorForm`
- Use `useFormState` / `useActionState` to wire `manageCollections` SA to the form
- For drag-to-reorder: prefer `@dnd-kit/sortable` if already in the project; do NOT add a new package if a simpler approach exists — confirm with package.json first
- Cover image upload: fire `POST /api/upload` from the Client Component via `fetch`; on success, set `cover_image_path` in form state; render preview via `supabase.storage.from('listing-media').getPublicUrl(path).data.publicUrl`
- `slug` auto-generation: `title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')`; debounce 300ms; stop auto-generating after first manual edit

**Do not:**

- Call `revalidatePath` from the Client Component — it is handled inside the SAs
- Store CDN URLs for the cover image — store `file_path` from the upload response
- Use `getSession()` — use `getUser()` in the SAs
- Add a drag library if HTML5 native drag handles the case adequately

---

## Acceptance Criteria

- [ ] Given an admin is on `/admin/collections/new`, when they fill in title, description, and collection type and click Save, then a new collection row is created in `collections` with `is_published = false` and the admin is shown a success toast
- [ ] Given a collection exists, when the admin searches for a listing by name in the search panel and clicks Add, then the listing appears at the bottom of the member list and a `collection_items` row is inserted
- [ ] Given a collection has multiple members, when the admin drags a member row to a new position and drops it, then `display_order` values are updated for all affected rows and persisted on the next Save
- [ ] Given a member listing is in the list, when the admin clicks the × remove button, then the `collection_items` row is deleted and the member disappears from the list
- [ ] Given a collection exists in draft state, when the admin clicks the Publish toggle and saves, then `is_published = true` is set and `revalidatePath('/collection/[slug]')` and `revalidatePath('/collections')` fire
- [ ] Given the admin sets `homepage_featured = true` on a collection, then all other `collections.homepage_featured` values are set to `false` in the same operation, and only the selected collection has `homepage_featured = true` after the save
- [ ] Given an admin enters a slug that is already taken by another collection, when they save, then a validation error "This slug is already in use" appears under the slug field
- [ ] Given a cover image is uploaded, when the form is rendered, then the stored `file_path` is used to generate a public URL for the preview — no CDN URL is persisted in `collections.cover_image_path`
- [ ] Loading state: the edit page renders a skeleton for the form fields and member list while server-side data fetches are in progress
- [ ] Error state: if a SA call returns `{ error, code }`, an error banner appears at the top of the form with the human-readable error message
- [ ] Mobile at 375px: all form fields are reachable, drag-to-reorder degrades to up/down arrow buttons, Publish toggle is visible without horizontal scroll

---

## Failure States

| Failure                                                  | User-visible behavior                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `manageCollections` SA returns `DUPLICATE` code for slug | Inline field error: "This slug is already in use. Try a different one."                     |
| `manageCollections` SA returns `VALIDATION_ERROR`        | Inline errors under each invalid field; form not cleared                                    |
| `POST /api/upload` fails for cover image                 | Error toast: "Image upload failed. Please try again." Image preview remains blank           |
| `manageCollectionItems` SA fails on add                  | Error toast: "Could not add listing. Please try again." Member list unchanged               |
| `manageCollectionItems` SA fails on reorder              | Error toast: "Could not save new order. Please try again." List reverts to previous order   |
| Server error (500) on page load                          | Full-page error boundary: "Something went wrong loading this collection." with retry button |
| Network timeout during SA call                           | Error banner: "Save failed — check your connection and try again."                          |

---

## Edge Cases

- Slug field: if the admin types a slug with uppercase letters or spaces, normalize on blur (lowercase, spaces → hyphens)
- If a listing added to the collection is later unpublished, it should still appear in the editor list (admin can see and remove it) but should not appear on the public collection page (filtered at read time)
- Reorder with a single member: up/down arrows are both disabled; drag-to-reorder is a no-op
- Cover image > 5MB: show client-side size error before upload ("Image must be under 5MB")
- Admin navigates away from the editor with unsaved changes: no unsaved-changes warning at MVP (acceptable — admin flows are not high-stakes rapid-entry)
- `homepage_featured` already set on another collection when the admin sets it on this one: the SA must handle the race condition — UPDATE with a single transaction setting all others to false before setting this one

---

## Accessibility Notes

- [ ] All form inputs have associated `<label>` elements (not placeholder-only)
- [ ] Drag handles have `aria-label="Drag to reorder"` and `role="button"` with keyboard support (up/down arrow keys move items when the drag handle is focused)
- [ ] Error messages are linked to their input via `aria-describedby`
- [ ] The Publish toggle (`Switch`) has `aria-label="Published"` and communicates state via `aria-checked`
- [ ] Error banners use `role="alert"` so screen readers announce them
- [ ] Focus returns to the trigger button after a modal or dialog closes

---

## QA Test Cases

| #    | Scenario                        | Role  | Steps                                                                                                                      | Expected result                                                                                                                 |
| ---- | ------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| QA-1 | Create and publish a collection | admin | Navigate to `/admin/collections/new`; fill in title, slug, description; click Save; click Publish toggle; click Save again | Collection created with `is_published = true`; success toast shown; `/collection/[slug]` route resolves with collection content |
| QA-2 | Add a listing to a collection   | admin | Open an existing collection; type listing name in search panel; click Add                                                  | Listing appears at bottom of member list; `collection_items` row exists in DB                                                   |
| QA-3 | Reorder members                 | admin | Open a collection with 3+ members; drag second item to first position                                                      | `display_order` updated in DB: previously second item now has `display_order = 1`                                               |
| QA-4 | Duplicate slug validation       | admin | On `/admin/collections/new`, enter a slug already used by another collection; click Save                                   | Inline error under slug field: "This slug is already in use." No new collection created                                         |
| QA-5 | homepage_featured enforcement   | admin | Set `homepage_featured = true` on Collection A; then open Collection B and set `homepage_featured = true`; save            | Collection A now has `homepage_featured = false`; Collection B has `homepage_featured = true`; only one is featured             |

---

## Security Notes

- Auth check in both SAs: query `user_roles` for `role IN ('admin', 'super_admin')` for `auth.uid()`. Never trust JWT claims.
- `manageCollections` and `manageCollectionItems` SAs use `createServiceRoleClient()` for writes that bypass RLS — never expose the service role key in client-side code
- Validate all inputs with zod schemas before any DB operation (Step 2 of the seven-step pattern)
- The listing search panel must only return `status = 'published' AND deleted_at IS NULL` listings — never expose draft or flagged listings to the panel

---

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading skeleton, empty for new collection, error banner, success toast)
- [ ] Mobile tested at 375px (including degraded drag-to-reorder)
- [ ] Keyboard navigation tested (tab order, drag handle keyboard support)
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
