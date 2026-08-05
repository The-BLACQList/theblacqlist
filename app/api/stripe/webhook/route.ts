import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'
import {
  handlePaymentFailed,
  handleSubscriptionDeleted,
  handleSubscriptionUpsert,
} from '@/lib/services/billing/webhookHandlers'
import type { Json } from '@/lib/supabase/types'

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

  // Idempotency: if we've already processed this event id, acknowledge and stop
  // BEFORE any write. Stripe redelivers events, and our handlers upsert — so a
  // duplicate must be a no-op.
  const { data: seen } = await supabase
    .from('stripe_events_processed')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle()

  if (seen) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpsert(supabase, event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(supabase, event.data.object as Stripe.Invoice)
        break
      default:
        // Acknowledge unhandled event types without processing (Stripe won't retry 2xx).
        break
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[stripe/webhook] Error handling ${event.type}:`, message)
    // Record for the on-call trail, then return 500 so Stripe retries.
    await supabase.from('failed_webhooks').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload_json: event as unknown as Json,
      error_message: message,
    })
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  // Mark processed. The UNIQUE index guards against a race with a concurrent
  // redelivery — a duplicate-key error here is harmless, so swallow it.
  const { error: markError } = await supabase
    .from('stripe_events_processed')
    .insert({ stripe_event_id: event.id, event_type: event.type })
  if (markError && markError.code !== '23505') {
    console.error('[stripe/webhook] Failed to mark event processed:', markError.message)
  }

  return NextResponse.json({ received: true })
}
