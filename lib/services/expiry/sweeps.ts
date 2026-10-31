import type { SupabaseClient } from '@supabase/supabase-js'

import { writeSystemAuditLog } from '@/lib/audit/system'
import { SUGGESTION_EXPIRY_DAYS } from '@/lib/ai/review'
import { isEventOver } from '@/lib/events/eventOver'

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
 * The job sweep closes a live listing (ticket 155: `closed`, not `unpublished`,
 * so the page stays up). Getting its predicate wrong takes a business's job
 * posting off the board. So it is written the cautious way round:
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
  /** Of those, the ones actually moved `published` → `closed`. */
  closed: number
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

interface CloseDateRow {
  listing_id: string
  closes_at: string | null
}

/**
 * Closes job listings whose paid posting window has closed (ticket 155).
 *
 * Until ticket 155 this set `unpublished`, which 404'd the page and broke every
 * link someone had saved or shared. It now sets `closed`: the role leaves the
 * board, search and counts (all of which read `published` only), and the page
 * stays up with the "Applications closed" banner.
 *
 * Reads the purchase ledger first and the listings second. The ledger is the
 * only place that knows a listing was ever paid for, and "was never paid for"
 * and "was paid for and lapsed" must not be confused — see the header.
 *
 * A lapsed listing closes even when its own `closes_at` is later. A paid role
 * stays up for whichever is shorter: the paid window, or its own closing date
 * (founder decision 2026-10-31, option b). The closing-date sweep
 * ({@link closeExpiredJobs}) handles the other half.
 *
 * The UPDATE re-states `entity_type`, `status` and `deleted_at` even though the
 * candidate set was built from the ledger. That is a belt on top of braces: if
 * the grouping above were ever wrong about a listing, the predicate still makes
 * it impossible to close something that is not a currently-published job.
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
    return { lapsed: 0, closed: 0, renewed }
  }

  const { data: updated, error: updateError } = await supabase
    .from('listings')
    .update({ status: 'closed' })
    .in('id', lapsedIds)
    .eq('entity_type', 'job')
    .eq('status', 'published')
    .is('deleted_at', null)
    .select('id')

  if (updateError) {
    throw new Error(`job posting close failed: ${updateError.message}`)
  }

  const closedIds = ((updated ?? []) as { id: string }[]).map((row) => row.id)

  // A role with no closing date gets today's, so the page can say "Applications
  // closed on {date}" and hide the apply button. Without it the closed page
  // would look open. Only null dates are written; a past date is kept as is.
  // Fail-soft: the status change above already happened and is what matters
  // for the board; a failed stamp is logged and retried by nothing, so it is
  // loud on purpose.
  if (closedIds.length > 0) {
    const { error: stampError } = await supabase
      .from('listing_details_job')
      .update({ closes_at: now.toISOString() })
      .in('listing_id', closedIds)
      .is('closes_at', null)
    if (stampError) {
      console.error('[expiry] closed job closes_at stamp failed:', stampError.message)
    }
  }

  // One audit row per listing, not one for the batch. An owner asking "why did
  // my job close" is asking about one listing, and the answer has to be
  // findable by that listing's id.
  for (const listingId of closedIds) {
    await writeSystemAuditLog({
      actorUserId: null,
      action: 'job_posting_expired',
      targetTable: 'listings',
      targetId: listingId,
      beforeState: { status: 'published' },
      afterState: { status: 'closed', reason: 'posting_window_elapsed' },
    })
  }

  return { lapsed: lapsedIds.length, closed: closedIds.length, renewed }
}

export interface JobCloseSweepResult {
  /** Published jobs whose `closes_at` has passed, before the batch limit. */
  due: number
  /** Of those, the ones actually moved `published` → `closed` this run. */
  closed: number
  /** Listings whose update errored. The next run retries them. */
  failed: number
}

/**
 * Most roles {@link closeExpiredJobs} will close in one run. A normal night
 * closes a handful; this only matters for a backlog (say, the first run after
 * the migration). Anything over the limit is closed on the next run, oldest
 * first, and the page already looks closed in the meantime.
 */
export const JOB_CLOSE_BATCH_LIMIT = 500

/** Ids per `.in()` read, so the request URL stays well under PostgREST limits. */
const ID_CHUNK = 200

/**
 * Closes published jobs whose closing date has passed (ticket 155).
 *
 * Same shape as {@link unpublishPastEvents}: read the live jobs, read their
 * closing dates, then write. A job with no `closes_at` is never touched,
 * because no date is not a past date.
 *
 * Each listing is updated and audited on its own, so one failing row does not
 * stop the rest; failures are counted and the next run picks them up. Read
 * errors throw, so the cron run shows red rather than reporting "0 closed".
 *
 * Idempotent: the UPDATE requires `status = 'published'`, so a second run finds
 * nothing to change, writes no audit rows and logs 0.
 *
 * Not gated on paidPostings. Closing on the poster's date is not a payment
 * concern.
 */
export async function closeExpiredJobs(
  supabase: AnyClient,
  now: Date = new Date()
): Promise<JobCloseSweepResult> {
  const { data: live, error } = await supabase
    .from('listings')
    .select('id')
    .eq('entity_type', 'job')
    .eq('status', 'published')
    .is('deleted_at', null)

  if (error) {
    throw new Error(`published job read failed: ${error.message}`)
  }

  const liveIds = ((live ?? []) as { id: string }[]).map((row) => row.id)
  if (liveIds.length === 0) {
    console.info('[expiry] closeExpiredJobs closed 0 of 0')
    return { due: 0, closed: 0, failed: 0 }
  }

  const nowIso = now.toISOString()
  const nowMs = now.getTime()
  const past: CloseDateRow[] = []

  for (let i = 0; i < liveIds.length; i += ID_CHUNK) {
    const { data: dates, error: datesError } = await supabase
      .from('listing_details_job')
      .select('listing_id, closes_at')
      .in('listing_id', liveIds.slice(i, i + ID_CHUNK))
      .lt('closes_at', nowIso)

    if (datesError) {
      throw new Error(`job closing date read failed: ${datesError.message}`)
    }

    for (const row of (dates ?? []) as CloseDateRow[]) {
      // Re-checked here so a null or unparseable date can never read as past.
      if (!row.listing_id || !row.closes_at) continue
      const t = new Date(row.closes_at).getTime()
      if (!isNaN(t) && t < nowMs) past.push(row)
    }
  }

  // Oldest first, so a backlog over the limit drains in order.
  past.sort((a, b) => new Date(a.closes_at!).getTime() - new Date(b.closes_at!).getTime())
  const batch = past.slice(0, JOB_CLOSE_BATCH_LIMIT)

  let closed = 0
  let failed = 0

  for (const row of batch) {
    const { data: updated, error: updateError } = await supabase
      .from('listings')
      .update({ status: 'closed' })
      .eq('id', row.listing_id)
      .eq('entity_type', 'job')
      .eq('status', 'published')
      .is('deleted_at', null)
      .select('id')

    if (updateError) {
      failed += 1
      console.error('[expiry] job close failed:', row.listing_id, updateError.message)
      continue
    }
    // Someone else moved it first (owner unpublished, admin flagged). Nothing to log.
    if (!updated || updated.length === 0) continue

    closed += 1
    await writeSystemAuditLog({
      actorUserId: null,
      action: 'job_closed',
      targetTable: 'listings',
      targetId: row.listing_id,
      beforeState: { status: 'published' },
      afterState: { status: 'closed', reason: 'closes_at passed', closes_at: row.closes_at },
    })
  }

  console.info(
    `[expiry] closeExpiredJobs closed ${closed} of ${past.length}` +
      (failed > 0 ? ` (${failed} failed)` : '') +
      (past.length > batch.length ? ` (${past.length - batch.length} left for the next run)` : '')
  )

  return { due: past.length, closed, failed }
}

export interface EventSweepResult {
  /** Published events whose time has passed. */
  past: number
  /** Of those, the ones actually moved `published` → `unpublished`. */
  unpublished: number
}

export { EVENT_NO_END_GRACE_HOURS } from '@/lib/events/eventOver'

interface EventTimeRow {
  listing_id: string
  starts_at: string | null
  ends_at: string | null
}

/**
 * Unpublishes events that are over, so they leave /events, search and the
 * map (ticket 106). The host page block already skips them by date; the
 * public lists filter only on status, so this is what keeps them honest.
 *
 * Over is {@link isEventOver}, shared with the owner's Events tab. A published
 * event with no details row at all is left alone, because an unknown date is
 * not a past one.
 *
 * Reads the live events first, so the work is bounded by what is published
 * now rather than by every event ever held. Unpublishing also frees the slot
 * in the owner's event allowance, which counts pending and published events.
 * The UPDATE re-states type, status and deleted_at, like the job sweep.
 */
export async function unpublishPastEvents(
  supabase: AnyClient,
  now: Date = new Date()
): Promise<EventSweepResult> {
  const { data: live, error } = await supabase
    .from('listings')
    .select('id')
    .eq('entity_type', 'event')
    .eq('status', 'published')
    .is('deleted_at', null)

  if (error) {
    throw new Error(`published event read failed: ${error.message}`)
  }

  const liveIds = ((live ?? []) as { id: string }[]).map((row) => row.id)
  if (liveIds.length === 0) return { past: 0, unpublished: 0 }

  const { data: times, error: timesError } = await supabase
    .from('listing_details_event')
    .select('listing_id, starts_at, ends_at')
    .in('listing_id', liveIds)

  if (timesError) {
    throw new Error(`event time read failed: ${timesError.message}`)
  }

  const pastIds = ((times ?? []) as EventTimeRow[])
    .filter((row) => row.listing_id && isEventOver(row.starts_at, row.ends_at, now))
    .map((row) => row.listing_id)

  if (pastIds.length === 0) return { past: 0, unpublished: 0 }

  const { data: updated, error: updateError } = await supabase
    .from('listings')
    .update({ status: 'unpublished' })
    .in('id', pastIds)
    .eq('entity_type', 'event')
    .eq('status', 'published')
    .is('deleted_at', null)
    .select('id')

  if (updateError) {
    throw new Error(`past event unpublish failed: ${updateError.message}`)
  }

  const unpublishedIds = ((updated ?? []) as { id: string }[]).map((row) => row.id)

  for (const listingId of unpublishedIds) {
    await writeSystemAuditLog({
      actorUserId: null,
      action: 'event_ended',
      targetTable: 'listings',
      targetId: listingId,
      beforeState: { status: 'published' },
      afterState: { status: 'unpublished', reason: 'event_ended' },
    })
  }

  return { past: pastIds.length, unpublished: unpublishedIds.length }
}
