import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 109: booking requests. What is pinned here:
//   * the rules: the visitor's form is checked the way the table's CHECKs
//     check it; dates from today to a year out; the owner's settings and
//     answers.
//   * the submit action: flag, honeypot, Turnstile, both rate limits, the
//     page (published business, Premium, form on, has an owner), fields the
//     owner turned off are dropped, a foreign service is dropped, and the
//     owner and visitor are emailed — the owner with Reply-To the visitor.
//   * the owner actions: switching on needs Premium and the flag; answering
//     needs the flag, only once, and emails the visitor from noreply.
//   * the migration, the loader, the section gate and the dashboard are wired.

const LISTING_ID = '0b6f5c7e-1d2a-4c3b-9e8f-7a6b5c4d3e2f'
const SERVICE_ID = '5e5e5e5e-5e5e-4e5e-8e5e-5e5e5e5e5e5e'
const OTHER_SERVICE = '6f6f6f6f-6f6f-4f6f-8f6f-6f6f6f6f6f6f'
const REQ_ID = '7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a'
const NOW = new Date('2026-11-15T15:00:00Z')

type Row = Record<string, unknown>

const h = vi.hoisted(() => {
  const state = {
    flag: true,
    honeypot: false,
    turnstile: true,
    rateOk: { ip: true, email: true },
    user: null as { id: string; email?: string } | null,
    tables: {} as Record<string, Row[]>,
    failWrites: false,
  }
  const inserts: { table: string; row: Row }[] = []
  const updates: { table: string; row: Row }[] = []
  const emails: { to: string; subject: string; replyTo?: string }[] = []
  const rateCalls: { bucket: string; identifier: string }[] = []

  function query(table: string) {
    let op: 'select' | 'insert' | 'update' | 'upsert' = 'select'
    let payload: Row = {}
    const eqs: Record<string, unknown> = {}
    let single = false
    const rows = () => (state.tables[table] ??= [])
    const matches = (r: Row) => Object.entries(eqs).every(([k, v]) => r[k] === v)
    const run = () => {
      if (op !== 'select' && state.failWrites) return { data: null, error: { message: 'denied' } }
      let out: Row[]
      if (op === 'insert') {
        inserts.push({ table, row: payload })
        rows().push({ ...payload })
        out = [payload]
      } else if (op === 'upsert') {
        const key = payload.listing_id
        const existing = rows().find((r) => r.listing_id === key)
        if (existing) Object.assign(existing, payload)
        else rows().push({ ...payload })
        out = [rows().find((r) => r.listing_id === key)!]
      } else if (op === 'update') {
        out = rows().filter(matches)
        for (const r of out) Object.assign(r, payload)
        if (out.length) updates.push({ table, row: payload })
      } else {
        out = rows().filter(matches)
      }
      return { data: single ? (out[0] ?? null) : out, error: null }
    }
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      is: () => q,
      eq: (col: string, val: unknown) => {
        eqs[col] = val
        return q
      },
      insert: (row: Row) => {
        op = 'insert'
        payload = row
        return q
      },
      update: (row: Row) => {
        op = 'update'
        payload = row
        return q
      },
      upsert: (row: Row) => {
        op = 'upsert'
        payload = row
        return q
      },
      maybeSingle: () => {
        single = true
        return q
      },
      single: () => {
        single = true
        return q
      },
      then(resolve: (v: { data: unknown; error: unknown }) => void) {
        return resolve(run())
      },
    }
    return q
  }

  const client = () => ({
    from: (t: string) => query(t),
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
      admin: {
        getUserById: async (id: string) => ({
          data: { user: id === 'owner-1' ? { email: 'owner@example.com' } : null },
        }),
      },
    },
  })

  return {
    state,
    inserts,
    updates,
    emails,
    rateCalls,
    createClient: vi.fn(async () => client()),
    createServiceClient: vi.fn(() => client()),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: h.createClient,
  createServiceClient: h.createServiceClient,
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/env', async (orig) => ({
  ...(await orig<typeof import('@/lib/env')>()),
  isFeatureEnabled: (flag: string) => (flag === 'bookingRequests' ? h.state.flag : false),
  getAppUrl: () => 'https://example.test',
}))
vi.mock('@/lib/security/honeypot', () => ({ isHoneypotTripped: () => h.state.honeypot }))
vi.mock('@/lib/security/turnstile', () => ({
  TURNSTILE_ERROR: 'Verification failed. Please try again.',
  verifyTurnstileFormData: async () => h.state.turnstile,
}))
vi.mock('@/lib/security/rate-limit', () => ({
  getClientIp: () => '203.0.113.9',
  checkRateLimit: async (o: { bucket: string; identifier: string }) => {
    h.rateCalls.push({ bucket: o.bucket, identifier: o.identifier })
    return o.identifier.startsWith('ip:') ? h.state.rateOk.ip : h.state.rateOk.email
  },
}))
vi.mock('@/lib/email/resend', () => ({
  sendEmail: async (m: { to: string; subject: string; replyTo?: string }) => {
    h.emails.push({ to: m.to, subject: m.subject, replyTo: m.replyTo })
  },
}))
vi.mock('@/lib/dashboard/guard', () => ({
  getOwnerSession: async () => (h.state.user ? { user: h.state.user } : null),
}))
vi.mock('@/lib/dashboard/revalidateEditors', () => ({ revalidateOwnerEditors: vi.fn() }))
vi.mock('@/lib/listings/url', () => ({ buildEntityUrl: () => '/l/cafe' }))

import {
  BOOKING_EMAIL_LIMIT,
  BOOKING_IP_LIMIT,
  BOOKING_UNAVAILABLE,
  parseBookingReply,
  parseBookingRequest,
  parseBookingSettings,
  toBookingSettings,
  toOwnerBookings,
  whenLabel,
} from '@/lib/listings/booking'
import { submitBookingRequestAction } from '@/lib/actions/booking/submitBookingRequest'
import { respondToBookingAction, saveBookingSettingsAction } from '@/lib/actions/dashboard/bookings'
import { sectionAllowed } from '@/lib/entity-page/sections'

function read(file: string): string {
  return readFileSync(join(__dirname, '..', file), 'utf8')
}

const INPUT = {
  name: '  Jordan   Smith ',
  email: 'Jordan@Example.com ',
  phone: '',
  serviceId: '',
  requestedDate: '2026-11-20',
  timeWindow: 'morning',
  partySize: '4',
  note: 'Birthday',
}

function form(fields: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const base: Record<string, string> = {
    listing_id: LISTING_ID,
    name: 'Jordan Smith',
    email: 'jordan@example.com',
    requested_date: '2026-11-20',
    time_window: 'evening',
    party_size: '3',
    message: 'A table near the window.',
    ...fields,
  }
  for (const [k, v] of Object.entries(base)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  h.inserts.length = 0
  h.updates.length = 0
  h.emails.length = 0
  h.rateCalls.length = 0
  h.state.flag = true
  h.state.honeypot = false
  h.state.turnstile = true
  h.state.rateOk = { ip: true, email: true }
  h.state.user = null
  h.state.failWrites = false
  h.state.tables = {
    listings: [
      {
        id: LISTING_ID,
        name: 'Cafe Noir',
        slug: 'cafe',
        status: 'published',
        deleted_at: null,
        entity_type: 'business',
        tier: 'premium',
        owner_user_id: 'owner-1',
        cities: { slug: 'atlanta' },
      },
    ],
    listing_booking_settings: [
      { listing_id: LISTING_ID, enabled: true, prompt: null, ask_date: true, ask_party_size: true },
    ],
    services: [
      { id: SERVICE_ID, listing_id: LISTING_ID, name: 'Tasting Menu' },
      { id: OTHER_SERVICE, listing_id: 'someone-else', name: 'Not Theirs' },
    ],
    booking_requests: [],
  }
})

// ── Rules ────────────────────────────────────────────────────────────────────

describe('parseBookingRequest', () => {
  it('tidies a good request', () => {
    const r = parseBookingRequest(INPUT, NOW)
    expect(r).toEqual({
      ok: true,
      value: {
        requester_name: 'Jordan Smith',
        requester_email: 'jordan@example.com',
        requester_phone: null,
        service_id: null,
        requested_date: '2026-11-20',
        time_window: 'morning',
        party_size: 4,
        note: 'Birthday',
      },
    })
  })

  it('needs a name and a real-looking email', () => {
    const r = parseBookingRequest({ ...INPUT, name: ' ', email: 'not-an-email' }, NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.fieldErrors.name).toBeTruthy()
      expect(r.fieldErrors.email).toBeTruthy()
    }
  })

  it('checks lengths against the table', () => {
    const long = parseBookingRequest(
      { ...INPUT, name: 'x'.repeat(81), note: 'y'.repeat(1001), partySize: '501' },
      NOW
    )
    expect(long.ok).toBe(false)
    if (!long.ok) {
      expect(Object.keys(long.fieldErrors).sort()).toEqual(['message', 'name', 'party_size'])
    }
  })

  it('takes a phone with 7+ digits, refuses letters', () => {
    expect(parseBookingRequest({ ...INPUT, phone: '(404) 555-0100' }, NOW).ok).toBe(true)
    expect(parseBookingRequest({ ...INPUT, phone: '555-01' }, NOW).ok).toBe(false)
    expect(parseBookingRequest({ ...INPUT, phone: 'call me 4045550100' }, NOW).ok).toBe(false)
  })

  it('takes dates from yesterday (UTC slack) to a year out', () => {
    const at = (d: string) => parseBookingRequest({ ...INPUT, requestedDate: d }, NOW)
    expect(at('2026-11-14').ok).toBe(true)
    expect(at('2026-11-13').ok).toBe(false)
    expect(at('2027-11-15').ok).toBe(true)
    expect(at('2027-11-16').ok).toBe(false)
    expect(at('2026-02-30').ok).toBe(false)
    expect(at('next tuesday').ok).toBe(false)
    expect(at('').ok).toBe(true)
  })

  it('falls back to any time and drops a malformed service id', () => {
    const r = parseBookingRequest(
      { ...INPUT, timeWindow: 'midnight', serviceId: 'drop table' },
      NOW
    )
    expect(r.ok && r.value.time_window).toBe('any')
    expect(r.ok && r.value.service_id).toBe(null)
  })
})

describe('settings and replies', () => {
  it('no row means the form is off', () => {
    expect(toBookingSettings(null)).toEqual({
      enabled: false,
      prompt: null,
      ask_date: true,
      ask_party_size: false,
    })
  })

  it('limits the line above the form', () => {
    const base = { enabled: true, askDate: true, askPartySize: false }
    expect(parseBookingSettings({ ...base, prompt: 'x'.repeat(201) }).ok).toBe(false)
    expect(parseBookingSettings({ ...base, prompt: '  ' })).toEqual({
      ok: true,
      value: { enabled: true, prompt: null, ask_date: true, ask_party_size: false },
    })
  })

  it('suggesting another time needs a note', () => {
    expect(parseBookingReply('propose', ' ').ok).toBe(false)
    expect(parseBookingReply('propose', 'Thursday at 2').ok).toBe(true)
    expect(parseBookingReply('accept', '').ok).toBe(true)
    expect(parseBookingReply('delete', '').ok).toBe(false)
    expect(parseBookingReply('decline', 'z'.repeat(501)).ok).toBe(false)
  })

  it('drops bad rows and sorts newest first', () => {
    const rows = [
      {
        id: 'a',
        requester_name: 'A',
        requester_email: 'a@x.co',
        created_at: '2026-11-01',
        status: 'pending',
      },
      {
        id: 'b',
        requester_name: 'B',
        requester_email: 'b@x.co',
        created_at: '2026-11-03',
        status: 'accepted',
      },
      {
        id: 'c',
        requester_name: 'C',
        requester_email: 'c@x.co',
        created_at: '2026-11-02',
        status: 'weird',
      },
    ]
    expect(toOwnerBookings(rows).map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('labels when', () => {
    expect(whenLabel('2026-12-05', 'morning')).toBe('Sat, Dec 5 · Morning')
    expect(whenLabel(null, 'any')).toBe('Any day · Any time')
  })

  it('limits are an hour per IP and a day per email', () => {
    expect(BOOKING_IP_LIMIT.windowSeconds).toBe(3600)
    expect(BOOKING_EMAIL_LIMIT).toEqual({ limit: 3, windowSeconds: 86400 })
  })
})

// ── The visitor's submit ─────────────────────────────────────────────────────

describe('submitBookingRequestAction', () => {
  it('saves the request and emails the owner (Reply-To the visitor) and the visitor', async () => {
    const r = await submitBookingRequestAction(null, form({ service_id: SERVICE_ID }))
    expect(r).toEqual({ success: true })
    expect(h.inserts).toHaveLength(1)
    expect(h.inserts[0]!.table).toBe('booking_requests')
    expect(h.inserts[0]!.row).toMatchObject({
      listing_id: LISTING_ID,
      requester_user_id: null,
      requester_email: 'jordan@example.com',
      service_id: SERVICE_ID,
      party_size: 3,
      time_window: 'evening',
    })
    expect(h.emails).toEqual([
      {
        to: 'owner@example.com',
        subject: 'New Booking Request for Cafe Noir',
        replyTo: 'jordan@example.com',
      },
      { to: 'jordan@example.com', subject: 'Your Request to Cafe Noir', replyTo: undefined },
    ])
    expect(h.rateCalls.map((c) => c.identifier)).toEqual([
      'ip:203.0.113.9',
      'email:jordan@example.com',
    ])
  })

  it('does nothing with the flag off', async () => {
    h.state.flag = false
    expect(await submitBookingRequestAction(null, form())).toEqual({ error: BOOKING_UNAVAILABLE })
    expect(h.inserts).toHaveLength(0)
  })

  it('pretends to succeed for a bot and writes nothing', async () => {
    h.state.honeypot = true
    expect(await submitBookingRequestAction(null, form())).toEqual({ success: true })
    expect(h.inserts).toHaveLength(0)
    expect(h.emails).toHaveLength(0)
  })

  it('stops on Turnstile and on either rate limit', async () => {
    h.state.turnstile = false
    expect(await submitBookingRequestAction(null, form())).toHaveProperty('error')
    h.state.turnstile = true
    h.state.rateOk.ip = false
    expect(await submitBookingRequestAction(null, form())).toHaveProperty('error')
    h.state.rateOk = { ip: true, email: false }
    expect(await submitBookingRequestAction(null, form())).toHaveProperty('error')
    expect(h.inserts).toHaveLength(0)
  })

  it('returns field errors', async () => {
    const r = await submitBookingRequestAction(null, form({ email: 'nope' }))
    expect(r && 'fieldErrors' in r && r.fieldErrors?.email).toBeTruthy()
  })

  it.each([
    ['below Premium', { tier: 'growth' }],
    ['unpublished', { status: 'draft' }],
    ['deleted', { deleted_at: '2026-11-01' }],
    ['an event', { entity_type: 'event' }],
    ['unclaimed', { owner_user_id: null }],
  ])('refuses a page that is %s', async (_label, patch) => {
    Object.assign(h.state.tables.listings![0]!, patch)
    expect(await submitBookingRequestAction(null, form())).toEqual({ error: BOOKING_UNAVAILABLE })
    expect(h.inserts).toHaveLength(0)
  })

  it('refuses when the owner switched the form off, or never set it up', async () => {
    h.state.tables.listing_booking_settings![0]!.enabled = false
    expect(await submitBookingRequestAction(null, form())).toEqual({ error: BOOKING_UNAVAILABLE })
    h.state.tables.listing_booking_settings = []
    expect(await submitBookingRequestAction(null, form())).toEqual({ error: BOOKING_UNAVAILABLE })
  })

  it('drops fields the owner turned off and a service from another page', async () => {
    Object.assign(h.state.tables.listing_booking_settings![0]!, {
      ask_date: false,
      ask_party_size: false,
    })
    await submitBookingRequestAction(null, form({ service_id: OTHER_SERVICE }))
    expect(h.inserts[0]!.row).toMatchObject({
      requested_date: null,
      party_size: null,
      service_id: null,
    })
  })

  it('links a signed-in visitor, and stops the owner asking their own page', async () => {
    h.state.user = { id: 'visitor-9' }
    await submitBookingRequestAction(null, form())
    expect(h.inserts[0]!.row.requester_user_id).toBe('visitor-9')
    h.state.user = { id: 'owner-1' }
    expect(await submitBookingRequestAction(null, form())).toHaveProperty('error')
    expect(h.inserts).toHaveLength(1)
  })
})

// ── The owner's side ─────────────────────────────────────────────────────────

describe('saveBookingSettingsAction', () => {
  const SAVE = {
    listingId: LISTING_ID,
    enabled: true,
    prompt: 'Ask us',
    askDate: true,
    askPartySize: false,
  }

  beforeEach(() => {
    h.state.user = { id: 'owner-1', email: 'owner@example.com' }
    h.state.tables.listing_booking_settings = []
  })

  it('switches the form on for Premium', async () => {
    const r = await saveBookingSettingsAction(SAVE)
    expect(r).toEqual({
      success: true,
      settings: { enabled: true, prompt: 'Ask us', ask_date: true, ask_party_size: false },
    })
  })

  it('switching on needs Premium and the flag; switching off never does', async () => {
    h.state.tables.listings![0]!.tier = 'growth'
    expect(await saveBookingSettingsAction(SAVE)).toHaveProperty('error')
    expect(await saveBookingSettingsAction({ ...SAVE, enabled: false })).toHaveProperty('success')
    h.state.tables.listings![0]!.tier = 'premium'
    h.state.flag = false
    expect(await saveBookingSettingsAction(SAVE)).toHaveProperty('error')
  })

  it('refuses a stranger', async () => {
    h.state.user = null
    expect(await saveBookingSettingsAction(SAVE)).toHaveProperty('error')
  })
})

describe('respondToBookingAction', () => {
  beforeEach(() => {
    h.state.user = { id: 'owner-1', email: 'owner@example.com' }
    h.state.tables.booking_requests = [
      {
        id: REQ_ID,
        listing_id: LISTING_ID,
        requester_name: 'Jordan',
        requester_email: 'jordan@example.com',
        requester_phone: null,
        service_id: SERVICE_ID,
        requested_date: '2026-11-20',
        time_window: 'evening',
        party_size: 2,
        note: null,
        status: 'pending',
        owner_reply: null,
        responded_at: null,
        created_at: '2026-11-15T10:00:00Z',
      },
    ]
  })

  it('accepts and emails the visitor from noreply', async () => {
    const r = await respondToBookingAction({
      listingId: LISTING_ID,
      id: REQ_ID,
      decision: 'accept',
      reply: 'See you then.',
    })
    expect(r).toMatchObject({
      success: true,
      request: { status: 'accepted', owner_reply: 'See you then.' },
    })
    expect(h.emails).toEqual([
      { to: 'jordan@example.com', subject: 'Cafe Noir Accepted Your Request', replyTo: undefined },
    ])
  })

  it('answers once: a second answer is refused and sends nothing', async () => {
    await respondToBookingAction({
      listingId: LISTING_ID,
      id: REQ_ID,
      decision: 'decline',
      reply: '',
    })
    h.emails.length = 0
    expect(
      await respondToBookingAction({
        listingId: LISTING_ID,
        id: REQ_ID,
        decision: 'accept',
        reply: '',
      })
    ).toHaveProperty('error')
    expect(h.emails).toHaveLength(0)
  })

  it('may change their mind after suggesting another time', async () => {
    await respondToBookingAction({
      listingId: LISTING_ID,
      id: REQ_ID,
      decision: 'propose',
      reply: 'Friday?',
    })
    const r = await respondToBookingAction({
      listingId: LISTING_ID,
      id: REQ_ID,
      decision: 'accept',
      reply: '',
    })
    expect(r).toMatchObject({ success: true, request: { status: 'accepted' } })
  })

  it('is closed with the flag off', async () => {
    h.state.flag = false
    expect(
      await respondToBookingAction({
        listingId: LISTING_ID,
        id: REQ_ID,
        decision: 'accept',
        reply: '',
      })
    ).toHaveProperty('error')
    expect(h.updates).toHaveLength(0)
  })

  it('works below Premium, for requests already in', async () => {
    h.state.tables.listings![0]!.tier = 'starter'
    expect(
      await respondToBookingAction({
        listingId: LISTING_ID,
        id: REQ_ID,
        decision: 'accept',
        reply: '',
      })
    ).toHaveProperty('success')
  })
})

// ── Wiring ───────────────────────────────────────────────────────────────────

describe('migration 20261121000000_booking_requests', () => {
  const sql = read('supabase/migrations/20261121000000_booking_requests.sql')

  it('has no anon access and no insert or delete policy on requests', () => {
    const requestPolicies = sql.match(/ON public\.booking_requests FOR (\w+) TO (\w+)/g) ?? []
    expect(requestPolicies.length).toBeGreaterThan(0)
    for (const p of requestPolicies) {
      expect(p).not.toMatch(/TO anon/)
      expect(p).not.toMatch(/FOR (INSERT|DELETE|ALL)/)
    }
  })

  it('lets the owner change only the answer columns', () => {
    expect(sql).toMatch(/REVOKE UPDATE ON public\.booking_requests FROM authenticated/)
    expect(sql).toMatch(
      /GRANT UPDATE \(status, owner_reply, responded_at, updated_at\)\s+ON public\.booking_requests TO authenticated/
    )
  })

  it('matches the app limits', () => {
    expect(sql).toMatch(/requester_name\)\) BETWEEN 1 AND 80/)
    expect(sql).toMatch(/party_size BETWEEN 1 AND 500/)
    expect(sql).toMatch(/char_length\(note\) <= 1000/)
    expect(sql).toMatch(/char_length\(owner_reply\) <= 500/)
  })
})

describe('wiring', () => {
  it('the flag is closed on every deployment', () => {
    const env = read('lib/env.ts')
    expect(env).toContain("bookingRequests: 'FEATURE_BOOKING_REQUESTS'")
    const closed = env.slice(env.indexOf('const CLOSED_BY_DEFAULT'))
    expect(closed.slice(0, closed.indexOf('])'))).toContain("'bookingRequests'")
  })

  it('the section needs Premium, the flag and a claimed page', () => {
    expect(sectionAllowed('booking', 'premium', () => true, { claimed: true })).toBe(true)
    expect(sectionAllowed('booking', 'growth', () => true, { claimed: true })).toBe(false)
    expect(sectionAllowed('booking', 'premium', () => false, { claimed: true })).toBe(false)
    expect(sectionAllowed('booking', 'premium', () => true, { claimed: false })).toBe(false)
  })

  it('the loader reads the settings only when the form can show', () => {
    const src = read('lib/listings/entityPage.ts')
    expect(src).toContain(".from('listing_booking_settings')")
    expect(src).toMatch(
      /isFeatureEnabled\('bookingRequests'\) && canAccess\(listing\.tier, 'booking_requests'\)/
    )
  })

  it('the form posts to the action with the honeypot and Turnstile', () => {
    const src = read('components/entity-page/EntityBookingSection.tsx')
    expect(src).toContain('submitBookingRequestAction')
    expect(src).toContain('<HoneypotField />')
    expect(src).toContain('<TurnstileWidget resetKey={state}')
  })

  it('the dashboard page and sidebar link exist', () => {
    expect(read('app/dashboard/pages/[entityId]/bookings/page.tsx')).toContain('BookingsManager')
    expect(read('components/dashboard/DashboardSidebar.tsx')).toContain('/bookings`')
  })
})
