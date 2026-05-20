import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'

// Next.js must NOT parse the body — Stripe signature verification requires the raw bytes.
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const rawBody = await request.text()
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionUpsert(supabase, sub)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(supabase, sub)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(supabase, invoice)
        break
      }
      default:
        // Acknowledge unhandled events without error
        break
    }
  } catch (err) {
    console.error(`[stripe/webhook] Error handling ${event.type}:`, err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleSubscriptionUpsert(
  supabase: ReturnType<typeof createServiceClient>,
  sub: Stripe.Subscription
) {
  const meta = sub.metadata as Record<string, string>
  const userId = meta.user_id
  const listingId = meta.listing_id
  const planId = meta.plan_id ?? null
  const planSlug = meta.plan_slug ?? 'free'

  if (!userId || !listingId) {
    console.warn('[stripe/webhook] subscription missing user_id or listing_id in metadata', sub.id)
    return
  }

  // In Stripe API v2026+, period dates live on the first subscription item, not on the subscription itself.
  const firstItem = sub.items.data[0]
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000).toISOString()
    : null
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : null

  const customerId =
    typeof sub.customer === 'string'
      ? sub.customer
      : ((sub.customer as Stripe.Customer)?.id ?? null)

  // Upsert subscription row
  await supabase.from('subscriptions').upsert(
    {
      listing_id: listingId,
      user_id: userId,
      plan_id: planId,
      status: normalizeStatus(sub.status),
      current_period_start: periodStart,
      current_period_end: periodEnd,
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
    },
    { onConflict: 'stripe_subscription_id' }
  )

  // Keep listings.tier in sync — only update to paid tier when subscription is active/trialing
  const isActive = sub.status === 'active' || sub.status === 'trialing'
  await supabase
    .from('listings')
    .update({ tier: isActive ? planSlug : 'free' })
    .eq('id', listingId)
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createServiceClient>,
  sub: Stripe.Subscription
) {
  const meta = sub.metadata as Record<string, string>
  const listingId = meta.listing_id

  await supabase
    .from('subscriptions')
    .update({ status: 'canceled' })
    .eq('stripe_subscription_id', sub.id)

  if (listingId) {
    await supabase.from('listings').update({ tier: 'free' }).eq('id', listingId)
  }
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createServiceClient>,
  invoice: Stripe.Invoice
) {
  // In Stripe API v2026+, subscription is accessed via invoice.parent.subscription_details.subscription
  const parent = invoice.parent as {
    subscription_details?: { subscription?: string | { id: string } }
  } | null
  const subRef = parent?.subscription_details?.subscription
  const subId = typeof subRef === 'string' ? subRef : (subRef?.id ?? null)

  if (!subId) return

  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subId)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeStatus(stripeStatus: Stripe.Subscription.Status): string {
  const map: Record<Stripe.Subscription.Status, string> = {
    active: 'active',
    canceled: 'canceled',
    incomplete: 'inactive',
    incomplete_expired: 'canceled',
    past_due: 'past_due',
    paused: 'inactive',
    trialing: 'trialing',
    unpaid: 'past_due',
  }
  return map[stripeStatus] ?? 'inactive'
}
