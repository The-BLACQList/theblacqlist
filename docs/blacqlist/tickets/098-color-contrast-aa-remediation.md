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
