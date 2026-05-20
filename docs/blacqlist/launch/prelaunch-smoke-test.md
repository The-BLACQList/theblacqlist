# Pre-Launch Smoke Test — The BLACQList

**Date:** 2026-05-11
**Status:** Execute after every production deployment
**Total time:** ~20 minutes to complete all tests
**Reference tests:** Based on deployment-plan.md Section 9 and production-readiness-plan.md

Run these tests immediately after every production deployment. If any P0 test fails, initiate rollback before investigating. If any P1 test fails, assess severity before deciding on rollback vs hotfix.

---

## Prerequisites

Before starting:
- [ ] Have two test accounts available with known credentials:
  - **Test Supporter** — a non-owner, non-admin regular account
  - **Test Admin** — an account with `role = 'admin'` in `user_roles`
- [ ] At least one published listing exists in the production database
- [ ] Browser developer console is open to monitor for JavaScript errors during each test
- [ ] Testing from a desktop browser and a mobile browser (375px width minimum)

---

## Test Block 1 — Public Pages (Unauthenticated)

### ST-01 — Homepage Load

**Severity if fails:** P0

**Steps:**
1. Navigate to `https://theblacqlist.com` while signed out
2. Observe page load and visual rendering

**Pass criteria:**
- [ ] Page loads within 3 seconds
- [ ] BLACQList header and navigation are visible
- [ ] Hero section renders with headline and search bar
- [ ] Footer is visible
- [ ] No JavaScript errors in the browser console
- [ ] Page source (`Cmd+U` / `Ctrl+U`) contains the page title — content is server-rendered, not a loading spinner

**Fail action:** P0 — initiate rollback if page does not load or is completely blank.

---

### ST-02 — Discover Page

**Severity if fails:** P1

**Steps:**
1. Navigate to `https://theblacqlist.com/discover`

**Pass criteria:**
- [ ] Page loads with listing cards visible
- [ ] Sidebar filters are visible on desktop
- [ ] At least one listing card renders with business name, category, and city
- [ ] Listing data is real (not mock content — names should be real businesses, not "Mock Business 1")
- [ ] No console errors

---

### ST-03 — Search Results

**Severity if fails:** P1

**Steps:**
1. Navigate to `https://theblacqlist.com/search?q=restaurant`
2. Observe results
3. Then search with an empty query: `https://theblacqlist.com/search`

**Pass criteria:**
- [ ] `?q=restaurant` returns at least one result (if restaurant-category listings exist in seed data)
- [ ] Empty search shows the "What are you looking for?" empty state — not an error or blank screen
- [ ] Listing cards show real business data
- [ ] No console errors

---

### ST-04 — Business Detail Page (Entity Page)

**Severity if fails:** P0

**Steps:**
1. From the Discover page, click any listing card to open its entity page
2. Observe the full page render
3. Right-click → View Page Source

**Pass criteria:**
- [ ] Page loads at the URL pattern `https://theblacqlist.com/[city-slug]/business/[listing-slug]`
- [ ] Business name appears in the `<title>` tag in page source (server-rendered, not blank)
- [ ] Hero section visible: business name, category, city label
- [ ] At least one section renders below the hero (At a Glance, Story, Offerings, etc.)
- [ ] CTA button is visible
- [ ] No console errors or hydration warnings

**Fail action:** P0 — if page shows mock data ("Peach & Rye Kitchen" or another hardcoded name regardless of the URL), the DB connection is not working. Check Supabase connection and environment variables.

---

### ST-05 — 404 Page

**Severity if fails:** P2

**Steps:**
1. Navigate to `https://theblacqlist.com/this-page-does-not-exist-xyz-abc`

**Pass criteria:**
- [ ] A branded 404 page renders (not the Vercel default error page)
- [ ] The BLACQList header and footer are present
- [ ] A human-readable message is shown
- [ ] A link back to the homepage or search is present

---

## Test Block 2 — Authentication

### ST-06 — Sign Up Flow

**Severity if fails:** P0

**Steps:**
1. Navigate to `https://theblacqlist.com/sign-up` while signed out
2. Complete registration with a new test email (use a `+alias`: `you+smoke1@gmail.com`)
3. Check the inbox for the verification email

**Pass criteria:**
- [ ] Registration form submits without error
- [ ] Verification email arrives within 2 minutes (check spam if not in inbox)
- [ ] Clicking the verification link completes successfully
- [ ] After verification, user is redirected to `/onboarding` or `/dashboard`
- [ ] No "auth_callback_failed" error in the URL after verification

---

### ST-07 — Sign In Flow

**Severity if fails:** P0

**Steps:**
1. Navigate to `https://theblacqlist.com/sign-in`
2. Sign in with the pre-existing Test Supporter account credentials

**Pass criteria:**
- [ ] Sign in succeeds without error
- [ ] User is redirected to `/dashboard`
- [ ] User name or avatar is visible in the navigation header
- [ ] No redirect loop (the page settles at `/dashboard`, not bouncing between `/sign-in` and `/dashboard`)

---

### ST-08 — Auth Gate on Protected Routes

**Severity if fails:** P0

**Steps:**
1. Sign out completely
2. Attempt to navigate directly to `https://theblacqlist.com/dashboard`
3. Attempt to navigate directly to `https://theblacqlist.com/admin`

**Pass criteria:**
- [ ] `/dashboard` redirects to `/sign-in` (not showing an empty dashboard or an error)
- [ ] `/admin` redirects to `/sign-in` or returns a 403 (not showing the admin panel)
- [ ] After redirect, the sign-in page loads normally

---

## Test Block 3 — Business Submission and Claim

### ST-09 — Add Business Form

**Severity if fails:** P1

**Steps:**
1. Sign in as Test Supporter
2. Navigate to `https://theblacqlist.com/add-business`
3. Complete the first two steps of the form

**Pass criteria:**
- [ ] Add-business form loads and is functional
- [ ] Step 1 fields accept input without error
- [ ] Navigation between steps works (Next / Back)
- [ ] No console errors during form interaction

**Note:** Do not complete and submit a live listing during smoke tests — this creates real data in production. Test only that the form loads and basic interaction works.

---

### ST-10 — Claim Flow

**Severity if fails:** P1

**Steps:**
1. Sign in as Test Supporter
2. Navigate to `https://theblacqlist.com/claim`
3. Search for an existing listing

**Pass criteria:**
- [ ] Claim search form loads
- [ ] Searching returns real listing results (not mock data)
- [ ] Clicking a listing opens the claim detail page
- [ ] The claim form is visible and submittable

**Note:** Do not submit a live claim during production smoke tests unless a specific test listing is designated for this purpose.

---

## Test Block 4 — Owner Dashboard

### ST-11 — Dashboard Access

**Severity if fails:** P1

**Steps:**
1. Sign in as Test Supporter (or an account that owns a listing)
2. Navigate to `https://theblacqlist.com/dashboard`

**Pass criteria:**
- [ ] Dashboard loads without error
- [ ] Navigation sidebar is visible
- [ ] Dashboard shows the owner's listing(s) or an empty state if no listings are owned
- [ ] No console errors

---

## Test Block 5 — Admin Panel

### ST-12 — Admin Login and Dashboard

**Severity if fails:** P0

**Steps:**
1. Sign in as Test Admin
2. Navigate to `https://theblacqlist.com/admin`

**Pass criteria:**
- [ ] Admin dashboard loads
- [ ] Admin navigation sidebar is visible
- [ ] All main admin sections are accessible: Entities, Claims, Verification, Reviews, Receipts, Analytics

---

### ST-13 — Admin Claims Queue

**Severity if fails:** P1

**Steps:**
1. Signed in as Test Admin
2. Navigate to `https://theblacqlist.com/admin/claims`

**Pass criteria:**
- [ ] Claims queue page loads
- [ ] Page shows either pending claims or a clean empty state (no error or blank screen)
- [ ] Approve and Reject action buttons are present on any pending claim rows

---

### ST-14 — Admin Role Enforcement

**Severity if fails:** P0

**Steps:**
1. Sign out
2. Sign in as Test Supporter (non-admin account)
3. Navigate directly to `https://theblacqlist.com/admin`

**Pass criteria:**
- [ ] Non-admin user is redirected to sign-in or receives a 403 Forbidden
- [ ] Admin panel content is not visible to the non-admin user

---

## Test Block 6 — Privacy and Data Boundaries

### ST-15 — Receipt Upload Privacy

**Severity if fails:** P0

**Steps:**
1. Sign in as User A (Test Supporter)
2. Navigate to `https://theblacqlist.com/account/receipts`
3. Note the receipts visible (if any)
4. Sign in as User B (a different test account)
5. Attempt to access User A's receipts

**Pass criteria:**
- [ ] User B cannot see User A's receipts in the receipts UI
- [ ] Directly accessing a receipt signed URL from User A's session in a User B session returns an error or access denied

---

### ST-16 — Flow Map Anonymization

**Severity if fails:** P1

**Steps:**
1. Navigate to `https://theblacqlist.com/flow-map` while signed out
2. Observe the data displayed

**Pass criteria:**
- [ ] Flow map page loads and shows community spend data (if any)
- [ ] No individual user names, emails, or user IDs are visible
- [ ] Data is presented as aggregated totals (e.g., "Community has spent $X at Black-owned businesses")
- [ ] No personal transaction details are visible to anonymous visitors

---

## Test Block 7 — Media and Upload

### ST-17 — Listing Image Display

**Severity if fails:** P2

**Steps:**
1. Navigate to any listing entity page that has a cover image or logo

**Pass criteria:**
- [ ] Images load from the Supabase CDN URL (`*.supabase.co/storage/...`)
- [ ] Images are not broken (no image placeholder icons)
- [ ] `next/image` optimization is in use (images have `src` pointing to `/_next/image?url=...`)

---

### ST-18 — Upload Route Reachable

**Severity if fails:** P1

**Steps:**
1. Sign in as Test Supporter
2. Navigate to `https://theblacqlist.com/add-business` and reach the media upload step
3. Attempt to upload a valid JPEG image file (< 5 MB)

**Pass criteria:**
- [ ] Upload request reaches `POST /api/upload/listing-media` without 404
- [ ] File is accepted (MIME type = `image/jpeg`)
- [ ] No 404 "Route not found" error for the upload endpoint

---

## Test Block 8 — Console and Network Health

### ST-19 — No Critical Console Errors

**Severity if fails:** P1 (depending on error type)

**Steps:**
1. Open browser DevTools → Console
2. Navigate through: homepage → discover → entity page → sign-in → dashboard

**Pass criteria:**
- [ ] No `TypeError` or uncaught errors in the console on any page
- [ ] No hydration mismatch warnings (indicates server/client HTML divergence)
- [ ] No `401 Unauthorized` or `403 Forbidden` API responses from pages that should not require auth
- [ ] No `500 Internal Server Error` responses in the Network tab

---

## Smoke Test Results Log

Fill in after each test run:

| Test | Date | Tester | Pass / Fail | Notes |
|---|---|---|---|---|
| ST-01 Homepage | | | | |
| ST-02 Discover | | | | |
| ST-03 Search | | | | |
| ST-04 Entity page | | | | |
| ST-05 404 page | | | | |
| ST-06 Sign up | | | | |
| ST-07 Sign in | | | | |
| ST-08 Auth gate | | | | |
| ST-09 Add business | | | | |
| ST-10 Claim flow | | | | |
| ST-11 Dashboard | | | | |
| ST-12 Admin dashboard | | | | |
| ST-13 Claims queue | | | | |
| ST-14 Admin enforcement | | | | |
| ST-15 Receipt privacy | | | | |
| ST-16 Flow map anonymization | | | | |
| ST-17 Image display | | | | |
| ST-18 Upload route | | | | |
| ST-19 Console errors | | | | |

---

## Failure Triage

| Failing test | Severity | Action |
|---|---|---|
| ST-01 (homepage blank/down) | P0 | Initiate rollback immediately |
| ST-04 (entity page shows mock data) | P0 | Check Supabase env vars; initiate rollback if not fixable in 10 min |
| ST-07 (sign-in broken) | P0 | Check auth callback URL config; initiate rollback |
| ST-08 (auth gate bypassed) | P0 | Initiate rollback immediately |
| ST-12 (admin panel inaccessible to admin) | P0 | Verify admin user role; fix manually if possible |
| ST-14 (admin accessible to non-admin) | P0 | Initiate rollback immediately — security breach |
| ST-15 (receipt data cross-user visible) | P0 | Initiate rollback immediately — privacy breach |
| ST-02, ST-03 (discover/search fail) | P1 | Hotfix vs rollback decision; no rollback if workaround exists |
| ST-06 (sign up email not delivered) | P1 | Check Resend dashboard; verify SPF/DKIM; hotfix RESEND_API_KEY if wrong |
| ST-17, ST-18 (media issues) | P2 | Log as known issue; no rollback |
| ST-05 (Vercel 404 page shows) | P2 | Add `not-found.tsx`; no rollback |
| ST-19 (console errors) | P1-P2 | Assess error type; non-critical errors do not block |
