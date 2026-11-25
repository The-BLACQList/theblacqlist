# Ticket 278: Every Published Business Has a Spot in The Collective

**Status:** Not started. The founder approved writing this ticket on 2026-11-24; starting the fix, the merge and the deploy each need their own OK.

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
| Hosted row cap | Not read |

Nothing is missing today, as long as the hosted cap is 706 or higher. At 1,000, there is room for 294 more listings.

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

## Not in This Ticket

- The home page's category counts also come from a listing read. Check it for the same cap while here and report it; don't widen the change.
- The Collective's look: the softer picture was rejected on 2026-11-24 (ticket 272).
