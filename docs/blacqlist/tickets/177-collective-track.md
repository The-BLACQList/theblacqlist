# 177: The Collective, the map stays put while you scroll

**Status:** Draft PR, waiting for the founder's merge word
**Follows:** ticket 176 (draft PR #302, this stacks on it)
**Replaces:** the "Page scroll and silo travel hand off cleanly" section of ticket 171b, for the wheel
**Area:** `/flow-map` (The Collective)

## Why

The founder: "the scrolling experience is also unclear and can be disorienting."

Ticket 171b gave the wheel three hidden modes: snap to the dock, travel the silo, scroll the page. The same scroll meant different things depending on state the reader couldn't see.

Founder picks from the 2026-11-05 scroll workshop: the map stays put, the track is 2 screens long, the hint reads "Keep scrolling to see every floor", and it leaves at the second floor.

## What changes

**One scroll, one meaning**
- The map pins under the header. Scrolling the page moves you down the floors.
- The scroll track adds 2 screens to the page. Past the bottom floor, the page carries on.
- Wheel and trackpad are plain page scroll now, so momentum is the browser's own. Nothing intercepts them.
- Scroll position comes from where the pinned map sits inside its track, not the window height, so a moving browser toolbar can't shift it.

**Picks and scroll agree**
- Picking a floor, a dot or a gap writes that floor's scroll position, instantly. The map doesn't move, only the scrollbar.
- Scrolling more than a small step (0.03 of the track) from a pick lets go of it: the card closes and the camera returns to the floor view.
- Up and Down arrow keys write scroll too, so keys and wheel can't disagree.
- A reload partway down starts the camera where the page is, with no glide.

**Getting past it**
- A skip link, visible on focus, jumps past the map.

**Hint**
- "Keep scrolling to see every floor" sits low in the stage.
- It only shows on the track, not while a card is open or the key map is up.
- It leaves when the second floor is reached and stays gone for the visit.

**Shorter windows**
- The ticker goes first, then the legend. When the legend goes, the color key moves into More.

**When the track is off**
- Reduced motion: no track, no scroll-linked camera. The gauge cuts straight to a floor.
- List view: no track.
- Phones and landscape keep the old layout until tickets 178 and 179. A narrow desktop window has no wheel travel for that stretch. The gauge and keys still work.

## Not in this ticket

- Phone layout and removing the touch path (178)
- Landscape layout (179)
- Any change to labels, camera easing or gauge logic

## Checks

- [ ] At 1280x800 the map stays pinned and the header stays fixed from the top of the track to the bottom
- [ ] Scrolling moves the gauge through every floor in order
- [ ] Past the bottom of the track the page scrolls on
- [ ] Picking a floor, a dot and a gap moves the scrollbar and leaves the map still
- [ ] Scrolling away from a pick closes the card
- [ ] Reload halfway down opens at that floor with no glide
- [ ] The hint shows, then leaves at the second floor, and stays gone
- [ ] The skip link lands below the map
- [ ] Reduced motion: no track, every floor reachable from the gauge
- [ ] List view: no track
- [ ] 1280x720 and 1280x600: nothing overlaps in the HUD
- [ ] A wheel over the card moves the page, so the card is never a dead spot
- [ ] The More panel scrolls on its own without moving the page
