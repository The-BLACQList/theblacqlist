# Ticket 051: Page editor — hero and about sections (`/dashboard/page`)

## Status

Draft

## Phase

Phase 8: Owner Dashboard

## Priority

P1

## Feature Area

Owner Dashboard

## Context

The page editor at `/dashboard/page` is the primary tool by which owners control the content displayed on their live BLACQList Page. This ticket covers the two topmost sections of that editor: the **hero section** (cover image upload, logo upload, business name, tagline) and the **about section** (business description). These sections map to fields on `listings` (`name`, `tagline`, `cover_image_path`, `logo_path`) and `listing_details_business` (`description`). Changes are saved via the `updateListingDraft` Server Action, which conditionally calls `revalidatePath` when the listing is already published. An autosave indicator shows the save state. A live preview link opens the public BLACQList Page in a new tab. This ticket establishes the page editor page component, its data-loading pattern, and the shared form shell that tickets 052–055 build on.

Source documents: `docs/blacqlist/ux/mvp-screen-map.md` (Page Editor), `docs/blacqlist/architecture/server-actions-plan.md` (`updateListingDraft`), `docs/blacqlist/data/database-schema-plan.md` (`listings`, `listing_details_business`, `media_attachments`).

## User Story

As a business owner, I want to edit my hero cover image, logo, business name, tagline, and description, so that my BLACQList Page accurately represents my business and attracts customers.

## Scope

- `app/dashboard/page/page.tsx` — Server Component that fetches the owner's listing + business detail record and renders the editor shell
- `app/dashboard/page/components/PageEditorShell.tsx` — Client Component wrapping the full editor with sticky header (autosave indicator + preview link)
- `app/dashboard/page/components/HeroSection.tsx` — Client Component: cover image upload (replaces current), logo upload (replaces current), business name field (text, required), tagline field (text, max 140 chars)
- `app/dashboard/page/components/AboutSection.tsx` — Client Component: description textarea (required, min 50 chars, max 1000 chars, character counter)
- Cover and logo image upload uses `POST /api/upload` (Ticket 030) targeting the `listing-media` bucket with `media_role=cover` / `media_role=logo`; stores path on `listings.cover_image_path` and `listings.logo_path`
- Autosave: on blur of each section, fire `updateListingDraft` SA with the changed fields; show "Saved" / "Saving..." / "Unsaved changes" in the sticky header
- `revalidateTag(\`listing-\${listingId}\`)`inside`updateListingDraft`when`listings.status = 'published'`
- Redirect non-owners (no `owner` role for this listing) to `/dashboard` with a toast

## Out of Scope

- Contact, hours, social links sections (Ticket 052)
- Gallery management (Ticket 053)
- Services section link (Ticket 054)
- CTA configuration and publish/unpublish toggle (Ticket 055)
- Full `react-hook-form` field-level schema validation across all editor sections (each section ticket owns its own zod schema)

## Dependencies

- Depends on: Ticket 050 (owner dashboard home — establishes `/dashboard` layout and owner auth guard)
- Depends on: Ticket 030 (`POST /api/upload` — used by cover/logo upload)
- Depends on: Ticket 009 (`listings` table), Ticket 010 (`listing_details_business`, `media_attachments`), Ticket 013 (RLS)
- Depends on: Ticket 014 (auth — session required)

## UX Notes

- **Screen:** Page Editor — `docs/blacqlist/ux/mvp-screen-map.md` → "Page Editor (`/dashboard/page`)"
- **Route:** `/dashboard/page`
- **Layout:** Dashboard sidebar layout (established by Ticket 050)
- **Entry points:** Dashboard home "Edit My Page" quick action; sidebar nav "My Page" item
- **Exit points:** "Preview" button opens public listing URL in new tab; sidebar nav items
- **Hero section:** Cover image renders as a preview card (full-width thumbnail). "Replace image" button overlays the preview. Logo renders as a square thumbnail with "Replace" overlay. Name field below, tagline below that.
- **About section:** Textarea with character count ("487 / 1000"). "Read more" expansion is handled on the public page — not in the editor.
- **Autosave indicator:** Top-right of the content area. Shows "Saved 2 mins ago" (grey), "Saving…" (animated), or "Unsaved changes" (amber). Uses `useDebouncedCallback` (300ms debounce on section blur).
- **Mobile (375px):** Sections stack vertically. Cover image preview is full-width, 200px tall. Each section is a collapsible accordion. "Saving…" indicator appears in the mobile header bar.
- **Loading state:** Skeleton matching the section layout renders while the Server Component fetches data
- **Empty state (no listing):** If owner has no listing, redirect to `/dashboard` — this page requires a listing to exist
- **Error state:** Section-level save failure shows an inline toast: "Couldn't save [section name]. Try again." with a retry button
- **Success state:** "Saved" text with timestamp appears in the autosave indicator after a confirmed write

## Design Notes

- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Colors:** Amber Gold `#E2A428` for autosave "Unsaved" state; `#19191E` Deep Background for the editor shell; `#FCFAF4` Cream for form card backgrounds; `#000000` for labels
- **Fonts:** Glacial Indifference Bold for section headings; Quicksand Bold Italic for CTAs (Save buttons); Lato Regular for field labels and help text
- **Components to use:** `Card`, `CardHeader`, `CardContent` (shadcn/ui) for each section; `Input`, `Textarea`, `Label`, `Button` (shadcn/ui); `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` from `react-hook-form` + shadcn/ui Form
- **Image upload:** Render current image as an `<Image>` (Next.js) within a relative-positioned container; overlay a ghost `<Button>` labeled "Replace image"; clicking opens `<input type="file" accept="image/*">`
- **States to implement:** Default (fields populated), Loading (skeleton), Saving (spinner on indicator), Saved (check + timestamp), Error (section-level inline message), Empty (redirect)

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `listings`, `listing_details_business`, `media_attachments`
- **Entities involved:** `listings` (name, tagline, cover_image_path, logo_path, status, owner_user_id, slug, city_id), `listing_details_business` (description)
- **Operations:**
  - SELECT: fetch listing WHERE `owner_user_id = auth.uid()` + JOIN `listing_details_business`; generate public URL for cover/logo from storage path at read time
  - UPDATE via `updateListingDraft` SA: `listings.name`, `listings.tagline`, `listings.cover_image_path`, `listings.logo_path`, `listings.updated_by`, `listing_details_business.description`, `listings.last_edited_by_owner_at = now()`
- **Validation rules:** `name`: required, max 200 chars; `tagline`: optional, max 140 chars; `description`: required if section is saved, min 50 chars, max 1000 chars; `cover_image_path` and `logo_path`: storage paths (not URLs), MIME validated server-side before upload
- **RLS policies:** `authenticated` UPDATE on `listings` only where `owner_user_id = auth.uid()`; `listing_details_business` UPDATE only through service-layer ownership check
- **Migration required:** No — tables exist from Ticket 009 / Ticket 010

## API Notes

- **Server Actions plan:** `docs/blacqlist/architecture/server-actions-plan.md` → `updateListingDraft` (`lib/actions/listings/updateListingDraft.ts`)
- **Action involved:** `updateListingDraft(input: { listingId, name?, tagline?, description?, cover_image_path?, logo_path? })`
- **Auth required:** Yes — `owner` role verified server-side via `user_roles` table query
- **Request shape:** `{ listingId: string, name?: string, tagline?: string, description?: string, cover_image_path?: string, logo_path?: string }`
- **Response shape:** `ActionResult<{ listingId: string; updatedAt: string }>` — success returns listing ID and updated timestamp for the autosave indicator
- **Cache invalidation:** `revalidatePath('/[citySlug]/business/[listingSlug]')` only when `listing.status = 'published'`; `revalidateTag(\`listing-\${listingId}\`)` as secondary tag
- **Error codes to handle:** `AUTH_REQUIRED` → redirect to `/sign-in`; `NOT_FOUND` → redirect to `/dashboard`; `VALIDATION_ERROR` → inline field errors via `form.setError`; `OPERATION_FAILED` → section-level toast with retry
- **File upload:** Cover/logo upload uses `POST /api/upload` (Ticket 030) — this ticket calls the route handler, receives a `file_path` in response, then passes that path to `updateListingDraft`

## Implementation Notes

**Files to create:**

- `app/dashboard/page/page.tsx` — Server Component; fetches listing + business detail; renders `<PageEditorShell>` with data props
- `app/dashboard/page/components/PageEditorShell.tsx` — Client Component; wraps the editor with sticky header; manages autosave indicator state
- `app/dashboard/page/components/HeroSection.tsx` — Client Component; react-hook-form controlled; cover/logo upload + name + tagline fields
- `app/dashboard/page/components/AboutSection.tsx` — Client Component; react-hook-form controlled; description textarea + character counter
- `lib/validations/listing.ts` — add `heroSectionSchema` and `aboutSectionSchema` zod schemas (may already partially exist from Ticket 032)

**Files to modify:**

- `app/dashboard/layout.tsx` — confirm "My Page" nav item links to `/dashboard/page` (established in Ticket 050)
- `lib/actions/listings/updateListingDraft.ts` — implement the full 7-step pattern; check if already partially scaffolded by Ticket 050

**Key patterns:**

- Use `createServerClient` from `@supabase/ssr` in the Server Component to fetch data — never the browser client
- Use `supabase.auth.getUser()` — not `getSession()`
- For image upload: `input type="file"` triggers `POST /api/upload`; on success, call `updateListingDraft` with the returned `file_path`; never store CDN URLs — store only the path
- Autosave uses `useDebouncedCallback` from `use-debounce` (already installed or add as a small utility); fires on `onBlur` of each section's fields
- `PageEditorShell` holds shared `autosaveState` (`'idle' | 'saving' | 'saved' | 'error'`) and `lastSavedAt` state; each section calls a shared `onSectionSave` callback
- Generate public URL from storage path at read time using `supabase.storage.from('listing-media').getPublicUrl(path)` in the Server Component
- Follow `react-hook-form` + zod pattern from `app/add-business/` (Tickets 032/033) for consistency

**Do not:**

- Store CDN URLs in the database — always store the storage path and generate URLs at read time
- Put business logic or DB queries in the page component — call `updateListingDraft` SA from Client Components only
- Call `revalidatePath` globally (`/`) — only the specific listing path

## Acceptance Criteria

- [ ] `/dashboard/page` renders for an authenticated owner with an existing listing; non-owners redirect to `/dashboard`
- [ ] Hero section displays the current cover image, logo, business name, and tagline populated from the database
- [ ] Owner can replace the cover image and logo; new images upload to Supabase Storage and the storage path is saved to `listings`; CDN URL is rendered from the path
- [ ] Business name field is required; attempting to save with an empty name shows an inline validation error: "Business name is required."
- [ ] Tagline field enforces 140-character maximum; character count updates in real time
- [ ] About section description textarea shows a live character counter (e.g., "247 / 1000")
- [ ] Description field enforces minimum 50 characters; attempting to save with fewer shows: "Description must be at least 50 characters."
- [ ] On section blur, `updateListingDraft` fires; the autosave indicator transitions through "Saving…" → "Saved [timestamp]"
- [ ] When `updateListingDraft` fails, the indicator shows "Unsaved changes" and a section-level toast appears: "Couldn't save. Try again."
- [ ] For a published listing, a successful save triggers `revalidatePath` for the listing's public URL; the public page reflects changes within the ISR window
- [ ] "Preview" button in the sticky header opens the public listing URL in a new tab
- [ ] All four states (loading skeleton, populated/default, saving, error) are implemented
- [ ] Mobile (375px): sections collapse to accordions; cover image preview is full-width; all fields are reachable without horizontal scroll
- [ ] `tsc --noEmit` and `npm run lint` pass with zero errors

## Failure States

| Failure                                                         | User-visible behavior                                                                                                        |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `updateListingDraft` returns `OPERATION_FAILED`                 | Autosave indicator shows "Unsaved changes" (amber); inline toast: "Couldn't save your changes. Try again." with retry button |
| `updateListingDraft` returns `VALIDATION_ERROR`                 | Inline field error messages appear below the affected fields via `form.setError`                                             |
| `updateListingDraft` returns `NOT_FOUND` (owner mismatch)       | Toast: "This page is no longer accessible." Redirect to `/dashboard`                                                         |
| `POST /api/upload` fails on image upload                        | Toast: "Image upload failed. Please try a different file." Previous image remains unchanged                                  |
| Image MIME type invalid (not image/jpeg, image/png, image/webp) | Toast: "Only JPEG, PNG, and WebP images are accepted."                                                                       |
| Image exceeds size limit (cover >5MB, logo >2MB)                | Toast: "Cover image must be under 5MB. Logo must be under 2MB."                                                              |
| Session expired mid-edit                                        | On next action, SA returns `AUTH_REQUIRED`; redirect to `/sign-in?next=/dashboard/page`                                      |

## Edge Cases

- Owner uploads a new cover image while "Saving…" is in progress — queue the second upload after the first resolves; do not fire concurrent `updateListingDraft` calls with conflicting paths
- Owner types rapidly in the name field — debounce at 300ms; do not fire a save on every keystroke
- Owner clears the business name (sets it to empty string) and blurs the field — validate before calling the SA; show the error inline; do not call `updateListingDraft` with an empty name
- Tagline is exactly 140 characters — character counter shows "140 / 140" in amber; field remains valid
- Description is exactly 1000 characters — character counter shows "1000 / 1000" in amber; no additional characters can be typed
- Owner's cover image path exists in the DB but the Storage file was deleted — `getPublicUrl` returns a broken URL; the image placeholder renders; no JS error thrown
- Session expires while the owner is actively typing — autosave fires, SA returns `AUTH_REQUIRED`, indicator shows "Unsaved changes", toast prompts re-login with a link

## Accessibility Notes

- [ ] "Hero" and "About" section headings are `<h2>` elements within the dashboard `<main>` landmark
- [ ] Cover image upload `<input type="file">` has an associated `<label>`: "Upload cover image (JPEG, PNG, or WebP, max 5MB)"
- [ ] Character counter for tagline and description uses `aria-live="polite"` so screen readers announce updates
- [ ] Autosave indicator uses `aria-live="polite"` to announce state changes
- [ ] All form inputs have visible `<label>` elements (not placeholder-only)
- [ ] Error messages are linked to their inputs via `aria-describedby`
- [ ] "Preview" button has `aria-label="Preview your BLACQList Page (opens in new tab)"`
- [ ] Image preview includes descriptive `alt` text: "[Business name] cover photo" or "[Business name] logo"
- [ ] Keyboard navigation: Tab order moves logically from name → tagline → description → save button; accordion sections toggle with Enter/Space

## QA Test Cases

| #   | Scenario                | Role  | Steps                                                                                                      | Expected result                                                                                                            |
| --- | ----------------------- | ----- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Happy path — hero save  | Owner | 1. Navigate to `/dashboard/page`. 2. Change business name to "New Name". 3. Tab away from field.           | Autosave indicator shows "Saving…" then "Saved [time]"; DB record updates; if listing is published, `revalidatePath` fires |
| 2   | Cover image replace     | Owner | 1. Click "Replace image" on cover. 2. Select a valid JPEG under 5MB.                                       | Image uploads to Storage; new path saved to `listings.cover_image_path`; preview card shows new image                      |
| 3   | Validation — empty name | Owner | 1. Clear the business name field. 2. Tab away.                                                             | Inline error: "Business name is required." SA is not called.                                                               |
| 4   | Description min length  | Owner | 1. Enter 30 characters in description. 2. Tab away.                                                        | Inline error: "Description must be at least 50 characters." SA is not called.                                              |
| 5   | Mobile 375px            | Owner | 1. Open on a 375px viewport. 2. Verify sections are accordion. 3. Open "Hero" section. 4. Edit name field. | Accordion opens; field is reachable; keyboard does not cover the submit area; autosave fires on blur                       |

## Security Notes

- Server Action re-validates `owner_user_id = auth.uid()` via `user_roles` table query before any DB write — client-supplied `listingId` alone is insufficient
- Image upload route (`POST /api/upload`) validates MIME type from file magic bytes, not from `Content-Type` header
- Storage paths are never derived from user-supplied filenames; UUID-based paths are generated server-side
- `updated_by` is set to `user.id` on every UPDATE — never accept a `updated_by` value from the client
- `cover_image_path` and `logo_path` are sanitized to ensure they are valid Supabase Storage path strings before saving

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty/redirect, error, success)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
