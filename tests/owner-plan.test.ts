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

type Row = { listing_id: string | null; status: string; created_at: string }

/** A stand-in for the Supabase query chain the read uses. */
function fakeClient(result: { data: Row[] | null; error: { message: string } | null }) {
  const calls: Record<string, unknown[]> = {}
  const chain = {
    select: (...a: unknown[]) => ((calls.select = a), chain),
    eq: (...a: unknown[]) => ((calls.eq = a), chain),
    not: (...a: unknown[]) => ((calls.not = a), chain),
    in: (...a: unknown[]) => ((calls.in = a), chain),
    order: (...a: unknown[]) => ((calls.order = a), Promise.resolve(result)),
  }
  const client = {
    from: (table: string) => {
      calls.from = [table]
      return chain
    },
  }
  return { client: client as never, calls }
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
      manageListingId: null,
    })
  })

  it('opens the portal on the newest live subscription', async () => {
    const { client } = fakeClient({
      data: [
        { listing_id: 'page-new', status: 'active', created_at: '2026-11-02' },
        { listing_id: 'page-old', status: 'trialing', created_at: '2026-10-01' },
      ],
      error: null,
    })
    const plan = await getOwnerPlan(client, 'u', [{ tier: 'starter' }])
    expect(plan).toMatchObject({ tier: 'starter', paymentDue: false, canManage: true })
    expect(plan.manageListingId).toBe('page-new')
  })

  it('flags Payment Due and points the portal at the failed subscription', async () => {
    const { client } = fakeClient({
      data: [
        { listing_id: 'page-a', status: 'active', created_at: '2026-11-02' },
        { listing_id: 'page-b', status: 'past_due', created_at: '2026-10-01' },
      ],
      error: null,
    })
    const plan = await getOwnerPlan(client, 'u', [{ tier: 'growth' }, { tier: 'starter' }])
    expect(plan).toEqual({
      tier: 'growth',
      paymentDue: true,
      canManage: true,
      manageListingId: 'page-b',
    })
  })

  it('keeps the plan name when the read fails', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'boom' } })
    expect(await getOwnerPlan(client, 'u', [{ tier: 'growth' }])).toEqual({
      tier: 'growth',
      paymentDue: false,
      canManage: false,
      manageListingId: null,
    })
  })
})

function strip(plan: Partial<OwnerPlan>) {
  const full: OwnerPlan = {
    tier: 'free',
    paymentDue: false,
    canManage: false,
    manageListingId: null,
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
    const html = strip({ tier: 'growth', canManage: true, manageListingId: 'p' })
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
    const html = strip({ tier: 'starter', paymentDue: true, canManage: true, manageListingId: 'p' })
    expect(html).toContain('Starter Plan')
    expect(html).toContain('Payment Due')
    expect(html).toContain('Update your card to keep your plan.')
    expect(html).toContain('Update Card')
    expect(html).toContain('data-payment-due="true"')
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
