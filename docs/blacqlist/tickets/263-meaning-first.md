# Ticket 263: Meaning First When Nothing Matches

**Status:** PR open. Merge needs the founder's OK. Code only: the flag is already on in prod.

## Why
Ticket 260 went live on 2026-11-21. In six live searches none showed Related Businesses (`related_used` false on all).

For "stress relief", nothing matched the words. Cue answered from the Wellness category's close matches (spas and yoga studios). The founder: "This isn't a bad result, though. But if it can be better I'll take it."

Two things held it back:
- **Order.** Close matches were fetched first, and meaning search skipped anything already among them. So meaning search could only add businesses outside that one category, and the tool told Cue to show the close matches.
- **No view of the scores.** The database was asked only for listings at 0.45 or above. So when nothing came back, we couldn't tell "nothing close" from "close, but under the bar".

## What Changed

**Cue's `search_listings` tool** (`lib/ai/cue/tools.ts`):
- With fewer than 3 matches by the words, meaning search runs first. It excludes only the strict matches.
- When nothing matched the words, the category's close matches fill what is left of 5, never repeating a related one. At least 2 are kept (`CUE_CLOSE_MIN`), so the category is still shown.
- In the tool's reply, related comes before close matches. The `next` line says to lead with the related businesses whose text fits.
- With no related ones, nothing changes from 260: 5 close matches, same wording.

**Scores** (`lib/search/hybrid.ts`):
- The database is asked down to 0.25 (`RELATED_SCORE_FLOOR`). Only 0.45 and up is ever shown. The rest is counted.
- `relatedStats` gives the best score and how many reached the bar. `onStats` hands them to the caller and can never cost the answer.
- `relatedCheckProps` turns them into analytics properties.

**Logging** (`search_answer_served`, AI and quick answers):
- `related_checked`: meaning search ran.
- `related_best`: its best score, 2 decimal places, or null.
- `related_hits`: how many reached 0.45.
- Numbers only, never the words.

## Tuning the Bar
After a few days, read `related_best` where `related_checked` is true:
- Many searches with a best between 0.40 and 0.45: lower the bar to 0.40 and read the results for fit.
- Most searches with a best of 0.45 or above but `related_used` false: Cue is choosing not to show them, which is a prompt question, not a bar question.

## Tests
`tests/meaning-search-first.test.ts` (13 tests) covers:
- The scores, the floor, a failing callback, no lookup, two lookups in one turn, the analytics shape.
- Cue: meaning first, the close-match room and the minimum of 2, nothing by meaning, related with no nearest category, flag off.
- The quick answer carries the scores.

`tests/cue-route.test.ts` and `tests/meaning-search-related.test.ts` were updated for the new fields, the floor and the call shape.

## Rollout
1. Merge. It is live on the next prod deploy, since the flag is already on.
2. Try "stress relief" on prod and read the new fields on `search_answer_served`.
