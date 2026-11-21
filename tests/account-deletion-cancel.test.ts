import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 243: deleting an account cancels the paid plan (Terms 13.9) and drops
// the pages to free BEFORE the auth user (and the rows linking it to Stripe)
// is deleted.

const h = vi.hoisted(() => {
  const state = {
    rows: [] as Array<{ stripe_subscription_id: string | null; stripe_customer_id: string | null; status: string }>,
    rowsError: null as { message: string } | null,
    ownedPages: 0,
    updateError: null as { message: string } | null,
    updates: [] as Array<{ values: Record<string, unknown>; filters: Array<[string, string, unknown]> }>,
  }

  const service = {
    from(table: string) {
      const filters: Array<[string, string, unknown]> = []
      let mode: 'select' | 'count' | 'update' = 'select'
      let values: Record<string, unknown> = {}
      const builder = {
        select(_cols: string, opts?: { head?: boolean }) {
          if (opts?.head) mode = 'count'
          return builder
        },
        update(v: Record<string, unknown>) {
          mode = 'update'
          values = v
          return builder
        },
        eq(col: string, val: unknown) {
          filters.push(['eq', col, val])
          return builder
        },
        in(col: string, val: unknown) {
          filters.push(['in', col, val])
          return builder
        },
        then(resolve: (v: unknown) => unknown) {
          if (mode === 'update') {
            state.updates.push({ values, filters })
            return resolve({ error: state.updateError })
          }
          if (mode === 'count') return resolve({ count: state.ownedPages, error: null })
          if (table === 'subscriptions') return resolve({ data: state.rowsError ? null : state.rows, error: state.rowsError })
          return resolve({ data: [], error: null })
        },
      }
      return builder
    },
  }

  return {
    state,
    service,
    customersList: vi.fn(),
    subsList: vi.fn(),
    subsRetrieve: vi.fn(),
    subsCancel: vi.fn(),
    syncOwnerPlan: vi.fn(),
    revalidateChanged: vi.fn(),
    writeSystemAuditLog: vi.fn(),
  }
})

vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    customers: { list: h.customersList },
    subscriptions: { list: h.subsList, retrieve: h.subsRetrieve, cancel: h.subsCancel },
  },
}))
vi.mock('@/lib/services/billing/planPages', () => ({
  syncOwnerPlan: h.syncOwnerPlan,
  revalidateChanged: h.revalidateChanged,
}))
vi.mock('@/lib/audit/system', () => ({ writeSystemAuditLog: h.writeSystemAuditLog }))

import { cancelPlansForDeletedAccount } from '@/lib/services/billing/accountDeletion'

const USER = { id: 'user-1', email: 'owner@example.com' }
const svc = h.service as unknown as Parameters<typeof cancelPlansForDeletedAccount>[0]

function sub(id: string, status: string, userId: string | null = USER.id) {
  return { id, status, metadata: userId ? { user_id: userId } : {} }
}

/** Stripe subscriptions per customer id. */
function stripeHas(byCustomer: Record<string, ReturnType<typeof sub>[]>) {
  h.subsList.mockImplementation(async ({ customer }: { customer: string }) => ({
    data: byCustomer[customer] ?? [],
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  h.state.rows = []
  h.state.rowsError = null
  h.state.ownedPages = 0
  h.state.updateError = null
  h.state.updates = []
  h.customersList.mockResolvedValue({ data: [] })
  h.subsList.mockResolvedValue({ data: [] })
  h.subsCancel.mockResolvedValue({ status: 'canceled' })
  h.subsRetrieve.mockResolvedValue(null)
  h.syncOwnerPlan.mockResolvedValue({ tier: 'free', cap: 1, covered: [], changes: [] })
  h.revalidateChanged.mockResolvedValue(undefined)
})

describe('cancelPlansForDeletedAccount', () => {
  it('does nothing, and never calls Stripe, for someone with no plan rows and no pages', async () => {
    const res = await cancelPlansForDeletedAccount(svc, USER)
    expect(res).toEqual({ canceled: [], pagesChanged: 0 })
    expect(h.customersList).not.toHaveBeenCalled()
    expect(h.subsCancel).not.toHaveBeenCalled()
    expect(h.syncOwnerPlan).not.toHaveBeenCalled()
  })

  it('cancels a live plan now, with no proration or final invoice, then frees the pages and audits', async () => {
    h.state.ownedPages = 2
    h.state.rows = [{ stripe_subscription_id: 'sub_1', stripe_customer_id: 'cus_1', status: 'active' }]
    stripeHas({ cus_1: [sub('sub_1', 'active')] })
    h.syncOwnerPlan.mockResolvedValue({
      tier: 'free',
      cap: 1,
      covered: [],
      changes: [
        { id: 'page-a', from: 'growth', to: 'free' },
        { id: 'page-b', from: 'growth', to: 'free' },
      ],
    })

    const res = await cancelPlansForDeletedAccount(svc, USER)

    expect(res).toEqual({ canceled: ['sub_1'], pagesChanged: 2 })
    expect(h.subsCancel).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({ prorate: false, invoice_now: false }),
      { idempotencyKey: 'account-delete:sub_1' }
    )
    expect(h.state.updates).toHaveLength(1)
    expect(h.state.updates[0]!.values.status).toBe('canceled')
    expect(h.state.updates[0]!.filters).toContainEqual(['eq', 'user_id', USER.id])
    expect(h.state.updates[0]!.filters).toContainEqual(['in', 'status', ['active', 'trialing', 'past_due']])
    expect(h.syncOwnerPlan).toHaveBeenCalledWith(svc, USER.id, { fill: false })
    expect(h.writeSystemAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER.id,
        action: 'subscription_canceled_account_deleted',
        afterState: { canceled_subscriptions: ['sub_1'], pages_to_free: ['page-a', 'page-b'] },
      })
    )
    expect(h.revalidateChanged).toHaveBeenCalled()
  })

  it('cancels past_due, trialing and unpaid plans; leaves ended ones alone', async () => {
    h.state.ownedPages = 1
    h.state.rows = [{ stripe_subscription_id: 'sub_old', stripe_customer_id: 'cus_1', status: 'canceled' }]
    stripeHas({
      cus_1: [
        sub('sub_old', 'canceled'),
        sub('sub_due', 'past_due'),
        sub('sub_trial', 'trialing'),
        sub('sub_unpaid', 'unpaid'),
        sub('sub_expired', 'incomplete_expired'),
      ],
    })

    const res = await cancelPlansForDeletedAccount(svc, USER)

    expect(res.canceled.sort()).toEqual(['sub_due', 'sub_trial', 'sub_unpaid'])
  })

  it('finds a plan by the account email that the webhook has not recorded yet', async () => {
    h.state.ownedPages = 1
    h.customersList.mockResolvedValue({ data: [{ id: 'cus_email' }] })
    stripeHas({ cus_email: [sub('sub_new', 'active')] })

    const res = await cancelPlansForDeletedAccount(svc, USER)

    expect(h.customersList).toHaveBeenCalledWith({ email: USER.email, limit: 100 })
    expect(res.canceled).toEqual(['sub_new'])
  })

  it("skips a subscription on a customer found by email that isn't this user's", async () => {
    h.state.ownedPages = 1
    h.customersList.mockResolvedValue({ data: [{ id: 'cus_email' }] })
    stripeHas({ cus_email: [sub('sub_other', 'active', 'someone-else'), sub('sub_nometa', 'active', null)] })

    const res = await cancelPlansForDeletedAccount(svc, USER)

    expect(res.canceled).toEqual([])
    expect(h.subsCancel).not.toHaveBeenCalled()
  })

  it('looks up a recorded subscription whose customer id was never stored', async () => {
    h.state.rows = [{ stripe_subscription_id: 'sub_lone', stripe_customer_id: null, status: 'active' }]
    h.subsRetrieve.mockResolvedValue(sub('sub_lone', 'active'))

    const res = await cancelPlansForDeletedAccount(svc, { id: USER.id, email: null })

    expect(h.subsRetrieve).toHaveBeenCalledWith('sub_lone')
    expect(res.canceled).toEqual(['sub_lone'])
  })

  it('treats a subscription Stripe no longer has, or one already over, as done', async () => {
    h.state.ownedPages = 1
    h.state.rows = [
      { stripe_subscription_id: 'sub_gone', stripe_customer_id: 'cus_1', status: 'active' },
      { stripe_subscription_id: 'sub_raced', stripe_customer_id: 'cus_1', status: 'active' },
    ]
    stripeHas({ cus_1: [sub('sub_gone', 'active'), sub('sub_raced', 'active')] })
    h.subsCancel.mockImplementation(async (id: string) => {
      if (id === 'sub_gone') throw Object.assign(new Error('No such subscription'), { code: 'resource_missing' })
      throw Object.assign(new Error('already canceled'), { code: 'subscription_canceled' })
    })
    h.subsRetrieve.mockResolvedValue(sub('sub_raced', 'canceled'))

    const res = await cancelPlansForDeletedAccount(svc, USER)

    expect(res.canceled).toEqual([])
    expect(h.syncOwnerPlan).toHaveBeenCalled()
  })

  it('throws when Stripe fails, before any row is changed', async () => {
    h.state.ownedPages = 1
    h.state.rows = [{ stripe_subscription_id: 'sub_1', stripe_customer_id: 'cus_1', status: 'active' }]
    stripeHas({ cus_1: [sub('sub_1', 'active')] })
    h.subsCancel.mockRejectedValue(Object.assign(new Error('api down'), { code: 'api_error' }))
    h.subsRetrieve.mockResolvedValue(sub('sub_1', 'active'))

    await expect(cancelPlansForDeletedAccount(svc, USER)).rejects.toThrow('api down')
    expect(h.state.updates).toHaveLength(0)
    expect(h.syncOwnerPlan).not.toHaveBeenCalled()
  })

  it('throws when the rows cannot be read', async () => {
    h.state.rowsError = { message: 'db down' }
    await expect(cancelPlansForDeletedAccount(svc, USER)).rejects.toThrow('db down')
    expect(h.subsCancel).not.toHaveBeenCalled()
  })

  it('throws when the tier sync fails, so the account is kept', async () => {
    h.state.ownedPages = 1
    h.syncOwnerPlan.mockRejectedValue(new Error('owner plan sync failed'))
    await expect(cancelPlansForDeletedAccount(svc, USER)).rejects.toThrow('owner plan sync failed')
  })

  it("doesn't audit when there was nothing to cancel and no page changed", async () => {
    h.state.ownedPages = 1
    h.syncOwnerPlan.mockResolvedValue({ skipped: 'no_billing' })
    await cancelPlansForDeletedAccount(svc, USER)
    expect(h.writeSystemAuditLog).not.toHaveBeenCalled()
  })
})
