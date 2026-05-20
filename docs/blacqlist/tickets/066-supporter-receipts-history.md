# Ticket 066: Supporter receipts history list view (/account/receipts)

## Status
Draft

## Phase
Phase 11: Receipt Upload and Community Spend Beta

## Priority
P2

## Estimate
S (1–2h)

## Feature Area
Supporter Account

---

## Context

After a supporter submits receipts (Ticket 064), they need a place to see the history of everything they have uploaded — including the current review status of each submission. This ticket builds the `/account/receipts` page: a paginated list of the authenticated user's `receipt_uploads` rows, with status badges, metadata, a detail expand/view action, and a filter by status. Clicking a receipt row expands or navigates to a detail view that shows the submitted photo (via a fresh signed URL generated on-demand via the `getReceiptImageUrl` SA) and the full metadata including any rejection reason.

This page also serves as the landing page for the "Upload Receipt" CTA (it hosts the "Upload Receipt" button that links to `/account/receipts/new`).

Sources: `docs/blacqlist/ux/mvp-screen-map.md` § Receipt Upload Beta (`/account/receipts`); `docs/blacqlist/data/database-schema-plan.md` § receipt_uploads; `docs/blacqlist/architecture/server-actions-plan.md` § Spend.

---

## User Story

As an authenticated supporter, I want to see a list of my submitted receipts and their review status, so that I can track my community spend submissions and understand which receipts have been approved or rejected.

---

## Scope

**In scope:**
- `app/account/receipts/page.tsx` — Server Component; auth guard; server-side initial fetch of the current user's `receipt_uploads`; renders `ReceiptsHistoryList`
- `components/spend/ReceiptsHistoryList.tsx` — Client Component; list of receipt rows with pagination
- Each receipt row shows: business name (from `listings.name` if `listing_id` is set, else "Unknown business"), amount formatted as dollars, purchase date, status badge (`pending_review` / `approved` / `rejected`), submitted_at relative time (e.g., "3 days ago")
- Row click → opens an inline expand (accordion-style) OR navigates to a modal/sheet showing the receipt detail: photo (via signed URL, fetched on-demand), all metadata, and rejection reason if `status = 'rejected'`
- "Upload Receipt" Amber Gold button in the page header linking to `/account/receipts/new`
- Status filter: dropdown/Select — "All", "Pending Review", "Approved", "Rejected"; URL param: `?status=...`
- Pagination: 20 receipts per page; URL-param-driven (`?page=N`)
- Empty state (no receipts yet): heading "No receipts yet", body copy about uploading receipts, Amber Gold "Upload Your First Receipt" button → `/account/receipts/new`
- `getReceiptImageUrl` SA is called when the user opens the detail view — never pre-fetched
- Signed URL is for supporter use (own receipts) — the SA must check `receipt_uploads.user_id = auth.uid()`; if the supporter role cannot call this SA directly, expose a separate `GET /api/receipts/[id]/signed-url` Route Handler (Ticket 063) instead — use the Route Handler for supporter access, reserve the SA for admin access

**Out of scope:**
- Deleting a submitted receipt (V1)
- Editing a submitted receipt after submission (V1)
- Spend totals / impact summary on this page (Ticket 069 handles personal impact data)
- Admin review actions (Ticket 065)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 014 — Auth flows | Blocking ticket | Not started |
| Ticket 015 — App shell + account sidebar layout | Blocking ticket | Not started |
| Ticket 046 — Saved listings page (follow layout patterns for account pages) | Reference ticket | Not started |
| Ticket 063 — `GET /api/receipts/[id]/signed-url` Route Handler | Blocking ticket (for photo view) | Not started |
| Ticket 064 — Receipt submission form (produces test data; also needs link back to this page) | Soft dependency | Not started |
| `receipt_uploads` table | Database | Must exist |

---

## UX Notes

- **Screen:** Receipt Upload Beta — `docs/blacqlist/ux/mvp-screen-map.md` § Receipt Upload Beta
- **Route:** `/account/receipts`
- **Entry points:** Account sidebar nav "Receipts"; redirect after successful receipt upload (`?uploaded=true`); dollar-flow teaser CTA on homepage (authenticated users)
- **Exit points:** "Upload Receipt" button → `/account/receipts/new`; breadcrumbs (if applicable)
- **`?uploaded=true` banner:** When the page is loaded with `?uploaded=true` in the URL (redirect from Ticket 064's success state), show a dismissible success banner at the top: "Receipt submitted. We'll review it within 48 hours." — dismiss the banner and remove the query param on click or after 8 seconds
- **Receipt detail view options:** Prefer an inline expand (accordion row) over a modal, to keep the user in the list context. On mobile, a bottom sheet is acceptable. The photo loads only when the expand is triggered.
- **Status badge UX:**
  - `pending_review` → Amber badge ("Under Review")
  - `approved` → Green badge ("Approved")
  - `rejected` → Red badge ("Rejected") — shows rejection reason in the detail view
- **Empty state:** Replaces the list when there are zero receipts. Full-page empty state with illustration placeholder (or icon), heading, body, and CTA.
- **Mobile:** Single-column list. Each row is a compact card with business name, amount, date, and status badge. Full-width upload button at top. No horizontal overflow.

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components to use:** shadcn/ui `Accordion` or custom expand row, `Badge`, `Button`, `Select` (status filter), `Skeleton` (loading rows), `Separator`, `ScrollArea` if needed
- **Receipt row card:** `flex` row — business name (Lato Medium 14px, truncated) | amount (Lato, Amber Gold) | date (Lato 13px, Charcoal) | status `Badge` (right-aligned). On expand: photo (Skeleton while loading, then `<Image>` from signed URL), full metadata grid, rejection reason block (only when status = 'rejected').
- **Page header:** "My Receipts" heading (Glacial Indifference h1) | "Beta" badge (small Amber badge) | "Upload Receipt" Amber Gold `Button` (right-aligned on desktop, full-width on mobile)
- **States to implement:** Loading (skeleton rows), Empty (zero receipts), Error (banner if fetch fails), Success (list renders)

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` § receipt_uploads
- **Entities involved:** `receipt_uploads`, `listings` (LEFT JOIN for business name)
- **Operations:**
  - SELECT `receipt_uploads` WHERE `user_id = auth.uid()` AND (optional status filter); LEFT JOIN `listings` for `name`; ORDER BY `created_at DESC`; LIMIT 20 OFFSET ...
  - SELECT COUNT for pagination total
  - Signed URL fetch: `GET /api/receipts/[id]/signed-url` Route Handler (Ticket 063) — called client-side when a row is expanded
- **Validation:** No user mutation — read-only page plus the signed URL fetch
- **RLS:** `receipt_uploads` SELECT policy: `authenticated` users can SELECT only rows where `user_id = auth.uid()` — enforced by RLS; no service role needed for this page
- **Migration required:** No new tables

---

## API Notes

- **`GET /api/receipts/[id]/signed-url`** (Ticket 063) — called from the Client Component when a receipt row is expanded
  - Auth required: `authenticated`; owner-only
  - Response: `{ data: { signed_url: string; expires_at: string } }`
  - Error: 401 (no session), 404 (not found or wrong owner)

No Server Actions in this ticket — the page is read-only. The upload navigation goes to Ticket 064's form. The signed URL fetch uses the Route Handler from Ticket 063.

---

## Implementation Notes

**Files to create:**
- `app/account/receipts/page.tsx` — Server Component; reads `?status` and `?page` search params; fetches initial data server-side; renders `ReceiptsHistoryList`
- `components/spend/ReceiptsHistoryList.tsx` — Client Component; list with expand, filter, and pagination

**Files to modify:**
- `app/account/layout.tsx` (or sidebar nav component) — add "Receipts" nav item

**Key patterns:**
- Use the Supabase client with `auth.uid()` inside the Server Component for the initial server-side data fetch — RLS ensures the query only returns the current user's rows
- Signed URL fetch in the expand: call `fetch('/api/receipts/[id]/signed-url')` when `onAccordionItemOpen` fires; do not pre-fetch all rows
- `?uploaded=true` detection: check in `page.tsx` server-side via `searchParams.uploaded`; pass a boolean prop to the Client Component; the Client Component reads it and renders the success banner, then uses `router.replace` to strip the query param after displaying
- Follow the layout pattern from Ticket 046 (`/account/saved`) for consistency in the account section
- Amount display: `(amount_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })`
- Relative time: use `Intl.RelativeTimeFormat` or the `date-fns` `formatDistanceToNow` function — check if `date-fns` is already installed before using it

**Do not:**
- Pre-fetch signed URLs for all rows on page load — only fetch on expand
- Expose `file_path` raw storage paths in the UI — always use the signed URL from the Route Handler
- Allow modification or deletion of receipts (this is a read-only history view at MVP)

---

## Acceptance Criteria

- [ ] Given an authenticated user with submitted receipts visits `/account/receipts`, then a list of their receipts is shown with business name, amount, date, and status badge
- [ ] Given the user arrives via redirect from the upload form (`?uploaded=true`), then a dismissible success banner appears: "Receipt submitted. We'll review it within 48 hours."
- [ ] Given the user clicks a receipt row, then the row expands and a signed-URL receipt image loads (shown as a skeleton until the URL resolves)
- [ ] Given a receipt has `status = 'rejected'`, when the row is expanded, then the rejection reason is visible in the detail view
- [ ] Given the user selects the "Approved" filter, then only `approved` receipts are shown and the URL updates to `?status=approved`
- [ ] Given the user has more than 20 receipts, then pagination controls are shown at the bottom; clicking page 2 loads the next 20
- [ ] Empty state: given the user has no receipts, then the empty state is shown with an "Upload Your First Receipt" CTA linking to `/account/receipts/new`
- [ ] Loading state: the initial page load shows skeleton rows while the server-side fetch completes
- [ ] Mobile at 375px: single-column list, "Upload Receipt" button full-width, no horizontal overflow

---

## Failure States

| Failure | User-visible behavior |
|---|---|
| Server-side receipts query fails | Error banner: "Could not load your receipts. Please refresh the page." |
| Signed URL fetch fails on row expand | Error message in the expanded row: "Could not load receipt image." — other metadata still visible |
| Unauthenticated user visits the page | Redirect to `/sign-in?next=/account/receipts` |

---

## Edge Cases

- Receipt has `listing_id = null`: show "Unknown business" in the business name field
- Receipt image file was deleted from storage (orphaned): signed URL fetch returns an error; show "Receipt image unavailable" in the expanded view
- User expands a row, the signed URL expires after 15 minutes, then tries to view the image again: the `<Image>` will show a broken state; show a "Reload image" button that re-calls the signed URL endpoint
- `?uploaded=true` is manually typed into the URL by a user who has no recent uploads: the banner still shows (acceptable — it is harmless)
- All receipts on a page are rejected: the page renders normally with red "Rejected" badges; no special behavior

---

## Accessibility Notes

- [ ] Accordion rows have `aria-expanded` on the trigger and associated `aria-controls` / `id` on the panel
- [ ] Receipt image in the expanded view has `alt="Submitted receipt — [business name] — [date]"`
- [ ] Status badges have `aria-label` describing the status in text (not color-only)
- [ ] "Upload Receipt" button has a descriptive accessible name
- [ ] Pagination controls have `aria-label="Go to page N"` on page buttons

---

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | Happy path — list visible | supporter | Submit 3 receipts; navigate to `/account/receipts` | 3 receipt rows shown with correct metadata and status badges |
| QA-2 | Post-upload success banner | supporter | Submit a receipt via Ticket 064 form | Redirect to `/account/receipts?uploaded=true`; banner "Receipt submitted. We'll review it within 48 hours." shown |
| QA-3 | Expand row and view image | supporter | Click a receipt row | Row expands; receipt image loads (signed URL fetched on demand) |
| QA-4 | Rejected receipt detail | supporter | Approve a receipt via admin, then reject it via admin with a reason; view the receipt as the supporter | Row shows "Rejected" badge; rejection reason visible in expanded view |
| QA-5 | Status filter | supporter | Select "Approved" filter | Only approved receipts shown; URL updates to `?status=approved` |
| QA-6 | Empty state | supporter (no receipts) | Visit `/account/receipts` | Empty state shown with "Upload Your First Receipt" CTA |

---

## Security Notes

- Server Component performs auth check before rendering — redirect unauthenticated users to `/sign-in?next=/account/receipts`
- RLS on `receipt_uploads` ensures the SELECT query only returns the current user's rows — even if the query is manually crafted, the DB enforces ownership
- Signed URL fetch Route Handler (`GET /api/receipts/[id]/signed-url`) enforces owner-only access — returning 404 for non-owner requests to avoid information leakage

---

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading skeleton, empty, error banner, success list)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested (accordion expand, pagination)
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
