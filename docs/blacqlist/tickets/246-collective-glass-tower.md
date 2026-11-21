# Ticket 246: The Collective Becomes a Glass Tower

**Status:** Built on `feat/246-collective-glass-tower` (stacked on 250), 2026-11-21. Not merged.

Part of the Collective tighten-up (246–250). Founder pick, 2026-11-21: **Glass Tower**, chosen from the sketch, because "I can still sit in the center surrounded" and still see the category groupings. Founder add-on: "I would also like to be able to zoom out and see the full tower."

## Why

The founder said the map looked low-budget. The specific complaints were:

- the wireframe ball and the cage;
- floors that were hard to tell apart;
- level labels floating in space;
- businesses packed too close together.

## What Stayed (Founder: "Keep Everything Else")

- Category colours and the family wedges, every family.
- Pink gap squares and their labels.
- The camera inside the tower and the scroll-to-travel movement.
- The round dot discs that hold icons and logos.
- The legend, gauge, card, ticker, pulses, business labels and the "You" tag.

## What Changed

**Look** (`components/flow-map/silo/SiloScene.tsx`)

- The cage is gone. In its place:
  - **`GlassTower`**: a near-clear glass wall with a soft band of light at each floor and a brighter edge;
  - one **glass plate per floor**, with a faint fill, a lit rim and fine grain.
- The plate tints run light gold at the top to warmer lower down.
- The floor the camera is on is lit fully; the others sit at about 40%. From outside, every floor is evened out.
- The wireframe ball is gone. In its place:
  - **`Core`**: a smooth gold sphere with a soft halo and a slow breathe, kept **subtle on purpose** (founder 2026-11-21: "don't make the glowing ball too bright. subtle but noticeable");
  - a thin light column from the core up through every floor.
- **Bloom** on desktop only, using three's own `EffectComposer` + `UnrealBloomPass`, so no new package. Phones keep the baked glow sprites.
  - The composer's render pass clears with the screen-space colour, which lifted black to brown. `BG_FOR_COMPOSER` corrects that, so the background stays the page's near-black.
- Cluster rings now lie flat on the plate. Each is stretched along the wall like its cluster.
- Scene gold is now brand gold `#c4a065` in both the scene (`GOLD`) and the HUD (`--gold` in `silo.css`). Light gold `#ffd867` is kept for highlights.

**Levels**

- The floating floor signs are gone (`SIGN_AT`, `signsRef`, `.silo-sign`). There are no labels in 3D.
- Level names live only in the gauge or rail, which already marks the current floor (Calm Map rule, ticket 244).

**Spacing** (`lib/spend/silo-layout.ts`)

|                            | Before         | After                                                                                        |
| -------------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| Tower radius               | 16             | 42                                                                                           |
| Ring the businesses sit on | 15.2           | 30                                                                                           |
| Floor gap                  | 17             | 36                                                                                           |
| Clusters                   | thick 3D slabs | flat on their plate (`DOT_LIFT`), 1.3x wider along the wall (`CLUSTER_WIDE`), radius up to 9 |

- The core sits 28 below the last floor.
- Dot sizes, gap squares, pulses, dash lengths and fog are scaled to match.
- Every dot keeps a fixed spot: the hash seed is unchanged.

**Camera**

- The default view sits lower, at about 40° instead of near top-down, so floors read as layers.
- The orbit rig, drag-to-turn and scroll-to-travel are unchanged.

**Zoom Out to the Whole Tower**

- `ZOOM`, `zoomOrbit`, `zoomAmount` and `fogForZoom` in `silo-layout.ts`. The zoom runs from slightly closer than the default (−0.4), through the default (0), out to the whole tower from outside (1).
- Ways to zoom on desktop:
  - **Whole Tower** / **Go Inside** button in the dock;
  - the **W** key (T is already List or Map);
  - **trackpad pinch or ctrl + wheel**. A plain wheel still scrolls between floors.
- Fog thins as the camera backs out, so the whole tower reads clearly.
- On phones the whole-tower view backs further out and looks a little lower, so the tower fits above the sheet.
- These actions bring you back inside:
  - picking a floor, a dot or a gap;
  - the arrow keys;
  - scrolling to another floor.
- The key map lists **W** and **Pinch**.

## Tests

- `tests/silo-layout.test.ts`:
  - dots sit just above their own plate and inside the tower;
  - clusters stay clear of the core column and of neighbouring wedges;
  - few overlapping dots in a busy cluster;
  - the camera stays inside the tower at every scroll position;
  - floors switch halfway between them;
  - zoom: none at 0; whole tower in frame at 1; distance only grows as the zoom grows; closer below 0; `zoomAmount` and fog both ways.
- Results: full vitest 5,505 passed, tsc clean, eslint clean.

## Checked

- Local dev against staging data, headless Chromium (software WebGL), at desktop 1440×900, phone 390×844 and sideways 844×390.
- Views checked:
  - top floor;
  - floor picks;
  - whole tower and back inside;
  - the phone whole-tower view.
- No shader or console errors.

## Still To Do Before Merge

- Founder look on Preview.
- Frame rate on a real phone, since the plates and wall add fill.
- Bloom frame rate on a mid-range laptop.
- 247 (cinematic page, intro, Recenter) and 248 (phone full-screen with pinch to the whole tower) build on this.
