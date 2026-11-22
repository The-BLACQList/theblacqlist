# Ticket 249: Demo Mode for The Collective

**Status:** Built on `feat/249-collective-demo-mode`, 2026-11-21. Not merged.

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

## Tests

- `tests/collective-demo.test.ts`:
  - the `pickView` order;
  - about 400 businesses, every business floor with lines;
  - no links, `demo-` ids, unique names;
  - figures only at the total bar;
  - gaps present;
  - the same sample every time;
  - arrival timing and a stable pick per arrival.
- `tests/flow-map-page.test.ts`:
  - the server pick;
  - the switch with `aria-pressed` and the remembered choice;
  - the badge and Demo title;
  - nothing fetched or written;
  - arrivals wired to the scene;
  - the sideways preview fix.

## Later

- When real activity passes 25 lines, Demo stops opening by itself. The switch stays.
- Whether to keep the switch once Live is full is a founder call for later.
