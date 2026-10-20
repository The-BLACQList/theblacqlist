# Ticket 141: Distance on Discover and Search result cards

**Phase:** V1.5 · **Priority:** P1 · **Status:** Done (PR open, merges after the flip)
**Depends on:** #250 (distance from you on the listing page)
**Gates:** none. No migration, no new data leaves the browser.
**Decision record:** `docs/blacqlist/product/post-launch-release-order-2026-10.md` (the distance split row)

---

## Why

Testers asked how far a place is (2026-10-19). #250 answered that on the listing page. On a list of results the same question comes first: a shopper scanning cards wants to know which ones are close before opening any of them.

## Scope

In:

- A short "About 2.3 mi from you" line on cards on `/discover`, `/discover/[city]` and `/search`.

Out:

- The home page, related cards on a listing page, `/events` and `/jobs`. Those cards stay as they are.
- Sorting by distance. Near You already sorts by distance when a shopper asks for it.
- Asking for location from a list. A list never prompts.

## How it works

**Where the shopper's position comes from**, in order:

1. Near You coordinates already in the URL (`lat`, `lng`, `radius`), which the shopper chose to share.
2. Otherwise the browser's location, only when `navigator.permissions` says location is already allowed for this site. No prompt shows, so nothing interrupts the list.
3. Otherwise no line. The card looks exactly as it does today.

The page asks for the position **once**, in a small provider around the grid, not once per card.

**Privacy.** The position stays in the browser. It is never sent to our server, logged or written to the URL. Same rule as `DistanceFromYou.tsx` and the map.

**What the card shows.** The listing's pin comes from `listing_details_business.lat, lng`, read with the cards. The line uses `distanceFromYouLabel` (the same words and math as the listing page). No line when:

- the listing has no pin, or
- it is online only or ships nationwide, where a distance means nothing.

| Need | Where |
|---|---|
| Pin on the card data | `NESTED_SELECT` and `mapRow` in `lib/listings/query.ts`, `DiscoveryEntity` in `types/index.ts` |
| Get the position once | `components/entities/CardDistance.tsx` (`CardDistanceProvider`) |
| The line on a card | `CardDistance` inside `EntityCard`, only when the grid turns it on |
| Turn it on | `DiscoveryGrid` `showDistance` and `origin`, set by the three pages |

## Acceptance criteria

- [x] Given location is already allowed for the site, when a shopper opens `/discover`, then cards with a pin show "About N mi from you" and no prompt appears.
- [x] Given location has not been allowed or was denied, when a shopper opens `/discover` or `/search`, then no prompt appears and no distance line shows.
- [x] Given a Near You search, then the cards show distance from the Near You point without calling the browser's location.
- [x] Given a listing with no pin, or one that is online only or ships nationwide, then its card shows no distance line.
- [x] Given the home page or related cards on a listing page, then no distance line shows.
- [x] Given the shopper's position, then it is never sent in a request, a log or the URL by this feature.

## Known limits

- Straight-line miles, not driving distance. Same as the listing page and the map.
- Events and jobs keep their own pages without a distance line for now.

## Resolution

Built on branch `feat/card-distance`, draft PR (merges after the flip on the founder's word). No migration.

- Cards on `/discover`, `/discover/[city]` and `/search` read the pin with the card query and show the line through `CardDistance`. The home page and related cards never turn it on.
- `CardDistanceProvider` uses the URL Near You point, else calls `getCurrentPosition` once only when `navigator.permissions` already says granted.
- Checks: `tests/distance-from-you.test.ts` covers the line rules (no pin, online only, ships nationwide); `e2e/card-distance.spec.ts` (5 passed) covers allowed, not allowed (0 location calls), the Near You point, the home page, and no request or URL carrying the position.

## QA notes

- Unit: the line rules (no pin, online only, ships nationwide) and the origin choice (URL point first).
- Browser: location allowed, then denied, at 375px and desktop. Network tab shows no request carrying the position.
