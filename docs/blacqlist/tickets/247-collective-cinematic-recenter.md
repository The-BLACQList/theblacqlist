# Ticket 247: The Collective Goes Cinematic, With Recenter

**Status:** Merged #383, 2026-11-21.

Part of the Collective tighten-up (246–250). Founder brief: the light band above the map made the page look cheap, and there was no clear way to get back to where you started.

## What Changed

### The Page Is Dark End to End (`app/(public)/flow-map/page.tsx`)

- The lavender hero and its Beta pill are gone. The map starts right under the site header.
- The headline ("$X spent with businesses on the list", or "Where Does Our Money Go?" before any spend) stays in the page as a screen-reader `h1`, for readers and search. Sighted readers see it as the opening title.
- The load-failed state is now a dark card.
- Under the map, a dark **How It Works** band holds the three steps, the privacy line, the button, and, for a member with receipts, "$X counted so far · My receipts".

### The First Look Pieces (`components/flow-map/CollectiveFirstLook.tsx`)

Ticket 161's first look is split into dark pieces the page places itself:

| Piece                  | Where it shows                                             |
| ---------------------- | ---------------------------------------------------------- |
| `FirstLookButton`      | the opening title, the HUD under the description, the band |
| `FirstLookSteps`       | the band (in a row) and the More sheet (stacked)           |
| `CollectiveHowItWorks` | the band under the map                                     |

- The button picks itself as before: Sign In to Add a Receipt, Add Your First Receipt, or Add a Receipt.
- The step wording is unchanged, so it still matches the My receipts empty state (ticket 164).

### The Opening (`SiloExperience.tsx`, `SiloScene.tsx`, `silo.css`)

- The camera starts at the whole tower and glides down inside to the top floor.
- Over it, "THE COLLECTIVE" (Jost light, widely tracked, gold), the headline, and the button fade in, hold, then fade out as the HUD comes in.
- Timing lives in `INTRO` (`lib/spend/silo-layout.ts`):
  - **wait:** the title holds until the scene has drawn, so it never plays over a black frame on a slow load. The cap is `waitMs` (1.5 s), after which it plays anyway;
  - **play:** `endMs` (3.2 s) from the scene's first frames;
  - **skip:** any click, wheel, key or page scroll fades it out in 320 ms.
- `introPlays` decides once. It does not play:
  - with reduced motion (the end frame shows; the CSS also hides the layer);
  - on a reload partway down the page;
  - for `?you=1`, which opens on the reader's business.
- The title layer is `aria-hidden` and `inert`. The real heading is the `h1`, and the button is also in the HUD.
- Scene labels (gap labels and business names) hold back with the HUD, so nothing crosses the title.
- If the script never moves on, the HUD fades in after 4 s anyway.

### Recenter

- **Recenter** in the dock (a crosshair mark and the word; the mark alone on phones), the **R** key, and a **double-click on empty space**.
- It returns to the default heading, tilt and distance (`RECENTER`). It keeps the current floor and lets go of a focused dot.
- The status line says "Back to the starting view." The key map lists R and Double-click.

### HUD

- The Beta pill is now a small gold tag next to "The Collective".
- New description: "Every business on the list, floor by floor. A line means a member shopped there."
- The button sits under the description on desktop. On phones the strip has no room, so phones get it from the opening and the band.
- More gains **How It Works** (the steps). The How We Count copy now states the ticket 250 rule: a line from one counted receipt, a dollar total from five.

### Phones (Upright)

The title and dock share one row, so with Recenter added they collided. Now:

- Whole Tower, Recenter and Find Me are marks only, with their names as labels.
- The small logo mark goes, since the site header shows it just above.
- The Beta tag hides when Find Me is there, and always below 380px.
- Checked at 360, 390 and 430 wide, with and without Find Me.

Ticket 248 rebuilds phone controls for full-screen anyway.

## Tests

- `tests/silo-layout.test.ts`:
  - Recenter goes back to the default view;
  - the opening plays at the top; never with reduced motion, a reload partway down, or `?you=1`;
  - it stays short, including the worst-case wait.
- `tests/flow-map-page.test.ts` (ticket 247 block):
  - no lavender; the page is dark;
  - the `h1` carries the headline;
  - the opening is `aria-hidden` and `inert`, and gated by `introPlays`; reduced motion hides it;
  - How It Works is under the map and in More;
  - Recenter button, R key, double-click, key-map entry;
  - the How We Count copy states the one-receipt line.
- Results: full vitest 5,519 passed, tsc clean, eslint clean, prettier clean.

## Checked

- Local dev against staging data, headless Chromium (software WebGL), at desktop 1440×900, phone 390×844 and sideways 844×390, plus reduced motion.
- Desktop: the opening frame by frame; Recenter by button, R and double-click after turning, zooming and changing floor; the More sheet; the band.
- Phone: the opening, settled view, band. Landscape: settled view.
- Reduced motion: no opening layer.
- No console errors beyond software-WebGL performance notices.

## Still To Do Before Merge

- Founder look on Preview, the opening especially (timing and feel are taste calls).
- 246's checks still apply: real-phone frame rate, bloom on a mid-range laptop.

## Round 2 (Founder Feedback 2026-11-21)

Feedback on Preview: "The Collective is a bit thin and hard to read on the opening. I want the lines to be smoother, everything else is great."

- **Opening kicker:** Jost 500 (was 300), up to 19px (was 15px), light gold, a shadow behind it, and slightly tighter tracking.
- **Smoother lines:**
  - Links and pending links are real-width lines now (three's own `LineSegments2` + `LineMaterial`, 1.5 CSS px). Before, they were 1-pixel GL lines that break up at shallow angles.
  - Each curve has 64 steps, up from 20, so long links bend smoothly instead of in kinks.
  - On desktop the bloom composer now draws into a 4x-multisampled target. The composer was skipping the canvas's antialiasing, which made every thin edge jagged.
  - Everyday link brightness went from 0.26 to 0.2, so the wider line keeps the same weight as before.
