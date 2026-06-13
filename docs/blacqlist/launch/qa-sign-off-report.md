# QA Sign-Off Report — The BLACQList

**Ticket:** 089  
**Status:** Pending — execute after 086, 087, 088 complete  
**Environment:** Staging Vercel URL (not localhost)  
**Prerequisite:** Seed data applied (150+ Atlanta, 50+ Houston, 50+ Chicago listings)

---

## Prerequisites Checklist

- [ ] Ticket 086 (security audit) — all Critical and High findings resolved
- [ ] Ticket 087 (accessibility audit) — all Critical findings resolved
- [ ] Ticket 088 (performance) — Lighthouse scores documented, all `<img>` converted
- [ ] Staging environment: all migrations applied
- [ ] Staging environment: seed data loaded
- [ ] Test accounts provisioned (see below)

---

## Test Accounts (staging)

| Role | Email | Password |
|---|---|---|
| Supporter | `supporter@test.blacqlist.dev` | `TestPassword123!` |
| Owner (claimed listing) | `owner@test.blacqlist.dev` | `TestPassword123!` |
| Admin | `admin@test.blacqlist.dev` | `TestPassword123!` |
| Super Admin | `superadmin@test.blacqlist.dev` | `TestPassword123!` |
| Unauthenticated | — (no account) | — |

---

## Cross-Browser Matrix

All critical paths must pass in all three environments:

- [ ] Chrome desktop (macOS)
- [ ] Safari desktop (macOS)
- [ ] Chrome mobile 375px (DevTools device emulation or physical device)

---

## Critical Path 1 — Discovery Flow

**Goal:** Anonymous user discovers a listing via search, views the page, attempts to save.

| Step | Action | Expected | Chrome | Safari | Mobile | Notes |
|---|---|---|---|---|---|---|
| 1 | Navigate to homepage | Homepage loads with hero and search | | | | |
| 2 | Search "restaurant" with city "Atlanta" | Search results page loads | | | | |
| 3 | Click first listing card | BLACQList Page loads | | | | |
| 4 | View source / check `<title>` | Contains business name, not empty | | | | |
| 5 | Click Save (not logged in) | Redirects to /sign-in with ?next= param | | | | |
| 6 | After sign-in, confirm redirect | Returns to the listing page | | | | |

**Roles tested:** Unauthenticated, Supporter (save actually saves), Owner

**Critical Path 1 Result:** PENDING

---

## Critical Path 2 — Add Business Flow

**Goal:** A supporter completes all 7 steps and submits a listing for review.

| Step | Action | Expected | Chrome | Safari | Mobile | Notes |
|---|---|---|---|---|---|---|
| 1 | Navigate to `/add-business` | Step 1 loads | | | | |
| 2 | Complete Step 1 (Business details) | Step 2 unlocked | | | | |
| 3 | Complete Steps 2–4 | Form state preserved across steps | | | | |
| 4 | Complete Step 5 (Media upload) | Images upload successfully | | | | |
| 5 | Complete Step 6 (CTA) | CTA selection saved | | | | |
| 6 | Step 7 — click Submit | Duplicate check runs | | | | |
| 7 | Confirm submission | Redirect to `/add-business/submitted` | | | | |
| 8 | Check admin queue | Listing appears as `status=pending` | | | | |

**Roles tested:** Supporter, Owner (re-submit a new listing)

**Critical Path 2 Result:** PENDING

---

## Critical Path 3 — Claim Flow

**Goal:** A supporter claims an existing published listing.

| Step | Action | Expected | Chrome | Safari | Mobile | Notes |
|---|---|---|---|---|---|---|
| 1 | Find a published listing page | "Claim this business" link visible | | | | |
| 2 | Click claim link | `/claim` entry page loads | | | | |
| 3 | Enter listing URL or search | Listing identified | | | | |
| 4 | Complete claim form | All fields accept input | | | | |
| 5 | Attach verification doc | Document uploaded | | | | |
| 6 | Submit claim | Success state shown | | | | |
| 7 | Check admin queue | Claim appears in `/admin/claims` | | | | |

**Roles tested:** Supporter (unauthenticated shows sign-in gate)

**Critical Path 3 Result:** PENDING

---

## Critical Path 4 — Owner Dashboard

**Goal:** An owner edits their listing, publishes/unpublishes, and views analytics.

| Step | Action | Expected | Chrome | Safari | Mobile | Notes |
|---|---|---|---|---|---|---|
| 1 | Sign in as Owner | Dashboard home loads | | | | |
| 2 | Navigate to page editor | Edit page loads with listing data | | | | |
| 3 | Update business name | Save works; success feedback shown | | | | |
| 4 | Publish listing (if draft+claimed) | Status changes to published | | | | |
| 5 | Unpublish listing | Status changes to draft | | | | |
| 6 | Navigate to analytics | Analytics page loads | | | | |
| 7 | Toggle 7d/30d period | Charts update | | | | |

**Roles tested:** Owner

**Critical Path 4 Result:** PENDING

---

## Critical Path 5 — Admin Workflows

**Goal:** Admin processes a claim, manages a listing, and views analytics.

| Step | Action | Expected | Chrome | Safari | Mobile | Notes |
|---|---|---|---|---|---|---|
| 1 | Sign in as Admin | Admin layout loads | | | | |
| 2 | Navigate to `/admin/claims` | Claims queue loads | | | | |
| 3 | Open a pending claim | Claim detail loads | | | | |
| 4 | Approve the claim | Listing trust_tier → claimed; owner notified | | | | |
| 5 | Navigate to `/admin/listings` | Listings table loads | | | | |
| 6 | Search/filter listings | Results filter correctly | | | | |
| 7 | Navigate to `/admin/analytics` | Platform analytics loads | | | | |
| 8 | Click Search Analytics link | `/admin/analytics/search` loads | | | | |
| 9 | Toggle period filter | Tables re-render | | | | |
| 10 | Download CSV | CSV file downloads with headers | | | | |

**Roles tested:** Admin, Super Admin

**Critical Path 5 Result:** PENDING

---

## Security Boundary Tests (quick-check during QA)

| Test | Steps | Expected | Result |
|---|---|---|---|
| Non-admin blocked from `/admin` | Sign in as Supporter; navigate to `/admin` | Redirect to `/` | Pending |
| Unauthenticated blocked from `/dashboard` | Navigate to `/dashboard` without session | Redirect to `/sign-in?next=/dashboard` | Pending |
| IDOR check | Owner A: GET `/api/dashboard/analytics?listing_id=[Owner B id]` | 403 | Pending |
| Sign-in redirect away | Sign in; navigate to `/sign-in` | Redirect to `/account/saved` | Pending |

---

## Bug Log

*Populate during test execution. P0/P1 bugs require a hotfix ticket.*

| ID | Critical Path | Browser | Severity | Description | Reproduction | Status |
|---|---|---|---|---|---|---|
| — | — | — | — | No bugs logged yet | — | — |

**Severity guide:**
- **P0**: critical path broken; auth bypass; data loss
- **P1**: feature incomplete; accessibility blocker; workaround exists
- **P2**: UI inconsistency; minor edge case
- **P3**: nice-to-have

---

## Go/No-Go Recommendation

**PENDING** — Execute all 5 critical paths and update this document.

**Go criteria:**
- All 5 critical paths pass in Chrome desktop, Safari desktop, and Chrome mobile 375px
- No open P0 bugs
- All P1 bugs documented with tech lead sign-off
- Security boundary tests all pass
