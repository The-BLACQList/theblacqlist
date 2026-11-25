import { NextRequest, NextResponse } from 'next/server'

import { getAdminSession } from '@/lib/admin/guard'
import {
  SITE_TOUR_CSV_HEADER,
  SITE_TOUR_EVENT_NAMES,
  siteTourTotals,
  type SiteTourEventRow,
} from '@/lib/site-tour/report'
import { createServiceClient } from '@/lib/supabase/server'

const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const
type Period = keyof typeof PERIOD_DAYS
const isPeriod = (value: string): value is Period => value in PERIOD_DAYS

/** The database answers with at most this many rows at a time. */
const PAGE = 1000
const MAX_ROWS = 100_000

// Daily totals of the site tour (ticket 280): counts by day, path, step and
// start. No account, session or device.
export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const asked = req.nextUrl.searchParams.get('period') ?? ''
  const days = PERIOD_DAYS[isPeriod(asked) ? asked : '30d']
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const service = createServiceClient()
  const rows: SiteTourEventRow[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await service
      .from('analytics_events')
      .select('event_name, created_at, properties')
      .in('event_name', [...SITE_TOUR_EVENT_NAMES])
      .gte('created_at', since)
      .order('created_at')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: 'Failed to fetch data.' }, { status: 500 })
    rows.push(...(data ?? []))
    if ((data ?? []).length < PAGE) break
  }

  const date = new Date().toISOString().slice(0, 10)
  return new Response([SITE_TOUR_CSV_HEADER, ...siteTourTotals(rows)].join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="site-tour-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
