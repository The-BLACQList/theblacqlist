# Ticket 264: Stale e2e Fixes

**Status:** Merged #395 (`4a3f6ca`), 2026-11-21.

## Why

The founder (2026-11-21): "do the test fixes". Running the full local e2e suite during 251–262 turned up six failures outside the CI list. One was a real product bug. The others were tests that had fallen behind the site.

## What Changed

**Product fixes:**

- **Editor Save bar saw no changes in dev** (TA-11, TA-12). `ProfileSaveProvider` waits a frame before checking for changes. On unmount it cancelled that frame but kept the old frame id. In dev, React Strict Mode unmounts and remounts once, so every later check returned early and the bar stayed on "No changes to save". The cleanup now clears the id too. Production does not remount, so owners there were not affected. Developers and the e2e suite were.
- **Team "Owner" label on listing pages** (contrast scan 098). The label was amber 11px text on a 20% gold tint (4.39:1, under 4.5:1). It is now 14px on a 10% gold tint (about 4.8:1). The role line under a team member's name went from 12px to 14px, to meet the 14px minimum.

**Test fixes:**

- **TA-24** (save a listing): starts by unsaving the fixture if an earlier failed run left it saved. It also waits for the save request to finish before opening Saved, so the navigation can't cancel it.
- **Cross-browser C** (Add Business): /add-business now opens on "Have a Website or Link Page?". The test clicks "Skip, I'll Type It" to reach the welcome step.
- **Cross-browser D** (Claim): no change. The failure was a Turnstile wait timeout and it passes on a rerun.

## Tests

- No new unit test. The Save bar bug only shows in a browser with Strict Mode, and the unit tests run in Node. TA-11 and TA-12 are the guard.

## Verification

Local, 2026-11-21, against staging data:
- Unit tests: 5858 passed. Typecheck clean.
- Lint: no errors. The 2 warnings were already on main (SaveButton, save-icon-button).
- Playwright (owner-dashboard, account-surfaces, cross-browser, contrast), chromium: 38 passed, none needed a retry.

## Not in This Ticket

- Adding these specs to the CI e2e job. They need the staging fixtures and a slower dev server, so CI keeps its short list.
