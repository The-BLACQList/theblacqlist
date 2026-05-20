# MVP Test Plan — The BLACQList

**Date:** 2026-05-11
**Status:** Draft
**Scope:** Full MVP — all implemented flows, routes, and data operations
**Environment:** Staging (no production data modified)
**Test runner:** Manual (no automated test script exists as of this audit)

---

## In Scope

All features implemented and shipped as of the AI Foundation milestone:

- Public shell and navigation
- Homepage, city pages, discovery/browse, search
- BLACQList business page (note: currently renders mock data)
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

## Test Areas and Cases

---

### TA-01 — Public Homepage

| Field    | Value     |
| -------- | --------- |
| Severity | P1        |
| Type     | Manual    |
| Role     | Anonymous |
| Status   | Not run   |

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

| Field    | Value                 |
| -------- | --------------------- |
| Severity | P1                    |
| Type     | Manual                |
| Role     | Anonymous → Supporter |
| Status   | Not run               |

**Steps:**

| #   | Action                                        | Expected                                                 |
| --- | --------------------------------------------- | -------------------------------------------------------- |
| 1   | Navigate to `/sign-up`                        | Sign-up form renders with email + password fields        |
| 2   | Submit empty form                             | Inline validation errors on both fields                  |
| 3   | Submit invalid email format                   | Email field shows format error                           |
| 4   | Submit valid email + weak password            | Password strength error shown                            |
| 5   | Submit valid email + strong password          | Account created; redirect to `/onboarding` or `/account` |
| 6   | Attempt sign-up with already-registered email | Error: "Email already in use" (not a 500)                |
| 7   | Navigate to `/sign-up` while signed in        | Redirected to `/account`                                 |

**Failure states:**

- Supabase email confirmation enabled: user must verify before logging in — test both paths
- No error shown on duplicate email: check Supabase auth error handling in sign-up Server Action

---

### TA-03 — Authentication (Sign-In and Sign-Out)

| Field    | Value                   |
| -------- | ----------------------- |
| Severity | P1                      |
| Type     | Manual                  |
| Role     | All authenticated roles |
| Status   | Not run                 |

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

| Field    | Value                  |
| -------- | ---------------------- |
| Severity | P1                     |
| Type     | Manual                 |
| Role     | New authenticated user |
| Status   | Not run                |

**Steps:**

| #   | Action                                        | Expected                                                |
| --- | --------------------------------------------- | ------------------------------------------------------- |
| 1   | New user lands on `/onboarding` after sign-up | Onboarding prompts visible                              |
| 2   | Complete onboarding (name, preferences)       | Profile updated; redirect to `/account`                 |
| 3   | Skip optional steps                           | Core account still created; no blocking error           |
| 4   | Return to `/onboarding` after completion      | Either redirects away or shows "already complete" state |

---

### TA-05 — Add Business Form (7 Steps)

| Field    | Value               |
| -------- | ------------------- |
| Severity | P1                  |
| Type     | Manual              |
| Role     | Authenticated (any) |
| Status   | Not run             |

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

| Field    | Value                |
| -------- | -------------------- |
| Severity | P1                   |
| Type     | Manual               |
| Role     | Anonymous, Supporter |
| Status   | Not run              |

**Steps:**

| #   | Action                                           | Expected                                                                                                             |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Navigate to `/[citySlug]/business/[listingSlug]` | Page renders with business info                                                                                      |
| 2   | Verify data source                               | **Note: currently uses mock data (`MOCK_ENTITIES`), not real DB.** Page shows mock content regardless of URL params. |
| 3   | Check Save button (unauthenticated)              | Prompts sign-in or shows disabled state                                                                              |
| 4   | Check Save button (signed in)                    | Toggles save state; persists on refresh                                                                              |
| 5   | Check Share button                               | Opens native share or copies URL                                                                                     |
| 6   | Check CTA button                                 | Navigates to correct destination based on `cta_type`                                                                 |
| 7   | Check Gallery section                            | Images display; lightbox or carousel works                                                                           |
| 8   | Check Services section                           | Services list with prices/descriptions renders                                                                       |
| 9   | Check Hours section                              | Open/closed badge reflects current time; hours table correct                                                         |
| 10  | Check Reviews section                            | Reviews display; no PII exposed (no reviewer last names in display)                                                  |
| 11  | Check Map/Address section                        | Address displays; no GPS coordinates exposed                                                                         |

**Critical gap: Real listing pages serve mock data — not real DB rows. This is a P1 gap before launch.**

---

### TA-07 — Search and Discovery

| Field    | Value     |
| -------- | --------- |
| Severity | P1        |
| Type     | Manual    |
| Role     | Anonymous |
| Status   | Not run   |

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

| Field    | Value     |
| -------- | --------- |
| Severity | P2        |
| Type     | Manual    |
| Role     | Anonymous |
| Status   | Not run   |

**Steps:**

| #   | Action                                       | Expected                                                     |
| --- | -------------------------------------------- | ------------------------------------------------------------ |
| 1   | Navigate to `/[citySlug]` (e.g., `/atlanta`) | City landing page renders; city name, listings, hero visible |
| 2   | Navigate to `/[citySlug]/[categorySlug]`     | Category + city page renders; filtered listings              |
| 3   | Navigate to non-existent city slug           | 404 page renders (not a 500)                                 |
| 4   | Check canonical URL in page source           | Correct canonical for SEO deduplication                      |

---

### TA-09 — Claim Workflow

| Field    | Value                        |
| -------- | ---------------------------- |
| Severity | P1                           |
| Type     | Manual                       |
| Role     | Authenticated (future owner) |
| Status   | Not run                      |

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

| Field    | Value   |
| -------- | ------- |
| Severity | P1      |
| Type     | Manual  |
| Role     | Owner   |
| Status   | Not run |

**Steps:**

| #   | Action                                               | Expected                                                         |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Load `/dashboard` as non-owner                       | Redirected to `/account` (no owned listing)                      |
| 2   | Load `/dashboard` as owner                           | Overview page renders with listing name, stats                   |
| 3   | Load `/dashboard/pages/[entityId]` for owned listing | Page editor loads                                                |
| 4   | Attempt `/dashboard/pages/[fakeId]`                  | 404 returned (not another owner's data)                          |
| 5   | Attempt `/dashboard/pages/[otherOwnerId]`            | 404 returned (ownership enforced)                                |
| 6   | Edit listing name + save                             | Change persists on reload; DB updated                            |
| 7   | Upload gallery image                                 | **Known gap: upload route does not exist.** Document as failure. |

---

### TA-11 — Page Editor — Hero and About

| Field    | Value   |
| -------- | ------- |
| Severity | P1      |
| Type     | Manual  |
| Role     | Owner   |
| Status   | Not run |

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

| Field    | Value   |
| -------- | ------- |
| Severity | P1      |
| Type     | Manual  |
| Role     | Owner   |
| Status   | Not run |

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

| #   | Action                                                                    | Expected                                                                               |
| --- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | Attempt to upload an image                                                | **Known gap: upload route (`/api/upload/[bucket]`) does NOT exist.** Upload will fail. |
| 2   | If upload somehow completes: verify Supabase Storage path stored, not URL | media_attachments row stores path only                                                 |
| 3   | Delete uploaded image                                                     | Row removed from media_attachments; file deleted from Storage                          |
| 4   | Reorder gallery images                                                    | Order persists on reload                                                               |

---

### TA-14 — Services Manager

| Field    | Value   |
| -------- | ------- |
| Severity | P1      |
| Type     | Manual  |
| Role     | Owner   |
| Status   | Not run |

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

| Field    | Value   |
| -------- | ------- |
| Severity | P2      |
| Type     | Manual  |
| Role     | Owner   |
| Status   | Not run |

**Steps:**

| #   | Action                                       | Expected                                                |
| --- | -------------------------------------------- | ------------------------------------------------------- |
| 1   | Load `/dashboard/pages/[entityId]/analytics` | Page renders; stat cards show 0s if no events yet       |
| 2   | Generate a page view event via API           | `entity_analytics_daily` records after next aggregation |
| 3   | Filter by 7-day vs 30-day                    | Stats update for each range                             |
| 4   | Wrong owner accesses page                    | 404                                                     |

---

### TA-17 — Analytics Event Ingestion API

| Field    | Value                                  |
| -------- | -------------------------------------- |
| Severity | P1                                     |
| Type     | Manual (curl)                          |
| Role     | Any (anonymous allowed for page views) |
| Status   | Not run                                |

**Test calls:**

```bash
# Valid page view event
curl -X POST /api/analytics/event \
  -H "Content-Type: application/json" \
  -d '{"event_name":"page_view","entity_id":"<uuid>","entity_type":"listing"}'

# Invalid event name
curl -X POST /api/analytics/event \
  -d '{"event_name":"hacked_event","entity_id":"<uuid>","entity_type":"listing"}'
# Expect: 400 INVALID_EVENT_NAME

# Missing entity_id
curl -X POST /api/analytics/event \
  -d '{"event_name":"page_view","entity_type":"listing"}'
# Expect: 400 VALIDATION_ERROR
```

**Expected:** Valid events insert into `analytics_events` (fire-and-forget pattern); invalid events return structured errors.

---

### TA-18 — Admin Panel — Overview and Auth Guard

| Field    | Value                         |
| -------- | ----------------------------- |
| Severity | P1                            |
| Type     | Manual                        |
| Role     | Non-admin, Admin, Super Admin |
| Status   | Not run                       |

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

| Field    | Value   |
| -------- | ------- |
| Severity | P1      |
| Type     | Manual  |
| Role     | Admin   |
| Status   | Not run |

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

| Field    | Value             |
| -------- | ----------------- |
| Severity | P1                |
| Type     | Manual            |
| Role     | Supporter → Admin |
| Status   | Not run           |

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

| Field    | Value                |
| -------- | -------------------- |
| Severity | P2                   |
| Type     | Manual               |
| Role     | Anonymous, Supporter |
| Status   | Not run              |

**Steps:**

| #   | Action                                                     | Expected                                                      |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | View community spend widget on homepage or business page   | Total spend displayed as aggregate (no individual amounts)    |
| 2   | Call `/api/community-spend` directly                       | Returns aggregate totals only; no individual transaction data |
| 3   | Call `/api/flow-map/personal-impact` without auth          | 401 response                                                  |
| 4   | Call `/api/flow-map/personal-impact` as authenticated user | Returns only own spend history; no other users' data          |

---

### TA-22 — Marketplace (Vendor Storefronts and Products)

| Field    | Value            |
| -------- | ---------------- |
| Severity | P2               |
| Type     | Manual           |
| Role     | Owner, Anonymous |
| Status   | Not run          |

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

| Field    | Value            |
| -------- | ---------------- |
| Severity | P2               |
| Type     | Manual           |
| Role     | Anonymous, Admin |
| Status   | Not run          |

**Steps:**

| #   | Action                                           | Expected                                      |
| --- | ------------------------------------------------ | --------------------------------------------- |
| 1   | Load `/collections`                              | Collections list renders; empty state if none |
| 2   | Load `/collections/[slug]`                       | Collection detail page with member listings   |
| 3   | Admin creates collection at `/admin/collections` | Collection created; visible on public page    |
| 4   | Admin adds listing to collection                 | Listing appears in collection detail          |
| 5   | Admin removes listing from collection            | Listing removed                               |
| 6   | Non-admin attempts collection creation via POST  | 403/404                                       |

---

### TA-24 — Save and Share Functionality

| Field    | Value                |
| -------- | -------------------- |
| Severity | P2                   |
| Type     | Manual               |
| Role     | Anonymous, Supporter |
| Status   | Not run              |

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

| Check      | Command                             | Exit Code | Status                                    |
| ---------- | ----------------------------------- | --------- | ----------------------------------------- |
| TypeScript | `pnpm tsc --noEmit`                 | 0         | **PASS — zero errors**                    |
| Lint       | `pnpm exec eslint . --ext .ts,.tsx` | 0         | **PASS — zero errors**                    |
| Tests      | `pnpm test`                         | 1         | **FAIL — no test script in package.json** |
| Build      | `pnpm build`                        | Not run   | Not run — run on staging                  |

Note: `pnpm lint` (bare `eslint` with no path) exits 0 silently. Use `pnpm exec eslint . --ext .ts,.tsx` for a real lint check. Recommend fixing the lint script in `package.json`.

---

## Known Gaps (P1 — Must Fix Before Launch)

| Gap                                 | Severity | Details                                                                             |
| ----------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| Upload route handler missing        | P1       | `app/api/upload/[bucket]/route.ts` does not exist; all media upload flows will fail |
| Business detail page uses mock data | P1       | `/[citySlug]/business/[listingSlug]` renders `MOCK_ENTITIES`, not real DB rows      |
| Search/discover uses mock data      | P1       | Results not real DB queries                                                         |
| No automated test suite             | P2       | No `pnpm test` script; all QA is manual                                             |
