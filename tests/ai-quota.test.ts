// =============================================================================
// The plan's monthly AI allowance (aiQuota) counter
// =============================================================================
// The counter reads successful paid generations only, over a rolling 30 days,
// and fails closed. The Supabase client is mocked; nothing here reaches a database.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const calls: Array<[string, unknown, unknown?]> = []
let result: { count: number | null; error: unknown } = { count: 0, error: null }

const query = {
  select: (cols: unknown, opts: unknown) => (calls.push(['select', cols, opts]), query),
  eq: (col: unknown, val: unknown) => (calls.push(['eq', col, val]), query),
  gte: (col: unknown, val: unknown) => (calls.push(['gte', col, val]), Promise.resolve(result)),
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: () => query }),
}))

import { countSuccessfulLast30Days } from '@/lib/ai/provider'
import { aiQuota } from '@/lib/stripe/features'

describe('countSuccessfulLast30Days', () => {
  beforeEach(() => {
    calls.length = 0
    result = { count: 0, error: null }
  })

  it('counts completed paid rows for the listing over the last 30 days', async () => {
    result = { count: 7, error: null }
    const before = Date.now()
    expect(await countSuccessfulLast30Days('listing-1')).toBe(7)
    expect(calls).toContainEqual(['eq', 'listing_id', 'listing-1'])
    expect(calls).toContainEqual(['eq', 'status', 'completed'])
    // Mock rows cost nothing, so they never use up a plan's allowance.
    expect(calls).toContainEqual(['eq', 'provider', 'anthropic'])
    const since = calls.find((c) => c[0] === 'gte')?.[2] as string
    const days = (before - Date.parse(since)) / (24 * 60 * 60 * 1000)
    expect(days).toBeGreaterThan(29.99)
    expect(days).toBeLessThan(30.01)
  })

  it('fails closed when the counter cannot be read', async () => {
    result = { count: null, error: { message: 'down' } }
    const used = await countSuccessfulLast30Days('listing-1')
    // Over every allowance, including the largest.
    expect(used).toBeGreaterThanOrEqual(aiQuota('premium') ?? 0)
    expect(used).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('aiQuota', () => {
  it('matches the plan table the pricing doc promises', () => {
    expect(aiQuota('free')).toBe(0)
    expect(aiQuota('starter')).toBe(10)
    expect(aiQuota('growth')).toBe(100)
    expect(aiQuota('premium')).toBe(500)
  })
})
