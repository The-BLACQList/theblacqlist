# Accessibility Audit Report — The BLACQList

**Ticket:** 087
**Standard:** WCAG 2.1 AA
**Status:** Complete (automated axe pass + synthesis) — owner/account-gated screens pending test fixtures
**Date:** 2026-06-20
**Tools:** `@axe-core/playwright` (automated, WCAG 2a/2aa/21a/21aa), the existing keyboard/contrast/form-label e2e specs, VoiceOver evidence from the 2026-05-22 manual pass.
**Method:** Extended `e2e/a11y.spec.ts` from 5 → **21 reachable screens** and ran it against staging via the dev server; combined with the already-green keyboard (J6–J9), contrast (J12/J13), form-label (J14), and modal-focus (J10/J15) suites and the BRM-01/02 remediation.

---

## Summary

| Category | Coverage | Critical | Serious | Status |
|---|---|---|---|---|
| axe automated scan | 21 of 37 screens (all no-login + admin) | **0** | 1 (recurring) | PASS (zero Critical) |
| Keyboard navigation | J6–J9 + spot-checks | 0 | 0 | PASS |
| Color contrast | brand pairs + BRM-01 sweep | 0 | 1 (amber-as-text → 098) | PASS w/ 1 known item |
| Screen reader (VoiceOver) | 5 critical flows | 0 | 0 | PASS (2026-05-22, pre-rebrand) |
| Form labels | all scanned forms (J14) | 0 | 0 | PASS |
| Modal focus traps | J10, J15 | 0 | 0 | PASS |

**Go/No-Go:** **GO WITH CONDITIONS** — zero Critical across every scanned screen (the launch gate). One recurring **Serious** finding (amber-gold as small text on white) is routed to ticket 098; full 37-screen axe coverage needs owner/supporter test fixtures (below).

---

## The one recurring finding — amber-as-text (Serious) — ✅ FIXED 2026-06-20

> **Update:** resolved this round by swapping `text-amber-gold` → `text-amber` (`#8f6600`, 5.16:1) on light surfaces and `text-gold` (`#c4a065`) on dark, following the design system's own documented "amber-on-light / gold-on-dark" rule (globals.css). The original analysis is kept below for the record. A small residual (AA-on-white tokens dipping under AA on the pale-lavender `#eceae6` tint) is tracked separately as A-04 / ticket 098.


axe reports **exactly one Serious violation, and it is the same root cause on every screen** (public, auth, legal, admin):

```
Rule:    color-contrast (WCAG 2 AA, 1.4.3)
Element: a.text-amber-gold  (e.g. "Get notified when we reach your city." on /,
         the legal-page table-of-contents links, footer/links elsewhere)
Measured: #c4a065 (amber-gold) on #ffffff = 2.45:1   (AA requires 4.5:1 for normal text)
```

`text-amber-gold` used as **small text/links on a light background** fails AA. This is exactly the "amber-as-text" item already on ticket **098**. It is **Serious, not Critical**, so it does not fail the zero-Critical launch gate — but it should ship. **Fix direction (for 098):** introduce an AA-passing "amber ink" token (a darker gold, ≥4.5:1 on white) for amber *text/link* usages on light backgrounds, leaving amber-gold as-is for buttons (black-on-amber passes ~9.6:1) and for amber on dark surfaces. This is a brand-color decision (like BRM-01 was) and is left to the founder/design call rather than swept unilaterally mid-audit.

---

## Color Contrast: Brand Palette

| Text | Background | Required | Result | Pass? |
|---|---|---|---|---|
| `#000000` | amber-gold buttons | 4.5:1 | ~9.6:1 | ✅ (J12) |
| charcoal `#595758` | cream `#FCFAF4` | 4.5:1 | ~6.9:1 | ✅ (J13) |
| muted text (was `text-charcoal/30–70`) | white | 4.5:1 | 4.7–5.3:1 after **BRM-01** | ✅ |
| `#FCFAF4` | brand black | 4.5:1 | high | ✅ |
| amber-gold `#c4a065` | deep bg `#19191E` (nav, large) | 3:1 | passes (large/dark) | ✅ |
| **amber-gold `#c4a065`** | **white (small text/links)** | **4.5:1** | **2.45:1** | **❌ → ticket 098** |

---

## Screen Inventory — axe automated results

**Legend:** ✅ = zero Critical (Serious amber-text finding present site-wide per above, tracked in 098).

### Public / discovery / legal (no-login) — scanned 2026-06-20
| Screen | URL | axe Critical |
|---|---|---|
| Homepage | `/` | ✅ 0 |
| Discover | `/discover` | ✅ 0 |
| Search | `/search` | ✅ 0 |
| Collections index | `/collections` | ✅ 0 |
| Collection detail | `/collections/[slug]` (click-through) | ✅ 0 |
| Business listing page | `/[city]/business/[slug]` (click-through) | ✅ 0 |
| For Business | `/for-business` | ✅ 0 |
| About | `/about` | ✅ 0 |
| Privacy | `/privacy` | ✅ 0 |
| Terms | `/terms` | ✅ 0 |
| Cookies | `/cookies` | ✅ 0 |

### Auth (no-login) — scanned 2026-06-20
| Screen | URL | axe Critical |
|---|---|---|
| Sign in | `/sign-in` | ✅ 0 |
| Sign up | `/sign-up` | ✅ 0 |
| Forgot password | `/forgot-password` | ✅ 0 |
| Reset password | `/reset-password` | ✅ 0 |
| Verify email | `/verify-email` | ✅ 0 |

### Admin (via `loginAsAdmin`) — scanned 2026-06-20
| Screen | URL | axe Critical |
|---|---|---|
| Admin overview | `/admin` | ✅ 0 |
| Admin listings | `/admin/listings` | ✅ 0 |
| Admin claims queue | `/admin/claims` | ✅ 0 |
| Admin collections | `/admin/collections` | ✅ 0 |
| Admin receipts | `/admin/receipts` | ✅ 0 |

### Not yet auto-scanned (coverage gap)
| Screen group | Reason | Plan |
|---|---|---|
| City landing `/discover/[citySlug]`, City+Category | dynamic; **reuse the discovery grid + card components already scanned** on `/discover` | low risk; spot-check |
| Owner dashboard ×3 (`/dashboard`, `/dashboard/page`, `/dashboard/services`) | needs an **owner** test user + a listing fixture (only an admin test user is provisioned in `e2e/global-setup.ts`) | add `loginAsOwner` + owner/listing fixture |
| Supporter account ×3 (`/account/saved`, `/account/receipts`, `/account/settings`) | needs a **supporter** test user | add `loginAsSupporter` fixture (note: `/account/settings` hosts the new delete-account UI) |
| `/claim`, `/claim/[id]`, `/add-business`, `/onboarding` | auth-gated multi-step flows | scan once owner/supporter fixtures exist |
| Admin detail/secondary pages (`/admin/listings/[id]`, `/admin/claims/[id]`, `/admin/collections/[id]`, `/admin/users`, `/admin/categories`, `/admin/analytics`) | need fixture rows/ids | extend the admin walk with seeded ids |

→ **Follow-up to reach 37/37:** provision `A11Y_OWNER_*` + `A11Y_SUPPORTER_*` test users (+ one owned listing) in `e2e/global-setup.ts`, add `loginAsOwner`/`loginAsSupporter` to `e2e/helpers/auth.ts`, and extend the suite. Tracked as the remaining slice of this card.

---

## Keyboard, Labels, Focus, Screen Reader (existing evidence)

| Check | Test(s) | Result |
|---|---|---|
| Keyboard reachability + no traps | `e2e/keyboard-a11y.spec.ts` (J6–J9) | ✅ PASS |
| Visible focus rings | J6–J9 | ✅ PASS |
| Skip link + `<main id="main-content">` + landmarks | J8 + root layout | ✅ PASS |
| Form labels on every input | `e2e/form-labels.spec.ts` (J14) | ✅ PASS |
| Modal focus trap + Esc + focus return | J10, J15 | ✅ PASS |
| VoiceOver — 5 critical flows | manual (J9–J11) | ✅ PASS (2026-05-22, **pre-rebrand**; re-verify recommended) |
| Muted/secondary text contrast | **BRM-01** token sweep | ✅ remediated to AA |
| Icon-only button names | **BRM-02** | ✅ already compliant |

---

## Findings Log

| ID | Screen | Severity | Description | Fix | Status |
|---|---|---|---|---|---|
| A-01 | site-wide | Serious | `text-amber-gold` (#c4a065) as small text/links on white = 2.45:1 (AA fail) | swapped to `text-amber` (#8f6600, 5.16:1) on light + `text-gold` on dark, per the design system's own rule | **✅ FIXED 2026-06-20 (ticket 098)** |
| A-04 | pale-lavender + dark-panel | Serious | AA-on-white tokens dip just under AA on the `#eceae6` tint (amber eyebrow 4.29, charcoal-soft 4.43, charcoal/80 3.86) and `text-white/40` on dark (3.75) | design-surface decision: lighten pale-lavender or darker tokens on tint | **Open → ticket 098** |
| A-02 | owner/account/claim/onboarding | — (coverage) | ~16 gated screens not yet auto-scanned (no owner/supporter test fixtures) | add owner/supporter fixtures + extend suite | **Open (follow-up)** |
| A-03 | all | — (re-verify) | VoiceOver evidence predates the brand refresh | re-run VoiceOver on the 5 flows post-rebrand | **Recommended** |

**No Critical findings on any of the 21 scanned screens.**

---

## Go/No-Go Recommendation

**GO WITH CONDITIONS.**

Every scanned screen (all no-login public/auth/legal + admin) returns **zero Critical** axe violations — the card's launch gate. Keyboard, form-label, modal-focus, and (pre-rebrand) VoiceOver evidence all pass, and BRM-01/02 closed the muted-text and icon-button debts.

**Conditions / follow-ups (none block the zero-Critical MVP gate):**
1. ✅ **Amber-as-text contrast fixed** (A-01) this round — `text-amber-gold`→`text-amber` on light, `text-gold` on dark. Residual pale-lavender-tint near-misses (A-04) remain a design-surface call in ticket 098.
2. **Extend axe to the ~16 owner/account-gated screens** (A-02) by provisioning owner + supporter test fixtures — to claim true 37/37 coverage.
3. **Re-run VoiceOver on the 5 critical flows post-rebrand** (A-03).
