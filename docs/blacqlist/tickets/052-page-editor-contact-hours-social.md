# Ticket 052: Page editor — contact, hours, and social links sections

## Status
Draft

## Phase
Phase 8: Owner Dashboard

## Priority
P1

## Feature Area
Owner Dashboard

## Context
Continuation of the page editor at `/dashboard/page`. This ticket adds three sections to the form shell established in Ticket 051: **Contact** (phone, email, website URL, address / service area toggle), **Hours** (7-day schedule using the `listing_hours` table — each day has `open_time`, `close_time`, `is_closed` boolean plus optional notes), and **Social Links** (up to 11 platform types from `listing_links` — `platform` and `url` per row). Each section saves independently via `updateListingDraft` for field-level data and via dedicated helper logic for hours rows (UPSERT per `day_of_week`) and social link rows (INSERT/UPDATE/DELETE). Cache invalidation (`revalidatePath`) fires after a confirmed write when the listing is published.

Source documents: `docs/blacqlist/ux/mvp-screen-map.md` (Page Editor), `docs/blacqlist/architecture/server-actions-plan.md` (`updateListingDraft`), `docs/blacqlist/data/database-schema-plan.md` (`listing_details_business`, `listing_hours`, `listing_links`), `docs/blacqlist/data/enums-and-statuses.md` (platform types).

## User Story
As a business owner, I want to update my contact details, set my weekly operating hours, and add social links, so that customers can reach me and know when I'm open.

## Scope
- `app/dashboard/page/components/ContactSection.tsx` — Client Component: phone (`tel` input), email, website URL, address fields; location type toggle ("Physical address" vs "Service area description"); validation
- `app/dashboard/page/components/HoursSection.tsx` — Client Component: 7-day schedule table; per-day open time, close time, is_closed toggle; "Same as Monday" shortcut button; batch UPSERT into `listing_hours`
- `app/dashboard/page/components/SocialSection.tsx` — Client Component: 11 platform URL inputs (instagram, facebook, twitter, tiktok, youtube, linkedin, pinterest, website, booking, shop, other); platform icon to the left of each input; empty inputs are NOT saved as rows
- Each section autosaves on blur via the appropriate SA call
- Hours section: UPSERT all 7 rows atomically; `UNIQUE(listing_id, day_of_week)` constraint means safe to re-upsert
- Social links section: read all current `listing_links` rows for the listing; on save, diff against current state and INSERT new rows, UPDATE changed URLs, DELETE rows where URL was cleared

## Out of Scope
- Gallery management (Ticket 053)
- CTA configuration (Ticket 055)
- Hero and about sections (Ticket 051)
- Address geocoding (`lat`, `lng`) — V2 feature
- Real-time open/closed indicator on the editor itself (rendered on public page only, Ticket 021)

## Dependencies
- Depends on: Ticket 051 (page editor shell — `PageEditorShell`, autosave pattern, route/layout)
- Depends on: Ticket 010 (`listing_hours`, `listing_links` tables), Ticket 009 (`listing_details_business`)
- Depends on: Ticket 013 (RLS), Ticket 014 (auth)

## UX Notes
- **Screen:** Page Editor — `docs/blacqlist/ux/mvp-screen-map.md` → "Page Editor (`/dashboard/page`)" — "Contact section", "Hours section", "Social Links section"
- **Route:** `/dashboard/page` (same page component as Ticket 051, additional sections)
- **Contact section:** Location type toggle at the top — "Fixed address" shows address_line_1, address_line_2, city_text, state, zip fields; "Service area" shows a single text field for service_area_description. Phone input uses `type="tel"`. Website input uses `type="url"` with placeholder "https://". Email uses `type="email"`.
- **Hours section:** Rendered as a table: day label (Mon–Sun) | Closed toggle (checkbox) | Open time | Close time | Notes (optional). When "Closed" is checked, open/close inputs are disabled and cleared. A "Same as Monday" button copies Monday's open_time / close_time / is_closed to all days. Days display in order Monday–Sunday.
- **Social links section:** Each of the 11 platforms shows its icon + label + a URL input on one row. Empty inputs are displayed but not saved (no row created for a blank URL). When a previously-filled URL is cleared and saved, the corresponding `listing_links` row is deleted.
- **Mobile (375px):** Contact and social sections stack vertically; each row is full-width. Hours table scrolls horizontally on mobile; alternately, renders as a stacked list (one card per day) below `sm:`.
- **Loading:** Sections hydrate from the data fetched in the parent Server Component (Ticket 051's `page.tsx`)
- **Error state:** Section-level inline toast on save failure; field-level errors below each input
- **Success state:** Autosave indicator transitions to "Saved [timestamp]"

## Design Notes
- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Colors:** Amber Gold `#E2A428` for "Closed" toggle active state; Pale Lavender `#E9E9F7` for disabled time inputs; Cream `#FCFAF4` for section card backgrounds
- **Fonts:** Glacial Indifference Bold section headings; Lato Regular field labels
- **Components:** shadcn/ui `Input`, `Label`, `Switch` (for is_closed toggle), `Select` (or native `<input type="time">`), `Button`, `Textarea` (service area description), `Checkbox` (location type toggle uses `RadioGroup` or two-card toggle); social platform icons from `lucide-react` or branded SVGs
- **Time inputs:** Use native `<input type="time">` for open/close times — cross-platform compatible; style consistently with other inputs via Tailwind
- **States to implement:** Default (fields populated), Closed-day (time inputs disabled), Loading (skeleton rows), Saving, Error, Success

## Data Notes
- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `listing_details_business`, `listing_hours`, `listing_links`
- **Entities and operations:**
  - `listing_details_business`: SELECT + UPDATE fields: `phone`, `email`, `website_url`, `address_line_1`, `address_line_2`, `city_text`, `state`, `zip`; `ships_nationwide` flag synced when location_type changes
  - `listings`: UPDATE `location_type`, `service_area_description` via `updateListingDraft` SA
  - `listing_hours`: UPSERT 7 rows via `INSERT ... ON CONFLICT (listing_id, day_of_week) DO UPDATE SET open_time = ..., close_time = ..., is_closed = ..., notes = ..., updated_at = now()` — all 7 days in one batch
  - `listing_links`: SELECT all rows for listing; diff on save — INSERT new, UPDATE changed, DELETE cleared
- **Validation rules:**
  - `phone`: optional; format validated client-side with a basic regex (not enforced at DB layer)
  - `email`: optional; valid email format
  - `website_url`: optional; must start with `https://` — validated via zod `.url()` with `.startsWith('https://')`
  - Social link URLs: each optional; when non-empty, must be a valid URL starting with `https://`
  - Hours: `open_time` must be before `close_time` unless `is_closed = true`; both must be null when `is_closed = true`
- **RLS:** `authenticated` UPDATE on `listing_details_business` only through ownership; `listing_hours` INSERT/UPDATE/DELETE only where `listings.owner_user_id = auth.uid()`; `listing_links` same
- **Migration required:** No — tables exist from Ticket 010

## API Notes
- **Server Actions plan:** `docs/blacqlist/architecture/server-actions-plan.md` → `updateListingDraft` (`lib/actions/listings/updateListingDraft.ts`)
- **Actions involved:**
  - `updateListingDraft` — used for contact fields (maps to `listing_details_business` and `listings.location_type`, `listings.service_area_description`)
  - Extend `updateListingDraft` or create a co-located helper `updateListingHours(listingId, hoursPayload[])` and `updateListingLinks(listingId, linksPayload[])` within the same `updateListingDraft.ts` file or as separate small SAs in `lib/actions/dashboard/`
- **Auth required:** Yes — ownership verified server-side
- **Hours request shape:** `{ listingId: string, hours: Array<{ dayOfWeek: 0|1|2|3|4|5|6, openTime: string|null, closeTime: string|null, isClosed: boolean, notes: string|null }> }`
- **Links request shape:** `{ listingId: string, links: Array<{ platform: string, url: string }> }` — only non-empty URLs sent; server deletes rows for platforms not present
- **Error codes:** `AUTH_REQUIRED`, `NOT_FOUND`, `VALIDATION_ERROR` (field-level errors for URL format failures, hours ordering failures), `OPERATION_FAILED`

## Implementation Notes
**Files to create:**
- `app/dashboard/page/components/ContactSection.tsx`
- `app/dashboard/page/components/HoursSection.tsx`
- `app/dashboard/page/components/SocialSection.tsx`
- `lib/validations/listing.ts` — add `contactSectionSchema`, `hoursSectionSchema`, `socialLinksSectionSchema`

**Files to modify:**
- `app/dashboard/page/components/PageEditorShell.tsx` — add the three new section components below the Hero and About sections from Ticket 051
- `app/dashboard/page/page.tsx` — add fetches for `listing_hours` and `listing_links` alongside existing listing/detail fetch; pass as props
- `lib/actions/listings/updateListingDraft.ts` — extend to handle contact and social link fields, or add co-located helper SAs for hours/links

**Key patterns:**
- Hours UPSERT: use a single batch SQL call; do not loop 7 separate INSERT calls. Use Supabase `upsert()` with `onConflict: 'listing_id,day_of_week'`
- Social links diff: compute the diff client-side before sending to avoid unnecessary deletes; alternatively, pass the full current link set to the SA and let the server compute the diff with a transaction
- "Same as Monday" button: sets form state for all days to match Monday's values via `form.setValue`; does not fire a save until the user blurs or explicitly saves
- Time validation: zod refinement — `z.string().regex(/^\d{2}:\d{2}$/).nullable()` for open/close time; cross-field refinement for "open before close"
- Social platform icons: map platform values (`'instagram'`, `'tiktok'`, etc.) to icon components; define a `PLATFORM_META` config object for label + icon + placeholder URL format

**Do not:**
- Create a separate route or page for hours — it belongs in the same `/dashboard/page` editor
- Save an empty string as a `listing_links` URL — only insert rows for non-empty, valid URLs
- Set `updated_by` to a value from the client — always set it server-side from `user.id`

## Acceptance Criteria
- [ ] Contact section fields (phone, email, website, address OR service area) are populated from the database on page load
- [ ] Location type toggle switches between address fields and service area description field; switching clears the unused fields and saves the new `location_type` to `listings`
- [ ] Website URL is validated as `https://`-prefixed; entering a non-https URL shows inline error: "Website URL must start with https://"
- [ ] Hours section shows 7 rows (Monday through Sunday) populated from `listing_hours`
- [ ] Toggling "Closed" for a day disables and clears the time inputs; saving upserts `is_closed = true, open_time = null, close_time = null`
- [ ] "Same as Monday" button copies Monday's times to all days (client-side only; does not auto-save)
- [ ] Hours validation: attempting to set open time after close time on a non-closed day shows inline error: "Opening time must be before closing time."
- [ ] Hours save: all 7 rows are upserted in a single operation; existing rows are updated, not duplicated
- [ ] Social section shows all 11 platform fields; non-empty URLs are saved as `listing_links` rows; clearing a URL removes the row on next save
- [ ] All social link URLs validate as `https://` prefixed; invalid URLs show field-level error
- [ ] All three sections autosave on blur with the shared autosave indicator pattern
- [ ] Mobile (375px): hours table renders as stacked per-day cards; no horizontal overflow
- [ ] `tsc --noEmit` and `npm run lint` pass with zero errors

## Failure States
| Failure | User-visible behavior |
|---|---|
| Hours UPSERT fails (`OPERATION_FAILED`) | Toast: "Couldn't save your hours. Try again." Hours form values are preserved; indicator shows "Unsaved changes" |
| Social links save fails | Toast: "Couldn't save your social links. Try again." |
| Open time after close time | Inline field error below close time input: "Opening time must be before closing time." SA not called. |
| URL format invalid | Inline field error: "Enter a valid URL starting with https://" |
| Session expired | SA returns `AUTH_REQUIRED`; toast: "Session expired. Sign in again." Link to `/sign-in?next=/dashboard/page` |

## Edge Cases
- Owner sets all 7 days to "Closed" — valid state; each day upserts with `is_closed = true`
- Owner enters an open time equal to close time ("09:00"–"09:00") — treat as invalid; show error: "Opening and closing times must be different."
- Social link URL has trailing whitespace — trim before validation and save
- Owner clears all social links — all `listing_links` rows for this listing are deleted; no error
- Owner updates hours while the listing is being viewed by a public visitor — the ISR-cached page serves stale data until `revalidatePath` fires; this is expected behavior
- `listing_hours` rows do not exist yet (new listing) — section shows empty time inputs; "Same as Monday" has no effect until Monday is set

## Accessibility Notes
- [ ] Hours table has a `<caption>` or visually-hidden heading: "Weekly operating hours"
- [ ] Each `is_closed` toggle is a `<Switch>` with `aria-label="Closed on [day name]"`
- [ ] Open and close time inputs have associated labels: "Monday opening time", "Monday closing time"
- [ ] The "Same as Monday" button has `aria-label="Copy Monday hours to all days"`
- [ ] Social link inputs have labels: "[Platform] URL" (e.g., "Instagram URL")
- [ ] Disabled time inputs (when `is_closed = true`) have `aria-disabled="true"`
- [ ] Error messages are linked to their inputs via `aria-describedby`

## QA Test Cases
| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| 1 | Hours UPSERT happy path | Owner | 1. Set Monday 9:00am–5:00pm. 2. Set Sunday Closed. 3. Tab away. | All 7 rows upsert; DB reflects open/close times for Mon–Sat and `is_closed=true` for Sun |
| 2 | "Same as Monday" shortcut | Owner | 1. Set Monday 10:00am–6:00pm. 2. Click "Same as Monday". | All days show Mon values; no save fires yet |
| 3 | Invalid hours ordering | Owner | 1. Set Monday open = 5:00pm, close = 9:00am. 2. Tab away from close time. | Inline error: "Opening time must be before closing time." SA not called. |
| 4 | Social link save and clear | Owner | 1. Enter Instagram URL. 2. Tab away (saves). 3. Clear Instagram URL. 4. Tab away. | First save: `listing_links` row created. Second save: row deleted. |
| 5 | Mobile 375px hours | Owner | 1. Open on 375px. 2. Navigate to hours section. | Days stack as cards; time inputs are full-width; no horizontal scroll |

## Security Notes
- `updateListingDraft` (and any hours/links helper SA) validates ownership server-side via `user_roles` query before any write
- Social link URLs must be validated server-side with zod `.url()` — do not trust client-side validation alone
- `platform` field is validated against the allowed CHECK constraint values from `enums-and-statuses.md` via a zod enum
- No PII (email, phone) is returned in error messages — errors reference field names only

## Completion Checklist
- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, default/populated, saving, error)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
