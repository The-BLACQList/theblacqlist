# Ticket 281: Review Events Save

**Status:** Merged #412 (`9df5f89`), 2026-11-24.

## Why

`listing_submitted` and `claim_submitted` were written with `void client.from('analytics_events').insert(…)`. The Supabase query builder only sends its request once it is awaited, so neither event was ever saved. Same fault as the storefront clicks in ticket 241. Found while answering Marketing; the founder approved the fix on 2026-11-24.

Pages and claims were never affected: they save, and the review line gets its row.

## What Changed

- `lib/listings/submitForReview.ts`, `lib/actions/listings/submitListing.ts` and `lib/actions/claims/createClaim.ts` now use `trackServerEvent`, which awaits the insert after the response and never fails the submit.
- `docs/blacqlist/analytics/analytics-event-taxonomy.md`: both events now match what the code sends.
- `lib/analytics/constants.ts` and `scripts/ops/metrics-pull.ts` say that counts from before this ticket are short.
- Ticket 277 is marked merged.

No migration, flag, or visible change.

## Checks

- `tests/review-events.test.ts`: the event is sent once, after the response; not on a failed move or a refused queue row; a failed event never fails the submit. The stub is lazy like the real builder, so the old code fails it.
- `tests/claim-ownership-guard.test.ts`: an accepted claim sends `claim_submitted` once; a refused one sends nothing.
- `tests/review-events.test.ts` also fails on any `void client.from(…)` or `void client.rpc(…)` in `app`, `lib` or `components`.

## Not Done

- No backfill. Earlier sends are in `moderation_queue` (`new_submission`, reliable from 2026-10-06, backfilled rows aside) and earlier claims are in `claims`.
- `/api/analytics/event` accepts both names from a browser, so a visitor could post a false one. Unchanged here.
