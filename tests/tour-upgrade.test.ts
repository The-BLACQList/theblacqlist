import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

import {
  assertUpgradeSafe,
  buildUpgradeParams,
  findUpgradeTarget,
  formatFreeMonthEnd,
  freeMonthEnd,
  isPristine,
  isRefusal,
  nextTierUp,
  putFreeMonthOn,
  setEndOfFreeMonth,
  upgradeStatus,
  UpgradeUnsafeError,
  type StripeLike,
  type UpgradeInput,
  type UpgradeTarget,
} from '@/lib/tour/upgrade'

// Ticket 136: the tester's free month on a page that already pays. The one
// outcome these tests guard: no tester is ever charged for the higher tier.

const NOW = 1_792_000_000
const DAY = 86_400
const TRIAL_END = NOW + 30 * DAY

// ── fakes ──────────────────────────────────────────────────────────────────

interface Write {
  table: string
  values: Record<string, unknown>
  filters: [string, string, unknown][]
}

/** A chainable stand-in for the Supabase service client. */
function fakeService(opts: {
  planKey?: string | null
  planId?: string | null
  planError?: boolean
  updateRows?: number
}) {
  const writes: Write[] = []
  const from = (table: string) => {
    const filters: [string, string, unknown][] = []
    let values: Record<string, unknown> | null = null
    const builder = {
      select: () => builder,
      update: (v: Record<string, unknown>) => {
        values = v
        return builder
      },
      eq: (col: string, val: unknown) => {
        filters.push(['eq', col, val])
        return builder
      },
      is: (col: string, val: unknown) => {
        filters.push(['is', col, val])
        return builder
      },
      in: () => builder,
      maybeSingle: async () => {
        if (opts.planError) return { data: null, error: { message: 'down' } }
        const byPrice = filters.find((f) => f[1] === 'stripe_price_id_monthly')
        if (table === 'plans' && byPrice) {
          return {
            data: { plan_key: opts.planKey ?? null, id: opts.planId ?? null },
            error: null,
          }
        }
        return { data: null, error: null }
      },
      then: (resolve: (r: unknown) => void) => {
        if (values) writes.push({ table, values, filters: [...filters] })
        const n = opts.updateRows ?? 1
        resolve({ data: Array.from({ length: n }, () => ({ id: 'enr-1' })), error: null })
      },
    }
    return builder
  }
  return { service: { from } as never, writes }
}

function sub(over: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: 'sub_1',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    metadata: { user_id: 'u1', listing_id: 'l1' },
    schedule: null,
    items: {
      data: [
        {
          price: {
            id: 'price_starter_monthly',
            recurring: { interval: 'month', interval_count: 1 },
          },
        },
      ],
    },
    ...over,
  } as unknown as Stripe.Subscription
}

function stripeWith(subscription: Stripe.Subscription) {
  return {
    subscriptions: { retrieve: vi.fn().mockResolvedValue(subscription) },
    subscriptionSchedules: {
      retrieve: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
}

const asStripe = (s: ReturnType<typeof stripeWith>) => s as unknown as StripeLike

const target = (over: Partial<UpgradeTarget> = {}): UpgradeTarget => ({
  subscriptionId: 'sub_1',
  currentPriceId: 'price_starter_monthly',
  currentTier: 'starter',
  tier: 'growth',
  scheduleId: null,
  ...over,
})

function pristine(over: Partial<Stripe.SubscriptionSchedule> = {}): Stripe.SubscriptionSchedule {
  return {
    id: 'sub_sched_1',
    status: 'active',
    end_behavior: 'release',
    metadata: {},
    current_phase: { start_date: NOW - 10 * DAY, end_date: NOW + 20 * DAY },
    phases: [
      {
        start_date: NOW - 10 * DAY,
        end_date: NOW + 20 * DAY,
        trial_end: null,
        items: [{ price: 'price_starter_monthly', quantity: 1 }],
        metadata: {},
      },
    ],
    ...over,
  } as unknown as Stripe.SubscriptionSchedule
}

function marked(over: Partial<Stripe.SubscriptionSchedule> = {}): Stripe.SubscriptionSchedule {
  return {
    id: 'sub_sched_1',
    status: 'active',
    end_behavior: 'release',
    metadata: {
      tour_enrollment_id: 'enr-1',
      tour_phases: 'set',
      upgrade_tier: 'growth',
      return_tier: 'starter',
      return_price_id: 'price_starter_monthly',
    },
    current_phase: { start_date: NOW, end_date: TRIAL_END },
    phases: [
      {
        start_date: NOW,
        end_date: TRIAL_END,
        trial_end: TRIAL_END,
        items: [{ price: 'price_growth_monthly', quantity: 1 }],
        metadata: {
          user_id: 'u1',
          listing_id: 'l1',
          plan_id: 'plan-growth',
          plan_slug: 'growth',
          billing_cycle: 'monthly',
        },
      },
      {
        start_date: TRIAL_END,
        end_date: TRIAL_END + 30 * DAY,
        trial_end: null,
        items: [{ price: 'price_starter_monthly', quantity: 1 }],
        metadata: {
          user_id: 'u1',
          listing_id: 'l1',
          plan_id: 'plan-starter',
          plan_slug: 'starter',
          billing_cycle: 'monthly',
        },
      },
    ],
    ...over,
  } as unknown as Stripe.SubscriptionSchedule
}

const params = () =>
  buildUpgradeParams({
    enrollmentId: 'enr-1',
    userId: 'u1',
    listingId: 'l1',
    currentPhaseStart: NOW - 10 * DAY,
    target: target(),
    plan: { planId: 'plan-growth', priceId: 'price_growth_monthly' },
    returnPlanId: 'plan-starter',
  })

// ── nextTierUp ─────────────────────────────────────────────────────────────

describe('nextTierUp', () => {
  it('climbs one tier, and stops at the top', () => {
    expect(nextTierUp('free')).toBe('starter')
    expect(nextTierUp('starter')).toBe('growth')
    expect(nextTierUp('growth')).toBe('premium')
    expect(nextTierUp('premium')).toBeNull()
  })
})

// ── findUpgradeTarget ──────────────────────────────────────────────────────

describe('findUpgradeTarget', () => {
  const run = (
    s: Stripe.Subscription,
    requested: 'starter' | 'growth' | 'premium' | null,
    planKey = 'starter'
  ) =>
    findUpgradeTarget(asStripe(stripeWith(s)), fakeService({ planKey }).service, 'sub_1', requested)

  it('finds a plain monthly Starter plan and aims at the tier asked for', async () => {
    expect(await run(sub(), 'premium')).toEqual({
      subscriptionId: 'sub_1',
      currentPriceId: 'price_starter_monthly',
      currentTier: 'starter',
      tier: 'premium',
      scheduleId: null,
    })
  })

  it('aims at the next tier up when none is asked for', async () => {
    const t = await run(sub(), null)
    expect(isRefusal(t)).toBe(false)
    expect((t as UpgradeTarget).tier).toBe('growth')
  })

  it('carries the schedule already on the subscription', async () => {
    const t = await run(sub({ schedule: 'sub_sched_9' }), 'growth')
    expect((t as UpgradeTarget).scheduleId).toBe('sub_sched_9')
  })

  it.each([
    ['a payment past due', sub({ status: 'past_due' }), 'PAYMENT_PAST_DUE'],
    ['an unpaid plan', sub({ status: 'unpaid' }), 'PAYMENT_PAST_DUE'],
    ['a plan in its own trial', sub({ status: 'trialing' }), 'PLAN_TRIALING'],
    ['a plan set to end at period end', sub({ cancel_at_period_end: true }), 'PLAN_ENDING'],
    ['a plan with a cancel date', sub({ cancel_at: NOW + DAY }), 'PLAN_ENDING'],
    [
      'a plan with no listing metadata',
      sub({ metadata: { user_id: 'u1' } }),
      'PLAN_CHANGE_PENDING',
    ],
    [
      'an annual plan',
      sub({
        items: {
          data: [
            {
              price: {
                id: 'price_starter_annual',
                recurring: { interval: 'year', interval_count: 1 },
              },
            },
          ],
        } as never,
      }),
      'NOT_MONTHLY',
    ],
    [
      'a plan with two items',
      sub({
        items: {
          data: [
            { price: { id: 'a', recurring: { interval: 'month', interval_count: 1 } } },
            { price: { id: 'b', recurring: { interval: 'month', interval_count: 1 } } },
          ],
        } as never,
      }),
      'NOT_MONTHLY',
    ],
  ])('refuses %s', async (_label, s, code) => {
    const t = await run(s, 'growth')
    expect(isRefusal(t)).toBe(true)
    expect((t as { code: string }).code).toBe(code)
  })

  it('refuses a price no plan row knows (an old or annual price)', async () => {
    const t = await findUpgradeTarget(
      asStripe(stripeWith(sub())),
      fakeService({ planKey: null }).service,
      'sub_1',
      'growth'
    )
    expect((t as { code: string }).code).toBe('NOT_MONTHLY')
  })

  it('refuses the top plan, and a tier at or below the current one', async () => {
    expect(((await run(sub(), null, 'premium')) as { code: string }).code).toBe('TOP_PLAN')
    expect(((await run(sub(), 'starter')) as { code: string }).code).toBe('NOT_AN_UPGRADE')
    expect(((await run(sub(), 'growth', 'growth')) as { code: string }).code).toBe('NOT_AN_UPGRADE')
  })

  it('refuses a subscriptions row with no Stripe id without asking Stripe', async () => {
    const stripe = stripeWith(sub())
    const t = await findUpgradeTarget(asStripe(stripe), fakeService({}).service, '', 'growth')
    expect((t as { code: string }).code).toBe('PLAN_CHANGE_PENDING')
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
  })

  it('throws when the plan lookup fails, so the route answers 500 before any claim', async () => {
    await expect(
      findUpgradeTarget(
        asStripe(stripeWith(sub())),
        fakeService({ planError: true }).service,
        'sub_1',
        'growth'
      )
    ).rejects.toThrow('plan lookup failed')
  })
})

// ── buildUpgradeParams + assertUpgradeSafe ─────────────────────────────────

describe('buildUpgradeParams', () => {
  it('passes its own safety check', () => {
    expect(() => assertUpgradeSafe(params(), 'price_starter_monthly')).not.toThrow()
  })

  it('cuts the current period at now, gives 30 free days, then the old price for a month', () => {
    const p = params()
    expect(p.end_behavior).toBe('release')
    expect(p.proration_behavior).toBe('none')
    expect(p.phases).toHaveLength(3)
    const [now, trial, back] = p.phases!
    expect(now).toEqual({
      items: [{ price: 'price_starter_monthly', quantity: 1 }],
      start_date: NOW - 10 * DAY,
      end_date: 'now',
    })
    expect(trial!.trial).toBe(true)
    expect(trial!.duration).toEqual({ interval: 'day', interval_count: 30 })
    expect(trial!.items).toEqual([{ price: 'price_growth_monthly', quantity: 1 }])
    expect(back!.items).toEqual([{ price: 'price_starter_monthly', quantity: 1 }])
    expect(back!.billing_cycle_anchor).toBe('phase_start')
    expect(back!.duration).toEqual({ interval: 'month', interval_count: 1 })
  })

  it('writes the same five keys the checkout writes on each later phase, and the claim marker', () => {
    const p = params()
    expect(p.phases![1]!.metadata).toEqual({
      user_id: 'u1',
      listing_id: 'l1',
      plan_id: 'plan-growth',
      plan_slug: 'growth',
      billing_cycle: 'monthly',
    })
    expect(p.phases![2]!.metadata).toMatchObject({ plan_id: 'plan-starter', plan_slug: 'starter' })
    expect(p.metadata).toEqual({
      tour_enrollment_id: 'enr-1',
      tour_phases: 'set',
      upgrade_tier: 'growth',
      return_tier: 'starter',
      return_price_id: 'price_starter_monthly',
    })
  })

  it('leaves plan_id off when the plans row is unknown, rather than guessing', () => {
    const p = buildUpgradeParams({
      enrollmentId: 'enr-1',
      userId: 'u1',
      listingId: 'l1',
      currentPhaseStart: NOW,
      target: target(),
      plan: { planId: 'plan-growth', priceId: 'price_growth_monthly' },
      returnPlanId: null,
    })
    expect('plan_id' in (p.phases![2]!.metadata ?? {})).toBe(false)
  })
})

describe('assertUpgradeSafe', () => {
  const mutate = (fn: (p: Stripe.SubscriptionScheduleUpdateParams) => void) => {
    const p = params()
    fn(p)
    return () => assertUpgradeSafe(p, 'price_starter_monthly')
  }

  it.each([
    [
      'no trial phase',
      (p: Stripe.SubscriptionScheduleUpdateParams) => {
        delete p.phases![1]!.trial
      },
    ],
    [
      'a trial that is not 30 days',
      (p: Stripe.SubscriptionScheduleUpdateParams) => {
        p.phases![1]!.duration = { interval: 'day', interval_count: 31 }
      },
    ],
    [
      'a trial measured in months',
      (p: Stripe.SubscriptionScheduleUpdateParams) => {
        p.phases![1]!.duration = { interval: 'month', interval_count: 1 }
      },
    ],
    [
      'proration on the trial',
      (p: Stripe.SubscriptionScheduleUpdateParams) => {
        p.phases![1]!.proration_behavior = 'create_prorations'
      },
    ],
    [
      'proration on the schedule',
      (p: Stripe.SubscriptionScheduleUpdateParams) => {
        p.proration_behavior = 'always_invoice'
      },
    ],
    [
      'a release with no return phase',
      (p: Stripe.SubscriptionScheduleUpdateParams) => {
        p.phases!.pop()
      },
    ],
    [
      'a release onto the higher price',
      (p: Stripe.SubscriptionScheduleUpdateParams) => {
        p.phases![2]!.items = [{ price: 'price_growth_monthly', quantity: 1 }]
      },
    ],
    [
      'an end_behavior other than release or cancel',
      (p: Stripe.SubscriptionScheduleUpdateParams) => {
        p.end_behavior = 'renew' as never
      },
    ],
    [
      'a purpose key on a phase',
      (p: Stripe.SubscriptionScheduleUpdateParams) => {
        p.phases![1]!.metadata = { purpose: 'tester_trial' }
      },
    ],
  ])('refuses %s', (_label, fn) => {
    expect(mutate(fn)).toThrow(UpgradeUnsafeError)
  })
})

// ── schedule readers ───────────────────────────────────────────────────────

describe('isPristine', () => {
  it('accepts an untouched one-phase schedule on the current price', () => {
    expect(isPristine(pristine(), 'price_starter_monthly')).toBe(true)
  })

  it.each([
    ['metadata', pristine({ metadata: { note: 'x' } })],
    ['two phases', pristine({ phases: [...pristine().phases, ...pristine().phases] })],
    ['a cancel at the end', pristine({ end_behavior: 'cancel' })],
    ['a released schedule', pristine({ status: 'released' })],
  ])('rejects a schedule with %s', (_label, s) => {
    expect(isPristine(s, 'price_starter_monthly')).toBe(false)
  })

  it('rejects a schedule on another price', () => {
    expect(isPristine(pristine(), 'price_growth_monthly')).toBe(false)
  })
})

describe('freeMonthEnd and upgradeStatus', () => {
  it('reads the end of the trial phase', () => {
    expect(freeMonthEnd(marked())).toBe(TRIAL_END)
  })

  it('is null once Stripe stops listing the trial phase', () => {
    const s = marked({ phases: [marked().phases[1]!] })
    expect(freeMonthEnd(s)).toBeNull()
    expect(upgradeStatus(s, NOW).running).toBe(false)
  })

  it('reports a running month, then a finished one', () => {
    expect(upgradeStatus(marked(), NOW + DAY)).toEqual({
      tier: 'growth',
      returnTier: 'starter',
      endsAt: TRIAL_END,
      cancelling: false,
      running: true,
    })
    expect(upgradeStatus(marked(), TRIAL_END + 1).running).toBe(false)
  })

  it('reports a cancel only while the month runs', () => {
    const s = marked({ end_behavior: 'cancel' })
    expect(upgradeStatus(s, NOW).cancelling).toBe(true)
    expect(upgradeStatus(s, TRIAL_END + 1).cancelling).toBe(false)
  })

  it('ignores a tier name it does not know', () => {
    const s = marked({ metadata: { ...marked().metadata, upgrade_tier: 'enterprise' } })
    expect(upgradeStatus(s, NOW).tier).toBeNull()
  })
})

describe('formatFreeMonthEnd', () => {
  it('writes the date in Eastern time', () => {
    // 2026-11-20 03:00 UTC is still November 19 in New York.
    expect(formatFreeMonthEnd(Date.UTC(2026, 10, 20, 3) / 1000)).toBe('November 19, 2026')
  })
})

// ── putFreeMonthOn ─────────────────────────────────────────────────────────

describe('putFreeMonthOn', () => {
  const GRANTED = '2026-10-20T12:00:00.000Z'
  let stripe: ReturnType<typeof stripeWith>

  const input = (over: Partial<UpgradeInput> = {}): UpgradeInput => ({
    enrollmentId: 'enr-1',
    grantedAtIso: GRANTED,
    userId: 'u1',
    listingId: 'l1',
    target: target(),
    plan: { planId: 'plan-growth', priceId: 'price_growth_monthly' },
    persistedScheduleId: null,
    ...over,
  })

  beforeEach(() => {
    stripe = stripeWith(sub())
    stripe.subscriptionSchedules.create.mockResolvedValue(pristine())
    stripe.subscriptionSchedules.update.mockResolvedValue(marked())
    stripe.subscriptionSchedules.retrieve.mockResolvedValue(pristine())
  })

  it('makes a schedule, records it, sets the phases and the end date', async () => {
    const { service, writes } = fakeService({ planId: 'plan-starter' })
    const r = await putFreeMonthOn(asStripe(stripe), service, input())
    expect(r).toEqual({ ok: true, endsAt: TRIAL_END })
    expect(stripe.subscriptionSchedules.create).toHaveBeenCalledWith(
      { from_subscription: 'sub_1' },
      { idempotencyKey: `tour-upgrade:enr-1:${GRANTED}` }
    )
    expect(writes.map((w) => Object.keys(w.values)[0])).toEqual([
      'stripe_subscription_schedule_id',
      'upgrade_trial_ends_at',
    ])
    // The schedule write is guarded to this claim and to an empty slot.
    expect(writes[0]!.filters).toEqual([
      ['eq', 'id', 'enr-1'],
      ['eq', 'trial_granted_at', GRANTED],
      ['is', 'stripe_subscription_schedule_id', null],
    ])
    expect(writes[1]!.values.upgrade_trial_ends_at).toBe(new Date(TRIAL_END * 1000).toISOString())
  })

  it('stops before Stripe changes anything when the schedule cannot be recorded', async () => {
    const { service } = fakeService({ updateRows: 0 })
    await expect(putFreeMonthOn(asStripe(stripe), service, input())).rejects.toThrow(
      'could not record the schedule'
    )
    expect(stripe.subscriptionSchedules.update).not.toHaveBeenCalled()
  })

  it('does nothing more for a schedule already marked', async () => {
    stripe.subscriptionSchedules.retrieve.mockResolvedValue(marked())
    const { service } = fakeService({})
    const r = await putFreeMonthOn(
      asStripe(stripe),
      service,
      input({ persistedScheduleId: 'sub_sched_1' })
    )
    expect(r).toEqual({ ok: true, endsAt: TRIAL_END })
    expect(stripe.subscriptionSchedules.create).not.toHaveBeenCalled()
    expect(stripe.subscriptionSchedules.update).not.toHaveBeenCalled()
  })

  it('finishes a recorded schedule whose phases were never set', async () => {
    const { service, writes } = fakeService({})
    const r = await putFreeMonthOn(
      asStripe(stripe),
      service,
      input({ persistedScheduleId: 'sub_sched_1' })
    )
    expect(r.ok).toBe(true)
    expect(stripe.subscriptionSchedules.create).not.toHaveBeenCalled()
    expect(stripe.subscriptionSchedules.update).toHaveBeenCalledTimes(1)
    expect(writes.some((w) => 'stripe_subscription_schedule_id' in w.values)).toBe(false)
  })

  it('forgets a recorded schedule that ran out, and starts again', async () => {
    stripe.subscriptionSchedules.retrieve.mockResolvedValue(pristine({ status: 'released' }))
    const { service, writes } = fakeService({})
    const r = await putFreeMonthOn(
      asStripe(stripe),
      service,
      input({ persistedScheduleId: 'sub_sched_old' })
    )
    expect(r.ok).toBe(true)
    expect(writes[0]!.values).toEqual({ stripe_subscription_schedule_id: null })
    expect(stripe.subscriptionSchedules.create).toHaveBeenCalledTimes(1)
  })

  it('adopts a pristine schedule already on the subscription', async () => {
    const { service } = fakeService({})
    const r = await putFreeMonthOn(
      asStripe(stripe),
      service,
      input({ target: target({ scheduleId: 'sub_sched_1' }) })
    )
    expect(r.ok).toBe(true)
    expect(stripe.subscriptionSchedules.create).not.toHaveBeenCalled()
  })

  it('refuses a schedule someone else made, without touching it', async () => {
    stripe.subscriptionSchedules.retrieve.mockResolvedValue(
      pristine({ metadata: { note: 'downgrade at renewal' } })
    )
    const { service, writes } = fakeService({})
    const r = await putFreeMonthOn(
      asStripe(stripe),
      service,
      input({ target: target({ scheduleId: 'sub_sched_x' }) })
    )
    expect(r).toEqual({
      ok: false,
      refusal: expect.objectContaining({ code: 'PLAN_CHANGE_PENDING' }),
    })
    expect(writes).toEqual([])
    expect(stripe.subscriptionSchedules.update).not.toHaveBeenCalled()
  })

  it('takes a lost update answer as success once Stripe shows the marker', async () => {
    stripe.subscriptionSchedules.update.mockRejectedValue(new Error('timeout'))
    stripe.subscriptionSchedules.retrieve.mockResolvedValue(marked())
    const r = await putFreeMonthOn(asStripe(stripe), fakeService({}).service, input())
    expect(r).toEqual({ ok: true, endsAt: TRIAL_END })
  })

  it('throws on a failed update when Stripe shows no marker, never releasing', async () => {
    stripe.subscriptionSchedules.update.mockRejectedValue(new Error('timeout'))
    await expect(
      putFreeMonthOn(asStripe(stripe), fakeService({}).service, input())
    ).rejects.toThrow('timeout')
    expect(stripe.subscriptionSchedules).not.toHaveProperty('release')
  })
})

// ── setEndOfFreeMonth ──────────────────────────────────────────────────────

describe('setEndOfFreeMonth', () => {
  let stripe: ReturnType<typeof stripeWith>
  beforeEach(() => {
    stripe = stripeWith(sub())
  })

  it('cancel keeps only the trial phase and ends the plan with no invoice', async () => {
    stripe.subscriptionSchedules.retrieve.mockResolvedValue(marked())
    stripe.subscriptionSchedules.update.mockResolvedValue(
      marked({ end_behavior: 'cancel', phases: [marked().phases[0]!] })
    )
    const r = await setEndOfFreeMonth(asStripe(stripe), 'sub_sched_1', true, NOW + DAY)
    const [, p] = stripe.subscriptionSchedules.update.mock.calls[0]!
    expect(p.end_behavior).toBe('cancel')
    expect(p.proration_behavior).toBe('none')
    expect(p.phases).toHaveLength(1)
    expect(p.phases[0]).toMatchObject({
      items: [{ price: 'price_growth_monthly', quantity: 1 }],
      start_date: NOW,
      end_date: TRIAL_END,
      trial: true,
    })
    expect(r).toMatchObject({ cancelling: true, running: true })
  })

  it('undo puts the return phase back on the old price with its own keys', async () => {
    stripe.subscriptionSchedules.retrieve.mockResolvedValue(marked({ end_behavior: 'cancel' }))
    stripe.subscriptionSchedules.update.mockResolvedValue(marked())
    await setEndOfFreeMonth(asStripe(stripe), 'sub_sched_1', false, NOW + DAY)
    const [, p] = stripe.subscriptionSchedules.update.mock.calls[0]!
    expect(p.end_behavior).toBe('release')
    expect(p.phases).toHaveLength(2)
    expect(p.phases[1].items).toEqual([{ price: 'price_starter_monthly', quantity: 1 }])
    expect(p.phases[1].metadata).toMatchObject({ plan_id: 'plan-starter', plan_slug: 'starter' })
  })

  it('undo after a cancel dropped the return phase never carries the Growth plan_id', async () => {
    stripe.subscriptionSchedules.retrieve.mockResolvedValue(
      marked({ end_behavior: 'cancel', phases: [marked().phases[0]!] })
    )
    stripe.subscriptionSchedules.update.mockResolvedValue(marked())
    await setEndOfFreeMonth(asStripe(stripe), 'sub_sched_1', false, NOW + DAY)
    const [, p] = stripe.subscriptionSchedules.update.mock.calls[0]!
    expect(p.phases[1].metadata.plan_slug).toBe('starter')
    expect('plan_id' in p.phases[1].metadata).toBe(false)
    expect(p.phases[1].metadata).toMatchObject({ user_id: 'u1', listing_id: 'l1' })
  })

  it('changes nothing when the plan is already set the way asked', async () => {
    stripe.subscriptionSchedules.retrieve.mockResolvedValue(marked())
    const r = await setEndOfFreeMonth(asStripe(stripe), 'sub_sched_1', false, NOW + DAY)
    expect(stripe.subscriptionSchedules.update).not.toHaveBeenCalled()
    expect(r).toMatchObject({ cancelling: false, running: true })
  })

  it.each([
    ['after the month ended', marked(), TRIAL_END + 1],
    ['on a schedule with no marker', pristine(), NOW + DAY],
  ])('refuses %s', async (_label, s, now) => {
    stripe.subscriptionSchedules.retrieve.mockResolvedValue(s)
    const r = await setEndOfFreeMonth(asStripe(stripe), 'sub_sched_1', true, now)
    expect(r).toMatchObject({ status: 409, code: 'FREE_MONTH_OVER' })
    expect(stripe.subscriptionSchedules.update).not.toHaveBeenCalled()
  })
})
