import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { z } from 'zod'
import { getAppUrl } from '@/lib/env'
import { getPlanMeta } from '@/lib/stripe/plans'
import { stripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'
import { LIVE_STATUSES, listingIsOwnedBy, resolveTrialClaimer } from '@/lib/tour/freeMonth'
import {
  withTesterTrial,
  assertTrialCancels,
  isTesterTrialTier,
  TESTER_TRIAL_PLAN_SLUG,
  TESTER_TRIAL_TIERS,
  type TesterTrialTier,
} from '@/lib/tour/trial'

// The Tester Tour's claim route (tester-tour-spec.md §4.3): a completed tour
// converts into one free month (a 30-day card-less trial) on the paid tier the
// tester picks, on their own listing, exactly once. The tester can hold it as
// long as they like; nothing here expires an unclaimed month.
//
// Body: `{ plan?: 'starter' | 'growth' | 'premium' }`. With no plan, a fresh
// claim lands on Starter (so a tab opened before the tier choice still works)
// and a resume hands back whatever checkout is already open.
//
// The ordering here is the whole design and none of it is free to move:
//
//   1. The plan/price guard runs BEFORE the compare-and-set. A tier with no
//      monthly price is not open yet, and asking for it must not burn the
//      tester's one claim (§4.3.2). Same for a listing that already pays.
//   2. The compare-and-set on `trial_granted_at` runs BEFORE Stripe is called.
//      `.select('id')` makes a zero-row update observable, so of two
//      concurrent claims exactly one proceeds and Stripe is called once.
//   3. The Stripe idempotency key for an enrollment's first session is
//      `tour-trial:<enrollmentId>`, with no tier in it. A lost response
//      retried later returns the SAME checkout session; a retry for a
//      different tier is refused by Stripe (same key, different params)
//      rather than opening a second session nobody can see (§4.3.3). A
//      session that replaces an earlier one (expired, or closed so the tester
//      can switch tiers) is keyed on the session it replaces:
//      `tour-trial:<enrollmentId>:<priorSessionId>`.
//   4. Release-on-failure puts `trial_granted_at` back to null ONLY when it
//      still holds the exact timestamp this request wrote and no session id
//      has been persisted — so a release can never clobber a concurrent or
//      later winner, and never violates the DB CHECK that a session id
//      requires a claim.
//
// The session's metadata carries the same five keys as the ordinary checkout
// route and NO `purpose` key — on purpose. webhookHandlers.ts must treat this
// subscription as a perfectly ordinary subscription (spec §4.2); zero
// lines change there. The trial's safety lives in lib/tour/trial.ts:
// `assertTrialCancels` throws before Stripe if the params could produce a
// trial that survives day 30 without a card.

// resolveTrialClaimer reads cookies, which already forces this route dynamic;
// the export makes that a stated property instead of a side effect.
export const dynamic = 'force-dynamic'

const CLAIM_FAILED = {
  error: 'Couldn’t start your free month just now. Try again in a moment.',
  code: 'SERVER_ERROR',
} as const

// Answer 2 (founder, 2026-10-10): a tester who already pays keeps the free
// month for a bigger plan. Putting a trial on top of a live subscription is
// unsafe today (two subscriptions, one listings.tier), so the claim waits for
// ticket 136 and is NOT spent here.
const ALREADY_SUBSCRIBED = {
  error:
    'Your listing already has a paid plan, so we’re saving your free month for an upgrade. It will be ready when Growth and Premium open.',
  code: 'ALREADY_SUBSCRIBED',
} as const

const claimBodySchema = z
  .object({ plan: z.enum(TESTER_TRIAL_TIERS).optional() })
  .strict()

// The enrollment's listing changed hands after the invite (a released test
// claim, 2026-10-11). Refused before anything is spent or sent to Stripe.
const NOT_LISTING_OWNER = {
  error: 'This listing isn’t yours anymore, so your free month can’t go on it. Ask us for a new invite.',
  code: 'NOT_LISTING_OWNER',
} as const

const ALREADY_CLAIMED = {
  error: 'You already used your free month.',
  code: 'ALREADY_CLAIMED',
} as const

export async function POST(request: Request) {
  // One 404 for signed-out and not-enrolled alike. No flag check: the free
  // month outlives the tour (founder answer 3, 2026-10-10).
  const viewer = await resolveTrialClaimer()
  if (!viewer) {
    return NextResponse.json({ error: 'Not found.', code: 'NOT_FOUND' }, { status: 404 })
  }

  // An empty body is the old one-button call; anything else must parse.
  let raw: unknown = {}
  try {
    const text = await request.text()
    if (text.trim() !== '') raw = JSON.parse(text)
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }
  const parsed = claimBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid claim request', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }
  const requested: TesterTrialTier | null = parsed.data.plan ?? null

  const enrollmentId = viewer.enrollment.id

  // A supporter tester has no listing to put a trial on. Refused before the
  // plan guard and the compare-and-set, so nothing is read or spent. The DB
  // CHECK tour_enrollments_trial_requires_listing backs this up.
  const listingId = viewer.enrollment.listingId
  if (listingId === null) {
    return NextResponse.json(
      { error: 'Your free month goes on a business listing, and this account doesn’t have one.', code: 'NO_LISTING_FOR_TRIAL' },
      { status: 422 }
    )
  }

  // Completion is the reflection action's write-once stamp; this route only
  // reads it. 422, not 403: the business rule "finish the walk first" failed.
  if (viewer.enrollment.completedAt === null) {
    return NextResponse.json(
      { error: 'Finish the walk first. Your free month unlocks with the last step.', code: 'TOUR_NOT_COMPLETE' },
      { status: 422 }
    )
  }

  try {
    const serviceClient = createServiceClient()
    const base = { enrollmentId, listingId, userId: viewer.userId, email: viewer.email, serviceClient }

    // Ownership is checked now, not trusted from the invite: the listing may
    // have changed hands since. This runs before every branch below, so a
    // fresh claim, a resume and a tier switch are all refused alike, with
    // nothing spent and Stripe never called.
    const owned = await listingIsOwnedBy(serviceClient, listingId, viewer.userId)
    if (owned === null) {
      return NextResponse.json(CLAIM_FAILED, { status: 500 })
    }
    if (!owned) {
      return NextResponse.json(NOT_LISTING_OWNER, { status: 403 })
    }

    // ── Already claimed at entry: consummated, resumable, or recoverable ─────
    //
    // Concurrency does NOT pass through here — two simultaneous first claims
    // both read `trialGrantedAt: null` at entry and race the compare-and-set
    // below, where exactly one wins. This branch only serves a LATER request
    // against an enrollment whose claim already happened, and sorts it into:
    //
    //   session absent          → a prior attempt claimed but the session was
    //                             never persisted (lost response / crash).
    //                             Proceed to create: the first-session key
    //                             returns the same session if one exists.
    //   session open, same tier → hand back the same checkout URL (Stripe
    //   (or no tier asked)        sessions stay open ~24h) instead of dead-
    //                             ending a tester who closed the tab.
    //   session open, new tier  → the tester changed their mind. Close the
    //                             old checkout, then open one for the new
    //                             tier. If the close fails, nothing new opens.
    //   session expired         → no subscription ever existed; open a fresh
    //                             one, keyed on the session it replaces.
    //   session complete        → the free month is real. 409.
    if (viewer.enrollment.trialGrantedAt !== null) {
      const { data: row, error: rowError } = await serviceClient
        .from('tour_enrollments')
        .select('stripe_checkout_session_id')
        .eq('id', enrollmentId)
        .maybeSingle()
      if (rowError || !row) {
        return NextResponse.json(CLAIM_FAILED, { status: 500 })
      }

      let tier: TesterTrialTier = requested ?? TESTER_TRIAL_PLAN_SLUG
      let idempotencyKey = `tour-trial:${enrollmentId}`
      let toClose: string | null = null

      if (row.stripe_checkout_session_id !== null) {
        const priorId = row.stripe_checkout_session_id
        const session = await stripe.checkout.sessions.retrieve(priorId)
        const priorSlug = session.metadata?.plan_slug
        const priorTier = isTesterTrialTier(priorSlug) ? priorSlug : null

        if (session.status === 'open' && session.url) {
          if (requested === null || requested === priorTier) {
            return NextResponse.json({ data: { url: session.url } })
          }
          toClose = priorId
        } else if (session.status !== 'expired') {
          return NextResponse.json(ALREADY_CLAIMED, { status: 409 })
        }
        // A resume with no tier named stays on the tier it started with.
        if (requested === null && priorTier !== null) tier = priorTier
        idempotencyKey = `tour-trial:${enrollmentId}:${priorId}`
      }

      // Recovery paths share the guards below. No release-on-failure applies
      // here — this request did not perform the compare-and-set, so it owns
      // no claim to give back.
      const guard = await guardBeforeClaim(serviceClient, tier, listingId)
      if (guard instanceof NextResponse) return guard

      if (toClose !== null) {
        try {
          await stripe.checkout.sessions.expire(toClose)
        } catch (err) {
          // Most likely the tester finished that checkout a moment ago. Open
          // nothing new; the next request sees it complete and answers 409.
          console.error('Tour trial: could not close the earlier checkout:', err)
          return NextResponse.json(CLAIM_FAILED, { status: 500 })
        }
      }

      const response = await createTrialSession({ ...base, tier, plan: guard, idempotencyKey })
      return response ?? NextResponse.json(CLAIM_FAILED, { status: 500 })
    }

    const tier: TesterTrialTier = requested ?? TESTER_TRIAL_PLAN_SLUG

    // ── Open tier and no live plan, BEFORE the claim ─────────────────────────
    const guard = await guardBeforeClaim(serviceClient, tier, listingId)
    if (guard instanceof NextResponse) return guard

    // ── The compare-and-set (§4.3.1): claim BEFORE Stripe ────────────────────
    const grantedAtIso = new Date().toISOString()
    const { data: claimed, error: claimError } = await serviceClient
      .from('tour_enrollments')
      .update({ trial_granted_at: grantedAtIso })
      .eq('id', enrollmentId)
      .is('trial_granted_at', null)
      .select('id')
    if (claimError) {
      return NextResponse.json(CLAIM_FAILED, { status: 500 })
    }
    if (!claimed || claimed.length === 0) {
      // Zero rows updated: a concurrent request won the claim. Its Stripe call
      // is the only one that happens.
      return NextResponse.json(ALREADY_CLAIMED, { status: 409 })
    }

    try {
      const response = await createTrialSession({
        ...base,
        tier,
        plan: guard,
        idempotencyKey: `tour-trial:${enrollmentId}`,
      })
      if (response) return response
      // A created session with no URL is a failure the tester never saw a link
      // for — release and let them retry (the idempotency key makes the retry
      // resume, not duplicate).
      await releaseClaim(serviceClient, enrollmentId, grantedAtIso)
      return NextResponse.json(CLAIM_FAILED, { status: 500 })
    } catch (err) {
      // §4.3.4 — release on failure, guarded to the exact timestamp THIS
      // request wrote so a retry that re-claimed meanwhile is never clobbered.
      console.error('Tour trial claim failed after compare-and-set:', err)
      await releaseClaim(serviceClient, enrollmentId, grantedAtIso)
      return NextResponse.json(CLAIM_FAILED, { status: 500 })
    }
  } catch (err) {
    console.error('Tour trial claim failed:', err)
    return NextResponse.json(CLAIM_FAILED, { status: 500 })
  }
}

interface OpenPlan {
  planId: string
  priceId: string
}

/**
 * The two refusals that must never spend the claim, checked before it:
 *
 *   - the tier is not open (no active plan row with a monthly price). 422
 *     PLAN_NOT_OPEN, and the month keeps waiting;
 *   - the listing already holds a live subscription. Two subscriptions would
 *     share one `listings.tier`, and the trial ending on day 30 would fire
 *     customer.subscription.deleted against a listing that is still paid for.
 *     409, and the month is saved for an upgrade (ticket 136).
 *
 * Returns the plan to check out on, or the refusal response.
 */
async function guardBeforeClaim(
  serviceClient: ReturnType<typeof createServiceClient>,
  tier: TesterTrialTier,
  listingId: string
): Promise<OpenPlan | NextResponse> {
  const { data: plan, error: planError } = await serviceClient
    .from('plans')
    .select('id, stripe_price_id_monthly')
    .eq('plan_key', tier)
    .eq('is_active', true)
    .maybeSingle()
  if (planError) {
    return NextResponse.json(CLAIM_FAILED, { status: 500 })
  }
  if (!plan || !plan.stripe_price_id_monthly) {
    return NextResponse.json(
      {
        error: `${getPlanMeta(tier).name} isn’t open yet. Your free month will wait for it.`,
        code: 'PLAN_NOT_OPEN',
      },
      { status: 422 }
    )
  }

  const live = await listingHasLivePlan(serviceClient, listingId)
  if (live === null) return NextResponse.json(CLAIM_FAILED, { status: 500 })
  if (live) return NextResponse.json(ALREADY_SUBSCRIBED, { status: 409 })

  return { planId: plan.id, priceId: plan.stripe_price_id_monthly }
}

/** true / false for a clear answer; null when the lookup itself failed. */
async function listingHasLivePlan(
  serviceClient: ReturnType<typeof createServiceClient>,
  listingId: string
): Promise<boolean | null> {
  const { data, error } = await serviceClient
    .from('subscriptions')
    .select('id')
    .eq('listing_id', listingId)
    .in('status', LIVE_STATUSES)
    .limit(1)
  if (error) return null
  return (data?.length ?? 0) > 0
}

interface TrialSessionInput {
  enrollmentId: string
  listingId: string
  userId: string
  email: string | null
  tier: TesterTrialTier
  plan: OpenPlan
  idempotencyKey: string
  serviceClient: ReturnType<typeof createServiceClient>
}

/**
 * Create (or, via the idempotency key, re-fetch) the trial checkout session,
 * persist its id on the enrollment, and return the redirect response — or null
 * when Stripe returned a session with no URL.
 *
 * Throws on Stripe/assertion failure; the caller decides whether a release
 * applies (only the path that performed the compare-and-set owns the claim).
 */
async function createTrialSession(input: TrialSessionInput): Promise<NextResponse | null> {
  const baseUrl = getAppUrl()

  // Same five keys as create-checkout-session, on both the session and the
  // subscription — and never a `purpose` key, so webhookHandlers.ts takes its
  // ordinary subscription path (spec §4.2).
  const metadata = {
    user_id: input.userId,
    listing_id: input.listingId,
    plan_id: input.plan.planId,
    plan_slug: input.tier,
    billing_cycle: 'monthly',
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    // Do NOT set payment_method_types — same as the ordinary checkout route.
    line_items: [{ price: input.plan.priceId, quantity: 1 }],
    ...(input.email ? { customer_email: input.email } : {}),
    success_url: `${baseUrl}/dashboard/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/dashboard/upgrade`,
    metadata,
    subscription_data: { metadata },
  }

  // withTesterTrial merges the card-less 30-day trial fields; assertTrialCancels
  // throws before Stripe if the merged params could leave a card-less trial
  // alive past day 30 (the permanent-free-tier trap — spec §4.1).
  const merged = withTesterTrial(params)
  assertTrialCancels(merged)

  const session = await stripe.checkout.sessions.create(merged, {
    idempotencyKey: input.idempotencyKey,
  })
  if (!session.url) return null

  // Best-effort: if this write is lost, the enrollment reads granted-with-no-
  // session and the recovery branch re-fetches the same session by idempotency
  // key on the next claim. The DB CHECK is satisfied — trial_granted_at is set.
  try {
    await input.serviceClient
      .from('tour_enrollments')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', input.enrollmentId)
  } catch {
    // Swallowed — see above.
  }

  return NextResponse.json({ data: { url: session.url } })
}

/**
 * Give back a claim this request made and could not consummate. Guarded three
 * ways: the exact enrollment, the exact timestamp this request wrote, and no
 * persisted session id — so it can never undo a different request's claim and
 * never violates the session-requires-claim DB CHECK.
 */
async function releaseClaim(
  serviceClient: ReturnType<typeof createServiceClient>,
  enrollmentId: string,
  grantedAtIso: string
): Promise<void> {
  try {
    await serviceClient
      .from('tour_enrollments')
      .update({ trial_granted_at: null })
      .eq('id', enrollmentId)
      .eq('trial_granted_at', grantedAtIso)
      .is('stripe_checkout_session_id', null)
  } catch {
    // A failed release leaves the enrollment claimed-with-no-session, which
    // the recovery branch turns back into a working claim on the next request.
  }
}
