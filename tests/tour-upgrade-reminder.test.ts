import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type Stripe from 'stripe'

const h = vi.hoisted(() => ({
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/email/resend', () => ({ sendEmail: h.sendEmail }))

import { sendFreeMonthReminders, REMINDER_LEAD_DAYS } from '@/lib/tour/upgradeReminder'
import {
  FreeMonthEndingEmail,
  freeMonthEndingSubject,
} from '@/lib/email/templates/free-month-ending'
import type { StripeLike } from '@/lib/tour/upgrade'

// Ticket 136: one reminder five days before the free month on a bigger plan
// ends. At most once; never to a tester who asked to end the plan.

const NOW = new Date('2026-11-14T08:00:00Z')
const NOW_SEC = NOW.getTime() / 1000
const DAY = 86_400
const ENDS = NOW_SEC + 4 * DAY

function schedule(over: Partial<Stripe.SubscriptionSchedule> = {}): Stripe.SubscriptionSchedule {
  return {
    id: 'sub_sched_1',
    status: 'active',
    end_behavior: 'release',
    metadata: {
      tour_phases: 'set',
      upgrade_tier: 'growth',
      return_tier: 'starter',
      return_price_id: 'price_starter_monthly',
    },
    phases: [
      {
        start_date: ENDS - 30 * DAY,
        end_date: ENDS,
        trial_end: ENDS,
        items: [{ price: 'price_growth_monthly', quantity: 1 }],
        metadata: { plan_slug: 'growth' },
      },
    ],
    ...over,
  } as unknown as Stripe.SubscriptionSchedule
}

interface State {
  missing: { id: string; stripe_subscription_schedule_id: string }[]
  due: { id: string; tester_user_id: string; stripe_subscription_schedule_id: string }[]
  stampRows: number
  email: string | null
  readError: boolean
  writes: { values: Record<string, unknown>; filters: [string, string, unknown][] }[]
  dueFilters: [string, string, unknown][]
}

let state: State

function fakeService() {
  const from = () => {
    const filters: [string, string, unknown][] = []
    let values: Record<string, unknown> | null = null
    let selected = false
    const add = (op: string) => (col: string, a: unknown, b?: unknown) => {
      filters.push([op, col, b === undefined ? a : b])
      return builder
    }
    const builder = {
      select: () => {
        selected = true
        return builder
      },
      update: (v: Record<string, unknown>) => {
        values = v
        return builder
      },
      eq: add('eq'),
      is: add('is'),
      not: add('not'),
      gt: add('gt'),
      lte: add('lte'),
      order: () => builder,
      limit: () => builder,
      then: (resolve: (r: unknown) => void) => {
        if (state.readError && !values) return resolve({ data: null, error: { message: 'down' } })
        if (values) {
          state.writes.push({ values, filters: [...filters] })
          const n = 'upgrade_reminder_sent_at' in values ? state.stampRows : 1
          return resolve({
            data: selected ? Array.from({ length: n }, () => ({ id: 'x' })) : null,
            error: null,
          })
        }
        const isMissing = filters.some((f) => f[0] === 'is' && f[1] === 'upgrade_trial_ends_at')
        if (isMissing) return resolve({ data: state.missing, error: null })
        state.dueFilters = [...filters]
        return resolve({ data: state.due, error: null })
      },
    }
    return builder
  }
  return {
    from,
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: state.email ? { email: state.email } : null } }),
      },
    },
  } as never
}

const retrieve = vi.fn()
const stripe = { subscriptionSchedules: { retrieve } } as unknown as StripeLike

const run = () => sendFreeMonthReminders(fakeService(), stripe, NOW)

beforeEach(() => {
  h.sendEmail.mockReset().mockResolvedValue(undefined)
  retrieve.mockReset().mockResolvedValue(schedule())
  state = {
    missing: [],
    due: [{ id: 'enr-1', tester_user_id: 'u1', stripe_subscription_schedule_id: 'sub_sched_1' }],
    stampRows: 1,
    email: 'tester@example.com',
    readError: false,
    writes: [],
    dueFilters: [],
  }
})

describe('sendFreeMonthReminders', () => {
  it('reads months ending in the next five days that have not been reminded', async () => {
    await run()
    expect(REMINDER_LEAD_DAYS).toBe(5)
    expect(state.dueFilters).toEqual(
      expect.arrayContaining([
        ['is', 'upgrade_reminder_sent_at', null],
        ['gt', 'upgrade_trial_ends_at', NOW.toISOString()],
        ['lte', 'upgrade_trial_ends_at', new Date(NOW.getTime() + 5 * DAY * 1000).toISOString()],
      ])
    )
  })

  it('stamps first, then sends the founder’s copy once', async () => {
    const r = await run()
    expect(r).toEqual({ backfilled: 0, sent: 1, skipped: 0, failed: 0 })
    const stamp = state.writes.find((w) => 'upgrade_reminder_sent_at' in w.values)!
    expect(stamp.filters).toEqual([
      ['eq', 'id', 'enr-1'],
      ['is', 'upgrade_reminder_sent_at', null],
    ])
    const sent = h.sendEmail.mock.calls[0]![0]
    expect(sent.to).toBe('tester@example.com')
    expect(sent.subject).toBe('Your free Growth month ends soon')
    const html = renderToStaticMarkup(sent.react)
    expect(html).toContain('Your free Growth month ends on November 18, 2026.')
    expect(html).toContain(
      'You&#x27;ll go back to Starter at $19/month. Nothing to do if that&#x27;s what you want.'
    )
  })

  it('does not send when another run already stamped the row', async () => {
    state.stampRows = 0
    const r = await run()
    expect(r.sent).toBe(0)
    expect(r.skipped).toBe(1)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('does not remind a tester who asked to end the plan', async () => {
    retrieve.mockResolvedValue(schedule({ end_behavior: 'cancel' }))
    const r = await run()
    expect(r.skipped).toBe(1)
    expect(state.writes).toEqual([])
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it.each([
    ['a schedule with no marker', schedule({ metadata: {} })],
    ['a released schedule', schedule({ status: 'released' })],
  ])('skips %s', async (_label, s) => {
    retrieve.mockResolvedValue(s)
    const r = await run()
    expect(r.skipped).toBe(1)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('counts a send failure after the stamp and does not retry it', async () => {
    h.sendEmail.mockRejectedValue(new Error('resend down'))
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await run()
    expect(r).toMatchObject({ sent: 0, failed: 1 })
    expect(state.writes.some((w) => 'upgrade_reminder_sent_at' in w.values)).toBe(true)
    errors.mockRestore()
  })

  it('counts a tester with no email as failed', async () => {
    state.email = null
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await run()
    expect(r).toMatchObject({ sent: 0, failed: 1 })
    errors.mockRestore()
  })

  it('backfills an end date the claim did not manage to write', async () => {
    state.missing = [{ id: 'enr-2', stripe_subscription_schedule_id: 'sub_sched_2' }]
    state.due = []
    const r = await run()
    expect(r.backfilled).toBe(1)
    expect(state.writes[0]!.values).toEqual({
      upgrade_trial_ends_at: new Date(ENDS * 1000).toISOString(),
    })
  })

  it('throws when the reads fail, so the cron reports it', async () => {
    state.readError = true
    await expect(run()).rejects.toThrow('free-month backfill read failed')
  })
})

describe('FreeMonthEndingEmail', () => {
  it('says the date, the plan they go back to, and how to end it instead', () => {
    const html = renderToStaticMarkup(
      createElement(FreeMonthEndingEmail, {
        tierName: 'Premium',
        returnTierName: 'Growth',
        returnPrice: 49,
        endsOn: 'December 1, 2026',
      })
    )
    expect(freeMonthEndingSubject('Premium')).toBe('Your free Premium month ends soon')
    expect(html).toContain('Your free Premium month ends on December 1, 2026.')
    expect(html).toContain('back to Growth at $49/month')
    expect(html).toContain('before December 1, 2026. You won&#x27;t be charged.')
    expect(html).toContain('href="https://theblacqlist.com/dashboard/upgrade#free-month"')
    expect(html).not.toContain('—')
  })
})
