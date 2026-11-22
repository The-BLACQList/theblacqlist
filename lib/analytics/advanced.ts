// =============================================================================
// Ticket 241: advanced analytics on Growth and Premium
// =============================================================================
// Founder 2026-11-21: "build what we can track now". Growth and Premium get:
//
//   - each period number compared with the period before,
//   - Storefront numbers (views and clicks per product or service), only while
//     the marketplace is open,
//   - views and taps for the events and jobs the page posted,
//   - the 90-day and 12-month ranges (already there since ticket 105).
//
// Shop sales, orders and payouts come when Shop opens, not before. Anything not
// tracked is left out, never shown as a zero.
//
// Pure helpers only, so the maths is testable without a database. The page is
// app/dashboard/pages/[entityId]/analytics/page.tsx; the numbers come from the
// owner_listing_insights function (20261203000000_owner_listing_insights.sql).
// =============================================================================

import { analyticsHistoryDays } from '@/lib/stripe/features'

/**
 * A period can be compared with the one before only when the plan holds both:
 * 2 x days of history. Growth's 365 days cover 7, 30 and 90 days but not
 * 12 months, so the 12-month view shows no arrows instead of reading history
 * the plan does not include.
 */
export function canCompare(days: number, tier: string | null): boolean {
  return days * 2 <= analyticsHistoryDays(tier)
}

export interface PeriodChange {
  direction: 'up' | 'down' | 'same'
  /** Whole percent, always positive. */
  percent: number
}

/**
 * Change from the previous period. Null when the previous period had nothing:
 * "up from 0" is not a percent, and a big arrow on a first week would mislead.
 */
export function periodChange(current: number, previous: number): PeriodChange | null {
  if (!(previous > 0)) return null
  const percent = Math.round((Math.abs(current - previous) / previous) * 100)
  if (percent === 0) return { direction: 'same', percent: 0 }
  return { direction: current > previous ? 'up' : 'down', percent }
}

/** Short text for a stat card, with a symbol so it never relies on colour. */
export function changeText(change: PeriodChange): string {
  if (change.direction === 'same') return 'No change'
  return `${change.direction === 'up' ? '▲' : '▼'} ${change.percent}%`
}

/** Full sentence for screen readers. */
export function changeLabel(change: PeriodChange, days: number): string {
  const span = days === 365 ? '12 months' : `${days} days`
  if (change.direction === 'same') return `No change from the ${span} before`
  return `${change.direction === 'up' ? 'Up' : 'Down'} ${change.percent}% from the ${span} before`
}

export type InsightKind = 'product' | 'service' | 'event' | 'job'

export interface InsightRow {
  item_kind: string
  item_id: string
  item_name: string
  views: number
  clicks: number
}

export interface InsightItem {
  kind: InsightKind
  id: string
  name: string
  views: number
  clicks: number
  /** Clicks per view as a whole percent; null with no views. */
  rate: number | null
}

export interface Insights {
  storefront: {
    /** Products and services on this page, with or without activity. */
    itemCount: number
    views: number
    clicks: number
    rate: number | null
    /** Up to 5 items that had any views or clicks, most viewed first. */
    top: InsightItem[]
  }
  /** Events and jobs this owner posted from the page, most viewed first. */
  postings: InsightItem[]
}

export const TOP_ITEMS = 5

const KINDS: readonly InsightKind[] = ['product', 'service', 'event', 'job']

export function clickRate(views: number, clicks: number): number | null {
  if (!(views > 0)) return null
  return Math.round((clicks / views) * 100)
}

function byActivity(a: InsightItem, b: InsightItem): number {
  return b.views - a.views || b.clicks - a.clicks || a.name.localeCompare(b.name)
}

/** Splits the function's rows into the Storefront and Events and Jobs sections. */
export function summarizeInsights(rows: readonly InsightRow[]): Insights {
  const items: InsightItem[] = []
  for (const r of rows) {
    if (!KINDS.includes(r.item_kind as InsightKind)) continue
    const views = Number(r.views) || 0
    const clicks = Number(r.clicks) || 0
    items.push({
      kind: r.item_kind as InsightKind,
      id: r.item_id,
      name: r.item_name,
      views,
      clicks,
      rate: clickRate(views, clicks),
    })
  }

  const shop = items.filter((i) => i.kind === 'product' || i.kind === 'service')
  const views = shop.reduce((n, i) => n + i.views, 0)
  const clicks = shop.reduce((n, i) => n + i.clicks, 0)

  return {
    storefront: {
      itemCount: shop.length,
      views,
      clicks,
      rate: clickRate(views, clicks),
      top: shop
        .filter((i) => i.views > 0 || i.clicks > 0)
        .sort(byActivity)
        .slice(0, TOP_ITEMS),
    },
    postings: items.filter((i) => i.kind === 'event' || i.kind === 'job').sort(byActivity),
  }
}

/**
 * What the Starter locked card lists: only what Growth would show today.
 * Storefront numbers only while the marketplace is open, jobs only while job
 * posting is open.
 */
export function advancedPreviewLines(opts: {
  marketplaceOpen: boolean
  jobsOpen: boolean
}): string[] {
  return [
    'Each number compared with the period before',
    'Your numbers over 90 days and 12 months',
    ...(opts.marketplaceOpen ? ['Views and clicks for each storefront item'] : []),
    opts.jobsOpen
      ? 'Views and taps for the events and jobs you post'
      : 'Views and taps for the events you post',
  ]
}
