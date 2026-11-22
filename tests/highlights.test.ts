import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 195: highlights ("Why Choose Us") and process steps ("How It Works").
// What is pinned here:
//   * the rules: a 1–60 character title, an optional description up to 160,
//     and an icon only from the allow-list the page renders from.
//   * the plan: Free 0, Starter 4, Growth and Premium 6. Adding stops at the
//     limit; editing, reordering, removing and switching style always work.
//   * one kind per page: a new item takes the page's kind; switching style
//     moves every item.
//   * the section gate shows the first ones the plan allows, deleting nothing.
//   * the migration: the CHECKs mirror the rules, RLS as listing_faqs.

const PAGE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
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
        const ok = l && state.user && eqs.owner_user_id === state.user.id && eqs.id === l.id
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
    resetIds: () => {
      nextId = 0
    },
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
  checkHighlightAdd,
  highlightsShowOn,
  kindForNew,
  parseHighlight,
  toOwnerHighlights,
  toPublicHighlights,
} from '@/lib/listings/highlights'
import {
  deleteHighlightAction,
  reorderHighlightsAction,
  saveHighlightAction,
  setHighlightsKindAction,
} from '@/lib/actions/dashboard/highlights'
import { HIGHLIGHT_ICONS } from '@/components/entity-page/highlightIcons'
import { applyTierGates } from '@/lib/entity-page/sections'
import { highlightLimit } from '@/lib/stripe/features'
import type { EntityPageData } from '@/types'

function read(file: string): string {
  return readFileSync(join(__dirname, '..', file), 'utf8')
}

function item(id: string, sortOrder: number, kind = 'highlight'): Row {
  return {
    id,
    listing_id: PAGE,
    kind,
    icon: 'star',
    title: `Item ${sortOrder}`,
    text: null,
    sort_order: sortOrder,
  }
}

const form = (patch: Record<string, unknown> = {}) => ({
  listingId: PAGE,
  icon: 'coffee',
  title: 'Roasted on Site',
  text: 'Every Tuesday and Friday.',
  ...patch,
})

beforeEach(() => {
  h.writes.length = 0
  h.resetIds()
  h.state.user = { id: 'u1' }
  h.state.listing = {
    id: PAGE,
    owner_user_id: 'u1',
    slug: 'cafe',
    status: 'published',
    entity_type: 'business',
    tier: 'starter',
    cities: { slug: 'atlanta' },
  }
  h.state.items = []
  h.state.failWrite = false
})

// ── The rules ────────────────────────────────────────────────────────────────

describe('the rules', () => {
  it('plan limits: Free 0, Starter 4, Growth and Premium 6', () => {
    expect(highlightLimit('free')).toBe(0)
    expect(highlightLimit(null)).toBe(0)
    expect(highlightLimit('starter')).toBe(4)
    expect(highlightLimit('growth')).toBe(6)
    expect(highlightLimit('premium')).toBe(6)
  })

  it('shows on Starter+ business pages only', () => {
    expect(highlightsShowOn({ tier: 'free', entity_type: 'business' })).toBe(false)
    expect(highlightsShowOn({ tier: 'starter', entity_type: 'business' })).toBe(true)
    expect(highlightsShowOn({ tier: 'premium', entity_type: 'job' })).toBe(false)
    expect(highlightsShowOn({ tier: 'premium', entity_type: 'event' })).toBe(false)
  })

  it('adding stops at the plan limit', () => {
    expect(checkHighlightAdd('free', 0)).toMatch(/come with Starter/)
    expect(checkHighlightAdd('starter', 3)).toBeNull()
    expect(checkHighlightAdd('starter', 4)).toBe(
      'Your plan includes 4 highlights. Remove one to add another.'
    )
    expect(checkHighlightAdd('growth', 5)).toBeNull()
    expect(checkHighlightAdd('premium', 6)).toMatch(/includes 6/)
  })

  it('the form: a title, an optional description, an allow-listed icon or none', () => {
    expect(parseHighlight({ icon: 'coffee', title: '  Roasted   on Site ', text: '' })).toEqual({
      ok: true,
      value: { icon: 'coffee', title: 'Roasted on Site', text: null },
    })
    expect(parseHighlight({ icon: '', title: 'A', text: 'B' })).toMatchObject({
      ok: true,
      value: { icon: null, text: 'B' },
    })
    expect(parseHighlight({ icon: null, title: 'A', text: null })).toMatchObject({ ok: true })
    expect(parseHighlight({ icon: 'coffee', title: '', text: '' })).toMatchObject({ ok: false })
    expect(parseHighlight({ icon: null, title: 'x'.repeat(61), text: '' })).toMatchObject({
      ok: false,
    })
    expect(parseHighlight({ icon: null, title: 'A', text: 'x'.repeat(161) })).toMatchObject({
      ok: false,
    })
  })

  it('refuses any icon name not on the allow-list', () => {
    for (const bad of ['Coffee', 'skull', 'constructor', '__proto__', '<svg>', 42]) {
      expect(parseHighlight({ icon: bad, title: 'A', text: '' })).toEqual({
        ok: false,
        error: 'Choose an icon from the list.',
      })
    }
    for (const name of Object.keys(HIGHLIGHT_ICONS)) {
      expect(parseHighlight({ icon: name, title: 'A', text: '' }), name).toMatchObject({
        ok: true,
      })
      // The allow-list fits the table's CHECK.
      expect(name).toMatch(/^[a-z][a-z-]{0,39}$/)
    }
  })

  it('a new item takes the page’s kind; an empty page takes the one picked', () => {
    const steps = toOwnerHighlights([item(X, 0, 'step')])
    expect(kindForNew(steps, 'highlight')).toBe('step')
    expect(kindForNew([], 'step')).toBe('step')
    expect(kindForNew([], 'bogus')).toBe('highlight')
  })

  it('maps rows, dropping bad ones and unknown icons', () => {
    const rows = [
      { ...item(Y, 1), icon: 'not-an-icon' },
      item(X, 0),
      { id: 'z', kind: 'banner', title: 'A' },
      { id: 'w', kind: 'step', title: '  ' },
    ]
    const owner = toOwnerHighlights(rows)
    expect(owner.map((r) => r.id)).toEqual([X, Y])
    expect(owner[1]!.icon).toBeNull()
    expect(toPublicHighlights(owner)[0]).toEqual({
      id: X,
      kind: 'highlight',
      icon: 'star',
      title: 'Item 0',
      text: null,
    })
  })
})

// ── The section gate ─────────────────────────────────────────────────────────

describe('the section gate', () => {
  const highlights = Array.from({ length: 7 }, (_, i) => ({
    id: `h${i}`,
    kind: 'highlight' as const,
    icon: null,
    title: `H${i}`,
    text: null,
  }))
  const entity = {
    highlights,
    details: { videos: [] },
    images: [],
    faqs: [],
  } as unknown as EntityPageData

  it('shows the first ones the plan allows, deleting nothing', () => {
    expect(applyTierGates(entity, 'free').highlights).toBeUndefined()
    expect(applyTierGates(entity, 'starter').highlights).toHaveLength(4)
    expect(applyTierGates(entity, 'growth').highlights).toHaveLength(6)
    expect(applyTierGates(entity, 'premium').highlights?.map((x) => x.id)).toEqual(
      highlights.slice(0, 6).map((x) => x.id)
    )
    expect(entity.highlights).toHaveLength(7)
  })
})

// ── The owner's actions ──────────────────────────────────────────────────────

describe('saveHighlightAction', () => {
  it('adds an item at the end of the list with the page’s kind', async () => {
    h.state.items = [item(X, 0, 'step')]
    const r = await saveHighlightAction(form({ kind: 'highlight' }))
    expect(r).toMatchObject({ success: true })
    expect(h.writes[0]).toMatchObject({
      op: 'insert',
      row: {
        listing_id: PAGE,
        kind: 'step',
        sort_order: 1,
        icon: 'coffee',
        title: 'Roasted on Site',
        text: 'Every Tuesday and Friday.',
      },
    })
  })

  it('the first item on an empty page takes the style picked', async () => {
    await saveHighlightAction(form({ kind: 'step' }))
    expect(h.writes[0]).toMatchObject({ op: 'insert', row: { kind: 'step', sort_order: 0 } })
  })

  it('refuses a disallowed icon without writing', async () => {
    expect(await saveHighlightAction(form({ icon: 'skull' }))).toEqual({
      error: 'Choose an icon from the list.',
    })
    expect(h.writes).toHaveLength(0)
  })

  it('refuses Free, and a Starter page at 4', async () => {
    h.state.listing = { ...h.state.listing, tier: 'free' }
    expect(await saveHighlightAction(form())).toHaveProperty(
      'error',
      expect.stringMatching(/come with Starter/)
    )
    h.state.listing = { ...h.state.listing, tier: 'starter' }
    h.state.items = [item('1', 0), item('2', 1), item('3', 2), item('4', 3)]
    expect(await saveHighlightAction(form())).toHaveProperty(
      'error',
      expect.stringMatching(/includes 4/)
    )
    expect(h.writes).toHaveLength(0)
  })

  it('edits on any plan, scoped to the page, keeping the kind', async () => {
    h.state.listing = { ...h.state.listing, tier: 'free' }
    h.state.items = [item(X, 0, 'step')]
    const r = await saveHighlightAction(form({ id: X, title: 'Book a Call', icon: null }))
    expect('items' in r && r.items[0]).toMatchObject({ title: 'Book a Call', kind: 'step' })
    expect(h.writes[0]).toMatchObject({
      op: 'update',
      row: { icon: null, title: 'Book a Call' },
      where: { id: X, listing_id: PAGE },
    })
    expect(h.writes[0]!.row).not.toHaveProperty('kind')
  })

  it('refuses a page the owner does not own, a job, or a missing item', async () => {
    expect(await saveHighlightAction(form({ listingId: OTHER }))).toHaveProperty('error')
    expect(await saveHighlightAction(form({ id: Y }))).toHaveProperty('error')
    h.state.listing = { ...h.state.listing, entity_type: 'job' }
    expect(await saveHighlightAction(form())).toHaveProperty('error')
    expect(h.writes).toHaveLength(0)
  })
})

describe('style, reorder and remove (every plan)', () => {
  beforeEach(() => {
    h.state.listing = { ...h.state.listing, tier: 'free' }
    h.state.items = [item(X, 0), item(Y, 1)]
  })

  it('switching style moves every item on the page', async () => {
    const r = await setHighlightsKindAction({ listingId: PAGE, kind: 'step' })
    expect('items' in r && r.items.map((x) => x.kind)).toEqual(['step', 'step'])
    expect(h.writes[0]).toMatchObject({
      op: 'update',
      row: { kind: 'step' },
      where: { listing_id: PAGE },
    })
    expect(await setHighlightsKindAction({ listingId: PAGE, kind: 'banner' })).toHaveProperty(
      'error'
    )
  })

  it('reorders, writing only the rows that moved', async () => {
    const r = await reorderHighlightsAction({ listingId: PAGE, ids: [Y, X] })
    expect(r).toMatchObject({ success: true })
    expect(h.writes).toHaveLength(2)
    expect(await reorderHighlightsAction({ listingId: PAGE, ids: [X] })).toHaveProperty('error')
  })

  it('removes one, scoped to the page', async () => {
    const r = await deleteHighlightAction({ listingId: PAGE, id: X })
    expect('items' in r && r.items.map((x) => x.id)).toEqual([Y])
    expect(h.writes[0]).toMatchObject({ op: 'delete', where: { id: X, listing_id: PAGE } })
    expect(await deleteHighlightAction({ listingId: PAGE, id: 'nope' })).toHaveProperty('error')
  })
})

// ── Wiring ───────────────────────────────────────────────────────────────────

describe('migration 20261126000000_listing_highlights', () => {
  const sql = read('supabase/migrations/20261126000000_listing_highlights.sql')

  it('the CHECKs mirror the rules', () => {
    expect(sql).toContain("CHECK (kind IN ('highlight', 'step'))")
    expect(sql).toContain("CHECK (icon IS NULL OR icon ~ '^[a-z][a-z-]{0,39}$')")
    expect(sql).toMatch(/CHECK \(char_length\(btrim\(title\)\) BETWEEN 1 AND 60\)/)
    expect(sql).toMatch(/CHECK \(text IS NULL OR char_length\(btrim\(text\)\) BETWEEN 1 AND 160\)/)
  })

  it('RLS as listing_faqs: two reads, owner writes, updated_at kept', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql.match(/FOR SELECT TO (anon|authenticated)/g)).toHaveLength(2)
    for (const op of ['INSERT', 'UPDATE', 'DELETE']) {
      expect(sql).toMatch(new RegExp(`FOR ${op} TO authenticated`))
    }
    expect(sql).toContain('EXECUTE FUNCTION update_updated_at()')
    expect(sql).toMatch(/ON public\.listing_highlights \(listing_id, sort_order\)/)
  })
})

describe('wiring', () => {
  it('the loader fills highlights on Starter+ business pages, fail-soft', () => {
    const src = read('lib/listings/entityPage.ts')
    expect(src).toContain('highlightsShowOn(raw)')
    expect(src).toMatch(/\(\{ data, error \}\) => \(error \? \[\] : toOwnerHighlights\(data\)\)/)
    expect(src).toContain('...(highlights.length > 0 ? { highlights } : {})')
  })

  it('the section is gated at Starter with the plan limit, page and sidebar link', () => {
    expect(read('lib/entity-page/sections.ts')).toContain(
      "gate: { feature: 'highlights', limit: 'highlights' }"
    )
    expect(read('app/dashboard/pages/[entityId]/highlights/page.tsx')).toContain(
      'HighlightsManager'
    )
    expect(read('lib/account/shellNav.ts')).toContain('/highlights`')
  })

  it('the icon picker offers only the allow-list', () => {
    const src = read('components/dashboard/HighlightsManager.tsx')
    expect(src).toContain('Object.keys(HIGHLIGHT_ICONS)')
    expect(src).not.toMatch(/<input[^>]*name="icon"/)
  })
})
