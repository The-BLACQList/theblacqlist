import type { SupabaseClient } from '@supabase/supabase-js'

import { createServiceClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { transitionToPendingReview } from '@/lib/listings/submitForReview'
import { buildJobPriceLine, PRICE_CHECK, type JobPriceLine } from '@/lib/listings/jobPriceLine'
import { createJobPostingCheckoutSession } from '@/lib/stripe/jobPostingCheckout'
import {
  grantIncludedJobPosting,
  hasPaidJobPosting,
  jobQuotaFor,
  JOB_LIMIT_ENFORCED_FROM,
  JOB_POSTING_PRICE_DISPLAY,
} from '@/lib/stripe/jobPostings'

// Extracted unchanged from submitListingForReviewAction (ticket 152) so the
// dashboard button and the four step flow run the very same ladder. Callers have
// already checked: signed in, owns the listing, listing is a draft job.

export type JobSubmitResult =
  | { error: string }
  /** The job is now pending. `included` means no charge (allowance, grandfathered, already paid). */
  | { success: true; outcome: 'included' }
  /** Not paid for yet. The caller sends the user to Stripe. */
  | { requiresPayment: true; checkoutUrl: string }
  /** It costs money and the poster was never shown that. Nothing was charged or opened. */
  | { confirmPrice: true; notice: string; priceLine: JobPriceLine }

/** Shown when Jobs is switched off. The draft itself is untouched. */
export const JOBS_CLOSED_MESSAGE = 'Job submissions are not open yet. Your draft is saved.'

export async function submitJobForReview(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
  listing: { id: string; name: string; created_at: string | null },
  /** Ticket 273: true only when the page showed the price before the button was pressed. */
  opts: { chargeShown: boolean }
): Promise<JobSubmitResult> {
  const listingId = listing.id

  // Ticket 282: FEATURE_JOBS_OPEN covers /add-job, but the dashboard's Submit
  // button lands here too. Off, nothing new is granted, charged or moved. A
  // posting already bought or granted still goes through: that promise was made
  // while Jobs was open. Being grandfathered is not a purchase, so it does not
  // count, and a failed read is not a yes. The Stripe webhook does not come
  // through here, so a payment already under way still lands.
  if (!isFeatureEnabled('jobsOpen')) {
    const covered = await hasPaidJobPosting(supabase, listingId)
    if (!covered.ok) {
      return { error: 'Could not check this job posting right now. Please try again.' }
    }
    if (!covered.value) return { error: JOBS_CLOSED_MESSAGE }
  }

  // The job ladder, in this order for reasons that are not interchangeable:
  //   1. grandfather  — so a pre-cutoff draft never burns an allowance
  //   2. already paid — so re-submitting a covered job never spends a second slot
  //   3. allowance    — spend an included posting if one is open
  //   4. checkout     — otherwise, sell one
  if (isFeatureEnabled('paidPostings')) {
    const grandfathered =
      !!listing.created_at && new Date(listing.created_at) < new Date(JOB_LIMIT_ENFORCED_FROM)

    // ⚠ Both reads below can fail, and neither failure may be read as an
    // answer. A broken `hasPaidJobPosting` would resell a posting already paid
    // for; a broken `jobQuotaFor` would give away one that isn't owed. Stop
    // instead — but only inside the grandfather guard, so a pre-cutoff draft
    // still never touches the ledger at all.
    const paidRead = grandfathered
      ? ({ ok: true, value: true } as const)
      : await hasPaidJobPosting(supabase, listingId)
    if (!paidRead.ok) {
      return { error: 'Could not check this job posting right now. Please try again.' }
    }

    if (!paidRead.value) {
      const quotaRead = await jobQuotaFor(supabase, user.id)
      if (!quotaRead.ok) {
        return { error: 'Could not check your job posting allowance right now. Please try again.' }
      }
      const quota = quotaRead.value

      if (!quota.atLimit) {
        // Written on the service role: the ledger has no INSERT policy by
        // design. Ownership, draft status, the cutoff, and the allowance have
        // all been checked above — this is the only thing left to do.
        // try/catch, not `.catch()`: createServiceClient() throws synchronously
        // when the service-role key is missing, which is outside a promise chain.
        let ok = false
        try {
          ok = (await grantIncludedJobPosting(createServiceClient(), {
            listingId,
            userId: user.id,
          })).ok
        } catch {
          ok = false
        }
        if (!ok) {
          // Deliberately not falling through to checkout: charging someone who
          // was entitled to a free posting is the worse failure.
          return { error: 'Could not apply your included job posting. Please try again.' }
        }
      } else {
        // Ticket 273: nobody lands on a payment page they weren't told about. The
        // page's own read can fail or go stale (the last included posting used in
        // another tab), and its button then reads Submit for Review.
        if (!opts.chargeShown) {
          return {
            confirmPrice: true,
            notice: PRICE_CHECK,
            priceLine: buildJobPriceLine(quotaRead, JOB_POSTING_PRICE_DISPLAY, true),
          }
        }
        const checkout = await createJobPostingCheckoutSession({
          listingId,
          listingName: listing.name,
          userId: user.id,
          userEmail: user.email ?? null,
        })
        if ('error' in checkout) return { error: checkout.error }
        // Nothing has been written yet. The draft→pending transition happens in
        // the webhook, after Stripe confirms the payment — never here on the
        // optimistic assumption that the user will complete checkout.
        return { requiresPayment: true, checkoutUrl: checkout.url }
      }
    }
  }

  // Jobs move draft→pending on the service role. The listings owner guard
  // (supabase/migrations/20260926000000_listings_entitlement_guard.sql) refuses
  // any job status change from a user session, so a job cannot be pushed into
  // review with a hand-built PATCH that skips the payment ladder above. That
  // makes this the only user-reachable path, and it has already checked
  // ownership, draft status and the posting entitlement. The transition itself
  // still filters on owner_user_id. Applies whether or not paidPostings is on:
  // the guard does not know about the flag.
  // try/catch: createServiceClient() throws synchronously when the key is unset.
  let client: SupabaseClient
  try {
    client = createServiceClient()
  } catch {
    return { error: 'Could not submit this job right now. Please try again.' }
  }

  const moved = await transitionToPendingReview(client, listingId, user.id)
  return 'error' in moved ? moved : { success: true, outcome: 'included' }
}
