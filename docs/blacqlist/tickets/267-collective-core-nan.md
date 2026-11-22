# Ticket 267: No Black Hole or Flicker While Moving The Collective

**Status:** Merged #398 (`bb76303`), 2026-11-22. Founder checked it on desktop and iPhone.

Founder (2026-11-22, with a screenshot): "I get a big hole and flicker on desktop. Same problem on iPhone."

## The Problem

While the map moved, a large black rectangle opened over part of it, then closed again when the view came to rest. It was in the founder's screenshot and reproduced locally on an Apple M4 (Chromium, Metal).

- At 1532×874 @2x, dragging the map turned up to 805,489 pixels pure black.

## The Cause

The glowing core's shader (`SPHERE_FRAG`, added in 246) worked out its edge light as `pow(1.0 - max(dot(vN, vV), 0.0), 2.2)`.

- **How the NaN appears:** after interpolation a "unit" normal can be a hair long. That puts the dot product a hair over 1 and the base of `pow` a hair under 0. On Apple GPUs, `pow` of a negative number is NaN (not a number).
- **On desktop:** the glow (bloom) blurs the picture at several coarse sizes, so one NaN pixel spreads into a block hundreds of pixels wide, and NaN shows as black. The camera moving is what makes it come and go, which is the flicker.
- **How we know it's the core:** a NaN guard was patched into each shader group in turn, in the page only.
  - The core alone took the hole from 805,489 pixels to none.
  - Nodes, lines, the glass wall and the glow dots made no difference.

## What Changed (`components/flow-map/silo/SiloScene.tsx`)

- **Core and glass wall:** both shaders now normalize their vectors in the fragment shader (`safeNormalize`, with a length floor), and clamp the `pow` base to 0–1. The glass wall's rim light had the same risk.
- **NaN guard before the glow (desktop):** a small pass (`NAN_GUARD`) runs straight after the scene is drawn. It swaps any NaN or Inf pixel for the background before the glow sees it, so a future bad pixel stays one pixel instead of becoming a block.
- Nothing about the look changes.

## Checks (local, 2026-11-22)

Real GPU: Chromium with Metal on an Apple M4.

| Check                                                       | Before                 | After                                      |
| ----------------------------------------------------------- | ---------------------- | ------------------------------------------ |
| Desktop 1532×874 @2x, 16 drags + Whole Tower                | up to 805,489 black px | 1,414 (the HUD's own dark pixels; no hole) |
| Phone path (touch, no glow), 390×844 full-screen, 12 swipes | 0                      | 0                                          |
| Console errors                                              | —                      | 0                                          |

On the phone path this machine doesn't reproduce the bug either way. Its GPU works at full precision. An iPhone works at lower precision, which can put the NaN over a larger part of the core. The fix removes the NaN at its source on every device, but it still needs a look on a real iPhone.

## Tests

- `tests/flow-map-page.test.ts`:
  - every `pow` in the scene's shaders takes a clamped base;
  - `safeNormalize` has a length floor;
  - the NaN guard sits between the scene and the glow.
