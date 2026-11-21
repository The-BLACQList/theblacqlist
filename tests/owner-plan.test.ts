// =============================================================================
// Ticket 237: the owner's plan strip on the dashboard home
// =============================================================================
// vitest runs in node, so the strip is rendered to static markup and read as text.
// =============================================================================

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/actions/billing/createPortalSession', () => ({
  createPortalSession: vi.fn(),
}))

import { getOwnerPlan, highestTier, type OwnerPlan } from '@/lib/services/billing/ownerPlan'
import { PagePlanTag, PlanStrip } from '@/components/dashboard/PlanStrip'

type Row = { status: string; created_at: string }
type Result<T> = { data: T[] | null; error: { message: string } | null }

/**
 * A stand-in for the two Supabase reads: subscriptions (resolves on .order())
 * and plan_covered_pages (resolves on .eq(), so its chain is a thenable).
 */
function fakeClient(
  result: Result<Row>,
  covered: Result<{ listing_id: string }> = { data: [], error: null }
) {
  const calls: Record<string, unknown[]> = {}
  const tables: string[] = []
  const subs = {
    select: (...a: unknown[]) => ((calls.select = a), subs),
    eq: (...a: unknown[]) => ((calls.eq = a), subs),
    not: (...a: unknown[]) => ((calls.not = a), subs),
    in: (...a: unknown[]) => ((calls.in = a), subs),
    order: (...a: unknown[]) => ((calls.order = a), Promise.resolve(result)),
  }
  const cover = {
    select: () => cover,
    eq: (...a: unknown[]) => ((calls.coverEq = a), Promise.resolve(covered)),
  }
  const client = {
    from: (table: string) => {
      tables.push(table)
      calls.from = [table]
      return table === 'plan_covered_pages' ? cover : subs
    },
  }
  return { client: client as never, calls, tables }
}

describe('highestTier', () => {
  it('picks the highest plan across pages', () => {
    expect(highestTier([{ tier: 'free' }, { tier: 'growth' }, { tier: 'starter' }])).toBe('growth')
  })

  it('counts missing or unknown tiers as Free', () => {
    expect(highestTier([])).toBe('free')
    expect(highestTier([{ tier: null }, { tier: 'gold' }])).toBe('free')
  })
})

describe('getOwnerPlan', () => {
  it('reads only this owner’s live subscriptions', async () => {
    const { client, calls } = fakeClient({ data: [], error: null })
    await getOwnerPlan(client, 'user-1', [{ tier: 'starter' }])
    expect(calls.from).toEqual(['subscriptions'])
    expect(calls.eq).toEqual(['user_id', 'user-1'])
    expect(calls.in).toEqual(['status', ['active', 'trialing', 'past_due']])
  })

  it('is Free with no portal when there is no subscription', async () => {
    const { client } = fakeClient({ data: [], error: null })
    expect(await getOwnerPlan(client, 'u', [{ tier: 'free' }])).toEqual({
      tier: 'free',
      paymentDue: false,
      canManage: false,
      coverage: null,
    })
  })

  it('opens the portal when there is a live subscription', async () => {
    const { client } = fakeClient({
      data: [
        { status: 'active', created_at: '2026-11-02' },
        { status: 'trialing', created_at: '2026-10-01' },
      ],
      error: null,
    })
    const plan = await getOwnerPlan(client, 'u', [{ tier: 'starter' }])
    expect(plan).toMatchObject({ tier: 'starter', paymentDue: false, canManage: true })
  })

  it('flags Payment Due when any live subscription is past_due', async () => {
    const { client } = fakeClient({
      data: [
        { status: 'active', created_at: '2026-11-02' },
        { status: 'past_due', created_at: '2026-10-01' },
      ],
      error: null,
    })
    const plan = await getOwnerPlan(client, 'u', [{ tier: 'growth' }, { tier: 'starter' }])
    expect(plan).toEqual({ tier: 'growth', paymentDue: true, canManage: true, coverage: null })
  })

  it('counts the pages on the plan against the plan’s cap (238)', async () => {
    const { client, calls } = fakeClient(
      { data: [{ status: 'active', created_at: '2026-11-02' }], error: null },
      { data: [{ listing_id: 'a' }, { listing_id: 'b' }], error: null }
    )
    const plan = await getOwnerPlan(client, 'user-9', [{ tier: 'premium' }])
    expect(calls.coverEq).toEqual(['owner_user_id', 'user-9'])
    expect(plan.coverage).toEqual({ pageIds: ['a', 'b'], count: 2, cap: 3 })
  })

  it('never shows the cap below the count (a hand-set plan can cover more)', async () => {
    const { client } = fakeClient(
      { data: [], error: null },
      { data: [{ listing_id: 'a' }, { listing_id: 'b' }], error: null }
    )
    const plan = await getOwnerPlan(client, 'u', [{ tier: 'starter' }])
    expect(plan.coverage).toEqual({ pageIds: ['a', 'b'], count: 2, cap: 2 })
  })

  it('has no coverage on Free, with nothing covered, or when the read fails', async () => {
    const free = fakeClient({ data: [], error: null }, { data: [{ listing_id: 'a' }], error: null })
    expect((await getOwnerPlan(free.client, 'u', [{ tier: 'free' }])).coverage).toBeNull()
    expect(free.tables).not.toContain('plan_covered_pages')

    const none = fakeClient({ data: [], error: null })
    expect((await getOwnerPlan(none.client, 'u', [{ tier: 'growth' }])).coverage).toBeNull()

    const failed = fakeClient({ data: [], error: null }, { data: null, error: { message: 'x' } })
    expect((await getOwnerPlan(failed.client, 'u', [{ tier: 'growth' }])).coverage).toBeNull()
  })

  it('keeps the plan name when the read fails', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'boom' } })
    expect(await getOwnerPlan(client, 'u', [{ tier: 'growth' }])).toEqual({
      tier: 'growth',
      paymentDue: false,
      canManage: false,
      coverage: null,
    })
  })
})

function strip(plan: Partial<OwnerPlan>) {
  const full: OwnerPlan = {
    tier: 'free',
    paymentDue: false,
    canManage: false,
    coverage: null,
    ...plan,
  }
  return renderToStaticMarkup(createElement(PlanStrip, { plan: full }))
}

describe('PlanStrip', () => {
  it('Free: names the plan and links to the plans', () => {
    const html = strip({ tier: 'free' })
    expect(html).toContain('Your Plan')
    expect(html).toContain('Free Plan')
    expect(html).toContain('Upgrade to Starter')
    expect(html).toContain('href="/dashboard/upgrade"')
    expect(html).toContain('See Plans')
    expect(html).not.toContain('Payment Due')
  })

  it('Paid: names the plan and opens Manage Subscription', () => {
    const html = strip({ tier: 'growth', canManage: true })
    expect(html).toContain('Growth Plan')
    expect(html).toContain('Get chosen.')
    expect(html).toContain('Manage Subscription')
    expect(html).not.toContain('Payment Due')
  })

  it('Paid with no portal (e.g. a comped page): links to Compare Plans', () => {
    const html = strip({ tier: 'starter' })
    expect(html).toContain('Starter Plan')
    expect(html).toContain('Compare Plans')
    expect(html).not.toContain('Manage Subscription')
  })

  it('Payment Due: warns and offers Update Card', () => {
    const html = strip({ tier: 'starter', paymentDue: true, canManage: true })
    expect(html).toContain('Starter Plan')
    expect(html).toContain('Payment Due')
    expect(html).toContain('Update your card to keep your plan.')
    expect(html).toContain('Update Card')
    expect(html).toContain('data-payment-due="true"')
  })

  it('links the page count to Pages on Your Plan (238)', () => {
    const html = strip({
      tier: 'premium',
      canManage: true,
      coverage: { pageIds: ['a', 'b'], count: 2, cap: 3 },
    })
    expect(html).toContain('2 of 3 Pages Covered')
    expect(html).toContain('href="/dashboard/upgrade#plan-pages"')
    expect(strip({ tier: 'starter', coverage: { pageIds: ['a'], count: 1, cap: 1 } })).toContain(
      '1 of 1 Page Covered'
    )
    expect(strip({ tier: 'growth' })).not.toContain('Covered')
  })

  it('uses an outlined amber-gold border, never the trust golds', () => {
    const html = strip({ tier: 'premium', canManage: true })
    expect(html).toContain('border-amber-gold')
    expect(html).not.toMatch(/\b(bg|border)-(light-)?gold\b/)
  })
})

describe('PagePlanTag', () => {
  it('shows each page’s plan in Title Case', () => {
    const tag = (tier: string | null) => renderToStaticMarkup(createElement(PagePlanTag, { tier }))
    expect(tag('starter')).toContain('Starter Plan')
    expect(tag('premium')).toContain('Premium Plan')
    expect(tag(null)).toContain('Free Plan')
  })
})
