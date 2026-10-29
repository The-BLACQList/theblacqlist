// The tester's free month on a page that already pays (ticket 136).
//
// [Decision — founder, 2026-10-20] A tester on Starter who uses their free
// month on Growth gets 30 days of Growth free. Starter billing pauses for
// those 30 days, with no proration, and comes back on day 31. Cancelling
// during the month ends the plan after day 30 with no charge. A reminder
// email goes out five days before the month ends.
//
// HOW. A Stripe subscription schedule on the existing subscription, with
// three phases:
//
//   1. the current Starter period, cut short at "now";
//   2. 30 days of the higher tier as a trial ($0);
//   3. one month of the old price, anchored to the phase start, then the
//      schedule releases and the subscription carries on as before.
//
// The webhook needs no change: it resolves the tier from the live price, and
// `trialing` keeps access, so the listing reads Growth for the 30 days and
// Starter after. The subscription's own metadata (user_id, listing_id) stays,
// which is what the webhook syncs on.
//
// ══ THE ONE THING THIS FILE EXISTS TO PREVENT ══
// A tester charged for the higher tier. A schedule that ends after the trial
// phase with `end_behavior: 'release'` leaves the subscription on Growth, and
// day 31 bills $49 to a tester who was promised Starter. `assertUpgradeSafe`
// throws before Stripe unless the last phase is the price they had.
//
// The same trap is why nothing here ever releases a schedule after asking
// Stripe to set its phases. If that call timed out, the phases may be set, and
// releasing would leave the subscription on a Growth trial with nothing to
// bring it back. A half-done claim is finished on the next click instead.
//
// ══ STRIPE FACTS THIS FILE LEANS ON (test-clock probe, 2026-10-20) ══
//   - `create({ from_subscription })` refuses `metadata`, so the claim marker
//     goes on in the update. A schedule with no marker is ours to finish, or
//     a pristine one (one phase, no metadata) we can adopt.
//   - The update response leaves out the past phase, so the trial phase is
//     the first one whose plan_slug is the upgrade tier.
//   - Idempotency keys last 24 hours, so the create key includes the claim's
//     timestamp: a claim released and taken again gets a fresh key.

import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlanSlug } from '@/lib/stripe/plans'
import {
  LIVE_STATUSES,
  TESTER_TRIAL_DAYS,
  TESTER_TRIAL_TIERS,
  type TesterTrialTier,
} from '@/lib/tour/trial'

/** Where the claim sends the tester once the month is on: no checkout to visit. */
export const FREE_MONTH_STARTED_URL = '/dashboard/upgrade?free_month=started#free-month'

/** The schedule metadata key that says the free-month phases are set. */
export const UPGRADE_MARKER = 'tour_phases'

const SUPPORT = 'support@theblacqlist.com'

/** A refusal the route turns into a JSON response. None of them spend the claim. */
export interface UpgradeRefusal {
  status: number
  error: string
  code: string
}

/** The existing subscription the free month goes on. */
export interface UpgradeTarget {
  subscriptionId: string
  currentPriceId: string
  currentTier: TesterTrialTier
  /** The tier the free month goes on: the one asked for, or the next one up. */
  tier: TesterTrialTier
  /** The schedule already on the subscription, if any. */
  scheduleId: string | null
}

/** The open plan for the tier the tester picked. */
export interface UpgradePlan {
  planId: string
  priceId: string
}

type Service = Pick<SupabaseClient, 'from'>
export type StripeLike = Pick<Stripe, 'subscriptions' | 'subscriptionSchedules'>

const TIER_ORDER: PlanSlug[] = ['free', ...TESTER_TRIAL_TIERS]

function rank(tier: PlanSlug): number {
  return TIER_ORDER.indexOf(tier)
}

/** The first paid tier above this one, or null on the top tier. */
export function nextTierUp(tier: PlanSlug): TesterTrialTier | null {
  return TESTER_TRIAL_TIERS.find((t) => rank(t) > rank(tier)) ?? null
}

/**
 * The listing's live subscriptions, by Stripe id. null when the read failed.
 * Zero means the ordinary checkout path; one means the upgrade path; more
 * than one is refused (it should not happen, and we can't tell which to use).
 */
export async function liveSubscriptionIds(
  service: Service,
  listingId: string
): Promise<string[] | null> {
  const { data, error } = await service
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('listing_id', listingId)
    .in('status', LIVE_STATUSES)
  if (error) return null
  return ((data ?? []) as { stripe_subscription_id: string | null }[]).map(
    (r) => r.stripe_subscription_id ?? ''
  )
}

export const MULTIPLE_PLANS: UpgradeRefusal = {
  status: 409,
  error: `This page has more than one plan, so your free month can’t go on it yet. Write to ${SUPPORT} and we’ll sort it out.`,
  code: 'MULTIPLE_PLANS',
}

const TOP_PLAN: UpgradeRefusal = {
  status: 422,
  error: 'You’re already on our top plan, so there’s no bigger plan to try.',
  code: 'TOP_PLAN',
}

const NOT_AN_UPGRADE: UpgradeRefusal = {
  status: 422,
  error: 'Your free month goes on a plan above the one you have.',
  code: 'NOT_AN_UPGRADE',
}

const PAST_DUE: UpgradeRefusal = {
  status: 409,
  error:
    'Your last payment didn’t go through. Update your card, and your free month will be ready.',
  code: 'PAYMENT_PAST_DUE',
}

const PLAN_TRIALING: UpgradeRefusal = {
  status: 409,
  error:
    'Your plan is in a free trial right now. Your free month can go on it once the trial ends.',
  code: 'PLAN_TRIALING',
}

const PLAN_ENDING: UpgradeRefusal = {
  status: 409,
  error:
    'Your plan is set to end, so your free month can’t go on it. Turn your plan back on first.',
  code: 'PLAN_ENDING',
}

const NOT_MONTHLY: UpgradeRefusal = {
  status: 409,
  error: `Your free month works on monthly plans. Write to ${SUPPORT} and we’ll set it up for you.`,
  code: 'NOT_MONTHLY',
}

export const PLAN_CHANGE_PENDING: UpgradeRefusal = {
  status: 409,
  error: `Your plan has a change waiting, so your free month can’t start yet. Write to ${SUPPORT} and we’ll help.`,
  code: 'PLAN_CHANGE_PENDING',
}

function priceId(price: string | { id: string } | null | undefined): string | null {
  if (!price) return null
  return typeof price === 'string' ? price : price.id
}

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null
  return typeof ref === 'string' ? ref : ref.id
}

/**
 * Check the one live subscription can take the free month, before the claim.
 *
 * Only a plain, active, monthly subscription on a lower tier qualifies. Every
 * refusal is something the tester can fix or we can fix by hand, and none of
 * them spends the month. The current tier comes from the live price matched
 * against `plans.stripe_price_id_monthly`; an annual price never matches,
 * which is how annual plans are refused. With no tier asked for, the month
 * goes on the next tier up.
 */
export async function findUpgradeTarget(
  stripe: StripeLike,
  service: Service,
  subscriptionId: string,
  requested: TesterTrialTier | null
): Promise<UpgradeTarget | UpgradeRefusal> {
  if (subscriptionId === '') return PLAN_CHANGE_PENDING
  const sub = await stripe.subscriptions.retrieve(subscriptionId)

  if (sub.status === 'past_due' || sub.status === 'unpaid') return PAST_DUE
  if (sub.status === 'trialing') return PLAN_TRIALING
  if (sub.status !== 'active') return MULTIPLE_PLANS
  if (sub.cancel_at_period_end || sub.cancel_at) return PLAN_ENDING

  const items = sub.items.data
  const item = items[0]
  const recurring = item?.price.recurring
  if (
    items.length !== 1 ||
    !item ||
    recurring?.interval !== 'month' ||
    recurring.interval_count !== 1
  ) {
    return NOT_MONTHLY
  }

  // Without these the webhook can't sync the subscription to the listing.
  if (!sub.metadata?.user_id || !sub.metadata?.listing_id) return PLAN_CHANGE_PENDING

  const { data: plan, error } = await service
    .from('plans')
    .select('plan_key')
    .eq('stripe_price_id_monthly', item.price.id)
    .maybeSingle()
  if (error) throw new Error(`plan lookup failed: ${error.message}`)
  const currentKey = (plan as { plan_key: string } | null)?.plan_key
  if (!currentKey || !(TESTER_TRIAL_TIERS as readonly string[]).includes(currentKey)) {
    return NOT_MONTHLY
  }
  const currentTier = currentKey as TesterTrialTier
  const tier = requested ?? nextTierUp(currentTier)
  if (tier === null) return TOP_PLAN
  if (rank(tier) <= rank(currentTier)) return NOT_AN_UPGRADE

  return {
    subscriptionId: sub.id,
    currentPriceId: item.price.id,
    currentTier,
    tier,
    scheduleId: idOf(sub.schedule),
  }
}

export function isRefusal(value: unknown): value is UpgradeRefusal {
  return typeof value === 'object' && value !== null && 'code' in value && 'status' in value
}

interface PhaseInput {
  enrollmentId: string
  userId: string
  listingId: string
  /** When the subscription's current phase started (the schedule's phase 0). */
  currentPhaseStart: number
  target: UpgradeTarget
  plan: UpgradePlan
  /** The plans row id of the price the tester goes back to. */
  returnPlanId: string | null
}

/**
 * The schedule update that puts the free month on. Pure, so the tests can
 * read exactly what Stripe is asked for.
 *
 * Phase metadata merges into the subscription's, so each phase carries the
 * same five keys the ordinary checkout writes. No `purpose` key, for the same
 * reason as lib/tour/trial.ts: the webhook must treat this as an ordinary
 * subscription.
 */
export function buildUpgradeParams(input: PhaseInput): Stripe.SubscriptionScheduleUpdateParams {
  const phaseMeta = (planId: string | null, slug: TesterTrialTier) => ({
    user_id: input.userId,
    listing_id: input.listingId,
    ...(planId ? { plan_id: planId } : {}),
    plan_slug: slug,
    billing_cycle: 'monthly',
  })

  return {
    end_behavior: 'release',
    proration_behavior: 'none',
    metadata: {
      tour_enrollment_id: input.enrollmentId,
      [UPGRADE_MARKER]: 'set',
      upgrade_tier: input.target.tier,
      return_tier: input.target.currentTier,
      return_price_id: input.target.currentPriceId,
    },
    phases: [
      {
        items: [{ price: input.target.currentPriceId, quantity: 1 }],
        start_date: input.currentPhaseStart,
        end_date: 'now',
      },
      {
        items: [{ price: input.plan.priceId, quantity: 1 }],
        trial: true,
        duration: { interval: 'day', interval_count: TESTER_TRIAL_DAYS },
        proration_behavior: 'none',
        metadata: phaseMeta(input.plan.planId, input.target.tier),
      },
      returnPhase(
        input.target.currentPriceId,
        phaseMeta(input.returnPlanId, input.target.currentTier)
      ),
    ],
  }
}

function returnPhase(
  price: string,
  metadata: Record<string, string>
): Stripe.SubscriptionScheduleUpdateParams.Phase {
  return {
    items: [{ price, quantity: 1 }],
    duration: { interval: 'month', interval_count: 1 },
    billing_cycle_anchor: 'phase_start',
    proration_behavior: 'none',
    metadata,
  }
}

export class UpgradeUnsafeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UpgradeUnsafeError'
  }
}

/**
 * Throw unless this update gives exactly 30 free days and then the old price.
 * Each branch is a way the tester ends up charged for the higher tier, or
 * never charged again.
 */
export function assertUpgradeSafe(
  params: Stripe.SubscriptionScheduleUpdateParams,
  returnPriceId: string
): void {
  const fail = (why: string): never => {
    throw new UpgradeUnsafeError(`Refusing to put the free month on: ${why}`)
  }
  const phases = params.phases ?? []
  const trial = phases.find((p) => p.trial === true)
  if (!trial) fail('no trial phase, so the higher tier would be charged')
  if (trial?.duration?.interval !== 'day' || trial.duration.interval_count !== TESTER_TRIAL_DAYS) {
    fail(`the trial phase is not ${TESTER_TRIAL_DAYS} days`)
  }
  if (trial?.proration_behavior !== 'none' || params.proration_behavior !== 'none') {
    fail('proration is on, so the tester would get a prorated bill')
  }
  if (params.end_behavior === 'release') {
    const last = phases[phases.length - 1]
    if (!last || last === trial || priceId(last.items?.[0]?.price) !== returnPriceId) {
      fail('the schedule releases without returning to the price the tester had')
    }
  } else if (params.end_behavior !== 'cancel') {
    fail(`end_behavior is "${String(params.end_behavior)}"`)
  }
  for (const p of phases) {
    if (p.metadata && 'purpose' in p.metadata) fail('a phase carries a "purpose" key')
  }
}

/** Whether the free-month phases are set on this schedule. */
export function isMarked(schedule: Stripe.SubscriptionSchedule): boolean {
  return schedule.metadata?.[UPGRADE_MARKER] === 'set'
}

/**
 * A schedule nobody has changed: one phase, no metadata, releasing at the end,
 * on the price the subscription has. Equivalent to no schedule at all, so the
 * claim can adopt it. This is what a create whose response was lost leaves.
 */
export function isPristine(schedule: Stripe.SubscriptionSchedule, currentPriceId: string): boolean {
  const live = schedule.status === 'active' || schedule.status === 'not_started'
  const noMeta = Object.keys(schedule.metadata ?? {}).length === 0
  const phase = schedule.phases[0]
  return (
    live &&
    noMeta &&
    schedule.end_behavior === 'release' &&
    schedule.phases.length === 1 &&
    phase !== undefined &&
    phase.items.length === 1 &&
    priceId(phase.items[0]?.price) === currentPriceId
  )
}

/** When the free month ends, from a marked schedule. null if the phase is gone. */
export function freeMonthEnd(schedule: Stripe.SubscriptionSchedule): number | null {
  const tier = schedule.metadata?.upgrade_tier
  const phase = schedule.phases.find((p) => p.metadata?.plan_slug === tier && p.trial_end !== null)
  return phase ? phase.end_date : null
}

export interface UpgradeInput {
  enrollmentId: string
  /** The claim's timestamp, exactly as stored. Every write is guarded on it. */
  grantedAtIso: string
  userId: string
  listingId: string
  target: UpgradeTarget
  plan: UpgradePlan
  /** The schedule id already on the enrollment, from an earlier attempt. */
  persistedScheduleId: string | null
}

export type UpgradeResult =
  | { ok: true; endsAt: number | null }
  | { ok: false; refusal: UpgradeRefusal }

/**
 * Put the free month on, or finish a claim an earlier request started.
 *
 * Runs only after the compare-and-set took the claim (or on a later click for
 * a claim already taken). Throws on a Stripe or database failure; the caller
 * decides what to give back. Steps, each safe to repeat:
 *
 *   1. Find or make the schedule: the one on the enrollment, else the
 *      subscription's own if it is ours or pristine, else a new one.
 *   2. Write its id on the enrollment, guarded to this claim.
 *   3. Set the phases, unless the marker says they are set.
 *   4. Record when the month ends (best effort; the sweep backfills it).
 */
export async function putFreeMonthOn(
  stripe: StripeLike,
  service: Service,
  input: UpgradeInput
): Promise<UpgradeResult> {
  let schedule: Stripe.SubscriptionSchedule | null = null

  if (input.persistedScheduleId !== null) {
    const known = await stripe.subscriptionSchedules.retrieve(input.persistedScheduleId)
    if (isMarked(known))
      return { ok: true, endsAt: await recordFreeMonthEnd(service, input.enrollmentId, known) }
    if (known.status === 'active' || known.status === 'not_started') {
      schedule = known
    } else {
      // A pristine schedule we never finished ran out on its own. Forget it
      // and start again from the subscription.
      await forgetSchedule(service, input, known.id)
    }
  }

  if (schedule === null) {
    if (input.target.scheduleId !== null) {
      const existing = await stripe.subscriptionSchedules.retrieve(input.target.scheduleId)
      const ours = existing.metadata?.tour_enrollment_id === input.enrollmentId
      if (!ours && !isPristine(existing, input.target.currentPriceId)) {
        return { ok: false, refusal: PLAN_CHANGE_PENDING }
      }
      schedule = existing
    } else {
      schedule = await stripe.subscriptionSchedules.create(
        { from_subscription: input.target.subscriptionId },
        { idempotencyKey: `tour-upgrade:${input.enrollmentId}:${input.grantedAtIso}` }
      )
    }
    await persistSchedule(service, input, schedule.id)
    if (isMarked(schedule))
      return { ok: true, endsAt: await recordFreeMonthEnd(service, input.enrollmentId, schedule) }
  }

  const start = schedule.phases[0]?.start_date ?? schedule.current_phase?.start_date
  if (typeof start !== 'number') throw new Error('schedule has no current phase')

  const returnPlanId = await planIdForPrice(service, input.target.currentPriceId)
  const params = buildUpgradeParams({
    enrollmentId: input.enrollmentId,
    userId: input.userId,
    listingId: input.listingId,
    currentPhaseStart: start,
    target: input.target,
    plan: input.plan,
    returnPlanId,
  })
  assertUpgradeSafe(params, input.target.currentPriceId)

  let updated: Stripe.SubscriptionSchedule
  try {
    updated = await stripe.subscriptionSchedules.update(schedule.id, params, {
      idempotencyKey: `tour-upgrade:${schedule.id}:${input.target.tier}`,
    })
  } catch (err) {
    // The call may have landed even though we got no answer. Look before
    // reporting a failure; never release here (see the header).
    const again = await stripe.subscriptionSchedules.retrieve(schedule.id)
    if (!isMarked(again)) throw err
    updated = again
  }
  return { ok: true, endsAt: await recordFreeMonthEnd(service, input.enrollmentId, updated) }
}

async function planIdForPrice(service: Service, price: string): Promise<string | null> {
  const { data } = await service
    .from('plans')
    .select('id')
    .eq('stripe_price_id_monthly', price)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

async function persistSchedule(service: Service, input: UpgradeInput, scheduleId: string) {
  if (input.persistedScheduleId === scheduleId) return
  const { data, error } = await service
    .from('tour_enrollments')
    .update({ stripe_subscription_schedule_id: scheduleId })
    .eq('id', input.enrollmentId)
    .eq('trial_granted_at', input.grantedAtIso)
    .is('stripe_subscription_schedule_id', null)
    .select('id')
  if (error || !data || data.length === 0) {
    throw new Error('could not record the schedule on the enrollment')
  }
}

async function forgetSchedule(service: Service, input: UpgradeInput, scheduleId: string) {
  const { error } = await service
    .from('tour_enrollments')
    .update({ stripe_subscription_schedule_id: null })
    .eq('id', input.enrollmentId)
    .eq('stripe_subscription_schedule_id', scheduleId)
    .is('upgrade_trial_ends_at', null)
  if (error) throw new Error('could not clear a finished schedule')
  input.persistedScheduleId = null
}

/** Write when the free month ends onto the enrollment. Best effort. */
export async function recordFreeMonthEnd(
  service: Service,
  enrollmentId: string,
  schedule: Stripe.SubscriptionSchedule
): Promise<number | null> {
  const end = freeMonthEnd(schedule)
  if (end === null) return null
  try {
    await service
      .from('tour_enrollments')
      .update({ upgrade_trial_ends_at: new Date(end * 1000).toISOString() })
      .eq('id', enrollmentId)
      .eq('stripe_subscription_schedule_id', schedule.id)
  } catch {
    // Best effort: the reminder sweep backfills a missing end date.
  }
  return end
}

/** What the card shows for a month put on an existing plan. */
export interface UpgradeStatus {
  tier: TesterTrialTier | null
  returnTier: TesterTrialTier | null
  /** Unix seconds; null once Stripe no longer lists the trial phase. */
  endsAt: number | null
  /** The tester asked to end the plan when the month ends. */
  cancelling: boolean
  /** The free month is still running. */
  running: boolean
}

function asTier(value: unknown): TesterTrialTier | null {
  return typeof value === 'string' && (TESTER_TRIAL_TIERS as readonly string[]).includes(value)
    ? (value as TesterTrialTier)
    : null
}

export function upgradeStatus(
  schedule: Stripe.SubscriptionSchedule,
  nowSec: number
): UpgradeStatus {
  const endsAt = freeMonthEnd(schedule)
  const running = schedule.status === 'active' && endsAt !== null && endsAt > nowSec
  return {
    tier: asTier(schedule.metadata?.upgrade_tier),
    returnTier: asTier(schedule.metadata?.return_tier),
    endsAt,
    cancelling: running && schedule.end_behavior === 'cancel',
    running,
  }
}

/**
 * End the plan when the free month ends (cancel: true), or undo that and go
 * back to the old price as planned (cancel: false). Only while the month is
 * running. Returns the new status, or a refusal.
 *
 * Cancelling keeps only the trial phase and sets `end_behavior: 'cancel'`, so
 * the subscription ends on day 30 without an invoice. Undoing puts the return
 * phase back exactly as the claim built it.
 */
export async function setEndOfFreeMonth(
  stripe: StripeLike,
  scheduleId: string,
  cancel: boolean,
  nowSec: number
): Promise<UpgradeStatus | UpgradeRefusal> {
  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId)
  const status = upgradeStatus(schedule, nowSec)
  if (!isMarked(schedule) || !status.running || !status.tier) {
    return { status: 409, error: 'Your free month has already ended.', code: 'FREE_MONTH_OVER' }
  }
  if (status.cancelling === cancel) return status

  const tier = status.tier
  const trial = schedule.phases.find((p) => p.metadata?.plan_slug === tier && p.trial_end !== null)
  const returnPrice = schedule.metadata?.return_price_id
  const trialPrice = priceId(trial?.items[0]?.price)
  if (!trial || !trialPrice || !returnPrice || !status.returnTier) {
    throw new Error('free-month schedule is missing its phases')
  }

  const trialPhase: Stripe.SubscriptionScheduleUpdateParams.Phase = {
    items: [{ price: trialPrice, quantity: 1 }],
    start_date: trial.start_date,
    end_date: trial.end_date,
    trial: true,
    proration_behavior: 'none',
    metadata: { ...(trial.metadata ?? {}) },
  }
  // The return phase's own keys when Stripe still lists it. Once a cancel
  // dropped it, the trial's keys stand in, minus the trial tier's plan_id.
  const back = schedule.phases.find((p) => p.start_date >= trial.end_date)
  const { plan_id: _trialPlanId, ...trialKeys } = trial.metadata ?? {}
  const backKeys = back?.metadata ?? trialKeys
  const params: Stripe.SubscriptionScheduleUpdateParams = cancel
    ? { end_behavior: 'cancel', proration_behavior: 'none', phases: [trialPhase] }
    : {
        end_behavior: 'release',
        proration_behavior: 'none',
        phases: [
          trialPhase,
          returnPhase(returnPrice, { ...backKeys, plan_slug: status.returnTier }),
        ],
      }
  if (!cancel) assertTrialPhaseThenReturn(params, returnPrice)

  const updated = await stripe.subscriptionSchedules.update(scheduleId, params)
  return upgradeStatus(updated, nowSec)
}

function assertTrialPhaseThenReturn(
  params: Stripe.SubscriptionScheduleUpdateParams,
  price: string
) {
  const last = params.phases?.[params.phases.length - 1]
  if (params.end_behavior !== 'release' || priceId(last?.items?.[0]?.price) !== price) {
    throw new UpgradeUnsafeError(
      'Refusing to undo a cancel: the plan would not go back to its price'
    )
  }
}

/** "November 19, 2026", in Eastern time, for the card and the reminder email. */
export function formatFreeMonthEnd(endsAtSec: number): string {
  return new Date(endsAtSec * 1000).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })
}
