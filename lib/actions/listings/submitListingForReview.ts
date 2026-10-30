'use server'

import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { transitionToPendingReview } from '@/lib/listings/submitForReview'
import { submitJobForReview } from '@/lib/services/listings/submitJobForReview'
import { eventCapMessage, eventQuotaFor, EVENTS_NEED_GROWTH_MESSAGE } from '@/lib/stripe/jobPostings'

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

  // Jobs run the shared ladder (grandfather, already paid, allowance, checkout)
  // and the service-role transition. Same code the four step flow uses (ticket 152).
  if (listing.entity_type === 'job') {
    const result = await submitJobForReview(supabase, user, listing)
    if ('error' in result) return { error: result.error }
    if ('requiresPayment' in result) return result
    return { success: true }
  }

  // ── E-2 monetization gates (events) ───────────────────────────────────────
  // Live here rather than at creation time on purpose: a draft is free to write
  // and free to abandon. What consumes an allowance is asking to be seen publicly.
  if (isFeatureEnabled('paidPostings')) {
    if (listing.entity_type === 'event') {
      const quotaRead = await eventQuotaFor(supabase, user.id)
      if (!quotaRead.ok) {
        return { error: 'Could not check your event allowance right now. Please try again.' }
      }
      const quota = quotaRead.value
      if (quota.atLimit) {
        return {
          error:
            quota.limit === 0 || quota.limit === null
              ? EVENTS_NEED_GROWTH_MESSAGE
              : eventCapMessage(quota.limit),
        }
      }
    }
  }

  return await transitionToPendingReview(supabase, listingId, user.id)
}
