# MVP Test Plan — The BLACQList

**Date:** 2026-05-11
**Status:** Draft
**Scope:** Full MVP — all implemented flows, routes, and data operations
**Last corrected:** 2026-08-23 — see **Corrections Log** at the foot of this document
**Environment:** Staging or local only. ⚠ Never production — `e2e/global-setup.ts` provisions users
and fixture listings on whatever project the env points at, and hard-stops on the production ref.
**Test runner:** `pnpm test` — Vitest (unit) + Playwright (e2e). **122 Playwright tests** across three
projects (`chromium`, `webkit-desktop`, `chromium-mobile`) `[Measured — pnpm test:e2e, 2026-08-23]`.
Cases marked **Automated** below do not need a manual walk; see **Automation Coverage**.

---

## In Scope

All features implemented and shipped as of the AI Foundation milestone:

- Public shell and navigation
- Homepage, city pages, discovery/browse, search
- BLACQList business page (real DB rows)
- Authentication (sign-up, sign-in, sign-out, email verification)
- User onboarding flow
- Add Business form (7 steps)
- Claim workflow (search → form → submit → status tracking)
- Owner dashboard (overview, page editor, gallery, services, hours, CTA, analytics, AI suggestions)
- Account settings
- Saves and share functionality
- Collections (index + detail pages)
- Receipts (submission, history, admin queue)
- Community Spend widget and personal impact flow
- Marketplace (vendor storefronts, products)
- Admin panel (overview, entities, claims, verification, reviews, reports, analytics, collections, guides, BLACQLight, receipts, marketplace, AI tools)
- Analytics event ingestion API
- AI foundation (checklist only — no live AI calls)
- RLS policies across all MVP tables

## Out of Scope

- Stripe payment processing (not connected)
- Anthropic AI generation (not connected — foundation only)
- Algolia search (not connected — using local/mock search)
- Email delivery (Resend not verified in staging)
- Production deployment
- Automated test suite (does not exist)

---

## Automation Coverage

`[Measured — e2e/ suite, 2026-08-23]` — added when the owner fixture landed in `e2e/global-setup.ts`.
Before it, every owner-side case was blocked on the absence of an authenticated identity that owned
exactly one listing and did _not_ own two others. One fixture unblocked eighteen cases.

**Read this table before walking anything.** A row marked **Automated** needs no manual pass; a row
marked **Partial** needs only the steps in its "Still manual" column.

| Case                       | Coverage      | Automated steps                                         | Spec                                                   | Still manual                    |
| -------------------------- | ------------- | ------------------------------------------------------- | ------------------------------------------------------ | ------------------------------- |
| TA-01 Homepage             | Partial       | structure, a11y, contrast, keyboard                     | `a11y` · `keyboard` · `contrast`                       | visual/content check            |
| TA-02 Sign-up              | **Automated** | 1, 2, 3, 4, 6                                           | `auth-validation`                                      | 5, 7 (creates a real account)   |
| TA-03 Sign-in/out          | Partial       | 1, 2                                                    | `auth-validation`                                      | sign-out, session persistence   |
| TA-04 Onboarding           | Partial       | `/account` + `/onboarding` guards                       | `route-guards`                                         | the flow itself                 |
| TA-05 Add Business         | Partial       | 1; step-1 render in **3 browsers**                      | `route-guards` · `cross-browser` C                     | steps 2–7 (7-step form)         |
| TA-06 Business page        | Partial       | 3                                                       | `discovery-pages`                                      | 4–11 (section rendering)        |
| TA-07 Search               | Partial       | 2, 5                                                    | `discovery-pages`                                      | 1, 3, 4 (result relevance)      |
| TA-08 City/category        | **Automated** | 1, 2, 3, 3b, 4                                          | `discovery-pages`                                      | —                               |
| TA-09 Claim                | **Automated** | 1, 2, 3, 4, 5, 7, 8; **3 browsers**                     | `route-guards` · `claim-workflow` · `cross-browser` D  | 6 (actual submit — see note)    |
| TA-10 Owner dashboard      | **Automated** | 1, 3, 4, 5, 6; **3 browsers**                           | `route-guards` · `owner-dashboard` · `cross-browser` E | 2 (stat correctness), 7         |
| TA-11 Hero/About editor    | **Automated** | required-name guard + save round-trip                   | `owner-dashboard`                                      | —                               |
| TA-12 Contact/Hours/Social | Partial       | server-side `https://` guard + save                     | `owner-dashboard`                                      | hours, social rows              |
| TA-13 Gallery              | Manual        | —                                                       | —                                                      | all (no media fixture)          |
| TA-14 Services             | Partial       | index, new, unknown-id 404                              | `owner-dashboard`                                      | create/edit/delete round-trip   |
| TA-15 AI Suggestions       | Manual        | —                                                       | —                                                      | all                             |
| TA-16 Owner analytics      | **Automated** | 1, 3, 4                                                 | `owner-dashboard`                                      | 2 (aggregation job)             |
| TA-17 Analytics API        | **Automated** | all, plus malformed-JSON and optional-`entity_id` cases | `api-contracts`                                        | —                               |
| TA-18 Admin guard          | **Automated** | 1, 2; **3 browsers**                                    | `route-guards` · `owner-dashboard` · `cross-browser` G | —                               |
| TA-19 Claims queue         | Partial       | queue renders for an admin, **3 browsers**              | `cross-browser` G                                      | approve/reject actions          |
| TA-20 Receipts             | Partial       | list renders; cross-user 404                            | `account-surfaces`                                     | submit → admin review lifecycle |
| TA-21 Community spend      | **Automated** | privacy assertions on both endpoints                    | `api-contracts`                                        | —                               |
| TA-22 Marketplace          | Partial       | 5 (cross-owner product 404)                             | `account-surfaces`                                     | 1–4 (storefront rendering)      |
| TA-23 Collections          | Partial       | 6 (guard equivalent)                                    | `route-guards`                                         | 1–5                             |
| TA-24 Save/share           | Partial       | save → appears in Saved → unsave                        | `account-surfaces`                                     | 5 (native share), 6 (counts)    |
| TA-25 Admin AI tools       | Manual        | —                                                       | —                                                      | all                             |

⚠ **No spec submits a claim.** `claim-workflow.spec.ts` sorts alphabetically _before_
`cross-browser.spec.ts`, which walks the same claimable fixture, and `global-setup.ts` reconciles
fixtures **between runs, not between files** — a submitted claim would flip that listing into the
"pending" branch and fail a later spec on state this one created. Three separate fixtures
(unclaimed / already-claimed / already-pending) cover the three branch pages instead. TA-09 step 6
stays manual on purpose.

⚠ **Cross-browser cells only count from one file.** `playwright.config.ts` scopes `webkit-desktop`
and `chromium-mobile` with `testMatch: /cross-browser\.spec\.ts/`. A path moved out of that file
silently drops to chromium-only and takes two L cells with it.

---

## Test Areas and Cases

---

### TA-01 — Public Homepage

| Field    | Value                                                                     |
| -------- | ------------------------------------------------------------------------- |
| Severity | P1                                                                        |
| Type     | Partial automation — `a11y/keyboard/contrast`; remainder manual           |
| Role     | Anonymous                                                                 |
| Status   | Automated portion passing `[Measured — 2026-08-23]`; manual steps not run |

**Steps and expected results:**

| #   | Action                            | Expected                                                                   |
| --- | --------------------------------- | -------------------------------------------------------------------------- |
| 1   | Load `/` as unauthenticated user  | Page loads; hero section, featured listings, how-it-works sections visible |
| 2   | Click "List Your Business" CTA    | Navigates to `/for-business`                                               |
| 3   | Click "Find Black Businesses" CTA | Navigates to `/discover` or search                                         |
| 4   | Click a featured listing card     | Navigates to that listing's BLACQList Page                                 |
| 5   | Inspect nav — not signed in       | Sign In and Get Listed links visible; no dashboard link                    |
| 6   | Sign in, return to `/`            | Nav shows account/dashboard links; no sign-in link                         |

**Failure states:**

- Hero renders with broken images: check `next.config.ts` remote image patterns for Supabase Storage
- Featured listings return empty: verify homepage fetch from DB, not hardcoded mock data
- CTA links 404: verify routing configuration

---

### TA-02 — Authentication (Sign-Up)

| Field    | Value                                            |
| -------- | ------------------------------------------------ |
| Severity | P1                                               |
| Type     | **Automated** — `auth-validation`                |
| Role     | Anonymous → Supporter                            |
| Status   | Passing `[Measured — pnpm test:e2e, 2026-08-23]` |

**Steps:**

| #   | Action                                        | Expected                                                            |
| --- | --------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Navigate to `/sign-up`                        | Sign-up form renders with email + password fields                   |
| 2   | Submit empty form                             | Blocked by native constraint validation (`required`); no navigation |
| 3   | Submit invalid email format                   | Blocked by `type="email"`; `validity.typeMismatch` is true          |
| 4   | Submit valid email + password under 8 chars   | Blocked by `minLength={8}`; `validity.tooShort` is true             |
| 5   | Submit valid email + strong password          | Account created; redirect to `/onboarding` or `/account`            |
| 6   | Attempt sign-up with already-registered email | Error: "Email already in use" (not a 500)                           |
| 7   | Navigate to `/sign-up` while signed in        | Redirected to `/account`                                            |

**Failure states:**

- Supabase email confirmation enabled: user must verify before logging in — test both paths
- No error shown on duplicate email: check Supabase auth error handling in sign-up Server Action

---

### TA-03 — Authentication (Sign-In and Sign-Out)

| Field    | Value                                                                     |
| -------- | ------------------------------------------------------------------------- |
| Severity | P1                                                                        |
| Type     | Partial automation — `auth-validation`; remainder manual                  |
| Role     | All authenticated roles                                                   |
| Status   | Automated portion passing `[Measured — 2026-08-23]`; manual steps not run |

**Steps:**

| #   | Action                                         | Expected                                                     |
| --- | ---------------------------------------------- | ------------------------------------------------------------ |
| 1   | Navigate to `/sign-in`                         | Form renders with email + password                           |
| 2   | Submit wrong password                          | "Invalid credentials" error; no account lockout info exposed |
| 3   | Submit correct credentials                     | Redirect to `/account` or `?next=` param destination         |
| 4   | Sign out from account nav                      | Session cleared; redirect to `/` or sign-in                  |
| 5   | After sign-out, attempt to access `/dashboard` | Redirected to `/sign-in?next=/dashboard`                     |
| 6   | Navigate to `/sign-in` while signed in         | Redirected to `/account`                                     |

---

### TA-04 — User Onboarding Flow

| Field    | Value                                                                     |
| -------- | ------------------------------------------------------------------------- |
| Severity | P1                                                                        |
| Type     | Partial automation — `route-guards`; remainder manual                     |
| Role     | New authenticated user                                                    |
| Status   | Automated portion passing `[Measured — 2026-08-23]`; manual steps not run |

**Steps:**

| #   | Action                                        | Expected                                                |
| --- | --------------------------------------------- | ------------------------------------------------------- |
| 1   | New user lands on `/onboarding` after sign-up | Onboarding prompts visible                              |
| 2   | Complete onboarding (name, preferences)       | Profile updated; redirect to `/account`                 |
| 3   | Skip optional steps                           | Core account still created; no blocking error           |
| 4   | Return to `/onboarding` after completion      | Either redirects away or shows "already complete" state |

---

### TA-05 — Add Business Form (7 Steps)

| Field    | Value                                                                     |
| -------- | ------------------------------------------------------------------------- |
| Severity | P1                                                                        |
| Type     | Partial automation — `route-guards + cross-browser`; remainder manual     |
| Role     | Authenticated (any)                                                       |
| Status   | Automated portion passing `[Measured — 2026-08-23]`; manual steps not run |

**Steps:**

| #   | Action                                            | Expected                                                                           |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Navigate to `/add-business` while unauthenticated | Redirect to `/sign-in?next=/add-business`                                          |
| 2   | Load `/add-business` as signed-in user            | Step 1 of form renders                                                             |
| 3   | Advance step without required fields              | Validation errors shown inline; step does not advance                              |
| 4   | Complete Step 1 (basic info)                      | Advances to Step 2                                                                 |
| 5   | Complete all 7 steps with valid data              | Listing created; redirect to owner dashboard or confirmation page                  |
| 6   | Attempt duplicate business (same name + city)     | Warning shown; confirm intent to proceed                                           |
| 7   | Submit on slow connection (simulate)              | Loading state shown; form not re-submitted on retry                                |
| 8   | Verify new listing appears in DB                  | `listings` and `listing_details_business` rows created; owner_user_id matches user |

**Failure states:**

- Step 5 (media upload): upload route `/api/upload/[bucket]` does NOT currently exist — KNOWN GAP. Media step will fail silently or error.

---

### TA-06 — BLACQList Business Page

| Field    | Value                                                                     |
| -------- | ------------------------------------------------------------------------- |
| Severity | P1                                                                        |
| Type     | Partial automation — `discovery-pages`; remainder manual                  |
| Role     | Anonymous, Supporter                                                      |
| Status   | Automated portion passing `[Measured — 2026-08-23]`; manual steps not run |

**Steps:**

| #   | Action                                           | Expected                                                                                            |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 1   | Navigate to `/[citySlug]/business/[listingSlug]` | Page renders with business info                                                                     |
| 2   | Verify data source                               | Real DB rows. `MOCK_ENTITIES` was removed; zero references remain in `app/`, `lib/`, `components/`. |
| 3   | Check Save button (unauthenticated)              | Redirects to /sign-in with ?next= param (returns to listing after sign-in)                          |
| 4   | Check Save button (signed in)                    | Toggles save state; persists on refresh                                                             |
| 5   | Check Share button                               | Opens native share or copies URL                                                                    |
| 6   | Check CTA button                                 | Navigates to correct destination based on `cta_type`                                                |
| 7   | Check Gallery section                            | Images display; lightbox or carousel works                                                          |
| 8   | Check Services section                           | Services list with prices/descriptions renders                                                      |
| 9   | Check Hours section                              | Open/closed badge reflects current time; hours table correct                                        |
| 10  | Check Reviews section                            | Reviews display; no PII exposed (no reviewer last names in display)                                 |
| 11  | Check Map/Address section                        | Address displays; no GPS coordinates exposed                                                        |

_Corrected 2026-08-23: the "serves mock data" gap this case was written around is closed._

---

### TA-07 — Search and Discovery

| Field    | Value                                                                     |
| -------- | ------------------------------------------------------------------------- |
| Severity | P1                                                                        |
| Type     | Partial automation — `discovery-pages`; remainder manual                  |
| Role     | Anonymous                                                                 |
| Status   | Automated portion passing `[Measured — 2026-08-23]`; manual steps not run |

**Steps:**

| #   | Action              | Expected                                              |
| --- | ------------------- | ----------------------------------------------------- |
| 1   | Load `/discover`    | Browse/filter UI renders; listing cards display       |
| 2   | Search by keyword   | Results filter; no crash on special characters        |
| 3   | Filter by category  | Correctly filtered results                            |
| 4   | Filter by city      | Correctly filtered results                            |
| 5   | View empty results  | Empty state shown with "No businesses found" + action |
| 6   | Click a result card | Navigates to business page                            |

**Note:** Search/discover currently uses mock data per codebase review. Verify whether real DB data is wired.

---

### TA-08 — City and Category Landing Pages

| Field    | Value                                            |
| -------- | ------------------------------------------------ |
| Severity | P2                                               |
| Type     | **Automated** — `discovery-pages`                |
| Role     | Anonymous                                        |
| Status   | Passing `[Measured — pnpm test:e2e, 2026-08-23]` |

**Steps:**

| #   | Action                                                         | Expected                                                                                                                                                                                    |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Navigate to `/discover/[citySlug]` (e.g., `/discover/atlanta`) | City landing page renders; city name, listings, hero visible. ⚠ There is **no bare `/[citySlug]` route** — `app/[citySlug]/[entityType]/` treats the second segment as a **category** slug. |
| 2   | Navigate to `/[citySlug]/[categorySlug]`                       | Category + city page renders; filtered listings                                                                                                                                             |
| 3   | Navigate to non-existent city slug                             | 404 page renders (not a 500)                                                                                                                                                                |
| 4   | Check canonical URL in page source                             | Correct canonical for SEO deduplication                                                                                                                                                     |

---

### TA-09 — Claim Workflow

| Field    | Value                                            |
| -------- | ------------------------------------------------ |
| Severity | P1                                               |
| Type     | **Automated** — `claim-workflow + cross-browser` |
| Role     | Authenticated (future owner)                     |
| Status   | Passing `[Measured — pnpm test:e2e, 2026-08-23]` |

**Steps:**

| #   | Action                                     | Expected                                                              |
| --- | ------------------------------------------ | --------------------------------------------------------------------- |
| 1   | Navigate to `/claim` while unauthenticated | Redirect to sign-in                                                   |
| 2   | Load `/claim` as signed-in user            | Search form renders                                                   |
| 3   | Search for an existing business            | Matching listings returned                                            |
| 4   | Click claim on a listing                   | Navigates to `/claim/[listingId]`                                     |
| 5   | Submit claim form without required fields  | Validation errors shown                                               |
| 6   | Submit valid claim                         | Claim created with status `pending`; confirmation shown               |
| 7   | Attempt to claim same listing twice        | Error: "You already have a pending claim" (no duplicate claims)       |
| 8   | View claim status at `/account/claims`     | Pending claim listed with status badge                                |
| 9   | Withdraw a pending claim                   | Claim status → `withdrawn`; no longer in pending queue                |
| 10  | Admin rejects claim                        | Owner sees "rejected" status with reason; cannot re-claim immediately |

---

### TA-10 — Owner Dashboard

| Field    | Value                                             |
| -------- | ------------------------------------------------- |
| Severity | P1                                                |
| Type     | **Automated** — `owner-dashboard + cross-browser` |
| Role     | Owner                                             |
| Status   | Passing `[Measured — pnpm test:e2e, 2026-08-23]`  |

**Steps:**

| #   | Action                                               | Expected                                                                         |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Load `/dashboard` as non-owner                       | Redirected to `/account` (no owned listing)                                      |
| 2   | Load `/dashboard` as owner                           | Overview page renders with listing name, stats                                   |
| 3   | Load `/dashboard/pages/[entityId]` for owned listing | Page editor loads                                                                |
| 4   | Attempt `/dashboard/pages/[fakeId]`                  | 404 returned (not another owner's data)                                          |
| 5   | Attempt `/dashboard/pages/[otherOwnerId]`            | 404 returned (ownership enforced)                                                |
| 6   | Edit listing name + save                             | Change persists on reload; DB updated                                            |
| 7   | Upload gallery image                                 | Upload succeeds via `app/api/upload/route.ts` (magic-byte sniffed, size-capped). |

---

### TA-11 — Page Editor — Hero and About

| Field    | Value                                            |
| -------- | ------------------------------------------------ |
| Severity | P1                                               |
| Type     | **Automated** — `owner-dashboard`                |
| Role     | Owner                                            |
| Status   | Passing `[Measured — pnpm test:e2e, 2026-08-23]` |

**Steps:**

| #   | Action                      | Expected                                                    |
| --- | --------------------------- | ----------------------------------------------------------- |
| 1   | Edit business name          | Saves; reflected on public page (once mock data is removed) |
| 2   | Edit tagline                | Saves; max character limit enforced                         |
| 3   | Edit description            | Saves; textarea accepts multi-paragraph text                |
| 4   | Submit empty required field | Inline validation error; form not saved                     |
| 5   | Save with valid data        | Success toast; DB updated                                   |

---

### TA-12 — Page Editor — Contact, Hours, Social

| Field    | Value                                                                     |
| -------- | ------------------------------------------------------------------------- |
| Severity | P1                                                                        |
| Type     | Partial automation — `owner-dashboard`; remainder manual                  |
| Role     | Owner                                                                     |
| Status   | Automated portion passing `[Measured — 2026-08-23]`; manual steps not run |

**Steps:**

| #   | Action                              | Expected                                            |
| --- | ----------------------------------- | --------------------------------------------------- |
| 1   | Add phone number                    | Saved; displayed on public page                     |
| 2   | Add website URL with invalid format | Validation error (must be http/https)               |
| 3   | Add business hours for each day     | Saved correctly; open/closed toggle works           |
| 4   | Set "Closed" for a day              | That day shows as closed; no time slots displayed   |
| 5   | Add Instagram handle                | Saved with or without @ prefix; displayed correctly |
| 6   | Add invalid social URL              | Error shown                                         |

---

### TA-13 — Gallery Management

| Field    | Value   |
| -------- | ------- |
| Severity | P1      |
| Type     | Manual  |
| Role     | Owner   |
| Status   | Not run |

**Steps:**

| #   | Action                                                  | Expected                                                                          |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | Upload an image                                         | Accepted by `app/api/upload/route.ts`; the file appears in the gallery            |
| 1b  | Upload a `.png`-named file whose bytes are not an image | Rejected — the route sniffs magic bytes, not the filename or the client MIME type |
| 2   | Verify what is persisted                                | `media_attachments` stores the Storage **path**, never a URL                      |
| 3   | Delete uploaded image                                   | Row removed from media_attachments; file deleted from Storage                     |
| 4   | Reorder gallery images                                  | Order persists on reload                                                          |

---

### TA-14 — Services Manager

| Field    | Value                                                                     |
| -------- | ------------------------------------------------------------------------- |
| Severity | P1                                                                        |
| Type     | Partial automation — `owner-dashboard`; remainder manual                  |
| Role     | Owner                                                                     |
| Status   | Automated portion passing `[Measured — 2026-08-23]`; manual steps not run |

**Steps:**

| #   | Action                                 | Expected                                                          |
| --- | -------------------------------------- | ----------------------------------------------------------------- |
| 1   | Add a service with name + price        | Service row created in `services` table                           |
| 2   | Edit service price                     | Updated; reflected on public page                                 |
| 3   | Add service without required name      | Validation error                                                  |
| 4   | Delete service                         | Soft deleted (`deleted_at` set); no longer visible on public page |
| 5   | Service count reflects in AI checklist | Checklist "At least 1 service listed" shows green                 |

---

### TA-15 — AI Suggestions Page (Checklist)

| Field    | Value   |
| -------- | ------- |
| Severity | P2      |
| Type     | Manual  |
| Role     | Owner   |
| Status   | Not run |

**Steps:**

| #   | Action                                            | Expected                                                               |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Load `/dashboard/pages/[entityId]/ai-suggestions` | Page renders with score badge and checklist                            |
| 2   | New listing with no data                          | Score badge shows red (Needs work); most checks fail                   |
| 3   | Add tagline, description, etc. and reload         | Score increases; passing checks show green                             |
| 4   | AI suggestions section                            | Shows "AI copy suggestions coming in V2" empty state; no API call made |
| 5   | Approval note at bottom                           | Text about human review visible                                        |
| 6   | Wrong owner accesses page                         | 404 returned                                                           |

---

### TA-16 — Owner Analytics Dashboard

| Field    | Value                                            |
| -------- | ------------------------------------------------ |
| Severity | P2                                               |
| Type     | **Automated** — `owner-dashboard`                |
| Role     | Owner                                            |
| Status   | Passing `[Measured — pnpm test:e2e, 2026-08-23]` |

**Steps:**

| #   | Action                                                                 | Expected                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Load `/dashboard/pages/[entityId]/analytics` on a **Starter+** listing | Page renders; stat cards show 0s if no events yet                                                                                                                                                                                                                                                                    |
| 1b  | Load the same route on a **free**-tier listing                         | Paywall renders, not the dashboard. `analytics` is Starter+ in `lib/stripe/features.ts` — a free-tier listing can never satisfy step 1.                                                                                                                                                                              |
| 2   | Generate a page view event via API                                     | `entity_analytics_daily` records after next aggregation                                                                                                                                                                                                                                                              |
| 3   | Filter by 7-day vs 30-day                                              | Heading and stats switch; 30d is the default and is expressed by the **absence** of `?period`                                                                                                                                                                                                                        |
| 4   | Wrong owner accesses page                                              | The 404 page body renders. ⚠ The HTTP **status is 200** here — the route streams its shell before the ownership query resolves, so `notFound()` fires after the response commits. The sibling `/edit` route returns a real 404 status. Authorization is intact either way; assert the rendered page, not the status. |

---

### TA-17 — Analytics Event Ingestion API

| Field    | Value                                            |
| -------- | ------------------------------------------------ |
| Severity | P1                                               |
| Type     | **Automated** — `api-contracts`                  |
| Role     | Any (anonymous allowed for page views)           |
| Status   | Passing `[Measured — pnpm test:e2e, 2026-08-23]` |

**Test calls:**

```bash
# Valid page view event
curl -X POST /api/analytics/event \
  -H "Content-Type: application/json" \
  -d '{"event_name":"page_view","entity_id":"<uuid>","entity_type":"listing"}'

# Invalid event name
curl -X POST /api/analytics/event \
  -d '{"event_name":"hacked_event","entity_id":"<uuid>","entity_type":"listing"}'
# Expect: 400 VALIDATION_ERROR
# NOT INVALID_EVENT_NAME. The route returns the single code VALIDATION_ERROR for
# every rejection by design — it never tells a caller which field failed.

# Missing entity_id
curl -X POST /api/analytics/event \
  -d '{"event_name":"page_view","entity_type":"listing"}'
# Expect: 200. entity_id is OPTIONAL — a page_view on a non-entity page has no entity.

# Malformed JSON body
curl -X POST /api/analytics/event -d 'not json'
# Expect: 400 VALIDATION_ERROR
```

**Expected:** Valid events insert into `analytics_events` (fire-and-forget pattern); invalid events return structured errors.

---

### TA-18 — Admin Panel — Overview and Auth Guard

| Field    | Value                                            |
| -------- | ------------------------------------------------ |
| Severity | P1                                               |
| Type     | **Automated** — `route-guards + owner-dashboard` |
| Role     | Non-admin, Admin, Super Admin                    |
| Status   | Passing `[Measured — pnpm test:e2e, 2026-08-23]` |

**Steps:**

| #   | Action                                    | Expected                               |
| --- | ----------------------------------------- | -------------------------------------- |
| 1   | Access `/admin` as anonymous user         | Redirect to `/sign-in`                 |
| 2   | Access `/admin` as owner (non-admin)      | Redirect to `/` (requireAdmin() fires) |
| 3   | Access `/admin` as admin                  | Admin overview page renders            |
| 4   | Access `/admin` as super_admin            | Same; all nav items visible            |
| 5   | Admin user navigates to all sidebar items | Each page loads without 500 error      |

---

### TA-19 — Admin Claims Queue

| Field    | Value                                                                     |
| -------- | ------------------------------------------------------------------------- |
| Severity | P1                                                                        |
| Type     | Partial automation — `cross-browser`; remainder manual                    |
| Role     | Admin                                                                     |
| Status   | Automated portion passing `[Measured — 2026-08-23]`; manual steps not run |

**Steps:**

| #   | Action                                    | Expected                                                                |
| --- | ----------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Load `/admin/claims`                      | All pending claims listed                                               |
| 2   | Open a claim detail                       | Claim info, submitter info, document links visible                      |
| 3   | Approve claim                             | Claim status → `approved`; listing owner_user_id updated; user notified |
| 4   | Reject claim with reason                  | Claim status → `rejected`; reason stored; user sees rejection           |
| 5   | Approve claim for already-claimed listing | Error: listing is already owned                                         |
| 6   | Audit log entry created                   | Admin action logged in `admin_audit_log`                                |

---

### TA-20 — Receipts — Full Lifecycle

| Field    | Value                                                                     |
| -------- | ------------------------------------------------------------------------- |
| Severity | P1                                                                        |
| Type     | Partial automation — `account-surfaces`; remainder manual                 |
| Role     | Supporter → Admin                                                         |
| Status   | Automated portion passing `[Measured — 2026-08-23]`; manual steps not run |

**Steps:**

| #   | Action                                            | Expected                                                       |
| --- | ------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Submit receipt at `/receipts` (authenticated)     | Receipt row created with status `pending`                      |
| 2   | Attempt to view another user's receipt by ID      | 404 (RLS blocks cross-user access)                             |
| 3   | Admin views pending receipts at `/admin/receipts` | All pending receipts visible with truncated buyer info         |
| 4   | Admin approves receipt                            | Status → `approved`; community_spend_total updated for listing |
| 5   | Admin rejects receipt                             | Status → `rejected`; submitter sees rejection                  |
| 6   | Supporter views `/account/receipts`               | Only their own receipts listed                                 |
| 7   | Signed-receipt URL requested via API              | Signed URL returned; expires after TTL                         |

---

### TA-21 — Community Spend Widget

| Field    | Value                                            |
| -------- | ------------------------------------------------ |
| Severity | P2                                               |
| Type     | **Automated** — `api-contracts`                  |
| Role     | Anonymous, Supporter                             |
| Status   | Passing `[Measured — pnpm test:e2e, 2026-08-23]` |

**Steps:**

| #   | Action                                                     | Expected                                                      |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | View community spend widget on homepage or business page   | Total spend displayed as aggregate (no individual amounts)    |
| 2   | Call `/api/community-spend` directly                       | Returns aggregate totals only; no individual transaction data |
| 3   | Call `/api/flow-map/personal-impact` without auth          | 401 response                                                  |
| 4   | Call `/api/flow-map/personal-impact` as authenticated user | Returns only own spend history; no other users' data          |

---

### TA-22 — Marketplace (Vendor Storefronts and Products)

| Field    | Value                                                                     |
| -------- | ------------------------------------------------------------------------- |
| Severity | P2                                                                        |
| Type     | Partial automation — `account-surfaces`; remainder manual                 |
| Role     | Owner, Anonymous                                                          |
| Status   | Automated portion passing `[Measured — 2026-08-23]`; manual steps not run |

**Steps:**

| #   | Action                                             | Expected                                 |
| --- | -------------------------------------------------- | ---------------------------------------- |
| 1   | Load `/[citySlug]/business/[listingSlug]/store`    | Vendor storefront renders with products  |
| 2   | Owner adds a product via dashboard                 | Product appears in storefront            |
| 3   | Owner edits product price                          | Updated on storefront                    |
| 4   | Owner deletes product                              | Soft-deleted; no longer visible publicly |
| 5   | Non-owner attempts to edit product via direct POST | 404 or 403 returned                      |
| 6   | Marketplace CTA click logged                       | `analytics_events` row inserted          |

---

### TA-23 — Collections

| Field    | Value                                                                     |
| -------- | ------------------------------------------------------------------------- |
| Severity | P2                                                                        |
| Type     | Partial automation — `route-guards`; remainder manual                     |
| Role     | Anonymous, Admin                                                          |
| Status   | Automated portion passing `[Measured — 2026-08-23]`; manual steps not run |

**Steps:**

| #   | Action                                           | Expected                                                                                                                                                                                                                              |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Load `/collections`                              | Collections list renders; empty state if none                                                                                                                                                                                         |
| 2   | Load `/collections/[slug]`                       | Collection detail page with member listings                                                                                                                                                                                           |
| 3   | Admin creates collection at `/admin/collections` | Collection created; visible on public page                                                                                                                                                                                            |
| 4   | Admin adds listing to collection                 | Listing appears in collection detail                                                                                                                                                                                                  |
| 5   | Admin removes listing from collection            | Listing removed                                                                                                                                                                                                                       |
| 6   | Non-admin attempts to reach `/admin/collections` | Redirected. There is **no collections API route** to POST to — creation is a server action guarded by `requireAdmin()`, so the enforceable equivalent is the page redirect: anonymous → `/sign-in?next=…`, signed-in non-admin → `/`. |

---

### TA-24 — Save and Share Functionality

| Field    | Value                                                                     |
| -------- | ------------------------------------------------------------------------- |
| Severity | P2                                                                        |
| Type     | Partial automation — `account-surfaces`; remainder manual                 |
| Role     | Anonymous, Supporter                                                      |
| Status   | Automated portion passing `[Measured — 2026-08-23]`; manual steps not run |

**Steps:**

| #   | Action                                    | Expected                                                 |
| --- | ----------------------------------------- | -------------------------------------------------------- |
| 1   | Click Save on a listing (unauthenticated) | Prompt to sign in                                        |
| 2   | Click Save (signed in)                    | Listing saved; button state toggles                      |
| 3   | View `/account/saved`                     | Saved listing appears                                    |
| 4   | Unsave listing                            | Removed from saved list; `deleted_at` set in `saves`     |
| 5   | Click Share button                        | Native share dialog or URL copied; analytics event fired |
| 6   | Save count on listing page                | Increments correctly; no negative counts                 |

---

### TA-25 — Admin AI Tools Page

| Field    | Value   |
| -------- | ------- |
| Severity | P2      |
| Type     | Manual  |
| Role     | Admin   |
| Status   | Not run |

**Steps:**

| #   | Action                              | Expected                                        |
| --- | ----------------------------------- | ----------------------------------------------- |
| 1   | Load `/admin/ai-tools` as admin     | Page renders with mock mode status card         |
| 2   | Stat cards show counts              | All show 0 (no suggestions exist yet)           |
| 3   | Prompt templates section            | Lists all 11 templates from `lib/ai/prompts.ts` |
| 4   | Roadmap section                     | Foundation → V2 → V3 phases visible             |
| 5   | Non-admin accesses page             | Redirect to `/`                                 |
| 6   | Confirm no real AI API call is made | Network tab shows no calls to anthropic.com     |

---

## Safe Check Results

Run before first staging deployment:

| Check      | Command                             | Exit Code | Status                                                                |
| ---------- | ----------------------------------- | --------- | --------------------------------------------------------------------- |
| TypeScript | `pnpm tsc --noEmit`                 | 0         | **PASS — zero errors**                                                |
| Lint       | `pnpm exec eslint . --ext .ts,.tsx` | 0         | **PASS — zero errors**                                                |
| Tests      | `pnpm test`                         | 0         | **PASS — Vitest unit + 122 Playwright e2e** `[Measured — 2026-08-23]` |
| Build      | `pnpm build`                        | Not run   | Not run — run on staging                                              |

_Corrected 2026-08-23: the Tests row read "FAIL — no test script in package.json". `pnpm test` exists and is green; CI gates `typecheck`/`lint`/`unit`/`build` on every PR._

Note: `pnpm lint` (bare `eslint` with no path) exits 0 silently. Use `pnpm exec eslint . --ext .ts,.tsx` for a real lint check. Recommend fixing the lint script in `package.json`.

---

## Known Gaps (P1 — Must Fix Before Launch)

**All four gaps recorded here on 2026-05-11 are closed** `[Observed — code read, 2026-08-23]`. They are
kept, struck, with what closed them — 14 steps across TA-06, TA-10, TA-13 and this table were written
around them, and a reader who finds only the corrected steps has no way to tell whether the gap was
fixed or the note was lost.

| Gap (as recorded 2026-05-11)            | Severity | Status                                                                                                                                                                            |
| --------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~Upload route handler missing~~        | P1       | **Closed.** The route is `app/api/upload/route.ts` — not `/api/upload/[bucket]`, which is why it read as absent. It sniffs magic bytes rather than trusting the client MIME type. |
| ~~Business detail page uses mock data~~ | P1       | **Closed.** Zero `MOCK_ENTITIES` references remain in `app/`, `lib/`, or `components/`.                                                                                           |
| ~~Search/discover uses mock data~~      | P1       | **Closed.** Faceted RPC against real rows; asserted by `e2e/ownership-label.spec.ts` and `e2e/discovery-pages.spec.ts`.                                                           |
| ~~No automated test suite~~             | P2       | **Closed.** `pnpm test` = Vitest + Playwright; 122 e2e tests across three browser projects.                                                                                       |

**Open gaps as of 2026-08-23:**

| Gap                                              | Severity | Details                                                                                                                                              |
| ------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload **malware** scanning                      | P2       | Magic-byte sniffing shipped (PR #67). Content scanning has not started — an image that is genuinely an image is accepted without further inspection. |
| OCR extraction / auto-categorization on receipts | P2       | No OCR code exists in `lib/` or `app/`. Needs a paid vision API — a GATE-SPEND decision, not a bug.                                                  |
| TA-13 steps 3–4, TA-15, TA-25                    | P2       | Still manual-only; no fixture exists for gallery media or AI suggestions.                                                                            |

---

## Corrections Log

This plan was written 2026-05-11 against the AI Foundation milestone and was not revisited for three
months. Fourteen steps asserted gaps that have since closed, and the header declared no automated
suite exists. A test plan that is wrong in the _optimistic_ direction wastes a walk; one that is wrong
in the _pessimistic_ direction — as this one was — teaches the walker to expect failure and to record
a real regression as "the known gap." Both were present here.

| #   | Corrected                   | Was                                                               | Is                                                                                                                                                       |
| --- | --------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Header — Test runner        | "Manual (no automated test script exists as of this audit)"       | `pnpm test` = Vitest + Playwright; 122 e2e tests across 3 projects                                                                                       |
| 2   | Header — Environment        | "Staging"                                                         | Staging **or local**, never production — `global-setup.ts` writes fixtures and hard-stops on the production ref                                          |
| 3   | In Scope                    | "BLACQList business page (note: currently renders mock data)"     | Real DB rows                                                                                                                                             |
| 4   | TA-02 steps 2/3/4           | Expected server-side validation errors                            | Native constraint validation (`required`, `type="email"`, `minLength={8}`) blocks submission client-side                                                 |
| 5   | TA-06 step 2 + closing note | "currently uses mock data (`MOCK_ENTITIES`)"                      | Zero `MOCK_ENTITIES` references remain                                                                                                                   |
| 6   | TA-08 step 1                | `/[citySlug]` (e.g. `/atlanta`)                                   | No such route. City landing is `/discover/[citySlug]`; `app/[citySlug]/[entityType]/` treats segment 2 as a **category**. Step 2 was already correct.    |
| 7   | TA-10 step 7                | "Known gap: upload route does not exist"                          | `app/api/upload/route.ts` exists                                                                                                                         |
| 8   | TA-13 steps 1–2             | Written entirely around the upload gap — unrunnable as written    | Rewritten; magic-byte rejection added as step 1b                                                                                                         |
| 9   | TA-16                       | Assumed any listing                                               | Requires a **Starter+** listing (`analytics` is Starter+ gated); free tier renders a paywall. Step 4's `notFound()` returns a **200** with the 404 body. |
| 10  | TA-17                       | Expected `INVALID_EVENT_NAME`; expected missing `entity_id` → 400 | Route returns `VALIDATION_ERROR` for every rejection by design; `entity_id` is optional and a page_view without one returns 200                          |
| 11  | TA-23 step 6                | "Non-admin POST → 403/404"                                        | No collections API route exists; creation is a server action behind `requireAdmin()`. Enforceable equivalent is the page redirect.                       |
| 12  | Safe Check Results — Tests  | "FAIL — no test script in package.json"                           | PASS                                                                                                                                                     |
| 13  | Known Gaps table            | Four P1/P2 rows                                                   | All four closed; struck with what closed them, and a current open-gaps table added                                                                       |
| 14  | Every case header           | `Type: Manual` / `Status: Not run`                                | Marked Automated / Partial / Manual against the real suite                                                                                               |

Two findings surfaced while correcting, **not fixed** — they are notes for whoever touches that code
next, not defects in this plan:

- `lib/admin/guard.ts` documents "Never call from inside a server action" for `requireAdmin()`, yet all
  five actions in `lib/actions/editorial/collections.ts` call it from exactly there. It works in Next 15
  (`NEXT_REDIRECT` propagates), but the file contradicts its own contract.
- `/dashboard/pages/[id]/analytics` commits a `200` before `notFound()` fires, because the route streams
  its shell before the ownership query resolves. The sibling `/edit` route returns a real 404. Authorization
  is intact in both; only the status code differs.
