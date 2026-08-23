# Regression Walk Audit — what the machine already proves, and what still needs your eyes

**Date:** 2026-08-23
**Purpose:** Shrink the founder's 6–8 hour manual regression walk (ledger `2.7`, §2F1) by mapping every
manual case — TA-01…TA-25 and cross-browser cells L1…L15 — against the 11 Playwright specs that exist today.
**Sources audited:** `docs/blacqlist/qa/mvp-test-plan.md` (2026-05-11, 651 lines, 25 cases, 144 steps),
`docs/blacqlist/qa/cross-browser-and-launch-gates-guide.md` (2026-06-07), `e2e/*.spec.ts` (11 specs),
`e2e/global-setup.ts`, `package.json` scripts.

---

## Headline

| | Count |
|---|---|
| Manual steps in the plan as written | **144** across 25 cases |
| Cross-browser cells | **15** (L1–L15) |
| Cells **already** proven by machine | **6** — L1–L3, L13–L15 |
| Steps **already** proven by machine | **~21** of 144 |
| Steps automatable **with no new fixtures** | **~24** |
| Steps automatable **with one new fixture** (an owner account) | **~55**, and it converts **all 9** manual L cells |
| Steps that genuinely need a human | **~30** |
| Steps that are **obsolete** and should be deleted or rewritten before anyone runs them | **~14** |

**The single highest-leverage change is one fixture.** `e2e/global-setup.ts` provisions **only an admin
account** `[Observed — e2e/global-setup.ts:1-94]`. Every uncovered owner-side case — the entire Add Business,
Claim, Owner Dashboard, Page Editor, Receipts and Marketplace surface, which is where the manual hours
actually go — is blocked on the absence of a non-admin user who owns a published listing. Add that fixture and
roughly a third of the walk becomes machine work, including the ownership-enforcement assertions that are the
riskiest to skip and the most tedious to do by hand.

---

## Finding 0 — the plan is materially stale, and walking it as written wastes your time

`mvp-test-plan.md` is dated **2026-05-11**. It carries four "Known Gaps (P1 — Must Fix Before Launch)".
**All four are obsolete.** Verified this session:

| Plan claims | Reality | Evidence |
|---|---|---|
| "Upload route handler missing — `app/api/upload/[bucket]/route.ts` does not exist; all media upload flows will fail" | The route exists — at `app/api/upload/route.ts`, without the `[bucket]` segment the plan expected | `[Observed — find app/api -path "*upload*"]` |
| "Business detail page uses mock data — renders `MOCK_ENTITIES`, not real DB rows" | **Zero** references to `MOCK_ENTITIES` anywhere in `app/`, `lib/`, `components/`. `e2e/vendor-storefront.spec.ts` asserts a real listing resolves with its city join intact | `[Observed — grep -rln MOCK_ENTITIES app lib components → no matches]` |
| "Search/discover uses mock data" | Search runs through the faceted RPC; `e2e/ownership-label.spec.ts` asserts the Ownership facet actually filters results and updates the URL | `[Observed]` |
| "No automated test suite — no `pnpm test` script; all QA is manual" | `pnpm test` = `test:unit` (vitest) + `test:e2e` (playwright), plus 8 targeted scripts | `[Observed — package.json]` |

These four claims poison **14 steps** across TA-05 (step 5 failure note), TA-06 (steps 1–2 and the "Critical
gap" banner), TA-07 (the closing note), TA-10 (step 7), TA-11 (step 1's "once mock data is removed"), and all
of TA-13, which is written *entirely* around the upload gap — every one of its four steps is conditioned on
"upload will fail."

**Do not run TA-13 as written.** It cannot pass or fail meaningfully; it tests a gap that closed.

**Also missing:** the 25 cases predate the ownership label, the N7 map release, faceted filtering, vendor
storefronts, and the certification rule. Two of those now have specs (`ownership-label.spec.ts`,
`vendor-storefront.spec.ts`). **The map presence ladder, the wider facet set, and the certification rule are
in no case and no spec** — they are untested surface, not covered surface.

**Recommendation:** do not rewrite the plan. Correct the four gap rows in place, delete TA-13's premise, and
append the three missing surfaces. That is a 20-minute edit, not a document project.

---

## The cross-browser grid (L1–L15)

`pnpm test:cross-browser` runs `e2e/cross-browser.spec.ts` in three projects — `chromium` (Chrome desktop),
`webkit-desktop` (Safari/WebKit), `chromium-mobile` (Chrome mobile @375px) — and each test asserts flow
completion **and zero console errors**.

| Cell | Path | Chrome | Safari | Mobile 375 | Status |
|---|---|---|---|---|---|
| L1–L3 | **B — Discovery** (home → discover → listing) | ✅ | ✅ | ✅ | **Automated** |
| L4–L6 | **C — Add Business** (7-step form → publish) | ⬜ | ⬜ | ⬜ | Manual — *Tier 2* |
| L7–L9 | **D — Claim** (search → claim → verification → submit) | ⬜ | ⬜ | ⬜ | Manual — *Tier 2* |
| L10–L12 | **E — Owner dashboard** (banner, preview, analytics, checklist, editor) | ⬜ | ⬜ | ⬜ | Manual — *Tier 2* |
| L13–L15 | **G — Admin** (sign in → admin → claims queue) | ✅ | ✅ | ✅ | **Automated** |

**6 of 15 cells already pass by machine.** The remaining 9 are three flows × three browsers — and those three
flows are exactly TA-05, TA-09 and TA-10. Automating those three cases collapses 9 manual cells at once,
because Playwright runs them in all three projects for free.

⚠ The cross-browser guide's own status table is stale in the other direction: it lists **M4 as FAIL (0
published)** and **M9 as FAIL (ATL 40/150…)**, while ledger `2.11` records only **M7 (PITR)** still open.
`e2e/launch-gates.spec.ts` asserts M4 and M9 directly — trust the spec, not the guide.

---

## Case-by-case coverage (TA-01 … TA-25)

Legend: ✅ proven by machine · 🟡 partly proven · ⬜ not covered · ⚠ stale, rewrite before running

| Case | P | Steps | Covered by | State |
|---|---|---|---|---|
| **TA-01** Public homepage | P1 | 6 | `cross-browser` B (steps 1, 4 ×3 browsers, zero-console-error); `a11y`/`contrast`/`form-labels`/`security-headers` all scan `/` | 🟡 2/6 |
| **TA-02** Sign-up | P1 | 7 | `a11y` + `form-labels` scan `/sign-up` (labels, no critical violations) — no behaviour | ⬜ 0/7 |
| **TA-03** Sign-in / out | P1 | 6 | `cross-browser` G signs in through the real form (step 3); `infra` K3 = authenticated user redirected off `/sign-in` (step 6) | 🟡 2/6 |
| **TA-04** Onboarding | P1 | 4 | — | ⬜ 0/4 |
| **TA-05** Add Business (7 steps) | P1 | 8 | — · **= L4–L6** | ⬜ 0/8 |
| **TA-06** Business page | P1 | 11 | `vendor-storefront` proves real DB rows + city join (**refutes step 2**); `analytics-emission` proves save + share emit and roll up (steps 4–5); `a11y` scans the listing page; `cross-browser` B lands on it ×3 | 🟡⚠ 4/11 |
| **TA-07** Search & discovery | P1 | 6 | `cross-browser` B (steps 1, 6 ×3); `ownership-label` proves a facet filters and writes URL state (step 3) | 🟡⚠ 3/6 |
| **TA-08** City / category landing | P2 | 4 | — (no city route appears in any parameterized spec list) | ⬜ 0/4 |
| **TA-09** Claim workflow | P1 | 10 | — · **= L7–L9** | ⬜ 0/10 |
| **TA-10** Owner dashboard | P1 | 7 | — · **= L10–L12**. Steps 4–5 are the ownership-enforcement 404s — highest-risk uncovered assertions in the plan | ⬜⚠ 0/7 |
| **TA-11** Page editor — hero/about | P1 | 5 | — | ⬜⚠ 0/5 |
| **TA-12** Page editor — contact/hours/social | P1 | 6 | — | ⬜ 0/6 |
| **TA-13** Gallery management | P1 | 4 | — **Written entirely around the closed upload gap. Unrunnable as written.** | ⚠ rewrite |
| **TA-14** Services manager | P1 | 5 | — | ⬜ 0/5 |
| **TA-15** AI suggestions | P2 | 6 | — | ⬜ 0/6 |
| **TA-16** Owner analytics | P2 | 4 | `analytics-emission` proves the roll-up into `entity_analytics_daily` (step 2's mechanism) | 🟡 1/4 |
| **TA-17** Analytics ingestion API | P1 | 3 | `analytics-emission` proves the valid-event path end to end. The two negative cases are uncovered | 🟡 1/3 |
| **TA-18** Admin auth guard | P1 | 5 | `cross-browser` G = admin reaches `/admin/claims` ×3; `a11y` loads `/admin`, `/admin/claims`, `/admin/listings`, `/admin/collections` without error (step 5, 4 of N); `infra` K3 | 🟡 3/5 |
| **TA-19** Admin claims queue | P1 | 6 | `cross-browser` G loads the queue ×3; `form-labels` covers its form fields. Approve / reject / audit-log uncovered | 🟡 2/6 |
| **TA-20** Receipts lifecycle | P1 | 7 | — **P1, includes the cross-user RLS check (step 2). Entirely uncovered.** | ⬜ 0/7 |
| **TA-21** Community spend | P2 | 4 | — (steps 2–4 are pure API assertions) | ⬜ 0/4 |
| **TA-22** Marketplace | P2 | 6 | `vendor-storefront` covers step 1 and step 5's premise (non-owner resolution) | 🟡 1.5/6 |
| **TA-23** Collections | P2 | 6 | `launch-gates` M4 proves ≥1 active collection; `a11y` click-throughs a collection detail page | 🟡 1.5/6 |
| **TA-24** Save & share | P2 | 6 | `analytics-emission` proves save + share fire and roll up (steps 2, 5 partly) | 🟡 1.5/6 |
| **TA-25** Admin AI tools | P2 | 6 | — | ⬜ 0/6 |

---

## What I can automate, in two tiers

### Tier 1 — no new fixtures. Anonymous and the existing admin only.

Every one of these runs against what `global-setup.ts` already provides. **~24 steps.**

| Target | Steps | Why it's worth machine time |
|---|---|---|
| TA-17 negatives | 2 | `INVALID_EVENT_NAME` and `VALIDATION_ERROR` — pure API, no state |
| TA-21 API assertions | 3 | `/api/community-spend` returns aggregate only (no per-transaction leakage); `/api/flow-map/personal-impact` unauth → 401. **Privacy assertions — these are the kind a tired human ticks without really checking** |
| TA-23 step 6 | 1 | Anonymous POST to collection creation → 403/404 |
| TA-02 steps 1–4, 6 | 5 | Sign-up validation is all client/anon-side: empty, bad email, weak password, duplicate email → error not 500 |
| TA-03 steps 1–2 | 2 | Wrong password → generic error, **no account-lockout info disclosed** |
| TA-05 step 1 · TA-09 step 1 | 2 | Unauthenticated `/add-business` and `/claim` → `/sign-in?next=` |
| TA-08 steps 1–3 | 3 | City page, city+category page, bad slug → **404 not 500** |
| TA-07 steps 2, 5 | 2 | Keyword search survives special characters; empty-results state renders with an action |
| TA-18 step 1 | 1 | Anonymous `/admin` → `/sign-in` |
| TA-06 step 3 | 1 | Save while unauthenticated → sign-in with a `?next=` that returns to the listing |

These are almost all **negative and boundary cases** — the half of the plan a human walk is worst at, because
nothing visibly breaks when they silently regress.

### Tier 2 — one fixture: a non-admin user who owns a published listing

Add to `e2e/global-setup.ts`, idempotently and reconciled on every run (the same pattern the admin row already
uses): an owner account, one published listing owned by it, one unclaimed listing, one pending claim.

**This is the unlock.** It converts **all 9 manual L cells** and roughly **55 steps**:

- **TA-05 / L4–L6** — Add Business, all three browsers
- **TA-09 / L7–L9** — Claim, all three browsers
- **TA-10 / L10–L12** — Owner dashboard, all three browsers, **including steps 4–5**: `/dashboard/pages/[fakeId]` and `[otherOwnerId]` must 404, not leak another owner's data
- **TA-11, TA-12, TA-14** — page editor save/validate round-trips
- **TA-16** — owner analytics page renders, 7d/30d ranges, wrong-owner 404
- **TA-18 step 2** — non-admin hitting `/admin` → `/` (`requireAdmin()` fires)
- **TA-20** — receipts lifecycle, **including step 2's cross-user RLS 404**
- **TA-22 steps 2–5** — owner product CRUD + non-owner direct POST rejection
- **TA-24 steps 1, 3, 4, 6** — save gating, `/account/saved`, unsave, count integrity

Note the pattern: the ownership and permission assertions cluster here. TA-10 steps 4–5, TA-18 step 2, TA-20
step 2, TA-22 step 5 are all "does the server actually stop the wrong person" — four separate places where a
manual walk produces a tick mark and a machine produces proof.

**Both tiers ship in one PR**, since Tier 1 needs nothing and Tier 2 touches only `global-setup.ts` plus new
spec files. No production surface changes. This is GATE-DEPLOY at merge, as always.

---

## What genuinely needs your eyes (~30 steps)

No amount of automation removes these. This is the real walk.

| What | Why a machine can't |
|---|---|
| **Visual layout judgment**, every screen | Playwright asserts presence, never "this looks right." The cross-browser guide already says so. |
| **One pass in real Safari.app** | WebKit ≠ Safari. Different network stack, different PWA behaviour. |
| **One pass on a real 375px phone** | DevTools emulation isn't a real touch target, a real keyboard, or a real thumb. |
| TA-24 step 5 — **native share sheet** | The Web Share API opens an OS dialog Playwright cannot see. |
| TA-05 step 7 — **slow-connection submit** | Throttling is scriptable; judging whether the loading state *feels* right is not. |
| TA-06 steps 7–11 — gallery lightbox, services, hours badge, reviews, map | The hours open/closed badge is clock-dependent; the lightbox is a feel test; the reviews check is "no PII visible," which needs a human reading it. |
| TA-15 step 4 — "AI copy suggestions coming in V2" empty state | Verify this is still the intended state before shipping; it may be a stale expectation. |
| TA-25 step 6 — no real call to anthropic.com | Assertable, but worth one human network-tab confirmation on the admin surface. |
| **Anything on the map / N7 presence ladder** | No case, no spec. Untested surface. |

---

## Recommendation

1. **Correct the four obsolete gap rows and TA-13's premise** in `mvp-test-plan.md`. 20 minutes, prevents you
   from spending walk time on gaps that closed three months ago.
2. **Let me build Tier 1 + Tier 2 as one PR.** The fixture is the whole game — it collapses 9 of the 9
   remaining cross-browser cells and carries every ownership-enforcement assertion in the plan.
3. **Then your walk is the ~30 human steps above**, not 144 — one real-Safari pass, one real-phone pass, and
   the visual/feel judgments that were always yours to make.

`[Assumption]` Against the ledger's 6–8 hour estimate, that is a walk on the order of **1.5–2 hours**. I am
labelling this an assumption rather than a measurement: the 6–8 figure is the founder's own and was never
broken down per case, so the ratio is inferred from step counts, not timed.

**Nothing in this audit ticks a ledger row.** It reduces the cost of `2.7` / §2F1 when you come to run it.

---

## Open items this audit surfaced

| Item | Rating |
|---|---|
| The map / N7 presence ladder has no test case and no spec | **Medium** — it shipped 2026-08-07 and carries the "prominence earned by trust, never sold" promise |
| The certification rule (six criteria) has no e2e case | **Medium** — two callers must agree; they disagreed for three months once already |
| Faceted filtering beyond the Ownership facet is untested | **Low-Medium** |
| `cross-browser-and-launch-gates-guide.md` M4/M9 status rows are stale (say FAIL; the specs assert pass) | **Low** — fix in the same 20-minute edit |
