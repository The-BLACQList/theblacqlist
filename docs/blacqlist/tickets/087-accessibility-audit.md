# Ticket 087: Accessibility audit and WCAG AA remediation — all MVP screens

## Status

Draft

## Phase

Phase 17: Security, QA, Accessibility, Launch

## Priority

P1

## Feature Area

Accessibility

---

## Context

WCAG AA compliance is a product requirement, not an afterthought. This ticket conducts a full accessibility audit across all MVP screens and produces a prioritized remediation list. The audit covers keyboard navigation, color contrast, screen reader announcements, focus management, and ARIA attribute correctness. At minimum, the five critical user flows must be tested with VoiceOver (macOS) or NVDA (Windows): (1) homepage → search → listing page, (2) sign-up → onboarding, (3) claim flow, (4) owner dashboard, (5) admin claims queue.

All Critical findings (navigation completely blocked for keyboard or screen reader users, missing form labels, inaccessible modals) must be remediated and re-tested before launch. High findings must be either remediated or documented with a resolution timeline.

Source documents: `docs/blacqlist/ux/mvp-screen-map.md` (37 MVP screens); `docs/blacqlist/design/design-brief.md`; all frontend tickets (015–083).

---

## User Story

As a user with a disability, I want to navigate, search, and interact with The BLACQList using only a keyboard or screen reader, so that the platform is accessible to me as it is to all users.

---

## Scope

**In scope:**

- Keyboard navigation audit on all 37 MVP screens: tab order logic, focus visibility, interactive element reachability via keyboard alone
- Color contrast check: all text and interactive elements against WCAG AA thresholds (4.5:1 body text, 3:1 large text and UI components)
- Screen reader testing (VoiceOver on macOS) for 5 critical flows listed above
- Form accessibility: every form input has an associated `<label>` (not placeholder-only); error messages are announced via `aria-live` or `role="alert"`; required field convention is consistent
- Modal and drawer focus management: focus traps correctly on open; returns to trigger on close; Escape key closes
- Dynamic content announcements: toast notifications, inline save/unsave state, search result count updates, multi-step form step changes
- Image alt text: all images have meaningful `alt` text; decorative images use `alt=""`
- Semantic HTML: use of `<nav>`, `<main>`, `<header>`, `<footer>`, `<section>`, `<article>`, `<button>` vs. `<div>` for interactive elements
- ARIA attribute correctness: `aria-label`, `aria-describedby`, `aria-expanded`, `aria-current="page"`, `role="alert"`, `aria-live` usage
- Heading hierarchy: logical `<h1>` → `<h2>` → `<h3>` structure on all pages; no skipped heading levels
- Remediation PRs: one PR per group of related findings (forms remediation, modal focus traps, color contrast fixes, heading structure) — do not batch all fixes into one massive PR

**Out of scope:**

- WCAG AAA conformance
- Cognitive accessibility guidelines (deferred)
- Screen reader testing with NVDA on Windows (VoiceOver on macOS is required; NVDA is desirable but not blocking for launch)
- Mobile screen reader testing with VoiceOver on iOS (deferred to V1)

---

## Dependencies

| Dependency                                              | Type                                | Status        |
| ------------------------------------------------------- | ----------------------------------- | ------------- |
| All frontend tickets (015 through 083)                  | Must be implemented before auditing | In Progress   |
| Staging environment with all screens accessible         | Infrastructure                      | Required      |
| VoiceOver on macOS (built-in)                           | Testing tool                        | Available     |
| Colour Contrast Analyser (free tool, paciellogroup.com) | Testing tool                        | Must download |
| axe DevTools browser extension                          | Testing tool                        | Must install  |

---

## UX Notes

**37 MVP screens to audit (grouped by area):**

**Public discovery:**

- Homepage
- Search results page (`/search`)
- City landing page (`/[city-slug]`)
- City-category landing page (`/[city-slug]/[category-slug]`)
- BLACQList Page (entity detail)
- Discover / browse page (`/discover`)

**Auth screens:**

- Sign-up (`/sign-up`)
- Sign-in (`/sign-in`)
- Forgot password (`/forgot-password`)
- Reset password (`/reset-password`)
- Verify email (`/verify-email`)
- Onboarding (`/onboarding`)

**Submit and claim:**

- Add Business form steps 1–7 (`/add-business`)
- Claim entry page (`/claim`)
- Claim form + doc upload (`/claim/[listing-id]`)
- Claim status (`/account/claims`)

**Account pages:**

- Saved listings (`/account/saved`)

**Owner dashboard:**

- Dashboard home (`/dashboard`)
- Page editor — hero/about (`/dashboard/page`)
- Page editor — hours (assumed Ticket 054)
- Page editor — gallery (assumed Ticket 055)
- Page editor — services (assumed Ticket 056)
- Page editor — links (assumed Ticket 057)
- Page editor — CTA (assumed Ticket 058)
- Analytics dashboard (`/dashboard/analytics`)

**Admin screens:**

- Admin listings table (`/admin/listings`)
- Admin listing detail/edit (`/admin/listings/[id]`)
- Admin claims queue (`/admin/claims`)
- Admin claim review (`/admin/claims/[id]`)
- Admin users table (`/admin/users`)
- Admin collections list (`/admin/collections`)
- Admin collection editor (`/admin/collections/[id]`)
- Admin categories (`/admin/categories`)
- Admin platform analytics (`/admin/analytics`)
- Admin search analytics (`/admin/analytics/search`)

**Static/utility:**

- 404 page
- For Business page (`/for-business`)
- About page (`/about`)
- Privacy Policy (`/privacy`)
- Terms of Service (`/terms`)

---

## Design Notes

**Color contrast pairs to verify (brand palette):**

| Text color                               | Background              | Required ratio   | Check       |
| ---------------------------------------- | ----------------------- | ---------------- | ----------- |
| `#000000` on `#FCFAF4` (Cream)           | Body text on cream bg   | 4.5:1            | Must pass   |
| `#000000` on `#E2A428` (Amber Gold)      | Text on primary buttons | 4.5:1            | Must pass   |
| `#FCFAF4` on `#000000` (Brand Black)     | White text on dark bg   | 4.5:1            | Must pass   |
| `#595758` (Charcoal) on `#FCFAF4`        | Body/secondary text     | 4.5:1            | Must verify |
| `#E2A428` on `#19191E` (Deep Background) | Gold on dark nav        | 3:1 (large text) | Must verify |

Any color pair that fails must be adjusted in the design tokens before the audit closes.

---

## Data Notes

No database changes in this ticket. Accessibility fixes are frontend-only. Exception: if an accessibility fix requires a semantic change to server-rendered HTML (e.g., adding a `<main>` landmark to a Server Component), the change goes in the relevant page component.

---

## API Notes

No API changes in this ticket.

---

## Implementation Notes

**Audit methodology:**

1. **Automated scan first:** Run the `axe` browser extension on each screen; export findings; categorize by severity
2. **Keyboard navigation test:** On each screen, disconnect the mouse and navigate using Tab, Shift+Tab, Enter, Space, Escape, and Arrow keys only. Every interactive element must be reachable. Focus ring must be visible.
3. **Color contrast:** Use Colour Contrast Analyser for all text on non-white backgrounds; check active and focus states of interactive elements
4. **Screen reader test (VoiceOver):** Enable VoiceOver (Cmd+F5 on macOS). Navigate each of the 5 critical flows using VoiceOver + keyboard only. Document every point where the experience breaks.
5. **Form audit:** For every form field on every form screen, verify: visible label, correct `for`/`id` association, error announced on invalid submission

**Remediation approach:**

- Create a separate PR for each category of fix to keep diffs reviewable
- Naming convention: `a11y/forms-label-fixes`, `a11y/focus-management`, `a11y/color-contrast`, `a11y/aria-live-regions`

**Files most likely to need changes:**

- `components/ui/` shadcn/ui component overrides — focus ring restoration, ARIA labels
- Form components across add-business, claim, page editor
- Modal and drawer components (save-button sign-in prompt, confirmation dialogs)
- Nav components (mobile nav drawer)
- Toast/notification components (aria-live regions)

**Common findings to proactively check:**

- shadcn/ui removes the default browser `outline` on focused elements — a custom focus ring must be added in global CSS
- `placeholder` text used as the only label on inputs (search bar, filter selects)
- `<button>` elements with only icon children and no `aria-label`
- Toast notifications added to the DOM without `aria-live="polite"` container

---

## Acceptance Criteria

- [ ] Automated axe scan produces zero Critical violations across all 37 screens
- [ ] All form inputs across all forms have an associated `<label>` (not placeholder-only)
- [ ] All modal dialogs trap focus correctly on open and return focus to trigger on close
- [ ] Escape key closes all modals, drawers, and popovers
- [ ] All form error messages are announced via `role="alert"` or `aria-live="assertive"`
- [ ] All toast notifications are in an `aria-live="polite"` region
- [ ] Color contrast checked for all brand color pairs listed above — all pass WCAG AA thresholds
- [ ] Every page has a logical `<h1>` and heading hierarchy without skipped levels
- [ ] All images have meaningful `alt` text; decorative images have `alt=""`
- [ ] The 5 critical flows are completable using VoiceOver + keyboard only with no blocking failures
- [ ] Navigation landmark regions (`<nav>`, `<main>`, `<header>`, `<footer>`) are present on all public pages
- [ ] Accessibility audit report written and committed to `docs/blacqlist/launch/accessibility-audit-report.md`
- [ ] All Critical findings remediated and re-tested
- [ ] All High findings remediated or documented with a resolution timeline

---

## Failure States

| Failure                                                 | Resolution                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Critical: form input missing label                      | Hotfix PR adding `<label>` with correct `htmlFor`; re-test with VoiceOver     |
| Critical: modal does not trap focus                     | Hotfix PR implementing focus trap utility (`focus-trap-react` or custom hook) |
| Critical: keyboard navigation skips interactive element | Hotfix PR correcting `tabIndex` and/or DOM order                              |
| High: color contrast failure                            | Design token adjustment; verify fix with Colour Contrast Analyser             |
| High: button without accessible name                    | Add `aria-label` attribute to the button component                            |

---

## Edge Cases

- The search results page updates dynamically as filters change — the results count update must be announced via `aria-live="polite"` (screen readers must announce "24 results for 'restaurant' in Atlanta" without requiring keyboard focus to move)
- Multi-step add-business form: each step transition must announce the new step to screen readers ("Step 2 of 7: Contact Information")
- The save button with optimistic UI: the state change ("Saved" / "Unsaved") must be announced via `aria-live` or by updating the button's accessible name

---

## Accessibility Notes

This ticket IS the accessibility audit. Accessibility notes apply to the screens being audited:

- [ ] All 37 screens must meet WCAG AA by the end of this ticket
- [ ] Keyboard navigation completable on all screens
- [ ] Screen reader completable on 5 critical flows
- [ ] Focus management correct in all modal and drawer components

---

## QA Test Cases

| #    | Scenario                                  | Role                        | Steps                                                                                    | Expected result                                                                                                                  |
| ---- | ----------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| QA-1 | Full keyboard navigation — BLACQList Page | Anonymous                   | Open a BLACQList Page; navigate using Tab only from top to bottom                        | All interactive elements reachable in logical order; focus ring visible on each; CTA button activatable with Enter               |
| QA-2 | VoiceOver — sign-up form                  | Anonymous                   | Enable VoiceOver; navigate to `/sign-up`; complete the form using VoiceOver and keyboard | Each field announced with its label; error messages announced on invalid submit; success state announced                         |
| QA-3 | Modal focus trap — save button            | Anonymous (on listing page) | Click Save (sign-in modal appears); navigate inside modal with Tab                       | Focus stays within the modal; Tab does not reach page content behind modal; Escape closes modal and returns focus to save button |
| QA-4 | Color contrast — CTA buttons              | Any                         | Measure `#000000` text on `#E2A428` background using Colour Contrast Analyser            | Ratio ≥ 4.5:1 — PASS                                                                                                             |
| QA-5 | axe scan — search page                    | Any                         | Run axe DevTools on `/search`; review results                                            | Zero Critical violations                                                                                                         |

---

## Security Notes

No security implications for this ticket. Accessibility improvements do not affect authentication or data access.

---

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
