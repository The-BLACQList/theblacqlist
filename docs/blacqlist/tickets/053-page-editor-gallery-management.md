# Ticket 053: Page editor — gallery management (upload, reorder, delete)

## Status

Draft

## Phase

Phase 8: Owner Dashboard

## Priority

P1

## Feature Area

Owner Dashboard

## Context

Gallery management within the page editor at `/dashboard/page`. Owners can upload new gallery images, reorder them via drag-and-drop, and delete individual images. Gallery images are stored as rows in `media_attachments` with `entity_type='listing'` and `entity_id=listings.id`. Upload goes through `POST /api/upload` (Ticket 030) targeting the `listing-media` bucket with `media_role='gallery'`. Reorder fires `reorderMedia` SA to update `display_order` on affected rows. Delete fires `deleteMedia` SA, which sets `deleted_at` on the `media_attachments` row and also removes the file from Supabase Storage. The free tier is capped at 6 gallery images; standard/premium at 12. This ticket implements the `GallerySection` component used inside the page editor.

Source documents: `docs/blacqlist/ux/mvp-screen-map.md` (Page Editor — Gallery section), `docs/blacqlist/architecture/server-actions-plan.md` (`deleteMedia`, `updateMediaAltText`, `reorderMedia`), `docs/blacqlist/data/database-schema-plan.md` (`media_attachments`).

## User Story

As a business owner, I want to upload, reorder, and delete gallery images on my BLACQList Page, so that visitors see my best work in the order I choose.

## Scope

- `app/dashboard/page/components/GallerySection.tsx` — Client Component: thumbnail grid of existing gallery images + drag-to-reorder + delete per image + upload button
- Upload: `<input type="file" multiple accept="image/*">` or camera capture on mobile (`capture="environment"`); each file POSTs to `POST /api/upload`; on success, a new `media_attachments` row is created by the upload handler; a `revalidatePath` fires via `reorderMedia` or `deleteMedia` SA after the upload is reflected
- Reorder: `dnd-kit` for drag-and-drop; on drop, fire `reorderMedia` SA with the new ordered array of `media_attachment_id`s
- Delete: icon button on each thumbnail; opens a confirmation toast / inline confirm; fires `deleteMedia` SA; SA soft-deletes the DB row (`deleted_at = now()`) and deletes the file from Supabase Storage
- Image count indicator: "4 / 6 photos" (free tier) or "4 / 12 photos" (standard/premium); upload button is disabled when at cap
- Progress indicator per upload (individual file progress via XHR or fetch with `ReadableStream`)
- Mobile: scrollable horizontal strip of thumbnails; upload button always visible

## Out of Scope

- Alt text editing per image (separate SA `updateMediaAltText` — deferred to a post-MVP polish ticket)
- Portfolio primary image toggle (Creative entity type — Beta)
- Bulk image delete
- Cover image and logo (managed in Ticket 051's HeroSection)

## Dependencies

- Depends on: Ticket 051 (page editor shell — `PageEditorShell`, page component, layout)
- Depends on: Ticket 030 (`POST /api/upload` Route Handler — must exist for upload to work)
- Depends on: Ticket 010 (`media_attachments` table), Ticket 013 (RLS), Ticket 014 (auth)
- Note: Ticket 022 (`GallerySection` on the public page) defines the display-side; this ticket is the editor-side management of the same data

## UX Notes

- **Screen:** Page Editor — `docs/blacqlist/ux/mvp-screen-map.md` → "Page Editor — Gallery section"
- **Route:** `/dashboard/page` (GallerySection component within the editor)
- **Entry point:** Scroll to Gallery section within the page editor
- **Gallery grid:** Thumbnails displayed in a 3-column grid (desktop), 2-column (tablet), horizontal scrollable strip (mobile). Each thumbnail: image preview (object-fit cover, 1:1 aspect ratio), drag handle (top-left), delete button (top-right × icon). Drag handle is only visible on non-touch devices; on touch, use long-press-to-drag (dnd-kit touch sensor).
- **Upload button:** Full-width secondary button below the grid: "Add photos (4 / 6)". On desktop: opens file picker (multiple select). On mobile: opens choice between "Camera" and "Photo library" via OS default behavior when `accept="image/*"` is used without `capture`.
- **Upload progress:** Per-image progress bar appears as an overlay on each uploading thumbnail placeholder. Shows percentage fill from 0 to 100%.
- **Image cap:** When at cap, upload button shows as disabled with tooltip: "You've reached the maximum of 6 photos." Upgrading to standard/premium raises the cap to 12 (V1 tier feature — simply show the cap from `listing.tier`).
- **Delete confirm:** Clicking × on a thumbnail shows a small inline confirm popover: "[Image name] will be permanently removed. Delete?" with "Confirm" (red) and "Cancel" buttons. No full modal.
- **Mobile:** Horizontal scroll strip with snap points; each thumbnail is 80×80px; upload button is below the strip.
- **Loading state:** Gallery section shows skeleton thumbnails (gray squares) while images are fetching from the parent Server Component
- **Empty state:** When no gallery images exist: "No photos yet. Add your first photo." — upload button centered in the section
- **Error state:** Per-image upload failure shows "Upload failed" overlay on the failed thumbnail with a retry button; section-level delete failure shows toast
- **Success state:** After reorder: "Saved" in autosave indicator. After delete: thumbnail removes with a fade animation; count updates. After upload: thumbnail appears with a success checkmark overlay briefly.

## Design Notes

- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Colors:** Amber Gold `#E2A428` for drag-handle hover state; red destructive for delete confirm; Charcoal `#595758` for progress bar background
- **Components:** shadcn/ui `Button` (ghost for delete, default for upload); `Tooltip` (for disabled upload button caption); custom drag-reorder using `@dnd-kit/core` + `@dnd-kit/sortable`
- **Thumbnail:** 100×100px (desktop), 80×80px (mobile); `rounded-md`; `object-cover`; relative-positioned container for overlay buttons
- **States to implement:** Empty, Loading (skeleton), Populated/default, Uploading (progress overlay), Reordering (drag active state — elevation shadow), Deleting (fade out), Error (failed upload overlay), Success (brief checkmark)

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `media_attachments`
- **Entities involved:** `media_attachments` (id, entity_type='listing', entity_id=listingId, file_path, file_type, file_size_bytes, alt_text, display_order, is_approved, uploaded_by, created_at)
- **Operations:**
  - SELECT: `media_attachments WHERE entity_type='listing' AND entity_id=listingId AND deleted_at IS NULL AND is_approved=true ORDER BY display_order ASC` — fetched in parent `page.tsx`
  - INSERT: handled by `POST /api/upload` Route Handler (Ticket 030) — creates the row after successful Storage upload
  - UPDATE (reorder): `reorderMedia` SA — updates `display_order` on N rows for the listing; uses `updated_by = user.id`
  - UPDATE (delete): `deleteMedia` SA — sets `deleted_at = now(), updated_by = user.id`; also calls `supabase.storage.from('listing-media').remove([file_path])`
- **Gallery cap from tier:** `listing.tier === 'free' ? 6 : 12` — computed in the Server Component and passed as a prop; do not re-derive inside `GallerySection`
- **Validation:** Max file size: 2MB per gallery image; accepted MIME types: `image/jpeg`, `image/png`, `image/webp` — validated by `POST /api/upload` server-side
- **RLS:** `media_attachments` INSERT allowed for `authenticated` where `uploaded_by = auth.uid()`; UPDATE (reorder, soft-delete) allowed where owner of parent listing; service-role used for Storage deletion
- **Migration required:** No — table exists from Ticket 010

## API Notes

- **Upload:** `POST /api/upload` (Ticket 030) — `multipart/form-data`; fields: `file` (binary), `entityType='listing'`, `entityId=[listingId]`, `mediaRole='gallery'`; returns `{ data: { filePath: string, mediaAttachmentId: string } }`
- **Reorder SA:** `reorderMedia(listingId, orderedIds: string[])` → `lib/actions/dashboard/reorderMedia.ts`; updates `display_order` for each ID in the ordered array; returns `ActionResult<{ updated: number }>`
- **Delete SA:** `deleteMedia(mediaAttachmentId, listingId)` → `lib/actions/dashboard/deleteMedia.ts`; validates ownership; soft-deletes DB row; removes file from Storage; returns `ActionResult<{ deleted: true }>`
- **Cache invalidation:** Both `reorderMedia` and `deleteMedia` call `revalidatePath('/[citySlug]/business/[listingSlug]')` when listing is published
- **Error codes:** `AUTH_REQUIRED`, `NOT_FOUND` (image not found or not owned), `OPERATION_FAILED` (Storage or DB error), `VALIDATION_ERROR` (cap exceeded — checked before calling upload route)

## Implementation Notes

**Files to create:**

- `app/dashboard/page/components/GallerySection.tsx`
- `lib/actions/dashboard/reorderMedia.ts` (if not already from server-actions-plan.md scaffold)
- `lib/actions/dashboard/deleteMedia.ts` (if not already scaffolded)

**Files to modify:**

- `app/dashboard/page/components/PageEditorShell.tsx` — add `<GallerySection>` component at the correct position in the editor
- `app/dashboard/page/page.tsx` — add gallery images fetch; pass `galleryImages` and `galleryCapacity` props to the shell

**Key patterns:**

- Use `@dnd-kit/core` and `@dnd-kit/sortable` — already established by Ticket 054 (services manager uses the same library). Install only once; confirm it is in `package.json` before adding.
- Optimistic reorder: update local `items` state immediately on drop; fire `reorderMedia` SA in the background; roll back on error with a toast
- Upload progress: use `XMLHttpRequest` with `upload.onprogress` event for per-file progress tracking; or `fetch` with `ReadableStream` — simpler to use XHR for this case
- After upload completes, refresh the gallery section data with `router.refresh()` (Server Component re-render) — do not manually append the new image to state; let the server return the canonical order
- Cap enforcement: check `galleryImages.length >= galleryCapacity` before allowing the user to select files; show an error before the upload starts, not after

**Do not:**

- Store CDN URLs in `media_attachments.file_path` — always store the storage path and generate URLs at read time via `supabase.storage.from('listing-media').getPublicUrl(path)`
- Use `deleteMedia` SA to hard-delete — set `deleted_at` only; hard delete is an admin operation
- Install additional drag-and-drop libraries if `@dnd-kit/core` is already in the project

## Acceptance Criteria

- [ ] Gallery section loads showing existing gallery images as thumbnails in `display_order` order
- [ ] "No photos yet" empty state is shown when no images exist
- [ ] Upload button shows current count and cap: "Add photos (N / M)"
- [ ] Uploading a valid image under 2MB creates a new `media_attachments` row and the thumbnail appears after `router.refresh()`
- [ ] Per-image upload progress bar is visible during upload
- [ ] Uploading more than the cap limit shows a toast error: "You've reached the maximum of [cap] photos." and the upload does not proceed
- [ ] Images can be reordered via drag-and-drop; the new order is saved to `display_order` via `reorderMedia` SA; the autosave indicator shows "Saved"
- [ ] Clicking × on a thumbnail shows an inline confirm; confirming fires `deleteMedia` SA; the thumbnail fades out; count updates
- [ ] Deleting an image removes the `media_attachments` row (sets `deleted_at`) and deletes the file from Supabase Storage
- [ ] After a confirmed delete on a published listing, `revalidatePath` fires
- [ ] Mobile (375px): thumbnails display in a horizontal scroll strip; upload button is below and full-width
- [ ] `tsc --noEmit` and `npm run lint` pass with zero errors

## Failure States

| Failure                                       | User-visible behavior                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Upload fails (network error or Storage error) | "Upload failed" overlay on the failed thumbnail with a retry icon; toast: "Couldn't upload [filename]. Try again." |
| File exceeds 2MB                              | Before upload starts: toast "This photo is too large. Maximum size is 2MB."                                        |
| Invalid MIME type                             | Before upload starts: toast "Only JPEG, PNG, and WebP images are accepted."                                        |
| `reorderMedia` SA fails                       | Optimistic order revert to previous state; toast: "Couldn't save the new order. Try again."                        |
| `deleteMedia` SA fails                        | Thumbnail is restored; toast: "Couldn't delete this photo. Try again."                                             |
| Gallery cap exceeded at upload time           | Upload button disabled; tooltip: "You've reached the maximum of [cap] photos."                                     |

## Edge Cases

- Owner attempts to upload 3 files when only 1 slot remains — only the first file is accepted; the other two are rejected with toast: "Only 1 more photo can be added."
- Drag-and-drop reorder fired on a single-image gallery — no-op; `reorderMedia` SA is not called (no meaningful reorder to do)
- Owner deletes all gallery images — gallery returns to empty state; "No photos yet" message renders
- `router.refresh()` is called after upload but the `media_attachments` RLS policy blocks the new row (e.g., `is_approved = false`) — image does not appear; retry button remains; admin review flow is a future concern; at MVP, uploads default to `is_approved = true`
- Two simultaneous file uploads — allow concurrent uploads; track progress state per `file.name + file.size` key; each resolves independently

## Accessibility Notes

- [ ] Each thumbnail has descriptive `alt` text: `alt_text` value from DB, or falls back to "[Business name] gallery photo [N]"
- [ ] Delete button has `aria-label="Delete gallery photo [N]"` (or photo name if available)
- [ ] Drag handle has `aria-label="Drag to reorder [Business name] gallery photo [N]"`; draggable items use `role="button"` with keyboard drag support via dnd-kit's keyboard sensor
- [ ] Upload `<input type="file">` has associated `<label>`: "Upload gallery photos"
- [ ] Progress bars use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- [ ] Delete confirm popover is a `role="dialog"` with `aria-modal="true"`; focus moves into it on open

## QA Test Cases

| #   | Scenario          | Role                          | Steps                                                | Expected result                                                                                      |
| --- | ----------------- | ----------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | Upload happy path | Owner                         | 1. Click "Add photos". 2. Select a valid 500KB JPEG. | Progress bar shows; thumbnail appears after `router.refresh()`; count increments                     |
| 2   | Cap enforcement   | Owner (free tier, 6/6 images) | 1. Try to click "Add photos".                        | Button is disabled; tooltip shows "You've reached the maximum of 6 photos."                          |
| 3   | Reorder           | Owner                         | 1. Drag thumbnail 3 to position 1. 2. Release.       | Optimistic reorder renders immediately; SA fires; autosave shows "Saved"; DB `display_order` updated |
| 4   | Delete            | Owner                         | 1. Click × on first thumbnail. 2. Confirm delete.    | `deleteMedia` SA fires; thumbnail fades; count decrements; Storage file removed                      |
| 5   | Mobile 375px      | Owner                         | 1. Open on 375px. 2. Gallery section visible.        | Thumbnails in horizontal scroll strip; upload button below and full-width; no horizontal overflow    |

## Security Notes

- Upload endpoint (`POST /api/upload`) validates session before processing; validates MIME type from file magic bytes; validates file size; generates UUID-based storage path
- `deleteMedia` SA queries ownership via `listings.owner_user_id = auth.uid()` before deleting — never trusts the `mediaAttachmentId` alone
- `reorderMedia` SA verifies all provided IDs belong to the listing and the listing is owned by the requesting user
- CDN URLs are never stored in the DB; generated at read time with `getPublicUrl`

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading skeleton, empty, uploading, error)
- [ ] Mobile tested at 375px (horizontal scroll strip)
- [ ] Keyboard navigation tested (dnd-kit keyboard sensor for reorder)
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
