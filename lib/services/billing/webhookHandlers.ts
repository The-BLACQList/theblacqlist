import { revalidatePath } from 'next/cache'
import type Stripe from 'stripe'

import type { createServiceClient } from '@/lib/supabase/server'
import { buildEntityUrl } from '@/lib/listings/url'
import { writeSystemAuditLog } from '@/lib/audit/system'
import { sendEmail } from '@/lib/email/resend'
import { PaymentFailedEmail } from '@/lib/email/templates/payment-failed'
import type { PlanSlug } from '@/lib/stripe/plans'

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
  const planId = meta.plan_id ?? null
  const planSlug = (meta.plan_slug ?? 'free') as PlanSlug
  const billingCycle = meta.billing_cycle ?? null

  if (!userId || !listingId) {
    console.warn('[webhook] subscription missing user_id or listing_id in metadata', sub.id)
    return
  }

  // In Stripe API v2026+, period dates live on the first subscription item.
  const firstItem = sub.items.data[0]
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
