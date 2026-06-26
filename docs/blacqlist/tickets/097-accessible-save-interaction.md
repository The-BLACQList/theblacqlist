# Ticket 097: Accessible save interaction (unblocks VoiceOver tests J10, J11)

## Status

Draft — needs product/UX decision before build

## Phase

Phase 17: Security, QA, Accessibility, Launch

## Priority

P2

## Feature Area

Accessibility / Saves

---

## Context

Accessibility tests **J10** (VoiceOver — save modal) and **J11** (VoiceOver — search → listing → save flow) reference a **"save modal"** that does not exist. Today, saving a listing is a **direct action**: the Save/♥ button (`components/entity-page/SaveButton.tsx`, `components/ui/save-icon-button.tsx`) calls `POST /api/saves` with optimistic UI, and when the user is signed out it redirects to `/sign-in?next=…&action=save&listing_id=…`. There is no dialog.

This is a **product/UX decision, not a pure bug**: a one-tap save is arguably better UX than a modal, and the data-collection UX rules favor the fastest input path. So J10/J11 as written cannot pass until either (a) a save-confirmation modal is introduced, or (b) the tests are rewritten to assert the actual direct-save interaction. This ticket exists to make that decision explicitly rather than silently leaving two P1 tests "Not Run."

The keyboard portion of J11 (homepage → search → listing) is already verified by automated test **J7**; only the "save modal" portion is blocked.

Source: `docs/blacqlist/qa/voiceover-manual-test-scripts.md` (J10, J11), `docs/blacqlist/qa/mvp-test-plan.md`.

---

## User Story

As a screen-reader user, when I save a business I want the result clearly announced and (if a dialog is used) focus managed correctly, so I always know whether the save succeeded and where my focus is.

---

## Decision required (pick one)

1. **Keep direct save, update the tests** (recommended if the one-tap UX stays). No modal. Ensure the Save button announces state changes accessibly: `aria-pressed` toggles (already present), and a polite `aria-live` confirmation ("Saved" / "Removed"). Rewrite J10/J11 to verify the direct interaction + announcement instead of a modal.
2. **Introduce a save-confirmation / save-to-collection modal.** Build it with the new `components/ui/dialog.tsx` (ticket 096) so focus trap + Escape + focus restore come for free. Then J10/J11 can be run as written.

---

## Scope (once decided)

**If option 1 (direct save):**
- Add an `aria-live="polite"` region that announces save/unsave result on the listing page.
- Confirm signed-out redirect is announced as a page change.
- Update `e2e/` to cover the direct-save announcement; rewrite the J10/J11 manual scripts accordingly.

**If option 2 (modal):**
- Design the modal contents (confirm save, or pick a collection).
- Build with `Dialog` from ticket 096; reflect state in an `aria-live` region.
- Run J10/J11 manual VoiceOver scripts.

**Out of scope:** Collections management (separate feature, tickets 059–062).

---

## Acceptance Criteria

- [ ] Product decision recorded (direct save vs. modal).
- [ ] Save result is announced to screen readers (`aria-live`).
- [ ] If a modal is used: focus trap, Escape, and focus restore verified (reuse ticket 096 patterns).
- [ ] J10 and J11 either pass as written (modal) or are rewritten to match the shipped interaction and pass.
- [ ] VoiceOver manual scripts updated to match.

---

## Notes

Blocked on the product decision above. Until resolved, J10 and J11 remain **Blocked** in the test tracker (not "Fail" — the feature they describe is undefined, not broken).
