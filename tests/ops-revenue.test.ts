import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  UNKNOWN,
  billingCycleOf,
  excludedUserIds,
  monthlyValue,
  subscriptionSummary,
  sumMonthly,
  type SummaryRow,
} from '../lib/ops/revenue'

const START = '2026-11-01T00:00:00Z'
const plusDays = (n: number) => new Date(Date.parse(START) + n * 86_400_000).toISOString()
const period = (days: number) => ({
  current_period_start: START,
  current_period_end: plusDays(days),
})

const row = (over: Partial<SummaryRow> = {}): SummaryRow => ({
  user_id: 'u1',
  status: 'active',
  plan_key: 'starter',
  price_monthly: 19,
  price_yearly: 182,
  ...period(30),
  ...over,
})
const yearly = (over: Partial<SummaryRow> = {}) => row({ ...period(365), ...over })
const growth = { plan_key: 'growth', price_monthly: 49, price_yearly: 470 }

describe('billingCycleOf', () => {
  it.each([
    [28, 'monthly'],
    [31, 'monthly'],
    [62, 'monthly'],
    [63, null],
    [100, null],
    [299, null],
    [300, 'annual'],
    [365, 'annual'],
    [366, 'annual'],
    [0, null],
    [-30, null],
  ] as const)('reads a %i-day period as %s', (days, cycle) => {
    expect(billingCycleOf(period(days))).toBe(cycle)
  })

  it('does not guess when a date is missing or unreadable', () => {
    expect(billingCycleOf({ current_period_start: null, current_period_end: START })).toBeNull()
    expect(billingCycleOf({ current_period_start: START, current_period_end: null })).toBeNull()
    expect(billingCycleOf({ current_period_start: 'x', current_period_end: START })).toBeNull()
  })
})

describe('monthly money', () => {
  it('counts a yearly plan as its yearly price / 12, not the monthly price', () => {
    expect(sumMonthly([yearly()])).toBe(15.17)
    expect(monthlyValue(yearly())).toBeCloseTo(182 / 12, 10)
  })

  it('rounds once, after adding', () => {
    expect(sumMonthly([yearly(), yearly()])).toBe(30.33)
  })

  it('adds monthly and yearly plans', () => {
    expect(sumMonthly([row(), yearly(), yearly(growth)])).toBe(73.33)
  })

  it('is 0 with no plans', () => {
    expect(sumMonthly([])).toBe(0)
  })

  it('is UNKNOWN, never a guess, when one cycle or price is missing', () => {
    expect(sumMonthly([row(), row({ current_period_end: null })])).toBe(UNKNOWN)
    expect(sumMonthly([row(), row(period(100))])).toBe(UNKNOWN)
    expect(sumMonthly([row({ price_monthly: null })])).toBe(UNKNOWN)
    expect(sumMonthly([yearly({ price_yearly: null })])).toBe(UNKNOWN)
  })

  it('needs only the price its own cycle uses', () => {
    expect(sumMonthly([row({ price_yearly: null })])).toBe(19)
  })
})

describe('excludedUserIds', () => {
  it('leaves out testers, the team and tester_link sign-ups', () => {
    const ids = excludedUserIds({
      tours: [{ tester_user_id: 'tour' }, { tester_user_id: null }],
      invites: [{ tester_user_id: 'invite' }],
      roles: [{ user_id: 'admin' }],
      users: [
        { id: 'linked', user_metadata: { signup_source: 'tester_link' } },
        { id: 'real', user_metadata: { signup_source: 'flyer' } },
        { id: 'plain', user_metadata: null },
      ],
    })
    expect([...ids].sort()).toEqual(['admin', 'invite', 'linked', 'tour'])
  })
})

describe('subscriptionSummary', () => {
  const none = new Set<string>()

  it('counts active and past due across all paid plans, and shows the past due part', () => {
    const out = subscriptionSummary(
      [row(), yearly({ status: 'past_due' }), row(growth), row({ ...growth, status: 'past_due' })],
      none
    )
    expect(out.mrr_usd).toBe(132.17)
    expect(out.mrr_past_due_usd).toBe(64.17)
    expect(out).toMatchObject({ paying_monthly: 3, paying_annual: 1, paying_cycle_unknown: 0 })
    expect(out.byStatus).toEqual({ active: 2, past_due: 2 })
  })

  it('does not count trials, canceled, unfinished or Free', () => {
    const out = subscriptionSummary(
      [
        row({ status: 'trialing' }),
        row({ status: 'canceled' }),
        row({ status: 'incomplete' }),
        row({ plan_key: 'free', current_period_start: null, current_period_end: null }),
      ],
      none
    )
    expect(out.mrr_usd).toBe(0)
    expect(out.paying_monthly + out.paying_annual + out.paying_cycle_unknown).toBe(0)
  })

  it('leaves out testers and the team from every number', () => {
    const out = subscriptionSummary(
      [row(), yearly({ user_id: 'tester', status: 'past_due' })],
      new Set(['tester'])
    )
    expect(out.mrr_usd).toBe(19)
    expect(out.mrr_past_due_usd).toBe(0)
    expect(out.byStatus).toEqual({ active: 1 })
    expect(out.left_out_tester_team).toBe(1)
  })

  it('is UNKNOWN when a plan cannot be resolved', () => {
    const lost = row({ plan_key: null, price_monthly: null, price_yearly: null })
    expect(subscriptionSummary([row(), lost], none).mrr_usd).toBe(UNKNOWN)
  })

  it('counts the rows whose cycle is not known', () => {
    const out = subscriptionSummary([row(), row(period(100))], none)
    expect(out.mrr_usd).toBe(UNKNOWN)
    expect(out.paying_cycle_unknown).toBe(1)
  })
})

describe('both reports use this rule', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

  it('metrics-pull filters sign-ups, subscriptions and named events', () => {
    const src = read('scripts/ops/metrics-pull.ts')
    expect(src).toContain("from '../../lib/ops/revenue'")
    expect(src).toContain('...subscriptionSummary(rows, out)')
    expect(src).toContain("base().in('id', ids), needExcluded(excluded)")
    expect(src).toContain("base().in('user_id', ids), out")
  })

  it.each(['scripts/ops/metrics-pull.ts', 'scripts/ops/weekly-kpis.ts'])(
    '%s reads the yearly price and the billing period',
    (p) => {
      const src = read(p)
      expect(src).toContain('excludedUserIds({ tours, invites, roles, users })')
      expect(src).toContain('price_yearly')
      expect(src).toMatch(/current_period_start, current_period_end/)
    }
  )
})
