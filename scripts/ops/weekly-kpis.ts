/**
 * Weekly key numbers (ticket 236). Reads production Supabase, read-only, and
 * writes one CSV row per ISO week plus a few summary lines. The calculation
 * lives in lib/ops/weeklyKpis.ts.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/ops/weekly-kpis.ts [--weeks=8] [--from=YYYY-MM-DD]
 *
 * Output: docs/blacqlist/ops/reports/weekly-kpis-YYYYMMDD.csv and
 *         docs/blacqlist/ops/reports/weekly-kpis-YYYYMMDD.txt (summary)
 * Import: metrics.py import <slug> <csv> --period-column week --map "..."
 *
 * Testers and the team account are left out. Any table that fails to read is
 * named in the summary; its columns should not be trusted for that run.
 * Exits 1 with a clear message if Supabase env is not set.
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  buildWeeklyKpis,
  completeWeeks,
  summaryLines,
  toCsv,
  type ClaimRow,
  type SaveEventRow,
  type SaveRow,
  type SignupRow,
  type SubscriptionRow,
} from '../../lib/ops/weeklyKpis'
import { excludedUserIds, type PricedRow } from '../../lib/ops/revenue'

const SUPABASE_URL = process.env['SUPABASE_URL']
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  console.error('Values are in .env.local (never commit them).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const PAGE = 1000

function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length)
}

const sourceErrors: string[] = []

/** Read every row of a select, a page at a time. Records the failure and returns [] on error. */
async function readAll<T>(
  label: string,
  query: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1)
    if (error) {
      sourceErrors.push(`${label}: ${error.message}`)
      return []
    }
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

interface AuthUser {
  id: string
  created_at: string
  user_metadata?: Record<string, unknown> | null
}

async function readUsers(): Promise<AuthUser[]> {
  const out: AuthUser[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE })
    if (error) {
      sourceErrors.push(`auth users: ${error.message}`)
      return out
    }
    out.push(...(data.users as AuthUser[]))
    if (data.users.length < PAGE) return out
  }
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

async function main(): Promise<void> {
  const now = new Date()
  const fromArg = arg('from')
  const from = fromArg ? new Date(`${fromArg}T00:00:00Z`) : undefined
  if (from && Number.isNaN(from.getTime())) {
    console.error(`Error: --from=${fromArg} is not a date (YYYY-MM-DD).`)
    process.exit(1)
  }
  const weeks = completeWeeks(now, Number(arg('weeks')) || 8, from)

  const [users, plans, subs, claims, saves, saveEvents, tours, invites, roles] = await Promise.all([
    readUsers(),
    readAll<{ id: string } & Pick<PricedRow, 'plan_key' | 'price_monthly' | 'price_yearly'>>(
      'plans',
      (a, b) =>
        supabase.from('plans').select('id, plan_key, price_monthly, price_yearly').range(a, b)
    ),
    readAll<
      Omit<SubscriptionRow, 'plan_key' | 'price_monthly' | 'price_yearly'> & {
        plan_id: string | null
      }
    >('subscriptions', (a, b) =>
      supabase
        .from('subscriptions')
        .select(
          'id, listing_id, user_id, plan_id, status, created_at, canceled_at, current_period_start, current_period_end'
        )
        .order('id')
        .range(a, b)
    ),
    readAll<ClaimRow>('claims', (a, b) =>
      supabase
        .from('claims')
        .select('listing_id, claimant_user_id, status, submitted_at, created_at, reviewed_at')
        .order('id')
        .range(a, b)
    ),
    readAll<SaveRow>('saves', (a, b) =>
      supabase.from('saves').select('user_id, created_at').order('id').range(a, b)
    ),
    readAll<{
      user_id: string | null
      created_at: string
      properties: Record<string, unknown> | null
    }>('save_toggled events', (a, b) =>
      supabase
        .from('analytics_events')
        .select('user_id, created_at, properties')
        .eq('event_name', 'save_toggled')
        .order('id')
        .range(a, b)
    ),
    readAll<{ tester_user_id: string | null }>('tour_enrollments', (a, b) =>
      supabase.from('tour_enrollments').select('tester_user_id').range(a, b)
    ),
    readAll<{ tester_user_id: string | null }>('tester_invites', (a, b) =>
      supabase.from('tester_invites').select('tester_user_id').range(a, b)
    ),
    readAll<{ user_id: string }>('user_roles', (a, b) =>
      supabase.from('user_roles').select('user_id').in('role', ['admin', 'super_admin']).range(a, b)
    ),
  ])

  const excluded = excludedUserIds({ tours, invites, roles, users })

  const planById = new Map(plans.map((p) => [p.id, p]))
  const subscriptions: SubscriptionRow[] = subs.map((s) => {
    const plan = s.plan_id ? planById.get(s.plan_id) : undefined
    return {
      ...s,
      plan_key: plan?.plan_key ?? null,
      price_monthly: plan?.price_monthly ?? null,
      price_yearly: plan?.price_yearly ?? null,
    }
  })

  const signups: SignupRow[] = users.map((u) => {
    const m = u.user_metadata ?? {}
    return {
      user_id: u.id,
      created_at: u.created_at,
      source: str(m['signup_source']),
      utm_source: str(m['signup_utm_source']),
      utm_medium: str(m['signup_utm_medium']),
      referrer: str(m['signup_referrer']),
    }
  })

  const events: SaveEventRow[] = saveEvents.map((e) => ({
    user_id: e.user_id,
    created_at: e.created_at,
    action: str(e.properties?.['action']),
  }))

  const rows = buildWeeklyKpis(
    { subscriptions, claims, signups, saves, saveEvents: events, excludedUserIds: excluded },
    { weeks, now }
  )

  const utmCounts = new Map<string, number>()
  for (const s of signups) {
    if (excluded.has(s.user_id) || !s.utm_source) continue
    utmCounts.set(s.utm_source, (utmCounts.get(s.utm_source) ?? 0) + 1)
  }
  const topUtmSources = [...utmCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const summary = summaryLines(rows, { excludedCount: excluded.size, topUtmSources, sourceErrors })

  const dir = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'docs',
    'blacqlist',
    'ops',
    'reports'
  )
  mkdirSync(dir, { recursive: true })
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  const csvFile = join(dir, `weekly-kpis-${stamp}.csv`)
  const txtFile = join(dir, `weekly-kpis-${stamp}.txt`)
  writeFileSync(csvFile, toCsv(rows))
  writeFileSync(txtFile, `${summary.join('\n')}\n`)

  console.log(summary.join('\n'))
  console.log(`\nWrote ${csvFile}`)
  console.log(`Wrote ${txtFile}`)
  if (sourceErrors.length > 0) process.exitCode = 2
}

main().catch((err) => {
  console.error(`weekly-kpis failed: ${(err as Error).message}`)
  process.exit(1)
})
