/**
 * Weekly key numbers (ticket 236). Pure calculation: no database, no clock.
 * scripts/ops/weekly-kpis.ts reads production (read-only) and passes rows in.
 *
 * One row per ISO week (Monday start, UTC). The `week` column is the Monday.
 * A number nobody can compute is the string UNKNOWN, never 0.
 * Testers and the team account are left out of every number.
 */

import { UNKNOWN, isPaidPlan, sumMonthly, type Cell, type PricedRow } from './revenue'

export { UNKNOWN, type Cell }

/** Sign-up source capture shipped in #363 (bcfb31a). Weeks before it have no channel. */
export const SOURCE_CAPTURE_START = '2026-11-20'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

export interface SubscriptionRow extends PricedRow {
  id: string
  listing_id: string | null
  user_id: string | null
  status: string
  created_at: string
  canceled_at: string | null
}

export interface ClaimRow {
  listing_id: string
  claimant_user_id: string | null
  status: string
  submitted_at: string | null
  created_at: string
  reviewed_at: string | null
}

export interface SignupRow {
  user_id: string
  created_at: string
  source: string | null
  utm_source: string | null
  utm_medium: string | null
  referrer: string | null
}

export interface SaveRow {
  user_id: string | null
  created_at: string
}

export interface SaveEventRow {
  user_id: string | null
  created_at: string
  action: string | null
}

export interface KpiInput {
  subscriptions: SubscriptionRow[]
  claims: ClaimRow[]
  signups: SignupRow[]
  saves: SaveRow[]
  saveEvents: SaveEventRow[]
  /** Testers (invites, tour enrollments, tester_link sign-ups) and admin/super_admin. */
  excludedUserIds: ReadonlySet<string>
}

export const CHANNELS = [
  'flyer',
  'invite',
  'social',
  'search',
  'referral',
  'partner',
  'direct',
  'other',
] as const
export type Channel = (typeof CHANNELS)[number]

/** Channels that only exist once source capture shipped. Flyer and invite were always recorded. */
const CAPTURED_CHANNELS: ReadonlySet<Channel> = new Set([
  'social',
  'search',
  'referral',
  'partner',
  'direct',
  'other',
])

export const COLUMNS = [
  'week',
  'paying_starter',
  'mrr_usd',
  'starter_new',
  'starter_retained_d30_pct',
  'starter_retained_d60_pct',
  'claims_submitted',
  'claims_approved',
  'claim_to_starter_pct',
  'visitors',
  'signups',
  ...CHANNELS.map((c) => `signups_${c}` as const),
  'saves_net',
  'saves_gross',
] as const
export type Column = (typeof COLUMNS)[number]

export type KpiRow = { week: string } & Record<Exclude<Column, 'week'>, Cell>

// ---------------------------------------------------------------------------
// Weeks

/** Monday 00:00 UTC of the ISO week containing `d`. */
export function isoWeekStart(d: Date): Date {
  const day = d.getUTCDay() // 0 = Sunday
  const back = (day + 6) % 7
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back))
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * The last `count` complete weeks before `now`, oldest first. With `from`,
 * every complete week from the week containing `from` instead.
 */
export function completeWeeks(now: Date, count: number, from?: Date): Date[] {
  const current = isoWeekStart(now).getTime()
  const first = from ? isoWeekStart(from).getTime() : current - count * WEEK_MS
  const weeks: Date[] = []
  for (let t = first; t < current; t += WEEK_MS) weeks.push(new Date(t))
  return weeks
}

// ---------------------------------------------------------------------------
// Sign-up channel

const SOCIAL_HOSTS = [
  'facebook.com',
  'fb.com',
  'instagram.com',
  't.co',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'lnkd.in',
  'tiktok.com',
  'threads.net',
  'reddit.com',
  'pinterest.com',
  'youtube.com',
  'youtu.be',
  'snapchat.com',
  'nextdoor.com',
]
const SEARCH_HOSTS = [
  'google.',
  'bing.com',
  'duckduckgo.com',
  'yahoo.',
  'ecosia.org',
  'search.brave.com',
  'baidu.com',
  'yandex.',
]

function hostMatches(host: string, list: readonly string[]): boolean {
  return list.some((entry) =>
    entry.endsWith('.')
      ? host.startsWith(entry) || host.includes(`.${entry}`)
      : host === entry || host.endsWith(`.${entry}`)
  )
}

function lower(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase()
}

/**
 * Where one sign-up came from. Campaign tags win, then the referring site,
 * then the stored signup_source (flyer, invite), else direct. Returns null
 * for a public sign-up from before source capture shipped: its channel is
 * not known and is not guessed.
 */
export function channelOf(
  row: Pick<SignupRow, 'source' | 'utm_source' | 'utm_medium' | 'referrer' | 'created_at'>
): Channel | null {
  const medium = lower(row.utm_medium)
  const source = lower(row.utm_source)
  if (medium || source) {
    if (['print', 'flyer', 'qr', 'offline', 'poster'].includes(medium) || source === 'flyer')
      return 'flyer'
    if (['social', 'social-media', 'sm', 'paid_social', 'organic_social'].includes(medium))
      return 'social'
    if (['cpc', 'ppc', 'search', 'organic', 'paid_search'].includes(medium)) return 'search'
    if (['partner', 'affiliate', 'partnership'].includes(medium)) return 'partner'
    if (['referral', 'email', 'newsletter'].includes(medium)) return 'referral'
    if (hostMatches(source, SOCIAL_HOSTS) || hostMatches(`${source}.com`, SOCIAL_HOSTS))
      return 'social'
    if (hostMatches(source, SEARCH_HOSTS) || hostMatches(`${source}.com`, SEARCH_HOSTS))
      return 'search'
    return 'other'
  }
  const host = lower(row.referrer).replace(/^www\./, '')
  if (host) {
    if (hostMatches(host, SOCIAL_HOSTS)) return 'social'
    if (hostMatches(host, SEARCH_HOSTS)) return 'search'
    return 'referral'
  }
  const stored = lower(row.source)
  if (stored === 'flyer') return 'flyer'
  if (stored === 'invite') return 'invite'
  if (row.created_at.slice(0, 10) < SOURCE_CAPTURE_START) return null
  return 'direct'
}

// ---------------------------------------------------------------------------
// Subscriptions

/** A subscription that took a first payment (trials and unfinished checkouts are not). */
function everPaid(s: SubscriptionRow): boolean {
  return s.status === 'active' || s.status === 'past_due' || s.status === 'canceled'
}

/** Was this subscription paying at instant `t` (ms)? Reconstructed from today's state: no history exists. */
function payingAt(s: SubscriptionRow, t: number): boolean {
  if (!everPaid(s)) return false
  if (Date.parse(s.created_at) >= t) return false
  if (s.status === 'canceled') return s.canceled_at !== null && Date.parse(s.canceled_at) >= t
  return true
}

function pct(part: number, whole: number): Cell {
  return whole === 0 ? UNKNOWN : Math.round((part / whole) * 1000) / 10
}

// ---------------------------------------------------------------------------
// Build

export interface BuildOptions {
  weeks: Date[]
  now: Date
}

export function buildWeeklyKpis(input: KpiInput, opts: BuildOptions): KpiRow[] {
  const keep = (userId: string | null): boolean =>
    userId === null || !input.excludedUserIds.has(userId)
  const nowMs = opts.now.getTime()

  const subscriptions = input.subscriptions.filter((s) => keep(s.user_id))
  const starter = subscriptions.filter((s) => s.plan_key === 'starter')
  const paidPlans = subscriptions.filter(isPaidPlan)
  const claims = input.claims.filter((c) => keep(c.claimant_user_id))
  const signups = input.signups.filter((u) => keep(u.user_id))
  const saves = input.saves.filter((s) => keep(s.user_id))
  const saveEvents = input.saveEvents.filter((e) => keep(e.user_id) && e.action === 'save')

  // Listings that ever paid for Starter, for claim → Starter.
  const paidListings = new Set(
    starter
      .filter(everPaid)
      .map((s) => s.listing_id)
      .filter((id): id is string => !!id)
  )

  const inWeek = (iso: string | null, start: number): boolean => {
    if (!iso) return false
    const t = Date.parse(iso)
    return t >= start && t < start + WEEK_MS
  }

  return opts.weeks.map((weekStart) => {
    const start = weekStart.getTime()
    const end = start + WEEK_MS

    // Paying Starter at week end, one per listing.
    const payingByListing = new Map<string, SubscriptionRow>()
    for (const s of starter) {
      if (payingAt(s, end)) payingByListing.set(s.listing_id ?? `sub:${s.id}`, s)
    }
    const paying = [...payingByListing.values()]
    // Money: every paid plan, each subscription once, because each one is billed.
    const mrr = sumMonthly(paidPlans.filter((s) => payingAt(s, end)))

    // Retention cohort: first paid Starter in this week.
    const cohort = starter.filter((s) => everPaid(s) && inWeek(s.created_at, start))
    const retained = (days: number): Cell => {
      if (cohort.length === 0) return UNKNOWN
      if (end - 1 + days * DAY_MS > nowMs) return UNKNOWN // not every member has reached day N yet
      const kept = cohort.filter((s) =>
        payingAt(s, Date.parse(s.created_at) + days * DAY_MS)
      ).length
      return pct(kept, cohort.length)
    }

    // Claims.
    const submitted = claims.filter((c) => inWeek(c.submitted_at ?? c.created_at, start)).length
    const approved = claims.filter((c) => c.status === 'approved' && inWeek(c.reviewed_at, start))
    const approvedListings = new Set(approved.map((c) => c.listing_id))
    const converted = [...approvedListings].filter((id) => paidListings.has(id)).length

    // Sign-ups by channel.
    const weekSignups = signups.filter((u) => inWeek(u.created_at, start))
    const byChannel = new Map<Channel, number>(CHANNELS.map((c) => [c, 0]))
    for (const u of weekSignups) {
      const ch = channelOf(u)
      if (ch) byChannel.set(ch, (byChannel.get(ch) ?? 0) + 1)
    }
    const beforeCapture = ymd(weekStart) < SOURCE_CAPTURE_START
    const channelCells = Object.fromEntries(
      CHANNELS.map((c) => [
        `signups_${c}`,
        beforeCapture && CAPTURED_CHANNELS.has(c) ? UNKNOWN : (byChannel.get(c) ?? 0),
      ])
    ) as Record<`signups_${Channel}`, Cell>

    return {
      week: ymd(weekStart),
      paying_starter: paying.length,
      mrr_usd: mrr,
      starter_new: cohort.length,
      starter_retained_d30_pct: retained(30),
      starter_retained_d60_pct: retained(60),
      claims_submitted: submitted,
      claims_approved: approvedListings.size,
      claim_to_starter_pct: pct(converted, approvedListings.size),
      visitors: UNKNOWN,
      signups: weekSignups.length,
      ...channelCells,
      saves_net: saves.filter((s) => inWeek(s.created_at, start)).length,
      saves_gross: saveEvents.filter((e) => inWeek(e.created_at, start)).length,
    }
  })
}

// ---------------------------------------------------------------------------
// Failed reads

/** The reads the report depends on. Labels match the summary's read errors. */
export type Source =
  | 'auth users'
  | 'plans'
  | 'subscriptions'
  | 'claims'
  | 'saves'
  | 'save_toggled events'
  | 'tour_enrollments'
  | 'tester_invites'
  | 'user_roles'

const SUBSCRIPTION_COLUMNS: readonly Column[] = [
  'paying_starter',
  'mrr_usd',
  'starter_new',
  'starter_retained_d30_pct',
  'starter_retained_d60_pct',
  'claim_to_starter_pct',
]
const EVERY_NUMBER: readonly Column[] = COLUMNS.filter((c) => c !== 'week')

/** The four reads that make up the tester and team list. */
export const EXCLUSION_SOURCES: readonly Source[] = [
  'auth users',
  'tour_enrollments',
  'tester_invites',
  'user_roles',
]

/**
 * The columns a failed read makes untrue. Without the full tester and team list,
 * every number would include testers. Sign-ups and the tester_link list both come
 * from auth users, so that read also spoils everything.
 */
const SPOILS: Record<Source, readonly Column[]> = {
  'auth users': EVERY_NUMBER,
  tour_enrollments: EVERY_NUMBER,
  tester_invites: EVERY_NUMBER,
  user_roles: EVERY_NUMBER,
  plans: SUBSCRIPTION_COLUMNS,
  subscriptions: SUBSCRIPTION_COLUMNS,
  claims: ['claims_submitted', 'claims_approved', 'claim_to_starter_pct'],
  saves: ['saves_net'],
  'save_toggled events': ['saves_gross'],
}

/** Replace every number that depends on a failed read with UNKNOWN. */
export function withFailedSources(rows: KpiRow[], failed: ReadonlySet<Source>): KpiRow[] {
  const spoiled = new Set([...failed].flatMap((source) => SPOILS[source]))
  if (spoiled.size === 0) return rows
  return rows.map(
    (row) =>
      Object.fromEntries(
        COLUMNS.map((c) => [c, spoiled.has(c) ? UNKNOWN : row[c]])
      ) as unknown as KpiRow
  )
}

// ---------------------------------------------------------------------------
// Output

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: KpiRow[]): string {
  const lines = [COLUMNS.join(',')]
  for (const row of rows) lines.push(COLUMNS.map((c) => csvCell(row[c])).join(','))
  return `${lines.join('\n')}\n`
}

/** Columns with no UNKNOWN cell in these rows: safe for `metrics.py import --map` as recorded facts. */
export function knownColumns(rows: KpiRow[]): Column[] {
  return COLUMNS.filter(
    (c) => c !== 'week' && rows.length > 0 && rows.every((r) => r[c] !== UNKNOWN)
  )
}

export function unknownColumns(rows: KpiRow[]): Column[] {
  return COLUMNS.filter((c) => c !== 'week' && rows.some((r) => r[c] === UNKNOWN))
}

export interface SummaryContext {
  /** Null when a tester or team read failed. */
  excludedCount: number | null
  topUtmSources: Array<[string, number]>
  sourceErrors: string[]
}

function usd(v: Cell): string {
  return v === UNKNOWN ? UNKNOWN : `$${v}`
}

export function summaryLines(rows: KpiRow[], ctx: SummaryContext): string[] {
  const lines: string[] = []
  if (rows.length === 0) return ['No complete weeks in range.']
  const first = rows[0]!
  const last = rows[rows.length - 1]!
  lines.push(
    `Weeks: ${first.week} to ${last.week} (${rows.length}, Monday start, UTC). ${
      ctx.excludedCount === null
        ? 'The tester and team list could not be read.'
        : `Left out: ${ctx.excludedCount} tester and team accounts.`
    }`
  )
  lines.push(
    `Latest week ${last.week}: ${last.paying_starter} paying Starter, MRR (all paid plans) ${usd(last.mrr_usd)}, ${last.signups} sign-ups, ${last.claims_submitted} claims, ${last.saves_net} saves kept (${last.saves_gross} made).`
  )
  if (ctx.sourceErrors.length > 0) {
    lines.push(
      `Read errors (every number that needs them is UNKNOWN this run): ${ctx.sourceErrors.join('; ')}.`
    )
  }
  lines.push('Gaps:')
  lines.push(
    '- visitors: always UNKNOWN. Vercel Web Analytics has no export; read it in the Vercel dashboard.'
  )
  lines.push(
    `- signups_social, _search, _referral, _partner, _direct, _other: UNKNOWN for weeks starting before ${SOURCE_CAPTURE_START} (source capture, #363). Before then only flyer and invite were recorded.`
  )
  lines.push(
    '- saves_net counts saves still kept today (unsaving deletes the row). saves_gross counts save clicks from events.'
  )
  lines.push(
    "- mrr_usd: all paid plans; a yearly plan counts as its yearly price / 12. The cycle comes from today's billing period (no history), so a past week shows today's cycle and price. UNKNOWN when a counted plan's cycle or price is not known. Discounts, tax and Stripe invoices are not read."
  )
  lines.push(
    "- paying_starter, mrr_usd, retention: rebuilt from today's subscription state (no status history). Past due counts as paying; unfinished checkouts and trials do not."
  )
  lines.push(
    "- starter_retained_d30_pct / _d60_pct: UNKNOWN until every member of that week's cohort has reached day 30 / 60, or when the cohort is empty."
  )
  lines.push(
    '- claim_to_starter_pct: claims approved that week whose business has paid for Starter to date; it can rise later. UNKNOWN when no claims were approved.'
  )
  if (ctx.topUtmSources.length > 0) {
    lines.push(
      `Top campaign sources: ${ctx.topUtmSources.map(([s, n]) => `${s} ${n}`).join(', ')}.`
    )
  }
  const known = knownColumns(rows)
  const unknown = unknownColumns(rows)
  lines.push(`Fully known (import as recorded facts): ${known.join(', ') || 'none'}.`)
  lines.push(
    `Has UNKNOWN cells (import with --fact-class unknown, or leave out): ${unknown.join(', ') || 'none'}.`
  )
  return lines
}
