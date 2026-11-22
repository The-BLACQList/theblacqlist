# Ticket 249: Demo Mode for The Collective

**Status:** Merged #392 (`c407c6b`), 2026-11-22. Black hole while moving fixed in 267.

Part of the Collective tighten-up (246–250). Founder picks (2026-11-21):

- Demo turns on by itself while real activity is thin.
- A Demo / Live switch is always on screen.
- Made-up businesses only, with a "Sample Data" badge.
- Demo stays on until 25 real businesses have a line ("25 is fine").

## The Problem

Live data is thin today: one business has a line. The map looked empty, so a visitor couldn't see what The Collective becomes.

## What Changed

### The Sample (`lib/spend/collective-demo.ts`)

- About 400 made-up businesses (`DEMO_SIZE`) across all four business floors:
  - Shops 46%;
  - Suppliers, Makers and Growers 20 / 20 / 14%.
- Names are invented, in the Sample & Co. spirit ("Juniper Gallery", "Bellwether Lumber"). Each name's last word fits its family and floor.
- Every demo business has `href: null` and a `demo-` id. Nothing on the map can open or point at a real listing.
- The sample is seeded (`collective-demo-249`), so every visit sees the same map.
- About 55% of the sample has a line, and about half of those clear the 5-receipt total bar.
- The sample goes through the same `buildSiloBusinesses` as live data. That means the 250 rules hold:
  - a line from 1 receipt;
  - $ only at 5.
- Three family-and-floor pairs are left empty on purpose, so the pink gap squares still show.
- The sample is built in the browser. Nothing is read from or written to the database.

### Which View Opens (`pickView`, `page.tsx`)

Decided on the server, in this order:

1. `?you=1` opens Live. A reader looking for their own line always gets Live, because Demo never holds it.
2. `?view=demo` or `?view=live`.
3. The remembered choice (cookie `bl_collective_view`, 30 days, path `/flow-map`).
4. A reader with their own line, counted or pending, gets Live.
5. Demo while fewer than `DEMO_UNTIL_LINKED` (25) real businesses have a line. Otherwise Live.

### On Screen (`SiloExperience.tsx`, `silo.css`)

- **Demo / Live switch:**
  - sits under the title in the HUD, with `aria-pressed` on both buttons;
  - switching clears the open business, floor and filters;
  - the status line announces "Showing sample data. Not real businesses or spending." or "Showing live data from The BLACQList.";
  - the choice is remembered, and `?view` updates if it is in the URL.
- **Sample Data badge:** shows beside the switch with "Not real businesses or spending." for as long as Demo is on.
- **Opening title in Demo:**
  - The title reads "See Where Our Money Could Go", in place of the real total.
  - The line under it reads "This preview uses sample data. Not real businesses or spending."
- **KPIs and floor gauge:** show the sample's totals in Demo and the real ones in Live.
- **Arrivals (`SiloScene.tsx`):**
  - every 3.6 s a sample receipt arrives;
  - its line grows from the family's crowd to the business in 1.5 s, with a bright head leading, then fades;
  - the ticker names the same business ("just now", then "moments ago", two lines).
  - Arrivals stop for reduced motion, paused motion, or a map that is off screen.
- **Phone and landscape:**
  - Upright phone: the switch and badge sit under the title, both in the preview and in full-screen.
  - Landscape: the switch sits inline in the strip and only "Sample Data" shows. At 667 wide, only Spent shows among the KPIs, so nothing overlaps More.
  - Fixed along the way: in the sideways preview the map stopped at 604 of 844 px, leaving a dark band. It now reaches the right edge. This was there before 249.

## Round 2: Businesses Buying From Businesses, Follow a Dollar (2026-11-21)

Founder: "make sure to include the follow the dollar experience, as well as take into account that some lines will cross categories as businesses often buy from other businesses. Make sure there's no flickering on movement."

### Businesses Buying From Businesses (`buildDemoSupply`, `SupplyLinks`)

- Demo only. Each linked shop buys from 1 or 2 suppliers (30% get 2). Each supplier then buys from makers, and each maker from growers, so the lines chain down the floors.
- **Crossing categories:**
  - About two in three lines stay in the family. The rest cross along pairs that make sense (`CROSS_BUYS`). For example, food buys from home (kitchen goods) and culture, style buys from health, and home buys from style.
  - About 16% of businesses also hire a services business on the Shops or Suppliers floor (a bookkeeper, a printer).
- **The current sample:**
  - 370 lines in all: 117 goods lines cross categories, and 46 are services.
  - By floor: 135 lines from Shops to Suppliers, 94 from Suppliers to Makers, 96 from Makers to Growers.
- **On the map:**
  - The lines are faint, so the floors stay calm.
  - With colours by kind, a line runs from the buyer's colour to the seller's. A cafe buying from a woodshop reads as green into orange.
  - Picking a business lights its own lines.
  - A filter hides a line when either end is hidden.
- The supply layer is built only when the data, colours or pick change, never per frame.

### Follow a Dollar (`demoDollarTrail`, `trailStops`, `TrailPath`, card in `SiloPanels`)

- **Starting:** a gold **Follow a Dollar** button in the map tools, shown in Demo only, starts a trail.
- **The trail:**
  - It starts at a linked shop that has suppliers, never a services business.
  - It walks the supply lines down the floors: shop, supplier, maker, grower. That is at most 5 stops (`TRAIL_MAX_STOPS`); today's trails run 4.
  - It prefers a route that crosses one category, then stays in the family.
- **Each stop:**
  - The camera flies to the business.
  - The path taken so far shows bright gold, and the rest of the way shows faint.
  - A spark runs the newest hop while motion is on.
- **The card:**
  - Header: "Follow a Dollar · Stop N of M", then the name and its kind and floor.
  - A "Crosses Categories" chip shows when the hop changed family.
  - One plain sentence ("Saffron Goods restocks from Harbor Light Trade Goods. Part of the dollar moves with it."), then progress bars.
  - Buttons: **Next Stop** (**Follow Another Dollar** on the last stop) and **End Trail**.
  - A note at the bottom: "Sample trail. Not real businesses or spending."
  - No dollar amounts or shares anywhere, since the sample has no real spending to split.
- **Moving through it:**
  - The trail moves on by itself every 8 s.
  - It holds still for Pause, for reduced motion, or when the map is off screen.
  - Next Stop skips ahead.
- **Ending it:**
  - Escape, End Trail, the X, picking another business, a floor, a gap, or switching to Live all end the trail.
  - The status line reads "Trail ended." and focus goes back to the button.
  - The trail is derived from the open business, so it can't linger after a different pick.
- The status line reads each stop aloud ("Stop 2 of 4: …").

### Flicker on Movement (`SiloScene.tsx`)

The founder saw flicker on an iPhone while moving. These fixes address the known causes:

- **Small dots:**
  - A dot never draws smaller than 2.5 CSS px. A far dot fades instead of shrinking under a pixel, which is what made distant dots blink while turning.
  - Under 9 px a dot is a soft plain disc. The icon fades in only when there is room for it, so icon edges no longer sparkle.
- **Stars and dust:** stars are a fixed screen size with a soft round texture, and the dust is fainter.
- **Glow:** it now runs at full size instead of 75%. At the smaller size, the glow stepped as the camera moved.
- **Floor halos:** they ease between lit and unlit (0.35 s) instead of snapping.
- **Ring textures:** anisotropic filtering, so rings seen edge-on don't shimmer.
- **New lines:** supply lines are 1.3 px and the trail is 2.8 px. Nothing thinner than the existing shopper lines.

Measured locally: a frame-to-frame probe found no GPU rebuilds while moving. A software renderer can't reproduce the iPhone flicker, though, so this has to be confirmed on a real phone.

Also fixed: in sideways full-screen at 844 wide, "Links" ran under More once the X was added. The Links figure now makes room at 900 wide or less, while the Sample Data badge shows.

## Checks (local, 2026-11-21)

Playwright at desktop 1440×900, 390×844, 360×740, 844×390 and 667×375:

| Check                  | Result                                                          |
| ---------------------- | --------------------------------------------------------------- |
| Opens on thin data     | Demo, badge on, $194,633 / 2,998 / 221                          |
| Switch to Live         | $25 / 1 / 1, status announced, cookie `bl_collective_view=live` |
| `?view=live`           | opens Live                                                      |
| Arrival line           | grows and fades; ticker names the same business                 |
| Phone preview and full | switch and badge under the title, clear of More and X           |
| Landscape 844 and 667  | inline switch, map full width, KPIs clear of More               |
| Console errors         | 0                                                               |

Round 2 (desktop 1440, 390×844, 360×740, 844×390):

| Check                   | Result                                                         |
| ----------------------- | -------------------------------------------------------------- |
| Follow a Dollar         | 4 stops, shop to grower; camera flies to each; card and status |
| Auto-advance, Next Stop | both move on; last stop offers Follow Another Dollar           |
| Escape                  | ends the trail, "Trail ended.", button no longer pressed       |
| Phone and landscape     | button in the map tools; card in the bottom sheet / right edge |
| Console errors          | 0                                                              |

## Tests

- `tests/collective-demo.test.ts`:
  - the `pickView` order;
  - about 400 businesses, every business floor with lines;
  - no links, `demo-` ids, unique names;
  - figures only at the total bar;
  - gaps present;
  - the same sample every time;
  - arrival timing and a stable pick per arrival;
  - supply lines one floor down, some crossing, services present, chained, stable;
  - trails start at a linked shop, follow supply lines, differ per dollar, and have no amounts.
- `tests/flow-map-page.test.ts`:
  - the server pick;
  - the switch with `aria-pressed` and the remembered choice;
  - the badge and Demo title;
  - nothing fetched or written;
  - arrivals wired to the scene;
  - the sideways preview fix;
  - supply and trail wired to the scene; Follow a Dollar in Demo only; the card's buttons; Escape ends it; the trail holds still without motion.

## Later

- When real activity passes 25 lines, Demo stops opening by itself. The switch stays.
- Whether to keep the switch once Live is full is a founder call for later.
