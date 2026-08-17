import type { SupabaseClient } from '@supabase/supabase-js'

import { writeSystemAuditLog } from '@/lib/audit/system'
import { SUGGESTION_EXPIRY_DAYS } from '@/lib/ai/review'

/**
 * =============================================================================
 * Scheduled expiry sweeps — making stored state match the clock
 * =============================================================================
 *
 * Two rules in this product were written as "after N days, X expires" and then
 * implemented as *checks at the moment someone looks*, because there was no
 * scheduled task to run them. Both places said so in their own source rather
 * than pretending otherwise:
 *
 *   lib/ai/review.ts        — "A cron sweep would make the stored state match
 *                              the clock; it is filed as debt."
 *   lib/stripe/jobPostings.ts — "nothing unpublishes an already-live job when
 *                              its window ends; that needs a scheduled task."
 *
 * This module is that scheduled task. It is deliberately two small functions
 * taking a client, not a route: the route is auth plus plumbing, and the rules
 * are what deserve tests.
 *
 * ── The two sweeps are not equally dangerous, and are not written alike ──────
 *
 * The suggestion sweep CANNOT change what any owner is allowed to do.
 * `loadOwnedSuggestion` already refuses a `pending` row past the window and
 * writes it to `expired` on the way out, so a swept row and an unswept row
 * behave identically to a user. The sweep only stops rows sitting `pending`
 * forever because nobody opened them. Worst case for a bug here is a cosmetic
 * status; there is no access consequence in either direction.
 *
 * The job sweep unpublishes a live listing. Getting its predicate wrong takes a
 * business's job posting off the site. So it is written the cautious way round:
 * it computes *who has definitively lapsed* and touches only those, rather than
 * computing who is still paid and unpublishing the rest. Three cases that the
 * inverted version would get wrong, and that are pinned by tests:
 *
 *   1. A job with NO purchase row at all is never touched. Those are the jobs
 *      posted before E-2 existed, when posting was free. Unpublishing them
 *      would retroactively charge for something that was given away — the most
 *      expensive mistake available in this file.
 *   2. A renewal is a SECOND purchase row, not an edit of the first
 *      (`20260817000000_job_posting_purchases.sql` says so explicitly and
 *      declines the unique constraint on `listing_id` for that reason). A
 *      listing with one expired row and one live row is paid, not lapsed.
 *   3. A paid row with a null `expires_at` never lapses. Nothing writes that
 *      today, but `expires_at` is nullable, and "unknown window" must not read
 *      as "expired".
 *
 * That is the exact inverse of `hasPaidJobPosting`, restricted to listings that
 * appear in the purchase ledger at all — and it is written as the inverse on
 * purpose so the two cannot drift into disagreeing about what "paid" means.
 *
 * ── Why the client is untyped here ──────────────────────────────────────────
 * `job_posting_purchases` is not in the generated `Database` types because its
 * migration has not been applied yet (founder debt, Wave G). `AnyClient` is the
 * same escape hatch `lib/stripe/jobPostings.ts` already uses for the same table
 * and the same reason — not a new liberty taken here.
 * =============================================================================
 */

type AnyClient = SupabaseClient | { from: SupabaseClient['from'] }

const DAY_MS = 24 * 60 * 60 * 1_000

export interface SuggestionSweepResult {
  /** Rows moved from `pending` to `expired`. */
  expired: number
  /** The `created_at` boundary used, so a caller can log what it actually ran. */
  cutoff: string
}

export interface JobSweepResult {
  /** Listings with at least one paid purchase whose every window has closed. */
  lapsed: number
  /** Of those, the ones actually moved `published` → `unpublished`. */
  unpublished: number
  /** Listings with an expired purchase that were spared by a live renewal. */
  renewed: number
}

/**
 * Moves `pending` AI suggestions past the review window to `expired`.
 *
 * One filtered UPDATE rather than read-then-write: the predicate is the whole
 * rule, the database can evaluate it, and doing it in one statement means two
 * overlapping cron runs cannot fight over the same rows. Re-running is a no-op
 * because the second run finds nothing still `pending`.
 *
 * The cutoff is derived from {@link SUGGESTION_EXPIRY_DAYS} — the same constant
 * `lib/ai/review.ts` checks against — so the sweep and the on-access check can
 * never disagree about how old is too old.
 */
export async function expireStaleSuggestions(
  supabase: AnyClient,
  now: Date = new Date()
): Promise<SuggestionSweepResult> {
  const cutoff = new Date(now.getTime() - SUGGESTION_EXPIRY_DAYS * DAY_MS).toISOString()

  const { data, error } = await supabase
    .from('ai_suggestions')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id')

  // Throw rather than report zero. A sweep that failed and a sweep that found
  // nothing to do produce the same number, and only one of them is fine.
  if (error) {
    throw new Error(`ai_suggestions expiry sweep failed: ${error.message}`)
  }

  return { expired: data?.length ?? 0, cutoff }
}

interface PurchaseRow {
  listing_id: string
  expires_at: string | null
}

/**
 * Unpublishes job listings whose paid posting window has closed.
 *
 * Reads the purchase ledger first and the listings second. The ledger is the
 * only place that knows a listing was ever paid for, and "was never paid for"
 * and "was paid for and lapsed" must not be confused — see the header.
 *
 * The UPDATE re-states `entity_type`, `status` and `deleted_at` even though the
 * candidate set was built from the ledger. That is a belt on top of braces: if
 * the grouping above were ever wrong about a listing, the predicate still makes
 * it impossible to unpublish something that is not a currently-published job.
 */
export async function unpublishExpiredJobPostings(
  supabase: AnyClient,
  now: Date = new Date()
): Promise<JobSweepResult> {
  const { data, error } = await supabase
    .from('job_posting_purchases')
    .select('listing_id, expires_at')
    .eq('status', 'paid')

  if (error) {
    throw new Error(`job posting purchase read failed: ${error.message}`)
  }

  const nowMs = now.getTime()
  // listing_id → does this listing still hold at least one live window?
  const stillPaid = new Map<string, boolean>()

  for (const row of (data ?? []) as PurchaseRow[]) {
    if (!row.listing_id) continue
    // A null expiry is an open-ended window, not an expired one.
    const live = !row.expires_at || new Date(row.expires_at).getTime() > nowMs
    stillPaid.set(row.listing_id, (stillPaid.get(row.listing_id) ?? false) || live)
  }

  const lapsedIds: string[] = []
  let renewed = 0
  for (const [listingId, live] of stillPaid) {
    if (live) renewed += 1
    else lapsedIds.push(listingId)
  }
  // `renewed` counts listings spared by a live window; a listing that has only
  // ever had one live purchase is in there too, which is the honest reading of
  // "the ledger says this one is still paid".

  if (lapsedIds.length === 0) {
    return { lapsed: 0, unpublished: 0, renewed }
  }

  const { data: updated, error: updateError } = await supabase
    .from('listings')
    .update({ status: 'unpublished' })
    .in('id', lapsedIds)
    .eq('entity_type', 'job')
    .eq('status', 'published')
    .is('deleted_at', null)
    .select('id')

  if (updateError) {
    throw new Error(`job posting unpublish failed: ${updateError.message}`)
  }

  const unpublishedIds = ((updated ?? []) as { id: string }[]).map((row) => row.id)

  // One audit row per listing, not one for the batch. An owner asking "why did
  // my job disappear" is asking about one listing, and the answer has to be
  // findable by that listing's id.
  for (const listingId of unpublishedIds) {
    await writeSystemAuditLog({
      actorUserId: null,
      action: 'job_posting_expired',
      targetTable: 'listings',
      targetId: listingId,
      beforeState: { status: 'published' },
      afterState: { status: 'unpublished', reason: 'posting_window_elapsed' },
    })
  }

  return { lapsed: lapsedIds.length, unpublished: unpublishedIds.length, renewed }
}
