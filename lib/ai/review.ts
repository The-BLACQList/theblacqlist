/**
 * Loading a suggestion for a review action, and the expiry rule.
 *
 * ── This is the authorization check, so it is written to be boring ───────────
 * Owners have SELECT on `ai_suggestions` and nothing else, so every state change
 * runs through the service client with RLS switched off. That makes the check
 * below the only thing between one owner and another owner's suggestions. It is
 * one join, one `eq`, and no branch that can be reached without it — a shape
 * chosen because it is easy to read and hard to get wrong, not because it is
 * elegant.
 *
 * The read also uses the service client rather than the owner's client, even
 * though the owner could read most of these rows themselves. The owner's RLS
 * policy hides `rejected` and `expired` suggestions, which would make an
 * already-rejected row indistinguishable from a row that never existed — and
 * "not found" is the wrong thing to tell someone who is looking at a suggestion
 * they rejected an hour ago.
 *
 * ── Expiry is decided when someone looks, not by a sweep ─────────────────────
 * The safety plan says unreviewed suggestions become `expired` after 7 days.
 * There is no scheduled job doing that, so expiry is evaluated on access: a
 * `pending` row past the window is written to `expired` and refused. Two
 * consequences worth stating plainly rather than discovering later — a suggestion
 * nobody opens stays `pending` in the table indefinitely, and the `expired_at`
 * transition happens whenever it is first noticed rather than on the seventh day.
 * Neither affects what an owner can act on, which is the thing the rule exists to
 * control. A cron sweep would make the stored state match the clock; it is filed
 * as debt, not pretended into place here.
 */

import { createServiceClient } from '@/lib/supabase/server'

export const SUGGESTION_EXPIRY_DAYS = 7

export interface OwnedSuggestion {
  id: string
  listingId: string
  status: string
  suggestionText: string
  agentType: string
  suggestionType: string
  createdAt: string
}

export type LoadResult =
  | { ok: true; suggestion: OwnedSuggestion }
  | { ok: false; error: string }

function isExpired(createdAt: string): boolean {
  const age = Date.now() - new Date(createdAt).getTime()
  return age > SUGGESTION_EXPIRY_DAYS * 24 * 60 * 60 * 1_000
}

/**
 * Loads a suggestion only if `userId` owns the listing it belongs to.
 *
 * `expectedStatus` is required, not optional: every caller knows which state it
 * is transitioning from, and passing it means a double-submitted Approve returns
 * "already reviewed" instead of silently approving twice and stamping a second
 * `reviewed_at`.
 */
export async function loadOwnedSuggestion(
  suggestionId: string,
  userId: string,
  expectedStatus: 'pending' | 'approved'
): Promise<LoadResult> {
  if (!suggestionId) return { ok: false, error: 'Missing suggestion ID.' }

  const supabase = createServiceClient()

  const { data: row } = await supabase
    .from('ai_suggestions')
    .select(
      'id, listing_id, status, suggestion_text, agent_type, suggestion_type, created_at, listings!inner ( owner_user_id, deleted_at )'
    )
    .eq('id', suggestionId)
    .maybeSingle()

  if (!row) return { ok: false, error: 'Suggestion not found.' }

  const listing = row.listings as unknown as {
    owner_user_id: string | null
    deleted_at: string | null
  } | null

  // Deliberately the same message for "someone else's suggestion" and "no such
  // suggestion". Telling a stranger that the ID exists is telling them something.
  if (!listing || listing.deleted_at || listing.owner_user_id !== userId) {
    return { ok: false, error: 'Suggestion not found.' }
  }

  if (row.status === 'pending' && isExpired(row.created_at)) {
    await supabase.from('ai_suggestions').update({ status: 'expired' }).eq('id', row.id)
    return {
      ok: false,
      error: `This suggestion is more than ${SUGGESTION_EXPIRY_DAYS} days old and has expired. Request a new one.`,
    }
  }

  if (row.status !== expectedStatus) {
    return { ok: false, error: `This suggestion has already been ${row.status}.` }
  }

  return {
    ok: true,
    suggestion: {
      id: row.id,
      listingId: row.listing_id,
      status: row.status,
      suggestionText: row.suggestion_text,
      agentType: row.agent_type,
      suggestionType: row.suggestion_type,
      createdAt: row.created_at,
    },
  }
}
