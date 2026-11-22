# 266 · Teardrop Map Pins With a Larger Circle

**Status:** PR open
**Priority:** P1
**Depends on:** 244 (Calm Map, logo pin on Starter and up)

## Why

The founder, 2026-11-21: "I do want the circular pins back from option B from the map pin workshop, I just want the circles a bit larger in the pin."

Ticket 244 shipped option C's rounded square. This ticket brings back option B's teardrop with its white circle, with the circle made larger. The Calm Map rules from 244 stay: no rank numbers, no trust marks, and the name pill shows only on the selected pin on phones.

## What Changed

- **Claimed page on Starter and up:** a gold teardrop with a 1.5px white edge and a white circle holding the logo. The logo is never cropped. With no logo, the cover photo fills the circle; with neither, initials.
- **Circle size:** the circle is 79.5% of the pin's width, up from option B's 72.7%.

  | State | Pin | Circle | Logo |
  |---|---|---|---|
  | At rest | 52 × 64 px | 41 px | 30 px |
  | Selected | 62 × 76 px | 49 px | 36 px |

  Option B's mock was 44 × 54 with a 32px circle and a 24px logo.
- **Claimed Free page:** a smaller ink teardrop (34 × 42, selected 42 × 52) with one white initial, as in option B but with no number.
- **Hover from a card:** an ink edge on the gold pin, a gold edge on the ink pin.
- **Selected:** the pin grows, with an ink edge on the gold pin and a gold edge on the ink pin. Selection shows by size, never by color alone.
- **Legend:** "Claimed Business" now shows a small teardrop, not a square.
- **Preview card position:** `lib/map/popupOffset.ts` now uses the pin's width (`SELECTED_TILE` = 62) and height (`SELECTED_PIN_HEIGHT` = 76). The card lines up with the round head of the pin, which sits 46px above the coordinate.
- **Unchanged:** which pages get a pin (the 40-pin cap, trusted first) and the phone "pin stays centred" follow.

## Tests

- `tests/map-popup.test.ts`: a new test checks that the selected paid pin size in `app/globals.css` matches `SELECTED_TILE` and `SELECTED_PIN_HEIGHT`. The existing offset tests pass with the new sizes.
- `tests/map-follow.test.ts`: unchanged and passing.

## Verification

- vitest, tsc and lint are clean.
- Local screenshots, on staging data, at 1280 and 375:
  - The demo storefront's gold teardrop shows its logo in the white circle.
  - The preview card clears the pin on desktop.
  - On phones, the pin is centred with the name pill under its tip.
- Every state (Free, Free hover, Free selected, paid, paid selected) was rendered side by side.

## Not in This Ticket

- Any change to group circles, dots, landmarks or which pages get a pin.
- The legend's 12.5px text (it predates this ticket).
