# 178: The Collective, the phone map fills the screen

**Status:** Draft PR, waiting for the founder's merge word
**Follows:** ticket 177 (draft PR #303, this stacks on it)
**Replaces:** the touch rules in ticket 171b's "Page scroll and silo travel hand off cleanly" section
**Area:** `/flow-map` (The Collective)

## Why

The founder: "missing components/out of view components on the mobile view" and "the scrolling experience is also unclear and can be disorienting."

On a phone the card, floors and controls all sit under a 52svh map, so tapping a dot looks like nothing happened. Floor names are hidden and the color key only lives in More. A vertical swipe means page scroll or silo travel depending on state the reader can't see.

Founder picks from the 2026-11-05 scroll workshop: the map stays put, the color key sits in the card, latest receipts sit in the top strip, names on a phone go up to 7.

## What changes

**One swipe, one meaning**
- The track from ticket 177 now runs on phones too. A vertical swipe is always the browser's own page scroll, with its own momentum.
- A sideways swipe turns the map. Nothing else listens to touch.
- The code that switched the canvas to `touch-action: none` is gone, because a full-height stage under it would trap the page. The two changes have to ship together.

**Phone stage**
- The map fills the screen under the site header.
- Top strip: title, the three numbers on one row, and the latest receipt on one line. The intro sentence moves out, More's "How we count" already covers it.
- More and Find me sit at the right end of the title row, so they stay reachable with a card open.
- Floors run down the right edge, 44px each. The floor you're on shows its name.

**Card as a bottom sheet**
- The card sits on the bottom edge, at most 42% of the stage, and scrolls inside itself.
- Tapping a dot shows its card with no page scroll.
- The color key sits in the resting card. A business card takes its place while it's open, as the workshop showed.
- The color key leaves More on this layout, so there is one place for it.

**Pills and hint**
- Report and Ask Cue ride on top of the sheet, using the `--map-sheet-h` pattern from `/map`. They drop back once the sheet leaves.
- The hint sits above the pills.

**Names**
- The phone cap goes from 5 to 7.
- The size floor for a name drops from 12 to 8 on phones, because the stage is nearly twice as tall and dots read smaller. At 12 no names showed at floor view. Desktop stays at 9.
- Names stay out of the band above the stage, where nothing shows, so they don't use up the cap.

**Stays as it is**
- List view keeps the stacked phone layout.
- Reduced motion gets the same phone stage with no track: floors change by tapping them, and a tap brings the stage on screen so the card shows.
- Phones held sideways stay on today's layout until ticket 179.

## Not in this ticket

- Landscape phones (ticket 179).
- A sheet you can drag taller.
- `overscroll-behavior: contain` on the card. It trapped the page in testing, so a swipe on the card chains to the page once the card has nothing left to scroll.

## Checks

- [x] 375px: strip, floors, sheet and pills all on screen, nothing overlapping
- [x] 320px: title row fits
- [x] A dot tap shows the card with no scrolling
- [x] A vertical swipe on the canvas scrolls the page, a sideways swipe turns the map
- [x] A swipe on the card moves the page once the card has nothing left to scroll
- [x] The gauge follows the floor while scrolling, and the named floor is the current one
- [x] Filters in the card change the dots
- [x] More sits above the header and the pills are hidden behind it
- [x] List view and reduced motion still work
- [x] No sideways page scroll
- [ ] Real iPhone on the Vercel preview: momentum, toolbar collapse, safe areas
