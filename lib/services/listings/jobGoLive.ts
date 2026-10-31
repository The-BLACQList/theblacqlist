import type { SupabaseClient } from '@supabase/supabase-js'

import { jobPostingExpiryFrom } from '@/lib/stripe/jobPostings'

// Ticket 155: when a job goes live, start its clocks from that moment.
//
//   1. A job with no closing date gets one: go-live plus JOB_POSTING_DURATION_DAYS.
//      A date the poster chose is kept as is.
//   2. On the first publish, the newest paid ledger row's expires_at is moved to
//      go-live plus the same 30 days, so the paid window does not lose the days
//      the role spent waiting in moderation. Only when paidPostings is on: with
//      the flag off the ledger is not read anywhere.
//
// Called by the admin approval after the publish has succeeded. Both writes are
// fail-soft: a failure is logged and the approval still stands. A job with no
// closes_at is never closed by the closing-date sweep, so the worst case is a
// role that stays open until the poster or the ledger sweep closes it.

type AnyClient = SupabaseClient | { from: SupabaseClient['from'] }

export interface JobGoLiveResult {
  /** The default closing date written, or null if the poster's date was kept or the write failed. */
  closesAtSet: string | null
  /** True when a ledger row's expires_at was re-stamped. */
  ledgerRestamped: boolean
}

export async function applyJobGoLiveDefaults(
  supabase: AnyClient,
  opts: {
    listingId: string
    publishedAt: Date
    /** True on the first ever publish (published_at was null before this approval). */
    firstPublish: boolean
    paidPostingsOn: boolean
  }
): Promise<JobGoLiveResult> {
  const { listingId, publishedAt, firstPublish, paidPostingsOn } = opts
  const windowEnd = jobPostingExpiryFrom(publishedAt)
  const result: JobGoLiveResult = { closesAtSet: null, ledgerRestamped: false }

  try {
    // `.is('closes_at', null)` keeps a poster-chosen date: the write only lands
    // on a row that has none, so there is no read-then-write race either.
    const { data, error } = await supabase
      .from('listing_details_job')
      .update({ closes_at: windowEnd })
      .eq('listing_id', listingId)
      .is('closes_at', null)
      .select('listing_id')
    if (error) {
      console.error('[jobGoLive] default closes_at failed', { listingId, error: error.message })
    } else if ((data ?? []).length > 0) {
      result.closesAtSet = windowEnd
    }
  } catch (err) {
    console.error('[jobGoLive] default closes_at threw', { listingId, err })
  }

  if (!paidPostingsOn || !firstPublish) return result

  try {
    const { data: rows, error: readError } = await supabase
      .from('job_posting_purchases')
      .select('id, created_at')
      .eq('listing_id', listingId)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
    if (readError) {
      console.error('[jobGoLive] ledger read failed', { listingId, error: readError.message })
      return result
    }
    const latest = (rows ?? [])[0] as { id: string } | undefined
    if (!latest) return result

    const { error: writeError } = await supabase
      .from('job_posting_purchases')
      .update({ expires_at: windowEnd })
      .eq('id', latest.id)
    if (writeError) {
      console.error('[jobGoLive] ledger re-stamp failed', { listingId, error: writeError.message })
      return result
    }
    result.ledgerRestamped = true
  } catch (err) {
    console.error('[jobGoLive] ledger re-stamp threw', { listingId, err })
  }

  return result
}
