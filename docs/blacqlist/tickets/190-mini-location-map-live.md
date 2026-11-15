# 190: The mini location map on live pages

**Status:** In PR — stacked on 189 (#336), which stacks on 185 (#335). No migration. Merge needs the founder's OK. Scope note: the geocoding piece was already done — `updateListingContentAction` (owner editor), `updateEntityContentAction` (admin) and `createListing` all call `geocodeAddress` when the street line changes, so the work here is the live flip and the lazy load. Extra locations already pin from `entity.locations`; 110 adds the group members without touching this component. The 2026-11-13 freeze line is stale.
**Follows:** 184 (`EntityLocationMap`, `LocationMapCanvas`, `lib/listings/locationPins.ts`), 110 (all pins for a location group)
**Area:** business pages (the Visit block)
**Gates:** none for the code. Perf budget: no change to LCP on a listing with a map (the map is below the fold); measure on Preview with Lighthouse before and after.

## What changes

- `EntityLocationMap` renders on live pages when `details.lat` and `details.lng` are set (and for every member of a location group once 110 ships), instead of only in example mode.
- Load `maplibre-gl` only when the Visit block scrolls near the viewport (`IntersectionObserver`), so visitors who never reach it never download it. The server-rendered fallback (address + "Open in Maps") stays.
- Pin freshness: pins come from the address → lat/lng path. Verify how `lat`/`lng` are populated for owner-edited listings; if that path is admin-only today, the editor's address save must trigger geocoding. That is the one real piece of work here.

## Checks

- Tiles load on Preview through `/api/map/tiles` as the discover map does; keyboard-reachable zoom; the fallback renders without WebGL (`tests/entity-location-map.test.ts`).
