import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 196: holiday and special hours, saved. What is pinned here:
//   * the rules: a real date from today to a year ahead; closed, or open with
//     both times and closing after opening; a reason up to 60 characters.
//   * every plan; business pages only; up to 60 upcoming dates.
//   * saving a date already set replaces it; moving a date removes the old one.
//   * the JSON-LD gains specialOpeningHoursSpecification.
//   * the cron purges past rows and skips an unmigrated database.
//   * the migration: the CHECKs mirror the rules, RLS as listing_faqs.

const PAGE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
// Local noon on Fri 20 Nov 2026.
const NOW = new Date(2026, 10, 20, 12, 0, 0)

type Row = Record<string, unknown>

const h = vi.hoisted(() => {
  const state = {
    user: null as { id: string } | null,
    listing: null as Row | null,
    rows: [] as Row[],
    failWrite: false,
  }
  const writes: { op: string; row?: Row; where: Record<string, unknown> }[] = []

  function query(table: string) {
    let op: 'select' | 'upsert' | 'delete' = 'select'
    let payload: Row = {}
    const eqs: Record<string, unknown> = {}
    let gte: string | null = null
    let single = false
    const matches = (r: Row) =>
      Object.entries(eqs).every(([k, v]) => r[k] === v) && (gte === null || String(r.date) >= gte)
    const run = () => {
      if (table === 'listings') {
        const l = state.listing
        const ok = l && state.user && eqs.owner_user_id === state.user.id && eqs.id === l.id
        return { data: ok ? l : null, error: null }
      }
      if (op !== 'select' && state.failWrite) return { data: null, error: { message: 'denied' } }
      if (op === 'upsert') {
        state.rows = state.rows.filter(
          (r) => !(r.listing_id === payload.listing_id && r.date === payload.date)
        )
        state.rows.push({ ...payload })
        writes.push({ op, row: payload, where: {} })
      } else if (op === 'delete') {
        state.rows = state.rows.filter((r) => !matches(r))
        writes.push({ op, where: { ...eqs } })
      }
      const out = state.rows.filter(matches).map((r) => ({ ...r }))
      return { data: single ? (out[0] ?? null) : out, error: null }
    }
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      is: () => q,
      gte: (_col: string, val: string) => {
        gte = val
        return q
      },
      eq: (col: string, val: unknown) => {
        eqs[col] = val
        return q
      },
      upsert: (row: Row) => {
        op = 'upsert'
        payload = row
        return q
      },
      delete: () => {
        op = 'delete'
        return q
      },
      maybeSingle: () => {
        single = true
        return q
      },
      then(resolve: (v: { data: unknown; error: unknown }) => void) {
        return resolve(run())
      },
    }
    return q
  }

  return {
    state,
    writes,
    createClient: vi.fn(async () => ({ from: (t: string) => query(t) })),
  }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: h.createClient }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/dashboard/revalidateEditors', () => ({ revalidateOwnerEditors: vi.fn() }))
vi.mock('@/lib/listings/url', () => ({ buildEntityUrl: () => '/l/x' }))
vi.mock('@/lib/dashboard/guard', () => ({
  getOwnerSession: async () => (h.state.user ? { user: h.state.user } : null),
}))

import {
  HOURS_OVERRIDE_MAX,
  checkHoursOverrideAdd,
  hoursOverridePurgeBefore,
  hoursOverrideWindow,
  isDateKey,
  parseHoursOverride,
  toHoursOverrides,
} from '@/lib/listings/hoursOverrides'
import {
  deleteHoursOverrideAction,
  saveHoursOverrideAction,
} from '@/lib/actions/dashboard/hoursOverrides'
import { specialOpeningHoursSpecification } from '@/lib/listings/jsonLd'
import { purgePastHoursOverrides } from '@/lib/services/expiry/sweeps'
import type { HoursOverride } from '@/types'

function read(file: string): string {
  return readFileSync(join(__dirname, '..', file), 'utf8')
}

const closed = (date: string, label: string | null = null): HoursOverride => ({
  date,
  closed: true,
  open: null,
  close: null,
  label,
})

function form(patch: Record<string, unknown> = {}) {
  return {
    listingId: PAGE,
    date: '2026-11-26',
    closed: true,
    open: null,
    close: null,
    label: 'Thanksgiving',
    ...patch,
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  h.state.user = { id: 'owner-1' }
  h.state.listing = {
    id: PAGE,
    slug: 'sample',
    status: 'published',
    entity_type: 'business',
    cities: { slug: 'atlanta' },
  }
  h.state.rows = []
  h.state.failWrite = false
  h.writes.length = 0
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the rules', () => {
  it('accepts only real calendar dates', () => {
    expect(isDateKey('2026-11-26')).toBe(true)
    expect(isDateKey('2026-02-30')).toBe(false)
    expect(isDateKey('2026-1-5')).toBe(false)
    expect(isDateKey(20261126)).toBe(false)
  })

  it('takes a closed day with an optional reason, and drops any times', () => {
    const r = parseHoursOverride(form({ open: '09:00', close: '17:00' }), NOW)
    expect(r).toEqual({
      ok: true,
      value: { date: '2026-11-26', closed: true, open: null, close: null, label: 'Thanksgiving' },
    })
    const blank = parseHoursOverride(form({ label: '   ' }), NOW)
    expect(blank.ok && blank.value.label).toBeNull()
  })

  it('needs both times on an open day, closing after opening', () => {
    expect(parseHoursOverride(form({ closed: false, open: '10:00', close: '14:00' }), NOW)).toEqual(
      {
        ok: true,
        value: {
          date: '2026-11-26',
          closed: false,
          open: '10:00',
          close: '14:00',
          label: 'Thanksgiving',
        },
      }
    )
    expect(parseHoursOverride(form({ closed: false, open: '10:00' }), NOW)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/opening and a closing time/),
    })
    expect(
      parseHoursOverride(form({ closed: false, open: '22:00', close: '02:00' }), NOW)
    ).toMatchObject({ ok: false, error: expect.stringMatching(/after opening/) })
    expect(parseHoursOverride(form({ closed: false, open: '25:00', close: '26:00' }), NOW).ok).toBe(
      false
    )
  })

  it('keeps the date between yesterday (time zones) and a year ahead', () => {
    expect(parseHoursOverride(form({ date: '2026-11-19' }), NOW).ok).toBe(true)
    expect(parseHoursOverride(form({ date: '2026-11-18' }), NOW)).toMatchObject({
      error: expect.stringMatching(/has passed/),
    })
    expect(parseHoursOverride(form({ date: '2027-11-20' }), NOW).ok).toBe(true)
    expect(parseHoursOverride(form({ date: '2027-11-21' }), NOW)).toMatchObject({
      error: expect.stringMatching(/next year/),
    })
    expect(parseHoursOverride(form({ date: '' }), NOW)).toMatchObject({ error: 'Choose a date.' })
  })

  it('keeps the reason to 60 characters', () => {
    expect(parseHoursOverride(form({ label: 'x'.repeat(60) }), NOW).ok).toBe(true)
    expect(parseHoursOverride(form({ label: 'x'.repeat(61) }), NOW).ok).toBe(false)
  })

  it('reads rows defensively, soonest first', () => {
    expect(
      toHoursOverrides([
        { date: '2026-12-25', closed: true, open: null, close: null, label: ' Christmas ' },
        { date: '2026-11-27', closed: false, open: '08:00', close: '20:00', label: null },
        { date: '2026-11-28', closed: false, open: null, close: null, label: null },
        { date: '2026-11-29', closed: false, open: '18:00', close: '09:00', label: null },
        { date: 'soon', closed: true },
        null,
      ])
    ).toEqual([
      { date: '2026-11-27', closed: false, open: '08:00', close: '20:00', label: null },
      { date: '2026-12-25', closed: true, open: null, close: null, label: 'Christmas' },
    ])
    expect(toHoursOverrides(null)).toEqual([])
  })

  it('caps upcoming dates, but a date already set can always change', () => {
    const many = Array.from({ length: HOURS_OVERRIDE_MAX }, (_, i) =>
      closed(`2027-01-${String((i % 28) + 1).padStart(2, '0')}`)
    )
    expect(checkHoursOverrideAdd(many, '2027-06-01')).toMatch(/up to 60/)
    expect(checkHoursOverrideAdd(many, '2027-01-01')).toBeNull()
    expect(checkHoursOverrideAdd([], '2027-06-01')).toBeNull()
  })

  it('reads a day either side of the 30 days, and purges two days back', () => {
    expect(hoursOverrideWindow(NOW)).toEqual({ from: '2026-11-19', to: '2026-12-21' })
    expect(hoursOverridePurgeBefore(NOW)).toBe('2026-11-18')
  })
})

describe('saveHoursOverrideAction', () => {
  it('saves a closed day on any plan', async () => {
    const r = await saveHoursOverrideAction(form())
    expect(r).toEqual({ success: true, items: [closed('2026-11-26', 'Thanksgiving')] })
    expect(h.writes[0]).toMatchObject({ op: 'upsert', row: { listing_id: PAGE } })
  })

  it('replaces a date already set', async () => {
    await saveHoursOverrideAction(form())
    const r = await saveHoursOverrideAction(
      form({ closed: false, open: '10:00', close: '14:00', label: 'Short day' })
    )
    expect(r).toEqual({
      success: true,
      items: [
        { date: '2026-11-26', closed: false, open: '10:00', close: '14:00', label: 'Short day' },
      ],
    })
  })

  it('moves a date: the new one is saved and the old one removed', async () => {
    await saveHoursOverrideAction(form())
    const r = await saveHoursOverrideAction(
      form({ date: '2026-11-27', previousDate: '2026-11-26' })
    )
    expect(r).toEqual({ success: true, items: [closed('2026-11-27', 'Thanksgiving')] })
  })

  it('refuses bad input before writing', async () => {
    expect(await saveHoursOverrideAction(form({ date: '2026-11-01' }))).toMatchObject({
      error: expect.stringMatching(/has passed/),
    })
    expect(h.writes).toHaveLength(0)
  })

  it('refuses a 61st upcoming date', async () => {
    h.state.rows = Array.from({ length: HOURS_OVERRIDE_MAX }, (_, i) => {
      const d = new Date(2027, 0, 1 + i)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return { listing_id: PAGE, date, closed: true, open: null, close: null, label: null }
    })
    expect(await saveHoursOverrideAction(form())).toMatchObject({
      error: expect.stringMatching(/up to 60/),
    })
    expect(h.writes).toHaveLength(0)
  })

  it('refuses jobs, events, other owners and signed-out users', async () => {
    h.state.listing = { ...h.state.listing!, entity_type: 'event' }
    expect(await saveHoursOverrideAction(form())).toMatchObject({
      error: expect.stringMatching(/not found/i),
    })
    h.state.listing = { ...h.state.listing!, entity_type: 'business' }
    expect(await saveHoursOverrideAction(form({ listingId: OTHER }))).toMatchObject({
      error: expect.stringMatching(/not found/i),
    })
    h.state.user = null
    expect(await saveHoursOverrideAction(form())).toEqual({ error: 'Please sign in again.' })
    expect(h.writes).toHaveLength(0)
  })

  it('reports a failed write', async () => {
    h.state.failWrite = true
    expect(await saveHoursOverrideAction(form())).toEqual({
      error: 'We couldn’t save that. Please try again.',
    })
  })
})

describe('deleteHoursOverrideAction', () => {
  it('removes one date, so the weekly hours apply again', async () => {
    await saveHoursOverrideAction(form())
    await saveHoursOverrideAction(form({ date: '2026-12-25', label: 'Christmas' }))
    const r = await deleteHoursOverrideAction({ listingId: PAGE, date: '2026-11-26' })
    expect(r).toEqual({ success: true, items: [closed('2026-12-25', 'Christmas')] })
  })

  it('refuses a malformed date', async () => {
    expect(await deleteHoursOverrideAction({ listingId: PAGE, date: 'x' })).toMatchObject({
      error: expect.stringMatching(/wasn’t found/),
    })
  })
})

describe('JSON-LD specialOpeningHoursSpecification', () => {
  it('gives one entry per date; a closed day opens and closes at 00:00', () => {
    expect(
      specialOpeningHoursSpecification([
        closed('2026-12-25', 'Christmas'),
        { date: '2026-11-27', closed: false, open: '08:00', close: '20:00', label: null },
        { date: '2026-11-28', closed: false, open: null, close: null, label: null },
      ])
    ).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        validFrom: '2026-11-27',
        validThrough: '2026-11-27',
        opens: '08:00',
        closes: '20:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        validFrom: '2026-12-25',
        validThrough: '2026-12-25',
        opens: '00:00',
        closes: '00:00',
      },
    ])
    expect(specialOpeningHoursSpecification(undefined)).toEqual([])
  })
})

describe('purgePastHoursOverrides', () => {
  function client(result: { data: unknown; error: unknown }) {
    const calls: { table: string; lt?: [string, string] }[] = []
    const q = {
      delete: () => q,
      select: () => q,
      lt: (col: string, val: string) => {
        calls[calls.length - 1]!.lt = [col, val]
        return q
      },
      then: (resolve: (v: unknown) => void) => resolve(result),
    }
    return {
      calls,
      from: (table: string) => {
        calls.push({ table })
        return q
      },
    }
  }

  it('deletes rows from before two days back', async () => {
    const c = client({ data: [{ listing_id: PAGE }, { listing_id: OTHER }], error: null })
    expect(await purgePastHoursOverrides(c as never, NOW)).toEqual({ purged: 2 })
    expect(c.calls).toEqual([{ table: 'listing_hours_overrides', lt: ['date', '2026-11-18'] }])
  })

  it('skips a database without the table, and throws on anything else', async () => {
    const missing = client({ data: null, error: { code: 'PGRST205', message: 'not found' } })
    expect(await purgePastHoursOverrides(missing as never, NOW)).toMatchObject({
      skipped: expect.any(String),
    })
    const broken = client({ data: null, error: { code: '42501', message: 'denied' } })
    await expect(purgePastHoursOverrides(broken as never, NOW)).rejects.toThrow(/denied/)
  })
})

describe('migration 20261127000000_listing_hours_overrides', () => {
  const sql = read('supabase/migrations/20261127000000_listing_hours_overrides.sql')

  it('keys one row per listing per date, cascading with the listing', () => {
    expect(sql).toMatch(/PRIMARY KEY \(listing_id, date\)/)
    expect(sql).toMatch(/REFERENCES public\.listings\(id\) ON DELETE CASCADE/)
    expect(sql).toMatch(/ON public\.listing_hours_overrides \(date\)/)
  })

  it('mirrors the rules in CHECKs', () => {
    expect(sql).toMatch(/open IS NULL OR open ~ '\^\(\[01\]\[0-9\]\|2\[0-3\]\):\[0-5\]\[0-9\]\$'/)
    expect(sql).toMatch(/closed AND open IS NULL AND close IS NULL/)
    expect(sql).toMatch(/NOT closed AND open IS NOT NULL AND close IS NOT NULL AND close > open/)
    expect(sql).toMatch(/char_length\(btrim\(label\)\) BETWEEN 1 AND 60/)
  })

  it('has RLS as listing_faqs: public read on published pages, owner writes', () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
    for (const name of [
      'anon read',
      'authenticated read',
      'owner insert',
      'owner update',
      'owner delete',
    ]) {
      expect(sql).toContain(`"listing_hours_overrides: ${name}"`)
    }
    expect(sql).toMatch(/status = 'published' AND deleted_at IS NULL/)
    expect(sql).toMatch(/owner_user_id = auth\.uid\(\) AND deleted_at IS NULL/)
  })
})

describe('wiring', () => {
  it('the loader reads the window, fail-soft, business pages only', () => {
    const src = read('lib/listings/entityPage.ts')
    expect(src).toMatch(/from\('listing_hours_overrides'\)/)
    expect(src).toMatch(/\.gte\('date', hoursWindow\.from\)/)
    expect(src).toMatch(/\.lte\('date', hoursWindow\.to\)/)
    expect(src).toMatch(/hoursOverrides\.length > 0 \? \{ hoursOverrides \}/)
  })

  it('the JSON-LD builder, the cron, the sidebar and the Hours card are wired', () => {
    expect(read('lib/listings/jsonLd.ts')).toMatch(/jsonLd\.specialOpeningHoursSpecification/)
    expect(read('app/api/cron/expiry/route.ts')).toMatch(/purgePastHoursOverrides\(supabase, now\)/)
    expect(read('lib/account/shellNav.ts')).toMatch(/\/special-hours`/)
    expect(read('components/dashboard/HoursSection.tsx')).toMatch(/\/special-hours`/)
  })
})
