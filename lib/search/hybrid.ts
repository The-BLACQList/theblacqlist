// Meaning search next to keyword search (ticket 260).
//
// Keyword search needs the words to match. Meaning search (ticket 259) finds
// a soap maker for "bathroom products" because the two mean close to the same
// thing. It is used in two places only, and only to add to what the strict
// search found:
//
//   * Cue's search_listings tool, when it found fewer than three businesses
//   * the quick answer above the /search grid, as a Related Businesses row
//
// Never in the strict grid, its facet counts or /discover: those keep the
// founder's "no partial matches" rule (2026-10-14).
//
// The rule, one place for both callers:
//   * strict matches always come first and are never reordered or dropped
//   * fewer than RELATED_BELOW strict matches: up to RELATED_MAX related ones
//     follow, best meaning first, each at least RELATED_MIN_SIMILARITY close
//   * a related business already in the strict (or close) matches is skipped
//
// Off unless FEATURE_SEMANTIC_SEARCH is on and VOYAGE_API_KEY is set. Every
// failure is "no related businesses": the answer is never worse than keyword
// search alone. No server imports here; the callers hand in the data reads.

/** Below this many strict matches, related businesses are looked for. */
export const RELATED_BELOW = 3
/** The most related businesses added to one answer. */
export const RELATED_MAX = 5
/**
 * How close in meaning a business must be, from 0 to 1 (cosine similarity).
 * 0.45 is the starting point from the plan; tune it on the eval set
 * (scripts/eval/search-evals.ts) with the flag on and off.
 */
export const RELATED_MIN_SIMILARITY = 0.45
/** Rows asked of the database: a few spare, since some are already shown. */
export const RELATED_FETCH = 10

export interface RelatedHit {
  listingId: string
  similarity: number
}

export interface RelatedQuery {
  /** The words to match by meaning. */
  text: string
  /** Only businesses in this city, when the search was for one. */
  cityId?: string | null
  /** Ids already in the answer, never repeated as related. */
  exclude?: Iterable<string>
}

/** The two reads meaning search needs. Injected so tests run without either. */
export interface RelatedDeps {
  /** The query's numbers, or null when Voyage is off, slow or failing. */
  embed(text: string): Promise<number[] | null>
  /** The closest searchable listings, best first. */
  nearest(args: { embedding: number[]; limit: number; minSimilarity: number; cityId: string | null }): Promise<RelatedHit[]>
}

/**
 * Pure: the related ids to add, best first. Drops anything below the bar,
 * anything excluded, repeats, and stops at `max`.
 */
export function pickRelated(
  hits: readonly RelatedHit[],
  exclude: Iterable<string> = [],
  max: number = RELATED_MAX,
  minSimilarity: number = RELATED_MIN_SIMILARITY
): string[] {
  const skip = new Set(exclude)
  const out: string[] = []
  const sorted = [...hits]
    .filter((h) => Number.isFinite(h.similarity) && h.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
  for (const h of sorted) {
    if (out.length >= max) break
    if (skip.has(h.listingId)) continue
    skip.add(h.listingId)
    out.push(h.listingId)
  }
  return out
}

/** Whether to look for related businesses, given how many strict ones there are. */
export function wantsRelated(strictCount: number): boolean {
  return strictCount < RELATED_BELOW
}

/**
 * Related listing ids for one search, best first. Empty when there are no
 * words, Voyage gives no numbers, or the database read fails. Never throws.
 */
export async function findRelatedIds(
  query: RelatedQuery,
  deps: RelatedDeps,
  max: number = RELATED_MAX
): Promise<string[]> {
  const text = query.text.trim()
  if (!text || max <= 0) return []
  try {
    const embedding = await deps.embed(text)
    if (!embedding) return []
    const hits = await deps.nearest({
      embedding,
      limit: RELATED_FETCH,
      minSimilarity: RELATED_MIN_SIMILARITY,
      cityId: query.cityId ?? null,
    })
    return pickRelated(hits, query.exclude, max)
  } catch {
    return []
  }
}
