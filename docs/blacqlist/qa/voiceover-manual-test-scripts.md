# VoiceOver Manual Test Scripts — J9, J10, J11

**Audience:** QA / anyone verifying screen-reader behavior on macOS.
**Why manual:** "Is it announced correctly" cannot be asserted by Playwright — it requires a real screen reader. The keyboard/focus/label parts of these flows are already covered by the automated suite (`pnpm test:a11y`); these scripts cover only the *announcement* behavior.
**Last updated:** 2026-06-07

---

## Setup (do this once)

1. Start the app: local Supabase running, then `pnpm dev` → open `http://localhost:3000` in **Safari** (best VoiceOver support).
2. Turn VoiceOver on/off: **⌘ + F5** (or triple-press Touch ID). You'll hear "VoiceOver on."
3. Core VoiceOver keys (VO = **Control + Option**):
   - **VO + A** — read from current position
   - **Tab / Shift+Tab** — move between form controls and links
   - **VO + → / VO + ←** — move through every element
   - **VO + Space** — activate the focused control
   - **Control** — stop speech
4. Turn VoiceOver **off when done** (⌘ + F5). Run with headphones to avoid disrupting others.

Record each test as **Pass / Fail** with a note on what was (or wasn't) announced.

---

## J9 — VoiceOver: sign-up form

**Route:** `/sign-up`
**Criterion:** All fields announced with their labels; validation errors announced on invalid submit.

**Steps:**
1. Navigate to `/sign-up`. Press **VO + A** to hear the page heading.
2. Press **Tab** to move to the first field. Confirm VoiceOver announces the **field's label and type** (e.g., "Email address, edit text" / "Password, secure edit text").
3. Tab through **every** field (email, password, any role selectors/checkboxes). Each must be announced with a meaningful name — not "edit text, blank" or "unlabeled."
4. For checkboxes/role options: confirm state is announced ("checked" / "unchecked").
5. Without filling required fields, activate **Submit** (VO + Space).
6. Confirm the validation error is **announced automatically** (the form uses `role="alert"` on errors — VoiceOver should read the error without you navigating to it). Confirm the error is also tied to its field (focus/announcement points you to the bad field).

**Pass:** Every field announced with its label; error(s) announced on invalid submit.
**Fail:** Any field announced without a name; errors silent or unreachable.

> Automated pre-check already passing: J4 (axe scan, 0 Critical) and J14 (every input has an associated label). This script verifies the *spoken* experience on top of that.

### Sign-in form — "Forgot password?" focus order (fixed 2026-06-07)

J9 manual testing found the **"Forgot password?"** link on `/sign-in` was being skipped: it sat between the password label and the password input, so tab order was `email → forgot-password → password`, and it had no visible focus ring. **Fixed** — the link now sits **below** the password field, giving logical order `email → password → show/hide → forgot-password → submit`, with a visible focus ring. Covered by the automated test **J9 — sign-in forgot-password link is in logical focus order** in `e2e/keyboard-a11y.spec.ts`. When VoiceOver-testing `/sign-in`, confirm the link is announced in that order.

---

## J10 — VoiceOver: save modal  🚫 BLOCKED (feature not built)

**Criterion (target):** Focus trapped in modal; Escape returns focus to the Save button; modal title + contents announced.

**Current state:** **There is no Save modal.** Saving a listing (the Save/♥ button on a listing page) performs a direct API call and, when signed out, redirects to `/sign-in`. There is no dialog to trap focus in. **This test cannot be run until a Save modal/dialog is implemented.**

**When the Save modal is built, run this script:**
1. On a listing page, Tab to the **Save** button; note where focus is.
2. Activate it (VO + Space) to open the modal.
3. Confirm focus **moves into the modal** and the **modal title is announced**.
4. Tab through the modal — confirm focus **stays inside** (does not reach page content behind it).
5. Press **Escape** — confirm the modal closes and focus **returns to the Save button** (VoiceOver re-announces "Save…").

**Recommendation:** build the modal with Radix Dialog (already a dependency, used by the mobile-nav Sheet) so focus trap + Escape + focus restore come for free — see the J15 finding below.

---

## J11 — VoiceOver: search → listing → save flow

**Criterion:** Homepage → search → listing → save modal — all steps completable by keyboard + VoiceOver.

**Steps (keyboard + VoiceOver):**
1. From `/` (or `/discover`), **Tab** to the search field. Confirm it's announced ("Search businesses, search text field").
2. Type a query, press **Return**. Confirm the results page is announced and the result count/region is reachable ("Discovery results").
3. **Tab** to the first result link. Confirm the business name is announced as a link. Activate it (Return / VO + Space).
4. On the listing page, confirm the **heading (business name)** is announced and the main content is reachable.
5. **Save step:** 🚫 **BLOCKED** — see J10. The save action has no modal yet. For now, verify only that the **Save button is reachable and announced** ("Save this business, button"); activating it while signed out should navigate to sign-in (announced as a page change).

**Pass (partial, current):** Steps 1–4 fully completable by keyboard + VoiceOver; Save button reachable/announced.
**Blocked:** The "save modal" portion of step 5 — pending the Save modal feature.

> Automated coverage for the keyboard path: J7 (search → first result by keyboard) passes in `pnpm test:a11y`. This script adds the VoiceOver announcement verification.

---

## Related automated finding (J15) — RESOLVED

The **report-correction** dialog (`components/entity-page/ReportCorrectionForm.tsx`) previously had no focus trap, Escape, or focus restore. **Fixed** (ticket 096) by migrating it to the reusable Radix `Dialog` (`components/ui/dialog.tsx`); J15 now passes. The same `Dialog` primitive should be used if a Save modal is built for J10/J11 (ticket 097).
