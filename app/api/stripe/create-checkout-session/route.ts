import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import type { PlanSlug } from '@/lib/stripe/plans'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: { planSlug: string; listingId: string }
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

  const VALID_PAID_SLUGS: PlanSlug[] = ['standard', 'premium']
  if (!VALID_PAID_SLUGS.includes(planSlug as PlanSlug)) {
    return NextResponse.json({ error: 'Invalid plan', code: 'VALIDATION_ERROR' }, { status: 400 })
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

  // Get the Stripe price ID for this plan from the DB
  const { data: plan } = await supabase
    .from('plans')
    .select('id, name, stripe_price_id_monthly')
    .eq('plan_key', planSlug)
    .eq('is_active', true)
    .maybeSingle()

  if (!plan || !plan.stripe_price_id_monthly) {
    return NextResponse.json(
      { error: 'Plan not available for purchase', code: 'UNPROCESSABLE' },
      { status: 422 }
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: plan.stripe_price_id_monthly, quantity: 1 }],
      customer_email: user.email,
      success_url: `${baseUrl}/dashboard/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/upgrade`,
      metadata: {
        user_id: user.id,
        listing_id: listingId,
        plan_id: plan.id,
        plan_slug: planSlug,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          listing_id: listingId,
          plan_id: plan.id,
          plan_slug: planSlug,
        },
      },
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
