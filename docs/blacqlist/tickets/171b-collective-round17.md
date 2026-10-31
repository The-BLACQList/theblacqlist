# 171b: The Collective, back to the agreed round 17

**Status:** Draft PR, waiting for the founder's merge word
**Follows:** ticket 171 (#294, merged)
**Area:** `/flow-map` (The Collective), `/flow-map/methodology`

## Why

After #294 the founder said (2026-10-31):

> "we do not need that n of 707 click through. that's overwhelming and not what was on the last version we agreed on. Neither is the bottom... I want what we agreed on/ landed on for that final workshopping pass."

> "we should still be able to see the businesses' names on the collective, just not the lines or the numbers."

> "pink squares included..."

> "we can also spread out the business nodes a bit, especially for denser categories."

> "mouse nav could also be much cleaner on both desktop and mobile. gets confusing and jumpy between scrolling the page and scrolling the experience. Largely the reason I wanted the top of the page collapseable."

## What changes

**The card and the dock match round 17 HUD B.**
- The "n of 707" Prev / Next click-through and the card counts are gone. The card has a header (family icon or gap icon, name, family) and a close button (Esc).
- The dock is back to Find me (only when you have counted receipts), More, and the keys button (hidden on phone).

**Every business shows by name.** `[Decision — founder, 2026-10-31]`
- A published listing is already public, so its name shows on the map labels, the card and the ticker.
- Amounts, receipt counts and lines still wait for `AGGREGATE_MIN_TRANSACTIONS`. An unlinked business sends no amount or count to the browser.
- Methodology §5 now says this. Ticket 171's "names stay hidden" line is marked reversed.

**Name labels in the scene.**
- Up to 10 labels on desktop and 5 on phone, for the biggest dots on screen.
- A label never sits on another label or on a HUD panel. It shows the name, the family and the family color dot.

**Pink gap squares.** A gap is a floor in a family with no business yet.
- A pink square sits in each gap's wedge. Up close, a "No {floor} yet" label shows under it.
- Picking a gap frames it from above and opens a gap card. The copy never says dollars leave.
- The gauge shows a pink count badge per floor, and the legend has a gap key.

**Denser categories spread out.** Placement in `lib/spend/silo-layout.ts` spreads a cluster out to a radius of 7.5, so busy families don't stack.

**Page scroll and silo travel hand off cleanly.**
- *Desktop wheel:*
  - The first wheel gesture toward the stage snaps it to the dock (just under the header).
  - Once docked, the wheel travels the silo.
  - Past the top or bottom floor, the next gesture scrolls the page.
  - One gesture keeps one mode (220 ms gap), so it never flips halfway.
  - Pinch zoom, sideways swipes and scrollable panels are left alone.
- *Mouse drag:* turns and tilts the view.
- *Touch:*
  - Until the stage is fully on screen, a vertical swipe scrolls the page.
  - Once it is, a swipe locks to one axis. Sideways turns the view. Up and down travels, and hands off to the page past either end.
- Reduced motion snaps without the smooth scroll.

## Out of scope
- The counted-share text (ticket 164) still names a business only when it opts in. That shares one person's receipt, so it is a different case.

## Verification
- `pnpm typecheck`, `pnpm lint` and `pnpm test:unit` pass.
- Preview at 375px and 1280px, light and dark:
  - wheel from the hero into the stage, through the floors and out the bottom;
  - a touch swipe at each stage edge;
  - pick a gap square;
  - names don't overlap the HUD;
  - no totals on an unlinked card.
