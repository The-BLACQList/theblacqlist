# 175: The Collective, one smooth camera

**Status:** Draft PR, waiting for the founder's merge word
**Follows:** ticket 174
**Area:** `/flow-map` (The Collective)

## Why

The founder: "odd snapping orientations that should be fluid."

Read from `main` at `1bbbf8c`:

- Position and look eased at different rates (2.6 and 4), so a four-floor jump nodded the view about 13 degrees either way.
- The look point moved in a straight line through space, so big turns swung hard.
- Mouse tilt allowed 1.1 radians but the pole was about 0.43 away. The view stalled from about 58 to 135px of drag, then the heading whipped 180 degrees. This was the worst snap.
- Picking a floor zeroed the turn at once. A drag stopped dead on release. The three close-up framings all differed.
- Closing a floor card left the camera close in. The same dot couldn't be picked twice in a row after a scroll.
- The Growers floor looked empty on desktop. Every floor view faced the same way, and that floor's only dots sat behind the camera. The dots it did face landed on the top edge of the frame.

## What changes

- One orbit rig: a point to look at, a heading, a tilt and a distance. The default view is already an orbit, so its line of sight doesn't change.
- One critically damped smoother per value, so every move is one curve. The heading eases the short way round. A jump takes longer than a scroll step.
- Tilt stops at 5 and 78 degrees, so there is no pole.
- One `focusFrame` replaces the three close-up framings.
- Picking a floor turns to its busiest wedge and tilts to 38 degrees, so the floor's dots are in frame.
- A drag carries on a little after release.
- Reduced motion goes straight to the goal, with no carry.
- Closing a floor card returns the view. Tapping the picked dot again after a scroll frames it again.

**Feel change for the founder to check:** tilting now circles the view around what you're looking at, rather than turning your head.

## Out of scope

- The gauge following position (ticket 176).
- The scroll model, the touch path and the phone stage. Those wait for the workshop.

## Verification

- `pnpm typecheck`, `pnpm lint` and `pnpm test:unit` pass. New tests in `tests/silo-layout.test.ts`: the short way round, the smoother settling without overshoot, the default view holding its old numbers, the tilt limits.
- Browser check at 1280x800 and 375x667: camera position sampled through a four-floor jump and a long drag, with no step in heading or tilt. Every floor with dots shows dots. Labels still write nothing at rest.
