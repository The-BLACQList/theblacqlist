import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 273: an included posting is always spent before $9.99 is asked for, and
// checkout never opens on a price the poster was not shown.

const h = vi.hoisted(() => ({
  quota: vi.fn(),
  paid: vi.fn(),
  grant: vi.fn(),
  checkout: vi.fn(),
  move: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => ({}), createClient: vi.fn() }))
vi.mock('@/lib/env', () => ({ isFeatureEnabled: () => true }))
vi.mock('@/lib/listings/submitForReview', () => ({ transitionToPendingReview: h.move }))
vi.mock('@/lib/stripe/jobPostingCheckout', () => ({ createJobPostingCheckoutSession: h.checkout }))
vi.mock('@/lib/stripe/jobPostings', () => ({
  grantIncludedJobPosting: h.grant,
  hasPaidJobPosting: h.paid,
  jobQuotaFor: h.quota,
  JOB_LIMIT_ENFORCED_FROM: '2026-08-21T00:00:00.000Z',
  JOB_POSTING_PRICE_DISPLAY: '$9.99',
}))
vi.mock('@/lib/actions/dashboard/updateListingStatus', () => ({ updateListingStatusAction: vi.fn() }))
vi.mock('@/lib/actions/listings/submitListingForReview', () => ({ submitListingForReviewAction: vi.fn() }))

import { submitJobForReview } from '@/lib/services/listings/submitJobForReview'
import { PublishSection } from '@/components/dashboard/PublishSection'
import type { JobPriceLine } from '@/lib/listings/jobPriceLine'

const job = { id: 'job-1', name: 'Line Cook', created_at: '2026-11-01T00:00:00Z' }
const submit = (chargeShown: boolean) =>
  submitJobForReview({} as never, { id: 'u1', email: 'o@example.com' }, job, { chargeShown })
const quota = (over: object) => ({
  ok: true,
  value: { limit: 1, used: 0, atLimit: false, nextOpensAt: null, tier: 'growth', ...over },
})

beforeEach(() => {
  vi.clearAllMocks()
  h.paid.mockResolvedValue({ ok: true, value: false })
  h.quota.mockResolvedValue(quota({}))
  h.grant.mockResolvedValue({ ok: true })
  h.move.mockResolvedValue({ success: true })
  h.checkout.mockResolvedValue({ url: 'https://pay.example/x' })
})

describe('submitJobForReview', () => {
  it.each([true, false])(
    'spends an included posting and never opens checkout (price shown: %s)',
    async (shown) => {
      expect(await submit(shown)).toEqual({ success: true, outcome: 'included' })
      expect(h.grant).toHaveBeenCalledTimes(1)
      expect(h.checkout).not.toHaveBeenCalled()
    }
  )

  it('asks to confirm instead of opening checkout when no price was shown', async () => {
    h.quota.mockResolvedValue(quota({ used: 1, atLimit: true, nextOpensAt: '2026-12-03T17:00:00Z' }))
    const r = await submit(false)
    expect(r).toMatchObject({ confirmPrice: true, priceLine: { kind: 'paid', button: 'Pay and Submit' } })
    if ('confirmPrice' in r) {
      expect(r.notice).toContain('Nothing has been charged')
      expect(r.priceLine.text).toContain('Your next one opens Dec 3.')
    }
    expect(h.checkout).not.toHaveBeenCalled()
    expect(h.grant).not.toHaveBeenCalled()
    expect(h.move).not.toHaveBeenCalled()
  })

  it('opens checkout once the price was shown and nothing included is left', async () => {
    h.quota.mockResolvedValue(quota({ used: 1, atLimit: true }))
    expect(await submit(true)).toEqual({ requiresPayment: true, checkoutUrl: 'https://pay.example/x' })
  })

  it('never charges when the allowance read or the grant fails', async () => {
    h.quota.mockResolvedValue({ ok: false, error: 'x' })
    expect(await submit(true)).toHaveProperty('error')
    h.quota.mockResolvedValue(quota({}))
    h.grant.mockResolvedValue({ ok: false, error: 'x' })
    expect(await submit(true)).toHaveProperty('error')
    expect(h.checkout).not.toHaveBeenCalled()
  })
})

describe('the draft job card', () => {
  const card = (jobPrice?: JobPriceLine) =>
    renderToStaticMarkup(
      createElement(PublishSection, {
        listingId: 'job-1',
        status: 'draft',
        trustTier: 'unclaimed',
        entityType: 'job',
        jobPrice,
      })
    )

  it('says included, with no price, and does not consent to a charge', () => {
    const html = card({
      kind: 'included',
      text: 'Included with your Growth plan. No charge.',
      button: 'Submit for Review',
    })
    expect(html).toContain('Included with your Growth plan. No charge.')
    expect(html).not.toContain('$9.99')
    expect(html).not.toContain('charge_shown')
  })

  it('shows the price on the card and the button, and then consents', () => {
    const html = card({ kind: 'paid', text: '$9.99 for 30 days.', button: 'Pay and Submit', noAllowance: true })
    expect(html).toContain('$9.99 for 30 days. Submitting takes you to checkout.')
    expect(html).toContain('Pay and Submit')
    expect(html).toContain('name="charge_shown" value="1"')
    expect(html).toContain('Growth and Premium plans include free postings')
  })

  it('does not consent when the cost could not be read or there is no line', () => {
    for (const line of [
      undefined,
      { kind: 'unknown', text: "We'll show the cost before you pay anything.", button: 'Submit for Review' } as const,
    ]) {
      const html = card(line)
      expect(html).not.toContain('charge_shown')
      expect(html).toContain('Submit for Review')
    }
  })
})
