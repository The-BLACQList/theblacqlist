import { describe, it, expect, vi, beforeEach } from 'vitest'

import { hashTesterToken } from '@/lib/tester/links'

// mintTesterLinkAction and revokeTesterLinkAction against doubles: who gets
// refused, what is stored, and that the raw token lives only in the returned
// link (one-tap-link-plan-2026-10-01.md).

const h = vi.hoisted(() => {
  const state = {
    admin: { user: { id: 'admin-1' } } as { user: { id: string } } | null,
    adminRoles: new Set<string>(),
    existingUserId: null as string | null,
    listing: null as null | Record<string, unknown>,
    listingFilter: null as null | [string, string],
    inserted: null as null | Record<string, unknown>,
    insertError: null as null | { code: string },
    revokeRows: [{ id: 'x' }] as { id: string }[],
    headers: new Headers({ host: 'theblacqlist.com' }),
    audits: [] as Record<string, unknown>[],
  }

  function from(table: string) {
    const b = {
      select: () => b,
      eq: (col: string, val: string) => {
        if (table === 'listings') state.listingFilter = [col, val]
        return b
      },
      is: () => b,
      maybeSingle: async () => ({ data: state.listing, error: null }),
      insert: (row: Record<string, unknown>) => {
        state.inserted = row
        return { select: () => ({ single: async () => ({ data: state.insertError ? null : { id: 'inv-new' }, error: state.insertError }) }) }
      },
      update: () => ({
        eq: () => ({ is: () => ({ select: async () => ({ data: state.revokeRows, error: null }) }) }),
      }),
    }
    return b
  }

  return {
    state,
    service: {
      rpc: vi.fn(async () => ({ data: state.existingUserId, error: null })),
      from,
    },
  }
})

vi.mock('next/headers', () => ({ headers: async () => h.state.headers }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => h.service }))
vi.mock('@/lib/admin/guard', () => ({
  getAdminSession: async () => h.state.admin,
  getAdminRole: async (id: string) => (h.state.adminRoles.has(id) ? 'admin' : null),
  writeAuditLog: async (entry: Record<string, unknown>) => {
    h.state.audits.push(entry)
  },
}))

import { mintTesterLinkAction, revokeTesterLinkAction } from '@/lib/actions/admin/testerLinks'

const OWNER_UUID = '11111111-2222-3333-4444-555555555555'

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  Object.assign(h.state, {
    admin: { user: { id: 'admin-1' } },
    adminRoles: new Set<string>(),
    existingUserId: null,
    listing: { id: OWNER_UUID, name: 'Test Listing', status: 'published', owner_user_id: 'u-owner', deleted_at: null },
    listingFilter: null,
    inserted: null,
    insertError: null,
    revokeRows: [{ id: 'x' }],
    headers: new Headers({ host: 'theblacqlist.com' }),
    audits: [],
  })
})

describe('mintTesterLinkAction', () => {
  it('refuses without an admin session', async () => {
    h.state.admin = null
    expect(await mintTesterLinkAction(null, form({ kind: 'supporter', label: 'T-07', email: 'a@b.co' }))).toEqual({
      error: 'You must be signed in as an admin.',
    })
    expect(h.state.inserted).toBeNull()
  })

  it.each([
    [{ kind: 'nope', label: 'T-07' }, /supporter or owner/],
    [{ kind: 'supporter', label: '  ' }, /label/],
    [{ kind: 'supporter', label: 'T-07', email: 'not-an-email' }, /valid email/],
    [{ kind: 'owner', label: 'T-07', listing: '' }, /listing ID or slug/],
  ])('refuses bad input %j', async (fields, message) => {
    const result = await mintTesterLinkAction(null, form(fields))
    expect(result && 'error' in result ? result.error : '').toMatch(message)
    expect(h.state.inserted).toBeNull()
  })

  it('mints a supporter link, storing only the hash', async () => {
    const result = await mintTesterLinkAction(null, form({ kind: 'supporter', label: ' T-07 ', email: ' Tester@Example.com ' }))
    if (!result || !('success' in result)) throw new Error(`expected success, got ${JSON.stringify(result)}`)

    expect(result.label).toBe('T-07')
    expect(result.existingAccount).toBe(false)
    const match = result.link.match(/^https:\/\/theblacqlist\.com\/t#([A-Za-z0-9_-]{43})$/)
    expect(match).not.toBeNull()
    const token = match![1]!

    expect(h.state.inserted).toMatchObject({
      token_hash: hashTesterToken(token),
      kind: 'supporter',
      email: 'tester@example.com',
      listing_id: null,
      label: 'T-07',
      max_uses: 5,
      created_by: 'admin-1',
    })
    const ttlDays = (new Date(h.state.inserted!.expires_at as string).getTime() - Date.now()) / 86_400_000
    expect(ttlDays).toBeGreaterThan(13.99)
    expect(ttlDays).toBeLessThanOrEqual(14)

    const stored = JSON.stringify([h.state.inserted, h.state.audits])
    expect(stored).not.toContain(token)
    expect(h.state.audits).toEqual([
      expect.objectContaining({ action: 'mint_tester_link', targetId: 'inv-new' }),
    ])
  })

  it('flags an existing account and refuses an admin one', async () => {
    h.state.existingUserId = 'u-existing'
    const ok = await mintTesterLinkAction(null, form({ kind: 'supporter', label: 'T-07', email: 'a@b.co' }))
    expect(ok).toMatchObject({ success: true, existingAccount: true })

    h.state.inserted = null
    h.state.adminRoles.add('u-existing')
    const refused = await mintTesterLinkAction(null, form({ kind: 'supporter', label: 'T-07', email: 'a@b.co' }))
    expect(refused).toEqual({ error: expect.stringMatching(/admins can never get one/) })
    expect(h.state.inserted).toBeNull()
  })

  it('mints an owner link by id or slug', async () => {
    expect(await mintTesterLinkAction(null, form({ kind: 'owner', label: 'T-08', listing: OWNER_UUID }))).toMatchObject({ success: true })
    expect(h.state.listingFilter).toEqual(['id', OWNER_UUID])
    expect(h.state.inserted).toMatchObject({ kind: 'owner', email: null, listing_id: OWNER_UUID })

    await mintTesterLinkAction(null, form({ kind: 'owner', label: 'T-08', listing: 'some-slug' }))
    expect(h.state.listingFilter).toEqual(['slug', 'some-slug'])
  })

  it.each([
    ['missing', null, /No listing found/],
    ['deleted', { deleted_at: '2026-10-01T00:00:00Z' }, /No listing found/],
    ['ownerless', { owner_user_id: null }, /no owner account/],
    ['unpublished', { status: 'draft' }, /not published/],
  ])('refuses a %s listing', async (_name, change, message) => {
    h.state.listing = change === null ? null : { ...h.state.listing!, ...change }
    const result = await mintTesterLinkAction(null, form({ kind: 'owner', label: 'T-08', listing: 'slug' }))
    expect(result && 'error' in result ? result.error : '').toMatch(message)
    expect(h.state.inserted).toBeNull()
  })

  it('refuses a listing owned by an admin', async () => {
    h.state.adminRoles.add('u-owner')
    const result = await mintTesterLinkAction(null, form({ kind: 'owner', label: 'T-08', listing: 'slug' }))
    expect(result).toEqual({ error: expect.stringMatching(/admins can never get one/) })
  })

  it('builds the link on the Preview it was minted from', async () => {
    h.state.headers = new Headers({ 'x-forwarded-host': 'blacqlist-git-x.vercel.app', 'x-forwarded-proto': 'https' })
    const result = await mintTesterLinkAction(null, form({ kind: 'supporter', label: 'T-07', email: 'a@b.co' }))
    expect(result && 'link' in result ? result.link : '').toMatch(/^https:\/\/blacqlist-git-x\.vercel\.app\/t#/)
  })

  it('reports an insert failure without a link', async () => {
    h.state.insertError = { code: '23505' }
    expect(await mintTesterLinkAction(null, form({ kind: 'supporter', label: 'T-07', email: 'a@b.co' }))).toEqual({
      error: 'Failed to make the link. Please try again.',
    })
    expect(h.state.audits).toEqual([])
  })
})

describe('revokeTesterLinkAction', () => {
  it('revokes a live link and audits it', async () => {
    expect(await revokeTesterLinkAction(null, form({ invite_id: OWNER_UUID }))).toEqual({ success: true })
    expect(h.state.audits).toEqual([expect.objectContaining({ action: 'revoke_tester_link', targetId: OWNER_UUID })])
  })

  it('rejects a non-uuid id', async () => {
    expect(await revokeTesterLinkAction(null, form({ invite_id: 'nope' }))).toEqual({ error: 'Invalid link.' })
  })

  it('reports an already revoked link', async () => {
    h.state.revokeRows = []
    expect(await revokeTesterLinkAction(null, form({ invite_id: OWNER_UUID }))).toEqual({
      error: 'This link was not found or is already revoked.',
    })
  })
})
