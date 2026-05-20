# Ticket 064: Receipt submission form — manual entry, camera capture, OCR stub

## Status
Draft

## Phase
Phase 11: Receipt Upload and Community Spend Beta

## Priority
P2

## Estimate
M (2–4h)

## Feature Area
Spend / Receipts

---

## Context

Supporters can upload receipts from Black-owned businesses to document their community spend. This ticket builds the `/account/receipts/new` page and its form: a multi-field entry experience that captures the receipt image (camera on mobile, file picker fallback), the business the purchase was made at, the amount spent, the date, and optional notes. After the user takes or selects a photo, an OCR stub simulates a parse delay and attempts to pre-fill the amount and date fields from `ocr_raw_data` returned by the upload API. The user confirms or corrects these fields before submitting.

A `client_idempotency_key` UUID is generated client-side when the page loads and is sent with both the file upload and the final form submission — this prevents double-submission on retry without requiring server-side deduplication beyond the DB constraint.

The form calls `POST /api/receipts/upload` (Ticket 063) for the file, and then calls the `createReceiptUpload` Server Action (or the same Route Handler again with full metadata) for the final submission with all fields.

Sources: `docs/blacqlist/ux/mvp-screen-map.md` § Receipt Upload Beta; `docs/blacqlist/architecture/server-actions-plan.md` § Spend; `docs/blacqlist/data/database-schema-plan.md` § receipt_uploads.

---

## User Story

As an authenticated supporter, I want to upload a receipt photo and confirm the business name, amount, and date, so that my spending at Black-owned businesses is tracked and counted toward community impact.

---

## Scope

**In scope:**
- `app/account/receipts/new/page.tsx` — Page component (Server Component shell; renders the form Client Component)
- `components/spend/ReceiptSubmissionForm.tsx` — Client Component (`"use client"`) handling the full form flow
- Form fields:
  - **Business search** — typeahead `Input` querying `/api/search` (debounced 300ms) for published listings by name; user selects a listing from results; stores `listing_id`; shows selected business name as a read-only pill with a clear button
  - **Photo upload** — `<input type="file" accept="image/*" capture="environment">` triggers rear camera on mobile, file picker on desktop; displays image preview before upload; "Retake" / "Remove" button on preview
  - **Amount** — `Input` with `type="number"` (`inputMode="decimal"`), dollar prefix label; required
  - **Purchase date** — `Input` with `type="date"`; default value: today; required
  - **Notes** — `Textarea`, optional, max 500 chars; placeholder: "Anything else to note?"
- OCR stub flow: after photo is selected, show a 1.5-second simulated "Analyzing receipt..." loading state; then attempt to pre-fill amount and date from the API response `ocr_raw_data` (at MVP this will always return null/empty; the stub just resolves after the delay)
- `client_idempotency_key`: UUID generated with `crypto.randomUUID()` on component mount; stored in `useRef` so it persists through re-renders without triggering a re-render itself
- Form submission: call `POST /api/receipts/upload` with the file + all metadata + `client_idempotency_key`; on success, navigate to `/account/receipts` with a success query param
- Success state: redirect to `/account/receipts?uploaded=true`; the receipts list page should detect `?uploaded=true` and show a banner: "Receipt submitted. We'll review it within 48 hours."
- Loading state: submit button shows spinner + "Submitting..." text; all inputs disabled during submission
- Error state: error banner at top of form with the error message from the API; form not cleared; user can correct and retry
- Empty state: clean form with no pre-filled values (except date = today)
- `app/account/receipts/page.tsx` — route exists (Ticket 066); this ticket adds the "Upload Receipt" link to that page pointing to `/account/receipts/new`

**Out of scope:**
- Real OCR processing of the receipt image (V2 — this ticket implements the stub only)
- Receipts list view (`/account/receipts`) — built in Ticket 066
- Admin review of uploaded receipts — Ticket 065
- Spend event creation — Ticket 067
- Offline handling / draft save to localStorage for this form (data collection standard applies but this form is low-frequency; MVP is acceptable without autosave)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 014 — Auth flows (user must be authenticated) | Blocking ticket | Not started |
| Ticket 063 — Receipt upload API (`POST /api/receipts/upload`) | Blocking ticket | Not started |
| `receipt_uploads` table with `client_idempotency_key` column | Database | Must exist |
| `/api/search` endpoint (Ticket 025) — for business typeahead | Soft dependency (form still works with manual text if unavailable) | Not started |
| Ticket 015 — App shell and account layout | Blocking ticket | Not started |

---

## UX Notes

- **Screen:** Receipt Upload Beta — `docs/blacqlist/ux/mvp-screen-map.md` § Receipt Upload Beta
- **Route:** `/account/receipts/new`
- **Entry points:** "Upload Receipt" Amber Gold button on `/account/receipts` (Ticket 066); dollar-flow teaser CTA on homepage for authenticated users
- **Exit points:** On success → redirect to `/account/receipts?uploaded=true`; "Cancel" text link → `/account/receipts`
- **Form flow:**
  1. User arrives at clean form (date pre-filled to today)
  2. User taps photo upload button → camera opens on mobile / file picker on desktop
  3. Photo preview shown; OCR stub simulates analysis for 1.5s; amount and date fields animate into pre-filled state (or remain blank if OCR returns nothing)
  4. User confirms or edits: business name (typeahead), amount, date, notes
  5. User taps "Submit Receipt" (Amber Gold, full-width on mobile)
  6. Loading state during upload
  7. Redirect to `/account/receipts?uploaded=true`
- **Mobile behavior:** Single-column layout. Photo upload button (or camera icon) is full-width, positioned at the top of the form. Submit button is sticky bottom bar on mobile (56px, full-width, Amber Gold) so it is always reachable without scrolling. Required field labels use `*` indicator.
- **Sticky submit button:** On mobile, the "Submit Receipt" button is a fixed bottom bar. On desktop, it appears inline at the bottom of the form card.
- **Business typeahead:** Debounced 300ms; minimum 2 characters before search fires; shows listing name, category, and city in each dropdown item. If the user cannot find the business, they can still submit without `listing_id` selected — the field is optional (admin will match during review).

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components to use:** `Card`, `CardHeader`, `CardContent`, `Input`, `Textarea`, `Label`, `Button`, `Skeleton` (for OCR loading state), `Badge` (for selected business pill), shadcn/ui `Command` or a custom typeahead for the business search
- **Photo upload area:** Large dashed-border upload zone (full-width, 160px height on desktop) with a camera icon and "Take a photo or upload from your gallery" copy. On image select: preview replaces the zone (maintains aspect ratio, max-height 240px, `object-fit contain`). "Retake" button (Ghost, small) and "Remove" button (Ghost, destructive text, small) appear below the preview.
- **OCR loading state:** A 1.5-second `Skeleton` overlay on the amount and date fields with the text "Analyzing receipt..." (Lato, Charcoal, 12px) below them
- **Selected business pill:** Amber Gold-outlined pill with business name + × button to clear selection
- **States to implement:** Default (clean form), Loading (submit spinner), OCR loading (skeleton on two fields), Error (error banner + form preserved), Success (redirect)

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` § receipt_uploads
- **Entities involved:** `receipt_uploads` (INSERT), `listings` (READ for typeahead — via `/api/search`)
- **Operations:** POST to `receipt_uploads` via `POST /api/receipts/upload` Route Handler (Ticket 063)
- **Validation rules (client-side zod schema in `lib/validations/spend.ts`):**
  - `listing_id`: optional UUID
  - `file`: required (validated before form submission — must have a file selected)
  - `amount_cents`: required; integer > 0; converted from dollar string (e.g., "12.50" → 1250 cents)
  - `purchase_date`: required; ISO date string; must not be in the future
  - `notes`: optional; max 500 chars
  - `client_idempotency_key`: UUID; generated on mount, not user-editable
- **RLS:** INSERT allowed for `authenticated` users — enforced in Ticket 063's Route Handler
- **Migration required:** No — `receipt_uploads` table already exists from schema migration

---

## API Notes

- **`POST /api/receipts/upload`** (Ticket 063)
  - Called from the Client Component via `fetch` with `multipart/form-data`
  - Sends: `file`, `listing_id` (optional), `amount_cents` (integer as string), `purchase_date`, `notes`, `client_idempotency_key`
  - On success: `{ data: { id, status, file_path } }` → redirect to `/account/receipts?uploaded=true`
  - On error: display `error` string in form banner

- **`GET /api/search`** (Ticket 025) — for business typeahead
  - Called with `?q=[query]&limit=5` (5 suggestions max)
  - Debounced 300ms on keystroke in the business search field

---

## Implementation Notes

**Files to create:**
- `app/account/receipts/new/page.tsx` — Server Component shell; auth guard (redirect to `/sign-in?next=/account/receipts/new` if unauthenticated); renders `ReceiptSubmissionForm`
- `components/spend/ReceiptSubmissionForm.tsx` — Client Component with full form logic
- `components/spend/BusinessTypeahead.tsx` — reusable typeahead wrapper around shadcn/ui `Command` or custom dropdown; takes `onSelect(listing: { id: string; name: string })` prop

**Files to modify:**
- `app/account/receipts/page.tsx` — add "Upload Receipt" `<Link>` button pointing to `/account/receipts/new` (if the page exists from Ticket 066; otherwise this is a forward reference — add the link when both tickets are merged)

**Key patterns:**
- `client_idempotency_key` generation: `const idempotencyKey = useRef(crypto.randomUUID())` — generate once on mount, do not regenerate on re-render
- Amount field: user types a dollar amount string ("12.50"); convert to integer cents before submission: `Math.round(parseFloat(value) * 100)`
- OCR stub: `await new Promise(resolve => setTimeout(resolve, 1500))` after the file is selected; then check `api_response.data.ocr_raw_data`; if null (as it will be at MVP), leave fields as-is; if populated (V2 future), set field values
- File preview: use `URL.createObjectURL(file)` for the preview src; revoke with `URL.revokeObjectURL` on component unmount or on new file selection
- On mobile, `<input type="file" accept="image/*" capture="environment">` opens the rear camera directly. Do not use `capture="user"` (front camera). Do not add `multiple` — one receipt per submission.
- Dollar input: use `inputMode="decimal"` on the amount `Input` so mobile keyboards show a numeric pad with decimal point — not `type="number"` which shows stepper arrows on desktop. Validate as a float string with zod: `z.string().regex(/^\d+(\.\d{1,2})?$/)`.
- Error retry: the `client_idempotency_key` is retained in `useRef` — if the upload fails and the user retries, the same key is sent. The server handles this safely with `ON CONFLICT DO NOTHING`.

**Do not:**
- Use `type="number"` for the amount input — use `type="text" inputMode="decimal"` to avoid stepper UI on desktop
- Redirect before the API response is confirmed successful
- Clear the form on a failed submission — preserve all entered values

---

## Acceptance Criteria

- [ ] Given an unauthenticated user visits `/account/receipts/new`, then they are redirected to `/sign-in?next=/account/receipts/new`
- [ ] Given an authenticated user opens the form on mobile, when they tap the photo upload area, then the device camera opens (rear-facing)
- [ ] Given a user selects a photo, then a preview of the image is shown with "Retake" and "Remove" buttons, and an OCR analysis loading state appears on the amount and date fields for 1.5 seconds
- [ ] Given the user types 2+ characters in the business search field, then a dropdown of matching listing names appears (debounced 300ms)
- [ ] Given the user selects a listing from the typeahead, then the business name appears as a pill and `listing_id` is stored in form state
- [ ] Given the user submits the form with a photo, amount, and date, then `POST /api/receipts/upload` is called with the correct fields including `client_idempotency_key`, and on success the user is redirected to `/account/receipts?uploaded=true`
- [ ] Given the user submits the form twice with the same `client_idempotency_key` (e.g., double-tap), then only one `receipt_uploads` row is created
- [ ] Given the API returns an error, then an error banner appears at the top of the form with the message — the form is not cleared
- [ ] Loading state: the submit button shows a spinner and "Submitting..." text; all inputs are disabled during submission
- [ ] Mobile at 375px: single-column layout; submit button is a sticky full-width bottom bar; all fields reachable without horizontal scroll

---

## Failure States

| Failure | User-visible behavior |
|---|---|
| File too large (> 10MB) | Client-side error before upload fires: "Image must be under 10MB. Please choose a smaller file." |
| Invalid file type | Client-side error: "Please upload a JPG, PNG, WebP, or HEIC image." |
| API returns `OPERATION_FAILED` | Error banner: "Upload failed. Please check your connection and try again." |
| No photo selected on submit | Inline error below the photo upload zone: "Please add a photo of your receipt." |
| Amount field empty on submit | Inline field error: "Please enter the amount spent." |
| Purchase date in the future | Inline field error: "Purchase date cannot be in the future." |
| Network timeout during upload | Error banner: "Connection timed out. Your receipt was not saved. Please try again." |

---

## Edge Cases

- User removes photo after selecting it: clear `file` from form state; clear the OCR pre-fill values; re-show the upload zone
- User changes the photo after OCR stub runs: re-trigger the OCR stub for the new photo
- User selects a business, then clears it (clicks × on the pill): `listing_id` is cleared; submission proceeds without `listing_id` — admin will match the business during review
- Amount entered as "1.999": round to 2 decimal places before converting to cents → `1.99` → 199 cents
- Amount entered as "0": validation error — "Amount must be greater than zero"
- `purchase_date` defaults to today but the user's device timezone differs from server timezone: accept the local date string as-is; no timezone conversion is applied at MVP

---

## Accessibility Notes

- [ ] All form inputs have associated `<label>` elements — not placeholder-only labels
- [ ] Photo upload zone is keyboard-focusable and activatable with Enter/Space (`role="button"` on the custom zone, or use a real `<label htmlFor>` wrapping the `<input type="file">`)
- [ ] The business typeahead dropdown is keyboard-navigable (arrow keys to move, Enter to select, Escape to close)
- [ ] Error messages are linked to their field via `aria-describedby`
- [ ] OCR loading state is announced via `aria-live="polite"` region: "Analyzing receipt..." then silent when complete
- [ ] The sticky submit button on mobile is not obscured by the virtual keyboard when a text field is focused (set `position: fixed; bottom: env(safe-area-inset-bottom, 0)`)

---

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | Happy path — full submission | supporter | Open form; upload photo; search and select a business; enter amount and date; submit | Redirected to `/account/receipts?uploaded=true`; new row in `receipt_uploads` with correct fields |
| QA-2 | Camera capture on mobile | supporter (mobile) | Open form on a 375px device; tap photo upload area | Device rear camera opens |
| QA-3 | Business typeahead | supporter | Type "Sou" in business search | Dropdown appears with matching listing names within 300ms debounce |
| QA-4 | Submit without photo | supporter | Fill in all fields but skip photo; tap Submit | Inline error: "Please add a photo of your receipt." — form not submitted |
| QA-5 | Duplicate prevention | supporter | Submit form; intercept before redirect; submit again with same session | Second submission deduped by `client_idempotency_key`; one row in DB |
| QA-6 | Mobile layout 375px | supporter | Open form on 375px viewport | Single-column layout; sticky submit button at bottom; no horizontal overflow |

---

## Security Notes

- Auth guard on the page (`app/account/receipts/new/page.tsx`): check session server-side; redirect unauthenticated users
- `client_idempotency_key` is generated client-side with `crypto.randomUUID()` — this is safe as it is a random UUID, not a secret
- The form does not render any sensitive data beyond the user's own submitted fields
- The Route Handler (Ticket 063) enforces `user_id = auth.uid()` on the INSERT — the form cannot submit on behalf of another user

---

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty/default, error, success redirect)
- [ ] Mobile tested at 375px (camera, sticky button, single-column layout)
- [ ] Keyboard navigation tested (typeahead, form submission)
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
