import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getAppUrl } from '@/lib/env'
import { stripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveTourViewer } from '@/lib/tour/witness'
import { withTesterTrial, assertTrialCancels, TESTER_TRIAL_PLAN_SLUG } from '@/lib/tour/trial'

// The Tester Tour's claim route (tester-tour-spec.md §4.3): a completed tour
// converts into a 30-day card-less Starter trial on the tester's own listing,
// exactly once.
//
// The ordering here is the whole design and none of it is free to move:
//
//   1. The Starter plan/price guard runs BEFORE the compare-and-set. A 422 for
//      a missing price must not burn the tester's one claim (§4.3.2).
//   2. The compare-and-set on `trial_granted_at` runs BEFORE Stripe is called.
//      `.select('id')` makes a zero-row update observable, so of two
//      concurrent claims exactly one proceeds and Stripe is called once.
//   3. The Stripe idempotency key is stable per enrollment
//      (`tour-trial:<enrollmentId>`), so a lost response retried later returns
//      the SAME checkout session instead of creating a second subscription the
//      release guard could never see (§4.3.3).
//   4. Release-on-failure puts `trial_granted_at` back to null ONLY when it
//      still holds the exact timestamp this request wrote and no session id
//      has been persisted — so a release can never clobber a concurrent or
//      later winner, and never violates the DB CHECK that a session id
//      requires a claim.
//
// The session's metadata carries the same five keys as the ordinary checkout
// route and NO `purpose` key — on purpose. webhookHandlers.ts must treat this
// subscription as a perfectly ordinary Starter subscription (spec §4.2); zero
// lines change there. The trial's safety lives in lib/tour/trial.ts:
// `assertTrialCancels` throws before Stripe if the params could produce a
// trial that survives day 30 without a card.

// resolveTourViewer reads cookies, which already forces this route dynamic;
// the export makes that a stated property instead of a side effect.
export const dynamic = 'force-dynamic'

const CLAIM_FAILED = {
  error: 'Couldn’t start your trial just now. Try again in a moment.',
  code: 'SERVER_ERROR',
} as const

const ALREADY_CLAIMED = {
  error: 'This tour’s trial has already been claimed.',
  code: 'ALREADY_CLAIMED',
} as const

export async function POST() {
  // One 404 for flag-off, signed-out, and not-enrolled alike — same collapse
  // as /api/tour/state: the route's existence is itself gated.
  const viewer = await resolveTourViewer()
  if (!viewer) {
    return NextResponse.json({ error: 'Not found.', code: 'NOT_FOUND' }, { status: 404 })
  }

  const enrollmentId = viewer.enrollment.id

  // Completion is the reflection action's write-once stamp; this route only
  // reads it. 422, not 403: the business rule "finish the walk first" failed.
  if (viewer.enrollment.completedAt === null) {
    return NextResponse.json(
      { error: 'Finish the tour first — the trial unlocks with the final reflection.', code: 'TOUR_NOT_COMPLETE' },
      { status: 422 }
    )
  }

  try {
    const serviceClient = createServiceClient()

    // ── The plan/price guard, BEFORE the claim (§4.3.2) ──────────────────────
    const { data: plan, error: planError } = await serviceClient
      .from('plans')
      .select('id, stripe_price_id_monthly')
      .eq('plan_key', TESTER_TRIAL_PLAN_SLUG)
      .eq('is_active', true)
      .maybeSingle()
    if (planError) {
      return NextResponse.json(CLAIM_FAILED, { status: 500 })
    }
    if (!plan || !plan.stripe_price_id_monthly) {
      // Mirrors create-checkout-session's 422 — and because it runs before the
      // compare-and-set, a null Starter price costs the tester nothing.
      return NextResponse.json(
        { error: 'Plan not available for purchase', code: 'UNPROCESSABLE' },
        { status: 422 }
      )
    }
    const priceId = plan.stripe_price_id_monthly

    // ── Already claimed at entry: consummated, resumable, or recoverable ─────
    //
    // Concurrency does NOT pass through here — two simultaneous first claims
    // both read `trialGrantedAt: null` at entry and race the compare-and-set
    // below, where exactly one wins. This branch only serves a LATER request
    // against an enrollment whose claim already happened, and sorts it into:
    //
    //   session absent          → a prior attempt claimed but the session was
    //                             never persisted (lost response / crash).
    //                             Proceed to create: the stable idempotency
    //                             key returns the same session if one exists.
    //   session still open      → hand back the same checkout URL (Stripe
    //                             sessions stay open ~24h) instead of dead-
    //                             ending a tester who closed the tab.
    //   session expired         → the key has aged out with the session
    //                             (both ~24h); proceed to create a fresh one.
    //                             No subscription ever existed.
    //   session complete        → the trial subscription is real. 409.
    if (viewer.enrollment.trialGrantedAt !== null) {
      const { data: row, error: rowError } = await serviceClient
        .from('tour_enrollments')
        .select('stripe_checkout_session_id')
        .eq('id', enrollmentId)
        .maybeSingle()
      if (rowError || !row) {
        return NextResponse.json(CLAIM_FAILED, { status: 500 })
      }

      if (row.stripe_checkout_session_id !== null) {
        const session = await stripe.checkout.sessions.retrieve(row.stripe_checkout_session_id)
        if (session.status === 'open' && session.url) {
          return NextResponse.json({ data: { url: session.url } })
        }
        if (session.status !== 'expired') {
          return NextResponse.json(ALREADY_CLAIMED, { status: 409 })
        }
      }

      // Recovery paths fall through to the shared session create below. No
      // release-on-failure applies here — this request did not perform the
      // compare-and-set, so it owns no claim to give back.
      const response = await createTrialSession({
        enrollmentId,
        listingId: viewer.enrollment.listingId,
        userId: viewer.userId,
        email: viewer.email,
        planId: plan.id,
        priceId,
        serviceClient,
      })
      return response ?? NextResponse.json(CLAIM_FAILED, { status: 500 })
    }

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
        enrollmentId,
        listingId: viewer.enrollment.listingId,
        userId: viewer.userId,
        email: viewer.email,
        planId: plan.id,
        priceId,
        serviceClient,
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

interface TrialSessionInput {
  enrollmentId: string
  listingId: string
  userId: string
  email: string | null
  planId: string
  priceId: string
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
    plan_id: input.planId,
    plan_slug: TESTER_TRIAL_PLAN_SLUG,
    billing_cycle: 'monthly',
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    // Do NOT set payment_method_types — same as the ordinary checkout route.
    line_items: [{ price: input.priceId, quantity: 1 }],
    ...(input.email ? { customer_email: input.email } : {}),
    success_url: `${baseUrl}/dashboard/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/dashboard/upgrade`,
    metadata,
    subscription_data: { metadata },
  }

  // withTesterTrial merges the card-less 30-day trial fields; assertTrialCancels
  // throws before Stripe if the merged params could leave a card-less trial
  // alive past day 30 (the permanent-free-Starter trap — spec §4.1).
  const merged = withTesterTrial(params)
  assertTrialCancels(merged)

  const session = await stripe.checkout.sessions.create(merged, {
    idempotencyKey: `tour-trial:${input.enrollmentId}`,
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
