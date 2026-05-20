# MVP Accessibility Review — The BLACQList

**Date:** 2026-05-11
**Status:** Draft
**Standard:** WCAG 2.1 AA
**Reviewer:** QA Pass (static code audit — browser testing required for full compliance)
**Scope:** All user-facing pages and flows

---

## Summary

The BLACQList uses Tailwind CSS and shadcn/ui, which provide strong accessibility defaults for standard components (Buttons, Dialogs, Forms). The main risks are: icon-only buttons without `aria-label`, empty states that may render blank rather than descriptive, form error announcements, and dashboard data tables lacking proper caption and summary attributes. Full browser-based testing is required before launch — static code audit flags risk areas but cannot replace live keyboard and screen reader testing.

---

## AR-01 — Keyboard Navigation

**Status: REQUIRES BROWSER TESTING**

### What to test

Tab through every interactive flow and confirm:
- Every interactive element (links, buttons, form inputs, selects, toggles) is reachable with Tab
- Tab order matches visual reading order (top-left to bottom-right)
- No focus trap exists outside of intentional modal dialogs
- No element is skipped due to `tabindex="-1"` without a reason

### Critical paths to keyboard-test:

| Flow | Priority |
|---|---|
| Sign-up and sign-in forms | P1 |
| Add Business form (all 7 steps) | P1 |
| Claim form | P1 |
| Owner dashboard page editor (all tabs/sections) | P1 |
| Admin claims queue — approve/reject actions | P1 |
| Receipt submission form | P2 |
| Search and filter on discover page | P2 |
| Gallery image management | P2 |

### Known risk areas from static audit:

- **Save/unsave toggle:** If implemented as a `<div onClick>` rather than `<button>`, it is not keyboard accessible. Verify it renders as `<button>`.
- **Share button:** Same concern — must be `<button>` with `aria-label="Share [business name]"`.
- **Admin table row actions:** Kebab menus or inline action buttons in data tables must be focusable and operable via keyboard.
- **Dashboard sidebar nav:** Links should be standard `<a>` elements (rendered via `next/link`) — these are keyboard-accessible by default.

---

## AR-02 — Heading Structure

**Status: REQUIRES BROWSER TESTING**

### Expected structure

Each page should have exactly one `<h1>`. Subsections should use `<h2>`, sub-subsections `<h3>`, with no levels skipped.

### Page-by-page expectations:

| Page | Expected h1 | Risk |
|---|---|---|
| Homepage | "BLACQList" or hero headline | Verify not an image |
| Business detail page | Business name | Currently mock data — heading may be hardcoded |
| Search results | "Find Black Businesses" or "Results for..." | Verify h1 changes with query |
| Owner dashboard overview | "My Business" or listing name | Check layout.tsx h1 vs page.tsx h1 collision |
| AI Suggestions page | "AI Suggestions" | Low risk — verified in page source |
| Admin panel pages | "AI Tools", "Claims", etc. | Check for h1 in layout vs page collision |

### Risk: layout/page h1 collision
In Next.js App Router, `layout.tsx` wraps `page.tsx`. If both render an `<h1>`, the page will have two — a WCAG failure. Audit: verify `layout.tsx` files use `<p>` or no heading for the sidebar/nav area, and `<h1>` lives only in `page.tsx`.

---

## AR-03 — Form Labels and ARIA

**Status: MIXED — shadcn/ui forms are correct; custom forms need verification**

### Findings

**shadcn/ui FormLabel pattern (correct):**
shadcn/ui `FormLabel` renders a `<label>` with `htmlFor` matching the input `id` automatically. All standard dashboard forms using `FormField` + `FormLabel` + `FormControl` should be compliant.

**Custom elements to verify:**

| Element | Risk | Action required |
|---|---|---|
| Search bar on homepage/discover | If using `<input>` without visible label | Add `aria-label="Search businesses"` or `<label>` |
| Filter dropdowns on discover page | If label is visual-only (icon) | Add `aria-label` to select element |
| Save button (heart/bookmark icon only) | No visible text label | **Must have `aria-label="Save [business name]"` and `aria-pressed` state** |
| Share button (icon only) | No visible text | **Must have `aria-label="Share [business name]"`** |
| Gallery delete/reorder icons | Icon-only buttons | Each must have `aria-label` describing action |
| Business hours toggle (open/closed) | Toggle switch | Must have `aria-checked` or use shadcn/ui Switch with label |
| Admin action buttons in tables | Icon or short-label buttons | Verify accessible names |

### Form error announcements:
shadcn/ui `FormMessage` renders with `role="alert"` automatically — errors are announced by screen readers on submission. Verify this is not overridden in custom form implementations.

---

## AR-04 — Focus States

**Status: REQUIRES BROWSER TESTING**

### Requirements

- All interactive elements must show a visible focus indicator when focused via keyboard
- Focus ring must not be suppressed with `outline: none` or `outline: 0` without a replacement

### Risk areas:

| Area | Risk |
|---|---|
| Custom button styles | Tailwind `focus:ring-*` classes must be present |
| Link elements in nav | Verify focus ring visible on `DashboardSidebar`, `AdminSidebar`, and public header links |
| Form inputs | shadcn/ui inputs include focus ring by default — verify not overridden |
| Modal/dialog close button | Must have visible focus ring |
| Dropdown menus | Must show focus when opened via keyboard |

### What to check in browser:
Tab through every page. Any element that loses its focus outline is a WCAG 2.1 AA failure. Do not suppress focus for aesthetic reasons.

---

## AR-05 — Color Contrast

**Status: REVIEW REQUIRED**

### BLACQList brand colors (from PRD/design system):

| Color use | Risk |
|---|---|
| `text-charcoal/40` on white | 40% opacity of charcoal — likely below 4.5:1 for small text |
| `text-charcoal/50` on white | 50% opacity — borderline; may fail for `text-xs` |
| `text-charcoal/60` on white | 60% opacity — likely passes for body text, fails for small text |
| Status badges (amber, green, red on light bg) | `bg-amber-100 text-amber-700` — verify 4.5:1 |
| `text-white/60` on dark sidebar | 60% opacity white on brand-black — may fail |
| Score badge colors on pale-lavender | Verify contrast of red/amber/green text on tinted bg |

### Action required:
Use Figma, browser DevTools contrast checker, or https://webaim.org/resources/contrastchecker/ to verify:
1. All body text (`font-body text-sm`) passes 4.5:1 on its background
2. All `text-xs` and smaller text passes 4.5:1
3. All icon-only indicators have a non-color alternative (text or shape)
4. Dashboard stat cards: gray secondary text must pass contrast

### Specific failures to check:
- `text-charcoal/40` used for hint text in the AI checklist: if `charcoal` is `#2D2D2D` at 40% on white, the effective color is ~`#BDBDBD` — this **fails** WCAG AA (contrast ratio ~1.6:1). Hint text must be at minimum `text-charcoal/50` or use a fixed hex value that passes.

---

## AR-06 — Mobile Tap Targets

**Status: REVIEW REQUIRED**

### Requirements
- Minimum 44×44px for all interactive elements (WCAG 2.5.5)
- Primary actions (submit, save, CTA) should be ≥48px height on mobile

### Risk areas:

| Element | Risk |
|---|---|
| Icon buttons (Save, Share, Delete) | Small icons may have hit area < 44px |
| Navigation links in mobile nav | Verify `py-2.5` + icon is ≥ 44px height |
| Admin table action buttons | Inline action buttons in dense tables |
| Form step navigation (Previous/Next) | Ensure full-width or explicitly sized |
| Review submission star rating | If stars < 44px each, tapping is imprecise |

### How to test:
In Chrome DevTools, open Mobile mode at 375px. Use the device toolbar to simulate touch. Tap each interactive element and verify the hit area is large enough.

---

## AR-07 — Form Error Messages

**Status: PASS for shadcn/ui forms; REQUIRES VERIFICATION for custom components**

### Findings

**Pass:** shadcn/ui `FormMessage` renders with `aria-live="polite"` or `role="alert"` — error messages are announced to screen readers on blur and on submit.

**Verify for custom components:**

| Component | Risk |
|---|---|
| Search bar validation (if any) | Does it use `aria-live` or `role="alert"` for error text? |
| File upload errors | Drag-and-drop upload components often miss error announcement |
| Toast notifications | shadcn/ui Toast uses `role="status"` — verify toast content is descriptive |
| Inline confirmation dialogs | Verify focus moves to dialog on open |

### Required for all error states:
- Error text must be associated with the input via `aria-describedby` or rendered as `FormMessage` below the field
- Errors must not disappear on next keystroke without re-validating
- Field must have `aria-invalid="true"` when in error state (shadcn/ui handles this automatically)

---

## AR-08 — Empty States

**Status: PASS for most; REVIEW for dynamic lists**

### Requirements
- Every list, table, or feed must have a defined empty state
- Empty state must have: heading, explanation, and a clear action
- Empty state must not be a blank screen or just "No results"

### Review per component:

| Component | Expected empty state | Status |
|---|---|---|
| Owner dashboard saved list | "No saved businesses yet" + CTA | Verify |
| AI Suggestions → suggestions list | "AI copy suggestions coming in V2" (verified in code) | Pass |
| Admin claims queue | "No pending claims" + explanation | Verify |
| Admin receipts queue | "No pending receipts" | Verify |
| Collections list | "No collections yet" + admin CTA | Verify |
| Services manager | "No services added yet" + Add button | Verify |
| Gallery manager | "No images yet" + Upload button | Verify |
| Analytics (no data) | "No analytics yet — share your page to get started" | Verify |

### Screen reader requirement:
Empty state `<p>` or `<div>` must have text content — not just an icon with no alt text. Decorative empty-state illustrations use `aria-hidden="true"`.

---

## AR-09 — Screen Reader Notes

**Status: REQUIRES LIVE TESTING**

### Recommended test flow (VoiceOver on macOS):
1. Load homepage with VoiceOver on — read the page from top to bottom
2. Navigate by headings (VO + Command + H) — verify hierarchy is correct
3. Navigate by landmarks (VO + Command + L) — verify `<main>`, `<nav>`, `<header>`, `<footer>` are present
4. Tab through sign-up form — verify all labels are announced, errors are announced
5. Navigate to a business page — verify business name is the first heading, sections are labeled
6. Tab through owner dashboard — verify sidebar nav announces current page

### High-risk areas for screen reader:
- **Status badges** (pending/approved/applied): text content is announced — no risk
- **Star rating display on reviews:** If stars are SVG/icons only, they need `aria-label="4 out of 5 stars"` on the container
- **AI checklist pass/fail icons:** `<CheckCircle2>` and `<XCircle>` use `aria-hidden="true"` (verified in page source) — text label beside icon carries meaning — Pass
- **Score badge:** Text reads "75 / 100 Strong" — announced correctly
- **Dashboard stat cards:** Number + label in separate elements — announce correctly with heading
- **Image gallery:** Each `<img>` must have descriptive `alt` text (not file names)

### ARIA landmark requirements:
Each page must have:
- `<header>` — site header/nav
- `<main>` — primary content
- `<nav aria-label="...">` — for each navigation region (public nav, dashboard sidebar, admin sidebar)
- `<footer>` — site footer (on public pages)

Verify: `AdminSidebar` uses `<aside>` (confirmed) with `<nav aria-label="Admin navigation">` (confirmed). `DashboardSidebar` — verify same pattern.

---

## Accessibility Fix Priority

| Priority | Issue | Required Before |
|---|---|---|
| P1 | `text-charcoal/40` hint text contrast — likely fails 4.5:1 | Launch |
| P1 | Save/Share icon-only buttons — must have `aria-label` | Launch |
| P1 | `text-white/60` on dark sidebar — verify contrast | Launch |
| P1 | Search input — must have `aria-label` or visible label | Launch |
| P2 | Full keyboard navigation test on all P1 flows | Launch |
| P2 | Mobile tap target audit at 375px | Launch |
| P2 | Star rating aria-label on review display | Launch |
| P2 | Image gallery alt text for all uploaded images | Launch |
| P3 | Screen reader full flow test (VoiceOver or NVDA) | Pre-launch |
| P3 | Filter dropdown labels on discover page | Post-launch |
