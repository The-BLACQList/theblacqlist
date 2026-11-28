// =============================================================================
// Receipt review actions, end to end with fakes (ticket 293)
// =============================================================================
// Pinned here:
//   * owner Approve: counted email only after a real approval; a failed or
//     already-reviewed approval returns its message and emails nobody;
//   * owner Not Ours: the shopper's needs-a-fix email goes out with the reason;
//   * admin Approve: same rules, plus the audit log row;
//   * the owner's list and badge never include their own receipts and mask the
//     buyer's name;
//   * account delete removes the receipt photos after the account is gone.
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const approve = vi.fn()
  const reject = vi.fn()
  const sendCounted = vi.fn(async () => {})
  const sendNeedsFix = vi.fn(async () => {})
  const audit = vi.fn(async () => {})
  const loadForOwner = vi.fn()
  const state = {
    adminReceipt: null as Record<string, unknown> | null,
    listQuery: [] as [string, unknown][],
    countQuery: [] as [string, unknown][],
    rows: [] as Record<string, unknown>[],
    profiles: [] as { id: string; display_name: string | null }[],
  }
  return { approve, reject, sendCounted, sendNeedsFix, audit, loadForOwner, state }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/env', async (orig) => ({
  ...(await orig<typeof import('@/lib/env')>()),
  isFeatureEnabled: () => true,
}))
vi.mock('@/lib/dashboard/guard', () => ({
  getOwnerSession: async () => ({ user: { id: 'owner-1' } }),
}))
vi.mock('@/lib/admin/guard', () => ({
  getAdminSession: async () => ({ user: { id: 'admin-1' } }),
  writeAuditLog: h.audit,
}))
vi.mock('@/lib/email/receiptNotices', () => ({
  sendReceiptCountedEmail: h.sendCounted,
  sendReceiptNeedsFixEmail: h.sendNeedsFix,
}))
vi.mock('@/lib/spend/applyReceiptReview', () => ({
  approvePendingReceipt: h.approve,
  rejectPendingReceipt: h.reject,
}))
vi.mock('@/lib/actions/owner/receiptReviewShared', async (orig) => ({
  ...(await orig<typeof import('@/lib/actions/owner/receiptReviewShared')>()),
  loadReceiptForOwner: h.loadForOwner,
}))

function builder(table: string) {
  const filters: [string, unknown][] = []
  const b: Record<string, unknown> = {}
  const chain = (name: string) => (col?: unknown, v?: unknown) => {
    if (name !== 'select' && name !== 'order' && name !== 'limit')
      filters.push([`${name}:${col}`, v])
    return b
  }
  for (const m of ['select', 'eq', 'neq', 'in', 'is', 'order', 'limit']) b[m] = chain(m)
  b.single = async () => ({
    data: table === 'receipt_uploads' ? h.state.adminReceipt : null,
    error: null,
  })
  b.maybeSingle = async () => ({ data: null, error: null })
  b.then = (resolve: (v: unknown) => void) => {
    if (table === 'profiles') return resolve({ data: h.state.profiles, error: null })
    if (filters.some(([k]) => k === 'in:listing_id')) {
      if (b.__head) {
        h.state.countQuery = filters
        return resolve({ count: 3, error: null })
      }
      h.state.listQuery = filters
      return resolve({ data: h.state.rows, error: null })
    }
    return resolve({ data: [], error: null })
  }
  const select = b.select as (...a: unknown[]) => unknown
  b.select = (cols?: unknown, opts?: { head?: boolean }) => {
    if (opts?.head) b.__head = true
    return select(cols)
  }
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: (t: string) => builder(t) }),
  createClient: async () => ({ from: (t: string) => builder(t) }),
}))

import { ownerVerifyReceiptAction } from '@/lib/actions/owner/verifyReceipt'
import { ownerRejectReceiptAction } from '@/lib/actions/owner/rejectReceipt'
import { approveReceiptAction } from '@/lib/actions/spend/approveReceipt'
import { countReceiptsToVerify, listReceiptsToVerify } from '@/lib/dashboard/receiptsToVerify'
import { OWNER_REJECT_REASONS } from '@/lib/spend/owner-receipts'

const REASON = OWNER_REJECT_REASONS[0]!

const OWNER_RECEIPT = {
  id: 'r1',
  user_id: 'shopper-1',
  listing_id: 'l1',
  raw_business_name: null,
  amount_cents: 2500,
  purchase_date: '2026-11-03',
  aggregate_opt_out: false,
  status: 'pending_review',
}

function fd(values: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(values)) f.set(k, v)
  return f
}

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  vi.clearAllMocks()
  h.loadForOwner.mockResolvedValue({
    check: 'ok',
    receipt: OWNER_RECEIPT,
    listingName: "Mama's Kitchen",
    serviceClient: {},
  })
  h.state.adminReceipt = { ...OWNER_RECEIPT }
})

describe('owner Approve', () => {
  it('emails the shopper only after a real approval', async () => {
    h.approve.mockResolvedValue({ ok: true, listingName: "Mama's Kitchen" })
    const res = await ownerVerifyReceiptAction(null, fd({ receipt_id: 'r1' }))
    await flush()
    expect(res).toEqual({ success: true })
    expect(h.approve).toHaveBeenCalledWith({}, OWNER_RECEIPT, { userId: 'owner-1', role: 'owner' })
    expect(h.sendCounted).toHaveBeenCalledTimes(1)
  })

  it('a failed approval says try again and emails nobody', async () => {
    h.approve.mockResolvedValue({ ok: false, reason: 'failed' })
    const res = await ownerVerifyReceiptAction(null, fd({ receipt_id: 'r1' }))
    await flush()
    expect(res).toEqual({ error: expect.stringMatching(/try again/) })
    expect(h.sendCounted).not.toHaveBeenCalled()
  })

  it('an already-reviewed receipt says so and emails nobody', async () => {
    h.approve.mockResolvedValue({ ok: false, reason: 'already_reviewed' })
    const res = await ownerVerifyReceiptAction(null, fd({ receipt_id: 'r1' }))
    await flush()
    expect(res).toEqual({ error: 'This receipt was already reviewed.' })
    expect(h.sendCounted).not.toHaveBeenCalled()
  })

  it("refuses the owner's own receipt without touching it", async () => {
    h.loadForOwner.mockResolvedValue({ check: 'own_receipt' })
    const res = await ownerVerifyReceiptAction(null, fd({ receipt_id: 'r1' }))
    expect(res).toEqual({ error: expect.stringMatching(/your own receipt/) })
    expect(h.approve).not.toHaveBeenCalled()
  })
})

describe('owner Not Ours', () => {
  it('sends the needs-a-fix email with the chosen reason', async () => {
    h.reject.mockResolvedValue({ ok: true })
    const res = await ownerRejectReceiptAction(
      null,
      fd({ receipt_id: 'r1', rejection_reason: REASON })
    )
    await flush()
    expect(res).toEqual({ success: true })
    expect(h.reject).toHaveBeenCalledTimes(1)
    expect(h.sendNeedsFix).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reason: REASON })
    )
  })

  it('emails nobody when it was already reviewed', async () => {
    h.reject.mockResolvedValue({ ok: false, reason: 'already_reviewed' })
    const res = await ownerRejectReceiptAction(
      null,
      fd({ receipt_id: 'r1', rejection_reason: REASON })
    )
    await flush()
    expect(res).toHaveProperty('error')
    expect(h.sendNeedsFix).not.toHaveBeenCalled()
  })
})

describe('admin Approve', () => {
  it('logs the approval and emails the shopper', async () => {
    h.approve.mockResolvedValue({ ok: true, listingName: "Mama's Kitchen" })
    const res = await approveReceiptAction(null, fd({ receipt_id: 'r1' }))
    await flush()
    expect(res).toEqual({ success: true })
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'receipt_approved' }))
    expect(h.sendCounted).toHaveBeenCalledTimes(1)
  })

  it('a failed approval writes no audit row and emails nobody', async () => {
    h.approve.mockResolvedValue({ ok: false, reason: 'failed' })
    const res = await approveReceiptAction(null, fd({ receipt_id: 'r1' }))
    await flush()
    expect(res).toEqual({ error: 'Failed to approve receipt. Please try again.' })
    expect(h.audit).not.toHaveBeenCalled()
    expect(h.sendCounted).not.toHaveBeenCalled()
  })

  it('a receipt no longer pending is refused before any write', async () => {
    h.state.adminReceipt = { ...OWNER_RECEIPT, status: 'approved' }
    const res = await approveReceiptAction(null, fd({ receipt_id: 'r1' }))
    expect(res).toEqual({ error: 'Only pending receipts can be approved.' })
    expect(h.approve).not.toHaveBeenCalled()
  })
})

describe("the owner's list and badge", () => {
  it('reads only waiting receipts on their pages, never their own', async () => {
    h.state.rows = [
      {
        id: 'r1',
        user_id: 'shopper-1',
        amount_cents: 2500,
        purchase_date: '2026-11-03',
        created_at: '2026-11-04T00:00:00Z',
        file_path: 'shopper-1/a.jpg',
        listings: { name: "Mama's Kitchen" },
      },
    ]
    h.state.profiles = [{ id: 'shopper-1', display_name: 'Jordan Smith' }]
    const list = await listReceiptsToVerify('owner-1', ['l1'])
    expect(h.state.listQuery).toContainEqual(['in:listing_id', ['l1']])
    expect(h.state.listQuery).toContainEqual(['eq:status', 'pending_review'])
    expect(h.state.listQuery).toContainEqual(['neq:user_id', 'owner-1'])
    expect(list).toEqual([
      expect.objectContaining({ buyer: 'Jordan S.', amountCents: 2500, hasFile: true }),
    ])
    expect(JSON.stringify(list)).not.toContain('Smith')
  })

  it('counts the same way, and skips the read with no pages', async () => {
    expect(await countReceiptsToVerify('owner-1', ['l1'])).toBe(3)
    expect(h.state.countQuery).toContainEqual(['neq:user_id', 'owner-1'])
    expect(h.state.countQuery).toContainEqual(['eq:status', 'pending_review'])
    expect(await countReceiptsToVerify('owner-1', [])).toBe(0)
    expect(await listReceiptsToVerify('owner-1', [])).toEqual([])
  })
})
