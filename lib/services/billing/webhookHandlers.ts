// =============================================================================
// Stripe webhook handlers — failure posture
// =============================================================================
// Every write in this file decides what a paying owner actually gets. A write
// that fails silently here is invisible: nothing reads it back, and the audit
// log used to be written unconditionally, so it recorded the tier the handler
// *intended* rather than the tier the database ended up with. That made the log
// read as evidence of a change that may never have happened.
//
// Two distinct failure modes, handled differently on purpose:
//
//   error        → transient (connection, RLS, constraint). Throw. The route
//                  (app/api/stripe/webhook/route.ts) turns that into a 500 +
//                  a `failed_webhooks` row, and — critically — does NOT mark
//                  the event processed, so Stripe's redelivery genuinely
//                  re-runs the handler. Every write before a throw is
//                  idempotent, so a retry is safe.
//
//   skipped      → the owner has no billing, or a live subscription's price
//                  didn't resolve to a plan. Retrying can't change either, so
//                  nothing is thrown: tiers are left as they are, the reason
//                  is logged and stamped on the audit row.
//
// Since ticket 238 the tier writes themselves happen in one database function,
// sync_owner_plan_tiers, which returns exactly which pages changed. The audit
// row records that result, so it is evidence of what happened, not intent.
// =============================================================================

import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { createServiceClient } from '@/lib/supabase/server'
import { writeSystemAuditLog } from '@/lib/audit/system'
import { sendEmail } from '@/lib/email/resend'
import { PaymentFailedEmail } from '@/lib/email/templates/payment-failed'
import { JobPostingPaidEmail, jobPostingPaidSubject } from '@/lib/email/templates/job-posting-paid'
import type { PlanSlug } from '@/lib/stripe/plans'
import { jobPostingExpiryFrom } from '@/lib/stripe/jobPostings'
import { transitionToPendingReview } from '@/lib/listings/submitForReview'
import {
  resolveSubscriptionOwner,
  revalidateChanged,
  syncOwnerPlan,
  type OwnerPlanSync,
} from '@/lib/services/billing/planPages'

type ServiceClient = ReturnType<typeof createServiceClient>

// Statuses under which the owner keeps their plan. past_due is included so an
// owner keeps access during Stripe's dunning/retry window (grace period); only
// a real cancellation drops them to free.
const KEEPS_ACCESS = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due'])

// The same three states as stored in `subscriptions.status` (normalizeStatus
// maps `unpaid` onto past_due, so it is covered).
const LIVE_DB_STATUSES = ['active', 'trialing', 'past_due']

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

/** The audit fields every sync writes: what the database actually did. */
function syncAudit(result: OwnerPlanSync): Record<string, unknown> {
  if (result.skipped) return { tier_write: `skipped_${result.skipped}` }
  return {
    owner_tier: result.tier,
    cap: result.cap,
    pages: result.covered,
    ...(result.changes.length ? { changes: result.changes } : {}),
  }
}

// Ticket 238: a plan belongs to the owner. The webhook records the
// subscription, then asks the database to set every one of the owner's pages
// from it (sync_owner_plan_tiers). `metadata.listing_id` is only the page the
// owner started checkout from, used to choose the first covered page.
export async function handleSubscriptionUpsert(
  supabase: ServiceClient,
  sub: Stripe.Subscription
): Promise<void> {
  const meta = (sub.metadata ?? {}) as Record<string, string>
  let planId = meta.plan_id ?? null
  let planSlug = (meta.plan_slug ?? 'free') as PlanSlug
  let billingCycle = meta.billing_cycle ?? null

  const userId = await resolveSubscriptionOwner(supabase, sub.id, meta)
  if (!userId) {
    console.warn('[webhook] subscription has no owner (metadata, row or page)', sub.id)
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

  // Set when the subscription sits on a price no `plans` row carries. Withholding a
  // tier nulls its price IDs (lib/stripe/availability.ts), so a Customer Portal
  // switch into Growth or Premium lands here: Stripe bills the new price while the
  // owner keeps the checkout-time plan. That needs a person, not a guess, so it
  // is logged loudly and stamped on the audit row. The real block is the portal
  // configuration offering only purchasable products (founder step, 2026-10-03).
  let unresolvedPriceId: string | null = null

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
    } else {
      unresolvedPriceId = livePriceId
      console.error('[webhook] subscription is on a price no plan sells:', {
        subscriptionId: sub.id,
        userId,
        priceId: livePriceId,
        fallbackTier: planSlug,
      })
    }
  }

  const customerId =
    typeof sub.customer === 'string'
      ? sub.customer
      : ((sub.customer as Stripe.Customer)?.id ?? null)

  const status = normalizeStatus(sub.status)

  // What the row said before this event decides whether empty slots get filled:
  // a new plan, a different plan, or a plan coming back.
  const { data: prev, error: prevError } = await supabase
    .from('subscriptions')
    .select('plan_id, status')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle()
  if (prevError) {
    throw new Error(`subscription read failed for ${sub.id}: ${prevError.message}`)
  }
  const nowLive = KEEPS_ACCESS.has(sub.status)
  const fill =
    nowLive &&
    (!prev || prev.plan_id !== planId || !LIVE_DB_STATUSES.includes(prev.status))

  // The anchor is only recorded while that page exists: the column is a
  // foreign key, and a deleted page must not fail every later event.
  let anchorId: string | null = null
  if (meta.listing_id) {
    const { data: anchor } = await supabase
      .from('listings')
      .select('id')
      .eq('id', meta.listing_id)
      .maybeSingle()
    anchorId = anchor?.id ?? null
  }

  const { error: subError } = await supabase.from('subscriptions').upsert(
    {
      ...(anchorId ? { listing_id: anchorId } : {}),
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

  // Throwing is the retry mechanism: the route returns 500, records a
  // `failed_webhooks` row, and — critically — does NOT mark the event
  // processed, so Stripe's redelivery actually re-runs this. Everything above
  // is idempotent (upsert on the subscription id), so a retry is safe.
  if (subError) {
    throw new Error(`subscriptions upsert failed for ${sub.id}: ${subError.message}`)
  }

  // One live plan per owner is the rule (checkout refuses a second). One that
  // slipped past it still counts toward the owner's pages; flag it for a person.
  let otherLive: string[] = []
  if (nowLive) {
    const { data: others } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
      .neq('stripe_subscription_id', sub.id)
      .in('status', LIVE_DB_STATUSES)
    otherLive = (others ?? []).map((o) => o.stripe_subscription_id ?? '').filter(Boolean)
    if (otherLive.length) {
      console.error('[webhook] owner has more than one live subscription:', {
        subscriptionId: sub.id,
        userId,
        others: otherLive,
      })
    }
  }

  const result = await syncOwnerPlan(supabase, userId, { fill, anchorId })
  if (result.skipped === 'plan_unresolved') {
    console.error('[webhook] owner plan left unchanged, a live subscription has no plan:', {
      subscriptionId: sub.id,
      userId,
    })
  }

  // The audit row records what the database did, not what was intended.
  await writeSystemAuditLog({
    actorUserId: userId,
    action: 'subscription_synced',
    targetTable: 'subscriptions',
    targetId: anchorId,
    afterState: {
      status,
      plan_slug: planSlug,
      billing_cycle: billingCycle,
      filled: fill,
      ...syncAudit(result),
      ...(otherLive.length ? { other_live_subscriptions: otherLive } : {}),
      ...(unresolvedPriceId ? { price_unresolved: unresolvedPriceId } : {}),
    },
  })

  if (!result.skipped) await revalidateChanged(supabase, result.changes)
}

export async function handleSubscriptionDeleted(
  supabase: ServiceClient,
  sub: Stripe.Subscription
): Promise<void> {
  const meta = (sub.metadata ?? {}) as Record<string, string>

  const { error: cancelError } = await supabase
    .from('subscriptions')
    .update({ status: 'canceled', canceled_at: toIso(sub.canceled_at) ?? new Date().toISOString() })
    .eq('stripe_subscription_id', sub.id)

  if (cancelError) {
    throw new Error(`subscription cancel write failed for ${sub.id}: ${cancelError.message}`)
  }

  const userId = await resolveSubscriptionOwner(supabase, sub.id, meta)
  if (!userId) {
    console.warn('[webhook] canceled subscription has no owner (metadata, row or page)', sub.id)
    return
  }

  // Ending one subscription can't strip a plan another one still pays for:
  // the sync reads every live subscription the owner has. Covered pages stay
  // recorded, so a plan that comes back covers the same pages.
  const result = await syncOwnerPlan(supabase, userId, { fill: false })

  await writeSystemAuditLog({
    actorUserId: userId,
    action: 'subscription_canceled',
    targetTable: 'subscriptions',
    targetId: meta.listing_id ?? null,
    afterState: { status: 'canceled', ...syncAudit(result) },
  })

  if (!result.skipped) await revalidateChanged(supabase, result.changes)
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

  const { error: pastDueError } = await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subId)

  if (pastDueError) {
    throw new Error(`past_due write failed for ${subId}: ${pastDueError.message}`)
  }

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
        ? `We Couldn't Process the Payment for ${listingName}`
        : "We Couldn't Process Your Subscription Payment",
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
    throw new Error(
      `checkout.session.completed ${session.id} is missing listing_id/user_id metadata`
    )
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
    .select('status, name')
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

  // Ticket 235: tell the poster the money arrived and the role is in review.
  // Sent only on the draft → pending step above, so a redelivery (listing no
  // longer a draft) never sends it twice. The email is a courtesy: nothing
  // about it may fail the webhook, or Stripe would retry a fulfilled payment.
  await sendJobPostingPaidEmail(supabase, session, {
    listingId,
    userId,
    jobTitle: listing.name ?? 'your job posting',
  })
}

/** Stripe's charged amount as the poster saw it, e.g. "$9.99". Null when nothing was charged. */
export function formatChargedAmount(
  amountCents: number | null | undefined,
  currency: string | null | undefined
): string | null {
  if (!amountCents || amountCents <= 0) return null
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency ?? 'usd').toUpperCase(),
    }).format(amountCents / 100)
  } catch {
    return null
  }
}

async function sendJobPostingPaidEmail(
  supabase: ServiceClient,
  session: Stripe.Checkout.Session,
  { listingId, userId, jobTitle }: { listingId: string; userId: string; jobTitle: string }
): Promise<void> {
  try {
    // The email Stripe collected at checkout first; else the account email.
    let to = session.customer_details?.email ?? null
    if (!to) {
      const { data: userRes } = await supabase.auth.admin.getUserById(userId)
      to = userRes.user?.email ?? null
    }
    if (!to) return

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'
    await sendEmail({
      to,
      subject: jobPostingPaidSubject(jobTitle),
      react: JobPostingPaidEmail({
        jobTitle,
        amount: formatChargedAmount(session.amount_total, session.currency),
        roleUrl: `${siteUrl}/dashboard/pages/${listingId}/posted`,
        siteUrl,
      }),
    })
  } catch (err) {
    console.error('[billing] job posting paid email not sent', err)
  }
}
