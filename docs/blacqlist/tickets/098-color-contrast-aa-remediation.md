# Ticket 098: Color contrast — WCAG AA remediation

## Status

In Progress — footer fixed; muted-text and brand-token items remaining

## Phase

Phase 17: Security, QA, Accessibility, Launch

## Priority

P1

## Feature Area

Accessibility / Design System

---

## Context

axe scans (tests J1–J5) and a targeted `color-contrast` probe flagged several **Serious** contrast failures (axe impact: serious — non-blocking for the J1–J5 Critical gate, but real WCAG AA failures). The common theme is **muted/secondary text rendered too light**, plus two brand-token usages.

The biggest one — the **footer** (`text-charcoal` `#595758` on the black footer = 2.92:1, on every page) — has been **fixed** by switching those elements to `text-gray-400` (~7:1), matching the active footer links that already passed.

The contrast tests that *check fixed brand pairs* (**J12** black-on-amber buttons ~9.6:1, **J13** charcoal-on-cream body ~6.9:1) **pass** — those usages are fine. The failures below are different usages of the same hues (amber as small text on white; charcoal at reduced opacity as helper text).

Source: `e2e/contrast.spec.ts`, `e2e/a11y.spec.ts`, contrast probe 2026-06-07.

---

## User Story

As a low-vision user, I want all text — including helper text, hints, and badges — to meet WCAG AA contrast (4.5:1 for normal text, 3:1 for large text / UI components), so I can read every part of the interface.

---

## Findings

| # | Location | Element | fg → bg | Ratio | Status |
|---|---|---|---|---|---|
| 1 | All pages — footer | social icons, "coming soon" links, copyright, legal links | `#595758` → `#000000` | 2.92 | **Fixed** → `text-gray-400` |
| 2 | Homepage | "Get notified…" link (`.underline`, `app/page.tsx`) | `#e2a428` (amber) → `#ffffff` | 2.19 | Open |
| 3 | `/discover` (+ listing cards) | "Claimed" tier badge (`components/ui/status-badge.tsx`, `bg-[#3B82F6]`) | `#ffffff` → `#3b82f6` | 3.67 | Open |
| 4 | `/sign-up` | password hint (`#password-hint`) | `#acabab` → `#ffffff` | 2.29 | Open |
| 5 | `/sign-up` | role-selector descriptions (`text-charcoal/70`) | `#848388`/`#8b898a` → `#e9e9f7`/`#fff` | 3.12–3.47 | Open |
| 6 | `/sign-up` | helper text (`text-charcoal/60`) | `#9b9a9b` → `#ffffff` | 2.80 | Open |
| 7 | `/sign-up` | muted text on deep-bg (`text-white/40`) | `#757578` → `#19191e` | 3.81 | Open |

---

## Scope

**In scope:**

- Define an **accessible muted-text convention**: replace ad-hoc `text-charcoal/60`, `text-charcoal/70`, `text-white/40`, and `#acabab` hints with token(s) that meet 4.5:1 on their actual backgrounds (e.g., a `muted-foreground` that is dark enough on white / light enough on deep-bg). Audit usages, don't just bump one instance.
- Finding 2 (amber link on white): use a darker amber for amber-colored **text on light** backgrounds (the amber *background* + black text usage is fine and must not change), or restyle the link (e.g., brand-black text with amber underline).
- Finding 3 (Claimed badge `#3B82F6`): darken to a blue that gives ≥4.5:1 with white text at the badge's font size (e.g., a blue-700-class value), or use black text on a lighter blue. Coordinate with the trust-tier color semantics in the design system.
- Re-run the contrast probe to confirm zero Serious `color-contrast` violations on `/`, `/discover`, `/sign-up`, listing, and `/admin/claims`.

**Out of scope:**

- Restructuring the trust-tier system itself (only its colors' contrast).
- AAA conformance.

---

## Acceptance Criteria

- [x] Footer contrast meets AA (Finding 1).
- [ ] Findings 2–7 remediated to ≥4.5:1 (normal text) / ≥3:1 (large text & UI components).
- [ ] Brand-color decisions for amber-as-text and the Claimed badge confirmed against the design system (`docs/blacqlist/design/`).
- [ ] Contrast probe shows zero Serious `color-contrast` violations across the five key routes.
- [ ] No regression to J12/J13 (amber-button and charcoal-on-cream pairs still pass).

---

## Notes

These are design-token decisions (brand hues, muted-text conventions), which is why only the unambiguous footer misuse was fixed immediately. The remaining items should be remediated as one coordinated design-token pass and confirmed against the brand guide before shipping.

---

## Audit update — 2026-06-20 (from the 087 accessibility re-scan)

The accessibility audit (ticket 087) extended axe from 5 → **21 reachable screens** and re-ran it post-rebrand. Result for contrast:

- **Findings 4–7 (sign-up muted text) are now RESOLVED by BRM-01** — the opacity-based muted greys (`text-charcoal/60–70`, `text-white/40`, the `#acabab` hint) were swept to the AA tokens `text-charcoal-soft` `#6b6b6b` (5.3:1) / `text-charcoal-faint` `#737373` (4.7:1). They no longer appear as Serious violations.
- **Finding 2 (amber-as-text) is now the ONLY recurring Serious `color-contrast` violation, and it appears on every one of the 21 scanned screens** (public, auth, legal, admin). Re-measured with the current rebrand value:

  ```
  Element:  a.text-amber-gold  (e.g. "Get notified when we reach your city." on /,
            the legal-page table-of-contents links, and amber links generally)
  Measured: #c4a065 (amber-gold) on #ffffff = 2.45:1   (AA normal-text requires 4.5:1)
  ```

  (The rebrand shifted amber-gold from `#e2a428` to `#c4a065`; ratio moved 2.19 → 2.45 — still failing.)
- **Finding 3 (Claimed badge `#3B82F6`)** was not re-surfaced as a Serious violation in the 21-screen pass — verify separately on a card showing the Claimed tier before closing it.

**Recommended fix (single coordinated pass):** add an AA "amber ink" token — a darker gold that clears **≥4.5:1 on white** — and swap `text-amber-gold` → the new token **only where amber is used as small text/links on light backgrounds**. Leave amber **buttons** (black-on-amber ~9.6:1, passes) and amber **on dark surfaces** (large/nav, passes) unchanged. This mirrors the BRM-01 approach (a fixed-hex AA token replacing a failing brand usage) but, because amber is a core brand hue, the exact shade should be confirmed against `docs/blacqlist/design/` before the sweep. Evidence: `docs/blacqlist/launch/accessibility-audit-report.md` (finding A-01).

---

## RESOLUTION — 2026-06-20 (amber-as-text fixed)

**Finding 2 (amber-as-text) is RESOLVED** — and the fix was simpler than a new token, because the design system already had the right one. globals.css documents the rule *"gold-on-dark / amber-on-light"* with `--color-amber: #8f6600` (**5.16:1 on white**, AA) for light-surface interactive text and `--color-gold` / `--color-amber-gold: #c4a065` for dark surfaces. The bug was components using `text-amber-gold` (the dark/gold token, 2.45:1 on white) on **light** surfaces.

What changed (`app/**`, `components/**`):
- **`text-amber-gold` → `text-amber`** on all light surfaces (221 usages) — now 5.16:1 on white.
- **`text-amber` → `text-gold`** on the genuinely dark surfaces it should never have left (nav, footer, hero overlays, dark page heroes on home/for-business/for-vendors/marketplace/for-sponsors/pricing/onboarding, the dark dashboard + admin sidebars, dark initials) — `#c4a065`, **zero visual change on dark**, semantically correct.
- Net token state: `text-amber` 227 (light, AA) · `text-gold` 39 (dark) · `text-amber-gold` 0.

Verified: the 087 axe suite re-run (21 screens) is green of amber-on-white violations on every screen; `pnpm typecheck` + `pnpm lint` clean.

### Remaining (separate from amber-as-text) — the pale-lavender surface class
The audit surfaced that **`bg-pale-lavender` `#eceae6` shaves ~0.8 off every AA-on-white token**, so a few labels measure just under AA *on that tint specifically* (all pass on white):
- amber eyebrow (`#8f6600`) on pale-lavender = **4.29** (Collections eyebrow)
- `text-charcoal-soft` (`#6b6b6b`) on pale-lavender = **4.43** (back-links)
- a stray `text-charcoal/80` (`#767474`) on pale-lavender = **3.86** (collection subtitle — BRM-01 didn't cover `/80`)
- `text-white/40` on the dark auth panel = **3.75** (sign-in / sign-up)

These are **not** fixable by darkening `--color-amber` (it would drop the focus-ring below 3:1 on dark) — they are a **design-surface decision**: lighten pale-lavender toward white (≈`#f2f0ee` clears amber + charcoal-soft), or define darker tokens for tinted/dark surfaces. They are Serious (not Critical), non-blocking, and belong to this ticket's coordinated muted-text pass — **owner/design call on the pale-lavender shade.**
