import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 243: the plan is cancelled before anything is deleted, and a failed
// cancel keeps the account.

const h = vi.hoisted(() => {
  const calls: string[] = []
  const cancelPlans = vi.fn(async () => {
    calls.push('cancelPlans')
    return { canceled: [], pagesChanged: 0 }
  })
  const deleteUser = vi.fn(async () => {
    calls.push('deleteUser')
    return { error: null }
  })
  const user = { id: 'user-1', email: 'owner@example.com' }

  const service = {
    from(table: string) {
      const builder = {
        select: () => builder,
        delete: () => {
          calls.push(`delete:${table}`)
          return builder
        },
        eq: () => builder,
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null }),
      }
      return builder
    },
    auth: { admin: { deleteUser } },
    storage: { from: () => ({ remove: vi.fn(async () => ({})) }) },
  }

  return {
    calls,
    cancelPlans,
    deleteUser,
    user,
    service,
    createClient: vi.fn(async () => ({
      auth: {
        getUser: async () => ({ data: { user } }),
        signOut: vi.fn(async () => ({})),
      },
    })),
    redirect: vi.fn((to: string) => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { to })
    }),
  }
})

vi.mock('next/navigation', () => ({ redirect: h.redirect }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: h.createClient,
  createServiceClient: () => h.service,
}))
vi.mock('@/lib/services/billing/accountDeletion', () => ({
  cancelPlansForDeletedAccount: h.cancelPlans,
}))

import { deleteAccountAction } from '@/lib/actions/account/deleteAccount'

function form(confirm: string) {
  const fd = new FormData()
  fd.set('confirm', confirm)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  h.calls.length = 0
})

describe('deleteAccountAction and the paid plan', () => {
  it('cancels the plan first, then deletes', async () => {
    await expect(deleteAccountAction(null, form('DELETE'))).rejects.toThrow('NEXT_REDIRECT')

    expect(h.cancelPlans).toHaveBeenCalledWith(h.service, { id: 'user-1', email: 'owner@example.com' })
    expect(h.calls[0]).toBe('cancelPlans')
    expect(h.calls.indexOf('cancelPlans')).toBeLessThan(h.calls.indexOf('delete:reviews'))
    expect(h.calls.at(-1)).toBe('deleteUser')
    expect(h.redirect).toHaveBeenCalledWith('/sign-in?deleted=1')
  })

  it('keeps the account when the plan cannot be cancelled', async () => {
    h.cancelPlans.mockRejectedValueOnce(new Error('stripe down'))

    const res = await deleteAccountAction(null, form('DELETE'))

    expect(res).toEqual({ error: expect.stringContaining("couldn't cancel your paid plan") })
    expect(h.deleteUser).not.toHaveBeenCalled()
    expect(h.calls).toEqual([])
  })

  it('does not touch the plan without the DELETE confirmation', async () => {
    const res = await deleteAccountAction(null, form('delete me'))
    expect(res).toEqual({ error: 'Type DELETE to confirm.' })
    expect(h.cancelPlans).not.toHaveBeenCalled()
  })
})
