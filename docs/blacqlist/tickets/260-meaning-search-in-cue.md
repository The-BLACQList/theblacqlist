# Ticket 260: Meaning Search in Cue and the Quick Answer

**Status:** Merged #393 (75a1037), 2026-11-21. Staging eval skipped (founder). Flag on in prod 2026-11-21; one cron run embedded 706/706. Follow-up: ticket 263.

## Why
Founder, 2026-11-21: "How do I switch to Black Owned bathroom products" found nothing on production. Tickets 254–258 made search understand the question and always answer. Ticket 259 built the meaning-search index, with the flag off.

This ticket uses that index, so a search for "bathroom products" can find a soap maker even when no words match.

## The Rule
It lives in one place, `lib/search/hybrid.ts`, and both callers use it:
- **Strict first.** Businesses that match the words always come first and are never reordered or dropped.
- **Only when thin.** With fewer than 3 strict matches, up to 5 related businesses follow.
- **Close enough.** Each related one is at least 0.45 similar (cosine, 0 to 1). They are sorted by meaning, closest first.
- **No repeats.** A business already shown as a match or a close match is never repeated as related.
- **Off by default.** Nothing happens unless `FEATURE_SEMANTIC_SEARCH` is on and `VOYAGE_API_KEY` is set. Any failure means no related businesses, so the answer is never worse than keyword search alone.

**Never used in** the strict grid, facet counts or /discover. Those keep the "no partial matches" rule (2026-10-14). A test checks that none of those files import meaning search.

## What Changed

**Cue's `search_listings` tool** (`lib/ai/cue/tools.ts`):
- With fewer than 3 results, it asks meaning search with the model's words, the city if one was searched, and near me if asked.
- Results come back as `related`, with a note saying they are close in meaning, not matches for the words, and should never be shown as exact matches.
- The tool description says so. The prompt is unchanged: its rule on close matches already covers them.
- Skipped with Open Now, because meaning search can't check hours.
- Near me keeps businesses within 10 miles, plus online ones.
- A related business still counts as "found nothing" for the Suggest a Business button.
- Their cards are marked `related`. A business that a later search in the same turn matches by the words loses the mark.

**The quick answer** (`lib/search/basicAnswer.ts`):
- A Related Businesses row after the matches.
- It uses the understood words ("bathroom"), never the whole question. Browse mode ("black owned") sends nothing.
- Related ones take room before close matches, within the same 6 cards.
- New text when nothing matched the words: "Nothing matches "bathroom" word for word yet. Here are related businesses."

**On screen** (`components/assistant/AssistantAnswer.tsx`):
- Cards marked `related` sit under a **Related Businesses** heading, after the matches.
- This applies in the /search strip and the chat.
- Saved threads keep the mark (`lib/assistant/store.ts`).

**Server half** (`lib/services/relatedListings.ts`):
- Voyage for the query's numbers. `search_listings_semantic` (service role) for the closest listings.
- The public anon read for the cards, so unpublished listings never show.

**Logging:**
- `search_answer_served` gets `related_used` (true or false), for both AI and quick answers. It never includes the words.
- The chat panel's runs are not logged here. `ai_generation_requests` has no column for it, and adding one would need a migration.

**Backfill:**
- `scripts/ops/embed-listings.ts` runs the same sync as the daily cron, from a laptop. Use it to fill staging for the eval, or prod at once.
- Dry by default. `--apply` needs `--yes`. It reads `DATABASE_URL` and `VOYAGE_API_KEY` from the environment and never prints either.

**Eval:** `scripts/eval/search-evals.ts` marks related cards and adds a "With related businesses" line, so a run with the flag off and a run with it on can be compared.

## Privacy
- The founder OK'd the `#meaning-search` wording and opted out of Voyage data training (2026-11-21).
- The paragraph already says the words searched go to Voyage, with no account, location or IP.
- It and the Voyage provider row show only while the flag is on.

## Tests
`tests/meaning-search-related.test.ts` (36 tests) covers:
- The rule: the bar, the order, repeats, the cap of 5, the 3-match threshold.
- Failure paths: no words, no numbers, a database error, a failing load.
- The off switch: no flag, no key.
- Near me.
- Cue's tool: when it adds related results, when it doesn't, Open Now, the related marks.
- The quick answer: understood words, browse mode, failure, how the 6 cards are shared.
- The heading on screen and the saved thread.
- That the grid, facets and /discover never use it.

`tests/cue-route.test.ts` now expects `related_used` on the analytics row.

## Rollout
1. Merge. Nothing changes: the flag is off everywhere.
2. **Staging eval:**
   - Fill the staging index: `DATABASE_URL=<staging> VOYAGE_API_KEY=… npx tsx scripts/ops/embed-listings.ts --apply --yes`. Staging has 901 listings, about 84k tokens, inside the free 200M.
   - Run `scripts/eval/search-evals.ts` on a Preview with `FEATURE_SEMANTIC_SEARCH` off, then on.
   - Compare "With cards" and "With related businesses", and read the related cards for fit. Raise 0.45 if they look loose.
3. **Prod (GATE-DEPLOY):**
   - Set `FEATURE_SEMANTIC_SEARCH=true` in Production and redeploy.
   - Trigger `/api/cron/embeddings` once, or run the script against prod. Prod has 706 listings, about 66k tokens.
   - Until the index fills, related lookups find nothing and answers stay as they are.
4. Watch `search_answer_served.related_used` for 48 hours.
