'use server'

import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { transitionToPendingReview } from '@/lib/listings/submitForReview'
import { createJobPostingCheckoutSession } from '@/lib/stripe/jobPostingCheckout'
import { eventQuotaFor, hasPaidJobPosting } from '@/lib/stripe/jobPostings'

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
    .select('id, name, status, entity_type, owner_user_id')
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
    if (listing.entity_type === 'job') {
      const paid = await hasPaidJobPosting(supabase, listingId)
      if (!paid) {
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
