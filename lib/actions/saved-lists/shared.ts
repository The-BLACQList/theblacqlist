// =============================================================================
// Saved-list action internals
// =============================================================================
// Shared by the five server actions in this directory. Not itself a
// `'use server'` module — it exports types and sync helpers, which an action
// file may not.
//
// Two things every action here depends on:
//
// 1. **The RLS-respecting client.** `createClient()` runs as the signed-in user,
//    so the seven policies in `20260812000000_saved_lists.sql` are the actual
//    authorization boundary. Nothing in this directory may reach for
//    `createServiceClient()` — that would bypass the only thing stopping user A
//    from filing user B's saves.
//
// 2. **An untyped view of the client.** `lib/supabase/types.ts` predates the
//    saved-list migration and has no `saved_lists` / `saved_list_items` entries,
//    so the generated `Database` type rejects them. `lib/listings/entityPage.ts:132`
//    already established the house escape hatch — `as unknown as SupabaseClient` —
//    for exactly this case (`listing_details_event` is missing too). Local row
//    types below keep the shapes honest at the call sites.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

/** Postgres unique-violation. Raised by `saved_lists_user_name_idx` on a duplicate name. */
export const UNIQUE_VIOLATION = '23505'

export type FieldErrors = { name?: string }

export type SavedListState =
  | { error: string; fieldErrors?: FieldErrors }
  | { success: true }
  | null

/** Generic failure copy. Never surface a raw Postgres message to a user. */
export const GENERIC_ERROR = 'Something went wrong. Please try again.'

export function fail(error: string, fieldErrors?: FieldErrors): SavedListState {
  return fieldErrors ? { error, fieldErrors } : { error }
}

export const ok: SavedListState = { success: true }

/**
 * Widen a typed client so the saved-list tables are reachable.
 * See the header note — this is the same workaround `entityPage.ts` uses.
 */
export function untyped(client: unknown): SupabaseClient {
  return client as unknown as SupabaseClient
}

/**
 * Resolve the caller's `saves` row for a listing, creating it if absent.
 *
 * `saved_list_items.save_id` references `saves(id)`, and the insert policy
 * additionally requires `save_id IN (SELECT id FROM saves WHERE user_id = auth.uid())`.
 * So filing a listing into a list is only possible once the listing is saved —
 * which is the intended product behaviour, not a limitation: adding to a list
 * implies a save.
 *
 * Returns `null` when the save could neither be found nor created.
 */
export async function resolveSaveId(
  sb: SupabaseClient,
  userId: string,
  listingId: string
): Promise<string | null> {
  const { data: existing } = await sb
    .from('saves')
    .select('id')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .maybeSingle()

  if (existing) return (existing as { id: string }).id

  const { data: created, error } = await sb
    .from('saves')
    .insert({ user_id: userId, listing_id: listingId })
    .select('id')
    .maybeSingle()

  // A concurrent save from another tab wins the race and trips the unique
  // constraint — re-read rather than fail, since the desired state now holds.
  if (error?.code === UNIQUE_VIOLATION) {
    const { data: raced } = await sb
      .from('saves')
      .select('id')
      .eq('user_id', userId)
      .eq('listing_id', listingId)
      .maybeSingle()
    return raced ? (raced as { id: string }).id : null
  }

  return created ? (created as { id: string }).id : null
}
