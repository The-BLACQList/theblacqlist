import { NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import type { BillingCycle } from '@/lib/stripe/plans'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { checkoutTermsConsentOn, renewalLine } from '@/lib/stripe/renewal'
import { z } from 'zod'

const checkoutBodySchema = z
  .object({
    planSlug: z.enum(['starter', 'growth', 'premium']),
    // Ticket 238: the plan is the owner's. The page is only the first one it
    // covers (the owner picks the rest under Pages On Your Plan).
    listingId: z.uuid().optional(),
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

  // The page the plan covers first: the one the owner clicked from, or their
  // oldest page. Job and event pages are paid for on their own, so a plan never
  // covers them.
  let anchorQuery = supabase
    .from('listings')
    .select('id, name')
    .eq('owner_user_id', user.id)
    .is('deleted_at', null)
    .not('entity_type', 'in', '(job,event)')
  if (listingId) anchorQuery = anchorQuery.eq('id', listingId)
  const { data: listing } = await anchorQuery
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!listing) {
    return listingId
      ? NextResponse.json({ error: 'Listing not found', code: 'NOT_FOUND' }, { status: 404 })
      : NextResponse.json(
          { error: 'Add a page before choosing a plan.', code: 'NO_PAGE' },
          { status: 409 }
        )
  }

  // One live plan per owner (ticket 238). A second subscription would bill
  // twice for one plan; plan changes go through the customer portal, which
  // swaps the price on the existing subscription. RLS scopes this read to the
  // caller's own rows; the webhook flags anything that slips past.
  const { data: liveSubs, error: liveError } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
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
        error: 'You already have a plan. Use Manage Subscription to change it.',
        code: 'SUBSCRIPTION_EXISTS',
      },
      { status: 409 }
    )
  }

  // Reuse the caller's Stripe customer when they already have one (a plan that
  // ended, a job posting), so the owner keeps one portal and one card on file.
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
    listing_id: listing.id,
    plan_id: plan.id,
    plan_slug: planSlug,
    billing_cycle: billingCycle,
  }

  // Ticket 144: repeat the renewal line next to Stripe's pay button, and ask
  // for Terms consent when that is switched on for this Stripe account.
  const renewal = renewalLine(planSlug, billingCycle)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      // Do NOT set payment_method_types — let Stripe choose eligible methods dynamically.
      line_items: [{ price: priceId, quantity: 1 }],
      ...(customerId ? { customer: customerId } : { customer_email: user.email }),
      // renews=1 tells the success page to confirm the renewal terms. The
      // tester free month shares that page and does not renew, so it omits it.
      success_url: `${baseUrl}/dashboard/upgrade/success?session_id={CHECKOUT_SESSION_ID}&renews=1`,
      cancel_url: `${baseUrl}/dashboard/upgrade`,
      metadata,
      subscription_data: { metadata },
      ...(renewal ? { custom_text: { submit: { message: renewal } } } : {}),
      ...(checkoutTermsConsentOn()
        ? { consent_collection: { terms_of_service: 'required' as const } }
        : {}),
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
