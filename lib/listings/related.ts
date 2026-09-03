/**
 * Related-listings merge for the entity page's "You Might Also Like" rail.
 *
 * The rail is fed by two queries that both pin entity_type and category_id: a
 * local pass (same city, or the city-less cohort) and a national pass. Local
 * results come first so a listing's neighbours outrank a higher-saved match
 * three states away; the national pass then tops the rail up. Both are ordered
 * by save_count, so the merge only has to de-duplicate and cap — it never
 * re-sorts, which would undo the locality preference.
 *
 * Lives in its own module, apart from `entityPage.ts`, so it is unit-testable
 * without pulling in the Supabase server client.
 */

/** Cards the rail asks for. EntityRelatedDiscovery hides itself below 3. */
export const RELATED_LIMIT = 6

export function mergeRelated<T extends { id: string }>(
  local: T[] | null | undefined,
  anywhere: T[] | null | undefined,
  limit: number = RELATED_LIMIT
): T[] {
  const out: T[] = []
  const seen = new Set<string>()

  for (const row of [...(local ?? []), ...(anywhere ?? [])]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
    if (out.length === limit) break
  }

  return out
}
