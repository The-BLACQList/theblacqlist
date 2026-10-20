import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'

// Only zero-result searches are logged (ticket 142), so 'top' is gone: it would
// export the same rows under a wrong name. ?table=top now answers 400.
const VALID_TABLES = ['zero'] as const
const VALID_PERIODS = ['7d', '30d', '90d'] as const
type TableType = (typeof VALID_TABLES)[number]
type Period = (typeof VALID_PERIODS)[number]
const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90 }

function csvEscape(value: string | number | null): string {
  if (value === null || value === undefined) return ''
  let str = String(value)
  // Queries are typed by the public. A leading = + - @ (or tab / CR) would run as
  // a formula when the CSV is opened in a spreadsheet, so prefix a quote.
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsvRow(fields: (string | number | null)[]): string {
  return fields.map(csvEscape).join(',')
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const tableParam = searchParams.get('table') ?? ''
  const periodParam = searchParams.get('period') ?? '30d'
  const cityParam = searchParams.get('city') ?? ''

  if (!VALID_TABLES.includes(tableParam as TableType)) {
    return NextResponse.json({ error: 'Invalid table parameter.' }, { status: 400 })
  }
  const period: Period = VALID_PERIODS.includes(periodParam as Period)
    ? (periodParam as Period)
    : '30d'

  const service = createServiceClient()
  const since = new Date(new Date().getTime() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000).toISOString()

  // Resolve city slug → city_id
  let cityId: string | null = null
  if (cityParam) {
    const { data } = await service.from('cities').select('id').eq('slug', cityParam).maybeSingle()
    cityId = data?.id ?? null
  }

  const date = new Date().toISOString().slice(0, 10)

  let q = service
    .from('search_events')
    .select('query, created_at')
    .eq('result_count', 0)
    .gte('created_at', since)
  if (cityId) q = q.eq('city_id', cityId)
  const { data, error } = await q.limit(5000)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch data.' }, { status: 500 })
  }

  // Aggregate
  const map: Record<string, { count: number; last: string }> = {}
  for (const row of data ?? []) {
    if (!map[row.query]) {
      map[row.query] = { count: 1, last: row.created_at }
    } else {
      map[row.query]!.count++
      if (row.created_at > map[row.query]!.last) {
        map[row.query]!.last = row.created_at
      }
    }
  }
  const rows = Object.entries(map)
    .map(([query, { count, last }]) => ({ query, count, last_searched: last }))
    .sort((a, b) => b.count - a.count)

  const lines = ['query,count,last_searched']
  for (const row of rows) {
    lines.push(buildCsvRow([row.query, row.count, row.last_searched]))
  }
  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="zero-result-queries-${date}.csv"`,
    },
  })
}
