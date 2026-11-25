# Ticket 283: Post a Job and Receipt Sharing Read the State Correctly

**Status:** In review, 2026-11-24.

## Why

`/add-job` and `/account/receipts/[id]/share` asked `cities` for `state_abbr`. That column doesn't exist, so the whole read failed. `/add-job` told owners with a published page "You need a published business page first", and no job could be posted (since #272, 2026-10-30). The share page goes to its error state on a failed read (since ticket 183). Found on staging on 2026-11-24, error 42703. The founder approved the fix on 2026-11-24.

## What Changed

- `app/add-job/page.tsx`: reads `cities(name, states(code))`, as the vendor pages do, and logs a failed read.
- `app/account/receipts/[id]/share/page.tsx` and `lib/share/supportCard.ts`: the same read, and the same log line.
- `tests/city-select-columns.test.ts` (new): fails if any embed asks `cities` for `state_abbr`.

No migration and no wording change.

## Checks

- The new test fails on the old code, naming both files, and passes on the new code.
- The generated types have one link each for `receipt_uploads` → `listings` → `cities` → `states`.
- RLS lets signed-in users read `states`, and the directory (`lib/listings/query.ts`) already uses the same read as the signed-in user.
- Both final reads ran on staging on 2026-11-24 (read-only): no error, and every row with a city had a state code. Both old reads failed with 42703.
- The staging job test on 2026-11-24 passed on `/add-job` with `cities(name)`, so without the state.

## Not Done

- Neither page was opened in a browser with this read, and it was not run as a signed-in owner.
- Production data was not read.
