// Keeps listing_embeddings up to date (ticket 259).
//
// One run: drop rows for listings no longer shown, ask the database which
// searchable listings have no row or a stale one (their words or the model
// changed), embed those in batches, and save them. The database decides what
// is stale by hashing the same text it hands back, so this file never builds
// listing text itself. See supabase/migrations/20261206000000_listing_embeddings.sql.
//
// A dry run only counts: no Voyage call, no write. That is how the founder can
// see what the first real run would send, and roughly what it would cost,
// before anything leaves.

import type { SupabaseClient } from '@supabase/supabase-js'

import { toPgVector, voyageEmbed, VOYAGE_BATCH_MAX, VOYAGE_MODEL, type VoyageResult } from '@/lib/search/voyage'

export interface PendingListing {
  listing_id: string
  content: string
  content_hash: string
}

export interface EmbeddingRow {
  listing_id: string
  embedding: string
  model: string
  content_hash: string
  embedded_at: string
}

/** The database side, so the run can be tested without one. */
export interface EmbeddingStore {
  pending(model: string, limit: number): Promise<PendingListing[]>
  save(rows: EmbeddingRow[]): Promise<void>
  prune(): Promise<number>
}

export type Embedder = (texts: string[]) => Promise<VoyageResult | null>

export interface SyncOptions {
  dry?: boolean
  /** Listings looked at in one run. */
  limit?: number
  batchSize?: number
  model?: string
  now?: Date
}

export interface SyncSummary {
  model: string
  dry: boolean
  pending: number
  embedded: number
  failedBatches: number
  pruned: number
  tokens: number
  /** Dry run only: a rough count, about four characters a token. */
  estimatedTokens?: number
}

/** About four characters a token, rounded up: good enough to price a run. */
export function estimateTokens(texts: readonly string[]): number {
  return texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0)
}

export const SYNC_DEFAULT_LIMIT = 1000

export async function syncListingEmbeddings(
  store: EmbeddingStore,
  embed: Embedder,
  options: SyncOptions = {}
): Promise<SyncSummary> {
  const model = options.model ?? VOYAGE_MODEL
  const dry = options.dry ?? false
  const limit = Math.max(1, Math.min(options.limit ?? SYNC_DEFAULT_LIMIT, 2000))
  const batchSize = Math.max(1, Math.min(options.batchSize ?? 64, VOYAGE_BATCH_MAX))

  const pruned = dry ? 0 : await store.prune()
  const pending = await store.pending(model, limit)
  const summary: SyncSummary = { model, dry, pending: pending.length, embedded: 0, failedBatches: 0, pruned, tokens: 0 }

  if (dry) {
    summary.estimatedTokens = estimateTokens(pending.map((p) => p.content))
    return summary
  }

  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize)
    const result = await embed(batch.map((p) => p.content))
    if (!result || result.vectors.length !== batch.length) {
      // Left for the next run: a stale row is still found by its hash.
      summary.failedBatches += 1
      continue
    }
    const embeddedAt = (options.now ?? new Date()).toISOString()
    await store.save(
      batch.map((p, j) => ({
        listing_id: p.listing_id,
        embedding: toPgVector(result.vectors[j] ?? []),
        model,
        content_hash: p.content_hash,
        embedded_at: embeddedAt,
      }))
    )
    summary.embedded += batch.length
    summary.tokens += result.tokens
  }
  return summary
}

/** Voyage, as documents. */
export const voyageDocumentEmbedder: Embedder = (texts) => voyageEmbed(texts, 'document')

/**
 * The store on Supabase, service role. The new table and functions aren't in
 * the generated types yet, so the client is untyped here.
 */
export function supabaseEmbeddingStore(client: SupabaseClient): EmbeddingStore {
  return {
    async pending(model, limit) {
      const { data, error } = await client.rpc('listing_embeddings_pending', { p_model: model, p_limit: limit })
      if (error) throw new Error(`listing_embeddings_pending: ${error.message}`)
      return (data ?? []) as PendingListing[]
    },
    async save(rows) {
      if (rows.length === 0) return
      const { error } = await client.from('listing_embeddings').upsert(rows, { onConflict: 'listing_id' })
      if (error) throw new Error(`listing_embeddings upsert: ${error.message}`)
    },
    async prune() {
      const { data, error } = await client.rpc('listing_embeddings_prune')
      if (error) throw new Error(`listing_embeddings_prune: ${error.message}`)
      return typeof data === 'number' ? data : 0
    },
  }
}
