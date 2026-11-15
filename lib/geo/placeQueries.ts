// Server-side calls for the US places list (ticket 230). Shared by the two
// /api/places routes and the onboarding save.
//
// us_places and its functions are newer than the generated Database types
// (lib/supabase/types.ts is generated from production), so these go through
// the untyped client, the same way lib/listings/facets.ts does.

import type { SupabaseClient } from '@supabase/supabase-js'

import { PLACE_GEOID_PATTERN, splitPlaceQuery } from './usPlaces'

export interface PlaceSuggestion {
  geoid: string
  label: string
}

type RpcFn = (
  fn: string,
  args: Record<string, unknown>
) => Promise<{ data: unknown; error: unknown }>

function rpc(client: SupabaseClient): RpcFn {
  return client.rpc.bind(client) as unknown as RpcFn
}

function toSuggestions(data: unknown): PlaceSuggestion[] {
  if (!Array.isArray(data)) return []
  return data.flatMap((r): PlaceSuggestion[] => {
    const row = r as { geoid?: unknown; label?: unknown } | null
    if (!row || typeof row.geoid !== 'string' || typeof row.label !== 'string') return []
    if (!PLACE_GEOID_PATTERN.test(row.geoid)) return []
    return [{ geoid: row.geoid, label: row.label }]
  })
}

/** Up to `limit` places for what someone typed. Errors answer an empty list. */
export async function suggestPlaces(
  client: SupabaseClient,
  raw: string,
  limit = 8
): Promise<{ places: PlaceSuggestion[]; ok: boolean }> {
  const q = splitPlaceQuery(raw)
  if (q.name.length < 2 && q.altName.length < 2) return { places: [], ok: true }
  const { data, error } = await rpc(client)('suggest_us_places', {
    p_name: q.name,
    p_state: q.state,
    p_alt_name: q.altName,
    p_alt_state: q.altState,
    p_limit: limit,
  })
  if (error) return { places: [], ok: false }
  return { places: toSuggestions(data), ok: true }
}

/** The closest place to a point, or null. */
export async function nearestPlace(
  client: SupabaseClient,
  lat: number,
  lng: number
): Promise<{ place: PlaceSuggestion | null; ok: boolean }> {
  const { data, error } = await rpc(client)('nearest_us_place', { p_lat: lat, p_lng: lng })
  if (error) return { place: null, ok: false }
  return { place: toSuggestions(data)[0] ?? null, ok: true }
}
