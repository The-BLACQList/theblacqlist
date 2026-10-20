/**
 * Ticket 136: run the free month on a paid plan through a Stripe test clock,
 * using the real code in lib/tour/upgrade.ts.
 *
 * Three testers on Starter ($19/month), each on the same clock:
 *
 *   A. The first try fails before Stripe sets the phases. The month is not
 *      spent; the next click finishes the same schedule; a third click
 *      changes nothing. Then days 0, 29, 31 and 62 of the free month.
 *   B. Stripe sets the phases but the answer is lost. The claim still counts.
 *   C. Ends the plan mid-month, undoes it, ends it again. Nothing is charged
 *      after the claim and the plan ends on day 30.
 *
 * It makes its own throwaway product and prices, deletes the clock (and the
 * customers on it) at the end, and archives the product. The database is an
 * in-memory stand-in for the two tables the code touches.
 *
 * Usage (TEST mode only; the script refuses a live key):
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe/free-month-upgrade-clock.ts
 *
 * Takes a few minutes: each clock advance waits for Stripe.
 */
import Stripe from 'stripe'
import {
  findUpgradeTarget,
  freeMonthEnd,
  isMarked,
  isRefusal,
  putFreeMonthOn,
  setEndOfFreeMonth,
  upgradeStatus,
  type StripeLike,
  type UpgradeTarget,
} from '@/lib/tour/upgrade'

const KEY = process.env['STRIPE_SECRET_KEY'] ?? ''
if (!/^(sk|rk)_test_/.test(KEY)) {
  console.error(
    'Error: set STRIPE_SECRET_KEY to a TEST key (sk_test_ or rk_test_). Live keys are refused.'
  )
  process.exit(1)
}

const stripe = new Stripe(KEY, { apiVersion: '2026-04-22.dahlia', typescript: true })
const DAY = 86_400
let failures = 0

function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`)
}

// ── An in-memory stand-in for `plans` and `tour_enrollments` ──────────────

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = { plans: [], tour_enrollments: [] }

function fakeService() {
  return {
    from(table: string) {
      const filters: ((r: Row) => boolean)[] = []
      let patch: Row | null = null
      let returning = false
      const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)))
      const run = () => {
        const hit = rows()
        if (patch) for (const r of hit) Object.assign(r, patch)
        return { data: patch && !returning ? null : hit.map((r) => ({ ...r })), error: null }
      }
      const q = {
        select: () => {
          if (patch) returning = true
          return q
        },
        update: (v: Row) => {
          patch = v
          return q
        },
        eq: (col: string, val: unknown) => {
          filters.push((r) => r[col] === val)
          return q
        },
        is: (col: string, val: null) => {
          filters.push((r) => (r[col] ?? null) === val)
          return q
        },
        maybeSingle: async () => {
          const { data } = run()
          return { data: data?.[0] ?? null, error: null }
        },
        then: (resolve: (r: unknown) => void) => resolve(run()),
      }
      return q
    },
  } as never
}

// ── Stripe wrappers that fail the way a network does ──────────────────────

/** The update never reaches Stripe. */
function failingBeforeUpdate(): StripeLike {
  return {
    subscriptions: stripe.subscriptions,
    subscriptionSchedules: Object.assign(Object.create(stripe.subscriptionSchedules), {
      update: async () => {
        throw new Error('simulated: connection reset before the request was sent')
      },
    }),
  }
}

/** The update lands, but the answer is lost on the way back. */
function losingTheAnswer(): StripeLike {
  return {
    subscriptions: stripe.subscriptions,
    subscriptionSchedules: Object.assign(Object.create(stripe.subscriptionSchedules), {
      update: async (...args: Parameters<Stripe['subscriptionSchedules']['update']>) => {
        await stripe.subscriptionSchedules.update(...args)
        throw new Error('simulated: timed out waiting for the answer')
      },
    }),
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const product = await stripe.products.create({
    name: 'Clock test: free month on a paid plan (ticket 136)',
  })
  const starter = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: 1900,
    recurring: { interval: 'month' },
  })
  const growth = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: 4900,
    recurring: { interval: 'month' },
  })
  tables.plans = [
    { id: 'plan-starter', plan_key: 'starter', stripe_price_id_monthly: starter.id },
    { id: 'plan-growth', plan_key: 'growth', stripe_price_id_monthly: growth.id },
  ]

  const T0 = Math.floor(Date.now() / 1000)
  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: T0, name: 'ticket 136' })

  async function advanceTo(sec: number) {
    await stripe.testHelpers.testClocks.advance(clock.id, { frozen_time: sec })
    for (;;) {
      const c = await stripe.testHelpers.testClocks.retrieve(clock.id)
      if (c.status === 'ready') return
      if (c.status === 'internal_failure') throw new Error('test clock failed')
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  interface Tester {
    name: string
    enrollmentId: string
    grantedAtIso: string
    customer: string
    subscription: string
  }

  async function makeTester(name: string): Promise<Tester> {
    const customer = await stripe.customers.create({
      test_clock: clock.id,
      name,
      payment_method: 'pm_card_visa',
    })
    const pm = (await stripe.paymentMethods.list({ customer: customer.id })).data[0]!
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: pm.id },
    })
    const sub = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: starter.id }],
      metadata: { user_id: `user-${name}`, listing_id: `listing-${name}`, plan_slug: 'starter' },
    })
    const enrollmentId = `enr-${name}`
    const grantedAtIso = new Date().toISOString()
    tables.tour_enrollments!.push({
      id: enrollmentId,
      trial_granted_at: grantedAtIso,
      stripe_subscription_schedule_id: null,
      upgrade_trial_ends_at: null,
    })
    return { name, enrollmentId, grantedAtIso, customer: customer.id, subscription: sub.id }
  }

  function enrollment(t: Tester): Row {
    return tables.tour_enrollments!.find((r) => r.id === t.enrollmentId)!
  }

  /** What the claim route does for this tester: the same order of checks. */
  async function claim(t: Tester, client: StripeLike) {
    const persisted = (enrollment(t).stripe_subscription_schedule_id as string | null) ?? null
    if (persisted !== null) {
      const known = await client.subscriptionSchedules.retrieve(persisted)
      if (isMarked(known)) return { ok: true as const, endsAt: freeMonthEnd(known) }
    }
    const target = await findUpgradeTarget(client, fakeService(), t.subscription, 'growth')
    if (isRefusal(target)) throw new Error(`refused: ${target.code}`)
    return putFreeMonthOn(client, fakeService(), {
      enrollmentId: t.enrollmentId,
      grantedAtIso: t.grantedAtIso,
      userId: `user-${t.name}`,
      listingId: `listing-${t.name}`,
      target: target as UpgradeTarget,
      plan: { planId: 'plan-growth', priceId: growth.id },
      persistedScheduleId: persisted,
    })
  }

  async function snapshot(t: Tester) {
    const sub = await stripe.subscriptions.retrieve(t.subscription)
    const invoices = (await stripe.invoices.list({ subscription: t.subscription, limit: 20 })).data
    const schedules = (await stripe.subscriptionSchedules.list({ customer: t.customer, limit: 10 }))
      .data
    return {
      status: sub.status,
      price: sub.items.data[0]?.price.id === growth.id ? 'Growth' : 'Starter',
      invoices,
      schedules,
      paidAfter: (sec: number) =>
        invoices.filter((i) => i.created > sec).reduce((sum, i) => sum + (i.amount_paid ?? 0), 0),
      chargedGrowth: invoices.some((i) =>
        i.lines.data.some((l) => (l.amount ?? 0) > 0 && l.amount === 4900)
      ),
    }
  }

  let ok = true
  try {
    const a = await makeTester('a')
    const b = await makeTester('b')
    const c = await makeTester('c')

    // Ten days into their Starter month, all three use the free month.
    const CLAIM = T0 + 10 * DAY
    await advanceTo(CLAIM)

    // A: the first try fails before Stripe sets the phases.
    let threw = false
    try {
      await claim(a, failingBeforeUpdate())
    } catch {
      threw = true
    }
    let snapA = await snapshot(a)
    check('A: a failed try throws, so the route can answer 500', threw)
    check(
      'A: a failed try leaves Starter as it was',
      snapA.status === 'active' && snapA.price === 'Starter'
    )
    check(
      'A: the schedule id is kept for the next click',
      enrollment(a).stripe_subscription_schedule_id !== null
    )

    const retry = await claim(a, stripe)
    const third = await claim(a, stripe)
    snapA = await snapshot(a)
    check('A: the next click finishes the month', retry.ok === true)
    check('A: a third click changes nothing', third.ok === true)
    check('A: one schedule, not two', snapA.schedules.length === 1, `${snapA.schedules.length}`)
    check(
      'A, day 0: on Growth, trialing',
      snapA.status === 'trialing' && snapA.price === 'Growth',
      `${snapA.status} ${snapA.price}`
    )

    // B: the phases are set but the answer is lost.
    const lost = await claim(b, losingTheAnswer())
    const snapB = await snapshot(b)
    check('B: a lost answer still counts as the month on', lost.ok === true)
    check('B: on Growth, trialing', snapB.status === 'trialing' && snapB.price === 'Growth')
    check('B: one schedule', snapB.schedules.length === 1)

    // C: claims, then ends the plan mid-month.
    check('C: claim', (await claim(c, stripe)).ok === true)

    const scheduleA = await stripe.subscriptionSchedules.retrieve(
      enrollment(a).stripe_subscription_schedule_id as string
    )
    const endsAt = freeMonthEnd(scheduleA)
    check(
      'A: the month ends 30 days after the claim',
      endsAt !== null && Math.abs(endsAt - (CLAIM + 30 * DAY)) < 120,
      endsAt === null ? 'none' : `${((endsAt - CLAIM) / DAY).toFixed(2)} days`
    )
    check(
      'A: the end date was written on the enrollment',
      enrollment(a).upgrade_trial_ends_at !== null
    )

    // Day 15: C ends the plan, undoes it, ends it again.
    await advanceTo(CLAIM + 15 * DAY)
    const scheduleC = enrollment(c).stripe_subscription_schedule_id as string
    const now15 = CLAIM + 15 * DAY
    const end1 = await setEndOfFreeMonth(stripe, scheduleC, true, now15)
    const undo = await setEndOfFreeMonth(stripe, scheduleC, false, now15)
    const end2 = await setEndOfFreeMonth(stripe, scheduleC, true, now15)
    check('C: ending the plan says cancelling', !isRefusal(end1) && end1.cancelling)
    check(
      'C: undo puts Starter back after the month',
      !isRefusal(undo) && !undo.cancelling && undo.returnTier === 'starter'
    )
    check('C: ending it again sticks', !isRefusal(end2) && end2.cancelling)

    // Day 29: still free, still Growth, nothing charged since the claim.
    await advanceTo(CLAIM + 29 * DAY)
    for (const t of [a, b, c]) {
      const s = await snapshot(t)
      check(
        `${t.name.toUpperCase()}, day 29: still Growth, nothing charged`,
        s.price === 'Growth' && s.paidAfter(CLAIM) === 0,
        `${s.status} paid ${s.paidAfter(CLAIM)}`
      )
    }
    const statusA29 = upgradeStatus(
      await stripe.subscriptionSchedules.retrieve(scheduleA.id),
      CLAIM + 29 * DAY
    )
    check('A, day 29: the card reads the month as running', statusA29.running)

    // Day 31: A and B back on Starter at $19; C's plan ended with no charge.
    await advanceTo(CLAIM + 31 * DAY)
    for (const t of [a, b]) {
      const s = await snapshot(t)
      check(
        `${t.name.toUpperCase()}, day 31: back on Starter, active`,
        s.price === 'Starter' && s.status === 'active',
        `${s.status} ${s.price}`
      )
      check(
        `${t.name.toUpperCase()}, day 31: charged $19 once since the claim`,
        s.paidAfter(CLAIM) === 1900,
        `paid ${s.paidAfter(CLAIM)}`
      )
      check(`${t.name.toUpperCase()}: never charged for Growth`, !s.chargedGrowth)
    }
    const snapC = await snapshot(c)
    check('C, day 31: the plan ended', snapC.status === 'canceled', snapC.status)
    check(
      'C, day 31: nothing charged since the claim',
      snapC.paidAfter(CLAIM) === 0,
      `paid ${snapC.paidAfter(CLAIM)}`
    )

    // Day 62: the schedule let go; Starter carries on by itself.
    await advanceTo(CLAIM + 62 * DAY)
    const snapA62 = await snapshot(a)
    const finalA = await stripe.subscriptionSchedules.retrieve(scheduleA.id)
    check('A, day 62: schedule released', finalA.status === 'released', finalA.status)
    check(
      'A, day 62: still Starter, $19 twice since the claim',
      snapA62.price === 'Starter' && snapA62.paidAfter(CLAIM) === 3800,
      `paid ${snapA62.paidAfter(CLAIM)}`
    )
    check('A: never charged for Growth', !snapA62.chargedGrowth)
  } catch (err) {
    ok = false
    console.error('The run stopped early:', err instanceof Error ? err.message : err)
  } finally {
    await stripe.testHelpers.testClocks.del(clock.id)
    await stripe.prices.update(starter.id, { active: false })
    await stripe.prices.update(growth.id, { active: false })
    await stripe.products.update(product.id, { active: false })
    console.log('Cleaned up the clock, its customers, and the test product.')
  }

  if (!ok || failures > 0) {
    console.log(`\n${failures} check(s) failed.`)
    process.exit(1)
  }
  console.log('\nAll checks passed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
