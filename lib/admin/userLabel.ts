// =============================================================================
// Admin user labels
// =============================================================================
// Admin surfaces need a human-readable name for a user ID. `profiles.display_name`
// is optional and most accounts never set it, so several admin views were
// rendering "Unknown" — or, worse, a raw UUID — for real, identifiable people
// (Finding 8, founder click-walk 2026-08-06).
//
// The fallback ladder already existed in app/admin/reviews/[id]/page.tsx:
// display_name → auth email. This lifts it into one place so every admin
// surface resolves a user the same way, and batches the lookups so a list
// page does not fire one round trip per row.
//
// Service-role only: reading auth.users requires the admin API. Emails
// surfaced here stay inside the admin UI — they never enter an ops artifact
// (`data-privacy.md`).
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'

/** Rendered when a user ID resolves to no name, no email, and no caller fallback. */
export const UNKNOWN_USER_LABEL = 'Unknown user'

type ServiceClient = SupabaseClient<Database>

/**
 * Batch-resolve display labels for a set of user IDs.
 *
 * Ladder: `profiles.display_name` → auth email. IDs that resolve to neither are
 * absent from the returned map, so a caller with its own extra fallback (a
 * claim's `verification_email`, say) can layer it on top.
 *
 * One `profiles` query for the whole set; the auth API has no batch
 * `getUserById`, so the per-user lookups run only for the IDs still missing a
 * label — usually none — and run concurrently.
 */
export async function resolveUserLabels(
  client: ServiceClient,
  userIds: readonly (string | null | undefined)[]
): Promise<Record<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return {}

  const labels: Record<string, string> = {}

  const { data: profiles } = await client.from('profiles').select('id, display_name').in('id', ids)
  for (const profile of profiles ?? []) {
    if (profile.display_name) labels[profile.id] = profile.display_name
  }

  const missing = ids.filter((id) => !labels[id])
  if (missing.length === 0) return labels

  const resolved = await Promise.all(
    missing.map(async (id) => {
      try {
        const { data } = await client.auth.admin.getUserById(id)
        return [id, data.user?.email ?? null] as const
      } catch {
        // A label lookup must never take down an admin page. Fall through to
        // whatever the caller uses for an unresolved ID.
        return [id, null] as const
      }
    })
  )
  for (const [id, email] of resolved) {
    if (email) labels[id] = email
  }

  return labels
}

/**
 * Single-user convenience wrapper. Returns `null` when nothing resolves, so the
 * caller decides between its own fallback and {@link UNKNOWN_USER_LABEL}.
 */
export async function resolveUserLabel(
  client: ServiceClient,
  userId: string | null | undefined
): Promise<string | null> {
  if (!userId) return null
  const labels = await resolveUserLabels(client, [userId])
  return labels[userId] ?? null
}
