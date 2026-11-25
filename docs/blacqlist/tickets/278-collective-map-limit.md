# Ticket 278: Every Published Business Has a Spot in The Collective

**Status:** Built, in review. The founder started the fix on 2026-11-24 ("Max Rows is 1000, build 278 and 279"); the merge and the deploy each need their own OK.

## Why

Founder 2026-11-24: "Yes to tickets for the map limit and the method page." Creative's DR-014 (reported by Creative): every published business needs a spot in the Live view before the site tour's owner step ships, because that step says "Once your Page is published, your business has a spot here."

## What Happens Today

Read on main `84ab44c`.

- `app/(public)/flow-map/page.tsx` reads published listings oldest first and stops at `MAP_LIMIT = 2000`.
- `supabase/config.toml` sets `max_rows = 1000`. If the hosted project uses the same value, the read stops at 1,000 and raises no error. The hosted value has not been read.
- Past the limit, the newest businesses get no spot, unless they have a counted receipt (those are read separately, up to 500).
- The page reads every `spend_events` row and adds them up in code, with no paging. So do `app/page.tsx`, `app/account/community-spend/page.tsx`, `app/api/community-spend/route.ts` and `app/api/flow-map/summary/route.ts`. Past the row cap, those totals and purchase counts would be too low.

## Production, 2026-11-24 18:55 UTC

| | |
|---|---|
| Published listings | 706 (all 706 belong on the map) |
| Counted spend rows | 0 |
| Hosted row cap (Max Rows) | 1,000 (founder, 2026-11-24) |

Nothing is missing today. Without this change there is room for 294 more listings.

## Proposed Change

1. Read listings in pages, ordered by `created_at` then `id`, until a page comes back empty. Do not stop at a short page: a cap below the page size also returns one. A failed page keeps the existing load-failed state; never show a partial map as complete.
2. Read the spend totals the same way, through one shared helper, in all five places.
3. Read linked businesses in batches so the `in (…)` filter stays short.
4. Measure the page at 2,000 and 5,000 businesses before choosing a ceiling. If the scene needs one, it must not leave out a published business without saying so.

No schema change is planned. Summing in the database would be faster at scale, but needs a migration (GATE-DATA).

## Done When

- A test with more rows than one page shows every business on the map and the full total; it fails on today's code.
- A failed second page shows the load-failed state.
- The hosted row cap is recorded here.
- The scene is checked at 1,500 businesses on a phone and on desktop.

## What Was Built

- `lib/supabase/read-all.ts`: `readAllRows` pages by `id` and stops only when the server's exact count says nothing is left. `readInBatches` splits `in (…)` filters into 100s, five at a time. A failed page fails the whole read.
- `lib/spend/counted-spend.ts`: `readCountedSpend`, the one public read of `spend_events`, used in all five places.
- `/flow-map` no longer has `MAP_LIMIT`. Linked listings already read are not read twice.
- Paging is by `id`, not by `created_at` then `id` as proposed above: it needs no two-column filter, and a row added mid-read can't be skipped or repeated. The map's order doesn't change, because `buildSiloBusinesses` sorts.
- Tests: `tests/read-all-rows.test.ts` (helpers and spend read) and `tests/flow-map-row-cap.test.ts` (runs the real page).

## Measured, 2026-11-24

Production builds of `main` (`6b63064`) and this branch, against a local stand-in for the database API that returns at most 1,000 rows. Sample rows only: 2,345 receipts of $25 each ($58,625).

| Businesses | Old: shown | Old: total | New: shown | New: total | New: page, compressed |
|---|---|---|---|---|---|
| 500 | 500 | $25,000 | 500 | $58,625 | not measured |
| 1,500 | 1,000 | $25,000 | 1,500 | $58,625 | 37 KB |
| 2,000 | 1,000 | $25,000 | 2,000 | $58,625 | 42 KB |
| 5,000 | 1,000 | $25,000 | 5,000 | $58,625 | 75 KB |

- A failed second page of listings shows "We couldn't load The Collective." and no businesses.
- The scene makes about the same number of draw calls per frame at every size (66–68 desktop, 46–49 phone size). With software rendering, going from 706 to 5,000 businesses took it from 5.4 to 4.2 frames a second on desktop and from 32 to 28 at phone size. A real graphics card was not measured.
- Checked by eye: 1,500 on desktop and at phone size, and 5,000 on desktop. Dots shrink to fit.
- **No ceiling is needed.**

Request time to the hosted database was not measured. Each extra 1,000 businesses or receipts adds one request in sequence. Summing in the database is still the better fix at a large size (GATE-DATA).

## Found, Not Changed

- Home's category counts (`listingFacetRes` in `app/page.tsx`) come from one listing read, so they stop at 1,000 listings.
- `/flow-map` draws lines for the top 500 businesses by spend (`flow_nodes`, `.limit(500)`). Every published business still has its dot; past 500 a lower one has no line.
- Home and `/account/community-spend` show a failed spend read as zero. This was already so, and more pages mean slightly more chances to fail. The fix needs an error state on each.

## Not in This Ticket

- The home page's category counts also come from a listing read. Check it for the same cap while here and report it; don't widen the change.
- The Collective's look: the softer picture was rejected on 2026-11-24 (ticket 272).
