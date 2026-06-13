# Ticket 096: Modal accessibility — focus trap, Escape, focus restore

## Status

Done (2026-06-07)

## Phase

Phase 17: Security, QA, Accessibility, Launch

## Priority

P1

## Feature Area

Accessibility

---

## Context

Automated accessibility test **J15** (modal focus traps) found that the **report-correction dialog** (`components/entity-page/ReportCorrectionForm.tsx`) was a hand-rolled `role="dialog"` with no focus management: focus did not move into the dialog on open, focus was not trapped, **Escape did not close it**, and focus was not returned to the trigger on close. This excludes keyboard and screen-reader users (WCAG 2.1.2 No Keyboard Trap / 2.4.3 Focus Order / 2.1.1 Keyboard).

The project already depends on `@radix-ui/react-dialog` (used by the mobile-nav Sheet), which provides focus trap, Escape-to-close, and focus restore for free. There was no reusable centered-dialog component — only `components/ui/sheet.tsx` (a side drawer).

A secondary finding: Radix `DialogContent` logged a console warning — *"Missing `Description` or `aria-describedby={undefined}` for {DialogContent}"* — on the mobile-nav Sheet, because no `SheetDescription` was provided.

Source: `docs/blacqlist/qa/mvp-test-plan.md` (J15), `e2e/keyboard-a11y.spec.ts`.

---

## User Story

As a keyboard or screen-reader user, when I open a modal I want focus to move into it, stay inside it while it's open, and return to where I was when I close it (including with the Escape key), so I can use dialogs without getting lost or trapped.

---

## Scope

**In scope:**

- Add a reusable Radix-based `components/ui/dialog.tsx` (Root, Trigger, Portal, Overlay, Content with built-in close button, Header, Title, Description, Close) — the standard for any centered modal going forward.
- Migrate `ReportCorrectionForm` from the custom `role="dialog"` to the new `Dialog` primitive (controlled open state preserved; `DialogTitle` wires `aria-labelledby`, `DialogDescription` wires `aria-describedby`; Cancel/Close use `DialogClose`).
- Add a screen-reader `SheetDescription` to the mobile-nav Sheet to clear the missing-description warning.

**Out of scope:**

- The Save modal (does not exist yet) — see ticket 097.
- Color-contrast remediation — see ticket 098.
- Migrating other surfaces; only the report-correction dialog had the gap.

---

## Acceptance Criteria

- [x] Opening the report-correction dialog moves focus into it.
- [x] Tab is trapped within the dialog while open.
- [x] Escape closes the dialog and focus returns to the "Report incorrect information" trigger.
- [x] Dialog has an accessible name (`aria-labelledby`) and description (`aria-describedby`).
- [x] Mobile-nav Sheet no longer logs the missing-description warning.
- [x] J15a (mobile nav) and J15b (report-correction) pass in `pnpm test:a11y`.
- [x] `tsc --noEmit` clean.

---

## Resolution

Fixed 2026-06-07.

- Added `components/ui/dialog.tsx` (Radix Dialog wrapper).
- Refactored `components/entity-page/ReportCorrectionForm.tsx` to use it.
- Added `SheetDescription` to `components/nav/mobile-nav.tsx`.
- `e2e/keyboard-a11y.spec.ts` J15b updated (removed the expected-failure annotation); J15a + J15b both pass.

Verify: `pnpm test:a11y` (tests 18–19) and manually open the report-correction dialog on any listing page, Tab around, press Escape.
