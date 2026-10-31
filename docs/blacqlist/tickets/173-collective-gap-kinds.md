# 173: The Collective, kinds of business for each gap

**Status:** Draft PR, waiting for the founder's merge word
**Follows:** ticket 171b (#296, merged)
**Area:** `/flow-map` (The Collective)

## Why

The founder (2026-10-31):

> "For empty area (pink squares), when clicked, it should show a list of kinds of businesses that would go in that area."

## What changes

- Picking a pink gap square opens the gap card as before. Under "None on the list yet. A gap to fill." it now lists **Kinds of business that belong here**, as small dashed pink chips.
- The lists live in `GAP_KINDS` in `lib/spend/silo-layout.ts`: one per family (Food, Style, Health, Home, Culture, Services) and business floor (Shops, Suppliers, Makers, Growers). Each has 3 to 7 items.
- They are written by hand, not read from `categories`. A category's `allowed_levels` comes from its parent, so a raw list would put Barbershops on the Suppliers floor.
- When a family rarely sits on a floor (today only Services on Growers), the card says "{Family} businesses rarely sit on this floor." instead of a list.
- There's no data read, no new request and no amounts or counts. Copy has no em dashes and no ownership labels.

## Out of scope
- A link from the gap card to `/add-business`. That path is for owners adding their own page, so it would need its own copy. Left for a later pick.

## Verification
- `pnpm typecheck`, `pnpm lint` and `pnpm test:unit` pass. New tests in `tests/silo-layout.test.ts`.
- Preview at 375px and 1280px, light and dark: pick a gap on each floor, check the chips wrap inside the card and the Services · Growers fallback reads right.
