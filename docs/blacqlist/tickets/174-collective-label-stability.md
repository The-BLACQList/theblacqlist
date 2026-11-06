# 174: The Collective, labels that hold still

**Status:** Draft PR, waiting for the founder's merge word
**Follows:** tickets 171b and 173 (merged)
**Area:** `/flow-map` (The Collective)

## Why

The founder: "There are jittering labels at rest."

Measured on `main` at `1bbbf8c` against staging data (829 businesses), each floor picked from the gauge, left 7 seconds to settle, then sampled for 4 seconds with nothing touched:

| Floor | Desktop 1280x800 | Phone 375x667 |
|---|---|---|
| 0 | stable, 11 shown | stable, 3 |
| 1 | **75 text changes in 76 frames** | **240 show/hides in 241 frames** |
| 2 | **100 show/hides in 101 frames** | stable, 6 |
| 3 | stable, 4 | stable, 5 |
| 4 | stable, 0 shown | stable, 2 |

Positions did not move at rest, so this is an every-frame flip, not sub-pixel shimmer.

## Cause

- The pool was re-picked from scratch every frame and slots were filled by rank, so one change shifted every label after it.
- The overlap test measured the slot, not the label going into it. A hidden slot reads 0, so the 120px fallback fit. The label filled, measured wide, collided, hid, and the cycle repeated.
- `hidden` flipped in the same frame as `.on`, so fades never ran and labels popped.
- Only the anchor point was bounds-checked, so names clipped at the edges, and `translate(-50%)` landed on half pixels.

## What changes

- Each label element is bound to a business id, not a rank.
- A label on screen keeps its place. It leaves only when its dot drops below 0.8x the size floor, goes off screen, runs under a HUD panel, or collides with a bigger label on screen.
- A new label takes a free slot, or replaces one only at 1.25x its size after 300ms of winning.
- Labels are chosen about every 100ms while the camera moves. At rest nothing is written unless the camera, the selection or the HUD changed.
- Width is measured once on fill and cached by id. Labels sit on whole pixels, clamped to the stage, with a 1px dead band.
- Fades use opacity and a delayed `visibility`, so a label stays measurable when off.
- The label backdrop blur is gone, with a slightly more solid background in its place.
- Gap labels get the same treatment. Same caps as before: 10 desktop, 5 phone.

## Out of scope

- Camera easing (ticket 175) and the gauge following position (ticket 176).
- `isPhone` being read once. That goes with the phone stage.
- The Growers floor shows no dots or names on desktop, on main too. That is the camera framing, so it moves to ticket 175.
- Gap labels can still sit over a floor sign. They were never checked against signs. Look at this again with the phone stage.

## Verification

- `pnpm typecheck`, `pnpm lint` and `pnpm test:unit` pass. New tests in `tests/silo-layout.test.ts`: the oscillation regression, stability under 0.4px of noise, no slot cascade, caps honoured.
- Browser check on every floor at 1280x800 and 375x667: 0 text changes and 0 show/hides at rest.
- The same 0 at rest after a drag turn and with a dot picked.
- No two labels overlap on any floor, desktop or phone. A gap's box uses the same clamps as the label, and its height is measured even when no name label is showing.
