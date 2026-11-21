# Ticket 244: Logo Map Pin on Starter and Up, and a Calm Map

**Status:** Branch `feat/244-map-pins`, stacked on `feat/239-plan-compare`. Rebase onto main after 239 merges. Merging needs the founder's OK (GATE-DEPLOY). No migration.

Planned as ticket 240; renumbered because 240 went to the For Business home look (#369).

## Why

Founder, 2026-11-21:

1. The logo pin becomes a paid perk. Starter and up get it; claimed Free pages get a plain pin. Where a business sits on the map, and which ones get a pin, still comes from trust, never plan. Money buys the look, not the rank.
2. Pin design: "the shape of C with the name tab treatment of A". A rounded logo square on a caret, with the name shown only on the selected pin.
3. "The multiple numbers and shapes for multiple things is very confusing and unattractive." Of three options for display rules, the founder picked **A, Calm Map**.
4. Later the same day: "we do not need the city name plates on the map. just the circles and the numbers were just fine." Groups carry the country view.
5. "On mobile, when the user selects a map pin, that pin is centered in the map viewport until they move it."

## Calm Map Rules

These rules hold at every zoom. A business is drawn once, as one mark, and each shape means one thing:

| Mark | Means | Notes |
|---|---|---|
| Circle with a number | A group of nearby businesses | The only number on the map. Tap to zoom in |
| Logo square, gold border | A claimed page on Starter and up, standing on its own | Logo first, then the cover photo, then initials |
| Plain ink square | A claimed page on Free, standing on its own | One initial |
| Small ink dot | Any other business | Unclaimed pages are always dots |
| Diamond | A landmark | Unchanged |

- **No rank numbers.** The old 1–8 badges are gone from pins and cards.
- **No trust marks on the map.** Verified and Certified stay on the card and the preview.
- **At most 40 squares** (`TILE_LIMIT`), picked trusted-first from the businesses in view and never by plan. The selected claimed page is always a square. Squares stack in trust order.
- **Every listing stays in the group source**, so a group counts everyone in it. A square's dot is hidden by a layer filter, so nothing is drawn twice.
- **Hover links both ways.** A card lights its square or dot, and a square or dot lights its card (ink ring).
- **The legend lists only what is on screen.**
- **The name pill shows on phones only.** On desktop the preview card already names the business.
- **On a phone the selected pin stays centred** in the visible strip between the search bar and the card sheet. It re-centres when the sheet grows or shrinks (List and Map) and stops following once the visitor drags or pinches the map. A card tap zooms to street level first. With the List open the strip is too thin to aim at, so the pin centres in the whole map box.

## What Changed

| Area | Files | What |
|---|---|---|
| Gate | `lib/stripe/features.ts`, `lib/map/rankListings.ts`, `app/api/map/listings/route.ts` | `GatedFeature 'map_logo_pin'` at tier 1. The route reads `tier`; `hasLogoPin()` sets `logoPin` only for a claimed page on Starter and up |
| Squares | `lib/map/rankListings.ts` | `PIN_LIMIT` and `pinNumbers` removed. `pickTiles()` picks claimed, ungrouped pages trusted-first up to `TILE_LIMIT`, plus the selected page |
| Pin element | `components/map/photoPin.ts`, `app/globals.css` | Rebuilt: logo square or plain square on a caret, the name pill under the selected pin on phones. No badge, no trust mark |
| GL layers | `components/map/mapLayers.ts` | White group circles with an ink ring and count; ink dots with selected and hover feature-state; `setSquareIds()`, `readLooseIds()` |
| Explorer | `components/map/MapExplore.tsx`, `usePinMarkers.ts`, `useSelectionPopup.ts` | Squares from what the map drew at its last idle; hover state shared with the cards; popup offset for a square or a dot |
| Phone centring | `components/map/useFollowSelection.ts`, `lib/map/followOffset.ts`, `components/map/MapPhoneBar.tsx` | Eases the selected pin to the middle of the visible strip, follows sheet resizes, stops on the visitor's own move |
| Cards and legend | `MapListingCard.tsx`, `MapResultsList.tsx`, `MapLegend.tsx` | Number badge removed, hover ring added; legend built from the marks on screen |
| Plan copy | `lib/stripe/plans.ts`, `lib/stripe/planCompare.ts`, `app/(public)/for-business/page.tsx` | Starter line "Your logo as your map pin, once your page is claimed"; compare row "Your logo as your map pin" with the note "Where you sit on the map still comes from trust"; For Business row "Your Logo on the Map" |

## Behaviour Changes to Know

- **Verified Free pages lose their cover-photo pin.** They now show a plain ink square.
- **More squares than before.** The old limit was 8 numbered pins. Now up to 40 claimed pages show as squares once they stand apart from a group.
- **Rank numbers are gone** from pins and cards. The list order (trusted first) is unchanged.
- **Country view shows groups only.** There are no city name plates; the city tabs and the phone's city picker still fly to a city.

## Copy Rules Kept

- The plan line ships with the gate that makes it true.
- Nothing promises a better map position for paying. The compare note says position still comes from trust.
- No em dashes; Title Case headings.

## For Marketing

The /for-business table has a new row, **Your Logo on the Map** (Starter and up), for the WF-042 copy deck. Any map screenshots in decks or posts that show numbered pins are now out of date.

## Tests

- `tests/map-popup.test.ts`: `pickTiles` (trusted-first, unclaimed never a square, grouped pages left alone, trust beats plan, the limit holds but the selected page is kept), `hasLogoPin`, popup offsets for a square and a dot, `pinKey` and initials.
- New `tests/map-follow.test.ts`: the centring offset between bar and sheet, square vs dot, a growing sheet, no bar or sheet, a strip too thin to aim at.
- Updated: `plan-copy`, `plan-compare` (logo pin row matches the gate), `for-business-copy`, `map-near-me`.

## Verification

`npm run typecheck`, lint on the map files (0 errors), `npx vitest run` (5,473 passed). Local dev against staging, Playwright at 1280px and 390px:

- Country: groups and counts only, legend "Business, Group" until a lone dot shows.
- Metro and neighbourhood: squares, dots and groups, no badges.
- Hovering a square lit its card.
- On the phone, the selected square's middle landed 1 to 5px from the middle of the visible strip after a square tap, a card tap and a List round trip. After a touch drag it stayed where the visitor left it.
- The phone page never scrolls sideways.

Not checked yet: a real Starter page with an uploaded logo on the Preview (the staging seed pages use cover photos and initials). Check before merging.

## Known Limits

- With the List open on a phone, the selected pin sits under the sheet (it centres in the map box, which the list covers).
