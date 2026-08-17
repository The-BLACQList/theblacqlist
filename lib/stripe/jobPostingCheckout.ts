import 'server-only'

import { stripe } from '@/lib/stripe/client'
import { jobPostingPriceId } from '@/lib/stripe/jobPostings'
import { getAppUrl } from '@/lib/env'

/**
 * Create the Stripe Checkout session that buys one job posting.
 *
 * `mode: 'payment'` — the product's first one-time charge. Every other Stripe
 * path here is `mode: 'subscription'`.
 *
 * WHY THIS IS A MODULE AND NOT AN API ROUTE, unlike
 * `app/api/stripe/create-checkout-session/route.ts`: that route exists because a
 * subscription purchase is a standalone user action with no other server work
 * around it. This one is a step *inside* `submitListingForReviewAction`, which
 * has already loaded the listing, verified ownership, and confirmed the draft
 * state. A route would have to redo all three, and a second copy of an
 * ownership check is a second place for it to be wrong.
 */
export async function createJobPostingCheckoutSession(params: {
  listingId: string
  listingName: string
  userId: string
  userEmail: string | null
}): Promise<{ url: string } | { error: string }> {
  const priceId = jobPostingPriceId()

  // Fails closed. Until the Stripe product exists (GATE-SPEND, at G1) there is
  // no price to charge, and the correct behavior is to refuse the sale rather
  // than invent one or let the posting through free.
  if (!priceId) {
    console.error('[jobPostingCheckout] STRIPE_JOB_POSTING_PRICE_ID is not set')
    return { error: 'Paid job postings are not available yet. Please try again later.' }
  }

  const baseUrl = getAppUrl()

  // Carried on both the session and the payment intent so the fulfilment handler
  // can identify the listing from either object. `purpose` is what lets the
  // webhook tell this apart from any future one-time product — without it, the
  // handler would have to infer intent from the price id.
  const metadata = {
    purpose: 'job_posting',
    listing_id: params.listingId,
    user_id: params.userId,
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Do NOT set payment_method_types — let Stripe choose eligible methods
      // dynamically, matching the subscription route.
      line_items: [{ price: priceId, quantity: 1 }],
      ...(params.userEmail ? { customer_email: params.userEmail } : {}),
      success_url: `${baseUrl}/dashboard/pages/${params.listingId}?posted=1`,
      cancel_url: `${baseUrl}/dashboard/pages/${params.listingId}?canceled=1`,
      metadata,
      payment_intent_data: { metadata },
    })

    if (!session.url) {
      return { error: 'Could not start checkout. Please try again.' }
    }

    return { url: session.url }
  } catch (err) {
    console.error('[jobPostingCheckout] Stripe session creation failed:', err)
    return { error: 'Could not start checkout. Please try again.' }
  }
}
