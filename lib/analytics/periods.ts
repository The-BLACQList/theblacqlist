import { analyticsHistoryDays } from '@/lib/stripe/features'

// The ranges an owner can pick on the analytics page (ticket 105). Each plan
// sees the ranges that fit inside its analyticsHistoryDays: Starter 7 and 30
// days, Growth and Premium also 90 days and 12 months. Free has no analytics.

export type PeriodKey = '7d' | '30d' | '90d' | '365d'

export interface AnalyticsPeriod {
  key: PeriodKey
  days: number
  /** Toggle text: "7 days". */
  label: string
  /** Section heading: "Last 7 days". */
  heading: string
  /** How the trend bars are grouped. */
  bucket: 'day' | 'week' | 'month'
}

export const ANALYTICS_PERIODS: readonly AnalyticsPeriod[] = [
  { key: '7d', days: 7, label: '7 days', heading: 'Last 7 days', bucket: 'day' },
  { key: '30d', days: 30, label: '30 days', heading: 'Last 30 days', bucket: 'day' },
  { key: '90d', days: 90, label: '90 days', heading: 'Last 90 days', bucket: 'week' },
  { key: '365d', days: 365, label: '12 months', heading: 'Last 12 months', bucket: 'month' },
]

export const DEFAULT_PERIOD: PeriodKey = '30d'

/** The ranges this plan includes, shortest first. Empty on Free. */
export function periodsFor(tier: string | null): AnalyticsPeriod[] {
  const max = analyticsHistoryDays(tier)
  return ANALYTICS_PERIODS.filter((p) => p.days <= max)
}

/**
 * The range to show. A range the plan does not include (an old bookmark after
 * a move to a lower plan, or a typed URL) falls back to the default, never to
 * more history than the plan holds.
 */
export function resolvePeriod(param: string | undefined, tier: string | null): AnalyticsPeriod {
  const allowed = periodsFor(tier)
  return (
    allowed.find((p) => p.key === param) ??
    allowed.find((p) => p.key === DEFAULT_PERIOD) ??
    ANALYTICS_PERIODS[0]!
  )
}

export interface DailyRow {
  snapshot_date: string
  page_views: number
  cta_clicks: number
  saves: number
  shares: number
}

export interface TrendPoint extends Omit<DailyRow, 'snapshot_date'> {
  key: string
  /** Short axis label: "14", "Oct 5", "Oct". */
  label: string
  /** Full label for the bar's title: "Oct 14", "Week of Oct 5", "October 2026". */
  title: string
}

const MONTH_SHORT = { month: 'short', timeZone: 'UTC' } as const
const DAY_SHORT = { month: 'short', day: 'numeric', timeZone: 'UTC' } as const

function utc(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

/** Monday of the date's week, as YYYY-MM-DD. */
function weekStart(date: string): string {
  const d = utc(date)
  const back = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - back)
  return d.toISOString().slice(0, 10)
}

/**
 * Groups the nightly rows into the period's bars: one per day up to 30 days,
 * one per week for 90 days, one per month for 12 months. Rows arrive sorted by
 * date; the output keeps that order.
 */
export function bucketTrend(
  rows: readonly DailyRow[],
  bucket: AnalyticsPeriod['bucket']
): TrendPoint[] {
  const points = new Map<string, TrendPoint>()
  for (const row of rows) {
    let key: string
    let label: string
    let title: string
    if (bucket === 'day') {
      key = row.snapshot_date
      title = utc(key).toLocaleDateString('en-US', DAY_SHORT)
      label = String(utc(key).getUTCDate())
    } else if (bucket === 'week') {
      key = weekStart(row.snapshot_date)
      label = utc(key).toLocaleDateString('en-US', DAY_SHORT)
      title = `Week of ${label}`
    } else {
      key = row.snapshot_date.slice(0, 7)
      const first = utc(`${key}-01`)
      label = first.toLocaleDateString('en-US', MONTH_SHORT)
      title = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    }
    const point = points.get(key) ?? {
      key,
      label,
      title,
      page_views: 0,
      cta_clicks: 0,
      saves: 0,
      shares: 0,
    }
    point.page_views += row.page_views
    point.cta_clicks += row.cta_clicks
    point.saves += row.saves
    point.shares += row.shares
    points.set(key, point)
  }
  return [...points.values()]
}
