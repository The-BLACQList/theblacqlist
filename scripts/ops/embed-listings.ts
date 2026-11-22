/**
 * Meaning-search backfill (ticket 260). One sync run, from a laptop.
 *
 * The daily cron (app/api/cron/embeddings) only runs on Production, so this
 * fills staging for the eval, or production at once instead of waiting for
 * 07:00 UTC. Same rules as the cron: lib/services/listingEmbeddings.ts.
 *
 * What stands between this script and a bad write:
 *
 *   1. The default is a dry run: it counts what a real run would embed and
 *      estimates the tokens, with no Voyage call and no write.
 *   2. `--apply` alone is refused; it needs `--yes`.
 *   3. It only writes listing_embeddings, which nothing shows the public
 *      directly, and only for listings the database calls searchable.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/ops/embed-listings.ts
 *   DATABASE_URL=postgres://... VOYAGE_API_KEY=... npx tsx scripts/ops/embed-listings.ts --apply --yes
 *
 * Even a dry run reads the target, so a run against production still needs
 * the founder's word. `--apply` against production is GATE-DATA. The key and
 * the URL are read from the environment only; this never prints either.
 */

import { Client } from 'pg'

import { describeConnectionTarget } from '../../lib/listings/locationTypeAudit'
import {
  SYNC_DEFAULT_LIMIT,
  syncListingEmbeddings,
  voyageDocumentEmbedder,
  type EmbeddingStore,
  type PendingListing,
} from '../../lib/services/listingEmbeddings'
import { voyageKey } from '../../lib/search/voyage'

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const YES = argv.includes('--yes')

function pgStore(db: Client): EmbeddingStore {
  return {
    async pending(model, limit) {
      const { rows } = await db.query<PendingListing>(
        'SELECT listing_id, content, content_hash FROM public.listing_embeddings_pending($1, $2)',
        [model, limit]
      )
      return rows
    },
    async save(rows) {
      for (const r of rows) {
        await db.query(
          `INSERT INTO public.listing_embeddings (listing_id, embedding, model, content_hash, embedded_at)
           VALUES ($1, $2::extensions.vector, $3, $4, $5)
           ON CONFLICT (listing_id) DO UPDATE
             SET embedding = EXCLUDED.embedding, model = EXCLUDED.model,
                 content_hash = EXCLUDED.content_hash, embedded_at = EXCLUDED.embedded_at`,
          [r.listing_id, r.embedding, r.model, r.content_hash, r.embedded_at]
        )
      }
    },
    async prune() {
      const { rows } = await db.query<{ n: number }>('SELECT public.listing_embeddings_prune() AS n')
      return Number(rows[0]?.n ?? 0)
    },
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }
  if (APPLY && !YES) {
    console.error('--apply writes embeddings and calls Voyage. Add --yes to go ahead.')
    process.exit(1)
  }
  if (APPLY && !voyageKey()) {
    console.error('VOYAGE_API_KEY is not set.')
    process.exit(1)
  }

  const target = describeConnectionTarget(url)
  console.log(`Target: ${target.kind}${target.projectRef ? ` (${target.projectRef})` : ''}`)
  console.log(APPLY ? 'Mode: APPLY (Voyage calls and writes)' : 'Mode: dry run (no Voyage call, no write)')

  const db = new Client({ connectionString: url })
  await db.connect()
  try {
    // Loops until nothing is pending, a run at a time, so a large table is
    // covered without one huge call. A run where every batch fails stops it.
    let total = { pending: 0, embedded: 0, failedBatches: 0, pruned: 0, tokens: 0 }
    for (let round = 0; round < 20; round++) {
      const summary = await syncListingEmbeddings(pgStore(db), voyageDocumentEmbedder, {
        dry: !APPLY,
        limit: SYNC_DEFAULT_LIMIT,
      })
      total = {
        pending: total.pending + (round === 0 ? summary.pending : 0),
        embedded: total.embedded + summary.embedded,
        failedBatches: total.failedBatches + summary.failedBatches,
        pruned: total.pruned + summary.pruned,
        tokens: total.tokens + summary.tokens,
      }
      if (!APPLY) {
        console.log(
          `Pending: ${summary.pending}${summary.pending >= SYNC_DEFAULT_LIMIT ? '+' : ''}, about ${summary.estimatedTokens ?? 0} tokens.`
        )
        return
      }
      if (summary.pending < SYNC_DEFAULT_LIMIT || summary.embedded === 0) break
    }
    console.log(
      `Embedded ${total.embedded} of ${total.pending} pending, ${total.tokens} tokens, ` +
        `${total.failedBatches} failed batches, ${total.pruned} pruned.`
    )
    if (total.failedBatches > 0) process.exitCode = 1
  } finally {
    await db.end()
  }
}

main().catch((err: unknown) => {
  // Message only: never the URL or the key.
  console.error(`embed-listings failed: ${err instanceof Error ? err.message : 'unknown error'}`)
  process.exit(1)
})
