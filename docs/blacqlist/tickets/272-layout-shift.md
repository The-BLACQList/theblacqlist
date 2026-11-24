# Ticket 272: Layout Shift

**Status:** In review (PR 1). PR 2 (slow clicks on The Collective) follows.

## Why

Founder 2026-11-24, with a Vercel Speed Insights screenshot: "I see this in vercel. We need to address this". Production, desktop, 7 days: score 88. CLS 0.23 was the one failing metric (target 0.1); INP sat on its limit at 200ms. The sample is small (43 events).

## Cause

The page loader was 70% of the screen tall. The footer showed under it and was pushed away when the page arrived. The field data names the footer: Home 0.23, The Collective 0.44 on desktop and 0.23 on phones. A click from Home scores the shift against Home, which is why Home failed while its own load measures 0.

Measured on Preview before the change:

| | Desktop | Phone |
|---|---|---|
| /flow-map, direct | 0.229 | 0.170 |
| Home → /flow-map | 0.458 | 0.404 |
| Home → /map | 0.275 | 0.506 |
| Home → /discover | 0.347 | 0.467 |
| Home → /jobs | 0.235 | 0.447 |

Two smaller causes: the phone map sheet changed height twice while loading, partly because it said "No businesses in this view" before the map knew its bounds; and the Turnstile box added its height to a form after load.

## Changes (PR 1)

1. `PageLoader`: as tall as the screen under the header.
2. Discover, Events, Jobs and Search: `min-h-screen`, as Guides, Collections, Vendors and Marketplace already had. Without it a nearly empty page pulled the footer back into view after the taller loader. Visible effect: on those four pages the footer starts below the fold when there is little on them.
3. Map: the list counts as loading until the map is ready. Loading cards are the real card's shape. The phone strip's empty and error messages are as tall as a card (not on screens under 700px tall). If the imagery stalls, the list shows the chosen city (or every business), which is what the notice already promised.
4. `TurnstileWidget`: keeps 73px (the box measures 72.6px).
5. `e2e/layout-shift.spec.ts`: where the footer sits under the loader, and CLS ≤ 0.1 on direct loads and on clicks from Home, at 1440 and 390. 22 pass; with the old loader 11 fail.

No migration, no copy change beyond the sheet's heading reading "Businesses" while it loads.

## Not proven

- One `/flow-map` reading of 1.0 with no element recorded. Not reproduced.
- One Home reading of 0.13 on a phone, perhaps the Cue answer arriving. Measured in PR 2.
- `/coming-soon` scores 78 on a slow first paint (FCP) over a few visits. Its CLS passes. Recheck after launch traffic.

## After Deploy

Speed Insights covers 7 days, so the score moves slowly. Check by element about a week on, or by deployment sooner.
