# Ticket 248: Phone Full-Screen for The Collective

**Status:** Merged #386 (`a09c599`), 2026-11-21. Live in prod.

Part of the Collective tighten-up (246–250). Founder pick (2026-11-21): on a phone, tap to go full-screen, and in full-screen the map owns every gesture.

## The Problem

On a phone the map sat in a 300svh scroll track. A swipe either scrolled the page or turned the map, never cleanly both. You couldn't tilt, there was no pinch, and the title row was crowded.

## What Changed

### In the Page: A Preview (`SiloExperience.tsx`, `SiloScene.tsx`, `silo.css`)

- On a phone-sized window (`COMPACT_QUERY`: upright under 760px wide, or landscape under 501px tall), the map is a preview:
  - It takes no gestures (`pointer-events: none` on the canvas), so a swipe always scrolls the page.
  - It turns slowly by itself, about one lap every 90 s (`PREVIEW_SPIN`). It waits for the opening glide, and it stops for reduced motion or paused motion.
  - The scroll track is off, so the page simply scrolls past the map.
  - Only the strip and More show. The rail, the card, the hint and the map tools wait for full-screen.
- A gold **Enter The Collective** button sits at the bottom centre.
- Desktop and tablet are unchanged: no button, and the scroll track still travels the floors.

### Full-Screen

- **Opening:** the button pushes a history entry (`{ siloFull: true }`), so the phone's **Back** closes full-screen instead of leaving the page.
- **Closing:** Back, **X** (Close Full Screen) or Escape. Focus returns to Enter The Collective, and the status reads "Full screen closed."
- **Layout:**
  - The map covers the whole window (`position: fixed`, `100dvh`), over the site header.
  - The page under it is locked (`html.silo-full-lock`).
  - The canvas has `touch-action: none`.
  - The section is a modal dialog while open.
- **Gestures** (in `Controls`):
  - one finger swipes up or down the floors, or sideways to turn (round 2);
  - two fingers moving together tilt;
  - two fingers pinch, with the same zoom range as 246's camera distance, from inside the tower out to the whole tower (`pinchZoom`, `PINCH`);
  - pinching out while a business is open lets go of it;
  - a tap still picks a dot, but not right after a pinch.
- **Controls:**
  - the floor rail keeps 44px targets;
  - More and X sit in the strip's corner;
  - Whole Tower, Recenter and Find Me move to the bottom-left, over the map and above the card, so the title row stays clear.
- **Bottom card:** unchanged.
- **Landscape:** the same mode, using the 179 layout. The rail is on the left, the card on the right, and the tools sit bottom-left beside the rail.
- **`?you=1` on a phone** opens full-screen once, so the reader's business card can show.

## Round 2: Founder iPhone Check (2026-11-21)

Founder on the #386 Preview: "I do see jumps and flickering as I maneuver. I can't seem to scroll up or down the levels in the iPhone view."

- **Swipe through the floors.**
  - The cause: a vertical swipe only tilted the camera, so only the rail could change floors.
  - Now in full-screen, one finger swiping up or down travels the floors: up goes down the tower, as a page scroll does, and two screens of swipe cover the whole tower.
  - On release the view settles on the nearest floor; a flick carries it at most half a floor further (`SWIPE`, `swipeTravel`, `swipeLanding`).
  - Sideways still turns.
  - Tilt moves to two fingers moving up or down together, alongside pinch.
- **Fewer jumps.**
  - Vertical swipes no longer tilt.
  - A sideways flick coasts at most 1.2 rad/s, down from 3. Before, a flick could keep spinning about 43° after you let go.
  - The track keeps the preview's height while full-screen is open, so the page underneath doesn't shift and you come back to the same spot.
- **Less flicker.** The full-screen canvas is now sized to `100lvh` (the tallest window, with Safari's bars away) instead of following `100dvh`. Safari's toolbar showing or hiding no longer resizes and blanks the canvas. The card's own scroll no longer chains to the page (`overscroll-behavior: contain`).
- **Hint text:** "Swipe up or down for floors. Pinch to see the whole tower."

Checked with the same Playwright touch script at 390, 360 and 844×390:

- one swipe up moves one floor, and one swipe down moves one back;
- the page stays where it was across Enter and Close;
- 0 console errors.

Flicker can only be confirmed on a real iPhone.

## Checks (local, 2026-11-21)

Playwright with real touch events (CDP) at 390×844, 360×740, 844×390, and desktop 1440:

| Check                   | Result                                                        |
| ----------------------- | ------------------------------------------------------------- |
| Swipe on the preview    | scrolls the page                                              |
| Enter                   | page locked, history +1, focus in the map                     |
| One-finger drag in full | turns the map; the page does not move                         |
| Pinch out               | reaches Whole Tower (button shows pressed)                    |
| Floor 3 on the rail     | goes to Suppliers                                             |
| Back, then X            | each closes; focus back on Enter; status "Full screen closed" |
| Title row               | clear of More and X at 360 and 390                            |
| Desktop                 | no Enter button; the scroll track still travels the floors    |
| Console errors          | 0                                                             |

Still to do on a real phone: frame rate in full-screen, and Safari's toolbar resizing with `100dvh`.

## Tests

- `tests/silo-layout.test.ts`: `pinchZoom` direction, clamp and no-gap guard; `PREVIEW_SPIN` between 60 and 120 s a lap.
- `tests/flow-map-page.test.ts`: Enter button, `pushState` and popstate, Close Full Screen, the compact-only guard, scroll lock, `touch-action: none`, the no-gesture preview.
