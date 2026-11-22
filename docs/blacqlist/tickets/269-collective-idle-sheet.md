# Ticket 269: A Smaller Bottom Sheet on the Phone Map

**Status:** Built on `feat/269-collective-idle-sheet`, 2026-11-22. Not merged.

Founder (2026-11-22): "shrink the phone's map panel when idle." This follows 268, which found that the bottom sheet covers the part of the phone where a thumb rests.

## What Changed

- **Full-screen with nothing picked:** the sheet shows only the colour key, meaning the Show Kinds row and the family chips.
  - The eyebrow ("The Collective · Floor N of 5") and the "Where the Money Goes First" heading are hidden from sight. Screen readers still hear the heading, so the sheet keeps its name. The floor is already shown on the rail.
  - The tip line ("Pick a floor or a dot…") is gone in this state.
- **Picking anything brings back the full card:** a business, a floor, a gap, or Follow a Dollar. Clearing the pick (Esc or X) brings the key back.
- **Not changed:**
  - the page preview (no sheet there);
  - the sideways phone, where the card is a side panel and doesn't cover the thumb area;
  - desktop.
- **How it works:** the idle card is marked `ctx-idle` (`SiloPanels.tsx`), and the full-screen rules in `silo.css` do the rest. The dock tools and the hint already follow the sheet's measured height, so they drop down with it.

## Checks (local, 2026-11-22)

Playwright with touch input, in full-screen:

| Check                       | Before         | After                       |
| --------------------------- | -------------- | --------------------------- |
| Idle sheet height, 390×844  | 244 px         | 135 px                      |
| Screen that reaches the map | 64%            | 76% (71% at 360×740)        |
| Pick a floor                | full card      | full card (heading "Shops") |
| Esc after a pick            | full idle card | back to the key             |
| A family chip in the key    | filters        | still filters               |
| Sideways 844×390            | side panel     | unchanged                   |
| Console errors              | —              | 0                           |

- **Local checks:** `tsc` clean, lint clean, vitest **5946 passed**.
- **New test** in `tests/flow-map-page.test.ts`: the idle card is marked, the tip hides in full-screen, and the heading is visually hidden but never removed.

Docs: 267 and 268 flipped to Merged (#398 `bb76303`) in the index and on their ticket pages.
