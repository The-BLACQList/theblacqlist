# Ticket 259: Meaning Search Setup (Flag Off)

**Status:** Merged #390 (b320baf), 2026-11-21. Migration applied on staging and prod (checks passed). Flag off everywhere.

## Why
Founder, 2026-11-21: "How do I switch to Black Owned bathroom products" found nothing on production. Tickets 254–258 made search understand the question and always answer. Keyword search still needs the words to match.

Meaning search finds a soap maker for "bathroom products" because the two mean close to the same thing. The founder picked Voyage AI for it.

This ticket builds the store and the daily job. Ticket 260 uses it in Cue and the quick answer. It is never used in the strict grid.

## What Changed

**Migration `20261206000000_listing_embeddings.sql` (additive):**
- Turns on `vector` in the `extensions` schema.
- `listing_embeddings`: listing, 1024 numbers, model, text hash, time. HNSW cosine index. RLS on with no policies, so it is service role only.
- `listing_embedding_text(id)`: the public words a listing is embedded from.
  - Includes name, tagline, category and its group, description (first 1,500 characters), service area, place words and active tags.
  - Excludes owner details, contact fields and reviews.
- `listing_embeddings_pending(model, limit)`: searchable listings with no row, or whose words or model changed. The hash covers both, so an edit, a new tag or a category move is picked up with no triggers.
- `listing_embeddings_prune()`: drops rows for listings no longer shown.
- `search_listings_semantic(vector, model, limit, min_similarity, city)`: the closest searchable listings, best first. Only published, not deleted, not flagged listings are returned.
- Every function is service role only.

**Code:**
- `lib/search/voyage.ts`: the Voyage client.
  - Uses `voyage-4-lite` with 1024 numbers.
  - A search waits at most 1.5 s; the cron waits 20 s.
  - No key, a bad status, a timeout or a malformed reply returns `null`, and keyword search carries on.
  - Logs only the status, never the body.
  - Keeps a 200-entry memory of recent search numbers.
- `lib/services/listingEmbeddings.ts`: one sync run.
  - Prunes first, then finds pending listings, embeds them in batches of 64 and saves them.
  - A failed batch is left for the next run.
  - A dry run counts and estimates tokens with no call and no write.
- `app/api/cron/embeddings/route.ts`: runs daily at 07:00 UTC (`vercel.ts`).
  - Uses `CRON_SECRET`.
  - Skips while the flag is off.
  - Returns 503 if the flag is on but `VOYAGE_API_KEY` is missing.
  - `?dry=1` works with the flag off.
- `lib/env.ts`: `semanticSearch` / `FEATURE_SEMANTIC_SEARCH`, closed by default on every deployment.

**Privacy:**
- The Privacy Policy gets a `#meaning-search` paragraph and a Voyage AI row in the provider table.
- Both show only while the flag is on, so the page names Voyage exactly while we send it anything.
- The text is marked [Needs professional review]. The URL is marked [VERIFY BEFORE POSTING].
- `docs/blacqlist/ai/v2-provider-privacy-audit.md` gets section 11.

## Cost
`voyage-4-lite` costs $0.02 per million tokens, and the first 200M tokens are free. A listing is about 100–300 tokens, so embedding every listing costs well under a cent. Search words are a few tokens each.

## Tests
`tests/meaning-search-setup.test.ts` covers:
- The client request and every failure path.
- The query memory.
- The sync run: dry, batches, a failed batch, bounds.
- The cron: auth, flag, key, dry, a red run.
- The migration: service role only, the search filter, public fields only.
- The privacy gate.

`tests/feature-flags.test.ts` checks the flag stays off everywhere until set.

There is no local pgvector, so the SQL is checked by reading it. It runs for real on staging.

## Rollout
1. Merge. Nothing changes: the flag is off everywhere.
2. Apply the migration on staging, then run the SQL checks below (GATE-DATA).
3. Apply it on prod (GATE-DATA).
4. Ticket 260:
   - Use meaning search in Cue and the quick answer.
   - Turn the flag on for a Preview or staging and compare evals.
   - The founder OKs the privacy wording.
   - Turn the flag on in prod (GATE-DEPLOY) and trigger the cron once to fill the index.

**SQL checks on staging:**
- `SELECT count(*) FROM listing_embeddings_pending('voyage-4-lite', 2000);` should equal the number of searchable listings.
- `SELECT listing_embedding_text(id) FROM listings WHERE status = 'published' LIMIT 3;` should be readable public text.
- `SELECT has_table_privilege('anon', 'listing_embeddings', 'SELECT');` should be false.

## Founder Asks
- Done 2026-11-21: the founder OK'd the Privacy Policy wording (`#meaning-search`).
- Done 2026-11-21: the founder opted out of data training in the Voyage dashboard.
