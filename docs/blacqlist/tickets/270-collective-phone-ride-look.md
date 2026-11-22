# Ticket 270: Ride the Tower Freely and Look Up or Down on a Phone

**Status:** Merged #400 (`135c9c4`), 2026-11-22. Founder checked it on iPhone.

Founder (2026-11-22, iPhone, full-screen map):

> "I don't like that on the phone it forces me to a certain level. I want to be able to move up and down freely. I don't feel like I'm ever level with a level. It also feels like I'm never up enough to really be on the shopper level. I also can't look down or up the tower on mobile. I can only move down and up the tower."

Founder picks:

- **Gestures:** one finger rides and turns; two fingers look up or down.
- **Scope:** phone only. Desktop stays as it is.

## Why It Felt That Way

- **It always landed on a floor:** a released swipe snapped to the nearest one (`swipeLanding`, 248).
- **Never level:** the camera circled a point on the middle line. It sat about 30 units above that point (three-quarters of the way to the next floor up) and pointed 40° down. The eye was never at a floor's height.
- **The shopper floor:** at the very top, the eye was above the glass lid, looking down on the Shopper floor instead of standing on it.
- **Looking:** two fingers could only tilt between 5° and 64° down, and only by circling the point. Looking up was not possible.

## What Changed (phone full-screen only)

- **Free riding:**
  - One finger up or down rides the tower.
  - On release it glides on and fades out (`rideCoast`, decay 4/s), stopping wherever it stops. It never pulls to a floor, and it stops dead at the top and bottom.
- **Eye height (`rideOrbit`):**
  - The eye rides 6 units above the height being ridden, so stopping on a floor stands on it. Floors are 40 apart.
  - At the top, that means standing on the Shopper floor.
  - The eye sits near the middle (40% of the page view's distance out). You stand in the centre surrounded by the floor, and looking down never lands on a dot right under you.
- **Looking (`lookTurn`, `clampPitch`):**
  - Two fingers sliding up or down look up or down. A whole screen height of slide is 180°.
  - Range: 75° up the tower to 80° down at the core.
  - The eye stays put; only the view tips.
  - On a picked business, two fingers still tilt the close-up as before.
- **Defaults:**
  - Entering full-screen glides down to eye height, looking 12° down across the floor.
  - Recenter and a floor from the rail reset the look to that level.
  - A floor from the rail rides to stand on that floor, facing its busiest wedge.
- **Rail:** it follows the height being ridden, not wherever the tipped view points.
- **Text:**
  - The hint now reads "Swipe to ride and turn. Two fingers to look up or down."
  - The screen-reader status line says the same.
- **Not changed:**
  - the page preview;
  - desktop (scroll to travel, drag to look);
  - picking a business, a gap or a ring;
  - pinch to zoom out to the whole tower.

## Checks (local, 2026-11-22)

Playwright with touch input (CDP), in full-screen:

| Check                               | Result                                                  |
| ----------------------------------- | ------------------------------------------------------- |
| 150 px swipe up, released           | stops at t 0.076, between floors (no snap)              |
| Rail: Shops                         | eye at 46, 6 above the Shops floor (40)                 |
| Two fingers up / down               | look 33° up / 80° down; eye height unchanged            |
| Swiping to the bottom / back to top | eye -108 beside the core / 85 on the Shopper floor (80) |
| Close full-screen                   | rises back to the page view                             |
| Sideways 844×390                    | rides and looks the same                                |
| Console errors                      | 0                                                       |

- **Local checks:** `tsc` clean, lint clean, vitest **5949 passed**.
- **Tests:**
  - `tests/silo-layout.test.ts`: eye height on every floor, looking without moving the eye, the range up and down, the two-finger direction, a glide that stops between floors, and dead stops at the ends.
  - `tests/flow-map-page.test.ts`: no `swipeLanding`; the ride, coast and look are wired; the new hint.

The local renderer is a software one, so the real feel needs the founder's iPhone.
