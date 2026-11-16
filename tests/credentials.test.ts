import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 192: credentials, awards and press. What is pinned here:
//   * the form's rules: a kind, a title, https links only, no future year.
//   * the plan: Starter and up adds; editing, reordering and removing always.
//   * the section gate and the loader: hidden below Starter, nothing deleted.
//   * the migration: the CHECKs mirror the form, RLS as listing_faqs.

const PAGE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const X = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const Y = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

type Row = Record<string, unknown>

const h = vi.hoisted(() => {
  const state = {
    user: null as { id: string } | null,
    listing: null as Row | null,
    items: [] as Row[],
    failWrite: false,
  }
  const writes: { op: string; row?: Row; where: Record<string, unknown> }[] = []
  let nextId = 0

  function query(table: string) {
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let payload: Row = {}
    const eqs: Record<string, unknown> = {}
    let single = false
    const matches = (r: Row) => Object.entries(eqs).every(([k, v]) => r[k] === v)
    const run = () => {
      if (table === 'listings') {
        const l = state.listing
        const ok = l && state.user && l.owner_user_id === state.user.id && eqs.id === l.id
        return { data: ok ? l : null, error: null }
      }
      if (op !== 'select' && state.failWrite) return { data: null, error: { message: 'denied' } }
      if (op === 'insert') {
        nextId += 1
        state.items.push({
          id: `dddddddd-dddd-4ddd-8ddd-${String(nextId).padStart(12, '0')}`,
          ...payload,
        })
        writes.push({ op, row: payload, where: {} })
      } else if (op === 'update') {
        for (const r of state.items.filter(matches)) Object.assign(r, payload)
        writes.push({ op, row: payload, where: { ...eqs } })
      } else if (op === 'delete') {
        state.items = state.items.filter((r) => !matches(r))
        writes.push({ op, where: { ...eqs } })
      }
      const out = state.items.filter(matches).map((r) => ({ ...r }))
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
vi.mock('@/lib/dashboard/guard', () => ({
  getOwnerSession: async () => (h.state.user ? { user: h.state.user } : null),
}))

import {
  CREDENTIALS_SAVED_MAX,
  checkCredentialAdd,
  credentialsShowOn,
  parseCredential,
  safeHttpsUrl,
  toOwnerCredentials,
  toPublicCredentials,
} from '@/lib/listings/credentials'
import {
  deleteCredentialAction,
  reorderCredentialsAction,
  saveCredentialAction,
} from '@/lib/actions/dashboard/credentials'
import { applyTierGates } from '@/lib/entity-page/sections'
import type { EntityPageData } from '@/types'

function read(file: string): string {
  return readFileSync(join(__dirname, '..', file), 'utf8')
}

const form = (patch: Record<string, unknown> = {}) => ({
  kind: 'award',
  title: 'Best Coffee in Houston',
  issuer: 'Houston Press',
  year: '2024',
  url: '',
  ...patch,
})

function item(id: string, order: number, patch: Row = {}): Row {
  return {
    id,
    listing_id: PAGE,
    kind: 'license',
    title: `Item ${order}`,
    issuer: null,
    year: null,
    url: null,
    sort_order: order,
    ...patch,
  }
}

beforeEach(() => {
  h.writes.length = 0
  h.state.user = { id: 'owner-1' }
  h.state.failWrite = false
  h.state.items = []
  h.state.listing = {
    id: PAGE,
    slug: 'cafe',
    status: 'published',
    entity_type: 'business',
    tier: 'starter',
    owner_user_id: 'owner-1',
    cities: { slug: 'houston' },
  }
})

// ── The form ─────────────────────────────────────────────────────────────────

describe('parseCredential', () => {
  it('accepts a full item and trims it', () => {
    expect(
      parseCredential(form({ title: '  Best   Coffee ', url: 'https://houstonpress.com/a' }), 2026)
    ).toEqual({
      ok: true,
      value: {
        kind: 'award',
        title: 'Best Coffee',
        issuer: 'Houston Press',
        year: 2024,
        url: 'https://houstonpress.com/a',
      },
    })
  })

  it('issuer, year and link are optional', () => {
    const r = parseCredential(form({ issuer: '', year: '', url: '' }), 2026)
    expect(r).toMatchObject({ ok: true, value: { issuer: null, year: null, url: null } })
  })

  it('needs a known kind and a title of 80 or fewer', () => {
    expect(parseCredential(form({ kind: 'trophy' }), 2026).ok).toBe(false)
    expect(parseCredential(form({ title: '   ' }), 2026).ok).toBe(false)
    expect(parseCredential(form({ title: 'x'.repeat(81) }), 2026).ok).toBe(false)
    expect(parseCredential(form({ issuer: 'x'.repeat(81) }), 2026).ok).toBe(false)
  })

  it('refuses a year in the future, before 1900, or not four digits', () => {
    expect(parseCredential(form({ year: '2026' }), 2026).ok).toBe(true)
    expect(parseCredential(form({ year: '2027' }), 2026)).toEqual({
      ok: false,
      error: 'The year can’t be in the future.',
    })
    expect(parseCredential(form({ year: '1899' }), 2026).ok).toBe(false)
    expect(parseCredential(form({ year: '24' }), 2026).ok).toBe(false)
    expect(parseCredential(form({ year: '2024.5' }), 2026).ok).toBe(false)
    expect(parseCredential(form({ year: 2024 }), 2026).ok).toBe(true)
  })

  it('links must be https with a real host', () => {
    for (const bad of [
      'http://houstonpress.com',
      'javascript:alert(1)',
      'houstonpress.com',
      'https://localhost/x',
      'https://user:pw@houstonpress.com',
      `https://a.com/${'x'.repeat(500)}`,
    ]) {
      expect(parseCredential(form({ url: bad }), 2026).ok, bad).toBe(false)
      expect(safeHttpsUrl(bad), bad).toBeNull()
    }
    expect(safeHttpsUrl(' https://Example.com/a b ')).toBe('https://example.com/a%20b')
  })
})

describe('rows and the page', () => {
  it('drops bad rows (unknown kind, no title, unsafe link) and sorts', () => {
    const rows = [
      item(Y, 2, { url: 'http://insecure.com' }),
      item(X, 1, { kind: 'press', url: 'https://ok.com/' }),
      { id: 'z', kind: 'trophy', title: 'Nope', sort_order: 0 },
      { id: 'w', kind: 'award', title: ' ', sort_order: 0 },
    ]
    const owner = toOwnerCredentials(rows)
    expect(owner.map((c) => c.id)).toEqual([X, Y])
    expect(owner[1]!.url).toBeNull()
    expect(toPublicCredentials(owner)[0]).toEqual({
      id: X,
      kind: 'press',
      title: 'Item 1',
      issuer: null,
      year: null,
      href: 'https://ok.com/',
    })
  })

  it('Starter and up, business pages only', () => {
    expect(credentialsShowOn({ tier: 'free', entity_type: 'business' })).toBe(false)
    expect(credentialsShowOn({ tier: null, entity_type: 'business' })).toBe(false)
    expect(credentialsShowOn({ tier: 'starter', entity_type: 'business' })).toBe(true)
    expect(credentialsShowOn({ tier: 'premium', entity_type: 'event' })).toBe(false)
    expect(credentialsShowOn({ tier: 'premium', entity_type: 'job' })).toBe(false)
  })

  it('the section gate hides them below Starter without dropping anything', () => {
    const credentials = [
      { id: X, kind: 'award' as const, title: 'A', issuer: null, year: null, href: null },
    ]
    const entity = {
      credentials,
      details: { videos: [] },
      images: [],
      faqs: [],
    } as unknown as EntityPageData
    expect(applyTierGates(entity, 'free').credentials).toBeUndefined()
    expect(applyTierGates(entity, 'starter').credentials).toEqual(credentials)
    expect(entity.credentials).toEqual(credentials)
  })

  it('adding needs Starter and stops at the saved bound', () => {
    expect(checkCredentialAdd('free', 0)).toMatch(/come with Starter/)
    expect(checkCredentialAdd('starter', 0)).toBeNull()
    expect(checkCredentialAdd('premium', CREDENTIALS_SAVED_MAX)).toMatch(/Remove one/)
  })
})

// ── The owner's actions ──────────────────────────────────────────────────────

describe('saveCredentialAction', () => {
  it('adds an item at the end of the list', async () => {
    h.state.items = [item(X, 0)]
    const r = await saveCredentialAction({ listingId: PAGE, ...form() })
    expect(r).toMatchObject({ success: true })
    expect(h.writes[0]).toMatchObject({
      op: 'insert',
      row: { listing_id: PAGE, sort_order: 1, kind: 'award', year: 2024 },
    })
    expect('items' in r && r.items).toHaveLength(2)
  })

  it('edits an item in place', async () => {
    h.state.items = [item(X, 0)]
    const r = await saveCredentialAction({ listingId: PAGE, id: X, ...form({ title: 'Renamed' }) })
    expect(r).toMatchObject({ success: true })
    expect(h.writes[0]).toMatchObject({ op: 'update', where: { id: X, listing_id: PAGE } })
    expect(h.state.items[0]!.title).toBe('Renamed')
  })

  it('a Free page can’t add, but can still edit what it has', async () => {
    h.state.listing!.tier = 'free'
    h.state.items = [item(X, 0)]
    expect(await saveCredentialAction({ listingId: PAGE, ...form() })).toEqual({
      error: 'Credentials and press come with Starter. Upgrade to add yours.',
    })
    expect(await saveCredentialAction({ listingId: PAGE, id: X, ...form() })).toMatchObject({
      success: true,
    })
  })

  it('refuses a bad form, someone else’s page, a job page, an unknown item', async () => {
    expect(
      await saveCredentialAction({ listingId: PAGE, ...form({ year: '2999' }) })
    ).toHaveProperty('error')
    expect(await saveCredentialAction({ listingId: PAGE, id: Y, ...form() })).toHaveProperty(
      'error'
    )
    expect(await saveCredentialAction({ listingId: 'nope', ...form() })).toHaveProperty('error')
    h.state.listing!.entity_type = 'job'
    expect(await saveCredentialAction({ listingId: PAGE, ...form() })).toHaveProperty('error')
    h.state.listing!.entity_type = 'business'
    h.state.user = { id: 'stranger' }
    expect(await saveCredentialAction({ listingId: PAGE, ...form() })).toHaveProperty('error')
    h.state.user = null
    expect(await saveCredentialAction({ listingId: PAGE, ...form() })).toHaveProperty('error')
    expect(h.writes).toHaveLength(0)
  })

  it('a failed write is an error, not a success', async () => {
    h.state.failWrite = true
    expect(await saveCredentialAction({ listingId: PAGE, ...form() })).toHaveProperty('error')
  })
})

describe('reorder and delete', () => {
  beforeEach(() => {
    h.state.items = [item(X, 0), item(Y, 1)]
  })

  it('reorders, writing only the rows that moved', async () => {
    const r = await reorderCredentialsAction({ listingId: PAGE, ids: [Y, X] })
    expect('items' in r && r.items.map((c) => c.id)).toEqual([Y, X])
    expect(h.writes).toHaveLength(2)
    h.writes.length = 0
    await reorderCredentialsAction({ listingId: PAGE, ids: [Y, X] })
    expect(h.writes).toHaveLength(0)
  })

  it('refuses an order that isn’t exactly the page’s items', async () => {
    for (const ids of [[X], [X, X], [X, Y, Y], [X, 'other'], 'x']) {
      expect(await reorderCredentialsAction({ listingId: PAGE, ids })).toHaveProperty('error')
    }
    expect(h.writes).toHaveLength(0)
  })

  it('removes an item, on any plan', async () => {
    h.state.listing!.tier = 'free'
    const r = await deleteCredentialAction({ listingId: PAGE, id: X })
    expect('items' in r && r.items.map((c) => c.id)).toEqual([Y])
    expect(h.writes[0]).toMatchObject({ op: 'delete', where: { id: X, listing_id: PAGE } })
    expect(await deleteCredentialAction({ listingId: PAGE, id: 'nope' })).toHaveProperty('error')
  })
})

// ── Wiring ───────────────────────────────────────────────────────────────────

describe('migration 20261123000000_listing_credentials', () => {
  const sql = read('supabase/migrations/20261123000000_listing_credentials.sql')

  it('the CHECKs mirror the form', () => {
    expect(sql).toMatch(/CHECK \(kind IN \('license', 'certification', 'award', 'press'\)\)/)
    expect(sql).toMatch(/CHECK \(char_length\(btrim\(title\)\) BETWEEN 1 AND 80\)/)
    expect(sql).toMatch(
      /CHECK \(issuer IS NULL OR char_length\(btrim\(issuer\)\) BETWEEN 1 AND 80\)/
    )
    expect(sql).toMatch(/CHECK \(year IS NULL OR year BETWEEN 1900 AND 2100\)/)
    expect(sql).toMatch(/url LIKE 'https:\/\/%' AND char_length\(url\) <= 500/)
  })

  it('RLS as listing_faqs: two reads, owner writes, updated_at kept', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql.match(/FOR SELECT TO (anon|authenticated)/g)).toHaveLength(2)
    for (const op of ['INSERT', 'UPDATE', 'DELETE']) {
      expect(sql).toMatch(new RegExp(`FOR ${op} TO authenticated`))
    }
    expect(sql).not.toMatch(/TO anon[\s\S]{0,40}FOR (INSERT|UPDATE|DELETE)/)
    expect(sql).toContain('EXECUTE FUNCTION update_updated_at()')
    expect(sql).toMatch(/ON public\.listing_credentials \(listing_id, sort_order\)/)
  })
})

describe('wiring', () => {
  it('the loader fills credentials on Starter+ business pages', () => {
    const src = read('lib/listings/entityPage.ts')
    expect(src).toContain('credentialsShowOn(raw)')
    expect(src).toContain('...(credentials.length > 0 ? { credentials } : {})')
  })

  it('the section is gated at Starter, with the dashboard page and sidebar link', () => {
    expect(read('lib/entity-page/sections.ts')).toContain("gate: { feature: 'credentials' }")
    expect(read('app/dashboard/pages/[entityId]/credentials/page.tsx')).toContain(
      'CredentialsManager'
    )
    expect(read('components/dashboard/DashboardSidebar.tsx')).toContain('/credentials`')
  })

  it('press links open safely in a new tab', () => {
    const src = read('components/entity-page/EntityCredentialsSection.tsx')
    expect(src).toContain('target="_blank"')
    expect(src).toContain('rel="noopener noreferrer"')
  })
})
