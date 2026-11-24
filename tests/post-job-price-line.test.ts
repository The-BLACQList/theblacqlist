import { describe, expect, it } from 'vitest'
import { buildJobPriceLine } from '@/lib/listings/jobPriceLine'
import type { JobQuota } from '@/lib/stripe/jobPostings'

const ok = (q: Partial<JobQuota>) => ({
  ok: true as const,
  value: { limit: 3, used: 1, atLimit: false, nextOpensAt: null, tier: 'premium', ...q } as JobQuota,
})

describe('buildJobPriceLine', () => {
  it('says no charge when paid postings are off', () => {
    expect(buildJobPriceLine(null, '$9.99', false).text).toBe('No charge for this posting.')
  })
  it('does not claim a price or allowance when the read failed', () => {
    const r = buildJobPriceLine({ ok: false, error: 'x' }, '$9.99', true)
    expect(r.kind).toBe('unknown')
    expect(r.text).not.toContain('$')
    expect(r.text).not.toContain('ncluded')
  })
  it('shows the allowance when one is open', () => {
    const r = buildJobPriceLine(ok({}), '$9.99', true)
    expect(r.text).toBe('Included with your Premium plan. No charge. 2 of 3 postings left.')
    expect(r.button).toBe('Submit for Review')
  })
  it('shows the price when the allowance is spent', () => {
    const r = buildJobPriceLine(ok({ used: 3, atLimit: true }), '$9.99', true)
    expect(r.text).toContain('$9.99')
    expect(r.button).toBe('Pay and Submit')
  })
  it('names the plan and skips the count when it includes one posting', () => {
    const r = buildJobPriceLine(ok({ limit: 1, used: 0, tier: 'growth' }), '$9.99', true)
    expect(r.text).toBe('Included with your Growth plan. No charge.')
    expect(r.kind).toBe('included')
  })
  it('says when the next included posting opens before quoting a price (273)', () => {
    const r = buildJobPriceLine(
      ok({ limit: 1, used: 1, atLimit: true, tier: 'growth', nextOpensAt: '2026-12-03T17:00:00Z' }),
      '$9.99',
      true
    )
    expect(r.text).toBe(
      "You've used the posting included with your Growth plan. Your next one opens Dec 3. Posting now is $9.99 for 30 days."
    )
    expect(r.noAllowance).toBeUndefined()
  })
  it('shows the price on a plan with no allowance', () => {
    const r = buildJobPriceLine(ok({ limit: 0, used: 0, atLimit: true, tier: 'free' }), '$9.99', true)
    expect(r.text).toBe('$9.99 for 30 days.')
    expect(r.noAllowance).toBe(true)
    expect(r.button).toBe('Pay and Submit')
  })
  it('says included for an unlimited plan', () => {
    expect(buildJobPriceLine(ok({ limit: null }), '$9.99', true).text).toBe('Included with your Premium plan. No charge.')
  })
})
