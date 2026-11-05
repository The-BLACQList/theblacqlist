# 176: The Collective, always show where you are

**Status:** Draft PR, waiting for the founder's merge word
**Follows:** tickets 174 and 175 (draft PRs #300 and #301, this stacks on them)
**Area:** `/flow-map` (The Collective)

## Why

The founder: "the scrolling experience is also unclear and can be disorienting" and "missing components/out of view components on the mobile view."

Four causes, all found by reading and running `main` at `1bbbf8c`:

- The gauge only knows what you picked. Scroll away and it keeps showing the old floor, the floor card stays open, and tapping that floor switches it off instead of going there.
- There is no keyboard way to move through the floors or turn the map. Drag has no keyboard match.
- Esc and every letter key need focus inside the section, and clicking the map doesn't put focus there. After a mouse pick, Esc did nothing.
- The chrome is wrong by a few sizes. The page has a second `main` with its own 64px of top padding, the phone header is 56px while the CSS assumes 64px, and the More sheet opens under the header and the Report and Cue pills.

## What changes

**Gauge**
- The gauge reads the floor from where the camera is heading, every frame. A pick moves it at once, and a scroll moves it floor by floor.
- At the top of the page the gauge shows Shoppers instead of nothing.
- Scrolling off a floor you picked lets go of it: the floor card closes and the floor stops glowing.
- List view has no camera, so the gauge keeps showing the floor you picked.

**Keys** (work once focus is inside the map, and not inside the card or a form field)

| Key | What it does |
|---|---|
| Up and Down arrows | Move up and down the silo. Past either end, the page scrolls as usual |
| Left and Right arrows | Turn the map |
| Page Up and Page Down | Go to the next floor. Past the last floor, the page scrolls as usual |
| Home and End | Go to the top or bottom floor |

These aren't letter shortcuts, so the "Letter shortcuts" setting doesn't turn them off. All of them are listed in the key map.

**Focus**
- The section takes focus when clicked or tapped, so Esc and the keys work after a mouse pick.
- It isn't a Tab stop, and it shows no outline.

**Chrome**
- One `--hdr` token holds the header height: 56px under 768px, 64px from there up.
- The second `main` becomes a `div`, which removes 64px of empty space above the hero and leaves one `main` on the page.
- While More is open the section rises above the header (z-50) and the pills (z-40).

## Not in this ticket

- A scroll with a business card open leaves the card up. Ticket 171b's scroll model is the founder's pick in the workshop, and releasing a selection on scroll belongs with that pick.
- The phone stage, card sheet and landscape layout wait for the same workshop.

## Checks

- [ ] Gauge matches the floor at every point of a slow wheel scroll, top to bottom and back
- [ ] Pick a floor, scroll off it: the card closes, and tapping that floor goes there
- [ ] Each key above does what the table says, including at both ends
- [ ] Reduced motion: keys still reach every floor
- [ ] After a mouse pick, Esc closes the card
- [ ] Clicking the map doesn't scroll the page
- [ ] More covers the header and pills on phone and desktop
- [ ] Docked at 1280px, the section fills the window below the header
- [ ] List view: gauge, keys and page scroll all still behave
