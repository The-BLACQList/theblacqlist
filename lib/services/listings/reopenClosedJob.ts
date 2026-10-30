import type { SupabaseClient } from '@supabase/supabase-js'

import { JOB_LIMIT_ENFORCED_FROM } from '@/lib/stripe/jobPostings'

// Ticket 155: an owner who moves a closed role's closing date into the future
// gets it back on the board, but only when a posting window still covers the
// new date. Otherwise the role stays closed and the editor says a new posting
// is needed.
//
// The status change runs on the service role, the same way submitJobForReview
// moves a draft into review: the listings owner guard
// (20260926000000_listings_entitlement_guard.sql) refuses every job status
// change from a user session. The caller has already checked that the user
// owns the listing and that it is a job; the write still filters on the owner,
// the entity type and the 'closed' status so it can only ever do this one move.
//
// Kept to a guard. Bulk reopen, or buying a fresh window from the editor, is
// ticket 156 if it is ever wanted.

type AnyClient = SupabaseClient | { from: SupabaseClient['from'] }

export const REOPEN_NEEDS_NEW_POSTING =
  'This role has closed. To open it again, post a new job.'

export type ReopenCoverage = { ok: true; covered: boolean } | { ok: false; error: string }

/**
 * Does a posting window cover a role staying open until `closesAt`?
 *
 * Covered when paid postings are off (nothing is sold, so nothing can lapse),
 * when the job predates the job allowance (grandfathered, same cutoff as
 * submitJobForReview), or when a paid or included ledger row has no end or
 * ends on or after the new closing date.
 */
export async function reopenCoverage(
  supabase: AnyClient,
  opts: {
    listingId: string
    createdAt: string | null
    closesAt: Date
    paidPostingsOn: boolean
  }
): Promise<ReopenCoverage> {
  const { listingId, createdAt, closesAt, paidPostingsOn } = opts
  if (!paidPostingsOn) return { ok: true, covered: true }
  if (createdAt && new Date(createdAt) < new Date(JOB_LIMIT_ENFORCED_FROM)) {
    return { ok: true, covered: true }
  }

  const { data, error } = await supabase
    .from('job_posting_purchases')
    .select('id, expires_at')
    .eq('listing_id', listingId)
    .eq('status', 'paid')
  if (error) return { ok: false, error: error.message }

  const target = closesAt.getTime()
  const covered = (data ?? []).some((row) => {
    const expiresAt = (row as { expires_at: string | null }).expires_at
    return !expiresAt || new Date(expiresAt).getTime() >= target
  })
  return { ok: true, covered }
}

/** closed -> published for one job, on the service role. Returns true when a row moved. */
export async function reopenClosedJob(
  serviceClient: AnyClient,
  listingId: string,
  ownerUserId: string
): Promise<{ ok: true; reopened: boolean } | { ok: false; error: string }> {
  const { data, error } = await serviceClient
    .from('listings')
    .update({ status: 'published' })
    .eq('id', listingId)
    .eq('owner_user_id', ownerUserId)
    .eq('entity_type', 'job')
    .eq('status', 'closed')
    .is('deleted_at', null)
    .select('id')
  if (error) return { ok: false, error: error.message }
  return { ok: true, reopened: (data ?? []).length > 0 }
}
