# Ticket 170: Suggest and fill missing subcategories

**Phase:** V1.5 · **Priority:** P1 · **Status:** Code complete, not yet run. Waiting on the founder's staging suggest run.
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
  - Only `APPLY` rows. Each must move the listing from its group to one of that group's own children, checked against the categories table on the target. Any bad row stops the run before a write.
  - Writes `subcategory-rollback-<date>.csv` (old and new `category_id`) before the first UPDATE.
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
