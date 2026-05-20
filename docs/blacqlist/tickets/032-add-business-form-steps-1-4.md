# Ticket 032: Add Business Multi-Step Form — Steps 1–4

## Status

Backlog

## Phase

Phase 5: Submit / Claim / Manage Foundation

## Priority

P1

## Feature Area

Core Workflow / Entity Submission

## Context

The Add Business form is the primary path for new Black-owned businesses to join The BLACQList platform. This ticket covers steps 1–4 of the 7-step form: entity type selection, basic information, contact and location, and category + city selection. Steps 5–7 (media, CTA, preview/publish) are covered in Ticket 033. This form is the foundation of the platform's supply side — without it, owners cannot create listings. Source: `docs/blacqlist/ux/mvp-screen-map.md` Add Business screen; `docs/blacqlist/ux/core-user-flows.md` (Add Business flow); `docs/blacqlist/architecture/api-contract.md` Section 4 endpoints 18–19; `docs/blacqlist/data/database-schema-plan.md` listings and listing_details_business tables.

## User Story

As a business owner, I want to complete the first four steps of the Add Business form — selecting my entity type, entering basic info, adding contact details, and choosing my category and city — so that I can establish the foundational record for my BLACQList Page.

## Scope

**In scope:**

- `app/add-business/page.tsx` — Client Component (`"use client"`) managing multi-step state in local component state (`useState`)
- Step progress indicator: "Step N of 7" text counter with visual dots (current step = Amber Gold `#E2A428`, completed = filled, upcoming = empty)
- **Step 1 — Entity Type:** Four option cards in a responsive grid. "Business" is selectable and advances the flow. "Professional", "Creative", "Event/Pop-up", and "Job/Vendor" show "Coming soon" badge (`text-sm bg-amber-100 text-amber-800`) and are visually disabled (reduced opacity, no hover state, `cursor-not-allowed`, `pointer-events-none`). Selecting "Business" updates state and enables the Continue button
- **Step 2 — Basic Info:** Business name field (text input, required, max 100 chars, character counter at 80+), Tagline field (text input, optional, max 80 chars, character counter always shown), Description textarea (required, min 50 chars, max 1000 chars, live character counter)
- **Step 3 — Contact:** Phone (tel input, optional, `inputMode="tel"`), Email (email input, optional, `type="email"`), Website URL (url input, optional, placeholder `https://`). Below those: a toggle `Switch` labeled "This business serves an area rather than a fixed location". When toggle is OFF (default): address_line_1 (required, text), city_name (text, auto-populated from city selection in Step 4 but editable), state (2-letter select), zip (text, `inputMode="numeric"`). When toggle is ON: address fields hidden, show `service_area_description` textarea (text, optional, max 200 chars)
- **Step 4 — Category + City:** Category (required, shadcn/ui `Combobox`-style searchable select, options from `categories` table ordered by name), City (required, searchable select from `cities` table, 13 launch cities). City select must show state abbreviation next to city name (e.g., "Atlanta, GA"). On city selection, auto-populate `city_name` in Step 3 contact fields if not already manually edited
- `react-hook-form` with `zod` resolver for each step's schema; schemas defined in `lib/validations/listing.ts`
- Form values persisted in `localStorage` under key `blacqlist_add_business_draft_[user.id]` — serialized on every field change via `form.watch`
- Draft recovery: on mount, read localStorage key; if data exists, call `form.reset(parsedDraft)` and show a `toast` notification: "Draft restored. Continue where you left off."
- "Back" button: visible from Step 2 onward; decrements step counter; does not clear form data
- "Continue" button: Amber Gold, full-width on mobile, right-aligned on desktop; disabled until current step's required fields are valid (use `formState.isValid` per step schema)
- Route: `/add-business` — protected by middleware redirect to `/sign-in?next=/add-business` if not authenticated
- Page layout: Multi-step form layout — BLACQList wordmark top-left, step progress bar below, form panel centered, Back/Continue fixed at bottom

**Out of scope:**

- Steps 5–7: media upload, CTA selection, preview and publish (Ticket 033)
- Actual submission to the database (handled in Ticket 033 `createListing` SA call)
- Category and city data management (seeded; no admin UI in this ticket)
- Subcategory selection (deferred to V1 per schema plan)
- Address geocoding (deferred to V2)

## Dependencies

| Dependency                                           | Type            | Status                                                                                                           |
| ---------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Ticket 015 (auth middleware and session)             | Blocking ticket | Must be complete — route requires authenticated session                                                          |
| Ticket 031 (duplicate-check API)                     | Blocking ticket | Required by Step 7 — not blocking Steps 1–4 specifically, but must exist before Ticket 033 can complete the flow |
| `categories` table seeded                            | Data            | Required for Step 4 category select options                                                                      |
| `cities` table seeded with 13 launch cities          | Data            | Required for Step 4 city select options                                                                          |
| shadcn/ui `Combobox` or equivalent searchable select | Component       | Must be installed or implemented before Step 4                                                                   |

## UX Notes

- **Screen:** Add Business — `/add-business`
- **Flow reference:** `docs/blacqlist/ux/mvp-screen-map.md` Add Business section; `docs/blacqlist/ux/core-user-flows.md`
- **Entry points:** Homepage "Add Your Business" button → `/add-business`; For Business page → `/add-business`; Dashboard empty state "Create a new page" → `/add-business`; Onboarding Step 2B → `/add-business`
- **Exit points:** Step 7 publish (Ticket 033); "Cancel" link (not in scope here — deferred) routes to `/dashboard`
- **Mobile behavior (375px):**
  - Step progress indicator: "Step N of 7" text (no visual dots — too small); positioned at top of form area below wordmark
  - Step 1 entity type cards: 2-column grid on mobile (2×2 with one spanning), NOT single-column stack
  - All form inputs: single-column, full-width
  - Back/Continue buttons: fixed bottom bar, full-width stacked (Back ghost top, Continue Amber Gold bottom) — minimum 56px tap height
  - Character counters: right-aligned below the field

## Design Notes

- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Components to use:** shadcn/ui `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`, `Input`, `Textarea`, `Switch`, `Select`, `Button`; custom `ComboboxField` for searchable selects (category + city)
- **Layout:** `max-w-xl mx-auto` form panel, `px-4` on mobile; step progress bar full-width constrained to form width
- **Typography:**
  - Step heading: Glacial Indifference Bold, `text-2xl`
  - Step sub-description: Quicksand, `text-base text-[#6B6B6B]`
  - Labels: Quicksand Bold Italic, `text-sm font-bold`
  - Character counter: `text-xs text-[#6B6B6B]` right-aligned
- **Colors:**
  - Active step dot: `bg-[#E2A428]`
  - Completed step dot: `bg-[#000000]`
  - Upcoming step dot: `border border-[#6B6B6B] bg-transparent`
  - Continue button: `bg-[#E2A428] text-[#000000] hover:bg-[#c8911f]`
  - "Coming soon" entity cards: `opacity-50 cursor-not-allowed`
  - Selected entity card: `border-2 border-[#E2A428] bg-[#FCFAF4]`
- **States to implement:** Default, Loading (Continue button spinner on validation), Error (inline field errors), Disabled (Continue while step invalid; "Coming soon" entity types)

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `listings`, `listing_details_business`, `categories`, `cities`
- **Entities involved:** `categories` (read), `cities` (read); `listings` and `listing_details_business` are written in Ticket 033 on final submit
- **Operations:** SELECT categories and cities for dropdown options (server-side fetch on page load, passed as props to Client Component)
- **Validation rules (zod schemas in `lib/validations/listing.ts`):**
  - Step 2: `name` required min 2 max 100; `tagline` optional max 80; `description` required min 50 max 1000
  - Step 3: `phone` optional valid US format if provided; `email` optional valid email format; `website_url` optional must start with `https://` if provided; when location toggle OFF: `address_line_1` required; `state` required 2-letter; `zip` optional 5-digit
  - Step 4: `category_id` required valid UUID from categories; `city_id` required valid UUID from cities
- **RLS policies:** Not applicable at this step — no DB writes occur in steps 1–4
- **Migration required:** No — depends on existing tables

## API Notes

- **No API calls in steps 1–4** — all data is local until Step 7 submit
- Categories and cities are fetched server-side in `app/add-business/page.tsx` (Server Component wrapper that fetches, then passes to Client Component)
- Draft localStorage is client-side only — no API call

## Implementation Notes

**Files to create:**

- `app/add-business/page.tsx` — Server Component wrapper: fetches `categories` and `cities` arrays; passes to `AddBusinessForm` client component; handles `redirect('/sign-in?next=/add-business')` if no session
- `app/add-business/_components/AddBusinessForm.tsx` — Client Component (`"use client"`): manages multi-step state, localStorage draft, step rendering
- `app/add-business/_components/steps/EntityTypeStep.tsx` — Step 1 component
- `app/add-business/_components/steps/BasicInfoStep.tsx` — Step 2 component
- `app/add-business/_components/steps/ContactStep.tsx` — Step 3 component
- `app/add-business/_components/steps/CategoryCityStep.tsx` — Step 4 component
- `app/add-business/_components/StepProgressBar.tsx` — Progress indicator component
- `lib/validations/listing.ts` — zod schemas for each step (also used in Ticket 033 for final submit)

**Files to modify:**

- `app/add-business/layout.tsx` — create minimal layout (wordmark, no full nav, no footer)

**Key patterns:**

- Each step is a separate component that receives `form` (from `useForm`) as a prop — do not pass the entire form to all steps simultaneously; render only the current step's component
- localStorage draft pattern from `docs/blacqlist/architecture/frontend.md`:
  ```tsx
  const DRAFT_KEY = `blacqlist_add_business_draft_${user.id}`
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (saved) {
      form.reset(JSON.parse(saved))
      toast('Draft restored.')
    }
  }, [])
  useEffect(() => {
    const sub = form.watch((v) => localStorage.setItem(DRAFT_KEY, JSON.stringify(v)))
    return () => sub.unsubscribe()
  }, [form.watch])
  ```
- Step validation: use `form.trigger(stepFields)` before advancing to next step; only call `trigger` on the fields belonging to the current step (not all fields)
- City/category data: fetch server-side in the page Server Component, pass as props; do not fetch in the Client Component

**Do not:**

- Use `<select>` native elements for category and city — use the shadcn/ui Combobox pattern with search
- Make any API calls in steps 1–4 — all data stays local until Step 7
- Call `revalidatePath` — no server mutations happen in this ticket
- Allow the "Continue" button to advance if the current step's required fields have errors

## Acceptance Criteria

- [ ] Given an unauthenticated user navigates to `/add-business`, they are redirected to `/sign-in?next=/add-business`
- [ ] Given an authenticated user is on Step 1, only the "Business" entity type card is selectable; the other four show "Coming soon" and are not clickable
- [ ] Given a user is on Step 2, the Continue button is disabled until `name` (min 2 chars) and `description` (min 50 chars) are filled; `tagline` is optional and does not block Continue
- [ ] Given a user types in the description field, a live character counter updates showing `N / 1000` characters
- [ ] Given a user is on Step 3 with the location toggle OFF, the `address_line_1` field is visible and required; toggling ON hides it and shows `service_area_description`
- [ ] Given a user selects a city in Step 4, the city name auto-populates into the `city_name` field in Step 3 (if Step 3 has not been manually edited)
- [ ] Given a user has filled steps 1–4 and navigates away, upon returning the draft is restored from localStorage and a toast confirms restoration
- [ ] Given a user clicks Back from Step 3, they return to Step 2 with all previously entered data intact
- [ ] Given a user enters an invalid email in Step 3 and clicks Continue, an inline error message appears below the email field before advancing
- [ ] On mobile at 375px, Step 1 entity type cards render in a 2-column grid (not a single-column list), and the Back/Continue buttons are fixed at the bottom of the viewport

## Failure States

| Failure                     | Condition                                     | User sees                                                                                 | Recovery                                                         |
| --------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Validation error            | Required field empty on Continue              | Inline error below the field, Continue button remains disabled                            | User fills the field and retries                                 |
| Invalid email format        | Email field contains non-email string         | "Please enter a valid email address" inline below field                                   | User corrects and retries                                        |
| Invalid website URL         | Website field does not start with `https://`  | "Website must start with https://" inline error                                           | User corrects to include `https://`                              |
| Draft parse failure         | localStorage draft is malformed JSON          | `try/catch` around `JSON.parse`; silently skip draft restore; no toast                    | User starts fresh; no data loss since data was not yet submitted |
| Category/city fetch failure | Server-side Supabase query fails on page load | Next.js `error.tsx` boundary: "Something went wrong loading this page." with retry button | User retries page load                                           |

## Edge Cases

- User has localStorage disabled (private browsing mode): `localStorage.setItem` throws; wrap in `try/catch`; proceed without draft persistence; no user-visible error
- User pastes a name with leading/trailing whitespace: trim on save; do not show error for whitespace-only padding
- City auto-populate: if user has manually edited `city_name` in Step 3 before selecting a city in Step 4, do not overwrite the manual entry
- Back navigation from Step 2 to Step 1: the previously selected entity type card must still show as selected
- User selects "Coming soon" entity type via keyboard (Tab + Enter): the disabled card must have `aria-disabled="true"` and `tabIndex={-1}` so it is not reachable via keyboard navigation
- Description reaches 1000 characters: character counter turns red; Continue button remains enabled (user is at max, not over); zod `max(1000)` prevents submission at Step 7

## Accessibility Notes

- [ ] All form inputs have associated `<FormLabel>` elements (not placeholder-only labels)
- [ ] Entity type option cards have `role="radio"` and `aria-checked` reflecting selection state; they are grouped in a `role="radiogroup"` with an accessible name
- [ ] "Coming soon" entity type cards have `aria-disabled="true"` and are excluded from tab order (`tabIndex={-1}`)
- [ ] The step progress bar announces the current step to screen readers: `aria-label="Step 2 of 7"` on the progress indicator container
- [ ] The location type toggle (`Switch`) has a visible label and uses shadcn/ui `Switch` with proper `aria-checked`
- [ ] Validation errors are announced via `role="alert"` on `FormMessage` — use shadcn/ui's built-in `FormMessage` which handles this
- [ ] Back and Continue buttons are `<button type="button">` and `<button type="submit">` respectively — not divs

## QA Test Cases

| ID   | Test                   | Steps                                                                                                                                    | Expected                                                                                       |
| ---- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| QA-1 | Happy path steps 1–4   | Sign in → navigate to `/add-business` → select Business → fill name + description → fill phone → select category + city → click Continue | Each step validates and advances; Step 4 Continue is enabled after selecting category and city |
| QA-2 | Draft recovery         | Fill Steps 1–3 → navigate to `/discover` → return to `/add-business`                                                                     | Toast appears "Draft restored"; form fields are pre-populated with previous entries            |
| QA-3 | Validation blocking    | On Step 2, leave description blank → click Continue                                                                                      | Inline error "Description is required" appears; step does not advance                          |
| QA-4 | Location type toggle   | Step 3 → toggle "Service area" ON                                                                                                        | Address fields disappear; `service_area_description` textarea appears                          |
| QA-5 | Unauthenticated access | Log out → navigate to `/add-business`                                                                                                    | Redirected to `/sign-in?next=/add-business`                                                    |

## Security Notes

- The route must be protected server-side in `page.tsx` — do not rely solely on middleware for auth enforcement; call `supabase.auth.getUser()` in the Server Component and redirect if no session
- No user-submitted data is written to the database in steps 1–4 — all data is in `localStorage` on the client; there is no server-side injection risk at this stage
- The category and city select options are fetched server-side and passed as props; they are not user-controlled — but validate `category_id` and `city_id` as valid UUIDs from the fetched list before passing to the zod schema

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] All four steps render and validate correctly in browser
- [ ] Draft persistence and recovery tested (fill, navigate away, return)
- [ ] Location toggle tested (physical → service area → physical)
- [ ] Mobile tested at 375px — fixed bottom buttons, 2-column entity type grid
- [ ] Keyboard navigation tested — tab through all fields, entity cards not reachable when "Coming soon"
- [ ] Back button tested — returns to previous step with data intact
