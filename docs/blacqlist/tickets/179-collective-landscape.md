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
- Floors run down the left edge as a 44px icon rail, with no names beside it.
- The resting card names the floor you're on, "Floor 2 of 5: Shops", in place of "The Collective". Floor signs can sit off a screen this short, and the strip already says The Collective.
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

**From the design and accessibility reviews (these reach every size)**
- The card's grab bar is gone. The card doesn't drag, so the bar promised something it couldn't do.
- Names and gap labels keep 8px from every edge of the stage.
- An "Explore as a list" button sits right after the skip link. It shows on keyboard focus and screen readers can reach it. The dots can't be picked from a keyboard, so the list is the way in.
- Choosing the list closes More and moves focus to the list. "Back to the map" moves focus to the map.
- More and the keys come before the floors in Tab order.
- Screen readers hear the floor while the page scrolls, a business's figures when it's picked, and a repeated message a second time.
- The card's figures come from one helper, `businessFiguresText`, so the card and the spoken text can't disagree.
- Show kinds buttons, the Spot button, the card's color buttons and card links are at least 44px on touch screens.
- On phones under 650px tall the resting card drops its help line, so the color key fits the sheet with no inner scrolling.
- The Pause button keeps one label, "Pause motion", with its pressed state. With reduced motion it says "Motion is off".

**Tests**
- New `e2e/collective-navigation.spec.ts` covers tickets 174 to 179 at 375px, 844x390 and 1280px.

## Not in this ticket

- The tops of the floor rings can sit under the strip at floor view. Same as the accepted phone note in ticket 178.
- On a 568x320 phone the rail ends 8px past the window. The last floor can still be tapped.
- "Show kinds" wraps to two lines in the card at 667px wide.
- On the phone top view the hint can sit over a floor sign. It leaves at the second floor, and signs have no way to avoid other things on screen.
- Floor signs can slide under the rail at 667px wide or off the top or bottom of the screen. The card names the floor, so nothing is lost.
- No real screen reader run yet. The accessibility review read the code and screenshots only.

## Checks

- [x] 844x390, 844x340, 667x375 and 568x320: strip, rail and card all in view, no sideways scroll
- [x] Floor tap shows the card and names; a touch swipe moves the page
- [x] More opens above the header, Esc returns focus to More
- [x] Past the track the Report and Cue pills go back to their usual places
- [x] Reduced motion: no pin, a floor tap moves the page, card and rail show
- [x] Short desktop window, 1280x460
- [x] List view stacks, and offers "Back to the map"
- [x] The resting card names the floor while the page scrolls
- [x] Skip link, list and focus moves from the keyboard
- [ ] Founder checks on a real iPhone, sideways, on the Vercel preview
