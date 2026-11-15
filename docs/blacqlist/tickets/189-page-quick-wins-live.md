# 189: Facts line, gallery captions and richer JSON-LD on live pages

**Status:** In PR (branch `feat/189-page-quick-wins`, stacked on 185, 2026-11-15). As built: a **Quick Facts** card in the Basics tab (`#facts`, business pages only; year 1800–this year, `$`–`$$$$` or Not Set, Takes Reservations / Walk-Ins Only / Not Set) saving through `updateListingContentAction`; the live loader reads the three columns; gallery captions show on live pages; JSON-LD gains every item below except `specialOpeningHoursSpecification` (waits for 196). A price like "From $350" is kept as offer text, not a number. Meter items "Year Founded" and "Price Range" weigh 4 each (creators exempt). The freeze line is stale: the freeze was lifted 2026-11-15.
**Follows:** 184 (`EntityFactsLine`, `lib/listings/facts.ts`, gallery captions, `lib/listings/jsonLd.ts`)
**Area:** business pages, the owner editor (`PageFinishView#details`), structured data
**Gates:** none. No migration: `founded_year`, `price_range` and `accepts_reservations` already exist on `listing_details_business` and never reach the page.

## What changes

- Loader selects the three columns into `BusinessDetails`; `#details` gets a year input (1800–current), a `$`–`$$$$` segmented control and a reservations toggle. `EntityFactsLine` and the gallery captions stop being example-only.
- `lib/listings/jsonLd.ts` grows: `@type` mapped from the category slug (Restaurant, CafeOrCoffeeShop, Bakery, BeautySalon, LegalService, AccountingService, …, fallback LocalBusiness), `openingHoursSpecification` from `details.hours`, `specialOpeningHoursSpecification` once 196 ships, `image` (resolved cover), `priceRange`, `foundingDate`, `geo`, `hasMap` (directions URL), `sameAs` as an array of website and socials, `hasOfferCatalog` from priced services, `event[]` from `organizerEvents`, `acceptsReservations`.
- Two quirks pinned by `tests/jsonld.test.ts` get fixed here: a second address line is overwritten by the city and never emitted (it belongs in `streetAddress`), and an average rating of exactly 0 emits no `aggregateRating` (truthiness standing in for a null check).
- Checklist and strength meter: "Year founded" and "Price range" count toward completeness.

## Checks

- Snapshot tests per entity type; one Preview URL validates in Google's Rich Results test with hours and rating detected.
