// Ticket 153: the "Your role is in review" page. View-model, view markup, and the
// Stripe return URLs.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/stripe/client', () => ({ stripe: { checkout: { sessions: { create: h.create } } } }))
vi.mock('@/lib/stripe/jobPostings', () => ({
  jobPostingPriceId: () => 'price_test',
  JOB_POSTING_PRICE_DISPLAY: '$9.99',
}))
vi.mock('@/lib/env', () => ({ getAppUrl: () => 'https://example.test', isFeatureEnabled: () => true }))

import {
  buildConfirmationModel,
  publicRejectionReason,
  type ConfirmationInput,
} from '@/lib/jobs/confirmation'
import { PostedView } from '@/components/jobs/posted/PostedView'
import { createJobPostingCheckoutSession } from '@/lib/stripe/jobPostingCheckout'

const base: ConfirmationInput = {
  status: 'pending',
  ledger: { source: 'entitlement', status: 'paid', amount_cents: 0, paid_at: '2026-11-02T15:00:00Z' },
  ledgerFailed: false,
  returnedFromCheckout: false,
  tierName: 'Growth',
  submittedAt: '2026-11-02T15:00:00Z',
  closesAt: null,
  rejectionReason: null,
  fallbackPrice: '$9.99',
}

function review(over: Partial<ConfirmationInput> = {}) {
  const m = buildConfirmationModel({ ...base, ...over })
  if (m.kind !== 'review' && m.kind !== 'live') throw new Error(`unexpected ${m.kind}`)
  return m
}

describe('buildConfirmationModel', () => {
  it('included posting', () => {
    const m = review()
    expect(m.heading).toBe('Your role is in review')
    expect(m.costLine).toBe('Included with your Growth plan. No charge.')
    expect(m.timeline.map((s) => s.label)).toEqual(['Submitted', 'In review', 'Live', 'Closes'])
    expect(m.timeline.find((s) => s.state === 'current')?.label).toBe('In review')
    expect(m.timeline[3]?.detail).toBe('30 days after it goes live')
    expect(m.timeline[0]?.detail).toBe('November 2, 2026')
  })

  it('paid posting uses the ledger amount, and falls back to the shared price', () => {
    const paid = { source: 'stripe', status: 'paid', amount_cents: 1250, paid_at: null }
    expect(review({ ledger: paid }).costLine).toBe('You paid $12.50 for 30 days.')
    expect(review({ ledger: { ...paid, amount_cents: 0 } }).costLine).toBe('You paid $9.99 for 30 days.')
  })

  it('grandfathered role has no ledger row', () => {
    expect(review({ ledger: null, tierName: null }).costLine).toBe('No charge.')
  })

  it('ledger failure replaces only the cost line', () => {
    const m = review({ ledger: null, ledgerFailed: true })
    expect(m.costLine).toBe("We couldn't load the cost just now.")
    expect(m.timeline).toHaveLength(4)
  })

  it('shows the close date in Eastern time when set', () => {
    expect(review({ closesAt: '2026-12-01T04:59:59Z' }).timeline[3]?.detail).toBe('November 30, 2026')
  })

  it('draft after checkout waits for the webhook; a plain draft goes to the editor', () => {
    expect(buildConfirmationModel({ ...base, status: 'draft', ledger: null, returnedFromCheckout: true }).kind).toBe(
      'confirming'
    )
    expect(buildConfirmationModel({ ...base, status: 'draft', ledger: null }).kind).toBe('redirect')
  })

  it('live', () => {
    const m = review({ status: 'published' })
    expect(m.kind).toBe('live')
    expect(m.heading).toBe('Your role is live')
    expect(m.timeline.find((s) => s.state === 'current')?.label).toBe('Live')
  })

  it('rejected carries the reason, with admin-only notes removed', () => {
    const reason = publicRejectionReason('Add a pay range.\n\nAdmin notes: spammy poster')
    expect(reason).toBe('Add a pay range.')
    const m = buildConfirmationModel({ ...base, status: 'rejected', rejectionReason: reason })
    expect(m).toMatchObject({ kind: 'rejected', heading: 'This role needs changes', reason: 'Add a pay range.' })
  })

  it('other statuses redirect', () => {
    expect(buildConfirmationModel({ ...base, status: 'suspended' }).kind).toBe('redirect')
  })

  it('uses no em dashes', () => {
    const m = review()
    expect(JSON.stringify(m)).not.toContain('—')
  })
})

describe('PostedView', () => {
  it('renders one H1, an ordered timeline with aria-current, and the links', () => {
    const model = review()
    const html = renderToStaticMarkup(
      createElement(PostedView, {
        model,
        entityId: 'abc',
        roleTitle: 'Moderator',
        businessName: 'The BLACQList',
        publicHref: null,
      })
    )
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain('Your role is in review')
    expect(html).toContain('Moderator at The BLACQList')
    expect(html).toContain('<ol')
    expect(html).toContain('aria-current="step"')
    expect(html).toContain('(Now)')
    expect(html).toContain('href="/dashboard"')
    expect(html).toContain('href="/add-job"')
    expect(html).toContain('href="/dashboard/pages/abc/edit"')
    expect(html).not.toContain('—')
  })

  it('shows the confirming message in a polite live region', () => {
    const html = renderToStaticMarkup(
      createElement(PostedView, {
        model: buildConfirmationModel({ ...base, status: 'draft', ledger: null, returnedFromCheckout: true }) as never,
        entityId: 'abc',
        roleTitle: 'Moderator',
        businessName: null,
        publicHref: null,
      })
    )
    expect(html).toContain("We&#x27;re confirming your payment")
    expect(html).toContain('aria-live="polite"')
  })
})

describe('job posting checkout return URLs', () => {
  beforeEach(() => {
    h.create.mockReset()
    h.create.mockResolvedValue({ url: 'https://stripe.test/pay' })
  })

  it('returns to the posted page and cancels back to the wizard', async () => {
    const res = await createJobPostingCheckoutSession({
      listingId: 'L1',
      listingName: 'Role',
      userId: 'u1',
      userEmail: null,
    })
    expect(res).toEqual({ url: 'https://stripe.test/pay' })
    const args = h.create.mock.calls[0]![0]
    expect(args.success_url).toBe('https://example.test/dashboard/pages/L1/posted?paid=1')
    expect(args.cancel_url).toBe('https://example.test/add-job?canceled=1')
  })
})
