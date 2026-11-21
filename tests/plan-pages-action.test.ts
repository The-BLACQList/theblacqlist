// =============================================================================
// Ticket 238: Pages on Your Plan, the owner's action and the section
// =============================================================================
// The database function set_plan_page_coverage is tested against Postgres in
// tests/migrations/owner-plan-pages.test.ts. Here: the action checks the
// request, calls the function as the owner, maps its refusals to plain
// words, audits, and revalidates. The section is rendered to static markup.
// =============================================================================

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const h = vi.hoisted(() => {
  const state = {
    user: { id: 'owner-1' } as { id: string } | null,
    owned: [] as string[],
    ownedError: null as { message: string } | null,
    allowed: true,
    rpc: { data: null as unknown, error: null as { code?: string; message: string } | null },
  }
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = []
  const ownedQueries: Record<string, unknown>[] = []
  const audits: { action: string; targetId: string | null; afterState?: unknown }[] = []
  const revalidated: string[] = []
  const changed: unknown[] = []

  const ownerClient = {
    from: () => {
      const where: Record<string, unknown> = {}
      const q = {
        select: () => q,
        in: (c: string, v: unknown) => ((where[c] = v), q),
        eq: (c: string, v: unknown) => ((where[c] = v), q),
        is: (c: string, v: unknown) => ((where[c] = v), q),
        then(resolve: (v: unknown) => void) {
          ownedQueries.push(where)
          const ids = (where.id as string[]) ?? []
          return resolve(
            state.ownedError
              ? { data: null, error: state.ownedError }
              : { data: ids.filter((id) => state.owned.includes(id)).map((id) => ({ id })), error: null }
          )
        },
      }
      return q
    },
  }
  const serviceClient = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args })
      return state.rpc
    },
  }
  return { state, rpcCalls, ownedQueries, audits, revalidated, changed, ownerClient, serviceClient }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => h.ownerClient,
  createServiceClient: () => h.serviceClient,
}))
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => h.revalidated.push(p) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/dashboard/guard', () => ({
  getOwnerSession: async () => (h.state.user ? { user: h.state.user } : null),
}))
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: async () => h.state.allowed }))
vi.mock('@/lib/audit/system', () => ({
  writeSystemAuditLog: async (e: { action: string; targetId: string | null; afterState?: unknown }) => {
    h.audits.push({ action: e.action, targetId: e.targetId, afterState: e.afterState })
  },
}))
vi.mock('@/lib/services/billing/planPages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/services/billing/planPages')>()),
  revalidateChanged: async (_s: unknown, changes: unknown[]) => {
    h.changed.push(...changes)
  },
}))
vi.mock('@/lib/actions/billing/createPortalSession', () => ({ createPortalSession: vi.fn() }))

import { setPlanPagesAction } from '@/lib/actions/billing/planPages'
import { PlanPages, type PlanPageRow } from '@/components/dashboard/PlanPages'

const SYNCED = {
  tier: 'premium',
  cap: 3,
  covered: [A, B],
  changes: [{ id: B, from: 'free', to: 'premium' }],
}

beforeEach(() => {
  h.state.user = { id: 'owner-1' }
  h.state.owned = [A, B, C]
  h.state.ownedError = null
  h.state.allowed = true
  h.state.rpc = { data: SYNCED, error: null }
  for (const list of [h.rpcCalls, h.ownedQueries, h.audits, h.revalidated, h.changed]) list.length = 0
})

describe('setPlanPagesAction', () => {
  it('adds a page through set_plan_page_coverage, as the signed-in owner', async () => {
    expect(await setPlanPagesAction({ add: [B] })).toEqual({ ok: true })
    expect(h.rpcCalls).toEqual([
      { fn: 'set_plan_page_coverage', args: { p_owner: 'owner-1', p_add: [B], p_remove: [] } },
    ])
    expect(h.ownedQueries[0]).toMatchObject({ id: [B], owner_user_id: 'owner-1', deleted_at: null })
  })

  it('moves the plan in one call (remove and add together)', async () => {
    await setPlanPagesAction({ add: [B], remove: [A] })
    expect(h.rpcCalls[0]?.args).toEqual({ p_owner: 'owner-1', p_add: [B], p_remove: [A] })
  })

  it('audits each page and revalidates the pages whose tier changed', async () => {
    await setPlanPagesAction({ add: [B], remove: [C] })
    expect(h.audits.map((a) => [a.action, a.targetId])).toEqual([
      ['plan_page_covered', B],
      ['plan_page_uncovered', C],
    ])
    expect(h.audits[0]?.afterState).toMatchObject({ owner_tier: 'premium', cap: 3, pages: [A, B] })
    expect(h.changed).toEqual(SYNCED.changes)
    expect(h.revalidated).toEqual(expect.arrayContaining(['/dashboard', '/dashboard/upgrade']))
  })

  it('removing needs no ownership read (the database scopes removals to the owner)', async () => {
    await setPlanPagesAction({ remove: [A] })
    expect(h.ownedQueries).toHaveLength(0)
    expect(h.rpcCalls[0]?.args).toMatchObject({ p_owner: 'owner-1', p_remove: [A] })
  })

  it('refuses another owner’s page before calling the database', async () => {
    h.state.owned = [A]
    expect(await setPlanPagesAction({ add: [B] })).toEqual({
      ok: false,
      error: 'Page not found, or you can’t edit it.',
    })
    expect(h.rpcCalls).toHaveLength(0)
  })

  it('refuses a signed-out caller, a bad request, and a flood', async () => {
    h.state.user = null
    expect(await setPlanPagesAction({ add: [A] })).toMatchObject({ ok: false })
    h.state.user = { id: 'owner-1' }

    expect(await setPlanPagesAction({})).toMatchObject({ ok: false })
    expect(await setPlanPagesAction({ add: ['not-a-uuid'] })).toMatchObject({ ok: false })
    expect(
      await setPlanPagesAction({ add: [A], extra: 1 } as unknown as { add: string[] })
    ).toMatchObject({ ok: false })

    h.state.allowed = false
    expect(await setPlanPagesAction({ add: [A] })).toEqual({
      ok: false,
      error: 'Too many changes. Please wait a minute and try again.',
    })
    expect(h.rpcCalls).toHaveLength(0)
  })

  it('says the plan is full, in plain words', async () => {
    h.state.rpc = {
      data: null,
      error: { code: '23514', message: 'Your plan already covers as many pages as it can.' },
    }
    expect(await setPlanPagesAction({ add: [C] })).toEqual({
      ok: false,
      error: 'Your plan already covers as many pages as it can. Remove one first.',
    })
    expect(h.audits).toHaveLength(0)
  })

  it('maps the other refusals: an uncoverable page, no paid plan, anything else', async () => {
    h.state.rpc = { data: null, error: { code: '23514', message: 'That page can’t be put on this plan.' } }
    expect(await setPlanPagesAction({ add: [C] })).toEqual({
      ok: false,
      error: 'That page can’t be put on your plan.',
    })

    h.state.rpc = { data: null, error: { code: 'P0001', message: 'NO_PLAN' } }
    expect(await setPlanPagesAction({ add: [C] })).toEqual({
      ok: false,
      error: 'Choosing pages comes with a paid plan.',
    })

    h.state.rpc = { data: null, error: { code: '40001', message: 'serialization' } }
    expect(await setPlanPagesAction({ add: [C] })).toEqual({
      ok: false,
      error: 'We couldn’t save that. Please try again.',
    })
  })

  it('a skipped sync still saves, with nothing to revalidate', async () => {
    h.state.rpc = { data: { skipped: 'no_billing' }, error: null }
    expect(await setPlanPagesAction({ add: [B] })).toEqual({ ok: true })
    expect(h.changed).toHaveLength(0)
    expect(h.audits[0]?.afterState).toEqual({ tier_write: 'skipped_no_billing' })
  })
})

function section(cap: number, pages: PlanPageRow[], tier: 'starter' | 'growth' | 'premium' = 'premium') {
  return renderToStaticMarkup(createElement(PlanPages, { tier, cap, pages }))
}

describe('PlanPages', () => {
  const rows = (...covered: boolean[]): PlanPageRow[] =>
    covered.map((c, i) => ({ id: [A, B, C][i]!, name: `Page ${i + 1}`, covered: c }))

  it('names the section and counts the pages in Title Case', () => {
    const html = section(3, rows(true, true, false))
    expect(html).toContain('id="plan-pages"')
    expect(html).toContain('Pages on Your Plan')
    expect(html).toContain('2 of 3 Pages Covered')
    expect(html).toContain('On Your Plan')
  })

  it('offers Add to Plan while there is room, and Remove when more than one is covered', () => {
    const html = section(3, rows(true, true, false))
    expect(html).toContain('Add to Plan')
    expect((html.match(/>Remove</g) ?? []).length).toBe(2)
  })

  it('never offers Remove on the only covered page', () => {
    const html = section(2, rows(true, false))
    expect(html).not.toMatch(/>Remove</)
    expect(html).toContain('Add to Plan')
  })

  it('on a one-page plan, offers Move Plan Here', () => {
    const html = section(1, rows(true, false, false), 'starter')
    expect(html).toContain('1 of 1 Page Covered')
    expect((html.match(/Move Plan Here/g) ?? []).length).toBe(2)
    expect(html).not.toContain('Add to Plan')
  })

  it('when a bigger plan is full, asks for a removal first', () => {
    const html = section(2, rows(true, true, false), 'growth')
    expect(html).not.toContain('Add to Plan')
    expect(html).not.toContain('Move Plan Here')
    expect(html).toContain('To add another page, remove one first.')
  })

  it('never says pages off the plan are free (founder 2026-11-21)', () => {
    const html = section(1, rows(true, false), 'starter').toLowerCase()
    expect(html).not.toMatch(/\bfree\b/)
  })
})
