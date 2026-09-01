// =============================================================================
// Tester Tour — the trial must actually end
// =============================================================================
// Finishing the tour creates a REAL Stripe subscription on the tester's own
// listing. That makes this file's first assertion the most important one in the
// feature:
//
//   Stripe's default trial end behaviour is `create_invoice`. A card-less trial
//   that reaches day 30 under that default does not cancel — it invoices, fails
//   to collect, and lands in `past_due`. `past_due` is in KEEPS_ACCESS
//   (lib/stripe/webhooks/webhookHandlers.ts:46), so the tester keeps Starter
//   entitlements forever and no `customer.subscription.deleted` ever arrives.
//   Nothing alarms: the state is indistinguishable from a paying customer whose
//   card bounced.
//
// So `missing_payment_method: 'cancel'` is tested first, on its own, before
// anything else in the file — if only one test here survives a refactor, it
// should be that one.
//
// The second concern is the webhook. This feature is designed to change ZERO
// lines of webhookHandlers.ts, and the whole of that claim rests on our metadata
// carrying no `purpose` key (a `purpose` makes handleCheckoutSessionCompleted
// early-return at :358 and the subscription never syncs). That is a property of
// data, not of code, so it is asserted rather than trusted.
//
// The third is the SQL/TS lockstep. TOUR_STEPS in lib/tour/steps.ts and the
// `step_key` CHECK in the migration are two halves of one list, and a drift
// between them fails quietly in both directions. The migration's source text is
// read here because there is no other place the two can be compared without a
// database.
// =============================================================================

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type Stripe from 'stripe'

import {
  TESTER_TRIAL_DAYS,
  TESTER_TRIAL_SESSION_FIELDS,
  TesterTrialUnsafeError,
  assertTrialCancels,
  withTesterTrial,
} from '@/lib/tour/trial'
import {
  REFLECTION_GATED_STEPS,
  REFLECTION_MIN_LENGTH,
  TOUR_STEPS,
  isReflectionGated,
  isSubstantiveReflection,
} from '@/lib/tour/steps'

// A checkout session shaped like the one create-checkout-session builds: same
// mode, same two metadata objects, no trial fields yet.
function baseParams(): Stripe.Checkout.SessionCreateParams {
  const metadata = {
    user_id: 'user_1',
    listing_id: 'listing_1',
    plan_id: 'plan_1',
    plan_slug: 'starter',
    billing_cycle: 'monthly',
  }
  return {
    mode: 'subscription',
    line_items: [{ price: 'price_starter_monthly', quantity: 1 }],
    customer_email: 'tester@example.test',
    success_url: 'https://example.test/success',
    cancel_url: 'https://example.test/cancel',
    metadata,
    subscription_data: { metadata },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRST, AND MOST IMPORTANT
// ─────────────────────────────────────────────────────────────────────────────

describe('the trial cancels itself', () => {
  it('sets missing_payment_method to cancel', () => {
    // The one line standing between a 30-day trial and a permanent free tier.
    expect(
      TESTER_TRIAL_SESSION_FIELDS.subscription_data?.trial_settings?.end_behavior
        ?.missing_payment_method
    ).toBe('cancel')
  })

  it('does not collect a card, which is only safe because of the line above', () => {
    expect(TESTER_TRIAL_SESSION_FIELDS.payment_method_collection).toBe('if_required')
  })

  it('runs for 30 days', () => {
    expect(TESTER_TRIAL_SESSION_FIELDS.subscription_data?.trial_period_days).toBe(30)
    expect(TESTER_TRIAL_DAYS).toBe(30)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('TESTER_TRIAL_SESSION_FIELDS is frozen all the way down', () => {
  // Fluid Compute reuses a warm instance across concurrent requests. A mutation
  // of this shared object would change the trial for other testers' requests
  // and leave no trace. Frozen at every level turns that into a TypeError.
  it('cannot have its top level replaced', () => {
    expect(Object.isFrozen(TESTER_TRIAL_SESSION_FIELDS)).toBe(true)
    expect(() => {
      // @ts-expect-error — deliberately violating the readonly type at runtime
      TESTER_TRIAL_SESSION_FIELDS.payment_method_collection = 'always'
    }).toThrow(TypeError)
  })

  it('cannot have its nested end_behavior swapped', () => {
    const endBehavior = TESTER_TRIAL_SESSION_FIELDS.subscription_data?.trial_settings?.end_behavior
    expect(Object.isFrozen(endBehavior)).toBe(true)
    expect(() => {
      // @ts-expect-error — deliberately violating the readonly type at runtime
      endBehavior.missing_payment_method = 'create_invoice'
    }).toThrow(TypeError)
  })
})

describe('withTesterTrial', () => {
  it('applies all three trial fields', () => {
    const merged = withTesterTrial(baseParams())

    expect(merged.payment_method_collection).toBe('if_required')
    expect(merged.subscription_data?.trial_period_days).toBe(TESTER_TRIAL_DAYS)
    expect(
      merged.subscription_data?.trial_settings?.end_behavior?.missing_payment_method
    ).toBe('cancel')
  })

  it('keeps subscription_data.metadata, which a naive spread would drop', () => {
    // The bug this function exists to prevent: `{...params, ...FIELDS}` replaces
    // subscription_data wholesale, so the subscription arrives at the webhook
    // with no user_id and syncs to nobody.
    const merged = withTesterTrial(baseParams())

    expect(merged.subscription_data?.metadata).toMatchObject({
      user_id: 'user_1',
      listing_id: 'listing_1',
    })
  })

  it('leaves the caller’s params untouched', () => {
    const params = baseParams()
    withTesterTrial(params)

    expect(params.payment_method_collection).toBeUndefined()
    expect(params.subscription_data?.trial_period_days).toBeUndefined()
  })

  it('produces params that assertTrialCancels accepts', () => {
    expect(() => assertTrialCancels(withTesterTrial(baseParams()))).not.toThrow()
  })
})

describe('assertTrialCancels refuses before Stripe is called', () => {
  // Stands in for the route: assert, then create. Every case below must leave
  // createSession at zero calls — a check that runs after the network call has
  // already happened is not a check.
  function createTrialSession(params: Stripe.Checkout.SessionCreateParams, createSession: () => void) {
    assertTrialCancels(params)
    createSession()
  }

  function expectRefusal(mutate: (p: Stripe.Checkout.SessionCreateParams) => void, match: RegExp) {
    const createSession = vi.fn()
    const params = withTesterTrial(baseParams())
    mutate(params)

    expect(() => createTrialSession(params, createSession)).toThrow(TesterTrialUnsafeError)
    expect(() => createTrialSession(params, createSession)).toThrow(match)
    expect(createSession).not.toHaveBeenCalled()
  }

  it('refuses when the end behaviour is not cancel', () => {
    expectRefusal((p) => {
      p.subscription_data = {
        ...p.subscription_data,
        trial_settings: { end_behavior: { missing_payment_method: 'create_invoice' } },
      }
    }, /past_due/)
  })

  it('refuses when the trial settings are missing entirely', () => {
    expectRefusal((p) => {
      p.subscription_data = { metadata: p.subscription_data?.metadata, trial_period_days: 30 }
    }, /missing_payment_method/)
  })

  it('refuses when a card would be collected', () => {
    expectRefusal((p) => {
      p.payment_method_collection = 'always'
    }, /payment_method_collection/)
  })

  it('refuses a wrong trial length', () => {
    expectRefusal((p) => {
      p.subscription_data = { ...p.subscription_data, trial_period_days: 300 }
    }, /trial_period_days/)
  })

  it('refuses a non-subscription mode', () => {
    expectRefusal((p) => {
      p.mode = 'payment'
    }, /expected "subscription"/)
  })

  it('refuses when subscription_data is absent, so no trial would exist at all', () => {
    expectRefusal((p) => {
      delete p.subscription_data
    }, /subscription_data is missing/)
  })

  it('lets a correct session through and calls Stripe exactly once', () => {
    const createSession = vi.fn()
    createTrialSession(withTesterTrial(baseParams()), createSession)

    expect(createSession).toHaveBeenCalledTimes(1)
  })
})

describe('the metadata carries no purpose', () => {
  // This is what keeps webhookHandlers.ts at zero lines changed: with no
  // `purpose`, handleCheckoutSessionCompleted does not take its early return at
  // :358, so the session falls through to the ordinary subscription path and
  // handleSubscriptionUpsert re-resolves the tier from the live price.
  it('is absent from both metadata objects on a built session', () => {
    const merged = withTesterTrial(baseParams())

    expect(merged.metadata && 'purpose' in merged.metadata).toBe(false)
    expect(merged.subscription_data?.metadata && 'purpose' in merged.subscription_data.metadata).toBe(
      false
    )
  })

  it('is refused if a caller ever adds one to the session metadata', () => {
    const params = withTesterTrial(baseParams())
    params.metadata = { ...params.metadata, purpose: 'job_posting' }

    expect(() => assertTrialCancels(params)).toThrow(/early-return/)
  })

  it('is refused if a caller ever adds one to the subscription metadata', () => {
    const params = withTesterTrial(baseParams())
    params.subscription_data = {
      ...params.subscription_data,
      metadata: { ...params.subscription_data?.metadata, purpose: 'job_posting' },
    }

    expect(() => assertTrialCancels(params)).toThrow(/subscription_data\.metadata/)
  })
})

describe('TOUR_STEPS and the migration stay in lockstep', () => {
  const migration = readFileSync(
    path.resolve(process.cwd(), 'supabase/migrations/20260830000000_tester_tour.sql'),
    'utf8'
  )

  it('the step_key CHECK lists exactly the steps TypeScript knows about', () => {
    // A step added to TS only is silently unrecordable (the INSERT fails the
    // CHECK); a step added to SQL only is permanently unreachable. Both are
    // quiet failures, which is why they are compared here rather than left to
    // be noticed in production.
    const check = /step_key\s+text\s+NOT NULL\s+CHECK\s*\(\s*step_key IN \(([\s\S]*?)\)\s*\)/.exec(
      migration
    )
    expect(check).not.toBeNull()

    const sqlSteps = Array.from(check?.[1]?.matchAll(/'([a-z_]+)'/g) ?? [], (m) => m[1])

    expect(sqlSteps).toEqual([...TOUR_STEPS])
  })

  it('the database enforces the same reflection floor the rail advertises', () => {
    // Trimmed on the SQL side, so isSubstantiveReflection must trim too or the
    // three layers disagree and a reflection the rail accepted is rejected by
    // the database as a 500.
    expect(migration).toContain(`char_length(btrim(reflection)) >= ${REFLECTION_MIN_LENGTH}`)
  })
})

describe('reflection gating', () => {
  it('gates four of the six steps', () => {
    expect(REFLECTION_GATED_STEPS).toHaveLength(4)
    expect([...REFLECTION_GATED_STEPS].every((step) => TOUR_STEPS.includes(step))).toBe(true)
  })

  it('leaves the two passive steps as un-gated progress ticks', () => {
    // Asking for twenty considered characters about "you loaded a collection
    // page" is the step a tester abandons on, and abandonment costs the whole
    // walk rather than one answer.
    expect(isReflectionGated('listing_opened')).toBe(false)
    expect(isReflectionGated('collection_browsed')).toBe(false)
    expect(isReflectionGated('final_reflection')).toBe(true)
  })

  it('does not count whitespace toward the floor', () => {
    expect(isSubstantiveReflection(' '.repeat(REFLECTION_MIN_LENGTH + 5))).toBe(false)
    expect(isSubstantiveReflection('x'.repeat(REFLECTION_MIN_LENGTH - 1))).toBe(false)
    expect(isSubstantiveReflection(`  ${'x'.repeat(REFLECTION_MIN_LENGTH)}  `)).toBe(true)
  })
})
