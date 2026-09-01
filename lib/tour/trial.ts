// The Tester Tour's reward: a 30-day Stripe-native Starter trial.
//
// ══ THE ONE THING THIS FILE EXISTS TO PREVENT ══
// A trial that never ends.
//
// Stripe's DEFAULT `trial_settings.end_behavior.missing_payment_method` is
// `create_invoice`. A card-less trial that reaches day 30 under that default
// does not cancel — it invoices, fails to collect, and parks the subscription in
// `past_due`. `past_due` is a member of KEEPS_ACCESS in
// lib/stripe/webhooks/webhookHandlers.ts:46, so that tester keeps Starter
// entitlements forever, and no `customer.subscription.deleted` event ever
// arrives to take them away. There is no alarm for this state: it looks exactly
// like a paying customer whose card bounced.
//
// `missing_payment_method: 'cancel'` is therefore not a nice default — it is the
// only setting under which this feature is safe to ship. It is asserted first in
// the test file, and `assertTrialCancels()` below throws BEFORE Stripe is called
// so a mistake here is a 500 on one request rather than a permanent free tier.
//
// `payment_method_collection: 'if_required'` is what lets a tester start the
// trial without entering a card at all. The two settings only make sense
// together: collecting no card is safe precisely because the end behaviour is
// `cancel`. Never change one without the other.
//
// ══ WHY THERE IS NO `purpose` IN THE METADATA ══
// `handleCheckoutSessionCompleted` early-returns at webhookHandlers.ts:358 for
// sessions carrying a `purpose` (that path belongs to one-off job-posting
// purchases). Our sessions must NOT carry one, so they fall through to the
// ordinary subscription path: `handleSubscriptionUpsert` re-resolves the tier
// from the live price (:107-121) and lands the tester on `starter`, and the
// trial-end cancellation arrives as a normal `customer.subscription.deleted`.
//
// That is what makes this feature **zero lines of change in webhookHandlers.ts**.
// It stays true only while the metadata stays `purpose`-free, so
// `assertTrialCancels()` treats a `purpose` key as a hard error rather than
// trusting the call sites to remember.

import type Stripe from 'stripe'

export const TESTER_TRIAL_DAYS = 30

/** The Stripe tier a completed tour grants. Re-resolved from the live price by
 *  the webhook — this constant is for copy and for asserting intent, never for
 *  writing an entitlement directly. */
export const TESTER_TRIAL_PLAN_SLUG = 'starter' as const

type TrialSessionFields = Pick<
  Stripe.Checkout.SessionCreateParams,
  'payment_method_collection' | 'subscription_data'
>

// Frozen at every level. A caller that mutates a nested object would change the
// trial for every subsequent request in the same warm Fluid Compute instance —
// including requests belonging to other testers — and nothing would surface it.
// Freezing turns that into a thrown TypeError in strict mode, which every module
// here is.
export const TESTER_TRIAL_SESSION_FIELDS: Readonly<TrialSessionFields> = Object.freeze({
  payment_method_collection: 'if_required',
  subscription_data: Object.freeze({
    trial_period_days: TESTER_TRIAL_DAYS,
    trial_settings: Object.freeze({
      end_behavior: Object.freeze({
        missing_payment_method: 'cancel',
      }),
    }),
  }),
}) satisfies Readonly<TrialSessionFields>

/**
 * Merge the trial fields into a checkout session's params, preserving the
 * caller's `subscription_data.metadata`.
 *
 * The naive `{...params, ...TESTER_TRIAL_SESSION_FIELDS}` is a bug: the spread
 * replaces `subscription_data` wholesale and silently drops the metadata the
 * webhook needs to know which user and listing this subscription belongs to.
 * The subscription would sync to nobody. Hence an explicit merge rather than a
 * spread at the call site.
 */
export function withTesterTrial(
  params: Stripe.Checkout.SessionCreateParams
): Stripe.Checkout.SessionCreateParams {
  return {
    ...params,
    payment_method_collection: TESTER_TRIAL_SESSION_FIELDS.payment_method_collection,
    subscription_data: {
      ...params.subscription_data,
      ...TESTER_TRIAL_SESSION_FIELDS.subscription_data,
    },
  }
}

export class TesterTrialUnsafeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TesterTrialUnsafeError'
  }
}

/**
 * Throw unless these params describe a trial that is guaranteed to end.
 *
 * Called immediately before `stripe.checkout.sessions.create` on the tour path.
 * Every branch here corresponds to a way the feature turns into a permanent free
 * Starter tier, so none of them is defensive padding:
 *
 *   - wrong `mode` — a `payment` session ignores the trial fields entirely and
 *     charges the tester, which is the opposite of the offer;
 *   - missing `'cancel'` — the `past_due` trap described in the header;
 *   - wrong day count — a typo'd `300` is a ten-month giveaway that looks fine;
 *   - a `purpose` in metadata — routes the webhook down the job-posting branch,
 *     so the subscription never syncs and the tester's tier never updates.
 */
export function assertTrialCancels(params: Stripe.Checkout.SessionCreateParams): void {
  const fail = (why: string): never => {
    throw new TesterTrialUnsafeError(`Refusing to create a tester trial: ${why}`)
  }

  if (params.mode !== 'subscription') {
    fail(`mode is "${String(params.mode)}", expected "subscription"`)
  }

  if (params.payment_method_collection !== 'if_required') {
    fail(
      `payment_method_collection is "${String(params.payment_method_collection)}", expected "if_required"`
    )
  }

  const sub = params.subscription_data
  if (!sub) {
    fail('subscription_data is missing, so no trial would be created at all')
    return
  }

  if (sub.trial_period_days !== TESTER_TRIAL_DAYS) {
    fail(`trial_period_days is ${String(sub.trial_period_days)}, expected ${TESTER_TRIAL_DAYS}`)
  }

  const endBehavior = sub.trial_settings?.end_behavior?.missing_payment_method
  if (endBehavior !== 'cancel') {
    fail(
      `trial_settings.end_behavior.missing_payment_method is "${String(endBehavior)}", expected ` +
        '"cancel" — any other value parks a card-less subscription in past_due, which KEEPS_ACCESS ' +
        'treats as active, granting a permanent free Starter tier'
    )
  }

  // See the header: a `purpose` sends the webhook down the job-posting branch.
  for (const [where, metadata] of [
    ['metadata', params.metadata],
    ['subscription_data.metadata', sub.metadata],
  ] as const) {
    if (metadata && 'purpose' in metadata) {
      fail(
        `${where} carries a "purpose" key, which makes handleCheckoutSessionCompleted ` +
          'early-return and the subscription never sync'
      )
    }
  }
}
