// Voyage AI embeddings for meaning search (ticket 259).
//
// An embedding is a listing's (or a query's) meaning as 1024 numbers. Two
// texts that mean close to the same thing ("bathroom products", "handmade
// soap") get numbers that sit close together, so search can find a match
// with no shared words. The founder picked Voyage for it (2026-11-21).
//
// What goes to Voyage:
//   * documents: public listing text only (name, tagline, category, about,
//     service area, place, tags). See listing_embedding_text() in
//     supabase/migrations/20261206000000_listing_embeddings.sql.
//   * queries (ticket 260): the words a visitor searched, with no account,
//     IP or location attached.
//
// Every call fails soft: no key, a timeout, a bad status or a malformed reply
// returns null, and the caller keeps keyword search. Nothing here throws.
//
// Server only. The key is VOYAGE_API_KEY (Vercel, Production + Preview,
// Sensitive). It is read on each call, never at import.

export const VOYAGE_ENDPOINT = 'https://api.voyageai.com/v1/embeddings'
/** $0.02 per million tokens; the first 200M tokens on the account are free. */
export const VOYAGE_MODEL = 'voyage-4-lite'
export const VOYAGE_DIMENSIONS = 1024
/** Voyage takes up to 1,000 texts a call; listings are short, so 128 keeps each call small. */
export const VOYAGE_BATCH_MAX = 128
/** A search waits at most this long for its query's numbers before going on without them. */
export const VOYAGE_QUERY_TIMEOUT_MS = 1500
/** The cron can wait longer: nobody is watching it. */
export const VOYAGE_DOCUMENT_TIMEOUT_MS = 20000

export type VoyageInputType = 'query' | 'document'

export interface VoyageResult {
  vectors: number[][]
  tokens: number
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export interface VoyageOptions {
  apiKey?: string
  model?: string
  timeoutMs?: number
  fetchImpl?: FetchLike
}

/** The key, trimmed, or null when it isn't set. */
export function voyageKey(): string | null {
  const key = process.env.VOYAGE_API_KEY?.trim()
  return key ? key : null
}

function isVector(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.length === VOYAGE_DIMENSIONS &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n))
  )
}

/**
 * Embeds texts in one call, in order. Null on any failure, or when the reply
 * doesn't hold exactly one 1024-number vector per text.
 */
export async function voyageEmbed(
  texts: readonly string[],
  inputType: VoyageInputType,
  options: VoyageOptions = {}
): Promise<VoyageResult | null> {
  if (texts.length === 0) return { vectors: [], tokens: 0 }
  if (texts.length > VOYAGE_BATCH_MAX) return null
  const apiKey = options.apiKey ?? voyageKey()
  if (!apiKey) return null

  const timeoutMs =
    options.timeoutMs ?? (inputType === 'query' ? VOYAGE_QUERY_TIMEOUT_MS : VOYAGE_DOCUMENT_TIMEOUT_MS)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await (options.fetchImpl ?? fetch)(VOYAGE_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: texts,
        model: options.model ?? VOYAGE_MODEL,
        input_type: inputType,
        output_dimension: VOYAGE_DIMENSIONS,
        truncation: true,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      // Status only: the body can echo the input back.
      console.error(`[voyage] embeddings call failed with status ${res.status}`)
      return null
    }
    const body = (await res.json()) as { data?: unknown; usage?: { total_tokens?: unknown } }
    if (!Array.isArray(body.data) || body.data.length !== texts.length) return null
    const vectors: number[][] = new Array(texts.length)
    for (const item of body.data as Array<{ embedding?: unknown; index?: unknown }>) {
      const i = item?.index
      if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= texts.length) return null
      if (!isVector(item.embedding)) return null
      vectors[i] = item.embedding
    }
    if (vectors.some((v) => v === undefined)) return null
    const tokens = typeof body.usage?.total_tokens === 'number' ? body.usage.total_tokens : 0
    return { vectors, tokens }
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError'
    console.error(`[voyage] embeddings call ${timedOut ? 'timed out' : 'failed'}`)
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ─── Query numbers, remembered ────────────────────────────────────────────────
// The same search asked again on the same server instance doesn't call Voyage
// twice. Small and per-instance on purpose: it saves a call, it isn't a store.

const QUERY_CACHE_MAX = 200
const queryCache = new Map<string, number[]>()

function queryCacheKey(model: string, query: string): string {
  return `${model}\n${query.trim().toLowerCase().replace(/\s+/g, ' ')}`
}

/** A search's numbers, or null when Voyage can't be reached in time. */
export async function voyageEmbedQuery(query: string, options: VoyageOptions = {}): Promise<number[] | null> {
  const text = query.trim()
  if (!text) return null
  const key = queryCacheKey(options.model ?? VOYAGE_MODEL, text)
  const hit = queryCache.get(key)
  if (hit) {
    // Refresh its place so the newest searches stay.
    queryCache.delete(key)
    queryCache.set(key, hit)
    return hit
  }
  const result = await voyageEmbed([text.slice(0, 2000)], 'query', options)
  const vector = result?.vectors[0]
  if (!vector) return null
  queryCache.set(key, vector)
  if (queryCache.size > QUERY_CACHE_MAX) {
    const oldest = queryCache.keys().next().value
    if (oldest !== undefined) queryCache.delete(oldest)
  }
  return vector
}

/** For tests. */
export function clearVoyageQueryCache(): void {
  queryCache.clear()
}

/** pgvector's text form: "[0.1,0.2,…]". */
export function toPgVector(vector: readonly number[]): string {
  return `[${vector.join(',')}]`
}
