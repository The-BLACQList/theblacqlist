# Flow map visual workshop and naming shortlist

**Date:** 2026-10-02
**Last updated:** 2026-10-03
**Status:** Workshop reopened at round 7 (spacing and shopper sizing) on top of the approved round 6 look (vision brief §8). Nothing built. Name decided: The Collective.
**Audience:** the founder, reacting to concepts before any spec
**Workshop page (private):** https://claude.ai/artifact/LECjHYpptLU3gU8nYJSa9C
**Explorer page, round 6 (private):** https://claude.ai/artifact/LRUwVrHAz5QiXx3zPFbFDV
**Vision brief:** `tiered-flow-map-vision-2026-10.md`
**Naming files (outside this repo):** round 1 `marketing-and-growth-os/projects/theblacqlist/05_messaging/naming/flow-map-naming-options-2026-10.md`; round 2 `.../flow-map-naming-options-round-2-2026-10.md` in the same folder

Every count, business and search on the page is sample data. No real BLACQList data and no real business names.

---

## 1. The three concepts

| Concept | What it shows | Best at | Main risk |
|---|---|---|---|
| A. 3D web (rotatable) | Five stacked tier planes, nodes colored by sector, shoppers as one band, a services and promotion side lane. Phase 1 shows tier totals as currents; Phase 2 shows confirmed links as threads. | The "above" relationship and the mission story | Exact numbers are hard to read; adds Three.js; may look empty at launch |
| B. Tier by sector grid | A real table. Rows are tiers, columns are sectors, shading counts businesses. Gaps are hatched. Optional demand layer and area filter. | Finding gaps with exact counts; it is also the accessibility fallback | No sense of flow; reads like a report |
| C. Gap finder (owner view) | One sample print shop's chain: tiers above, shoppers below, services to the side. Full, thin and gap states. Suggestions labeled "We suggest. You reach out." | A real next step for owners | Needs owners to pick a tier first; suggestions must not read as introductions |

[Recommendation] Treat B as required in every version (it is the fallback), and C as the owner payoff. The open choice is whether A is worth its cost on top of B.

## 2. Naming shortlist

**Chosen 2026-10-03: The Collective** (founder decision, see §8 round 5 reactions). It already labels the flow map link in the product nav on branch `feat/nav-the-collective`. "The Collective" is a common phrase with many existing marks, so it is weak as a standalone mark and works best as a feature name under the BLACQList mark. `[Needs professional review — IP attorney]` The shortlists below are kept for the record.

From the naming workshop (13 candidates across 6 styles). Every name is `[Needs professional review — IP attorney]`. No extra mark gets filed before the core BLACQList wordmark is protected.

| Rank | Name | Descriptor | Note |
|---|---|---|---|
| 1 (top pick) | Supply Map | Who makes, who sells, where the gaps are. | Plain and honest about Phase 1. Not ownable as a mark on its own. |
| 2 | Goldmap | Find where Black-owned businesses are, tier by tier. | Scored highest. Shares a name with a finance tool; "gold" near money can overclaim. |
| 3 | Root to Register | Every step from grower to shopper. | Long for nav; "root" can be heard as "route". |

**BLACQ Web risk.** [Observed] BLACKWEB is a registered US trademark of Walmart Apollo, LLC (Reg. No. 5622964, registered 2018-12-04, electronics and peripherals; source trademarks.justia.com, accessed 2026-10-02). "BLACQ Web" sounds the same. The naming file rules it out as a public name; it can stay as an internal code name. Domain and handle availability is `[Unknown]` for every name.

## 3. What any concept would need first

- A tier field on each listing, picked by the owner, with admin correction (GATE-DATA).
- A confirmed links table for Phase 2, both sides say yes (GATE-DATA).
- A clean top-level sector list for the grid columns.
- Demand data from "Bring your list" as anonymous totals only.
- Founder approval before a 3D library is added to the app.

## 4. Founder reactions (round 1)

Recorded 2026-10-02, in short:

- **Concept A:** the closest, but too structured. It should feel immersive, free, exploratory and discoverable. Clicking a node should light its flow path. Zooming into a category should show its subcategories.
- **Concept B:** keep it on the workshop page, with the gap finder.
- **Concept C:** keep it on the workshop page.
- **Name:** none of the round 1 names. All 13 are out.

Founder answers that shaped round 2:

- **Space:** galactic, with a clear up and down (tier) and a clear across (category).
- **Zoom:** category, then subcategory, then sample businesses, using the real category tree.
- **Format:** the explorer is its own full-screen private page. The workshop page keeps the grid and the gap finder and links to it.
- **Names:** three styles only. BLACQ plus one word (checked for how it sounds aloud), an evocative image, and a coined word.

## 5. Round 2

### The explorer

Private page: https://claude.ai/artifact/LRUwVrHAz5QiXx3zPFbFDV. The workshop page's Concept A now links to it.

- **The space.** No planes or rows. Each tier is a loose band: growers near the top, then makers, wholesale, and shops and services. Shoppers are one soft glow at the bottom, never single points. The 25 categories sit as clusters around the center, so angle means category. Service-type categories orbit a little further out.
- **Zoom.** Galaxy, then a category unfolds into its subcategories, then a subcategory shows its sample businesses at their tiers. Breadcrumb, Back and Esc step out.
- **Path.** Clicking a sample business lights its sample suppliers above, its shoppers below and the services beside it, and dims the rest. A side panel lists the path as text. Phase 1 shows the category's tier-to-tier current instead and names no partners, with the reason: links appear only when both businesses confirm.
- **Accessibility.** An "Explore as a list" drawer reaches every level with buttons, a live region announces each step, and reduced motion turns off drift, pulses and moving markers and cuts the camera instead of flying it.
- **Data.** Category and subcategory names are the real ones from `supabase/seed.sql`. Every count, tier and business is generated sample data with a fixed seed, under a permanent "Sample data" chip. No real business names.
- **Checked.** Headless preview at 1440×900 and 390×844 walked galaxy, category, subcategory, path and back out with no page errors `[Observed — Playwright, 2026-10-02]`. Not yet checked on a real phone `[Unknown]`.
- **Known limit.** In the category view, some subcategory labels hide to avoid overlap. Hover, the list drawer and the panel still reach all of them.

### Naming shortlist, round 2

From the round 2 naming file (three styles, none from round 1). Every name is `[Needs professional review — IP attorney]`. Domain and handle availability is `[Unknown]` for every name.

| Rank | Name | Style | Descriptor | Main risk |
|---|---|---|---|---|
| 1 (top pick) | BLACQ Expanse | BLACQ plus one word | Explore Black-owned businesses, from growers to shoppers. | Said aloud it can be heard as "Black Expanse"; "expanse" can read as empty |
| 2 | Deep Field | Evocative image | Look closer. Find who grows, makes and sells. | Nokia DeepField and two apps use the name |
| 3 | Nyotara | Coined (from Nyota, Swahili for star) | Every light a business. Every gap, a chance. | Spelling is shaky after hearing it; a discovery app uses Nyota |
| 4 | Night Orchard | Evocative image | Where Black-owned business grows, from the top down. | Earthy rather than galactic |

The workshop page's name switcher now uses these four, with BLACQ Expanse as the default.

### Founder reactions (round 2)

Founder, 2026-10-02, verbatim:

> "yes! We're getting there. I do want the nodes a bit larger. to be clearly entities. the size of the node indicates how much money flows through the entity (either in or out) with the ability to filter an in or out view for the flow. I also want some sort of color or visual indicator for different categories and different tiers. something that helps us navigate in a clean way. Give me options for this. Still don't like the names."

- Explorer: getting there. Wants bigger entity nodes, size by money flow with an in or out view, and color options for category and tier.
- Name: none of the four. Naming direction for round 3: "Money and movement, Short and punchy".

## 6. Round 3

Same private pages, republished at the same URLs.

### What changed in the explorer

- **Nodes are entities.** Each business is a solid disc, about 1.6 times larger than in round 2. Nodes on a lit path sit forward of the dimmed field.
- **Size means money flow, as a band.** Four sizes: not enough data, low, mid, high. Bands are thirds of the sample data. Under 5 transactions a business shows "Not enough data yet". No dollar amount is ever shown, in the node, the panel or the list.
- **In, Out or Both.** A switch sets what size measures: money coming in from buyers, money going out to suppliers, or both together.
- **Color options to compare.** One switch with three choices:

| Option | Node color | How you navigate | Trade-off |
|---|---|---|---|
| A. Sector | Six category families (Food and farm, Style and beauty, Health and care, Home, trades and travel, Culture and learning, Business services); each category is a shade of its family | Find a sector by hue, then tier by height | Most colorful; furthest from the gold brand look |
| B. Tier | One ramp from growers to shops | Find a step in the chain by hue | Clearest for the flow of money; category is only readable by position |
| C. Gold | Gold, as in the Gold Node Network | Color moves into the guides: tier bands on the ruler, family dots on labels | Most on-brand and calmest; least color help |

- **Spotlight.** Tapping a family or tier in the legend dims everything else. Tap again to show all. A live region announces it.
- **Checked.** Headless preview at 1440×900 and 390×844 across all three color options, In and Out, spotlight, category, subcategory and path, with no page errors `[Observed — Playwright, 2026-10-02]`. Not yet checked on a real phone `[Unknown]`.
- **Known limit.** At phone width some category labels on the left edge clip in the full map view. This was already true in round 2.

### Privacy flag on flow size

Showing how much money moves through a business can hint at its revenue, even as a band. The workshop keeps three guards and adds one open question:

- Bands only, never amounts.
- "Not enough data yet" under 5 transactions, matching the totals threshold in the vision brief.
- Bands are relative to the businesses shown, not fixed dollar ranges.
- Open: should a business's flow size show only if the owner opts in? `[Recommendation]` yes for Phase 2. `[Needs professional review]` before any real spend data feeds this view.

### Naming shortlist, round 3

Direction: money and movement, short and punchy. Naming file: `marketing-and-growth-os/projects/theblacqlist/05_messaging/naming/flow-map-naming-options-round-3-2026-10.md`. Every name is `[Needs professional review — IP attorney]`. Domain, handle and USPTO status are `[Unknown]` for every name.

| Rank | Name | Descriptor | Main risk |
|---|---|---|---|
| 1 (top pick) | Volley | Keep the dollar moving, business to business. | Volley is also a funded AI games company and a video messaging app |
| 2 | Baton | Pass the dollar to the next business. | Baton Market sells to the same small-business audience; "pass the baton" can read as selling your business |
| 3 | Dap | Hand to hand, from grower to shopper. | Can be heard as "dab" or crypto "dApp"; an older THE DAP APP filing needs checking |
| 4 | Braid | Every tier, woven together. | May read as a hair braiding filter on a platform that lists braiders; a payments app used the name until 2023 |
| 5 | Pulley | Money goes up. Goods come down. | Pulley is cap table software; more mechanical than warm |

**Main finding.** Most money-and-movement words (Relay, Current, Flux, Loop and similar) are already fintech brands. That is why the shortlist uses everyday words, and why each one works best as a feature name that leans on the BLACQList mark, for example `theblacqlist.com/volley`, rather than as a standalone brand. No coined word passed the spell-it-after-hearing-it test.

Both pages default to Volley; the name switcher holds all five.

### Founder reactions (round 3)

Recorded 2026-10-03. Verbatim:

> "we're so close. I like the colors. The nodes are still quite close together. the buyers are also very ambiguous as well. the experience should feel vast as if the user can "travel through" it, so it doesn't need to be compact. Each category could almost feel like its own "neighborhood" to the user zoomed in far enough. The more money flowing through an entity, the larger it should be. If a store is selling to 2 different customers, we should see 2 different buyer nodes (even if they're anonomyzed.) same for 100 customers. This environment should feel VAST. Let's workshop it"

Answers to the three follow-up questions:

- Travel: guided flights plus look around.
- Shoppers: one dot per shopper, linked to each business they buy from.
- Layout: spiral arms by color family.
- Color: kept as is (Sector default, Tier and Gold still available).
- Name: no new reaction. Volley stays the default.

## 7. Round 4

Same private pages, republished at the same URLs on 2026-10-03.

### What changed in the explorer

- **A vast space.** Six spiral arms reach out from a bright core, one arm per color family. The categories in each family sit far apart along their arm. Far neighborhoods fade with distance, and faint dust along the arms gives a sense of motion while flying.
- **Neighborhoods and districts.** Each category is its own neighborhood, a tall column with growers at the top, shops lower down and its shoppers underneath. Subcategories are districts with ground labels. Each business stays in its district, so the round 2 "unfold" is gone.
- **Size grows with money.** Size now rises smoothly with sample money moving (square root of flow against the largest in view), for In, Out or Both. Under 5 transactions a business keeps a small fixed size and the "Not enough data yet" ring. No numbers anywhere.
- **One dot per shopper.** Every sample shopper is one small, pale, anonymous dot. A store with 2 shoppers has 2 dots and a store with 100 has 100. A shopper who buys from several businesses has a thread to each, so shared customers and circulation across neighborhoods show. Threads appear only inside the neighborhood you are in.
- **Selecting a business** lights its shoppers' threads and a dimmer second hop to the other businesses those shoppers use. The panel gives counts only, for example "20 shoppers · 16 of them also shop at 15 other sample businesses".
- **Guided flights plus look around.** Tapping a place flies the camera along a long raised arc. Next and Previous (buttons, list drawer, or the `[` and `]` keys) step along the arms and wrap to the next arm. Once there, drag to look and scroll to move closer. Reduced motion cuts instead of flying and announces "Now at …".
- **List drawer** is grouped by arm, then neighborhood, then district, then business, and drives the same flights.
- **Sample size.** 845 sample businesses and 16,485 sample shoppers on desktop (24,762 purchase links, 686 shoppers who cross neighborhoods). Phones cap links per business at 60, which gives about 12,700 shoppers.
- **Checked.** Headless preview at desktop, phone and reduced motion: galaxy, neighborhood, district, Phase 2 and Phase 1 selection, Next and Previous wrap, and the drawer reaching all 6 arms, 25 neighborhoods and 166 districts, with no page errors `[Observed — Playwright, 2026-10-03]`. Not yet checked on a real phone `[Unknown]`.
- **Known limits.** Some neighborhood labels overlap in the full galaxy view. The galaxy runs past the bottom of the screen at the start, which is deliberate.

### Privacy notes

- **Shopper dots in the sample.** Dots cannot be clicked or hovered and have no labels, attributes or times. Positions are jittered. The panel never lists a single shopper, and the "also shop at" line shows only at 5 or more.
- **Continuous size.** Smooth size hints at a business's revenue more closely than round 3's bands did. For real data, the recommendation is about 8 coarse size steps plus owner opt-in `[Recommendation]` `[Needs professional review — privacy counsel]`.

### Decision needed

> **Conflict to resolve before any real data.** The vision brief says "Consumers stay a group" (`tiered-flow-map-vision-2026-10.md`, §3), which follows the logged F-4 §2C decision not to build consumer nodes. One dot per shopper goes against it. The founder directed shopper dots for the sample explorer only. For the real product, F-4 §2C stands until the founder logs a new decision, and that decision needs a privacy review first. The vision brief is unchanged.
>
> Open questions for that decision:
> 1. Should real shopper dots show at all, or stay a group as the brief says?
> 2. If dots show, should a business need at least 5 shoppers before any of its dots appear?
> 3. Should money-based size need the owner to opt in?

### Founder reactions (round 4)

Recorded 2026-10-03.

> "no. this isn't it. the last one was better. You could get closer to the nodes and the connections between the entities should be visible toggle on or off. Now I can't get close to anything"

- Verdict: round 4 rejected. Round 3 was better. The spiral arms and guided flights are set aside.
- Closeness: must be able to get right up to the nodes.
- Shoppers: keep one dot per shopper (picked "One dot per shopper").
- Links: a three-way switch, Off / Businesses / All.
- Style: "take inspiration from the network maps on flourish" (https://flourish.studio/), with a Flourish network screenshot: ringed logo discs, names under each node, arrowheads partway along each edge, and click focus that keeps the node and its partners sharp while the rest fades.
- Picked "3D map, Flourish style", adding: "it's a directional network map, but 3d".
- Name: no new reaction. Volley stays the default.

## 8. Round 5

Same private pages, republished at the same URLs on 2026-10-03.

### What changed in the explorer

- **Back to round 3.** The round 3 galaxy, colors (Sector, Tier, Gold), size bands (In, Out, Both), levels and Phase 1 / Phase 2 are restored. The round 4 spiral arms, smooth sizes and guided flights are gone.
- **Close zoom toward the cursor.** Scroll zooms toward whatever is under the pointer, down to about 1 unit from a single business. A desktop preview went from the category view to one business in about 40 wheel ticks.
- **Links switch: Off / Businesses / All.** Off hides every link. Businesses draws the 2,804 sample supply and service links as curved lines (gold for supply, violet for services). All adds a faint thread from each shopper to each business they buy from.
- **One dot per shopper.** Kept from round 4 and placed under the round 3 layout: 845 sample businesses, 16,740 sample shoppers, 24,762 purchase links.
- **Flourish-style nodes.** Each business is a solid disc with a pale cream ring and a dark edge, colored by the current color option. Within reach of the camera, its name shows underneath, up to 40 at a time (18 on phones). Shopper dots stay small and ringless so they never read as businesses.
- **Arrows show money direction.** Every business link has one arrowhead partway along. Money flows from the buyer to the seller (down-tier pays up-tier for supply) and from a client to the service it hires. Arrows show only in Phase 2 with Links not Off.
- **Focus.** Clicking a business keeps it and its direct partners sharp, named and brightly linked, with its shoppers lit. Everything else fades to a ghost. Hovering on desktop gives a lighter preview after a short delay. Esc, Back or a click on empty space clears focus. Phase 1 lights the business only and names no partners.
- **Checked.** Headless preview at desktop, phone and reduced motion: galaxy with Links Off, Businesses and All, a category with arrows, close zoom (camera-to-target distance 1.2), focus with 8 named members, Phase 1 focus of 1, Esc clearing focus, with no page errors `[Observed — Playwright, 2026-10-03]`. Not yet checked on a real phone `[Unknown]`.

### Privacy notes

- **Shopper dots** remain unclickable, unlabeled and jittered. The panel gives counts only.
- **Size** is back to round 3's four bands (not enough data, low, mid, high), so the round 4 smooth-size concern no longer applies to the sample.

### Decision needed

> **Still open from round 4.** One dot per shopper goes against the logged F-4 §2C decision that consumers stay a group (vision brief §3). The founder kept shopper dots for the sample explorer. For the real product, F-4 §2C stands until the founder logs a new decision after a privacy review. The vision brief is unchanged.

### Founder reactions (round 5)

Recorded 2026-10-03.

- Verdict: "this is the closest it's been so far. we'll give it some video game functions and upgrade the interactions a bit, but this is definitely moving in the right direction. this is the general idea"
- Picks for round 6: Fly controls, Follow the dollar trails, Click to fly and orbit, Money moving on links, Richer hover cards, Search and jump. Build round 6 now on top of round 5, same links.
- Drag: "I also like the click the entity and drag it along with it's connections a bit like flourish does. just a fun interaction"
- Spacing: "the nodes are still quite close together within groups. they could stand to breath a bit more." Then: "there's so much 'space' yet everyone, customers included, seem so bunched up." Keep the grouping, with more room toward the center and outward, upward "where things can have more space and size", and downward "where more customers can fit almost infinitely."
- Name: "We're also using the name 'The Collective'". Founder decision. Volley and the other round 3 candidates are retired to an "Also considered" list.
- Not answered directly: closeness, arrows, focus strength, Links default. Read as accepted, since round 5 is "the general idea".

## 9. Round 6

Same private pages, republished at the same URLs on 2026-10-03. Round 5 stays the base. Round 6 adds a game layer and more room.

### What changed in the explorer

- **Name.** The page and header read The Collective. The working-name picker is gone. Tagline kept: "Keep the dollar moving, business to business." (founder to confirm).
- **Room to breathe.** Wider clusters plus a deterministic relaxation pass inside each category, rings pushed apart, tiers stacked about twice as tall, and the shopper cloud spread far below the shops. Median nearest-neighbor distance inside a category went from about 2.9 to 11.3 units `[Observed — Playwright, 2026-10-03]`. The sample data is unchanged: 845 businesses, 2,804 links, 16,740 shoppers, 24,762 purchase links.
- **Fly controls.** WASD or arrows, Shift to boost (about 3x), Q and E for down and up. Speed scales with distance, so it works at galaxy scale and next to a disc. Keys are ignored while typing. Phones keep touch only.
- **Click to fly and orbit.** Clicking a business flies to it with its partners in view and orbits slowly. Any drag, scroll or key takes control back. No orbit with reduced motion.
- **Money moving on links.** Sparks travel each link in the money direction (gold for supply, violet for services), in one draw call. Phase 2 with Links on only, and never with reduced motion. Static arrows remain.
- **Richer hover cards.** Tier, category and subcategory, flow band, buys from / sells to / across counts (Phase 2 only), and shopper count. Phase 1 cards say partners show in Phase 2. Never an amount.
- **Search and jump.** An ARIA combobox for businesses, categories and subcategories. "/" focuses it, arrows and Enter pick, Esc closes without leaving the current selection.
- **Follow a dollar.** A mission card follows one anonymous sample shopper's dollar from the shop up the chain, at most 5 stops, ending at a grower or the end of the chain. Next stop, Fly it myself (fly through the glowing gate), or End trail. Runs in Phase 2 and says why.
- **Drag a business (Flourish style).** Press on a business and move more than 6px to drag it. Its partners follow on a spring and links stretch. On release everything springs home, so heights keep their meaning. A short press still selects. No drag for keyboard users; it carries no information.
- **Smaller fixes.** The tier ruler hides its header and crowded tick names instead of overlapping, and is hidden at the whole-map level on phones, where it sat on the category names.
- **Checked.** Headless preview at desktop, phone and reduced motion: title and name, spacing, fly (W keeps distance, Shift farther, E up, typing does not fly), search and lock-on with orbit, Esc in search, wheel stops orbit, sparks on and off, hover card text, drag and spring home, short press selects, a full 5-stop trail, no horizontal scroll on a 390px phone, no sparks or orbit with reduced motion, and no page errors `[Observed — Playwright, 2026-10-03]`. Not yet checked on a real phone or with a real keyboard and trackpad `[Unknown]`.

### Privacy notes

- **Trails** follow one anonymous sample shopper from shop to shop. A real shopper trail would rest on the same open F-4 §2C decision, and it would also show where one person spent. The panel and the mission card both say so.
- **Hover cards** show counts and bands only, never amounts.

### Decision needed

> **Still open.** One dot per shopper, and now shopper trails, go against the logged F-4 §2C decision that consumers stay a group (vision brief §3). Both stay in the sample explorer only. For the real product, F-4 §2C stands until the founder logs a new decision after a privacy review. The vision brief §8.4 records this as not adopted.

### Founder reactions (round 6)

Recorded 2026-10-03.

- Verdict: "lovely so far, add it to the plan". Round 6 is now the chosen look and feel in `tiered-flow-map-vision-2026-10.md` §8.
- Not answered one by one: fly speed, trails, orbit speed, sparks, search, spacing, drag springing home. Read as accepted as built.
- Still open: the tagline "Keep the dollar moving, business to business.", and the shopper dots and trails decision (F-4 §2C, vision brief §8.4).

## 10. Round 7

Same private pages, republished at the same URLs on 2026-10-03. Founder ask: "spread the entities out more vertically and horizontally. customer nodes are proportional in size to spend as well."

### What changed in the explorer

- **Taller.** Tier heights now run from 330 (growers) down to -70 (shops and services), with the shopper layer starting at -170 and reaching about 380 units further down. The business tiers span 400 units, about twice round 6.
- **Wider.** Bigger cluster radius, more space between businesses inside a category, category rings pushed out (goods ring at least 260, services a further 180 out), and a wider fan when a category or subcategory opens. Median nearest-neighbor distance inside a category went from 11.3 to about 17.8 units `[Observed — Playwright, 2026-10-03]`.
- **Shoppers sized by spend.** Each sample shopper gets a sample spend (generated, with its own seed, so counts and links do not change). Dot area grows with spend: size runs from about 1.1 to 6, rising steadily with spend `[Observed — Playwright, 2026-10-03]`. No amount is ever shown and dots stay unclickable. Shoppers under the category you are looking at are brighter, so the size differences read.
- **Dots never vanish.** The point shader keeps a minimum on-screen size, so relative sizes still read from the whole-map view.
- **Framing.** Opening a category frames its whole column from growers down to its shoppers. Lock-on distance allows up to 110 units, since partners now sit farther apart. A trail lights up the shopper it starts from. On phones the home view aims a little lower, so the map sits higher under the stacked controls.
- **Unchanged sample data:** 845 businesses, 2,804 links, 16,740 shoppers, 24,762 purchase links, 461 shoppers across categories.
- **Checked.** All round 6 checks still pass, plus spacing of at least 15, spend sizing rising steadily with spend, and taller tiers. Desktop, phone and reduced motion, with no page errors `[Observed — Playwright, 2026-10-03]`. The "typing does not fly" check now allows tiny leftover drift, measured against view distance, because the map is bigger. Not yet checked on a real phone `[Unknown]`.

### Privacy notes

- **Spend sizing reveals relative spend.** A bigger dot shows that one person spent more than others, even with no amount shown. It is stronger than one dot per shopper, and it stays sample only. It rests on the same open F-4 §2C decision.
- **Recommended product version:** keep the shopper tier as a band and size the band, or each category's slice of it, by total spend, shown only above a minimum shopper count `[Recommendation]`.

### Founder reactions (round 7)

Recorded 2026-10-03.

- Verdict: "it's close but not quite there. let's visually workshop some options in the same family for the interaction as well as the page itself."
- What felt off, all four: the screen is heavy with controls, the phone is cramped, the map is hard to read, and moving around is hard.
- Format asked for: one explorer page with a live switcher, and three bundled concepts, each pairing a page layout with a way of moving.
- Spacing and spend sizing were not called out, so round 7 stays the base for the map itself.

## 11. Round 8: three concepts

Same private pages, republished at the same URLs on 2026-10-04. The explorer now has a Concept switcher in the bottom right corner: R7 (round 7 as it was), A, B and C. The pick is remembered on reload, and a link can open a concept directly with `#concept=a`, `b` or `c`. The map, colors, sizes, sample data, search, Follow a dollar, sparks, drag, hover cards, Explore as a list, reduced motion and the no-WebGL fallback are the same in all of them.

### A. Cockpit

Keep free flight, strip the screen back.

- **Screen.** One slim top bar with the mark, search (`/` or Cmd/Ctrl+K) and one View button. Phase, Color, Size, Links, the legend and Follow a dollar all sit in the View popover (Esc closes it and returns focus). The panel only slides in once you pick something. The map gets about 95% of the screen on desktop.
- **Phone.** One top row. View opens as a bottom sheet. The panel is a short sheet you pull up.
- **Reading.** Four faint gold rings, one per tier, with the tier name at the edge. They replace the side ruler.
- **Moving.** Free flight stays (WASD, Q and E, Shift), but the horizon stays level. A reticle in the middle names what is ahead. The `[` and `]` keys hop to the nearest business and F locks on. The plan said Tab and Shift+Tab; brackets were used so Tab keeps moving focus through the controls.

### B. Guided

The camera rides rails and you step through the map.

- **Screen.** Just a small mark at the top and a four-button dock at the bottom: Search, Follow a dollar, Phase and View. A caption card shows what is selected.
- **Phone.** Everything you tap is in the bottom dock. Swipe for the next category, pinch to go in or out.
- **Reading.** The tilt is locked so the tiers sit level. The tier you are on is bright and the others fade back, with a big caption naming it.
- **Moving.** No free flight. Left and Right step category, Up and Down step tier, Enter goes in, and one scroll tick goes in or back out.

### C. Atlas

Reading first.

- **Screen.** A fixed column on the left holds search, an index of every tier, category and subcategory with counts, the details of what you picked, and the legend. The map fills the rest. Nothing sits on top of the map. Buttons switch between a 3D, side and top view.
- **Phone.** A clean split: the map on top, a list you scroll below.
- **Reading.** Side view turns the tiers into rows. Top view turns the categories into a ring. Hovering a row in the index lights its group on the map.
- **Moving.** Click and read: pick anything in the index or on the map and the camera flies there. Drag turns the map within limits, scroll zooms. No keys to learn, and no auto orbit.

### Checked

- Round 7 baseline in the R7 slot: all 31 round 7 checks pass and the sample totals are unchanged (845 businesses, 2,804 links, 16,740 shoppers, 24,762 purchase links, 461 across categories) `[Observed — Playwright, 2026-10-04]`.
- Shared checks for A, B and C: 59 checks at desktop (1440x900), phone (390x844) and reduced motion, covering screen share taken by controls (desktop A 4%, B 6%, C 26% for the column; phone A 5%, B 15%), search, lock-on, drag, Follow a dollar, no flights, sparks or orbit with reduced motion, the switcher surviving reload, and no horizontal scroll or page errors `[Observed — Playwright, 2026-10-04]`.
- Per concept: A rings, reticle, level horizon, `[` and `]` hops, View popover and Esc, Cmd+K. B stepping by arrow key, Enter, one wheel step, swipe and pinch on phone, level tilt after a drag, WASD off. C side and top views, index hover and click, no auto orbit, WASD off, phone map at about 55% of the height `[Observed — Playwright, 2026-10-04]`.
- Fixed during checks: map names and the ruler no longer slide under the floating crumbs in A and B, and the Atlas column no longer scrolls inside itself on desktop.
- Known and left alone: on phones the switcher pill sits over the top right of the map (it is a workshop control, not part of any concept). The round 7 ruler can still touch a category name in R7 and C, as before.
- Not yet checked on a real phone, keyboard or trackpad `[Unknown]`.

### Privacy notes

- Nothing new. Shopper dots, trails and spend sizing are still sample only in all four slots and rest on the open F-4 §2C decision (see round 7). The vision brief is unchanged until a concept is picked.

### Founder reactions (round 8)

4 Oct 2026: "B is the best so far. The nodes within a group are still too close together and a bit small and I want the arrow key fly capabilities as well as the old scroll capabilities back. I need to be able to go in, out and through. Almost like a galactic neighborhood." `[Observed — founder, 2026-10-04]`

So B (Guided) is the base going forward. A, C and R7 stay in the switcher for comparison. No concept is added to the vision brief yet.

## 12. Round 9: B, opened up

B keeps its page: the small mark, the bottom dock, the big tier caption and the tier spotlight. It gets its freedom back, and it now opens by default.

### What changed in the explorer

- **Roomier neighborhoods.** Businesses inside a group sit much farther apart. The median gap to the nearest neighbor went from about 17.8 to about 30.7 map units `[Observed — Playwright, 2026-10-04]`.
- **Bigger nodes.** Every business dot is about 1.45 times its round 8 size.
- **Free flight in B.** WASD or the arrow keys fly, Q and E drop and rise, Shift boosts. The tilt is no longer locked; it is clamped just short of straight up and straight down.
- **Scroll in, out and through.** Scroll zooms toward the pointer, as in round 7. Once you are close, scrolling in keeps moving you forward, so you pass through a neighborhood instead of stalling at it. Each tick steers a little toward the pointer and levels out a little, so you carry on across the ring to the next neighborhood rather than out the bottom. Scrolling over a category name now zooms too, instead of doing nothing.
- **Stepping kept on new keys.** `[` and `]` step category, PgUp and PgDn step tier, 1 to 4 spotlight a tier (press it again for all tiers), Enter goes in.

### Checked

- 72 of 72 preview checks pass, no page errors `[Observed — Playwright, 2026-10-04]`. That covers the round 7 baseline with unchanged sample totals (845 / 2,804 / 16,740 / 24,762 / 461), all three concepts at desktop, phone and reduced motion, and the round 9 checks: B is the default, W and the arrows move the camera, free tilt, scroll in and out, pass-through (the camera moves about 148 units through a neighborhood and stays close), the step keys and Enter, and spacing at least 1.4 times round 8.
- Screen share taken by controls in B: desktop 6%, phone 15% `[Observed — Playwright, 2026-10-04]`.
- Known and left alone: on phones B uses normal touch orbit, pinch and two-finger pan, with no pinch pass-through and no swipe stepping. The switcher pill still sits over the top right of the map on phones. After passing through you sit a little below the business band; E rises, a drag tilts. Up close, nodes become large discs.
- Not yet checked on a real phone, keyboard or trackpad `[Unknown]`.

### Privacy notes

- Nothing new. Shopper dots, trails and spend sizing are still sample only and rest on the open F-4 §2C decision.

### Founder reactions (round 9)

4 Oct 2026: "It's still a bit confusing. Let's come up with some more redesign ideas that may help it visually land with users." `[Observed — founder, 2026-10-04]`

Follow-up answers the same day:
- What's confusing: where to look first, and what it shows.
- Who it's for: shoppers and business owners, equally.
- How far to go: anything goes.
- Format: quick mockups first, then build only the one or two picked.

So round 10 steps back from the explorer and tries six different pictures of the same sample data. The round 5 to 9 questions above are parked until a direction is picked.

## 13. Round 10: six redesign ideas

Six quick mockups, as stills and short storyboards on the workshop page. They are not interactive, and the explorer did not change (it still opens on B). Every idea answers both problems the same way: one first view with a "Start here" marker, a plain-words key built into the picture, and a choice between "I'm shopping" and "I run a business". All six use the explorer's sample data and tokens.

### The six ideas

1. **Follow one dollar.** A five-tap story before any map. One sample shopper buys dinner, and the dollar climbs one floor per tap: restaurant, wholesaler, maker, grower. The last frame opens the Food & Dining map with that dollar still lit. It teaches money up, goods down before showing a cloud of dots, and it can sit in front of any map, including B. Cost if picked: low.
2. **Neighborhoods first.** The first view is 25 labeled circles, sized by business count, each with a tiny four-floor bar and a dashed mark where a floor is empty. Going in shows its floors, then its streets, then one street's businesses. It removes the 845-dot cloud. Cost: medium.
3. **The block.** Each neighborhood is a building on an isometric block. Growers are the rooftop garden, makers the workshop, wholesale the warehouse, shops the storefront. Shoppers walk the street as a crowd. A missing floor is an empty, dashed floor. Cost: high, as a new scene with new art.
4. **Star systems.** The galactic neighborhood read flat. Shoppers are the sun in each system. Shops orbit closest, then wholesale, makers and growers. An empty orbit is a dashed ring. Cost: medium-high.
5. **Supply lanes.** Flat rows, one per neighborhood. Growers on the left, then makers, wholesale and shops, with shoppers as one band on the right. Goods run right and money runs left. The easiest to read, and the natural accessible fallback for any 3D pick. Cost: low-medium.
6. **Start from me.** Opens on one business and only what touches it: the owner's own business, or for a shopper a sample place near them. Suppliers above, shoppers below as a group, partners to the side, and empty seats such as "Grower for restaurants: none here yet" with an invite link. Tap any business to move it to the middle. Cost: medium.

### Fixes that work with any pick

An entry choice; a "Start here" marker; color by tier, not by neighborhood; one gap symbol (a dashed empty seat); money and goods arrows in the key; links hidden until something is picked; tier names on the tiers themselves.

### Critique

A separate design critic ran a five-second test on every first view, desktop, phone and owner `[Observed — design-critic agent, 2026-10-04]`.
- Pass: Follow one dollar, Supply lanes, Start from me.
- Risk, fixed: Neighborhoods first (labels now 12px or more, counts dropped on small circles, the bar meaning moved into the main text); Star systems (a pinned "Each sun = shoppers, as a group" key); Follow one dollar's faded future tiers made easier to see.
- Fail, fixed: The block. Labels crowded the buildings and "Start here" pointed at empty sky. Now only the start building is named, inside its pill on its roof; one sample tap card shows how other names appear; the phone view fills the width.
- Fastest to land, per the critic: for shoppers, Follow one dollar then Start from me; for owners, Supply lanes then Start from me.
- All frames re-shot with no page errors, and the workshop page passes at desktop and phone with every image loading `[Observed — Playwright, 2026-10-04]`. Not yet seen on a real phone `[Unknown]`.

### Privacy notes

- All six show shoppers only as a group: a band, a street, a crowd or a sun, with counts. None use shopper dots, trails or spend sizing, so none depend on the open F-4 §2C decision. The vision brief is unchanged until a direction is picked.

### Founder reactions (round 10)

On 2026-10-04 the founder picked ideas 1, 2, 5 and 6 as the most interesting: Follow one dollar, Neighborhoods first, Supply lanes and Start from me `[Observed — founder, 2026-10-04]`. Their answers on next steps:
- Build all four side by side, each behind a switcher, and pick a winner after trying them.
- Make them clickable prototypes: flat 2D, tap on phone, click on desktop, sample data, on a new separate page. The explorer stays as it is.
- 2D now. Decide about 3D later.

The Block and Star systems are set aside for now.

## 14. Round 11: four clickable prototypes

One new page holds all four ideas behind a switcher, with an "I'm shopping / I run a business" chooser at the top. Everything is flat 2D on the same sample data (845 sample businesses, 2,804 sample links). It works by tap on phones and by click or keyboard on desktop. The round 9 explorer is untouched.

- **1 · Follow one dollar.** A five-step story. Tap the question mark to follow the money from a sample restaurant up to its wholesaler, maker and grower. Then the map opens on that neighborhood with "You are here" marked. Any business there can be tapped.
- **2 · Neighborhoods first.** It opens on 25 neighborhood circles, each with a small four-floor bar and a badge counting streets with a missing floor. Tap a neighborhood to see its streets, then a street to see its businesses. On phones the circles sit in a tidy grid, biggest first.
- **3 · Supply lanes.** One row per neighborhood, running growers, makers, wholesale, shops, then shoppers as a band. A dashed line marks a missing link. Tap a row to open it, then tap a dot to see who that business buys from and sells to.
- **4 · Start from me.** One business sits in the middle, with its suppliers above, its buyers below and its partners to the side. Empty seats read "No wholesaler yet", and owners get an "Invite one" button. Tap any business to move it to the middle. A trail of steps lets you go back.

Each view has a "Start here" marker, a plain-words panel, a list fallback, breadcrumbs and a Back button.

### Critique

A separate design critic ran a five-second test on every first view `[Observed — design-critic agent, 2026-10-04]`. Its ranking for clarity: Start from me, then Follow one dollar, then Supply lanes, then Neighborhoods first. It suggested Start from me as the base, with Follow one dollar as its onboarding tour.

Fixed before publishing:
- Phone neighborhood labels collided. They are now a grid.
- The middle title in Start from me sat on its own arrows. It now has a dark plate.
- On phones, "You are here" covered the shopper count.
- Phone lane headers were cut off ("Whlsale", "Shoppers").
- The lanes had no reading-direction line.
- Two faint labels needed more contrast.

All views were re-shot at desktop and phone with no page errors and no sideways scroll `[Observed — Playwright, 2026-10-04]`. Not yet tried on a real phone `[Unknown]`.

### Privacy notes

- All four show shoppers only as a group, with counts. None use shopper dots, trails or spend sizing, so none depend on the open F-4 §2C decision. The vision brief stays unchanged until a direction is picked.

### Founder reactions (round 11)

On 2026-10-04 the founder said: "i like 1, 2, and 3. i like pieces of each. I would like 3d to come back to make the visualization easier, but I like how easy it is to see a gap in the supply chain" `[Observed — founder, 2026-10-04]`. Their answers:
- "1, 2 and 3" means the first three tabs: Follow one dollar, Neighborhoods first and Supply lanes. Start from me drops out `[Decision — founder, 2026-10-04]`.
- 3D comes back. Show two or three 3D looks behind a switcher.

## 15. Round 12: one flow, three 3D looks

Prototype: https://claude.ai/artifact/LjtVVanbn3Sa1RP8NX14H3 (private, sample data). Rounds 9 and 11 stay at their own links for comparison.

### The flow

The three ideas the founder liked are blended into one path, and every look runs the same path:
1. **Dollar tour (from Follow one dollar).** Four steps. A gold coin carries one sample dollar from the shopper to a sample restaurant, then up to its wholesaler, maker and grower. "Skip to the map" is always on screen.
2. **Neighborhoods overview (from Neighborhoods first).** All 25 neighborhoods, each with its four floors (shops, wholesale, makers, growers). "Start here" marks Food & Dining.
3. **Inside a neighborhood (from Supply lanes).** Tap one and the camera flies in. Its streets unfold into supply lanes running growers, makers, wholesale, shops, then shoppers as a group. A broken lane is a gap. Tap a business to light up who it buys from and sells to.
4. **Show gaps.** One button on every level dims everything except the gaps. Each gap gets a numbered pin tied to it by a leader line, and the panel lists the same numbers in plain words ("Books: no growers yet"). The button shows the count, so a gap can be spotted before it is pressed.

The same chrome as round 11 stays: the shopping or business chooser, the plain-words panel and legend, breadcrumbs and Back, and a list picker on every level for keyboard and screen readers.

### One gap symbol

A gap looks the same everywhere: a dashed, hollow, glowing shape in pink (#ff8ccf). Pink was chosen after the first critique, because the earlier tan read as one more shade of gold.

### The looks

| Look | Overview | A gap is |
|---|---|---|
| **A · Towers** | 25 towers on a dark ground, one floor per kind of business | a dashed glowing box where a floor should be |
| **B · Spokes** | a tilted wheel with shoppers in the middle and growers on the outside, one spoke per neighborhood | a dashed break in the spoke |
| **C · Rings** | floating clusters, each neighborhood a stack of four rings (closest to the round 9 galaxy) | a dashed glowing ring |
| **Flat** | round 11's ideas 1, 2 and 5 as they were | as in round 11 |

Flat is also the fallback when a device has no WebGL. Under reduced motion the camera cuts instead of flying, and the gaps don't pulse.

### Checks

257 automated checks pass `[Observed — Playwright, 2026-10-04]`. They cover every look at the tour, overview, gaps view, inside view and a picked business, at desktop and phone. They also cover the no-WebGL fallback, reduced motion, the Flat tab and the copy rules (no em dashes, no dollar amounts). They check for page errors, sideways scroll, blank canvas, missing labels and wrong breadcrumbs. Not yet tried on a real phone `[Unknown]`.

### Critique

A separate design critic ran a five-second gap test, asking whether a first-time shopper or owner can spot a missing link `[Observed — design-critic agent, 2026-10-04]`.
- **Round 1 (iterate).** The tan gap colour was too close to gold. Rings was hard to read. Tags collided, and phone tags piled up. Fixed with pink, bigger rings, leader lines, numbered pins on phone, a count on the Show gaps button and taller missing floors in Towers.
- **Re-check.** Pink, phone and the inside views passed. The Rings overview still failed: 25 always-on labels and a weak gap ring. Desktop tags crowded in Towers and Spokes. Fixed by naming only the family clusters in Rings until you go inside, making its gap ring larger and brighter, and using numbered pins on desktop too.
- **Ranking for spotting gaps:** 1 Spokes, 2 Towers, 3 Rings.
- **Still open (minor):** Towers keeps a dark band at the top of the canvas. Some street names drop out on phone lanes to avoid overlap.

### Privacy notes

- Shoppers appear only as a group, with counts. Nothing uses shopper dots, trails or spend sizing, so nothing depends on the open F-4 §2C decision. The vision brief stays unchanged until a direction is picked.

### Founder reactions (round 12)

On 2026-10-08 the founder wrote: "Spokes are by far the best of the 3, but still not quite it. Take inspiration from the Assassins Creed Skills tree star map as well as our own loading screen and hero image for the current collective cover page along with the interaction capabilites of our flourish research. Some blend of these things would be ideal."

Read as: keep the Spokes layout, change how it looks and feels. Round 13 does that.

## 16. Round 13: Star map

Prototype: https://claude.ai/artifact/VuREuXfQ9qG3SAadyQbZMk (private, sample data). Round 12 stays at its own link for comparison.

### The blend

The Spokes wheel keeps its layout (shoppers in the middle, then shops, wholesale, makers and growers on rings going out, one spoke per neighborhood). Everything else is redrawn from four sources.

| Source | What it gives the star map |
|---|---|
| **Spokes (round 12)** | The layout, the dollar tour, Show gaps with numbered pins, and the lanes inside a neighborhood |
| **A skill tree star map in a video game** | A dark starfield with faint nebula tints per family. Each neighborhood is a constellation with a big anchor star at the rim. Dotted orbit rings, one per floor. An empty socket means a floor is not filled yet. Neighborhoods you open stay lit, with "Explored N of 25" in the panel. |
| **Our loading screen** | The gold Q in the middle with its halo. The map builds in like the loader: stars pop in ring by ring from the centre, and lines draw once both ends are in. Then one gold pulse runs outward and the camera tilts into the wheel. It plays once per visit, and "Skip to the map" is always on screen. |
| **The Collective cover (the coming-soon gold network)** | Thin gold lines on near-black. Stars near the cursor brighten. A click sends out a ring and five gold dots along that star's links. A slow pulse leaves the centre every few seconds, and sparks run along lit spokes in the direction money moves. |
| **Flourish research (rounds 5 and 6)** | Hover cards (counts, never amounts). A picked business fades everything else, and the camera sways slowly around it. "/" opens search. WASD or arrows fly, Q and E go up and down, Shift goes faster. Drag a star inside a neighborhood and its partners follow on a spring, then everything springs home. Esc backs out one level. |

Inside a neighborhood, each street is drawn as a chain of stars (growers, makers, wholesale, shops, then shoppers as a group) instead of cells. A broken chain uses the same pink socket and dashed break.

The switcher offers **Star map** (default), **Spokes (r12)** for comparison, and **Flat** (also the fallback with no WebGL). A Pause motion button stops all ambient motion. Under reduced motion there is no intro, no pulses or sparks, and the camera cuts instead of flying.

### Checks

212 automated checks pass, plus a separate check of the new gap note at desktop and phone `[Observed — Playwright, 2026-10-08]`. They cover Star map and Spokes at the tour, overview, gaps view, inside view and a picked business, at desktop and phone, and the no-WebGL fallback, reduced motion and Flat. New for this round: the intro shows Skip and ends on its own, Skip works, a reload does not replay it, W moves the camera, the explored count goes up, "/" search routes to a neighborhood, the hover card appears, a dragged star springs home without moving the camera, Esc backs out twice, and Pause motion toggles. Not yet tried on a real phone `[Unknown]`.

### Critique

A separate design critic ran two tests `[Observed — design-critic agent, 2026-10-08]`.
- **Does it read as the BLACQList constellation and a star map, not a generic network graph?** Pass.
- **Five-second gap test.** Pass with Show gaps on, and Pass inside a neighborhood. Fail at rest on the overview: gaps did not stand out until Show gaps was pressed. Also a Fail for clutter: the ring names sat on top of the spokes, and on desktop the bottom caption ran into the tools.
- **Fixes.** Bigger, brighter pink sockets. A pink note at the top of the overview ("8 neighborhoods are missing a floor. Show them") that turns on Show gaps. Ring names moved into the empty space between two families at the top. The desktop camera re-centred so the caption and "Start here" clear the tools. Re-shot and re-checked after the fixes.
- **Still open (minor).** Inside a neighborhood, the "Tap a dot" and "Your dollar" tags sit over the first street (same as round 12). The panel inside a neighborhood counts broken streets but does not name them (the Show gaps list does). On phone, the top street name can drop out to avoid overlap. Labels on the phone overview are dense.
- **Keyboard note.** Star labels are not tab stops. The keyboard and screen reader path to every neighborhood and business is the search box and the list picker.

### Privacy notes

- Shoppers appear only as gold dust around the centre, as a group with counts. No shopper dots, trails or spend sizing, so nothing depends on the open F-4 §2C decision. No dollar amounts anywhere. The vision brief stays unchanged.

### Founder reactions (round 13)

On 2026-10-08 the founder wrote: "I want to be able to see individual business/entity nodes as I enter it, but still arranged in a spoke like grouping. Almost like a digital store/node that I cannot enter, but can navigate around similar to a video game, even if that means the 'game world' is large. I did like the individualism of the original versions, but the structuring of spoke grouping. I don't know how I feel about another pop up screen to show the flow. It should feel almost web like."

Asked to choose, the founder answered:
- **Moving around:** fly like a drone.
- **What a business looks like:** a star far away, a storefront up close.
- **The flow:** lose the lanes sheet, keep the side panel.

The four round 13 questions were not answered separately, and this brief takes their place. The founder also asked: "Is "Growers" the right term? For something like Automobile, where would their "Grower" be. I want it to be very clear what kinds of businesses go in those open slots." Round 14 answers that with the floor table below.

## 17. Round 14: Star city

Prototype: https://claude.ai/artifact/K96wbvhcfEGf82M3d5RR7P (private, sample data). Round 13 stays at its own link and also in the switcher as **Star map (r13)**.

### What changed

| Founder ask | What round 14 does |
|---|---|
| See individual businesses, still in spokes | The same 25 spokes around the shopper crowd, each with up to four floors set as rings (shops near the middle, then suppliers, makers, raw goods at the far end). Each street on a floor is a row of single stores. Every sample business has its own spot. |
| A store you cannot enter but can move around | Far away, a business is a star. Up close, it becomes a small lit storefront on its own pad, with a name sign over the nearest ones (10 on desktop, 4 on phone). Nothing opens. Tapping a store picks it. |
| Fly like a drone, a large world | WASD or arrows fly, Q and E go up and down, scroll moves in, Shift goes faster, drag looks around. The world is large on purpose. A minimap (top right on desktop) shows where you are, and clicking it flies to that spoke. Neighborhoods change as you fly in, and the breadcrumbs follow. |
| No pop-up flow screen, more like a web | The lanes sheet is gone. Links are thin arcs drawn in place: gold for buys and sells, violet for works with. Inside a neighborhood the threads stay faint. Picking a store lights its own threads and fades the rest. "Follow one dollar" lights the money path from the shop back to the grower and frames the whole path on screen. The side panel lists the same thing as text. |
| What goes in the open slots | Each neighborhood names its own floors (table below). A floor that does not fit a neighborhood is left out. It is never shown as a gap. A missing floor or a street with an empty slot shows as a pink dashed square with a pink label in the world, for example "Cafes: no food suppliers yet". When four or more streets miss the same floor, they share one label ("5 streets: no parts makers and fabricators yet"). Tapping a label flies there. |

The switcher offers **Star city** (default), **Star map (r13)**, and **Flat** (also the fallback with no WebGL). Show gaps, "/" search, the "Fly to a business" picker, Pause motion, Esc to back out, "Explored N of 25", and the Mission 1 dollar tour carry over from round 13. Reduced motion cuts the camera instead of flying it.

### The floors, by neighborhood

The four floors are Raw goods, Makers, Suppliers, and Shops and services. "Growers" was the round 13 name for the raw goods floor, and it only fits neighborhoods that grow something. Each neighborhood now uses its own words, and a dash means that floor is not part of the neighborhood.

| Neighborhood | Raw goods | Makers | Suppliers | Shops and services |
|---|---|---|---|---|
| Food & Dining | Farms and growers | Food makers | Food suppliers | Restaurants and cafes |
| Beauty & Grooming | Botanical growers | Hair and skin product makers | Beauty supply | Salons and barbers |
| Wellness & Health | Herb growers | Supplement and product makers | Wellness suppliers | Studios and practitioners |
| Fashion & Apparel | Fiber and textile sources | Designers and sewists | Fabric and garment wholesale | Boutiques and tailors |
| Professional Services | - | - | - | Firms and advisors |
| Creative & Media | - | - | - | Studios and creatives |
| Home & Living | Lumber and plant sources | Furniture and decor makers | Home goods suppliers | Designers and home services |
| Events & Entertainment | - | Florists, bakers and decor makers | Rental and party supply | Planners, venues and DJs |
| Education & Tutoring | - | Learning material makers | School and learning supply | Tutors and schools |
| Automotive | - | Parts makers and fabricators | Parts and tire suppliers | Repair, detailing and rentals |
| Childcare & Family | - | - | - | Care providers and family services |
| Spiritual & Community | - | - | - | Churches and community groups |
| Technology | - | - | - | Tech firms |
| Healthcare | - | Medical product makers | Medical supply | Clinics and doctors |
| Travel & Transportation | - | - | Fleet and vehicle suppliers | Travel and ride services |
| Legal & Financial | - | - | - | Advisors and lenders |
| Pet Services | - | Pet food and treat makers | Pet supply distributors | Groomers, vets and sitters |
| Agriculture & Sustainability | Farms and gardens | Compost and natural product makers | Green suppliers | Plant shops and eco services |
| Arts & Culture | - | Artists and art makers | Art supply | Galleries, theaters and festivals |
| Books & Publishing | - | Authors and publishers | Book distributors | Bookstores and literary events |
| Construction & Trades | Lumber and stone sources | Millwork and fabricators | Building supply | Contractors and trades |
| Retail & Gifts | Raw material sources | Artisans and makers | Gift wholesale | Gift and specialty shops |
| Photography & Videography | - | - | - | Photographers |
| Social Media & Marketing | - | - | - | Marketing firms |
| Staffing & Workforce | - | - | - | Staffing and career services |

So Automotive has no grower floor. Its chain is parts makers, then parts and tire suppliers, then repair, detailing and rentals. This table is a draft for the founder to sign off.

### Checks

169 automated checks pass `[Observed — Playwright, 2026-10-08]`. They cover Star city at the tour, overview, gaps view, inside Food & Dining and Automotive, a picked store, and follow one dollar, at desktop and phone, plus a Star map (r13) regression pass. Interaction checks: a minimap click flies to a spoke, W moves the drone, tapping a visible storefront picks it, and no console errors. Not yet tried on a real phone `[Unknown]`.

### Critique

A separate design critic ran a first pass and a re-check `[Observed — design-critic agent, 2026-10-08]`.
- **First pass: ITERATE.** Individual stores in spokes: Risk (the floors foreshortened inside a neighborhood). Five-second gap test: Fail inside a neighborhood (gaps only in the panel), Risk on the overview. Web vs hairball: Fail inside a neighborhood (bright thread bundles), Risk on a picked store. Label collisions and the phone layout also failed.
- **Fixes.** Faint threads inside a neighborhood, works-with lines hidden until a store is picked. A camera that sits above and beside the spoke so storefront rows read. Pink gap labels in the world. Labels kept clear of the minimap, location chip and control row. Location chip hidden on phone. Plain-language gap copy.
- **Re-check.** Gap test: Risk (up from Fail). Web: Pass inside a neighborhood, Risk on a picked store. Phone: Risk. No hard blockers.
- **Fixed after the re-check.** Follow one dollar frames the whole path on screen. Phone shows the gap labels. Phone signs read "Sample business N". Every gap gets a label, including Automotive (grouped when four or more streets share it).
- **Still open.** The phone header uses three rows, so the map is about 330px tall (deferred, as agreed). Overview gap markers are small unless Show gaps is on. The tour "You" label is dim.

### Privacy notes

- Shoppers appear only as a group in the middle, with counts. No shopper dots, trails or spend sizing, so nothing depends on the open F-4 §2C decision. No dollar amounts anywhere. Sample labels only. The vision brief stays unchanged until a direction is picked.

### Founder reactions (round 14)

Pending. Questions:
1. Is the world the right size? Does flying from one neighborhood to the next take too long?
2. Does the switch from star to storefront happen at the right distance?
3. Is the web readable, and do the threads to other neighborhoods help or distract?
4. Keep the minimap?
5. Sign off on the floor table, or change any names.

## 18. Round 15: The BLACQWeb as a 3D starfield

Prototype: https://claude.ai/artifact/ET5o69rahoE2iAPWS6ALhm (private, sample data). Rounds 13 and 14 stay at their own links.

### The ask

A fresh start for The Collective page. The ask was a 3D starfield inspired by the Assassin's Creed skill map and a node flow chart, laid out like a spoked cylinder grouped by industry. It needs to show:
- money flowing from shoppers to shops to the next level, all the way to raw goods
- goods flowing from raw goods back to shoppers
- total dollars that have moved through the community
- how many times a dollar circulates

The founder shared a screenshot to define "immersive". In it, a first-person camera sits inside a dark gold tunnel. A big Raw goods medallion is close on the left wall, a big Consumer medallion is close on the right, and the BLACQWeb sphere sits at the far end. Gold money streams and blue goods streams run between them, under a HUD. Node size follows the value of the current mode, money one way and goods the other. The founder asked for five examples.

### Five concepts (one page, switcher on the left)

| | Concept | Where you stand | How it reads |
|---|---|---|---|
| A | Loop tunnel | At the mouth of the tunnel, as in the screenshot | Shoppers and shops line the right wall, suppliers to raw goods the left. The two near floors are the biggest medallions. Money runs deep, loops through the BLACQWeb at the far end, and comes back up the other wall. |
| B | Bore | At the center of a straight bore | Each ring is a floor and each line along the wall is a neighborhood. In money mode, shoppers are at your feet and raw goods at the far end. The goods toggle flips you to the other end. |
| C | Rotunda | Above the middle of a wheel | Shoppers in the center. Every neighborhood is a spoke that runs out to its raw goods, like a skill wheel. The slider walks you from the middle to the edge. |
| D | Shaft | At the top of a well | Floors are stacked down a shaft, and money spirals down to raw goods. In goods mode you start at the bottom and look up as goods spiral back to shoppers. |
| E | Constellations | In a corridor | Each neighborhood is its own star chart on the tunnel wall. Walk the corridor, then pick one to face it. |

Shared across all five:
- **Medallions.** Nodes are dark medallions with a glowing ring and a floor icon (people, store, truck, gear, leaf), sized by the value of the current mode.
- **Gaps.** A floor with no business yet is a pink dashed square with a plain label, for example "No parts makers and fabricators yet". A floor that does not belong to a neighborhood is left out.
- **Header KPIs.** $16.9M circulated, 3.2× average dollar turns, 2,418 connections.
- **Controls.** A Money / Goods toggle, a depth slider, "Follow one dollar" (a gold coin walks six turns and the panel tells the story), and Table view (also the fallback with no WebGL).
- **Side panel.** Live activity feed, neighborhood chips, and "How we count".
- **Phone.** A bottom details sheet.
- **Reduced motion.** Cuts the camera instead of flying it.

### How the numbers work (sample)

- **Dollars circulated** = dollars that changed hands along the chain, divided by (1 minus the share that stays local). The sample uses half, which gives $16.9M.
- **Average turns** = dollars circulated divided by first spend, which gives 3.2×.
- **Node size** = 0.5 + 2.7 × the square root of (value ÷ the largest value in that mode). The square root keeps small businesses visible.

### Checks

- Playwright passes with no page errors and no sideways scroll `[Observed — Playwright, 2026-10-13]`. It covers all five concepts at 1440×900, plus mid-tunnel A, goods mode B, Rotunda with Food & Dining picked, a dollar walk in E, the table, and phone views (A, C, and the details sheet) at 390×844.
- Not tried on a real phone `[Unknown]`.

### Critique

A separate design critic ran a first pass `[Observed — design-critic agent, 2026-10-13]`.
- **First pass: ITERATE.** Fails were fit to the reference (A read as a flat star chart with small nodes) and phone (KPI labels clipped, a hidden concept tab). Risks were hierarchy, label clutter, and readability over the streams.
- **Fixes made:**
  - Nodes changed from flat discs to ringed medallions with icons.
  - In A, the near floors are larger, and the BLACQWeb hub is bigger with a larger label.
  - Fewer labels: 12 on desktop and 6 on phone, shown only for big or near nodes.
  - Label pills are more opaque and blurred.
  - On phone, KPI labels are short, the concept tabs fade at the edge to show they scroll, and labels are kept fully on screen.
  - Nodes fade as the camera gets close, so they don't blow out.
  - The Rotunda camera is higher.
  - The help text is easier to read and fades after the first drag.
- **Still open:**
  - On desktop, the side panels cover the near wall medallions in A. A full-bleed mode with collapsible panels would fix this.
  - The phone bottom controls still take about 170px.
  - Not re-critiqued after the fixes.

### Privacy notes

- **This round shows dollar amounts and sizes businesses by value**, because the brief asked for it. Round 14 had none. Sizing a business by its value reveals its relative revenue.
- **Production rule:** single businesses show as ranges (bands), and only for owners who opt in. Community totals (circulated, turns, neighborhood floors) are aggregates and fine to show as is.
- **Shoppers** appear only as a group. No individual shoppers, so nothing depends on the open F-4 §2C decision.
- **Sample labels** throughout. The vision brief stays unchanged until a direction is picked.

### Founder reactions (round 15)

Answered 2026-10-13 `[Observed — founder, chat]`:
- D (Shaft) and E (Constellations) are the favorites. A, B and C are retired.
- They want to see a node for every business and every shopper. Businesses and shoppers should always be able to find their own node.
- Bring back the category colors from earlier rounds, by category or by level, to see how it looks.
- Flow between businesses should be sparse: about one pulse every 1 to 2 minutes per link, at random so they don't all fire at once. When a purchase is recorded, the new connection and its flow should show right away.
- Questions 2, 3 and 5 were not answered directly. Round 16 keeps money mode as the start and the six-step dollar tour.

Original questions:
1. Which concept is closest: A, B, C, D or E? Or a blend (for example, A's tunnel with C's spokes)?
2. Is A close enough to the screenshot in camera angle, placement and size? If not, what feels off?
3. Should the page start in money mode or goods mode?
4. Sizing by value: are bands plus owner opt-in OK for production, or should single businesses stay unsized?
5. Should Follow one dollar stay as six steps, or run until the dollar leaves the community?

## 19. Round 16: Shaft and Constellations, one star each

**Artifact:** https://claude.ai/artifact/GrrrhfswTVeey4DayzkWdv (private, sample data)

### What changed

- **Two concepts only:** D Shaft (floors stacked down a well) and E Constellations (each neighborhood is a star chart on the tunnel wall).
- **One star each:** every sample business (195) and every sample shopper (954) has its own star. Shoppers stay unnamed and gather as a crowd on their neighborhood's shopper floor. The left column shows the count, worked out from the data.
- **Find me:** a gold ring with a sonar pulse marks your star, labeled "You are here". When your star is off screen, a "You" pin on the edge points to it, and tapping it flies you there. `Y` does the same. "Viewing as" switches between a shopper and four sample owners.
- **Color by:** Category (family colors, close neighborhoods share a family), Level (shoppers, shops, suppliers, makers, raw goods), or Gold (money gold, goods blue). `C` cycles them. A small key sits under the toggle on desktop.
- **Sparse flow:** each link runs on its own clock, firing one ambient spark every 60 to 120 seconds, so pulses are staggered and quiet.
- **Live flow:** a sample purchase lands every 6 to 12 seconds:
  - About half are shoppers buying from a shop.
  - The rest are businesses buying from the next floor down, and about half of those make a new link.
  - The buyer flashes, a bright spark travels the link, and a new link draws itself in over the spark's trip.
  - The KPIs tick up with a +$ and +1, and the live feed tags it NEW LINK.
- **Record a sample purchase (or sale):** your own purchase shows right away from your star, so you see the "as soon as possible" behavior on demand.
- **Owner view:** your exact number (only you see it), an opt-in checkbox for showing your size range to everyone, and what everyone else sees.

### Checks

- Playwright passes with no page errors and no sideways scroll `[Observed — Playwright, 2026-10-13]`. Coverage:
  - Desktop at 1440×900: D, E, Find me, owner view, Level, Gold, goods mode, search, live events, Record, the dollar tour, a neighborhood pick, and the table.
  - Phone at 390×844: D, E, Find me, and the details sheet.
- Live sparks are hard to judge in headless stills. Watch them in a real browser.
- Not tried on a real phone `[Unknown]`.

### Critique

A separate design critic ran a pass `[Observed — design-critic agent, 2026-10-13]`.
- **Verdict: ITERATE.**
  - Pass: type, motion and genericness.
  - Risk: hierarchy, spacing, contrast and polish.
  - Fail: color-by on E.
- **Checked against the shots:**
  - Level does recolor E clearly, so the Fail was overstated.
  - The critic misread 2,418 links as businesses.
- **Fixes made:** a color key and a data-driven "one star each" count under Color by. The live arrival and origin bursts are bigger. Sparks stay a fixed pixel size, so they no longer balloon near the camera or vanish far away. The edge pin sits clear of the toast.
- **Still open:**
  - The right rail scrolls and cuts off mid-card at 900px tall.
  - Find me shows twice on desktop (card and dock).
  - Labels can overlap in close cluster views.
  - On phone, the Color by row scrolls sideways, so Gold sits past the fade.

### Privacy notes

- **Names:** a business shows by name only if it opted in, or if it is you. Otherwise it reads as a generic "a food shop".
- **Shoppers** are always anonymous. Nobody can search for a shopper, and only you see which star is yours. Individual shopper stars are still workshop-only while F-4 §2C is open.
- **Sizes** show as ranges, only with owner opt-in. Your exact number shows only to you.
- **Live flow in production** would need Supabase Realtime on recorded purchases (receipts, claims), plus a delay or batching so a spark can't be traced to one person's purchase at a small shop.

### Founder reactions (round 16)

Answered 2026-10-21:
- **Concept:** "Silo is definitely correct." Silo is D Shaft, renamed. E Constellations and the concept switcher are retired.
- **Next step:** a design pass on the screen itself, to fit the brand and show information visually instead of in text. That is round 17 (§20).

Still open, carried into §20:
1. Category or Level coloring, or should Gold stay as an option?
2. Does one pulse every 1 to 2 minutes per link feel right, or too quiet?
3. Is the gold ring plus the edge pin enough to find yourself fast?
4. Do the crowded clusters read, or should each neighborhood spread out more?

## 20. Round 17: The Silo screen, three HUD layouts

**Artifact:** https://claude.ai/artifact/HnNKpmGYQ3MKHFyaeav8fd (private, sample data). Round 16 stays at its own link for comparison.

**Founder brief (2026-10-21):** Silo is the concept. Make the screen fit the brand and carry information visually, without crowding it with text. Show two or three layouts behind a switcher.

The 3D scene, data and privacy rules are unchanged from round 16. This round changes only the HUD around the scene.

### References

| Reference | What we borrow | What we avoid |
|---|---|---|
| Assassin's Creed skill-tree HUD | Sparse corner readouts, one job per corner, the scene stays the hero | Ornate frames and filigree |
| Flourish network graphs | The legend is the filter: tap a color to spotlight it | A separate filter panel |
| Game altimeter / depth gauge (Elite Dangerous, No Man's Sky) | A vertical gauge with a "you are here" notch that you can click to jump | Sci-fi chrome, scanlines |
| BLACQList brand | Gold on warm near-black, Glacial Indifference / Lato for readouts, Quicksand italic only on calls to action | A second loud accent |

**Current standard:** data products this year put numbers first, words second. Values are big, labels are one word, and the explanation lives in tooltips or a "How we count" sheet. Keyboard shortcuts are listed in a key map that you open, not printed on screen.

**Trend read:** restrained glass panels (light blur, thin border, warm tint). This should age well because it stays quiet. Heavy neon glow and big frosted slabs would date fast, so we skipped them.

### The three layouts

Switch with the A / B / C pill at top right, `L` on the keyboard, or `#hud-a`, `#hud-b`, `#hud-c` in the link. The pill is hidden on phones, where all three collapse to the same phone layout.

| | A · Corners | B · Instrument | C · Console |
|---|---|---|---|
| Idea | Each corner holds one job | One left column reads the whole silo | Everything in one bottom console, the top is all sky |
| Totals | Slim readout strip, top center | Stacked readouts, top of the column | Left end of the console |
| Silo gauge | Thin floor rail on the left edge | The hero: one bar per floor, passed on (gold) against kept (grey) | Floor stepper in the console |
| Color key | Dots, bottom left | Under the gauge | In the console, names on wide screens |
| Details card | Bottom right | Top right | Bottom right, above the console |
| Live ticker | Under the totals, 3 lines | Bottom of the column | Along the top of the console |

### What changed from round 16

| Round 16 | Round 17 |
|---|---|
| 3 total cards, each with a sentence | A value and a one-word label; the sentence moves to the tooltip and "How we count" |
| "Top / Bottom" depth slider plus floor-name prose | Silo gauge: 5 floors with level icons, a "you" notch, pink gap badges, click to jump |
| 13 neighborhood chips plus a separate color key | One legend that is also the filter, plus a 3-icon Color by toggle |
| A right rail of 7 cards that scrolled and cut off | One details card that changes with context: You, the star you picked, or the dollar tour |
| Live activity list | A 3-line ticker that fades |
| Find me twice | Find me once, in the dock |
| A paragraph of keyboard hints | A `?` key map, closed by default, with a Close button and a "Letter shortcuts on" switch |
| How we count, table view, full feed, Viewing as | All moved into one More sheet |

### Checks

- Playwright on all three layouts at 1440×900, 1280×720 and 390×844, plus reduced motion `[Observed — Playwright, 2026-10-21]`. Scenarios: rest, Find me, legend spotlight, gauge jump, pick a star, owner view, dollar tour, live ticker, More sheet, table, key map.
  - No page errors, no sideways scroll, nothing clipped, no overlaps between HUD parts.
  - The only flags are on phone with the More sheet open, where the legend moves into the sheet on purpose.
- **Visible words in the HUD at rest:**

| | Round 16 | A | B | C |
|---|---|---|---|---|
| Desktop 1440 | 324 | 78 | 79 | 63 |
| Desktop 1280 | n/a | 75 | 76 | 61 |
| Phone 390 | 36 | 32 | 32 | 34 |

  Desktop drops about 75 to 80%. Phone is about level with round 16, which was already short, but it now carries the gauge and live ticker that round 16's phone view hid.
- Live sparks and the ticker are hard to judge from stills. Watch them in a real browser. Not tried on a real phone `[Unknown]`.

### Critique

A separate design critic ran a pass `[Observed — design-critic agent, 2026-10-21]`.
- **Verdict: ITERATE.** The direction is right and the text load is fixed; the problems were collisions, not concept.
- **Ranking:** B > C > A. B has the clearest hierarchy and the strongest identity, and its gauge bars show the flow without words. C gives the scene the most room. A is the most scattered.
- **Fails, now fixed:**
  - The key map opened on first visit and covered the scene. It is now closed by default.
  - On phone, the layout switcher did nothing visible. It is hidden below 760px.
  - Totals were painted over by bright rings. A soft top scrim now sits behind them in A and on phone.
- **Risks, now fixed:**
  - The ticker's third line faded below contrast. It now sits at 64%.
  - Small labels were under 11px. They are now 11px, or 10.5px on phone.
  - Only one call to action is filled now; Find me and One dollar are outlined.
  - In B there was a dead gap above the gauge. The gauge now sits right under the totals, and the legend drops to the bottom.
  - The step toast landed under B's column and on C's console. It now has its own lane in each.
  - C's legend was bare dots. Names now show at 1280px and wider; below that, each dot keeps its name as a tooltip and screen reader label.

An accessibility pass also ran `[Observed — accessibility-agent, 2026-10-21]`. All six of its Fails are fixed:
1. The More sheet traps focus. The rest of the screen is inert while it is open, and focus returns to where it was.
2. Letter shortcuts can be switched off (WCAG 2.1.4). The setting is remembered in the browser.
3. The key map works by keyboard: Close button, focus moves in, focus returns, and no auto-open.
4. Gauge floors say their amounts ("Shops: $X passed on, $Y kept"), so the bars don't rely on color alone.
5. Screen readers hear one short status line ("Selected …", the first and last dollar step), not every toast.
6. Focus stays put when the details card redraws.

**Still open:**
- Phone tap targets: the More sheet's controls are now at least 44px, but the gauge rail's floor dots still need measuring on a real phone.
- `P` pauses the live feed. A control that pauses all ambient motion is not built yet.
- Labels can still overlap in close cluster views, carried from round 16.

### Recommendation

**B · Instrument**, and borrow C's single-row stat strip at narrow desktop widths (around 1024 to 1279px), where B's column takes a quarter of the screen. Keep A only if you prefer the scene completely open; it adds nothing B and C don't do better.

### Founder reactions (round 17)

Pending. Questions:
1. Which layout: A, B or C? (We recommend B.)
2. Retire A, or keep it as a "clean view" toggle?
3. Is C's bottom console worth keeping as the phone pattern, or is the shared phone layout fine?
4. Do the gauge bars (passed on against kept) say "money keeps moving" clearly enough without words?

Carried from round 16:
5. Category or Level coloring by default, and does Gold stay?
6. One pulse every 1 to 2 minutes per link: right, or too quiet?
7. Crowded clusters: do they read, or should neighborhoods spread out?
