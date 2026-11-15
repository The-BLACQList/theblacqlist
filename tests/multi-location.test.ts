import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 110: multi-location accounts. What is pinned here:
//   * the rules: Premium covers the page and 2 linked locations; linked pages
//     take the primary's tier while it covers them and Free below that.
//   * the webhook's sync: only changed pages are written, a page with its own
//     plan is left alone, a missing table is "no links", errors throw.
//   * the owner's actions: link (ownership, business pages, Premium, no
//     chains, the limit, no own plan) and unlink (back to Free or own plan).
//   * the migration, the checkout refusal, the loader and the dashboard.

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' // primary
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

type Row = Record<string, unknown>

const h = vi.hoisted(() => {
  const state = {
    user: null as { id: string } | null,
    tables: {} as Record<string, Row[]>,
    errors: {} as Record<string, { message: string; code?: string }>,
  }
  const writes: { table: string; op: string; row?: Row; where: Record<string, unknown> }[] = []
  const audits: { action: string; afterState?: unknown }[] = []

  function query(table: string) {
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let payload: Row = {}
    const eqs: Record<string, unknown> = {}
    const ins: Record<string, unknown[]> = {}
    const ors: [string, unknown][] = []
    let single = false
    const rows = () => (state.tables[table] ??= [])
    const matches = (r: Row) =>
      Object.entries(eqs).every(([k, v]) => r[k] === v) &&
      Object.entries(ins).every(([k, vs]) => vs.includes(r[k])) &&
      (ors.length === 0 || ors.some(([k, v]) => r[k] === v))
    const run = () => {
      const err = state.errors[`${table}:${op}`]
      if (err) return { data: null, error: err }
      let out: Row[]
      if (op === 'insert') {
        writes.push({ table, op, row: payload, where: {} })
        if (
          table === 'listing_location_links' &&
          rows().some((r) => r.location_listing_id === payload.location_listing_id)
        ) {
          return { data: null, error: { message: 'dup', code: '23505' } }
        }
        rows().push({ created_at: new Date().toISOString(), ...payload })
        out = [payload]
      } else if (op === 'update') {
        out = rows().filter(matches)
        for (const r of out) Object.assign(r, payload)
        writes.push({ table, op, row: payload, where: { ...eqs } })
      } else if (op === 'delete') {
        out = rows().filter(matches)
        state.tables[table] = rows().filter((r) => !matches(r))
        writes.push({ table, op, where: { ...eqs } })
      } else {
        out = rows().filter(matches)
      }
      return { data: single ? (out[0] ?? null) : out, error: null }
    }
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      is: (col: string, val: unknown) => {
        eqs[col] = val
        return q
      },
      eq: (col: string, val: unknown) => {
        eqs[col] = val
        return q
      },
      in: (col: string, vals: unknown[]) => {
        ins[col] = vals
        return q
      },
      or: (expr: string) => {
        for (const part of expr.split(',')) {
          const [col, , val] = part.split('.')
          ors.push([col!, val])
        }
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

  const client = () => ({ from: (t: string) => query(t) })
  return {
    state,
    writes,
    audits,
    client,
    createClient: vi.fn(async () => client()),
    createServiceClient: vi.fn(() => client()),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: h.createClient,
  createServiceClient: h.createServiceClient,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/dashboard/guard', () => ({
  getOwnerSession: async () => (h.state.user ? { user: h.state.user } : null),
}))
vi.mock('@/lib/audit/system', () => ({
  writeSystemAuditLog: async (e: { action: string; afterState?: unknown }) => {
    h.audits.push({ action: e.action, afterState: e.afterState })
  },
}))

import {
  coversLocations,
  linkedSlots,
  linkedTiers,
  toLocationLinks,
  type LocationLinkRow,
} from '@/lib/listings/locations'
import { ownTier, syncLocationTiers } from '@/lib/services/billing/locationTiers'
import { linkLocationAction, unlinkLocationAction } from '@/lib/actions/dashboard/locations'

function read(file: string): string {
  return readFileSync(join(__dirname, '..', file), 'utf8')
}

const service = () => h.client() as unknown as Parameters<typeof syncLocationTiers>[0]

function page(id: string, patch: Row = {}): Row {
  return {
    id,
    name: `Page ${id.slice(0, 1).toUpperCase()}`,
    slug: `page-${id.slice(0, 1)}`,
    status: 'published',
    entity_type: 'business',
    tier: 'free',
    owner_user_id: 'owner-1',
    deleted_at: null,
    cities: { slug: 'houston' },
    ...patch,
  }
}

function link(location: string, primary: string, created: string): Row {
  return {
    location_listing_id: location,
    primary_listing_id: primary,
    owner_user_id: 'owner-1',
    created_at: created,
  }
}

beforeEach(() => {
  h.writes.length = 0
  h.audits.length = 0
  h.state.user = { id: 'owner-1' }
  h.state.errors = {}
  h.state.tables = {
    listings: [page(A, { tier: 'premium' }), page(B), page(C), page(D)],
    listing_location_links: [],
    subscriptions: [],
  }
})

// ── Rules ────────────────────────────────────────────────────────────────────

describe('the rules', () => {
  it('Premium covers the page and 2 more; other plans cover none', () => {
    expect(linkedSlots('premium')).toBe(2)
    expect(coversLocations('premium')).toBe(true)
    for (const tier of ['free', 'starter', 'growth', null]) {
      expect(linkedSlots(tier)).toBe(0)
      expect(coversLocations(tier)).toBe(false)
    }
  })

  const links: LocationLinkRow[] = [
    { location_listing_id: B, primary_listing_id: A, created_at: '2026-11-01' },
    { location_listing_id: C, primary_listing_id: A, created_at: '2026-11-02' },
    { location_listing_id: D, primary_listing_id: A, created_at: '2026-11-03' },
  ]

  it('linked pages take Premium up to the slots, oldest first', () => {
    expect(linkedTiers('premium', links)).toEqual([
      { id: B, tier: 'premium' },
      { id: C, tier: 'premium' },
      { id: D, tier: 'free' },
    ])
  })

  it('below Premium every linked page is Free', () => {
    expect(linkedTiers('growth', links).map((l) => l.tier)).toEqual(['free', 'free', 'free'])
    expect(linkedTiers('free', links).map((l) => l.tier)).toEqual(['free', 'free', 'free'])
  })

  it('builds the Also At list: primary first, never itself, only pages the read returned', () => {
    const rows = [
      {
        id: A,
        slug: 'cafe-midtown',
        name: 'Cafe Midtown',
        entity_type: 'business',
        cities: { name: 'Houston', slug: 'houston' },
        listing_details_business: {
          address_line_1: '1 Main St',
          city_text: null,
          lat: 29.7,
          lng: -95.3,
        },
      },
      {
        id: C,
        slug: 'cafe-dallas',
        name: 'Cafe Dallas',
        entity_type: 'business',
        cities: null,
        listing_details_business: {
          address_line_1: null,
          city_text: 'Dallas',
          lat: null,
          lng: null,
        },
      },
    ]
    expect(toLocationLinks(B, [A, B, C, D], rows)).toEqual([
      {
        id: A,
        label: 'Cafe Midtown',
        cityName: 'Houston',
        addressLine: '1 Main St',
        href: '/houston/business/cafe-midtown',
        lat: 29.7,
        lng: -95.3,
      },
      {
        id: C,
        label: 'Cafe Dallas',
        cityName: 'Dallas',
        addressLine: null,
        href: '/online/business/cafe-dallas',
        lat: null,
        lng: null,
      },
    ])
  })
})

// ── The webhook's sync ───────────────────────────────────────────────────────

describe('syncLocationTiers', () => {
  beforeEach(() => {
    h.state.tables.listing_location_links = [link(B, A, '2026-11-01'), link(C, A, '2026-11-02')]
  })

  it('a Premium primary lifts its linked pages, and a second run writes nothing', async () => {
    const first = await syncLocationTiers(service(), A, 'premium')
    expect(first).toEqual([
      { id: B, from: 'free', to: 'premium' },
      { id: C, from: 'free', to: 'premium' },
    ])
    h.writes.length = 0
    expect(await syncLocationTiers(service(), A, 'premium')).toEqual([])
    expect(h.writes).toHaveLength(0)
  })

  it('a drop below Premium returns them to Free and keeps the links', async () => {
    for (const r of h.state.tables.listings!) if (r.id !== A) r.tier = 'premium'
    const changes = await syncLocationTiers(service(), A, 'growth')
    expect(changes.map((c) => c.to)).toEqual(['free', 'free'])
    expect(h.state.tables.listing_location_links).toHaveLength(2)
    expect(h.writes.some((w) => w.op === 'delete')).toBe(false)
  })

  it('leaves a linked page with its own live plan alone', async () => {
    h.state.tables.subscriptions = [{ listing_id: C, status: 'active' }]
    const changes = await syncLocationTiers(service(), A, 'premium')
    expect(changes.map((c) => c.id)).toEqual([B])
  })

  it('no links, or the table not there yet, is a no-op', async () => {
    expect(await syncLocationTiers(service(), B, 'premium')).toEqual([])
    h.state.errors['listing_location_links:select'] = { message: 'missing', code: '42P01' }
    expect(await syncLocationTiers(service(), A, 'premium')).toEqual([])
  })

  it('throws on a read or write error, so Stripe retries', async () => {
    h.state.errors['listing_location_links:select'] = { message: 'down' }
    await expect(syncLocationTiers(service(), A, 'premium')).rejects.toThrow()
    h.state.errors = { 'listings:update': { message: 'denied' } }
    await expect(syncLocationTiers(service(), A, 'premium')).rejects.toThrow()
  })

  it('ownTier is the page’s own live plan, else Free', async () => {
    expect(await ownTier(service(), B)).toBe('free')
    h.state.tables.subscriptions = [
      { listing_id: B, status: 'active', plans: { plan_key: 'starter' } },
    ]
    expect(await ownTier(service(), B)).toBe('starter')
  })
})

// ── The owner's actions ──────────────────────────────────────────────────────

describe('linkLocationAction', () => {
  it('links a page and gives it the primary’s tier', async () => {
    expect(await linkLocationAction({ primaryId: A, locationId: B })).toEqual({ success: true })
    expect(h.state.tables.listing_location_links).toEqual([
      expect.objectContaining({
        location_listing_id: B,
        primary_listing_id: A,
        owner_user_id: 'owner-1',
      }),
    ])
    expect(h.state.tables.listings!.find((r) => r.id === B)!.tier).toBe('premium')
    expect(h.audits[0]).toMatchObject({ action: 'location_linked' })
  })

  it('needs Premium on the primary', async () => {
    h.state.tables.listings![0]!.tier = 'growth'
    expect(await linkLocationAction({ primaryId: A, locationId: B })).toEqual({
      error: 'Linking locations comes with Premium.',
    })
    expect(h.writes).toHaveLength(0)
  })

  it('only the owner’s own business pages', async () => {
    h.state.tables.listings!.find((r) => r.id === B)!.owner_user_id = 'someone-else'
    expect(await linkLocationAction({ primaryId: A, locationId: B })).toHaveProperty('error')
    h.state.tables.listings!.find((r) => r.id === C)!.entity_type = 'event'
    expect(await linkLocationAction({ primaryId: A, locationId: C })).toHaveProperty('error')
    expect(await linkLocationAction({ primaryId: A, locationId: A })).toHaveProperty('error')
    expect(await linkLocationAction({ primaryId: A, locationId: 'nope' })).toHaveProperty('error')
    h.state.user = null
    expect(await linkLocationAction({ primaryId: A, locationId: D })).toHaveProperty('error')
    expect(h.writes).toHaveLength(0)
  })

  it('stops at 2 linked pages', async () => {
    await linkLocationAction({ primaryId: A, locationId: B })
    await linkLocationAction({ primaryId: A, locationId: C })
    expect(await linkLocationAction({ primaryId: A, locationId: D })).toEqual({
      error: 'Premium covers 3 locations: this page and 2 more.',
    })
  })

  it('refuses chains and double links', async () => {
    const E = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    h.state.tables.listings!.push(page(E, { tier: 'premium' }))
    await linkLocationAction({ primaryId: A, locationId: B })
    // B is a location: it can't be a primary, and it can't be linked again.
    h.state.tables.listings!.find((r) => r.id === B)!.tier = 'premium'
    expect(await linkLocationAction({ primaryId: B, locationId: C })).toHaveProperty('error')
    expect(await linkLocationAction({ primaryId: E, locationId: B })).toHaveProperty('error')
    // A has locations: it can't be linked under another page.
    expect(await linkLocationAction({ primaryId: E, locationId: A })).toHaveProperty('error')
    expect(h.state.tables.listing_location_links).toHaveLength(1)
  })

  it('refuses a page that pays for its own plan', async () => {
    h.state.tables.subscriptions = [{ listing_id: B, status: 'active' }]
    const r = await linkLocationAction({ primaryId: A, locationId: B })
    expect(r).toHaveProperty('error')
    expect('error' in r && r.error).toMatch(/has its own plan/)
  })

  it('takes the link back when the tier write fails', async () => {
    h.state.errors['listings:update'] = { message: 'denied' }
    expect(await linkLocationAction({ primaryId: A, locationId: B })).toHaveProperty('error')
    expect(h.state.tables.listing_location_links).toHaveLength(0)
  })
})

describe('unlinkLocationAction', () => {
  beforeEach(() => {
    h.state.tables.listing_location_links = [link(B, A, '2026-11-01')]
    h.state.tables.listings!.find((r) => r.id === B)!.tier = 'premium'
  })

  it('removes the link and returns the page to Free', async () => {
    expect(await unlinkLocationAction({ locationId: B })).toEqual({ success: true })
    expect(h.state.tables.listing_location_links).toHaveLength(0)
    expect(h.state.tables.listings!.find((r) => r.id === B)!.tier).toBe('free')
    expect(h.audits[0]).toMatchObject({ action: 'location_unlinked', afterState: { tier: 'free' } })
  })

  it('works whatever the primary’s plan', async () => {
    h.state.tables.listings![0]!.tier = 'free'
    expect(await unlinkLocationAction({ locationId: B })).toEqual({ success: true })
  })

  it('refuses a page that isn’t linked, or isn’t yours', async () => {
    expect(await unlinkLocationAction({ locationId: C })).toHaveProperty('error')
    h.state.user = { id: 'stranger' }
    expect(await unlinkLocationAction({ locationId: B })).toHaveProperty('error')
    expect(h.state.tables.listing_location_links).toHaveLength(1)
  })

  it('puts the link back when the tier reset fails', async () => {
    h.state.errors['listings:update'] = { message: 'denied' }
    expect(await unlinkLocationAction({ locationId: B })).toHaveProperty('error')
    expect(h.state.tables.listing_location_links).toHaveLength(1)
  })
})

// ── Wiring ───────────────────────────────────────────────────────────────────

describe('migration 20261122000000_listing_location_links', () => {
  const sql = read('supabase/migrations/20261122000000_listing_location_links.sql')

  it('has read policies only, and revokes writes', () => {
    const policies = sql.match(/ON public\.listing_location_links FOR (\w+)/g) ?? []
    expect(policies.length).toBe(2)
    for (const p of policies) expect(p).toMatch(/FOR SELECT$/)
    expect(sql).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON public\.listing_location_links FROM anon, authenticated/
    )
  })

  it('one group a page, no self links, no chains', () => {
    expect(sql).toMatch(/location_listing_id uuid\s+NOT NULL PRIMARY KEY/)
    expect(sql).toMatch(/CHECK \(location_listing_id <> primary_listing_id\)/)
    expect(sql).toMatch(/CREATE TRIGGER listing_location_links_no_chain/)
  })
})

describe('wiring', () => {
  it('both subscription handlers sync linked locations after the primary’s tier', () => {
    const src = read('lib/services/billing/webhookHandlers.ts')
    expect(src.match(/await syncLocationTiers\(supabase, listingId, newTier\)/g)).toHaveLength(2)
  })

  it('checkout refuses a page another plan covers', () => {
    const src = read('app/api/stripe/create-checkout-session/route.ts')
    expect(src).toContain(".from('listing_location_links')")
    expect(src).toContain("code: 'COVERED_BY_LOCATION'")
  })

  it('the loader fills locations on covered business pages', () => {
    const src = read('lib/listings/entityPage.ts')
    expect(src).toContain('loadLocations(sb, raw.id)')
    expect(src).toContain('...(locations.length > 0 ? { locations } : {})')
  })

  it('the dashboard page and sidebar link exist', () => {
    expect(read('app/dashboard/pages/[entityId]/locations/page.tsx')).toContain('LocationsManager')
    expect(read('components/dashboard/DashboardSidebar.tsx')).toContain('/locations`')
  })
})
