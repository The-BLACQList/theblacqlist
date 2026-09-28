import { NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import type { BillingCycle } from '@/lib/stripe/plans'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { z } from 'zod'

const checkoutBodySchema = z
  .object({
    planSlug: z.enum(['starter', 'growth', 'premium']),
    listingId: z.uuid(),
    billingCycle: z.enum(['monthly', 'annual']).optional(),
  })
  .strict()

// Statuses that still hold paid access (mirrors KEEPS_ACCESS in
// lib/services/billing/webhookHandlers.ts).
const LIVE_STATUSES = ['active', 'trialing', 'past_due']

// A real owner clicks Upgrade a handful of times at most.
const CHECKOUT_RATE_LIMIT = 10

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  // .strict() rejects any key we did not ask for. The price is never taken from
  // the browser (it is looked up in `plans` below), so a body carrying `price`,
  // `amount` or `priceId` is a tampered request and gets a 400, not a shrug.
  const parsed = checkoutBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid checkout request', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }
  const { planSlug, listingId } = parsed.data
  const billingCycle: BillingCycle = parsed.data.billingCycle ?? 'monthly'

  const allowed = await checkRateLimit({
    bucket: 'checkout',
    identifier: user.id,
    limit: CHECKOUT_RATE_LIMIT,
  })
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many checkout attempts. Please wait a minute and try again.', code: 'RATE_LIMITED' },
      { status: 429 }
    )
  }

  // Verify the user owns this listing
  const { data: listing } = await supabase
    .from('listings')
    .select('id, name')
    .eq('id', listingId)
    .eq('owner_user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  // One live subscription per listing. A second one would leave two Stripe
  // subscriptions fighting over `listings.tier`, and whichever ended first
  // would downgrade the listing while the other was still paid. Plan changes go
  // through the customer portal, which swaps the price on the existing
  // subscription instead of adding one. RLS scopes this read to the caller's
  // own rows; the webhook's live-sibling check covers anything else.
  const { data: liveSubs, error: liveError } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('listing_id', listingId)
    .in('status', LIVE_STATUSES)
    .limit(1)

  if (liveError) {
    console.error('[create-checkout-session] subscription lookup failed:', liveError.message)
    return NextResponse.json(
      { error: 'Could not check your current plan. Please try again.', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
  if (liveSubs && liveSubs.length > 0) {
    return NextResponse.json(
      {
        error: 'This listing already has a plan. Use Manage subscription to change it.',
        code: 'SUBSCRIPTION_EXISTS',
      },
      { status: 409 }
    )
  }

  // Reuse the caller's Stripe customer when they already have one, so a second
  // listing's plan lands on the same customer (one portal, one card on file)
  // instead of minting a new customer per checkout.
  const { data: priorSub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const customerId = priorSub?.stripe_customer_id ?? null

  // Get the Stripe price IDs for this plan from the DB
  const { data: plan } = await supabase
    .from('plans')
    .select('id, name, stripe_price_id_monthly, stripe_price_id_yearly')
    .eq('plan_key', planSlug)
    .eq('is_active', true)
    .maybeSingle()

  const priceId =
    billingCycle === 'annual' ? plan?.stripe_price_id_yearly : plan?.stripe_price_id_monthly

  if (!plan || !priceId) {
    return NextResponse.json(
      { error: 'Plan not available for purchase', code: 'UNPROCESSABLE' },
      { status: 422 }
    )
  }

  // getAppUrl() falls through explicit ?? VERCEL_URL ?? localhost, so a Preview
  // deployment resolves its own origin instead of sending Stripe's redirect to
  // the tester's machine.
  const baseUrl = getAppUrl()

  // Shared metadata: read by the webhook to sync the subscription + tier, and
  // by the audit log. billing_cycle lets us record monthly vs. annual.
  const metadata = {
    user_id: user.id,
    listing_id: listingId,
    plan_id: plan.id,
    plan_slug: planSlug,
    billing_cycle: billingCycle,
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      // Do NOT set payment_method_types — let Stripe choose eligible methods dynamically.
      line_items: [{ price: priceId, quantity: 1 }],
      ...(customerId ? { customer: customerId } : { customer_email: user.email }),
      success_url: `${baseUrl}/dashboard/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/upgrade`,
      metadata,
      subscription_data: { metadata },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[create-checkout-session] Stripe error:', err)
    return NextResponse.json(
      { error: 'Failed to create checkout session', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
