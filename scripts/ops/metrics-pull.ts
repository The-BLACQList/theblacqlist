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
 * Exits 1 with a clear message if Supabase env is not set.
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

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

async function main(): Promise<void> {
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
    const { count, error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sinceIso)
    if (error) throw new Error(error.message)
    return count ?? 0
  })

  const subscriptions = await safe('subscriptions+plans', async () => {
    const { data: subs, error: subErr } = await supabase.from('subscriptions').select('status, plan_id')
    if (subErr) throw new Error(subErr.message)
    const { data: plans, error: planErr } = await supabase.from('plans').select('id, name, price_monthly')
    if (planErr) throw new Error(planErr.message)
    const priceById = new Map<string, number>()
    for (const plan of (plans ?? []) as Array<{ id: string; price_monthly: number }>) {
      priceById.set(plan.id, Number(plan.price_monthly) || 0)
    }
    const byStatus: Record<string, number> = {}
    let mrr = 0
    for (const sub of (subs ?? []) as Array<{ status: string; plan_id: string | null }>) {
      byStatus[sub.status] = (byStatus[sub.status] ?? 0) + 1
      if (sub.status === 'active' && sub.plan_id) mrr += priceById.get(sub.plan_id) ?? 0
    }
    return {
      byStatus,
      mrr_usd: mrr,
      note: 'MRR = sum of active plan price_monthly; excludes proration/discounts/tax. Stripe invoice detail not queried.',
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
    const counts: Record<string, number> = {}
    for (const name of names) {
      const { count, error } = await supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', name)
        .gte('created_at', sinceIso)
      if (error) throw new Error(error.message)
      counts[name] = count ?? 0
    }
    return counts
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
    aggregationHealth,
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
