# Remaining Tests Runbook — Step-by-Step

**Last updated:** 2026-06-13
**Audience:** QA tester / launch owner running the final pre-launch gate
**Scope:** Every test still marked **Not Run** in series I, K, L, and M.

This document gives exact steps and a pass/fail checklist for each remaining test. Tests are grouped by where they run:

- **Localhost-runnable now:** I1, I3, I4 (Lighthouse), L4–L12 (cross-browser)
- **Need production deploy first:** K4 only — K5, K7, and M10 confirmed complete `[Observed — founder confirmation, 2026-08-15]`
- **Launch-owner sign-off (state/config checks):** M3, M4, M5, M6, M7, M9

> **Test accounts** (local + staging):
> | Role | Email | Password |
> |---|---|---|
> | Supporter | `supporter@test.blacqlist.dev` | `TestPassword123!` |
> | Owner | `owner@test.blacqlist.dev` | `TestPassword123!` |
> | Owner B | `owner2@test.blacqlist.dev` | `TestPassword123!` |
> | Admin | `admin@test.blacqlist.dev` | `TestPassword123!` |
> | Super Admin | `superadmin@test.blacqlist.dev` | `TestPassword123!` |

---

## I1, I3, I4 — Lighthouse Performance

### Critical setup (read first — applies to all three)

Lighthouse must be run **two ways** and you record both:

1. **Localhost dev** — diagnostic only. Dev server ships unminified JS and the Next devtools bundle; LCP will be inflated. A localhost fail is NOT a launch blocker by itself.
2. **Vercel preview/production** — the **authoritative** result. Compiled build + CDN + cloud Supabase + ISR warm cache. This is what the launch gate is graded on.

**Always run in an Incognito window** (`Cmd+Shift+N`) with **all extensions disabled** — a browser extension previously injected 458 KiB of JS and corrupted these scores.

### How to run one Lighthouse pass

1. Open the target URL in a **new Incognito Chrome window**
2. For an ISR page, **load it once and reload** so the cache is warm before measuring
3. Open DevTools (`F12` / `Cmd+Option+I`)
4. Click the **Lighthouse** tab (use `»` overflow if hidden)
5. Settings: **Mode = Navigation**, **Device = Mobile**, **Categories = Performance** only
6. Click **Analyze page load**, wait ~30–60s
7. Record: **Performance score**, **LCP**, **CLS**, **INP/TBT**
8. Confirm the warning banner about extensions is **absent** (if present, you forgot incognito/disable)

### Targets

| Metric | Target |
|---|---|
| Performance score | ≥ 80 (mobile) |
| LCP | < 2.5s |
| CLS | < 0.1 |
| INP | < 200ms (TBT < 200ms as proxy in lab) |

### URLs per test

| Test | Page | Localhost URL | Production URL |
|---|---|---|---|
| I1 | BLACQList listing page | `http://localhost:3000/atlanta-ga/business/busy-bee-cafe` | `https://theblacqlist.com/atlanta-ga/business/[slug-with-cover]` |
| I3 | Search results | `http://localhost:3000/discover?city=atlanta-ga&q=restaurant` | `https://theblacqlist.com/discover?city=atlanta-ga&q=restaurant` |
| I4 | City landing | `http://localhost:3000/atlanta-ga` | `https://theblacqlist.com/atlanta-ga` |

> **For I1 specifically:** test a listing that HAS a cover image on production. The cover `<Image priority>` is the LCP element and loads fast; a listing with no cover (like Busy Bee Cafe locally) makes hero text the LCP element and inflates the number. The first search-result card and listing cover now carry `priority` (fixed this session).

### Checklist — I1

- [ ] Ran on production/preview URL with a cover-image listing, incognito, warm cache
- [ ] Performance score ≥ 80
- [ ] LCP < 2.5s
- [ ] CLS < 0.1
- [ ] INP/TBT < 200ms
- [ ] No extension warning banner in report
- [ ] Screenshot saved to `docs/blacqlist/launch/lighthouse-scores.md`

### Checklist — I3

- [ ] Search returns results (not the empty state — search bug is fixed)
- [ ] Ran on production/preview URL, incognito, warm cache
- [ ] Performance score ≥ 80
- [ ] LCP < 2.5s · CLS < 0.1 · INP/TBT < 200ms
- [ ] Screenshot saved

### Checklist — I4

- [ ] Ran on production/preview URL, incognito, warm cache
- [ ] Performance score ≥ 80
- [ ] LCP < 2.5s · CLS < 0.1 · INP/TBT < 200ms
- [ ] Screenshot saved

---

## L4–L12 — Cross-Browser Critical Paths

Each L-test runs one critical path in one browser. **Pass = the path completes end to end with no browser-specific functional break, no layout break, and no red console errors.** Open DevTools → Console in each browser and watch for errors as you go.

### Browser setup

| Browser | How to launch the "mobile 375px" variant |
|---|---|
| Chrome desktop (macOS) | Normal window, ≥1280px wide |
| Safari desktop (macOS) | Normal window, ≥1280px wide. Enable **Develop menu** → Safari → Settings → Advanced → "Show features for web developers" for the console |
| Chrome mobile 375px | Chrome → DevTools → **Toggle device toolbar** (`Cmd+Shift+M`) → select **iPhone SE** or set width to **375** |

> Run these on the **staging Vercel URL** if available (closest to production). Localhost is acceptable as a fallback for functional/layout checks.

---

### Critical Path C — Add Business (L4 Chrome, L5 Safari, L6 mobile 375px)

**Sign in as** `supporter@test.blacqlist.dev` first. Then walk all 7 steps:

1. Go to `/add-business`
2. **Eligibility gate (step 0):** the "Who can list" screen appears → click **"My business meets these criteria — Continue"**
3. **Step 1 — Basics:** enter a unique business name (e.g. `XBrowser Test Co [browser]`), select entity type **Restaurant**, continue
4. **Step 2 — Location:** select a location type, fill city/address, continue
5. **Step 3 — Contact:** phone, email, website, continue
6. **Step 4 — Category & description:** pick a category, write a description, continue
7. **Step 5 — Media:** upload a small (<2MB) logo image → thumbnail preview renders; continue (gallery optional)
8. **Step 6 — CTA:** pick a CTA card (e.g. Visit) → contextual input appears; continue
9. **Step 7 — Preview & publish:** preview banner shows; **check the ownership attestation checkbox** → "Submit for review" enables → click it
10. Lands on `/add-business/submitted` confirmation

**Watch for per-browser issues:** Safari date/file inputs, mobile keyboard covering the submit button, image preview not rendering, sticky bottom CTA overlapping content at 375px.

#### Checklist — C path (repeat for L4 / L5 / L6)

- [ ] Eligibility gate renders and gates the form
- [ ] All 7 steps advance without error
- [ ] Logo upload preview renders
- [ ] Attestation checkbox gates the Submit button (disabled until checked)
- [ ] Submit succeeds → confirmation screen
- [ ] No layout overflow (especially at 375px)
- [ ] No red console errors throughout
- [ ] **L4 Chrome desktop:** ☐  **L5 Safari desktop:** ☐  **L6 Chrome mobile 375px:** ☐

---

### Critical Path D — Claim Flow (L7 Chrome, L8 Safari, L9 mobile 375px)

**Sign in as** `supporter@test.blacqlist.dev`. You need an unclaimed published listing ID to claim (any seeded listing the supporter doesn't already own).

1. Navigate to `/claim/[listing-id]` (e.g. an Atlanta seeded listing)
2. Claim form loads with the business name pre-filled / shown
3. Fill required fields (your role at the business, notes)
4. **Upload a verification document** — attach a small PDF or image (<10MB) → filename + size shown, no error
5. Submit the claim → success state
6. (Optional verify) Sign in as `admin@test.blacqlist.dev` → `/admin/claims` → the new claim appears in the queue

**Watch for per-browser issues:** Safari PDF upload MIME handling, mobile file picker, document preview, success state layout at 375px.

#### Checklist — D path (repeat for L7 / L8 / L9)

- [ ] Claim form loads with business context
- [ ] Document upload succeeds (filename + size shown)
- [ ] Claim submits → success state
- [ ] Claim appears in `/admin/claims` queue
- [ ] No layout overflow at 375px
- [ ] No red console errors
- [ ] **L7 Chrome desktop:** ☐  **L8 Safari desktop:** ☐  **L9 Chrome mobile 375px:** ☐

---

### Critical Path E — Owner Dashboard (L10 Chrome, L11 Safari, L12 mobile 375px)

**Sign in as** `owner@test.blacqlist.dev` (owns listing `b0b0b0b0-0000-0000-0000-000000000001`).

1. Go to `/dashboard` → listing card visible
2. Open the listing → `/dashboard/pages/[id]/edit` → all sections pre-populated
3. **Edit basic info:** change the tagline → Save → success feedback, no full page reload
4. **Publish/unpublish:** in the Publish section, toggle status (Unpublish if published, then Publish) → status badge updates
5. **Analytics:** open `/dashboard/pages/[id]/analytics` → stat cards + charts render (listing is tier `standard`, so analytics is unlocked)
6. Toggle **7 days / 30 days** → charts update

**Watch for per-browser issues:** Safari form autofill, chart/SVG rendering differences, mobile table/card reflow at 375px, sticky save button.

#### Checklist — E path (repeat for L10 / L11 / L12)

- [ ] Dashboard home shows the listing card
- [ ] Edit page pre-populates all fields
- [ ] Save persists and shows success without full reload
- [ ] Publish/unpublish toggles status correctly
- [ ] Analytics page renders charts; 7d/30d toggle works
- [ ] No layout overflow at 375px
- [ ] No red console errors
- [ ] **L10 Chrome desktop:** ☐  **L11 Safari desktop:** ☐  **L12 Chrome mobile 375px:** ☐

---

## K4, K5, K7, M10 — Production & External Monitoring

**These require the app deployed to production (Vercel) with Sentry, Vercel Analytics, and uptime monitors configured.** They cannot be run on localhost. Do them immediately after the first production deploy.

### K4 — Vercel Analytics receiving events

**Prerequisite:** `<Analytics />` from `@vercel/analytics/react` is in `app/layout.tsx`, and Web Analytics is enabled in the Vercel project (Settings → Analytics).

1. Open the production site `https://theblacqlist.com` in a normal browser
2. Navigate to **at least 3 different pages** (home → a city → a listing)
3. Wait up to 30 minutes
4. Vercel dashboard → project → **Analytics** tab → confirm page-view events appear

#### Checklist — K4
- [ ] `<Analytics />` present in `app/layout.tsx`
- [ ] Web Analytics enabled in Vercel project settings
- [ ] 3+ page views recorded in the Analytics dashboard within 30 min

---

### K5 — Sentry captures a production error

**Prerequisite:** `NEXT_PUBLIC_SENTRY_DSN` set in Vercel production env; Sentry config files present (`sentry.client/server/edge.config.ts`).

1. Deploy a temporary throwaway test route that throws, OR trigger a known error path on production (e.g. hit an endpoint with a malformed payload that bubbles an unhandled error)
2. In the **Sentry dashboard** → Issues, confirm the error appears
3. Confirm the event's **`environment` tag = `production`**
4. **Remove the throwaway test route** after confirming

#### Checklist — K5 ✅ _(all confirmed `[Observed — founder confirmation, 2026-08-15]` — the checks were performed at initial production setup)_
- [x] Test error triggered on production
- [x] Error appears in Sentry Issues
- [x] Event tagged `environment: production`
- [x] Source maps uploaded (stack trace is readable, not minified)
- [x] Throwaway test route removed — **N/A by design**: the trigger route (`app/api/debug/sentry`) is not a throwaway. It is permanently token-guarded and returns 404 without the token `[Measured — curl prod, 2026-08-15]`; it is kept deliberately as the standing K5 re-test mechanism.

---

### K7 — Uptime monitors green

**Prerequisite:** 3 monitors set up on Better Uptime / Checkly / similar (per `production-setup-checklist.md`):
- `https://theblacqlist.com` (homepage)
- `https://theblacqlist.com/api/health` (checks body contains `"status":"ok"`)
- `https://theblacqlist.com/search` (or `/discover`)

1. Open the uptime provider dashboard
2. Confirm all 3 monitors show **green / Up**
3. Confirm alert destinations (email/Slack) are configured and you received the test alert when first wired

#### Checklist — K7 ✅ _(all confirmed `[Observed — founder confirmation, 2026-08-15]` — set up at initial production setup)_
- [x] 3 monitors created and enabled
- [x] All 3 green
- [x] Alert channel configured and test alert received

---

### M10 — Sentry receiving production errors (launch gate)

This is the launch-gate confirmation of **K5**. It's satisfied the same way: a confirmed test error landed in Sentry with `environment: production`.

#### Checklist — M10 ✅ _(confirmed `[Observed — founder confirmation, 2026-08-15]`)_
- [x] K5 completed and evidence (Sentry issue link/screenshot) saved — K5 confirmed complete; **the evidence artifact (issue link/screenshot) has not yet been pasted into the docs** and is tracked as an open founder residual
- [x] Alert rule fires (≥5 occurrences in 5 min → email/Slack) — alert rule exists, confirmed by founder

---

## M3–M9 — Launch-Owner Sign-Off Gates

These are state/configuration confirmations, not browser tests. Each needs **evidence** (screenshot, SQL output, or doc link) attached before public launch.

### M3 — No open P0 bugs

1. Review the QA sign-off report (`docs/blacqlist/launch/qa-sign-off-report.md`) and the bug list from series A–M
2. Confirm **zero** bugs rated **P0** remain open
3. Any P1 must be documented with accepted-risk sign-off

#### Checklist — M3 ✅ _(closed 2026-09-03)_
- [x] All A–M test results compiled — `qa-sign-off-report.md`
- [x] Zero open P0 bugs — re-derived 2026-09-03 against the *current* bug list, not the 2026-06-30 one. Four founder-walkthrough defects fixed and merged since (#113 save/heart, #111+#114 review intent, #112 admin search, #116 dead CTAs / wrong related / raw location slugs).
- [x] Open P1s documented with accepted-risk sign-off from tech lead — **one open P1**: Discover's *Products & Services* bin returns no businesses (root cause: the bin filters on `entity_type` where the founder's meaning is `location_type`). P1 not P0 by this report's own severity guide — a workaround exists (the other bins and search return every listing). Accepted-risk sign-off: `decision-log.md`, `[Decision — founder, 2026-09-03]`. PRs 7 and 8 remove the defect before the flip.
- [x] Evidence: link to the QA sign-off report — `docs/blacqlist/launch/qa-sign-off-report.md`; full re-derivation in `docs/blacqlist/ops/launch-gate-signoff-packets.md`

---

### M4 — At least one editorial collection published

> ### 🔵 NOT A FLIP GATE — post-flip item
>
> `[Decision — founder, 2026-09-03]` **M4 is a post-flip item, not a flip gate.** It does not block `COMING_SOON_MODE=false`.
>
> **Why this needed deciding at all:** M4 is a condition in `qa-sign-off-report.md` but appears in **no** blocker list — not in `launch-readiness.md`'s seven, not in blocker ⑦'s five sign-offs. `launch-readiness.md` rule 3 closes the blocker set against *additions* as well as subtractions, so whether M4 was consciously dropped or overlooked was `[Unknown]` and was the founder's to answer. It is now answered.
>
> **What made "post-flip" defensible:** `launch-readiness.md` already records that quality gaps are not flip gates ("every listing perfect" is explicitly out), and its actual standard is that *every public surface either works or is honestly labelled*. `/collections` clears that standard while empty — it is linked in the public footer (`components/nav/public-footer.tsx:85`), and its empty state reads *"No collections yet. Check back soon. Curated lists are on the way."* `[Observed — app/(public)/collections/page.tsx:52-60, 2026-09-03]`. Empty, reachable, and honest is a valid launch state; empty and misleading would not have been.
>
> **Do not re-derive this at the flip checklist.** The steps below stay as the how-to for when the first collection ships (week one), and the seed script lives on unmerged draft PR #91.

> **Current state: 0 collections exist.** The `collections` table uses `is_active` as the published flag, with a `collection_items` join table linking listings.

**To create and publish a collection:**

1. Sign in as `admin@test.blacqlist.dev` (or super admin)
2. Go to `/admin/collections/new`
3. Fill: **title** (e.g. "Atlanta Soul Food Icons"), **slug**, **description**, optional cover image
4. Save the collection
5. Add listings to it (collection items) — pick several published Atlanta listings
6. Set the collection **active/published** (`is_active = true`)
7. Verify the public page renders: `https://theblacqlist.com/collections/[slug]` (or `/collections`)

**Verify via SQL:**
```sql
SELECT title, slug, is_active FROM collections WHERE is_active = true;
-- Expect at least one row
SELECT COUNT(*) FROM collection_items ci
JOIN collections c ON c.id = ci.collection_id
WHERE c.is_active = true;
-- Expect > 0 items
```

#### Checklist — M4 🔵 _(post-flip — these boxes do NOT gate the flip; see the note under the M4 heading above)_
- [ ] At least one collection created via `/admin/collections/new`
- [ ] Collection has ≥3 listings attached (`collection_items`)
- [ ] Collection `is_active = true`
- [ ] Public `/collections/[slug]` page renders correctly
- [ ] Evidence: screenshot of the live collection page

---

### M5 — Claim queue SLA confirmed (≤48h during business hours)

This is an operational commitment, not code.

> **Wording corrected 2026-09-03.** This gate previously read "≤48h" while `on-call.md:70` reads "≤48 hours **during business hours**." Those differ materially on a Friday-evening claim, and this is a promise made to business owners, not an internal target. `[Decision — founder, 2026-09-03]` **the real promise is "≤48h during business hours."** `on-call.md` stands as written; this gate now matches it. One number, one meaning, one source.

1. Confirm a named owner is responsible for monitoring `/admin/claims`
2. Document the response-time commitment (≤48h during business hours) in the support playbook / on-call doc
3. Confirm the claims queue is reachable and shows pending claims

#### Checklist — M5 ⚠️ _(2 of 3 — one founder residual)_
- [x] Claim-queue owner named in `docs/blacqlist/launch/on-call.md` — founder, all roles (`on-call.md:14-16`)
- [x] ≤48h-during-business-hours response SLA written down — `on-call.md:70`, and this gate corrected to match
- [ ] `/admin/claims` confirmed functional with a real pending claim — **⛔ no evidence exists anywhere.** Tickets 040 and 041 are specifications, not runtime confirmation, and a route existing in the codebase is not the same as the queue having been opened. **Founder action, ~2 min:** open `/admin/claims` in production once and record what loads. An empty queue satisfies this honestly — say so and it is recorded as "surface loads, queue empty."

---

### M6 — On-call schedule set for first 30 days

1. Open `docs/blacqlist/launch/on-call.md`
2. Fill in: on-call names, contact methods, escalation path, and a day-by-day or week-by-week schedule covering the first 30 days post-launch
3. Confirm everyone listed has acknowledged

> **Fixed 2026-09-03.** `on-call.md` was filled in, but three of its rows described a team that does not exist: SEV1 routed to "Tech Lead + Product Lead **via phone**", SEV2 to "Tech Lead **via Slack**", and escalation steps 2 and 3 pointed at a "backup on-call" and a "Product Lead" who is the same founder. Four inexecutable paths, all reading as coverage. `[Decision — founder, 2026-09-03]` **match solo reality.** The rewrite routes every severity to the founder by email + Sentry alert, and replaces person-escalation with **state**-escalation: at 30 min, roll back; at 60 min, re-gate the site and work the incident with the public surface closed. The single-point-of-failure risk is now named as accepted rather than papered over.

#### Checklist — M6 ✅ _(closed 2026-09-03)_
- [x] `on-call.md` exists and is fully filled in (no placeholders) — verified line by line; the four phantom-team paths were the last placeholders in disguise and are gone
- [x] 30-day rotation covered — `on-call.md:27-32`, four weeks, founder primary. The weeks are **relative** ("Week 1 (launch week)"), so the document does not go stale as the flip date moves
- [x] Escalation path documented — rewritten so every step is executable by one person: mitigate → roll back at 30 min → re-gate at 60 min → preserve state on data-loss/security
- [x] All on-call people acknowledged — there is exactly one, and the founder's `[Decision — 2026-09-03]` authorizing this rewrite **is** the acknowledgment

---

### M7 — Supabase PITR enabled on production

Point-in-Time Recovery requires the Supabase **Pro plan** and must be enabled before real data is written.

1. Supabase dashboard → production project → **Settings → Database → Point in Time Recovery**
2. Enable PITR
3. Confirm the recovery window (e.g. 7 days) is active

#### Checklist — M7
- [ ] Production project on Pro plan
- [ ] PITR enabled
- [ ] Recovery window confirmed active
- [ ] Evidence: screenshot of the PITR settings page

---

### M8 — Production env vars confirmed in Vercel (already PASS)

Already marked Pass. No action — keep evidence (screenshot of Vercel env vars scoped to Production, confirming no `localhost` references and `NEXT_PUBLIC_SITE_URL=https://theblacqlist.com`).

---

### M9 — Seed data meets thresholds (150+ ATL / 50+ HOU / 50+ CHI)

> **Current state (local): 40 ATL / 20 HOU / 19 CHI — BELOW threshold.** Production seed must be expanded before this gate passes.

**Steps:**

1. Expand the seed JSON files (`scripts/data/listings-atlanta.json`, `-houston.json`, `-chicago.json`) to meet the per-city minimums
2. Run the idempotent seed script against **production**:
   ```bash
   SUPABASE_URL=[prod-url] SUPABASE_SERVICE_ROLE_KEY=[prod-key] npx ts-node scripts/seed-launch-listings.ts
   ```
3. Verify counts with SQL on production:
   ```sql
   SELECT c.name, COUNT(l.id) FILTER (WHERE l.status='published' AND l.deleted_at IS NULL) AS published
   FROM cities c LEFT JOIN listings l ON l.city_id = c.id
   WHERE c.slug IN ('atlanta-ga','houston-tx','chicago-il')
   GROUP BY c.name ORDER BY published DESC;
   ```

**Thresholds:**

| City | Minimum published |
|---|---|
| Atlanta | 150 |
| Houston | 50 |
| Chicago | 50 |

Also confirm the ticket-093 quality bar: **≥40% of listings have a cover image**.

#### Checklist — M9
- [ ] Atlanta ≥ 150 published
- [ ] Houston ≥ 50 published
- [ ] Chicago ≥ 50 published
- [ ] ≥40% of listings have a cover image
- [ ] Seed script ran cleanly (Errors: 0)
- [ ] Evidence: SQL count output saved

---

## Summary — What Blocks Launch Right Now

| Gate | Status | Blocking action |
|---|---|---|
| I1/I3/I4 | Re-test on production | Run Lighthouse on Vercel URL, incognito |
| L4–L12 | Not run | Walk C/D/E paths in Chrome, Safari, mobile 375px |
| K4 | Verify post-deploy | Confirm page-view events in Vercel Analytics (K5/K7/M10 ✅ confirmed 2026-08-15) |
| M3 | Pending | Compile A–M results; confirm zero P0 |
| **M4** | **Not met (0 collections)** | **Create + publish ≥1 collection** |
| M5/M6 | Docs | Fill on-call.md + SLA commitment |
| M7 | Need production | Enable PITR on Pro plan |
| **M9** | **Not met (40/20/19)** | **Expand seed to 150/50/50 on production** |

**Two hard content/data gates are currently unmet: M4 (no collections) and M9 (seed counts below threshold).** Everything else is either a re-test on production or a sign-off confirmation.
