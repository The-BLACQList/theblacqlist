# Cross-Browser (L) & MVP Launch Gates (M) — Test Guide

**Last updated:** 2026-08-23 (was 2026-06-07 — the L grid and the M4/M9 rows were both stale)

---

## L. Cross-Browser (L1–L15)

5 critical paths × 3 browser configs. **All 15 cells are automated** as of 2026-08-23
`[Measured — pnpm test:cross-browser, 2026-08-23]`.

C, D and E were manual until the owner fixture landed in `e2e/global-setup.ts`. They were never
hard to automate — they were blocked on one missing thing: an authenticated non-admin identity that
owned exactly one published listing and did _not_ own two others. That fixture converted all nine
remaining cells at once.

### Run the automated cells

```bash
pnpm test:cross-browser
```

Runs `e2e/cross-browser.spec.ts` in three Playwright projects:

- `chromium` → **Chrome desktop**
- `webkit-desktop` → **Safari** (WebKit engine — see caveat)
- `chromium-mobile` → **Chrome mobile @ 375px** (emulated viewport)

Each test asserts the flow completes **and** produces **zero console errors**. Result: **15 cells
green** (B, C, D, E, G × 3).

⚠ **All five paths must stay in `e2e/cross-browser.spec.ts`.** `playwright.config.ts` scopes
`webkit-desktop` and `chromium-mobile` with `testMatch: /cross-browser\.spec\.ts/`. A path refactored
into its own spec file silently drops to chromium-only and takes two L cells with it — the suite
still passes, so nothing tells you.

### What automation does and does NOT cover

- ✅ Functional completion + console errors, in all 3 engines.
- ❌ **Visual "layout" judgment** — needs a human glance (or a visual-snapshot tool).
- ⚠️ **WebKit ≠ real Safari.app** — same engine, catches most diffs, but do one real-Safari pass before launch.
- ⚠️ **Mobile 375 is emulated** — confirm on a real device for final sign-off.

### Tracker mapping — all 15 cells automated

| Cells   | Path                                                       | Chrome desktop | Safari (WebKit) | Chrome mobile 375 |
| ------- | ---------------------------------------------------------- | -------------- | --------------- | ----------------- |
| L1–L3   | **B** — Discovery (home → discover → listing)              | ✅             | ✅              | ✅                |
| L4–L6   | **C** — Add Business (sign in → `/add-business` → step 1)  | ✅             | ✅              | ✅                |
| L7–L9   | **D** — Claim (`/claim` → search → claim form renders)     | ✅             | ✅              | ✅                |
| L10–L12 | **E** — Owner dashboard (`/dashboard` → My Pages → editor) | ✅             | ✅              | ✅                |
| L13–L15 | **G** — Admin (sign in → `/admin` → claims queue)          | ✅             | ✅              | ✅                |

Safari cells run on WebKit, not real Safari.app; mobile cells run on an emulated 375px viewport. Both
caveats above still stand — one real-Safari pass and one real-device pass before launch.

**What the automated C, D, E cells assert, and what they deliberately do not.** Each walks to the
first meaningful surface of its path and asserts it rendered with zero console errors in all three
engines. None of them **completes a mutating flow**:

| Path                | Automated to                   | Stops before          | Why                                                                                                      |
| ------------------- | ------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------- |
| C — Add Business    | `/add-business` step 1 renders | steps 2–7 and Publish | A completed run would publish a real listing on every browser, on every CI run                           |
| D — Claim           | the claim form renders         | Submit                | A submitted claim flips the shared fixture into the "pending" branch and breaks specs that sort after it |
| E — Owner dashboard | the page editor opens          | destructive edits     | Save round-trips are asserted once, in `owner-dashboard.spec.ts`, chromium-only                          |

That boundary is the point of the cells: engine differences show up in **render and script
execution**, which is exactly the part now covered three ways. The end-to-end mutation is covered
once, in one engine, where it belongs. The full-form walk of C and the submit step of D remain the
only manual cross-browser work — one pass each, not nine.

---

## M. MVP Launch Gates (M1–M10)

### Run the automated gate checks

```bash
pnpm test:gates
```

⚠ **Never against production.** `playwright.config.ts` wires `globalSetup` onto _every_ Playwright
run, and `e2e/global-setup.ts` provisions users with hardcoded passwords plus three published fixture
listings on whatever project the env points at. It hard-stops on the production project ref, but the
guard is a backstop, not a licence — point it at local or staging deliberately.

Runs `e2e/launch-gates.spec.ts`. A **failing** test = the gate is genuinely **not yet satisfied** (a real blocker), not a broken test.

| Gate                           | Check                                                               | Current status                      |
| ------------------------------ | ------------------------------------------------------------------- | ----------------------------------- |
| **M1** Privacy at /privacy     | route 200 + content                                                 | ✅ Pass                             |
| **M2** Terms at /terms         | route 200 + content                                                 | ✅ Pass                             |
| **M4** ≥1 published collection | DB `collections.is_active=true` ≥ 1                                 | ✅ Asserted — green on the last run |
| **M8** no hardcoded localhost  | repo scan of `app/` + `lib/`                                        | ✅ Pass (only safe env fallbacks)   |
| **M9** seed thresholds         | published listings/city — ATL 150 / HOU 50 / CHI 50 / LA·DC·NOLA 40 | ✅ Asserted — green on the last run |

⚠ **M4 and M9 are environment-dependent, and this table is not.** They read live row counts, so
"green" means green _on the project the run was pointed at_. The last full run was **local**
`[Measured — pnpm test:e2e, 2026-08-23 — local Supabase]`. Production and staging counts are
`[Unknown]` until the suite is run against them.

**Corrected 2026-08-23.** These two rows read `❌ FAIL — 0 published` and
`❌ FAIL — ATL 40/150, HOU 20/50, CHI 19/50`, measured 2026-06-07 and never revisited. They are the
opposite failure mode from the test plan's stale gaps: a row that reads FAIL when the check is green
gets treated as a known blocker and stops being checked. Both are machine-asserted by
`e2e/launch-gates.spec.ts` — read the run output, not this table. M9's threshold set has also grown
since June: LA, DC and NOLA (40 each) were added.

### If a gate does fail

- **M4:** publish at least one editorial collection via `/admin/collections/new` (set it active).
- **M9:** add launch listings to `scripts/data/listings-{atlanta,houston,chicago}.json` to reach the per-city minimum, then `pnpm seed:launch`. Re-run `pnpm test:gates` to confirm.

### Owner / ops sign-offs (not code-checkable)

| Gate                       | How to verify                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M3** No open P0 bugs     | Review `docs/blacqlist/qa/mvp-bug-risk-log.md`; confirm no open P0.                                                                                               |
| **M5** Claim SLA ≤48h      | Policy is documented (`docs/blacqlist/launch/user-feedback-plan.md`); confirm the team commits to it.                                                             |
| **M6** On-call schedule    | `docs/blacqlist/launch/on-call.md` exists but **names are placeholders** — fill in real contacts + rotation.                                                      |
| **M7** Supabase PITR       | Enable PITR on the **production** Supabase project (dashboard → Settings → Database).                                                                             |
| **M10** Sentry prod errors | In production, set `SENTRY_TEST_TOKEN`, hit `/api/debug/sentry?token=…`, confirm the event in Sentry with `environment: production` and no PII (see infra guide). |

M8's full sign-off is also yours: confirm all production env vars are set in Vercel (the repo scan only proves no hardcoded localhost in source).
