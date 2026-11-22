import 'server-only'

// The server half of meaning search (ticket 260): Voyage for the query's
// numbers, search_listings_semantic for the closest listings, and the public
// listing rows for the cards. The rule itself is in lib/search/hybrid.ts.
//
// Used by Cue's search tool and the /search quick answer only. Off unless
// FEATURE_SEMANTIC_SEARCH is on and VOYAGE_API_KEY is set; every failure is
// an empty list.

import type { SupabaseClient } from '@supabase/supabase-js'

import { isFeatureEnabled } from '@/lib/env'
import { DEFAULT_RADIUS_MILES } from '@/lib/listings/location-params'
import { distanceMiles, type LatLng } from '@/lib/map/distance'
import { findRelatedIds, RELATED_MAX, type RelatedDeps, type RelatedHit, type RelatedQuery } from '@/lib/search/hybrid'
import { toPgVector, voyageEmbedQuery, voyageKey, VOYAGE_MODEL } from '@/lib/search/voyage'
import { createServiceClient } from '@/lib/supabase/server'
import type { DiscoveryEntity } from '@/types'

/** Flag on and a key set. Checked on each call, never at import. */
export function meaningSearchOn(): boolean {
  return isFeatureEnabled('semanticSearch') && voyageKey() !== null
}

export const voyageRelatedDeps: RelatedDeps = {
  embed: (text) => voyageEmbedQuery(text),
  async nearest({ embedding, limit, minSimilarity, cityId }) {
    // The function isn't in the generated types yet.
    const client = createServiceClient() as unknown as SupabaseClient
    const { data, error } = await client.rpc('search_listings_semantic', {
      p_embedding: toPgVector(embedding),
      p_model: VOYAGE_MODEL,
      p_limit: limit,
      p_min_similarity: minSimilarity,
      p_city_id: cityId,
    })
    if (error) throw new Error('RELATED_SEARCH_FAILED')
    return ((data ?? []) as Array<{ listing_id: string; similarity: number | string }>).map(
      (r): RelatedHit => ({ listingId: r.listing_id, similarity: Number(r.similarity) })
    )
  },
}

/**
 * Near me: a related business counts when its pin is within the search
 * radius, or it serves people online. Pinless in-person businesses are left
 * out rather than guessed at.
 */
export function withinReach(e: DiscoveryEntity, near: LatLng, miles: number = DEFAULT_RADIUS_MILES): boolean {
  if (e.location_type === 'virtual') return true
  if (typeof e.lat !== 'number' || typeof e.lng !== 'number') return false
  return distanceMiles(near, { lat: e.lat, lng: e.lng }) <= miles
}

export interface RelatedRequest extends RelatedQuery {
  near?: LatLng | null
  max?: number
}

/**
 * Related businesses for one search, best first, as public listing rows.
 * Empty when meaning search is off or anything fails.
 */
export async function findRelatedListings(
  request: RelatedRequest,
  loadByIds: (ids: readonly string[]) => Promise<DiscoveryEntity[]>,
  deps: RelatedDeps = voyageRelatedDeps
): Promise<DiscoveryEntity[]> {
  if (!meaningSearchOn()) return []
  const max = request.max ?? RELATED_MAX
  // Near me: ask for more, since some will be too far away.
  const ids = await findRelatedIds(request, deps, request.near ? max * 2 : max)
  if (ids.length === 0) return []
  try {
    const found = await loadByIds(ids)
    const near = request.near
    return (near ? found.filter((e) => withinReach(e, near)) : found).slice(0, max)
  } catch {
    return []
  }
}
