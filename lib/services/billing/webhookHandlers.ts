import { revalidatePath } from 'next/cache'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { createServiceClient } from '@/lib/supabase/server'
import { buildEntityUrl } from '@/lib/listings/url'
import { writeSystemAuditLog } from '@/lib/audit/system'
import { sendEmail } from '@/lib/email/resend'
import { PaymentFailedEmail } from '@/lib/email/templates/payment-failed'
import type { PlanSlug } from '@/lib/stripe/plans'
import { jobPostingExpiryFrom } from '@/lib/stripe/jobPostings'
import { transitionToPendingReview } from '@/lib/listings/submitForReview'

type ServiceClient = ReturnType<typeof createServiceClient>

// Statuses under which the listing keeps its paid tier. past_due is included
// so an owner keeps access during Stripe's dunning/retry window (grace period);
// only a real cancellation drops them to free.
const KEEPS_ACCESS = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due'])

// Maps Stripe's subscription status to the app's `subscriptions.status` CHECK
// values ('active' | 'inactive' | 'canceled' | 'past_due' | 'trialing').
export function normalizeStatus(stripeStatus: Stripe.Subscription.Status): string {
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

function toIso(unixSeconds: number | null | undefined): string | null {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null
}

// Revalidate the public entity page after a tier change (tier can affect layout
// capability and placement). Best-effort; only for published listings.
async function revalidateListingPage(supabase: ServiceClient, listingId: string): Promise<void> {
  const { data: listing } = await supabase
    .from('listings')
    .select('slug, entity_type, status, cities(slug)')
    .eq('id', listingId)
    .maybeSingle()

  if (listing?.status === 'published' && listing.slug) {
    const citySlug = (listing.cities as { slug: string } | null)?.slug ?? null
    revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
}

export async function handleSubscriptionUpsert(
  supabase: ServiceClient,
  sub: Stripe.Subscription
): Promise<void> {
  const meta = sub.metadata as Record<string, string>
  const userId = meta.user_id
  const listingId = meta.listing_id
  let planId = meta.plan_id ?? null
  let planSlug = (meta.plan_slug ?? 'free') as PlanSlug
  let billingCycle = meta.billing_cycle ?? null

  if (!userId || !listingId) {
    console.warn('[webhook] subscription missing user_id or listing_id in metadata', sub.id)
    return
  }

  // In Stripe API v2026+, period dates live on the first subscription item.
  const firstItem = sub.items.data[0]

  // A Customer Portal plan switch emits subscription.updated with a NEW price but does
  // NOT rewrite subscription metadata — so metadata is stale. Resolve tier from the live
  // price against `plans`; fall back to checkout-time metadata only when no row matches.
  // No is_active filter here: a grandfathered/deactivated plan must still resolve its
  // tier for existing subscribers (is_active gates purchase, a different concern).
  const livePriceId =
    typeof firstItem?.price === 'string' ? firstItem.price : (firstItem?.price?.id ?? null)

  if (livePriceId) {
    const { data: planRow } = await supabase
      .from('plans')
      .select('id, plan_key, stripe_price_id_monthly, stripe_price_id_yearly')
      .or(`stripe_price_id_monthly.eq.${livePriceId},stripe_price_id_yearly.eq.${livePriceId}`)
      .maybeSingle()
    if (planRow) {
      planId = planRow.id
      planSlug = planRow.plan_key as PlanSlug
      billingCycle = planRow.stripe_price_id_yearly === livePriceId ? 'annual' : 'monthly'
    }
  }

  const customerId =
    typeof sub.customer === 'string'
      ? sub.customer
      : ((sub.customer as Stripe.Customer)?.id ?? null)

  const { data: prevListing } = await supabase
    .from('listings')
    .select('tier')
    .eq('id', listingId)
    .maybeSingle()
  const prevTier = prevListing?.tier ?? null

  const status = normalizeStatus(sub.status)

  await supabase.from('subscriptions').upsert(
    {
      listing_id: listingId,
      user_id: userId,
      plan_id: planId,
      status,
      current_period_start: toIso(firstItem?.current_period_start),
      current_period_end: toIso(firstItem?.current_period_end),
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
      canceled_at: toIso(sub.canceled_at),
    },
    { onConflict: 'stripe_subscription_id' }
  )

  const newTier = KEEPS_ACCESS.has(sub.status) ? planSlug : 'free'
  await supabase.from('listings').update({ tier: newTier }).eq('id', listingId)

  await writeSystemAuditLog({
    actorUserId: userId,
    action: 'subscription_synced',
    targetTable: 'subscriptions',
    targetId: listingId,
    beforeState: { tier: prevTier },
    afterState: { tier: newTier, status, plan_slug: planSlug, billing_cycle: billingCycle },
  })

  if (newTier !== prevTier) {
    await revalidateListingPage(supabase, listingId)
  }
}

export async function handleSubscriptionDeleted(
  supabase: ServiceClient,
  sub: Stripe.Subscription
): Promise<void> {
  const meta = sub.metadata as Record<string, string>
  const listingId = meta.listing_id
  const userId = meta.user_id ?? null

  await supabase
    .from('subscriptions')
    .update({ status: 'canceled', canceled_at: toIso(sub.canceled_at) ?? new Date().toISOString() })
    .eq('stripe_subscription_id', sub.id)

  if (!listingId) return

  const { data: prevListing } = await supabase
    .from('listings')
    .select('tier')
    .eq('id', listingId)
    .maybeSingle()

  await supabase.from('listings').update({ tier: 'free' }).eq('id', listingId)

  await writeSystemAuditLog({
    actorUserId: userId,
    action: 'subscription_canceled',
    targetTable: 'subscriptions',
    targetId: listingId,
    beforeState: { tier: prevListing?.tier ?? null },
    afterState: { tier: 'free', status: 'canceled' },
  })

  await revalidateListingPage(supabase, listingId)
}

export async function handlePaymentFailed(
  supabase: ServiceClient,
  invoice: Stripe.Invoice
): Promise<void> {
  // In Stripe API v2026+, the subscription is under invoice.parent.subscription_details.
  const parent = invoice.parent as {
    subscription_details?: { subscription?: string | { id: string } }
  } | null
  const subRef = parent?.subscription_details?.subscription
  const subId = typeof subRef === 'string' ? subRef : (subRef?.id ?? null)

  if (!subId) return

  await supabase.from('subscriptions').update({ status: 'past_due' }).eq('stripe_subscription_id', subId)

  const { data: subRow } = await supabase
    .from('subscriptions')
    .select('listing_id, user_id')
    .eq('stripe_subscription_id', subId)
    .maybeSingle()

  let listingName: string | undefined
  if (subRow?.listing_id) {
    const { data: listing } = await supabase
      .from('listings')
      .select('name')
      .eq('id', subRow.listing_id)
      .maybeSingle()
    listingName = listing?.name ?? undefined
  }

  // Prefer the invoice's email; fall back to the account email. Non-blocking.
  let to = invoice.customer_email ?? null
  if (!to && subRow?.user_id) {
    const { data: userRes } = await supabase.auth.admin.getUserById(subRow.user_id)
    to = userRes.user?.email ?? null
  }
  if (to) {
    await sendEmail({
      to,
      subject: listingName
        ? `We couldn't process the payment for ${listingName}`
        : "We couldn't process your subscription payment",
      react: PaymentFailedEmail({ listingName }),
    })
  }

  await writeSystemAuditLog({
    actorUserId: subRow?.user_id ?? null,
    action: 'subscription_payment_failed',
    targetTable: 'subscriptions',
    targetId: subRow?.listing_id ?? null,
    afterState: { status: 'past_due' },
  })
}

/**
 * Fulfil a completed one-time Checkout session.
 *
 * The product's first non-subscription money path (E-2, Model A). It is
 * deliberately the ONLY writer of `job_posting_purchases` — there is no RLS
 * INSERT policy on that table, so a client cannot mint itself a paid row.
 *
 * Ordering matters and is not arbitrary: the purchase is recorded BEFORE the
 * listing transitions. If the transition fails, the caller returns 500, Stripe
 * retries, and the `stripe_checkout_session_id` UNIQUE constraint makes the
 * re-recorded purchase a no-op while the transition gets a second chance. The
 * reverse order would risk a published job with no record of the payment that
 * bought it.
 */
export async function handleCheckoutSessionCompleted(
  supabase: ServiceClient,
  session: Stripe.Checkout.Session
): Promise<void> {
  const meta = (session.metadata ?? {}) as Record<string, string>

  // Subscription checkouts also emit this event. Their state is written by
  // `customer.subscription.*`, so anything that is not an explicit one-time
  // purchase of ours is left alone rather than guessed at.
  if (meta.purpose !== 'job_posting') return

  // `unpaid` sessions can complete when the payment method settles
  // asynchronously. Nothing is fulfilled until the money is actually there —
  // Stripe sends a later event when it is.
  if (session.payment_status !== 'paid') return

  const listingId = meta.listing_id
  const userId = meta.user_id
  if (!listingId || !userId) {
    throw new Error(`checkout.session.completed ${session.id} is missing listing_id/user_id metadata`)
  }

  const paidAt = new Date()
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null)

  // Upsert on the session id, not insert: Stripe redelivers, and this handler
  // must be safe to run twice. `stripe_events_processed` already guards the
  // common case, but it is keyed on the event — two different events can
  // describe the same session.
  // `job_posting_purchases` is not in the generated Database types — the
  // migration is written but unapplied (GATE-DATA, lands at G1). Same approach as
  // lib/security/rate-limit.ts: narrow the call rather than hand-edit generated
  // types, which would then disagree with the next regeneration.
  const { error: purchaseError } = await (supabase as unknown as SupabaseClient)
    .from('job_posting_purchases')
    .upsert(
    {
      listing_id: listingId,
      purchased_by: userId,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      // Never a hardcoded amount — what Stripe says was charged is what gets
      // recorded, so a dashboard price change cannot desync the ledger.
      amount_cents: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      status: 'paid',
      paid_at: paidAt.toISOString(),
      expires_at: jobPostingExpiryFrom(paidAt),
      updated_at: paidAt.toISOString(),
    },
    { onConflict: 'stripe_checkout_session_id' }
  )

  if (purchaseError) {
    throw new Error(`Failed to record job posting purchase: ${purchaseError.message}`)
  }

  // Only a draft advances. A redelivery arriving after a moderator has already
  // published the listing must not drag it back to `pending`.
  const { data: listing } = await supabase
    .from('listings')
    .select('status')
    .eq('id', listingId)
    .eq('owner_user_id', userId)
    .maybeSingle()

  if (listing?.status !== 'draft') return

  const result = await transitionToPendingReview(supabase, listingId, userId)
  if ('error' in result) {
    throw new Error(`Paid job ${listingId} could not be submitted for review: ${result.error}`)
  }

  await writeSystemAuditLog({
    actorUserId: userId,
    action: 'job_posting_purchased',
    targetTable: 'job_posting_purchases',
    targetId: listingId,
    beforeState: { status: 'draft' },
    afterState: {
      status: 'pending',
      amount_cents: session.amount_total ?? 0,
      stripe_checkout_session_id: session.id,
    },
  })
}
