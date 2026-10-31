# Ticket 172: Search word families ("lawyer" finds law offices)

**Phase:** V1.5 · **Priority:** P1 · **Status:** In review (draft PR)
**Depends on:** none.
**Gates:**
- GATE-DEPLOY: merge waits on the founder's word.
- No migration, no new dependency, no data change.

---

## Why

Founder, 2026-10-31: "law" finds plenty of Atlanta law offices, but "lawyer" finds nothing. "dental" finds results, but "dentists" finds nothing. We need to catch these without surfacing unrelated results.

Postgres English stemming folds plurals ("dentists" to "dentist") but never joins "lawyer" to "law" or "dentist" to "dental". The listings say "Law Office" or "Dental", so the visitor's word never meets theirs. Fuzzy matching would bring back the junk that the 2026-10-18 search-tighter change removed, like Lawndale Pharmacy for "lawyer".

## What changed

- `lib/search/wordFamilies.ts`: a short, hand-kept list of words that name the same kind of business (lawyer, attorney, law, legal; dentist, dental, dentistry; plumber, plumbing; and a few more).
  - A search is widened to an OR search: "divorce lawyer" becomes "divorce lawyer OR divorce law OR divorce legal OR divorce attorney". Every other typed word still has to match.
  - Added words only match whole. The uppercase OR turns off the prefix match, so "law" never finds "lawn".
  - Some families go one way only. "baker" adds "bakery", but "bakery" never adds "baker", because Baker is a surname.
  - Left alone: searches with quotes, a minus or OR, and searches that would make more than 12 alternatives.
- `lib/listings/facets.ts`: `rpcArgs` and the legacy path widen `p_q`. The grid, the counts, Cue and the search helper all go through it. The page still shows what the visitor typed.

## Out

- Fuzzy or AI synonyms. The list stays hand-kept so nothing unrelated slips in.
- Words Postgres already joins ("accountant" and "accounting" both stem to "account").
- A database migration.

## Trade-offs

- A widened search skips the name typo help. Only correctly spelled known words widen, so a typo still gets typo help.
- A listing that says "legal" or "dental" only in its description ranks below one that says it in the name, same as today.

## Adding a word

Add a row to `WORD_FAMILIES`. Only add words for the same kind of business, and only when Postgres stems them apart (check with `SELECT to_tsvector('english', 'word')`).

## Acceptance criteria

- Given a "Peachtree Law Office" listing, when a visitor searches "lawyer", "Lawyers" or "attorney", then it shows.
- Given a "Peach Dental Studio" listing, when a visitor searches "dentists", then it shows.
- Given "Green Lawn Care", Lawndale Pharmacy and "Lawn-raised hens", when a visitor searches "lawyer" or "law", then none of them shows.
- Given any widened search, then the sidebar counts match the grid.
- Given "bakery", "coffee" or "lawn", then the search is unchanged.

## Tests

- `tests/search-word-families.test.ts` (unit).
- `tests/migrations/search-tighter.test.ts` test 6 (local Postgres).
