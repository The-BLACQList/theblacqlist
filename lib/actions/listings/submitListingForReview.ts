'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { transitionToPendingReview } from '@/lib/listings/submitForReview'
import { createJobPostingCheckoutSession } from '@/lib/stripe/jobPostingCheckout'
import {
  eventQuotaFor,
  grantIncludedJobPosting,
  hasPaidJobPosting,
  jobQuotaFor,
  JOB_LIMIT_ENFORCED_FROM,
} from '@/lib/stripe/jobPostings'

export type SubmitForReviewState =
  | { error: string }
  | { success: true }
  /** The listing is a job that has not been paid for. The client redirects here. */
  | { requiresPayment: true; checkoutUrl: string }
  | null

export async function submitListingForReviewAction(
  _prev: SubmitForReviewState,
  formData: FormData
): Promise<SubmitForReviewState> {
  const listingId = formData.get('listing_id')?.toString().trim()

  if (!listingId || !/^[0-9a-f-]{36}$/.test(listingId)) {
    return { error: 'Invalid listing ID.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be signed in.' }
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, status, entity_type, owner_user_id, created_at')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) {
    return { error: 'Listing not found.' }
  }

  if (listing.owner_user_id !== user.id) {
    return { error: 'You do not have permission to submit this listing.' }
  }

  if (listing.status !== 'draft') {
    return { error: 'Only draft listings can be submitted for review.' }
  }

  // ── E-2 monetization gates ────────────────────────────────────────────────
  // Both live here rather than at creation time on purpose: a draft is free to
  // write and free to abandon. What costs money, and what consumes an
  // allowance, is asking to be seen publicly. It is also the only place both
  // rules can be enforced once — every route to publication passes through this
  // status transition.
  if (isFeatureEnabled('paidPostings')) {
    // The job ladder, in this order for reasons that are not interchangeable:
    //   1. grandfather  — so a pre-cutoff draft never burns an allowance
    //   2. already paid — so re-submitting a covered job never spends a second slot
    //   3. allowance    — spend an included posting if one is open
    //   4. checkout     — otherwise, sell one
    if (listing.entity_type === 'job') {
      const grandfathered =
        !!listing.created_at && new Date(listing.created_at) < new Date(JOB_LIMIT_ENFORCED_FROM)

      if (!grandfathered && !(await hasPaidJobPosting(supabase, listingId))) {
        const quota = await jobQuotaFor(supabase, user.id)

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

    if (listing.entity_type === 'event') {
      const quota = await eventQuotaFor(supabase, user.id)
      if (quota.atLimit) {
        return {
          error:
            quota.limit === 0
              ? 'Publishing events is part of a paid plan. Upgrade to post this event.'
              : `Your plan includes ${quota.limit} active event${quota.limit === 1 ? '' : 's'}. Upgrade or unpublish one to post this event.`,
        }
      }
    }
  }

  return await transitionToPendingReview(supabase, listingId, user.id)
}
