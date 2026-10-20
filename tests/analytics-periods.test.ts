import { describe, expect, it } from 'vitest'
import { bucketTrend, periodsFor, resolvePeriod, type DailyRow } from '@/lib/analytics/periods'

// Ticket 105: the analytics window follows the plan's analyticsHistoryDays.

describe('periodsFor', () => {
  it('gives Free no ranges', () => {
    expect(periodsFor('free')).toEqual([])
    expect(periodsFor(null)).toEqual([])
  })

  it('gives Starter 7 and 30 days', () => {
    expect(periodsFor('starter').map((p) => p.key)).toEqual(['7d', '30d'])
  })

  it('gives Growth and Premium up to 12 months', () => {
    expect(periodsFor('growth').map((p) => p.key)).toEqual(['7d', '30d', '90d', '365d'])
    expect(periodsFor('premium').map((p) => p.key)).toEqual(['7d', '30d', '90d', '365d'])
  })
})

describe('resolvePeriod', () => {
  it('defaults to 30 days', () => {
    expect(resolvePeriod(undefined, 'starter').key).toBe('30d')
    expect(resolvePeriod(undefined, 'growth').key).toBe('30d')
  })

  it('honours a range the plan includes', () => {
    expect(resolvePeriod('7d', 'starter').key).toBe('7d')
    expect(resolvePeriod('365d', 'growth').key).toBe('365d')
  })

  it('never reads more history than the plan holds', () => {
    expect(resolvePeriod('365d', 'starter').key).toBe('30d')
    expect(resolvePeriod('90d', 'starter').key).toBe('30d')
  })

  it('falls back on anything it does not recognise', () => {
    expect(resolvePeriod('forever', 'growth').key).toBe('30d')
  })
})

const row = (snapshot_date: string, page_views = 1): DailyRow => ({
  snapshot_date,
  page_views,
  cta_clicks: 1,
  saves: 0,
  shares: 2,
})

describe('bucketTrend', () => {
  it('keeps one bar per day for short ranges', () => {
    const out = bucketTrend([row('2026-10-14'), row('2026-10-15', 4)], 'day')
    expect(out.map((p) => [p.key, p.label, p.title, p.page_views])).toEqual([
      ['2026-10-14', '14', 'Oct 14', 1],
      ['2026-10-15', '15', 'Oct 15', 4],
    ])
  })

  it('groups by week, Monday first, for 90 days', () => {
    // 2026-10-11 is a Sunday; 10-12 starts the next week.
    const out = bucketTrend([row('2026-10-05'), row('2026-10-11', 3), row('2026-10-12', 5)], 'week')
    expect(out.map((p) => [p.key, p.title, p.page_views, p.shares])).toEqual([
      ['2026-10-05', 'Week of Oct 5', 4, 4],
      ['2026-10-12', 'Week of Oct 12', 5, 2],
    ])
  })

  it('groups by month for 12 months', () => {
    const out = bucketTrend([row('2026-09-30'), row('2026-10-01'), row('2026-10-31')], 'month')
    expect(out.map((p) => [p.key, p.label, p.title, p.page_views, p.cta_clicks])).toEqual([
      ['2026-09', 'Sep', 'September 2026', 1, 1],
      ['2026-10', 'Oct', 'October 2026', 2, 2],
    ])
  })

  it('returns nothing for no rows', () => {
    expect(bucketTrend([], 'month')).toEqual([])
  })
})
