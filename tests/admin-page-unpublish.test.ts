// =============================================================================
// Ticket 284: admin Unpublish for Pages, Put Back, and the do-not-re-add marks
// =============================================================================
// The database's own rules (one transaction, who may call, what Put Back
// refuses) are pinned in tests/migrations/admin-page-unpublish.test.ts. Here:
// the actions, the mark matching, what the admin page is told, the approval
// refusal and the owner's card.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const h = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  writeAuditLog: vi.fn(async () => {}),
  revalidatePath: vi.fn(),
  serviceClient: null as unknown,
}))

vi.mock('@/lib/admin/guard', () => ({
  getAdminSession: h.getAdminSession,
  writeAuditLog: h.writeAuditLog,
}))
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => h.serviceClient }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: vi.fn(async () => {}) }))
vi.mock('@/lib/actions/dashboard/updateListingStatus', () => ({
  updateListingStatusAction: vi.fn(),
}))
vi.mock('@/lib/actions/listings/submitListingForReview', () => ({
  submitListingForReviewAction: vi.fn(),
}))

import { putBackPageAction, unpublishPageAction } from '@/lib/actions/admin/unpublishPage'
import { approveEntityAction } from '@/lib/actions/admin/approveEntity'
import { findPageMark, loadPageMarks, nameKey, type PageMark } from '@/lib/admin/pageMarks'
import { loadMarkMatch, loadPageHide, loadPlanNotice } from '@/lib/admin/pageVisibility'
import { PublishSection } from '@/components/dashboard/PublishSection'

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

type RpcResult = { data: unknown; error: { message: string } | null }
function rpcClient(result: RpcResult) {
  const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => result)
  h.serviceClient = { rpc }
  return rpc
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  h.getAdminSession.mockResolvedValue({ user: { id: 'admin-1' } })
})

// ── Actions ──────────────────────────────────────────────────────────────────

describe('unpublishPageAction', () => {
  const ok = { listing_id: 'p1', reason: 'owner_asked' }

  it('refuses anyone who is not an admin', async () => {
    h.getAdminSession.mockResolvedValue(null)
    const rpc = rpcClient({ data: 'ok', error: null })
    expect(await unpublishPageAction(null, form(ok))).toMatchObject({
      error: expect.stringContaining('permission'),
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('hides through the one database function and refreshes the site', async () => {
    const rpc = rpcClient({ data: 'ok', error: null })
    const res = await unpublishPageAction(
      null,
      form({ ...ok, note: '  By phone  ', do_not_re_add: 'on' })
    )
    expect(res).toEqual({ success: true })
    expect(rpc).toHaveBeenCalledWith('admin_hide_page', {
      p_listing_id: 'p1',
      p_admin_id: 'admin-1',
      p_reason: 'owner_asked',
      p_note: 'By phone',
      p_mark: true,
    })
    expect(h.revalidatePath.mock.calls).toEqual([
      ['/', 'layout'],
      ['/api/map/listings'],
      ['/sitemap.xml'],
    ])
  })

  it('sets no mark when the box is off, and cuts the note to 500', async () => {
    const rpc = rpcClient({ data: 'ok', error: null })
    await unpublishPageAction(null, form({ ...ok, note: 'x'.repeat(600) }))
    const args = rpc.mock.calls[0]![1]
    expect(args.p_mark).toBe(false)
    expect(args.p_note).toHaveLength(500)
  })

  it('needs a known reason, and a note for Other', async () => {
    const rpc = rpcClient({ data: 'ok', error: null })
    for (const fields of [
      { listing_id: 'p1' },
      { listing_id: 'p1', reason: 'because' },
      { listing_id: 'p1', reason: 'other', note: '  ' },
      { reason: 'closed' },
    ] as Record<string, string>[]) {
      expect(await unpublishPageAction(null, form(fields))).toHaveProperty('error')
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('never claims success when the database refused or failed', async () => {
    for (const result of [
      { data: 'not_found', error: null },
      { data: 'is_job', error: null },
      { data: 'not_published', error: null },
      { data: 'something new', error: null },
      { data: null, error: { message: 'audit insert failed' } },
    ]) {
      rpcClient(result)
      expect(await unpublishPageAction(null, form(ok))).toHaveProperty('error')
    }
    expect(h.revalidatePath).not.toHaveBeenCalled()
  })
})

describe('putBackPageAction', () => {
  it('refuses non-admins and a missing reason', async () => {
    const rpc = rpcClient({ data: 'ok', error: null })
    expect(await putBackPageAction(null, form({ listing_id: 'p1', reason: ' ' }))).toHaveProperty(
      'error'
    )
    h.getAdminSession.mockResolvedValue(null)
    expect(await putBackPageAction(null, form({ listing_id: 'p1', reason: 'x' }))).toHaveProperty(
      'error'
    )
    expect(rpc).not.toHaveBeenCalled()
  })

  it('puts the Page back and refreshes the site', async () => {
    const rpc = rpcClient({ data: 'ok', error: null })
    expect(
      await putBackPageAction(null, form({ listing_id: 'p1', reason: 'Owner came back' }))
    ).toEqual({ success: true })
    expect(rpc).toHaveBeenCalledWith('admin_put_back_page', {
      p_listing_id: 'p1',
      p_admin_id: 'admin-1',
      p_reason: 'Owner came back',
    })
    expect(h.revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('says so when something else hid the Page', async () => {
    rpcClient({ data: 'not_ours', error: null })
    expect(await putBackPageAction(null, form({ listing_id: 'p1', reason: 'x' }))).toMatchObject({
      error: expect.stringContaining('not hidden by an admin'),
    })
    expect(h.revalidatePath).not.toHaveBeenCalled()
  })
})

describe('approveEntityAction', () => {
  it('refuses a Page that was taken down and writes nothing', async () => {
    const update = vi.fn()
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({ data: { id: 'p1', status: 'unpublished' }, error: null }),
      update,
    }
    h.serviceClient = { from: () => builder }
    expect(await approveEntityAction(null, form({ listing_id: 'p1' }))).toMatchObject({
      error: expect.stringContaining('taken down'),
    })
    expect(update).not.toHaveBeenCalled()
    expect(h.writeAuditLog).not.toHaveBeenCalled()
  })
})

// ── Marks ────────────────────────────────────────────────────────────────────

const mark = (over: Partial<PageMark> = {}): PageMark => ({
  page_id: 'p1',
  slug: 'made-up-cafe',
  name: 'Made-Up Café & Bar',
  city_slug: 'atlanta-ga',
  city_name: 'Atlanta',
  reason: 'owner_asked',
  marked_at: '2026-11-25T15:00:00Z',
  ...over,
})

describe('findPageMark', () => {
  it('matches the slug whatever the name', () => {
    expect(findPageMark([mark()], { slug: 'made-up-cafe', name: 'New Name' })).not.toBeNull()
  })

  it('matches the same name in the same city, ignoring accents and punctuation', () => {
    expect(nameKey("Made Up CAFE and Bar's")).toBe('made up cafe and bars')
    expect(
      findPageMark([mark()], { name: 'made up cafe and bar', citySlug: 'atlanta-ga' })
    ).not.toBeNull()
    expect(
      findPageMark([mark({ city_slug: null })], { name: 'Made-Up Café & Bar', cityName: 'atlanta' })
    ).not.toBeNull()
  })

  it('does not match another city, another name or an empty name', () => {
    expect(
      findPageMark([mark()], { name: 'Made-Up Café & Bar', citySlug: 'houston-tx' })
    ).toBeNull()
    expect(findPageMark([mark()], { name: 'Other', citySlug: 'atlanta-ga' })).toBeNull()
    expect(findPageMark([mark({ name: '!!!' })], { name: '???' })).toBeNull()
  })

  it('matches on name alone when a city is missing', () => {
    expect(findPageMark([mark()], { name: 'Made-Up Café & Bar' })).not.toBeNull()
    expect(
      findPageMark([mark({ city_slug: null, city_name: null })], {
        name: 'Made-Up Café & Bar',
        citySlug: 'houston-tx',
        cityName: 'Houston',
      })
    ).not.toBeNull()
  })
})

function marksClient(rows: PageMark[], error: { message: string } | null = null) {
  const builder = {
    select: () => builder,
    order: () => builder,
    range: async (from: number, to: number) =>
      error ? { data: null, error } : { data: rows.slice(from, to + 1), error: null },
  }
  return { from: () => builder } as unknown as SupabaseClient
}

describe('reading the marks', () => {
  it('reads past the first 1,000', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => mark({ page_id: `p${i}`, slug: `s${i}` }))
    expect(await loadPageMarks(marksClient(rows))).toHaveLength(1001)
  })

  it('throws rather than reading as no marks', async () => {
    await expect(loadPageMarks(marksClient([], { message: 'down' }))).rejects.toThrow('down')
  })

  it('tells the reviewer about a match, no match, or a failed read', async () => {
    const candidate = { slug: 'x', name: 'Made-Up Café & Bar', citySlug: 'atlanta-ga' }
    expect(await loadMarkMatch(marksClient([mark()]), candidate)).toEqual({
      kind: 'match',
      name: 'Made-Up Café & Bar',
      cityName: 'Atlanta',
      reason: 'owner_asked',
      markedOn: 'Nov 25, 2026',
    })
    expect(await loadMarkMatch(marksClient([]), candidate)).toBeNull()
    expect(await loadMarkMatch(marksClient([], { message: 'down' }), candidate)).toEqual({
      kind: 'unknown',
    })
  })
})

// ── What the admin page shows ────────────────────────────────────────────────

describe('loadPageHide', () => {
  const load = (result: RpcResult) =>
    loadPageHide({ rpc: async () => result } as never, 'p1')

  it('tells an admin hide, someone else’s, and a failed read apart', async () => {
    expect(
      await load({
        data: [{ hidden_at: '2026-11-25T15:00:00Z', reason: 'closed', note: null, marked: false }],
        error: null,
      })
    ).toEqual({
      kind: 'hidden',
      info: { reasonLabel: 'Closed', hiddenOn: 'Nov 25, 2026', note: null, marked: false },
    })
    expect(await load({ data: [], error: null })).toEqual({ kind: 'not_ours' })
    expect(await load({ data: null, error: { message: 'no function' } })).toEqual({
      kind: 'unknown',
    })
  })
})

describe('loadPlanNotice', () => {
  function planClient(
    subs: { data: unknown; error: unknown },
    covered: { data: unknown; error: unknown } = { data: null, error: null }
  ) {
    const filters: string[] = []
    const client = {
      from: (table: string) => {
        const builder = {
          select: () => builder,
          in: () => builder,
          eq: () => builder,
          or: async (f: string) => {
            filters.push(f)
            return subs
          },
          maybeSingle: async () => (table === 'plan_covered_pages' ? covered : subs),
        }
        return builder
      },
    }
    return { client: client as never, filters }
  }
  const listing = { id: 'p1', tier: 'growth', owner_user_id: 'o1' }

  it('names the plan when the subscription or the plan covers this Page', async () => {
    const paid = { kind: 'paid', plan: 'Growth' }
    expect(
      await loadPlanNotice(
        planClient({ data: [{ listing_id: 'p1', user_id: 'o1' }], error: null }).client,
        listing
      )
    ).toEqual(paid)
    expect(
      await loadPlanNotice(
        planClient(
          { data: [{ listing_id: null, user_id: 'o1' }], error: null },
          { data: { listing_id: 'p1' }, error: null }
        ).client,
        listing
      )
    ).toEqual(paid)
  })

  it('says none only when both reads worked and found nothing', async () => {
    expect(
      await loadPlanNotice(planClient({ data: [], error: null }).client, listing)
    ).toEqual({ kind: 'none' })
    expect(
      await loadPlanNotice(
        planClient({ data: [{ listing_id: 'p2', user_id: 'o1' }], error: null }).client,
        listing
      )
    ).toEqual({ kind: 'none' })
  })

  it('says unknown when a read fails', async () => {
    expect(
      await loadPlanNotice(planClient({ data: null, error: { message: 'x' } }).client, listing)
    ).toEqual({ kind: 'unknown' })
    expect(
      await loadPlanNotice(
        planClient(
          { data: [{ listing_id: null, user_id: 'o1' }], error: null },
          { data: null, error: { message: 'x' } }
        ).client,
        listing
      )
    ).toEqual({ kind: 'unknown' })
  })

  it('asks only about the Page when nobody owns it', async () => {
    const { client, filters } = planClient({ data: [], error: null })
    await loadPlanNotice(client, { ...listing, owner_user_id: null })
    expect(filters).toEqual(['listing_id.eq.p1'])
  })
})

// ── The owner's card ─────────────────────────────────────────────────────────

describe('the owner’s Visibility card for an unpublished listing', () => {
  const card = (entityType: string, eventOver = false) =>
    renderToStaticMarkup(
      createElement(PublishSection, {
        listingId: 'p1',
        status: 'unpublished',
        trustTier: 'claimed',
        entityType,
        eventOver,
      })
    )

  it('says a Page, job or live event was taken down, with the support address', () => {
    for (const [type, text] of [
      ['business', 'took this Page down'],
      ['creative', 'took this Page down'],
      ['event', 'took this event down'],
      ['job', 'took this job off the job board'],
    ] as const) {
      const html = card(type)
      expect(html).toContain('Taken Down')
      expect(html).toContain(text)
      expect(html).toContain('mailto:')
    }
  })

  it('says an event that ended has ended, not that it was taken down', () => {
    const html = card('event', true)
    expect(html).toContain('Ended')
    expect(html).not.toContain('Taken Down')
    expect(html).not.toContain('mailto:')
  })
})
