# Ticket 285: The Map on Short Screens

**Status:** In review. Founder 2026-11-25: "fix the map page" (DR-023), and leave tour step 3 out only where too little map remains.

## Why

On /map the phone sheet was 351px tall at every height. A phone with its browser bars open (390 × 664) kept 24% of the map; a sideways phone (844 × 390) kept none, and its List button was under Ask Cue.

## What Changed

**The map page, under 1024px wide:**

- Below 760px tall, the cards in the strip are rows (280px wide, 80px photo), so the sheet is shorter.
- Below 500px tall, the closed sheet is one line with the List button and no strip. Once a business is chosen, the line has its name and View Page.
- On sideways phones, the filter chips sit beside the search bar. On very small windows (under 640px wide and 360px tall), the chips and Near Me wait behind Filters.
- Ask Cue sits above the sheet up to 1024px, and steps aside with the sheet open on a short screen.
- The map frames its first view by the room that is really left (`phonePadding.ts`, `framePadding.ts`).

At 1024px and wider, nothing changes. At 390 × 844, the sheet is the same 351px.

**The site tour (flag still off in production):**

- `mapStepFits` leaves step 3 out below 500px tall under 1024px wide, below 400px tall on wide windows, and below 700px tall under 300px wide. It is asked on each press that could lead there (Next, Back, an answer, a chapter card). Step numbers and the total stay, so there is a gap.
- A chapter card goes with its only step.
- The light is only the map below the phone controls (approved DR-006): 0/184 390 × 309 at 390 × 844. The search row, chips (Verified+ among them) and the list are dimmed and off. The first build lit the whole map area.
- Room is the height of that light, read from where the card comes to rest. A turned phone is judged afresh against 52px, so 844 × 390 has a 54px light and 667 × 375 has none.
- The caption sheet's text has no line limit, so it takes fewer lines.
- Turning the phone while step 3 is up keeps the step. With too little map there is no light and the map can't be used until there is room.
- A saved run holds the step's name, not its place.

## Map Share, Sheet Closed

Chromium, 400 made-up listings.

| Window | Before | After |
|---|---|---|
| 390 × 844 | 41% | 41% |
| 390 × 664 | 24% | 53% |
| 844 × 390 | 0% | 66% |
| 667 × 375 | 0% | 65% |
| 320 × 256 | 0% | 40% |
| 195 × 422 | 1% | 46% |

## Checks

- `tests/map-frame-padding.test.ts`, `tests/site-tour.test.ts`.
- `e2e/map-short-screens.spec.ts`: map share and a real click on List at five sizes.
- `e2e/site-tour.spec.ts`: past step 3 both ways on a sideways phone, back upright, turning while it is up, and that only the map is lit.

## Not Done

- No real phone was used; sizes are Chromium windows.
- Phone keyboard over the tour's Cue step (280, before the production flag).
- Step 3's words for a turned phone are open with Author and Creative.
