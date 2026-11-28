# Ticket 292: Founder Letter, "The List I Could Not Find"

**Status:** Prod updated 2026-11-28. Seed PR open.

## Why

On 2026-11-28 the founder gave a new, longer letter for The BLACQLight. They asked for it to be published now, keeping the current cover, and said: "remove the period from the title."

`scripts/seed-editorial-launch.ts` upserts the founder piece by slug. A re-run would have brought back the old letter, so the repo copy had to change too.

## What Changed

| Field            | Before                       | After                                                                                                     |
| ---------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| Title            | The List We Could Not Find   | The List I Could Not Find                                                                                 |
| Slug             | `the-list-we-could-not-find` | `the-list-i-could-not-find`                                                                               |
| Subtitle         | Why I started The BLACQList. | A letter from the founder of The BLACQList                                                                |
| Body             | Old letter                   | The founder's text, word for word; six `##` section headings as typed; sign-off as three short paragraphs |
| Meta description | Old seed copy                | Matches prod (it was edited there earlier)                                                                |

These stay the same: byline, tags and the cover (the seed never sets the cover). The founder piece is still published last, so it stays the home page story. The cover comment in `lib/design/surfaces.ts` uses the new title.

## Prod

Prod row `0bc9cd2b-51c1-4fcc-8595-2f22f4c54717` was updated by hand on 2026-11-28. The update was guarded to exactly 1 row and dated that day.

- Body read-back matches the source file: length 13,642, md5 `324b18bc…`.
- Staging got the same row first and was checked on a Preview at 390 and 1280 wide.
- Rollback: `docs/blacqlist/ops/data/2026-11-28-founder-letter-rollback.json` (stale checkout, git-ignored).

Nothing linked to the old slug (0 links in prod content and in code), so it now returns not found.

## Left As Is

- No redirect from the old slug: nothing links to it.
