# Ticket 290: Tour Close X and Tap Colour

**Status:** Built, PR open. Founder 2026-11-27 picked "Tour X + tap colour" from the park queue. The tour stays off in production (ticket 280).

## Why

- **Close X:** at 1280 wide, the tour's close X sat on top of the header's Sign Up / Sign Out button.
- **Tap colour:** on a phone, after tapping Next, the next step's Next button stayed in the light hover gold, because phones keep the hover state after a tap.

## What Changed (`app/globals.css`)

| Screen           | Close X                                                           |
| ---------------- | ----------------------------------------------------------------- |
| Wider than 767px | Just under the site header (64px tall): top 72px, right 24px.     |
| 601px to 767px   | Just under the shorter header (56px tall): top 64px.              |
| 600px and under  | Unchanged: in the header's top right, in the menu button's place. |

- The X stays 44 by 44.
- Tour button hover colours apply only on devices with a mouse (`@media (hover: hover)`).
- Pressing a button shows a darker gold (`--tour-gold-press`, #a3834f) instead.

## Checked (Local, Staging Data, 2026-11-27)

Signed out and signed in, at 1280 and 390, opening card and step 2:

- At 1280 the X covers no header button.
- At 390 it takes the menu button's place, as before.
- After a tap at 390, Next is the plain gold (196, 160, 101), not the hover gold.
- No page errors.
- Made-up accounts were deleted afterwards, and the staging counts were the same before and after.
