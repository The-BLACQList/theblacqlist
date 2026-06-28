# Cross-Browser (L) & MVP Launch Gates (M) — Test Guide

**Last updated:** 2026-06-07

---

## L. Cross-Browser (L1–L15)

5 critical paths × 3 browser configs. **Automated:** B (Discovery) and G (Admin) across all 3 configs. **Manual:** C (Add Business), D (Claim), E (Owner dashboard).

### Run the automated cells
```bash
pnpm test:cross-browser
```
Runs `e2e/cross-browser.spec.ts` in three Playwright projects:
- `chromium` → **Chrome desktop**
- `webkit-desktop` → **Safari** (WebKit engine — see caveat)
- `chromium-mobile` → **Chrome mobile @ 375px** (emulated viewport)

Each test asserts the flow completes **and** produces **zero console errors**. Result: 6 cells green (B + G × 3).

### What automation does and does NOT cover
- ✅ Functional completion + console errors, in all 3 engines.
- ❌ **Visual "layout" judgment** — needs a human glance (or a visual-snapshot tool).
- ⚠️ **WebKit ≠ real Safari.app** — same engine, catches most diffs, but do one real-Safari pass before launch.
- ⚠️ **Mobile 375 is emulated** — confirm on a real device for final sign-off.

### Tracker mapping (automated)
| Cell | Path / browser | Status |
|---|---|---|
| L1 | B — Chrome desktop | ✅ Auto pass |
| L2 | B — Safari desktop | ✅ Auto pass (WebKit; real-Safari pending) |
| L3 | B — Chrome mobile 375 | ✅ Auto pass (emulated) |
| L13 | G — Chrome desktop | ✅ Auto pass |
| L14 | G — Safari desktop | ✅ Auto pass (WebKit; real-Safari pending) |
| L15 | G — Chrome mobile 375 | ✅ Auto pass (emulated) |

### Manual cells (C / D / E) — L4–L12
These need a non-admin test user, an owned listing, and a pending claim, so they're manual for now (candidate for a future automation phase). Run each in Chrome desktop, Safari desktop, and Chrome mobile (375px DevTools device toolbar), watching for functional/layout/console errors.

**C — Add Business** (L4–L6): sign in → `/add-business` → complete the 7-step form (basic info → contact → category/city → media → CTA → preview) → Publish → confirm the success screen and the new live page.

**D — Claim** (L7–L9): `/claim` → search a business → Claim → sign in if prompted → fill verification (email, role, optional doc) → Submit → confirm "Claim submitted".

**E — Owner dashboard** (L10–L12): sign in as a user who owns a listing → `/dashboard` → confirm status banner, page-preview card, analytics strip, completeness checklist → "Edit my Page" opens the editor.

---

## M. MVP Launch Gates (M1–M10)

### Run the automated gate checks
```bash
pnpm test:gates
```
Runs `e2e/launch-gates.spec.ts`. A **failing** test = the gate is genuinely **not yet satisfied** (a real blocker), not a broken test.

| Gate | Check | Current status |
|---|---|---|
| **M1** Privacy at /privacy | route 200 + content | ✅ Pass |
| **M2** Terms at /terms | route 200 + content | ✅ Pass |
| **M4** ≥1 published collection | DB `collections.is_active=true` ≥ 1 | ❌ **FAIL — 0 published** |
| **M8** no hardcoded localhost | repo scan of `app/` + `lib/` | ✅ Pass (only safe env fallbacks) |
| **M9** seed thresholds | published listings/city | ❌ **FAIL — ATL 40/150, HOU 20/50, CHI 19/50** |

### Blockers to clear (content tasks — owner)
- **M4:** publish at least one editorial collection via `/admin/collections/new` (set it active).
- **M9:** add launch listings to `scripts/data/listings-{atlanta,houston,chicago}.json` to reach 150 / 50 / 50, then `pnpm seed:launch`. Re-run `pnpm test:gates` to confirm.

### Owner / ops sign-offs (not code-checkable)
| Gate | How to verify |
|---|---|
| **M3** No open P0 bugs | Review `docs/blacqlist/qa/mvp-bug-risk-log.md`; confirm no open P0. |
| **M5** Claim SLA ≤48h | Policy is documented (`docs/blacqlist/launch/user-feedback-plan.md`); confirm the team commits to it. |
| **M6** On-call schedule | `docs/blacqlist/launch/on-call.md` exists but **names are placeholders** — fill in real contacts + rotation. |
| **M7** Supabase PITR | Enable PITR on the **production** Supabase project (dashboard → Settings → Database). |
| **M10** Sentry prod errors | In production, set `SENTRY_TEST_TOKEN`, hit `/api/debug/sentry?token=…`, confirm the event in Sentry with `environment: production` and no PII (see infra guide). |

M8's full sign-off is also yours: confirm all production env vars are set in Vercel (the repo scan only proves no hardcoded localhost in source).
