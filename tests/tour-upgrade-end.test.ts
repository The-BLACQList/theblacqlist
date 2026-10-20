import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Ticket 136: ending the plan when the free month ends (the route), and what
// the upgrade page's card says while the month runs.

const h = vi.hoisted(() => ({
  viewer: null as null | {
    userId: string
    email: string | null
    enrollment: {
      id: string
      listingId: string | null
      isOwner: boolean | null
      completedAt: string | null
      trialGrantedAt: string | null
    }
  },
  owned: true as boolean | null,
  scheduleId: 'sub_sched_1' as string | null,
  readError: false,
  setEnd: vi.fn(),
  enrollmentFilters: [] as [string, unknown][],
}))

vi.mock('@/lib/tour/freeMonth', async (orig) => ({
  ...(await orig<typeof import('@/lib/tour/freeMonth')>()),
  resolveTrialClaimer: async () => h.viewer,
  listingIsOwnedBy: async () => h.owned,
}))

vi.mock('@/lib/tour/upgrade', async (orig) => ({
  ...(await orig<typeof import('@/lib/tour/upgrade')>()),
  setEndOfFreeMonth: h.setEnd,
}))

vi.mock('@/lib/stripe/client', () => ({ stripe: { subscriptionSchedules: {} } }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: () => ({
    from: () => {
      const q = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          h.enrollmentFilters.push([col, val])
          return q
        },
        maybeSingle: async () =>
          h.readError
            ? { data: null, error: { message: 'down' } }
            : { data: { stripe_subscription_schedule_id: h.scheduleId }, error: null },
      }
      return q
    },
  }),
}))

import { POST } from '@/app/api/tour/upgrade/end/route'
import { FreeMonthCard } from '@/app/dashboard/upgrade/FreeMonthCard'
import { EndFreeMonthButton } from '@/app/dashboard/upgrade/EndFreeMonthButton'
import type { FreeMonthState } from '@/lib/tour/freeMonth'

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/tour/upgrade/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  )

beforeEach(() => {
  h.viewer = {
    userId: 'u1',
    email: 'tester@example.com',
    enrollment: {
      id: 'enr-1',
      listingId: 'l1',
      isOwner: true,
      completedAt: '2026-10-01T00:00:00Z',
      trialGrantedAt: '2026-10-20T00:00:00Z',
    },
  }
  h.owned = true
  h.scheduleId = 'sub_sched_1'
  h.readError = false
  h.enrollmentFilters = []
  h.setEnd.mockReset().mockResolvedValue({
    tier: 'growth',
    returnTier: 'starter',
    endsAt: 1_794_592_000,
    cancelling: true,
    running: true,
  })
})

describe('POST /api/tour/upgrade/end', () => {
  it('ends the plan when the month ends, on the caller’s own schedule', async () => {
    const res = await post({ cancel: true })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { cancelling: true, endsAt: 1_794_592_000 } })
    expect(h.setEnd).toHaveBeenCalledWith(
      expect.anything(),
      'sub_sched_1',
      true,
      expect.any(Number)
    )
    expect(h.enrollmentFilters).toEqual([['id', 'enr-1']])
  })

  it('takes no schedule id from the body', async () => {
    const res = await post({ cancel: true, scheduleId: 'sub_sched_someone_else' })
    expect(res.status).toBe(400)
    expect(h.setEnd).not.toHaveBeenCalled()
  })

  it.each([
    ['a missing cancel', {}],
    ['a cancel that is not a boolean', { cancel: 'yes' }],
    ['a body that is not JSON', 'not json'],
  ])('rejects %s', async (_label, body) => {
    const res = await post(body)
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('VALIDATION_ERROR')
  })

  it('is not found for a non-tester, a page that changed hands, or no month on a plan', async () => {
    h.viewer = null
    expect((await post({ cancel: true })).status).toBe(404)

    h.viewer = {
      userId: 'u1',
      email: null,
      enrollment: {
        id: 'enr-1',
        listingId: 'l1',
        isOwner: true,
        completedAt: null,
        trialGrantedAt: null,
      },
    }
    h.owned = false
    expect((await post({ cancel: true })).status).toBe(404)

    h.owned = true
    h.scheduleId = null
    expect((await post({ cancel: true })).status).toBe(404)
    expect(h.setEnd).not.toHaveBeenCalled()
  })

  it('passes a refusal through, such as a month already over', async () => {
    h.setEnd.mockResolvedValue({
      status: 409,
      error: 'Your free month has already ended.',
      code: 'FREE_MONTH_OVER',
    })
    const res = await post({ cancel: false })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'Your free month has already ended.',
      code: 'FREE_MONTH_OVER',
    })
  })

  it('answers 500 in plain words when a read or Stripe fails', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    h.owned = null
    expect((await post({ cancel: true })).status).toBe(500)
    h.owned = true
    h.readError = true
    expect((await post({ cancel: true })).status).toBe(500)
    h.readError = false
    h.setEnd.mockRejectedValue(new Error('stripe down'))
    const res = await post({ cancel: true })
    expect(res.status).toBe(500)
    expect((await res.json()).code).toBe('END_FREE_MONTH_FAILED')
    errors.mockRestore()
  })
})

describe('FreeMonthCard for a page that already pays', () => {
  const availability = {
    starter: { monthly: true, annual: true },
    growth: { monthly: true, annual: true },
  } as never

  const render = (state: FreeMonthState) =>
    renderToStaticMarkup(
      createElement(FreeMonthCard, { state, availability, primaryListingId: 'l1' })
    )

  const ready = (
    over: Partial<Extract<FreeMonthState, { status: 'ready' }>> = {}
  ): FreeMonthState => ({
    status: 'ready',
    listingId: 'l1',
    listingName: 'Hampton Greens',
    currentTier: 'starter',
    openTier: null,
    attach: false,
    paying: true,
    ...over,
  })

  it('offers the bigger plans and says billing pauses, then returns', () => {
    const html = render(ready())
    expect(html).toContain('You get 30 days free on a bigger plan.')
    expect(html).toContain(
      'Your Starter billing pauses for those 30 days, then you go back to Starter at $19/month.'
    )
    expect(html).toContain('Use it on Growth')
    expect(html).not.toContain('Use it on Starter')
    expect(html).toContain('Coming soon. Your free month will wait.')
  })

  it('says so on the top plan instead of offering nothing', () => {
    const html = render(ready({ currentTier: 'premium' }))
    expect(html).toContain('you’re already on our top plan')
    expect(html).not.toContain('Use it on')
  })

  it('while the month runs, says when it ends and what comes after', () => {
    const html = render({
      status: 'used',
      tier: 'growth',
      upgrade: {
        tier: 'growth',
        returnTier: 'starter',
        endsAt: Date.UTC(2026, 10, 19, 17) / 1000,
        cancelling: false,
        running: true,
      },
    })
    expect(html).toContain('You’re on Growth free until November 19, 2026.')
    expect(html).toContain('On November 19, 2026 you go back to Starter at $19/month.')
    expect(html).toContain('End my plan when the free month ends')
  })

  it('after the tester asked to end, says no charge and offers to keep the plan', () => {
    const html = render({
      status: 'used',
      tier: 'growth',
      upgrade: {
        tier: 'growth',
        returnTier: 'starter',
        endsAt: Date.UTC(2026, 10, 19, 17) / 1000,
        cancelling: true,
        running: true,
      },
    })
    expect(html).toContain('Your plan ends on November 19, 2026. You won’t be charged.')
    expect(html).toContain('Keep Starter after the free month')
  })

  it('once the month is over, thanks the tester', () => {
    const html = render({
      status: 'used',
      tier: 'growth',
      upgrade: {
        tier: 'growth',
        returnTier: 'starter',
        endsAt: null,
        cancelling: false,
        running: false,
      },
    })
    expect(html).toContain('You used your free month on Growth. Thank you for testing.')
    expect(html).not.toContain('End my plan')
  })

  it('uses no em dashes in any of its copy', () => {
    for (const html of [
      render(ready()),
      render(ready({ currentTier: 'premium' })),
      renderToStaticMarkup(
        createElement(EndFreeMonthButton, { cancelling: true, returnTierName: 'Starter' })
      ),
    ]) {
      expect(html).not.toContain('—')
    }
  })
})
