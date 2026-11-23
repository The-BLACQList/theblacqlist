/**
 * Pull real BLACQList metrics from Supabase for a reporting window and write a
 * metrics JSON for the analytics-reporting-agent. Read-only.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/ops/metrics-pull.ts [--days=7]
 *
 * Output: docs/blacqlist/ops/reports/metrics-YYYYMMDD.json
 * Any source that errors is recorded under "unknown" rather than faked.
 * Testers and the team are left out of sign-ups, subscriptions and named events
 * (ticket 271, the same rule as weekly-kpis.ts). Page views, top listings and top
 * searches are stored as totals, so they cannot be filtered.
 * Exits 1 with a clear message if Supabase env is not set.
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { excludedUserIds, subscriptionSummary, type SummaryRow } from '../../lib/ops/revenue'

const SUPABASE_URL = process.env['SUPABASE_URL']
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  console.error('Values are in .env.local (never commit them).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function argNum(name: string, fallback: number): number {
  const prefix = `--${name}=`
  const match = process.argv.find((a) => a.startsWith(prefix))
  return match ? Number(match.slice(prefix.length)) || fallback : fallback
}

const days = argNum('days', 7)
const now = new Date()
const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
const sinceIso = since.toISOString()
const sinceDate = sinceIso.slice(0, 10)

const unknown: string[] = []

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch (err) {
    unknown.push(`${label}: ${(err as Error).message}`)
    return null
  }
}

const PAGE = 1000
const ID_CHUNK = 100

type Query = PromiseLike<{ data: unknown; error: { message: string } | null }>

/** Every row of a select, a page at a time. Throws on error. */
async function readAll<T>(query: (from: number, to: number) => Query): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

/** Testers and the team. Throws if any of the four reads fails: never half a list. */
async function readExcluded(): Promise<Set<string>> {
  const users: Array<{ id: string; user_metadata?: Record<string, unknown> | null }> = []
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE })
    if (error) throw new Error(error.message)
    users.push(...data.users)
    if (data.users.length < PAGE) break
  }
  const [tours, invites, roles] = await Promise.all([
    readAll<{ tester_user_id: string | null }>((a, b) =>
      supabase.from('tour_enrollments').select('tester_user_id').order('id').range(a, b)
    ),
    readAll<{ tester_user_id: string | null }>((a, b) =>
      supabase.from('tester_invites').select('tester_user_id').order('id').range(a, b)
    ),
    readAll<{ user_id: string }>((a, b) =>
      supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'super_admin'])
        .order('id')
        .range(a, b)
    ),
  ])
  return excludedUserIds({ tours, invites, roles, users })
}

/** The number would include testers, so it goes under "unknown" instead. */
function needExcluded(excluded: Set<string> | null): Set<string> {
  if (!excluded) throw new Error('tester and team accounts could not be read, so not printed')
  return excluded
}

type CountResult = PromiseLike<{ count: number | null; error: { message: string } | null }>

/** A count that came back empty is a failed read, not 0. */
async function readCount(query: CountResult): Promise<number> {
  const { count, error } = await query
  if (error) throw new Error(error.message || 'count failed')
  if (count === null) throw new Error('count came back empty')
  return count
}

/** Total rows minus those of the excluded accounts. Signed-out rows stay in. */
async function countKept(
  total: CountResult,
  ofUsers: (ids: string[]) => CountResult,
  excluded: Set<string>
): Promise<number> {
  let kept = await readCount(total)
  const ids = [...excluded]
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    kept -= await readCount(ofUsers(ids.slice(i, i + ID_CHUNK)))
  }
  return kept
}

async function main(): Promise<void> {
  const excluded = await safe('tester and team accounts', readExcluded)

  const engagement = await safe('entity_analytics_daily', async () => {
    const { data, error } = await supabase
      .from('entity_analytics_daily')
      .select('page_views, cta_clicks, saves, shares, search_impressions')
      .gte('snapshot_date', sinceDate)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<Record<string, number>>
    const sum = (key: string): number => rows.reduce((acc, row) => acc + (row[key] ?? 0), 0)
    return {
      page_views: sum('page_views'),
      cta_clicks: sum('cta_clicks'),
      saves: sum('saves'),
      shares: sum('shares'),
      search_impressions: sum('search_impressions'),
      rows: rows.length,
    }
  })

  const topListings = await safe('get_top_listings_by_views', async () => {
    const { data, error } = await supabase.rpc('get_top_listings_by_views', { limit_n: 10, days_back: days })
    if (error) throw new Error(error.message)
    return data
  })

  const topSearches = await safe('get_top_search_queries', async () => {
    const { data, error } = await supabase.rpc('get_top_search_queries', { limit_n: 10, days_back: days })
    if (error) throw new Error(error.message)
    return data
  })

  const signups = await safe('profiles.new', async () => {
    const base = () =>
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sinceIso)
    return countKept(base(), (ids) => base().in('id', ids), needExcluded(excluded))
  })

  const subscriptions = await safe('subscriptions+plans', async () => {
    const out = needExcluded(excluded)
    const [subs, plans] = await Promise.all([
      readAll<Omit<SummaryRow, 'plan_key' | 'price_monthly' | 'price_yearly'> & { plan_id: string | null }>(
        (a, b) =>
          supabase
            .from('subscriptions')
            .select('user_id, status, plan_id, current_period_start, current_period_end')
            .order('id')
            .range(a, b)
      ),
      readAll<{ id: string } & Pick<SummaryRow, 'plan_key' | 'price_monthly' | 'price_yearly'>>((a, b) =>
        supabase.from('plans').select('id, plan_key, price_monthly, price_yearly').order('id').range(a, b)
      ),
    ])
    const planById = new Map(plans.map((p) => [p.id, p]))
    const rows: SummaryRow[] = subs.map((s) => {
      const plan = s.plan_id ? planById.get(s.plan_id) : undefined
      return {
        ...s,
        plan_key: plan?.plan_key ?? null,
        price_monthly: plan?.price_monthly ?? null,
        price_yearly: plan?.price_yearly ?? null,
      }
    })
    return {
      ...subscriptionSummary(rows, out),
      note: 'MRR = all paid plans, active and past due; a yearly plan counts as price_yearly / 12, read from its billing period. UNKNOWN when a plan cycle or price is not known. Testers and team left out. Excludes proration/discounts/tax. Stripe invoice detail not queried.',
    }
  })

  const funnelEvents = await safe('analytics_events.byName', async () => {
    const names = [
      'search_performed',
      'page_view',
      'cta_click',
      'save_toggled',
      'claim_started',
      'claim_submitted',
      'listing_submitted',
    ]
    const out = needExcluded(excluded)
    const counts: Record<string, number> = {}
    for (const name of names) {
      const base = () =>
        supabase
          .from('analytics_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_name', name)
          .gte('created_at', sinceIso)
      counts[name] = await countKept(base(), (ids) => base().in('user_id', ids), out)
    }
    return counts
  })

  // Cover coverage. Real covers arrive only from owners (Decision 023 — the
  // owner-upload flywheel), so this is the number that says whether the
  // flywheel is turning. It is a post-launch target, not a launch gate.
  const coverCoverage = await safe('listings.cover_image_path', async () => {
    const base = () =>
      supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('status', 'published')

    const { count: total, error: totalErr } = await base()
    if (totalErr) throw new Error(totalErr.message)

    const { count: withCover, error: coverErr } = await base().not('cover_image_path', 'is', null)
    if (coverErr) throw new Error(coverErr.message)

    const published = total ?? 0
    const covered = withCover ?? 0
    return {
      published,
      with_cover: covered,
      pct: published > 0 ? Math.round((covered / published) * 1000) / 10 : 0,
      target_pct: 40,
      note: 'Post-launch target on the owner-upload flywheel. Listings without a cover render the F-1 brand tile.',
    }
  })

  const aggregationHealth = await safe('analytics_job_log', async () => {
    const { data, error } = await supabase
      .from('analytics_job_log')
      .select('run_date, status, listings_processed, errors')
      .order('run_date', { ascending: false })
      .limit(1)
    if (error) throw new Error(error.message)
    return data?.[0] ?? null
  })

  const out = {
    generatedAt: now.toISOString(),
    window: { days, since: sinceIso },
    source: 'Supabase (service role)',
    external_unavailable: ['Vercel Web Vitals (dashboard only)', 'Stripe invoice detail (Stripe API only)'],
    left_out: {
      tester_team_accounts: excluded ? excluded.size : null,
      filtered: ['signups', 'subscriptions', 'funnelEvents'],
      not_filtered: ['engagement', 'topListings', 'topSearches'],
    },
    aggregationHealth,
    coverCoverage,
    engagement,
    topListings,
    topSearches,
    signups,
    subscriptions,
    funnelEvents,
    unknown,
  }

  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'blacqlist', 'ops', 'reports')
  mkdirSync(dir, { recursive: true })
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  const file = join(dir, `metrics-${stamp}.json`)
  writeFileSync(file, JSON.stringify(out, null, 2))

  console.log(`[ops/metrics-pull] wrote ${file}`)
  if (unknown.length > 0) {
    console.log(`[ops/metrics-pull] ${unknown.length} source(s) unavailable → recorded under "unknown"`)
  }
}

main().catch((err) => {
  console.error('[ops/metrics-pull]', err)
  process.exit(1)
})
