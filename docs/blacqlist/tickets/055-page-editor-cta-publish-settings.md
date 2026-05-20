# Ticket 055: Page editor — CTA configuration and publish/unpublish settings

## Status

Draft

## Phase

Phase 8: Owner Dashboard

## Priority

P1

## Feature Area

Owner Dashboard

## Context

The final sections of the page editor at `/dashboard/page`. This ticket implements the **CTA configuration section** (owner selects a primary CTA type from the 9 MVP-active types and enters the associated URL/phone, then sees a live preview of the CTA button) and the **Publish/Unpublish settings section** (a toggle that controls `listings.status`; first publish fires `publishListing` SA, which revalidates both the listing page and the city tag; subsequent toggles use `unpublishListing` / re-publish via `updateListingDraft` + status update). The "Published" state shows a "Live" badge and a "View page" link. The "Draft/Unpublished" state shows a warning that the page is hidden from discovery.

Source documents: `docs/blacqlist/ux/mvp-screen-map.md` (Page Editor — CTA section, Publish settings section), `docs/blacqlist/architecture/server-actions-plan.md` (`publishListing`, `unpublishListing`, `updateListingDraft`, `manageCtas`), `docs/blacqlist/data/database-schema-plan.md` (`listings`, `listing_details_business`), `docs/blacqlist/data/enums-and-statuses.md` (CTA types, status values).

## User Story

As a business owner, I want to configure how visitors can contact or engage with my business through a CTA button, and control whether my page is visible to the public, so that I can launch when I'm ready and ensure customers reach me in the right way.

## Scope

- `app/dashboard/page/components/CTASection.tsx` — Client Component: 9 CTA type option cards + conditional input (URL or phone) + live CTA button preview
- `app/dashboard/page/components/PublishSection.tsx` — Client Component: publish/unpublish toggle with status badge + "View live page" link + confirmation dialog for both publish and unpublish actions
- CTA save: fires `manageCtas` SA or `updateListingDraft` with `cta_type` and `cta_value` fields on `listing_details_business`; triggers `revalidatePath` if listing is published
- First publish: fires `publishListing` SA (admin-path SA — **assumption:** for owner-submitted listings with `source='owner'`, the owner can publish directly without admin review; this is consistent with the status state machine in `enums-and-statuses.md` where `draft → published` is allowed for owner-created listings); `revalidatePath` + `revalidateTag('city-[citySlug]')` fires
- Unpublish: fires `unpublishListing` SA (to be created in this ticket or confirmed from the SA inventory — note: `unpublishListing` is referenced in the ticket brief but not explicitly in the SA inventory; implement as `updateListingDraft` with `status = 'unpublished'`; this requires ownership verification)
- Confirmation dialogs for both Publish (first time: "Your page will be live. Ready to publish?") and Unpublish ("Your page will be hidden from discovery. Unpublish?")
- `revalidateTag(\`listing-\${id}\`)` and the city tag fire after publish/unpublish

## Out of Scope

- Admin-triggered `approveEntity` / `rejectEntity` flows (Ticket 039/041)
- Stripe subscription gating on publish (V1 tier feature)
- Multiple CTAs per listing (V3 `listing_ctas` table)
- `cta_label_override` custom label (V1 feature)
- Analytics events related to CTA clicks (tracked on the public page, not in the editor)

## Dependencies

- Depends on: Ticket 051 (page editor shell — `PageEditorShell`, `page.tsx`, layout)
- Depends on: Ticket 052 (contact section — phone field may be pre-filled for `call` CTA type)
- Depends on: Ticket 009 (`listings` table — `status`, `published_at`), Ticket 010 (`listing_details_business` — `cta_type`, `cta_url`, `cta_label_override`), Ticket 013 (RLS)
- Depends on: Ticket 014 (auth)
- Soft dependency: Ticket 021 (BLACQList Page public component — needed for "View page" link to function correctly after publish)

## UX Notes

- **Screen:** Page Editor — `docs/blacqlist/ux/mvp-screen-map.md` → "CTA section" and "Publish settings section"
- **Route:** `/dashboard/page`
- **CTA section:** 9 option cards in a 3-column grid (desktop), 2-column (tablet), 1-column (mobile). Each card: CTA icon + label. Selected card has an Amber Gold border + background tint. Below the card grid, a conditional input renders based on the selected type:
  - `book`, `order`, `message`, `get-quote`, `subscribe`, `contact`, `inquire`, `visit` → URL input (with "https://" placeholder prefix)
  - `call` → phone input (pre-filled from the contact section phone field)
  - Below the input, a preview area shows: "Preview" label + the rendered CTA button exactly as it will appear on the public page (Amber Gold button, correct label)
- **Publish section:** A full-width section card below the CTA section.
  - **Draft state:** Yellow/amber warning banner: "Your page is not visible to the public." Toggle off. "Publish your page" Amber Gold button.
  - **Published state:** Green "Live" badge. Toggle on. "View live page →" link (new tab). "Unpublish" ghost button (destructive color).
  - **First publish dialog:** "Ready to go live? Your BLACQList Page will be visible to visitors." Confirm: "Publish" (Amber Gold). Cancel: "Not yet".
  - **Unpublish dialog:** "Hide your page? Your page will no longer appear in search results or on The BLACQList." Confirm: "Unpublish" (destructive red). Cancel.
- **Loading state:** Skeleton matching section layout
- **Error state:** SA failure shows inline toast with retry
- **Success (publish):** Green "Live" badge appears; "View live page →" link activates; toast: "Your page is now live."
- **Success (unpublish):** Yellow warning banner returns; toast: "Your page has been unpublished."
- **Mobile (375px):** CTA option cards in 1-column list; preview area full-width; publish section full-width

## Design Notes

- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Colors:** Amber Gold `#E2A428` for selected CTA card border + publish button + live badge; yellow/amber `#F59E0B` for draft warning state; green for "Live" badge; red destructive for unpublish confirm
- **CTA preview button:** Matches the exact design from the public page (`BLACQList Page` spec, Ticket 022) — same Amber Gold background, black text, `px-8 py-3 rounded-full` (or matching rounded style), correct label
- **Fonts:** Glacial Indifference Bold for section heading; Quicksand Bold Italic for CTA preview button text
- **Components:** shadcn/ui `Card` (for CTA option cards), `Button` (default Amber Gold for publish, destructive for unpublish), `Dialog` / `AlertDialog` (for publish/unpublish confirmation), `Badge` (for "Live" status), `Input` (for CTA URL/phone), `RadioGroup` semantics for CTA type selection
- **States:** Default (draft, no CTA set), CTA type selected, Input provided, Published, Unpublished, Dialog open, Saving, Error

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `listings` (`status`, `published_at`, `slug`, `city_id`), `listing_details_business` (`cta_type`, `cta_url`, `phone`)
- **CTA fields:** `listing_details_business.cta_type` (CHECK constraint, 9 MVP types), `listing_details_business.cta_url` (nullable — null for `call` type), `listing_details_business.cta_label_override` (not used at MVP)
- **Status field:** `listings.status` — transitions: `draft → published` (owner direct publish), `published → unpublished` (owner), `unpublished → published` (owner re-publish)
- **Operations:**
  - UPDATE `listing_details_business.cta_type`, `cta_url` via `updateListingDraft` or `manageCtas` SA
  - UPDATE `listings.status = 'published'`, `listings.published_at = now()` (if first publish) via `publishListing` SA
  - UPDATE `listings.status = 'unpublished'` via `updateListingDraft` or a dedicated `unpublishListing` SA
- **Validation rules:**
  - `cta_type`: required before publish; must be one of the 9 MVP types
  - `cta_url`: required for all types except `call`; must be a valid `https://`-prefixed URL
  - Cannot publish without a `name`, `cta_type`, and at least one of `phone` or `description` set (completion check from Ticket 050 checklist)
- **RLS:** owner UPDATE on own listing only; `published_at` is set server-side (never client-supplied)
- **Migration required:** No — all columns exist from Ticket 009/010

## API Notes

- **Server Actions:**
  - `manageCtas` (`lib/actions/dashboard/manageCtas.ts`) — updates `cta_type` and `cta_url`; `revalidatePath` if published
  - `publishListing` (`lib/actions/listings/publishListing.ts`) — sets `status = 'published'`, `published_at = now()` (if null); `revalidatePath` for listing page + `revalidateTag('city-[citySlug]')`
  - Unpublish — implement as an extension of `updateListingDraft` with `status = 'unpublished'`, or as a dedicated `unpublishListing` SA; `revalidatePath` after confirmed write
- **`publishListing` request shape:** `{ listingId: string }` — fetches city slug and listing slug server-side for cache paths
- **`manageCtas` request shape:** `{ listingId: string, ctaType: string, ctaUrl: string | null }`
- **Error codes:** `AUTH_REQUIRED`, `NOT_FOUND`, `VALIDATION_ERROR` (cta_url required but missing), `INVALID_STATUS_TRANSITION` (e.g., trying to publish an archived listing), `OPERATION_FAILED`
- **Cache invalidation:** `publishListing` calls `revalidatePath('/[citySlug]/business/[listingSlug]')` + `revalidateTag('city-[citySlug]')`; `manageCtas` calls `revalidatePath` when listing is published; unpublish calls `revalidatePath`

## Implementation Notes

**Files to create:**

- `app/dashboard/page/components/CTASection.tsx`
- `app/dashboard/page/components/PublishSection.tsx`
- `lib/actions/dashboard/manageCtas.ts` (if not already scaffolded)
- `lib/actions/listings/publishListing.ts` (if not from Ticket 050 scope — confirm)

**Files to modify:**

- `app/dashboard/page/components/PageEditorShell.tsx` — add `<CTASection>` and `<PublishSection>` as the last two sections
- `app/dashboard/page/page.tsx` — pass `listing.status`, `listing.published_at`, `listing.slug`, `listing.city_id`, `listingDetails.cta_type`, `listingDetails.cta_url` as props

**Key patterns:**

- CTA type selection: use a controlled `useState` for the selected type; the conditional URL/phone input renders based on the selected type via a lookup object `CTA_INPUT_CONFIG[ctaType]`; define this config once in `lib/constants/cta.ts`
- CTA preview component: a read-only `<button>` styled identically to the public page CTA button; updates reactively as the owner changes type/URL
- `publishListing` SA must set `published_at = now()` only on the first publish (`WHERE published_at IS NULL`); re-publishing after unpublish should NOT reset `published_at`
- Confirmation dialogs: use shadcn/ui `AlertDialog` — `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`

**Do not:**

- Allow direct `status` writes from the client — always validate the transition server-side
- Show `published_at` as user-settable — it is set by the server only
- Revalidate the homepage or all city pages on publish — only the specific listing path and the listing's city tag

## Acceptance Criteria

- [ ] CTA section shows 9 option cards for the MVP CTA types; the current `cta_type` is pre-selected on load
- [ ] Selecting a different CTA type updates the conditional input; URL input shown for URL types, phone input shown for `call` type
- [ ] CTA preview renders the correct Amber Gold button with the correct default label for the selected type
- [ ] Saving the CTA section calls `manageCtas` SA; the public page reflects the new CTA after `revalidatePath`
- [ ] URL-type CTAs reject non-`https://` URLs with inline error: "URL must start with https://"
- [ ] Publish section shows the correct state based on `listings.status` on load (draft warning OR live badge)
- [ ] Clicking "Publish your page" opens the confirmation dialog; confirming fires `publishListing` SA; status updates to "Live"
- [ ] Clicking "Unpublish" opens the confirmation dialog; confirming fires the unpublish SA; status reverts to draft warning state
- [ ] After publish, "View live page →" link navigates to the correct public listing URL in a new tab
- [ ] `revalidatePath` and `revalidateTag('city-[slug]')` fire after publish; city landing page reflects the new listing within the ISR window
- [ ] Toast "Your page is now live." appears after successful publish
- [ ] Toast "Your page has been unpublished." appears after successful unpublish
- [ ] Mobile (375px): CTA option cards stack in a single column; publish section is full-width; dialogs are mobile-friendly
- [ ] `tsc --noEmit` and `npm run lint` pass with zero errors

## Failure States

| Failure                                                          | User-visible behavior                                                                                |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `manageCtas` returns `VALIDATION_ERROR` (URL missing or invalid) | Inline field error below the CTA URL input                                                           |
| `publishListing` returns `OPERATION_FAILED`                      | Dialog remains open; error message shown within the dialog: "Couldn't publish your page. Try again." |
| `publishListing` returns `INVALID_STATUS_TRANSITION`             | Toast: "Your page cannot be published from its current state. Contact support."                      |
| Unpublish SA fails                                               | Toast: "Couldn't unpublish your page. Try again." Status badge remains "Live".                       |
| Session expired before confirmation                              | SA returns `AUTH_REQUIRED`; dialog closes; toast with sign-in link                                   |

## Edge Cases

- Owner tries to publish with no `cta_type` set — the "Publish your page" button is disabled (or the SA returns `VALIDATION_ERROR`) with tooltip: "Set a primary CTA before publishing."
- Owner tries to re-publish after unpublishing — same `publishListing` SA path; `published_at` is NOT reset (the condition `WHERE published_at IS NULL` is only set on first publish)
- Owner changes CTA type from `call` to a URL type while phone field is empty — URL input is required; show the input but the field is blank; owner must enter a URL before saving
- Listing is in `pending` or `flagged` status — owner should not be able to publish from this state; SA returns `INVALID_STATUS_TRANSITION`; message informs owner to contact support
- `revalidateTag('city-[citySlug]')` fires but the city ISR cache is already fresh — no visible issue; Next.js handles this gracefully

## Accessibility Notes

- [ ] CTA option cards use `role="radio"` with a surrounding `role="radiogroup"` and label "Select primary CTA type"
- [ ] Selected card has `aria-checked="true"`; unselected cards have `aria-checked="false"`
- [ ] CTA URL / phone input has associated label matching the CTA type: "Booking URL", "Phone number", etc.
- [ ] CTA preview button has `aria-label="CTA preview: [label]"` and `disabled` attribute (it is a visual preview, not interactive)
- [ ] Publish confirmation dialog (`AlertDialog`) has `aria-labelledby` and `aria-describedby` pointing to the dialog heading and description
- [ ] "View live page" link has `aria-label="View your live BLACQList Page (opens in new tab)"`
- [ ] Toast notifications are in an `aria-live="polite"` region

## QA Test Cases

| #   | Scenario                 | Role                      | Steps                                                                         | Expected result                                                                                   |
| --- | ------------------------ | ------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Select CTA type and save | Owner                     | 1. Select "Book Now". 2. Enter booking URL. 3. Tab away.                      | CTA saved via SA; preview shows "Book Now" Amber Gold button; `revalidatePath` fires if published |
| 2   | Invalid CTA URL          | Owner                     | 1. Select "Visit Us". 2. Enter "http://example.com" (non-https). 3. Tab away. | Inline error: "URL must start with https://"                                                      |
| 3   | First publish            | Owner                     | 1. Click "Publish your page". 2. Confirm in dialog.                           | `publishListing` SA fires; status → "Live"; toast shown; `revalidatePath` + `revalidateTag` fire  |
| 4   | Unpublish                | Owner (published listing) | 1. Click "Unpublish". 2. Confirm in dialog.                                   | Unpublish SA fires; warning banner shown; toast shown                                             |
| 5   | Mobile publish dialog    | Owner                     | 1. Open on 375px. 2. Click "Publish your page".                               | Dialog opens full-screen or as bottom sheet; confirm button is full-width and reachable           |

## Security Notes

- `publishListing` SA validates that `listings.owner_user_id = auth.uid()` before updating status — the owner cannot publish another user's listing
- Status transition validation happens server-side — client cannot POST arbitrary `status` values
- `published_at` is set by the server in the SA body (`now()`) — never client-supplied
- `revalidateTag` and `revalidatePath` are called only after a confirmed successful DB write (step 6 of the 7-step SA pattern)

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (draft warning, publishing in progress, live, error)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested (CTA radio cards, dialog keyboard operability)
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
