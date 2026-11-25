// Daily totals of the site tour's events (ticket 280), for the admin CSV. The
// events come from browsers and the endpoint takes anything, so every value is
// checked against its own list before it counts; nothing else gets through.

import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import { SITE_TOUR_CHAPTERS, SITE_TOUR_COPY, SITE_TOUR_END } from '@/lib/site-tour/copy'

export const SITE_TOUR_EVENT_NAMES: readonly string[] = [
  ANALYTICS_EVENTS.SITE_TOUR_SHOWN,
  ANALYTICS_EVENTS.SITE_TOUR_RESTARTED,
  ANALYTICS_EVENTS.SITE_TOUR_PATH_CHOSEN,
  ANALYTICS_EVENTS.SITE_TOUR_STEP_VIEWED,
  ANALYTICS_EVENTS.SITE_TOUR_ENDED,
  ANALYTICS_EVENTS.SITE_TOUR_COMPLETED,
  ANALYTICS_EVENTS.SITE_TOUR_CTA,
]

const KNOWN: Record<'path' | 'start' | 'step' | 'cta', ReadonlySet<string>> = {
  path: new Set(['shopper', 'owner']),
  start: new Set(['home', 'for_business', 'prompt', 'menu', 'footer']),
  step: new Set(['welcome', 'end', ...Object.keys(SITE_TOUR_COPY), ...Object.keys(SITE_TOUR_CHAPTERS)]),
  cta: new Set(Object.values(SITE_TOUR_END).flatMap((end) => [end.go.cta, end.other.cta])),
}

export interface SiteTourEventRow {
  event_name: string
  created_at: string
  properties: unknown
}

export const SITE_TOUR_CSV_HEADER = 'date_utc,event,path,start,step,cta,count'

export function siteTourTotals(rows: readonly SiteTourEventRow[]): string[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!SITE_TOUR_EVENT_NAMES.includes(row.event_name)) continue
    const props =
      row.properties && typeof row.properties === 'object'
        ? (row.properties as Record<string, unknown>)
        : {}
    const field = (name: keyof typeof KNOWN) => {
      const value = props[name]
      return typeof value === 'string' && KNOWN[name].has(value) ? value : ''
    }
    const line = [
      row.created_at.slice(0, 10),
      row.event_name,
      field('path'),
      field('start'),
      field('step'),
      field('cta'),
    ].join(',')
    counts.set(line, (counts.get(line) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([line, count]) => `${line},${count}`)
}
