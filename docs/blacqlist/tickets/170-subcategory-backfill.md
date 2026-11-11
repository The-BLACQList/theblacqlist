# Ticket 170: Suggest and fill missing subcategories

**Phase:** V1.5 · **Priority:** P1 · **Status:** Done 2026-11-11. Staging and prod both run. Prod: 584 listings given a subcategory or moved, 36 left on their group on purpose.
**Depends on:** none (169 is better with it, and works without it)
**Gates:** GATE-DATA for any prod write. Reading prod listings also needs the founder's word first. Plan approval doesn't count.
**Decision record (founder, 2026-10-31):** the backfill is its own ticket, apart from the Cue chat (169).

---

## Why

621 of 707 prod listings have no subcategory (counted 2026-10-29). Search, Discover filters and Cue all lean on the subcategory. A law firm filed only under the parent group is invisible to anyone who picks "Lawyers".

## Scope

In:

- **Rule:** `lib/listings/subcategorySuggest.ts`, rule-based with no AI.
  - It reads the listing's name, tagline and business description. Listings have no tags column.
  - It matches those against each child of the listing's current group: the child's own name words and its related words in `lib/search/categoryKeywords.ts`.
  - Name and tagline count double. Whole words only, so "lawn" never matches "law".
  - It only suggests a child of the group the listing is already in. A tie gives no suggestion and names the tied children.
  - Tests: `tests/subcategory-suggest.test.ts`.
- **Suggest (read-only):** `scripts/ops/suggest-subcategories.ts`.
  - Reads published listings whose `category_id` is a top-level group that has children.
  - Writes `docs/blacqlist/ops/data/subcategory-suggest-<date>.csv` (gitignored, no personal data) with `listing_id`, `name`, current category and id, suggested subcategory and id, matched words, confidence (`several`, `one`, `tie`, `none`), a note, and a blank `DECISION`.
  - Rows are sorted most sure first.
- **Apply:** `scripts/ops/apply-subcategories.ts`.
  - Dry run by default. `--apply` needs `--yes`, and a remote write with no readable project ref is refused.
  - Only `APPLY` and `MOVE` rows. An `APPLY` row must move the listing from its group to one of that group's own children. A `MOVE` row may land on a child of another group, for listings filed in the wrong group. Both are checked against the categories table on the target, and neither may land on a top-level group. Any bad row stops the run before a write. The rules are in `lib/listings/subcategoryApplyPlan.ts`, tested in `tests/subcategory-apply-plan.test.ts`.
  - Writes `subcategory-rollback-<date and time>.csv` (old and new `category_id`) before the first UPDATE. It never overwrites an earlier one, so two runs on the same day keep both files.
  - Each UPDATE only matches if `category_id` is still what the sheet saw.
  - The search_vector trigger runs on any listings UPDATE, so search picks up the change with no extra step.
- **Down plan:** `apply-subcategories.ts --rollback <file> --apply --yes` puts each old `category_id` back, but only where the listing still has the one the backfill gave it. It is tested on staging before any prod write.
- **Run order:**
  1. Staging: suggest, review the CSV, dry run, apply, check counts, test the rollback.
  2. Prod: suggest on the founder's word. A dry run of apply reads the categories table, so it needs the same word.
  3. Prod apply at GATE-DATA.

Out:

- Changing the category list itself.
- `listings.subcategory_ids`. It isn't foreign-key checked and app code doesn't read it. The CSV notes listings that already have values there.
- Model-based suggestions (later, if the rules leave too many blanks).
- Owner-facing prompts to pick a subcategory.

## Acceptance criteria

- Given staging, when the script runs dry, then it writes a CSV and changes nothing.
- Given an approved CSV, when apply runs on staging, then exactly those rows change and the saved-values file lists each old value.
- Given the restore script on staging, then every changed row is back to its old value.
- Given prod, then nothing is read before the founder says so, and nothing is written before GATE-DATA.

## Decided (founder, 2026-10-31)

- "No subcategory" means a listing whose `category_id` is a top-level group.
- The founder runs the read-only suggest script against staging and sends the CSV back. We review it and mark the rows. Prod stays untouched until the founder's word, and nothing is written to prod before GATE-DATA.

## Staging run (2026-11-07 and 2026-11-08)

- The founder ran the suggest on staging on 2026-11-07: 744 published listings sat on a group with children.
- Every row was checked by hand. 648 marked `APPLY` (31 of them with a better child swapped in), 96 `SKIP`. 24 of the skips were filed in the wrong group and were listed for the founder.
- The founder ran the dry run (0 problems), then the apply: 648 rows written, 744 down to 96.
- Rollback tested: 96 back to 744, then re-applied to 96. Staging now matches what prod will get.

## Follow-on: new subcategories and hand moves (founder, 2026-11-08)

Picks:

- Move all 24 wrong-group listings, plus 4 plant shops, to the right group's subcategory (28 `MOVE` rows). The plant shops go to Agriculture & Sustainability > Plant Shops & Nurseries.
- Add seven subcategories, so listings with no good child get one:

| Subcategory | Group | Listings that move in |
|---|---|---|
| Ice Cream & Desserts | Food & Dining | 3 |
| Beauty Supply | Beauty & Grooming | 1 |
| Hotels & Stays | Travel & Transportation | 2 |
| Car Dealers | Automotive | 1 |
| Bike Shops | Retail & Gifts | 1 |
| Cooking Classes | Education & Tutoring | 1 |
| Pharmacies | Healthcare | 1 |

What ships:

- Migration `20261108000000_seven_more_subcategories.sql`, additive, same ids as `supabase/seed.sql`, parent looked up by slug, re-run safe. Rollback notes are in its header.
- The "Help me choose" guide and its search box, plus search's related words, know the seven new names.
- The apply script takes `MOVE` rows (above).

Run order:

1. Migration on staging, then prod, by hand, with a ledger row each.
2. Staging: dry run and apply of the 38-row moves sheet (`subcategory-moves-staging-2026-11-08.csv`, gitignored). Check the counts.
3. Prod: the same sheet is rebuilt from the prod suggest, matched by `listing_id` and checked by name, then dry run and apply.
4. Merge after both migrations are in.

## Prod run (2026-11-11)

- Staging: the 38 hand moves applied (28 MOVE, 10 APPLY). Listings still on a group with children went from 96 to 58.
- Prod suggest (read-only): 620 published listings sat on a group with children.
- Prod listing ids are not the same as staging's, so the staging decisions were matched by name and current group instead of by `listing_id`. 609 of 620 matched. The other 11 were picked by hand: two chains with two locations each, one name with two staging rows, and six listings that exist only on prod.
- Prod dry run: 561 APPLY, 23 MOVE, 36 skipped, no problems. Apply at GATE-DATA: 584 written, rollback file written first. Listings still on a group with children went from 620 to 36.
- Rollback files (gitignored): `subcategory-rollback-2026-11-11T171116Z.csv` (staging) and `subcategory-rollback-2026-11-11T171747Z.csv` (prod), in `docs/blacqlist/ops/data/`.

