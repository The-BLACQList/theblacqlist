import { describe, expect, it } from 'vitest'
import {
  UNKNOWN,
  buildWeeklyKpis,
  channelOf,
  completeWeeks,
  isoWeekStart,
  knownColumns,
  summaryLines,
  toCsv,
  unknownColumns,
  ymd,
  type KpiInput,
  type SignupRow,
  type SubscriptionRow,
} from '../lib/ops/weeklyKpis'

const sub = (over: Partial<SubscriptionRow>): SubscriptionRow => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  listing_id: 'L1',
  user_id: 'u1',
  plan_key: 'starter',
  price_monthly: 19,
  price_yearly: 182,
  status: 'active',
  created_at: '2026-11-24T12:00:00Z',
  canceled_at: null,
  current_period_start: '2026-11-24T12:00:00Z',
  current_period_end: '2026-12-24T12:00:00Z',
  ...over,
})

const signup = (over: Partial<SignupRow>): SignupRow => ({
  user_id: over.user_id ?? Math.random().toString(36).slice(2),
  created_at: '2026-11-24T12:00:00Z',
  source: 'public',
  utm_source: null,
  utm_medium: null,
  referrer: null,
  ...over,
})

const empty = (over: Partial<KpiInput> = {}): KpiInput => ({
  subscriptions: [],
  claims: [],
  signups: [],
  saves: [],
  saveEvents: [],
  excludedUserIds: new Set(),
  ...over,
})

const W = (d: string) => new Date(`${d}T00:00:00Z`)

describe('weeks', () => {
  it('starts ISO weeks on Monday, UTC', () => {
    expect(ymd(isoWeekStart(new Date('2026-11-22T23:59:00Z')))).toBe('2026-11-16') // Sunday
    expect(ymd(isoWeekStart(new Date('2026-11-23T00:00:00Z')))).toBe('2026-11-23') // Monday
  })

  it('lists only complete weeks, oldest first', () => {
    const weeks = completeWeeks(new Date('2026-12-02T10:00:00Z'), 3).map(ymd)
    expect(weeks).toEqual(['2026-11-09', '2026-11-16', '2026-11-23'])
  })

  it('starts from the week holding --from', () => {
    const weeks = completeWeeks(new Date('2026-12-02T10:00:00Z'), 8, W('2026-11-19')).map(ymd)
    expect(weeks).toEqual(['2026-11-16', '2026-11-23'])
  })
})

describe('channelOf', () => {
  it('lets campaign tags win over everything', () => {
    expect(channelOf(signup({ utm_medium: 'social', referrer: 'google.com' }))).toBe('social')
    expect(channelOf(signup({ utm_source: 'instagram' }))).toBe('social')
    expect(channelOf(signup({ utm_medium: 'cpc' }))).toBe('search')
    expect(channelOf(signup({ utm_medium: 'partner' }))).toBe('partner')
    expect(channelOf(signup({ utm_medium: 'qr', source: 'public' }))).toBe('flyer')
    expect(channelOf(signup({ utm_source: 'mystery' }))).toBe('other')
  })

  it('reads the referring site next', () => {
    expect(channelOf(signup({ referrer: 'l.facebook.com' }))).toBe('social')
    expect(channelOf(signup({ referrer: 'www.google.co.uk' }))).toBe('search')
    expect(channelOf(signup({ referrer: 'duckduckgo.com' }))).toBe('search')
    expect(channelOf(signup({ referrer: 'atlantablackbiz.org' }))).toBe('referral')
  })

  it('falls back to the stored source, then direct', () => {
    expect(channelOf(signup({ source: 'flyer' }))).toBe('flyer')
    expect(channelOf(signup({ source: 'invite' }))).toBe('invite')
    expect(channelOf(signup({ source: 'public' }))).toBe('direct')
  })

  it('does not guess a public sign-up from before capture shipped', () => {
    expect(channelOf(signup({ source: 'public', created_at: '2026-11-19T23:00:00Z' }))).toBeNull()
    expect(channelOf(signup({ source: 'flyer', created_at: '2026-11-01T00:00:00Z' }))).toBe('flyer')
  })
})

describe('buildWeeklyKpis', () => {
  const now = new Date('2027-03-01T00:00:00Z')

  it('counts paying Starter at week end, one per listing, and MRR for every paid plan', () => {
    const input = empty({
      subscriptions: [
        sub({ listing_id: 'L1' }),
        sub({ listing_id: 'L1', status: 'canceled', canceled_at: '2026-11-25T00:00:00Z' }), // duplicate listing
        sub({ listing_id: 'L2', status: 'past_due' }),
        sub({ listing_id: 'L3', status: 'trialing' }),
        sub({ listing_id: 'L4', status: 'inactive' }),
        sub({ listing_id: 'L5', plan_key: 'growth', price_monthly: 49 }), // money, not Starter
        sub({ listing_id: 'L7', plan_key: 'free', price_monthly: 0 }),
        sub({ listing_id: 'L6', created_at: '2026-12-01T00:00:00Z' }), // next week
      ],
    })
    const [row] = buildWeeklyKpis(input, { weeks: [W('2026-11-23')], now })
    expect(row!.paying_starter).toBe(2)
    expect(row!.mrr_usd).toBe(87)
  })

  it('stops counting a canceled plan after it ends', () => {
    const input = empty({
      subscriptions: [sub({ status: 'canceled', canceled_at: '2026-12-03T00:00:00Z' })],
    })
    const rows = buildWeeklyKpis(input, {
      weeks: [W('2026-11-23'), W('2026-11-30'), W('2026-12-07')],
      now,
    })
    expect(rows.map((r) => r.paying_starter)).toEqual([1, 0, 0])
  })

  it('counts a yearly plan as 1/12 a month, and each billed subscription once', () => {
    const yearly = { current_period_end: '2027-11-24T12:00:00Z' }
    const input = empty({
      subscriptions: [sub(yearly), sub({ ...yearly, listing_id: 'L2' }), sub({ listing_id: 'L2' })],
    })
    const [row] = buildWeeklyKpis(input, { weeks: [W('2026-11-23')], now })
    expect(row!.paying_starter).toBe(2)
    expect(row!.mrr_usd).toBe(49.33)
  })

  it('prints UNKNOWN MRR when a billing cycle or plan is not known', () => {
    for (const over of [{ current_period_end: null }, { plan_key: null, price_monthly: null }]) {
      const input = empty({ subscriptions: [sub({}), sub({ listing_id: 'L2', ...over })] })
      const [row] = buildWeeklyKpis(input, { weeks: [W('2026-11-23')], now })
      expect(row!.mrr_usd).toBe(UNKNOWN)
    }
  })

  it('prints UNKNOWN MRR when a plan price is missing', () => {
    const input = empty({ subscriptions: [sub({ price_monthly: null })] })
    const [row] = buildWeeklyKpis(input, { weeks: [W('2026-11-23')], now })
    expect(row!.mrr_usd).toBe(UNKNOWN)
  })

  it('leaves testers and the team out of every number', () => {
    const input = empty({
      subscriptions: [sub({ user_id: 'tester' }), sub({ user_id: 'u2', listing_id: 'L2' })],
      claims: [
        {
          listing_id: 'L9',
          claimant_user_id: 'admin',
          status: 'approved',
          submitted_at: '2026-11-24T00:00:00Z',
          created_at: '2026-11-24T00:00:00Z',
          reviewed_at: '2026-11-25T00:00:00Z',
        },
      ],
      signups: [signup({ user_id: 'tester' }), signup({ user_id: 'u2' })],
      saves: [
        { user_id: 'admin', created_at: '2026-11-24T00:00:00Z' },
        { user_id: 'u2', created_at: '2026-11-24T00:00:00Z' },
      ],
      saveEvents: [{ user_id: 'tester', created_at: '2026-11-24T00:00:00Z', action: 'save' }],
      excludedUserIds: new Set(['tester', 'admin']),
    })
    const [row] = buildWeeklyKpis(input, { weeks: [W('2026-11-23')], now })
    expect(row!.paying_starter).toBe(1)
    expect(row!.claims_submitted).toBe(0)
    expect(row!.signups).toBe(1)
    expect(row!.saves_net).toBe(1)
    expect(row!.saves_gross).toBe(0)
  })

  it('reads day-30 and day-60 retention by start-week cohort', () => {
    const input = empty({
      subscriptions: [
        sub({ listing_id: 'A' }),
        sub({ listing_id: 'B', status: 'canceled', canceled_at: '2026-12-10T00:00:00Z' }), // left before day 30
        sub({ listing_id: 'C', status: 'canceled', canceled_at: '2027-01-10T00:00:00Z' }), // kept day 30, gone by 60
        sub({ listing_id: 'D' }),
      ],
    })
    const [row] = buildWeeklyKpis(input, { weeks: [W('2026-11-23')], now })
    expect(row!.starter_new).toBe(4)
    expect(row!.starter_retained_d30_pct).toBe(75)
    expect(row!.starter_retained_d60_pct).toBe(50)
  })

  it('prints UNKNOWN retention until the cohort has reached the day, or when it is empty', () => {
    const input = empty({ subscriptions: [sub({})] })
    const early = new Date('2026-12-20T00:00:00Z')
    const [row] = buildWeeklyKpis(input, { weeks: [W('2026-11-23')], now: early })
    expect(row!.starter_retained_d30_pct).toBe(UNKNOWN)
    const [emptyRow] = buildWeeklyKpis(empty(), { weeks: [W('2026-11-23')], now })
    expect(emptyRow!.starter_new).toBe(0)
    expect(emptyRow!.starter_retained_d30_pct).toBe(UNKNOWN)
  })

  it('counts claims and claim to Starter conversion', () => {
    const claim = (listing: string, status: string) => ({
      listing_id: listing,
      claimant_user_id: 'c',
      status,
      submitted_at: '2026-11-24T00:00:00Z',
      created_at: '2026-11-24T00:00:00Z',
      reviewed_at: status === 'pending' ? null : '2026-11-26T00:00:00Z',
    })
    const input = empty({
      claims: [
        claim('L1', 'approved'),
        claim('L2', 'approved'),
        claim('L3', 'rejected'),
        claim('L4', 'pending'),
      ],
      subscriptions: [sub({ listing_id: 'L1', created_at: '2027-01-05T00:00:00Z' })],
    })
    const [row] = buildWeeklyKpis(input, { weeks: [W('2026-11-23')], now })
    expect(row!.claims_submitted).toBe(4)
    expect(row!.claims_approved).toBe(2)
    expect(row!.claim_to_starter_pct).toBe(50)
    const [none] = buildWeeklyKpis(empty(), { weeks: [W('2026-11-23')], now })
    expect(none!.claim_to_starter_pct).toBe(UNKNOWN)
  })

  it('prints UNKNOWN for captured channels in weeks before capture, and visitors always', () => {
    const input = empty({
      signups: [
        signup({ source: 'flyer', created_at: '2026-11-10T00:00:00Z' }),
        signup({ source: 'public', created_at: '2026-11-10T00:00:00Z' }),
        signup({ referrer: 'instagram.com' }),
        signup({}),
      ],
    })
    const [before, after] = buildWeeklyKpis(input, {
      weeks: [W('2026-11-09'), W('2026-11-23')],
      now,
    })
    expect(before!.signups).toBe(2)
    expect(before!.signups_flyer).toBe(1)
    expect(before!.signups_invite).toBe(0)
    expect(before!.signups_direct).toBe(UNKNOWN)
    expect(before!.signups_social).toBe(UNKNOWN)
    expect(before!.visitors).toBe(UNKNOWN)
    expect(after!.signups_social).toBe(1)
    expect(after!.signups_direct).toBe(1)
    expect(after!.signups_search).toBe(0)
    expect(after!.visitors).toBe(UNKNOWN)
  })

  it('counts net saves from the table and gross saves from events', () => {
    const input = empty({
      saves: [{ user_id: 'm', created_at: '2026-11-24T00:00:00Z' }],
      saveEvents: [
        { user_id: 'm', created_at: '2026-11-24T00:00:00Z', action: 'save' },
        { user_id: 'm', created_at: '2026-11-24T01:00:00Z', action: 'save' },
        { user_id: 'm', created_at: '2026-11-24T02:00:00Z', action: 'unsave' },
      ],
    })
    const [row] = buildWeeklyKpis(input, { weeks: [W('2026-11-23')], now })
    expect(row!.saves_net).toBe(1)
    expect(row!.saves_gross).toBe(2)
  })
})

describe('output', () => {
  const now = new Date('2026-12-08T00:00:00Z')
  const rows = buildWeeklyKpis(empty({ subscriptions: [sub({})] }), {
    weeks: [W('2026-11-23'), W('2026-11-30')],
    now,
  })

  it('writes one CSV row per week with a week column first', () => {
    const csv = toCsv(rows).trim().split('\n')
    expect(csv).toHaveLength(3)
    expect(csv[0]!.startsWith('week,paying_starter,mrr_usd,')).toBe(true)
    expect(csv[1]!.startsWith('2026-11-23,1,19,')).toBe(true)
    expect(csv[1]).toContain(UNKNOWN)
    expect(csv[1]).not.toMatch(/undefined|null|NaN/)
  })

  it('splits columns into fully known and has-UNKNOWN', () => {
    expect(knownColumns(rows)).toContain('paying_starter')
    expect(knownColumns(rows)).not.toContain('visitors')
    expect(unknownColumns(rows)).toContain('visitors')
    expect(unknownColumns(rows)).toContain('starter_retained_d30_pct')
  })

  it('names every gap in the summary, with no em dashes', () => {
    const text = summaryLines(rows, {
      excludedCount: 3,
      topUtmSources: [['instagram', 4]],
      sourceErrors: [],
    }).join('\n')
    for (const word of [
      'visitors',
      'signups_social',
      'saves_net',
      'mrr_usd',
      'starter_retained_d30_pct',
      'claim_to_starter_pct',
    ]) {
      expect(text).toContain(word)
    }
    expect(text).toContain('MRR (all paid plans)')
    expect(text).toContain('yearly price / 12')
    expect(text).not.toContain('until next-actions item 3')
    expect(text).toContain('3 tester and team accounts')
    expect(text).toContain('instagram 4')
    expect(text).not.toContain('—')
  })

  it('flags read errors', () => {
    const text = summaryLines(rows, {
      excludedCount: 0,
      topUtmSources: [],
      sourceErrors: ['claims: boom'],
    }).join('\n')
    expect(text).toContain('claims: boom')
  })
})
