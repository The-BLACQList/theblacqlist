// =============================================================================
// deleteAccountAction — verification documents must not survive the account
// =============================================================================
// The FK design does most of the deletion work, and that is exactly why the
// verification documents leaked: `listings.owner_user_id` and
// `claims.claimant_user_id` are both ON DELETE SET NULL, so the rows holding
// `verification_docs` / `verification_doc_paths` SURVIVE the user — and with
// them the Storage objects: registration filings, EIN letters, leases, all
// naming the person who just asked to be deleted. Neither the cascade nor the
// receipt sweep ever reached them. data-privacy.md #5 makes deletion a real
// obligation, so the action now collects those paths while the rows can still
// be attributed to the user, and — only after the auth delete succeeds —
// removes the objects and clears the pointer columns on the surviving rows.
//
// The ordering is the part worth pinning hardest:
//
//   * collection must happen BEFORE `auth.admin.deleteUser` — SET NULL severs
//     the link, so afterwards there is no way to find which rows were theirs;
//   * removal must happen AFTER a SUCCESSFUL delete — a failed deletion must
//     destroy nothing, because the user still has an account and their
//     verification may still be live.
//
// Also pinned: documents are removed from BOTH buckets. New uploads live in
// 'verification-docs'; documents submitted before the upload consolidation
// live in 'receipt-uploads' (the bucket note in
// app/admin/verification/[id]/page.tsx). Paths are uuid-named per upload, so
// removing every collected path from both buckets is safe and catches legacy
// objects; remove() of a path a bucket doesn't hold is a no-op.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state: {
    user: { id: string } | null
    receipts: { file_path: string | null }[]
    profile: { avatar_url: string | null } | null
    ownedListings: { id: string; verification_docs: string[] | null }[]
    userClaims: { id: string; verification_doc_paths: string[] | null }[]
    deleteUserError: { message: string } | null
  } = {
    user: null,
    receipts: [],
    profile: null,
    ownedListings: [],
    userClaims: [],
    deleteUserError: null,
  }

  // A single ordered log is what makes "collected before, removed after"
  // assertable directly instead of inferred.
  const calls: {
    order: string[]
    removed: Record<string, string[]>
    updates: { table: string; values: Record<string, unknown>; ids: unknown }[]
    deletes: { table: string; filters: [string, unknown][] }[]
  } = { order: [], removed: {}, updates: [], deletes: [] }

  const createClient = vi.fn(async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
      signOut: async () => {
        calls.order.push('signOut')
      },
    },
  }))

  const createServiceClient = vi.fn(() => ({
    auth: {
      admin: {
        deleteUser: async (_id: string) => {
          calls.order.push('deleteUser')
          return { error: state.deleteUserError }
        },
      },
    },
    storage: {
      from(bucket: string) {
        return {
          async remove(paths: string[]) {
            calls.order.push(`remove:${bucket}`)
            calls.removed[bucket] = [...(calls.removed[bucket] ?? []), ...paths]
            return { data: null, error: null }
          },
        }
      },
    },
    from(table: string) {
      let verb: 'select' | 'delete' | 'update' = 'select'
      let updatedValues: Record<string, unknown> = {}
      const filters: [string, unknown][] = []
      const builder = {
        select() {
          verb = 'select'
          return builder
        },
        delete() {
          verb = 'delete'
          return builder
        },
        update(values: Record<string, unknown>) {
          verb = 'update'
          updatedValues = values
          return builder
        },
        eq(column: string, value: unknown) {
          filters.push([column, value])
          return builder
        },
        not(column: string, op: string, value: unknown) {
          filters.push([`not:${column}:${op}`, value])
          return builder
        },
        in(_column: string, ids: unknown) {
          calls.updates.push({ table, values: updatedValues, ids })
          return builder
        },
        async maybeSingle() {
          calls.order.push(`select:${table}`)
          return { data: state.profile, error: null }
        },
        then(resolve: (v: { data: unknown; error: unknown }) => unknown) {
          calls.order.push(`${verb}:${table}`)
          if (verb === 'delete') {
            calls.deletes.push({ table, filters })
            return Promise.resolve({ data: null, error: null }).then(resolve)
          }
          if (verb === 'update') {
            return Promise.resolve({ data: null, error: null }).then(resolve)
          }
          const data =
            table === 'receipt_uploads'
              ? state.receipts
              : table === 'listings'
                ? state.ownedListings
                : table === 'claims'
                  ? state.userClaims
                  : []
          return Promise.resolve({ data, error: null }).then(resolve)
        },
      }
      return builder
    },
  }))

  class RedirectError extends Error {
    constructor(public readonly url: string) {
      super(`NEXT_REDIRECT:${url}`)
    }
  }

  return { state, calls, createClient, createServiceClient, RedirectError }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: h.createClient,
  createServiceClient: h.createServiceClient,
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new h.RedirectError(url)
  },
}))

import { deleteAccountAction } from '@/lib/actions/account/deleteAccount'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const LISTING_ID = '22222222-2222-4222-8222-222222222222'
const CLAIM_ID = '33333333-3333-4333-8333-333333333333'

const LISTING_DOC = `listings/${LISTING_ID}/verification/aaaa.pdf`
const LISTING_DOC_2 = `listings/${LISTING_ID}/verification/bbbb.jpg`
const CLAIM_DOC = `claims/${CLAIM_ID}/cccc.pdf`

function confirmForm(value = 'DELETE'): FormData {
  const fd = new FormData()
  fd.set('confirm', value)
  return fd
}

async function run(fd = confirmForm()) {
  try {
    return await deleteAccountAction(null, fd)
  } catch (e) {
    if (e instanceof h.RedirectError) return { redirect: e.url }
    throw e
  }
}

beforeEach(() => {
  h.state.user = { id: USER_ID }
  h.state.receipts = []
  h.state.profile = null
  h.state.ownedListings = []
  h.state.userClaims = []
  h.state.deleteUserError = null
  h.calls.order.length = 0
  h.calls.removed = {}
  h.calls.updates.length = 0
  h.calls.deletes.length = 0
})

describe('deleteAccountAction — verification document sweep', () => {
  it('removes every collected doc from both buckets and clears both pointer columns', async () => {
    h.state.ownedListings = [{ id: LISTING_ID, verification_docs: [LISTING_DOC, LISTING_DOC_2] }]
    h.state.userClaims = [{ id: CLAIM_ID, verification_doc_paths: [CLAIM_DOC] }]

    const result = await run()
    expect(result).toEqual({ redirect: '/sign-in?deleted=1' })

    const all = [LISTING_DOC, LISTING_DOC_2, CLAIM_DOC]
    expect(h.calls.removed['verification-docs']).toEqual(all)
    // Legacy documents pre-date the upload consolidation and live in
    // 'receipt-uploads' — the sweep must reach them too.
    expect(h.calls.removed['receipt-uploads']).toEqual(all)

    expect(h.calls.updates).toEqual([
      { table: 'listings', values: { verification_docs: null }, ids: [LISTING_ID] },
      { table: 'claims', values: { verification_doc_paths: null }, ids: [CLAIM_ID] },
    ])
  })

  it('collects before deleteUser and removes only after it — SET NULL severs the link', async () => {
    h.state.ownedListings = [{ id: LISTING_ID, verification_docs: [LISTING_DOC] }]
    h.state.userClaims = [{ id: CLAIM_ID, verification_doc_paths: [CLAIM_DOC] }]

    await run()

    const at = (label: string) => h.calls.order.indexOf(label)
    expect(at('select:listings')).toBeGreaterThanOrEqual(0)
    expect(at('select:claims')).toBeGreaterThanOrEqual(0)
    expect(at('select:listings')).toBeLessThan(at('deleteUser'))
    expect(at('select:claims')).toBeLessThan(at('deleteUser'))
    expect(at('remove:verification-docs')).toBeGreaterThan(at('deleteUser'))
    expect(at('update:listings')).toBeGreaterThan(at('deleteUser'))
    expect(at('update:claims')).toBeGreaterThan(at('deleteUser'))
  })

  it('a failed auth delete destroys nothing — no removal, no pointer clears', async () => {
    h.state.ownedListings = [{ id: LISTING_ID, verification_docs: [LISTING_DOC] }]
    h.state.userClaims = [{ id: CLAIM_ID, verification_doc_paths: [CLAIM_DOC] }]
    h.state.deleteUserError = { message: 'blocked by trigger' }

    const result = await run()
    expect(result).toMatchObject({ error: expect.stringContaining('could not delete') })

    expect(h.calls.removed).toEqual({})
    expect(h.calls.updates).toEqual([])
  })

  it('a user with no verification docs issues no bucket removals and no updates', async () => {
    const result = await run()
    expect(result).toEqual({ redirect: '/sign-in?deleted=1' })

    expect(h.calls.removed).toEqual({})
    expect(h.calls.updates).toEqual([])
  })

  it('rows whose path array is empty are skipped entirely', async () => {
    h.state.ownedListings = [{ id: LISTING_ID, verification_docs: [] }]
    h.state.userClaims = [{ id: CLAIM_ID, verification_doc_paths: [] }]

    await run()

    expect(h.calls.removed).toEqual({})
    expect(h.calls.updates).toEqual([])
  })

  it('still requires the typed DELETE confirmation before anything runs', async () => {
    h.state.ownedListings = [{ id: LISTING_ID, verification_docs: [LISTING_DOC] }]

    const result = await run(confirmForm('delete please'))
    expect(result).toEqual({ error: 'Type DELETE to confirm.' })
    expect(h.calls.order).toEqual([])
  })

  it('the pre-existing sweeps are untouched: reviews and saves still deleted, receipts and avatar still removed', async () => {
    h.state.receipts = [{ file_path: `${USER_ID}/receipt-1.jpg` }]
    h.state.profile = { avatar_url: `${USER_ID}/avatar.png` }

    await run()

    expect(h.calls.deletes.map((d) => d.table)).toEqual(['reviews', 'saves'])
    expect(h.calls.removed['receipt-uploads']).toEqual([`${USER_ID}/receipt-1.jpg`])
    expect(h.calls.removed['avatars']).toEqual([`${USER_ID}/avatar.png`])
  })
})
