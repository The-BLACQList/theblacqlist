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

## J10 — VoiceOver: save action (direct, no modal)  ✅ READY

**Decision (ticket 097, 2026-06-26):** Save is a **direct one-tap action**, not a modal. The Save/♥ button toggles immediately (optimistic), announces the outcome via a polite `aria-live` region, and `aria-pressed` reflects state. Signed-out activation redirects to `/sign-in` (announced as a page change).

**Criterion:** The Save button's state + outcome are announced to VoiceOver; no focus is trapped (there is no dialog).

**Script (signed in):**
1. On a listing page, Tab to the **Save** button. Confirm it's announced ("Save this business, button", not pressed).
2. Activate it (VO + Space). Confirm VoiceOver announces **"Saved"** (the polite live region) and the button now reports **pressed** with label "Remove from saved businesses".
3. Activate again. Confirm **"Removed from saved"** is announced and the button returns to not-pressed.
4. Confirm focus **stays on the Save button** throughout (no dialog, no focus jump).

**Script (signed out):** Activate Save → confirm the browser navigates to `/sign-in` and VoiceOver announces the new page.

**Pass:** save/unsave announced via `aria-live`; `aria-pressed` toggles; signed-out → sign-in page announced.

---

## J11 — VoiceOver: search → listing → save flow

**Criterion:** Homepage → search → listing → save — all steps completable by keyboard + VoiceOver.

**Steps (keyboard + VoiceOver):**
1. From `/` (or `/discover`), **Tab** to the search field. Confirm it's announced ("Search businesses, search text field").
2. Type a query, press **Return**. Confirm the results page is announced and the result count/region is reachable ("Discovery results").
3. **Tab** to the first result link. Confirm the business name is announced as a link. Activate it (Return / VO + Space).
4. On the listing page, confirm the **heading (business name)** is announced and the main content is reachable.
5. **Save step:** Tab to the **Save** button ("Save this business, button"). Activate it → confirm **"Saved"** is announced (the `aria-live` region) and `aria-pressed` flips to pressed. (Signed out: activation navigates to sign-in, announced as a page change.) See J10.

**Pass:** Steps 1–5 fully completable by keyboard + VoiceOver, including the direct-save announcement.

> Automated coverage for the keyboard path: J7 (search → first result by keyboard) passes in `pnpm test:a11y`. This script adds the VoiceOver announcement verification.

---

## Related automated finding (J15) — RESOLVED

The **report-correction** dialog (`components/entity-page/ReportCorrectionForm.tsx`) previously had no focus trap, Escape, or focus restore. **Fixed** (ticket 096) by migrating it to the reusable Radix `Dialog` (`components/ui/dialog.tsx`); J15 now passes. The same `Dialog` primitive should be used if a Save modal is built for J10/J11 (ticket 097).
