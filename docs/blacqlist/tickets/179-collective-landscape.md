# 179: The Collective on a sideways phone

**Status:** Draft PR, waiting for the founder's merge word
**Follows:** ticket 178 (draft PR #304, this stacks on it)
**Area:** `/flow-map` (The Collective)

## Why

The founder: "missing components/out of view components on the mobile view."

A sideways phone gets the desktop layout, which needs about 700px of height. A real iPhone in Safari has about 340px, so the card and floors run off the screen.

## What changes

**One layout for any window under 500px tall, at any width**
- One strip across the top: title, the three numbers on one line, More and Find me.
- Floors run down the left edge as a 44px icon rail. The floor you're on shows its name beside the rail.
- The card is a panel on the right, full height under the strip, and scrolls inside itself. The color key stays in the card.
- The map fills the rest and centers in the space between the rail, the strip and the card.
- The track from ticket 177 now runs at these heights too, so a swipe still travels the floors.
- More opens as a drawer on the right, over the site header.

**What moves or hides at this height**
- The latest receipts line hides. There is no room for it next to the numbers.
- The key list button hides. The keys still work, and More has a Keys section. This also applies to short desktop windows.
- Report and Cue sit on the map between the rail and the card, so neither covers a floor or the card.
- Under 620px wide the logo mark drops from the strip so Find me stays clear of the numbers.

**List view**
- The list stacks in one column at these heights instead of three squeezed columns.
- Choosing the list no longer says "The map stopped drawing." The renderer drops its own context after the map closes, and that was read as a failure. This bug is on main today. The list now offers "Back to the map".

**Tests**
- New `e2e/collective-navigation.spec.ts` covers tickets 174 to 179 at 375px, 844x390 and 1280px.

## Not in this ticket

- The tops of the floor rings can sit under the strip at floor view. Same as the accepted phone note in ticket 178.
- On a 568x320 phone the rail ends 8px past the window. The last floor can still be tapped.
- "Show kinds" wraps to two lines in the card at 667px wide.

## Checks

- [x] 844x390, 844x340, 667x375 and 568x320: strip, rail and card all in view, no sideways scroll
- [x] Floor tap shows the card and names; a touch swipe moves the page
- [x] More opens above the header, Esc returns focus to More
- [x] Past the track the Report and Cue pills go back to their usual places
- [x] Reduced motion: no pin, a floor tap moves the page, card and rail show
- [x] Short desktop window, 1280x460
- [x] List view stacks, and offers "Back to the map"
- [ ] Founder checks on a real iPhone, sideways, on the Vercel preview
