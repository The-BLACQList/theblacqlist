# Ticket 033: Add Business Multi-Step Form — Steps 5–7

## Status

Backlog

## Phase

Phase 5: Submit / Claim / Manage Foundation

## Priority

P1

## Feature Area

Core Workflow / Entity Submission

## Context

Steps 5–7 complete the Add Business multi-step form: media uploads, primary CTA selection, and the final preview + publish flow. This ticket includes the duplicate-check modal, the `createListing` Server Action call, and the `submitListingForReview` Server Action call. Together with Ticket 032 (steps 1–4), this constitutes the complete listing creation experience. These steps are the most technically complex because they involve file uploads, a live read-only preview of the BLACQList Page layout, and a two-step server-side mutation. Source: `docs/blacqlist/ux/mvp-screen-map.md` Add Business section; `docs/blacqlist/architecture/api-contract.md` Section 4 endpoints 18–22; `docs/blacqlist/architecture/server-actions-plan.md`; `docs/blacqlist/data/database-schema-plan.md`.

## User Story

As a business owner who has completed the first four steps of the Add Business form, I want to upload media, set my primary CTA, preview my page, and publish it for review, so that my BLACQList Page appears in the admin moderation queue and goes live after approval.

## Scope

**In scope:**

- **Step 5 — Media:** Logo upload (single image, square crop recommendation hint text, max 2MB, `accept="image/jpeg,image/png,image/webp"`), Cover image upload (landscape, 16:9 recommendation hint, max 5MB), Gallery images (up to 12, multi-file select, max 3MB each). Each upload: calls `POST /api/upload` with `bucket=listing-media` and appropriate `subtype` (`logo`, `cover`, `gallery`). Each upload renders a preview image with a remove button (×). Upload progress bar (`<progress>` element or indeterminate spinner). "Skip for now" helper text under each upload zone — none of the media fields blocks Continue
- **Step 6 — Primary CTA:** Five option cards in a single-column list: "Book an appointment" (book icon), "Order online" (cart icon), "Call us" (phone icon), "Visit us" (location pin icon), "Message us" (envelope icon). Selecting a card reveals an associated input field: Book/Order/Visit → URL text input (placeholder `https://`); Call → tel input pre-filled from Step 3 phone; Message → email input pre-filled from Step 3 email. CTA selection is required — Continue is blocked until a card is selected
- **Step 7 — Preview + Publish:** Read-only rendering of the BLACQList Page using the `ListingHero`, `AboutSection`, `ContactBlock`, `CTASection` components from Tickets 021–022 in read-only/preview mode. A yellow preview banner at the top of the preview panel: "Preview — this is how your page will look." Publish button (Amber Gold, full-width): on click, trigger duplicate check via `POST /api/listings/duplicate-check`. If duplicates found, show `DuplicateWarningDialog`. If no duplicates (or user continues anyway), call `createListing` SA then `submitListingForReview` SA. Success state: full-step replacement with success message. "Save as draft" ghost button: calls `createListing` SA only (status stays `'draft'`)
- **DuplicateWarningDialog:** shadcn/ui `Dialog`. Title: "Is this already on The BLACQList?" Body: shows up to 3 potential match cards (name, city, trust_tier badge, "Claim instead →" link per card). Two action buttons: "No, this is different — publish anyway" (Continue) and "Cancel" (closes dialog, returns to Step 7). Pressing "Claim instead →" on a match card routes to `/claim/[listing-id]` and clears the draft
- Draft cleared from localStorage on successful `submitListingForReview`
- Success screen (replaces form): heading "Submitted for review!", body "We'll review your BLACQList Page and notify you at [user email]. This usually takes 1–3 business days.", two links: "View your draft page →" (`/[city-slug]/business/[slug]`) and "Claim your page" (only shown if user has not already initiated a claim) → `/claim/[listing-id]`

**Out of scope:**

- Steps 1–4 (Ticket 032)
- Admin review and approval workflow (Ticket 039)
- Gallery image reordering drag-and-drop (covered in Dashboard page editor ticket)
- Image cropping UI (hint text only — no in-browser crop at MVP)

## Dependencies

| Dependency                                                                     | Type                 | Status                                               |
| ------------------------------------------------------------------------------ | -------------------- | ---------------------------------------------------- |
| Ticket 032 (steps 1–4)                                                         | Blocking ticket      | Must be complete — this ticket extends the same form |
| Ticket 031 (duplicate-check API)                                               | Blocking ticket      | Required for Step 7 duplicate check before publish   |
| Ticket 030 (media upload Route Handler `POST /api/upload`)                     | Blocking ticket      | Required for Step 5 media uploads                    |
| `createListing` SA (`lib/actions/listings/createListing.ts`)                   | Code dependency      | Must exist before Step 7 can call it                 |
| `submitListingForReview` SA (`lib/actions/listings/submitListingForReview.ts`) | Code dependency      | Must exist before Step 7 can call it                 |
| BLACQList Page preview components (Tickets 021–022)                            | Component dependency | Read-only preview in Step 7 uses these components    |

## UX Notes

- **Screen:** Add Business Steps 5–7 — `/add-business` (same route, continued from Ticket 032)
- **Flow reference:** `docs/blacqlist/ux/mvp-screen-map.md` Add Business section; Step 7 DuplicateWarningDialog behavior
- **Entry points:** Continuation from Step 4 Continue button (Ticket 032)
- **Exit points:** Success → `/claim/[listing-id]` or `/dashboard`; DuplicateWarningDialog → `/claim/[existing-listing-id]`; Cancel → stays on Step 7
- **Mobile behavior (375px):**
  - Step 5 upload zones: full-width tap areas, minimum 80px tall; tap opens OS file picker with camera option (`capture="environment"` on file input for gallery)
  - Step 5 image preview thumbnails: 3-column grid on mobile, each 80px square with × remove button (minimum 44×44px tap target)
  - Step 6 CTA option cards: single-column full-width; selected card has Amber Gold left border accent
  - Step 7 preview: renders the full BLACQList Page layout in a scrollable panel — on mobile this is a full-height scrollable container; the Publish button is sticky at the bottom
  - DuplicateWarningDialog on mobile: full-screen bottom sheet pattern (not centered modal)

## Design Notes

- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Components to use:** shadcn/ui `Dialog`, `Button`, `Progress`, `Form`, `Input`; custom `UploadZone` component; BLACQList Page layout components in read-only mode
- **Upload zone design:** Dashed border (`border-2 border-dashed border-[#E2A428]`), Cream background, centered icon + "Upload [type]" text + hint (max size, crop recommendation), Amber Gold text "Browse files" link; on mobile, icon + full-width tap target
- **CTA card design:** White card with left border, category icon left-aligned, label text Quicksand Bold, selected state: `border-l-4 border-[#E2A428] bg-[#FCFAF4]`
- **Preview panel:** Surrounded by `border border-[#E2A428] rounded-lg` to distinguish from form; preview banner in `bg-amber-50 text-amber-800`
- **States to implement:** Default, Uploading (progress bar), Upload error (inline below zone), Upload success (thumbnail preview), CTA not selected (Continue disabled), Submitting (Publish button spinner + disabled), Success (full replacement), Duplicate warning (dialog open)

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `listings`, `listing_details_business`, `media_attachments`
- **Entities involved:** `listings` (INSERT), `listing_details_business` (INSERT), `user_roles` (INSERT — owner role granted), `media_attachments` (INSERT after listing created)
- **Operations:** After successful `createListing` SA: INSERT into `listings` + `listing_details_business` + `user_roles` (service role). `submitListingForReview` SA: UPDATE `listings.status` from `'draft'` to `'pending'`
- **Validation rules:** Logo max 2MB; cover max 5MB; gallery each max 3MB; total gallery max 12 images; `cta_type` required; `cta_url` required for non-`call` CTA types
- **RLS policies:** `createListing` SA uses authenticated client + service role for `user_roles` INSERT. `submitListingForReview` SA: `owner_user_id = auth.uid()` check before UPDATE
- **Migration required:** No — depends on tables from earlier migrations

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` → Section 4 endpoints 18–22
- **Endpoints involved:**
  - `POST /api/upload` — file upload to Supabase Storage (Ticket 030); returns `{ data: { path: string, url: string } }`
  - `POST /api/listings/duplicate-check` — (Ticket 031); called on Publish button click
  - `createListing` SA (`lib/actions/listings/createListing.ts`) — inserts draft listing record
  - `submitListingForReview` SA (`lib/actions/listings/submitListingForReview.ts`) — transitions listing from draft to pending
- **Auth required:** Yes — Supporter on all calls
- **Request shape (createListing SA):** All accumulated form data from steps 1–6, plus `logo_path`, `cover_image_path`, `gallery_paths` from successful uploads
- **Response shape:** `ActionResult<{ listing_id: string, slug: string, status: 'draft' }>`
- **Error codes to handle:**
  - `VALIDATION_ERROR` — display `fields` object as inline errors on the relevant step; step back to the step with the error
  - `AUTH_REQUIRED` — redirect to `/sign-in?next=/add-business`
  - `SERVER_ERROR` — inline error banner in Step 7: "Submission failed. Your draft has been saved. Please try again."

## Implementation Notes

**Files to create:**

- `app/add-business/_components/steps/MediaStep.tsx` — Step 5
- `app/add-business/_components/steps/CtaStep.tsx` — Step 6
- `app/add-business/_components/steps/PreviewPublishStep.tsx` — Step 7
- `app/add-business/_components/UploadZone.tsx` — reusable upload zone component
- `app/add-business/_components/DuplicateWarningDialog.tsx` — duplicate warning modal
- `lib/actions/listings/createListing.ts` — Server Action (seven-step pattern from `server-actions-plan.md`)
- `lib/actions/listings/submitListingForReview.ts` — Server Action

**Files to modify:**

- `app/add-business/_components/AddBusinessForm.tsx` — add steps 5–7 to the step renderer; add submit handlers
- `lib/validations/listing.ts` — add Step 5 and Step 6 zod schemas; add final submission schema

**Key patterns:**

- Upload flow: call `POST /api/upload` immediately on file select (not on form submit); store the returned `path` in form state; if user removes an uploaded image, call `DELETE /api/upload` or simply mark path as null in state (file is orphaned in storage until listing is created — acceptable at MVP)
- Two-step publish: `createListing` SA first (creates the DB record with `status: 'draft'`), then `submitListingForReview` SA immediately after success. If `createListing` succeeds but `submitListingForReview` fails: the draft exists; show error with "Your draft was saved. Try submitting for review from your dashboard."
- Duplicate check: call before `createListing` — do not create a record if the user decides to claim an existing listing instead
- Read-only preview in Step 7: pass collected form data as props to the BLACQList Page preview components; these components must accept a `previewData` prop in addition to (or instead of) a `listing_id` lookup
- Draft clear on success: `localStorage.removeItem(DRAFT_KEY)` after `submitListingForReview` returns successfully

**Do not:**

- Upload files to storage before the user reaches Step 5 — uploads only happen in Step 5
- Block form progress on upload errors — media is optional; show the error but allow Continue
- Call `createListing` more than once per session — use a `submitting` flag to prevent double-submit
- Store full CDN URLs in form state — store only the storage path; generate URLs in the preview component

## Acceptance Criteria

- [ ] Given a user uploads a logo in Step 5, a thumbnail preview with a "×" remove button appears immediately after upload completes
- [ ] Given a user uploads a file exceeding the size limit (e.g., a 6MB cover image), an inline error appears: "File must be under 5MB" — the upload does not proceed
- [ ] Given a user selects the "Call us" CTA in Step 6, the associated input pre-fills with the phone number entered in Step 3 (if any)
- [ ] Given a user reaches Step 7, a read-only preview of their BLACQList Page renders with the data from steps 1–6
- [ ] Given a user clicks Publish and a duplicate is found, the `DuplicateWarningDialog` appears showing the matching listing(s) with a "Claim instead →" link
- [ ] Given a user clicks "No, this is different — publish anyway" in the dialog, `createListing` and `submitListingForReview` are called and the success screen renders
- [ ] Given `createListing` succeeds but `submitListingForReview` fails, the user sees: "Your draft was saved. Try submitting for review from your dashboard." — the form is not cleared
- [ ] Given successful publish, the localStorage draft key is cleared and the success screen shows the user's email address in the confirmation message
- [ ] Given a user clicks "Save as draft" in Step 7, `createListing` is called with `status: 'draft'` only; `submitListingForReview` is NOT called; the user is redirected to `/dashboard`
- [ ] On mobile at 375px, Step 5 upload zones are at minimum 80px tall and trigger the native file picker; the Publish button in Step 7 is sticky at the bottom of the viewport

## Failure States

| Failure                        | Condition                                          | User sees                                                                               | Recovery                                           |
| ------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Upload file too large          | File exceeds size limit                            | Inline error below upload zone: "File must be under [N]MB"                              | User selects a smaller file                        |
| Upload network error           | `POST /api/upload` returns 5xx                     | Inline error: "Upload failed. Try again." with retry button                             | User re-selects and uploads; form data is not lost |
| CTA URL missing                | User selects Book/Order/Visit but leaves URL empty | Continue disabled; inline error below URL input when Submit attempted                   | User enters URL and retries                        |
| `createListing` fails          | SA returns `VALIDATION_ERROR`                      | Fields object displayed; step navigates back to the step with the error field           | User corrects field and re-submits                 |
| `createListing` fails          | SA returns `SERVER_ERROR`                          | Banner in Step 7: "Submission failed. Your draft is preserved. Please try again."       | Retry publish button                               |
| `submitListingForReview` fails | SA returns error after `createListing` succeeded   | "Your draft was saved. You can submit it from your dashboard." + "Go to dashboard" link | User goes to dashboard and submits from there      |
| Duplicate found                | Duplicate check returns matches                    | `DuplicateWarningDialog` shown                                                          | User claims existing listing or proceeds anyway    |

## Edge Cases

- User uploads 12 gallery images, then tries to upload a 13th: the upload zone shows "Maximum 12 photos reached" and the input is disabled
- User removes a cover image after uploading it: path is cleared from state; if listing has not been created yet, the orphaned file in storage is acceptable at MVP (admin cleanup or TTL job is V1)
- User presses browser Back button from Step 6 to Step 5: previously uploaded images must still show in the upload zones (paths are in form state in memory, not re-fetched)
- `DuplicateWarningDialog` "Claim instead →" click: before routing to `/claim/[id]`, clear the localStorage draft and confirm with the user: "This will discard your draft. Continue?"
- Session expires between Step 5 and Step 7 (long session on form): `createListing` SA returns `AUTH_REQUIRED`; redirect to `/sign-in?next=/add-business`; draft is in localStorage so user can resume after sign-in
- User submits with all media skipped (no logo, no cover, no gallery): valid — media is entirely optional; `createListing` runs with null media paths

## Accessibility Notes

- [ ] Upload zones are keyboard-accessible: the "Browse files" link triggers the file picker via `<label htmlFor="file-input">` wrapping a visually hidden `<input type="file">`
- [ ] Upload progress is announced via `aria-live="polite"` region: "Logo uploading... Logo uploaded successfully."
- [ ] CTA option cards use `role="radio"` and `aria-checked`; they are grouped in a `role="radiogroup"` with label "How do you want visitors to reach you?"
- [ ] `DuplicateWarningDialog` traps focus when open; focus returns to the Publish button when closed
- [ ] The success screen's heading is an `<h1>` — screen readers announce it as the page heading after the transition
- [ ] Remove buttons on image previews have `aria-label="Remove [image type] image"` — not just an icon

## QA Test Cases

| ID   | Test                     | Steps                                                                                        | Expected                                                                                                    |
| ---- | ------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| QA-1 | Happy path — full submit | Complete all 7 steps with valid data including a cover image → click Publish → no duplicates | `createListing` + `submitListingForReview` called; success screen shows; localStorage draft cleared         |
| QA-2 | Duplicate warning        | Step 7 → click Publish where a near-match listing exists in the same city                    | `DuplicateWarningDialog` appears with the matching listing card and "Claim instead →" link                  |
| QA-3 | File size error          | Step 5 → try to upload a 6MB cover image                                                     | Error "File must be under 5MB" shown; upload does not proceed; Continue still enabled (media optional)      |
| QA-4 | Save as draft            | Step 7 → click "Save as draft"                                                               | Only `createListing` SA called; redirected to `/dashboard`; listing visible in admin with `status: 'draft'` |
| QA-5 | Server error recovery    | Stub `createListing` to return `SERVER_ERROR` → click Publish                                | Error banner shown in Step 7; form data preserved; Publish button re-enabled for retry                      |

## Security Notes

- File uploads must be validated server-side in `POST /api/upload` (Ticket 030) — MIME type and file size are checked by the Route Handler, not just by client-side `accept` attribute
- Storage paths are stored in the listing record — never CDN URLs; the path format must be validated server-side to prevent path traversal: `listing-media/[uuid]/[uuid].[ext]`
- `createListing` SA sets `submitted_by = auth.uid()` and `source = 'owner'` server-side — these fields are never accepted from the client
- `owner_user_id` is set to `auth.uid()` server-side — the client cannot specify a different owner
- The duplicate check result (listing IDs of potential matches) is safe to return — it only reveals published listing data which is publicly accessible

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Full 7-step happy path tested end-to-end in browser
- [ ] Duplicate warning dialog tested (create a near-match listing seed first)
- [ ] File upload error states tested (oversized file)
- [ ] `createListing` SA tested independently (check DB for inserted listing record)
- [ ] `submitListingForReview` SA tested (check `status: 'pending'` in DB)
- [ ] Mobile tested at 375px — sticky Publish button, upload tap zones, bottom sheet dialog
- [ ] Draft clear confirmed after successful publish
- [ ] Keyboard navigation tested through Steps 5–7
