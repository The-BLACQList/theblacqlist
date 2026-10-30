import { describe, expect, it } from 'vitest'
import { buildJobPriceLine } from '@/lib/listings/jobPriceLine'
import type { JobQuota } from '@/lib/stripe/jobPostings'

const ok = (q: Partial<JobQuota>) => ({
  ok: true as const,
  value: { limit: 3, used: 1, atLimit: false, tier: 'growth', ...q } as JobQuota,
})

describe('buildJobPriceLine', () => {
  it('says no charge when paid postings are off', () => {
    expect(buildJobPriceLine(null, '$9.99', false).text).toBe('No charge for this posting.')
  })
  it('does not claim a price or allowance when the read failed', () => {
    const r = buildJobPriceLine({ ok: false, error: 'x' }, '$9.99', true)
    expect(r.kind).toBe('unknown')
    expect(r.text).not.toContain('$')
  })
  it('shows the allowance when one is open', () => {
    const r = buildJobPriceLine(ok({}), '$9.99', true)
    expect(r.text).toBe('Uses 1 of your 3 included postings (1 used)')
    expect(r.button).toBe('Submit for review')
  })
  it('shows the price when the allowance is spent', () => {
    const r = buildJobPriceLine(ok({ used: 3, atLimit: true }), '$9.99', true)
    expect(r.text).toContain('$9.99')
    expect(r.button).toBe('Pay and submit')
  })
  it('shows the price on a plan with no allowance', () => {
    const r = buildJobPriceLine(ok({ limit: 0, used: 0, atLimit: true, tier: 'free' }), '$9.99', true)
    expect(r.text).toBe('$9.99 for 30 days.')
    expect(r.button).toBe('Pay and submit')
  })
  it('says included for an unlimited plan', () => {
    expect(buildJobPriceLine(ok({ limit: null }), '$9.99', true).text).toBe('Included with your plan.')
  })
})
