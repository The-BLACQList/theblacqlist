/**
 * Shared escaping for PostgREST `ilike` / `like` patterns.
 *
 * This lived inside app/api/listings/search/route.ts as a private function.
 * M4.14 needed the same escaping on /admin/entities, and copying it a second
 * time is precisely how `location_type` ended up with three drifting
 * definitions (lib/validations/search.ts:37-42 documents that failure mode).
 * One module, two importers.
 */

/**
 * `%` and `_` are wildcards to ilike, so a user typing "50%" would otherwise
 * match far more than they asked for. PostgREST parameterizes the value, so
 * this is a correctness fix, not an injection fix.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}
