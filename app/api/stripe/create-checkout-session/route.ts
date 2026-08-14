import { NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import type { BillingCycle, PlanSlug } from '@/lib/stripe/plans'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: { planSlug: string; listingId: string; billingCycle?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const { planSlug, listingId } = body
  if (!planSlug || !listingId) {
    return NextResponse.json(
      { error: 'planSlug and listingId are required', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const VALID_PAID_SLUGS: PlanSlug[] = ['starter', 'growth', 'premium']
  if (!VALID_PAID_SLUGS.includes(planSlug as PlanSlug)) {
    return NextResponse.json({ error: 'Invalid plan', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  // Default to monthly when unspecified. Any other value is a client error.
  const billingCycle: BillingCycle = body.billingCycle === 'annual' ? 'annual' : 'monthly'
  if (body.billingCycle && body.billingCycle !== 'monthly' && body.billingCycle !== 'annual') {
    return NextResponse.json(
      { error: 'Invalid billing cycle', code: 'VALIDATION_ERROR' },
      { status: 400 }
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
      customer_email: user.email,
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
