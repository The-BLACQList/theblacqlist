# QA Sign-Off Report — The BLACQList

**Ticket:** 089  
**Status:** Prerequisites cleared (2026-06-28) — **ready to execute the TA-01–25 pass on production via `?preview=<token>`**  
**Environment:** Production `theblacqlist.com` behind the coming-soon gate — reach pages with `?preview=<COMING_SOON_BYPASS_TOKEN>` (the gate allowlists `/api/*` + `/auth/*`).  
**Prerequisite:** Seed data applied — prod has **254 listings (ATL 151 / HOU 51 / CHI 52)**, M9 met.

---

## Prerequisites Checklist

- [x] Ticket 086 (security audit) — RLS re-verified on prod 2026-06-28 (Query 1: 0 RLS-off tables; all 9 high-risk tables policied; anon + uid-isolation spot-checks pass). Evidence: `docs/blacqlist/qa/prod-qa-closeout.md` §4 + `security-audit-report.md`.
- [x] Ticket 087 (accessibility audit) — quick-fixes P1 cleared (097 save announcement + 098 contrast); commit `b2b9305`. Auth-page CLS fix `939c95f`.
- [x] Ticket 088 (performance) — prod Lighthouse run 2026-06-28: Perf 90–100, CLS 0, TBT low on all 5 pages (sign-up CLS 0.764→0 fixed). Evidence: `prod-qa-closeout.md` §5.
- [x] Production environment: all migrations applied (093) + seed loaded (254 listings)
- [ ] Test accounts provisioned (see below)

---

## 🤖 Automated + programmatic verification (2026-06-28) — DONE

Run on **production** by Claude; these need no manual pass:
- **Smoke (pages serve):** home / discover / search / listing / sign-in / sign-up → 200; unknown route → 404. ✅
- **Auth gates:** anon → `/dashboard`, `/account`, `/admin`, `/account/settings` all **307 → /sign-in** (next-path preserved). ✅
- **086 RLS** (re-verified on prod): 0 RLS-off tables; anon can't read drafts; user-data isolation holds. ✅ (`prod-qa-closeout.md` §4)
- **Unit tests** (`vitest run`): **6/6 pass** (incl. the PII scrubber / K6). ✅
- **K5/M10 Sentry** prod-error captured (server+edge+browser); **K7** uptime monitors live; **health** endpoints 200. ✅
- **088 Lighthouse:** Perf 90–100, CLS 0, TBT low on all 5 pages. **087 a11y:** 097/098 fixes shipped. ✅

**Remaining = the 5 critical paths (human pass)** → founder runs the simplified `docs/blacqlist/qa/founder-qa-checklist.md`; results transcribe into Critical Path 1–5 below → Go/No-Go.

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
| Unauthenticated blocked from `/dashboard` | Navigate to `/dashboard` without session | Redirect to `/sign-in?next=/dashboard` | ✅ **PASS** (🤖 2026-06-28: anon → 307 → `/sign-in?next=/dashboard`; same for `/account`, `/admin`, `/account/settings`) |
| Non-admin blocked from `/admin` | Sign in as Supporter; navigate to `/admin` | Redirect to `/` | Anon→sign-in verified ✅; signed-in-Supporter case = manual (journey ⑤) |
| IDOR check | Owner A: GET `/api/dashboard/analytics?listing_id=[Owner B id]` | 403 | Covered by 086 RLS (uid isolation verified) ✅; manual API spot-check optional |
| Sign-in redirect away | Sign in; navigate to `/sign-in` | Redirect to `/account/saved` | Manual (needs session) |

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
