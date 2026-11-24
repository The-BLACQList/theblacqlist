# Ticket 272: Layout Shift

**Status:** In review. #405 (pages) and #406 (Cue answer box). Slow clicks on The Collective: cause found, waiting on a founder choice.

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
5. `e2e/layout-shift.spec.ts`: where the footer sits under the loader, and CLS ≤ 0.1 on direct loads and on clicks from Home, at 1440 and 390. 26 tests pass; most of the footer and click cases fail with the old loader (11 of the first 22).

No migration, no copy change beyond the sheet's heading reading "Businesses" while it loads.

## PR 2 (#406): the Cue answer box

On a phone the box opened at 318px, shrank to 128px when the first words replaced the loading cards, then grew back. It now holds its opening height while words stream in. With a mocked stream: Home on a phone 0.243 → 0.071 at worst; Search on a phone 0.234 → 0.000 (short answer) and 0.361 → 0.136 (long answer: four cards land at once).

## Slow clicks on The Collective: cause found, not changed

The clicks are not slow because of their handlers. A click on the plain heading, which has no handler, took as long as Demo, Live or Follow a Dollar. On an M4 at 1728×1000 the scene draws every pixel of a Retina screen with 4-sample edges and a full-size glow, so the graphics chip runs at about 30 frames a second (20 under load) and every click waits for it. Deferring the Demo/Live data was tried and did not help; the branch is gone.

| Drawing | Frame | Click on plain heading |
|---|---|---|
| Today (2×, 4 samples) | 33–34 ms | 160–208 ms |
| 2×, 2 samples | 27 ms | 120–144 ms |
| 2×, no samples | 19 ms | 104–112 ms |
| 1.5×, 4 samples | 19 ms | 104–120 ms |
| 1.5×, 2 samples | 17 ms | 56–72 ms |
| 1×, 4 samples | 17 ms | 56–72 ms |

Every option changes the look a little, and earlier notes on the glow and thin lines were the founder's, so this waits for a choice.

## Not proven

- One `/flow-map` reading of 1.0 with no element recorded. Not reproduced.
- One Home reading of 0.13 on a phone. The Cue answer box gives this range when the page is scrolled a little (see PR 2).
- `/coming-soon` scores 78 on a slow first paint (FCP) over a few visits. Its CLS passes. Recheck after launch traffic.

## After Deploy

Speed Insights covers 7 days, so the score moves slowly. Check by element about a week on, or by deployment sooner.
