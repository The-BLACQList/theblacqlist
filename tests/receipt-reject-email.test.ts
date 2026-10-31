// =============================================================================
// Ticket 165: rejecting a receipt saves the preset reason and sends the email
// =============================================================================
// The review result must not depend on the email. A send that fails, or never
// settles, still leaves the action returning success with the reason saved.
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    updated: null as Record<string, unknown> | null,
    sendImpl: async () => {},
  }
  const sendReceiptNeedsFixEmail = vi.fn(async (_c: unknown, _n: { reason: string | null }) =>
    state.sendImpl()
  )
  const createServiceClient = vi.fn(() => ({
    from(table: string) {
      const b = {
        select: () => b,
        eq: () => b,
        single: async () => ({
          data: {
            id: 'r-0002',
            user_id: 'u-2',
            listing_id: null,
            raw_business_name: 'Corner Shop',
            amount_cents: 1999,
            status: 'pending_review',
          },
          error: null,
        }),
        maybeSingle: async () => ({ data: null, error: null }),
        update(values: Record<string, unknown>) {
          if (table === 'receipt_uploads') state.updated = values
          return { eq: async () => ({ error: null }) }
        },
      }
      return b
    },
  }))
  return { state, sendReceiptNeedsFixEmail, createServiceClient }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: h.createServiceClient }))
vi.mock('@/lib/admin/guard', () => ({
  getAdminSession: vi.fn(async () => ({ user: { id: 'admin-1' } })),
  writeAuditLog: vi.fn(async () => {}),
}))
vi.mock('@/lib/email/receiptNotices', () => ({
  sendReceiptNeedsFixEmail: h.sendReceiptNeedsFixEmail,
}))

import { rejectReceiptAction } from '@/lib/actions/spend/rejectReceipt'

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('rejectReceiptAction (ticket 165)', () => {
  beforeEach(() => {
    h.state.updated = null
    h.state.sendImpl = async () => {}
    h.sendReceiptNeedsFixEmail.mockClear()
  })

  it('saves a preset reason and passes it to the email', async () => {
    const result = await rejectReceiptAction(
      null,
      form({ receipt_id: 'r-0002', rejection_reason: 'Looks like a duplicate' })
    )
    await flush()
    expect(result).toEqual({ success: true })
    expect(h.state.updated).toMatchObject({
      status: 'rejected',
      rejection_reason: 'Looks like a duplicate',
    })
    expect(h.sendReceiptNeedsFixEmail).toHaveBeenCalledTimes(1)
    expect(h.sendReceiptNeedsFixEmail.mock.calls[0]?.[1]).toMatchObject({
      reason: 'Looks like a duplicate',
      businessName: 'Corner Shop',
    })
  })

  it('saves the typed text for Other', async () => {
    await rejectReceiptAction(
      null,
      form({
        receipt_id: 'r-0002',
        rejection_reason: 'other',
        rejection_reason_other: 'Tip line is cut off',
      })
    )
    expect(h.state.updated?.rejection_reason).toBe('Tip line is cut off')
  })

  it('still succeeds when the send never settles', async () => {
    h.state.sendImpl = () => new Promise(() => {})
    const result = await rejectReceiptAction(
      null,
      form({ receipt_id: 'r-0002', rejection_reason: 'Photo is hard to read' })
    )
    expect(result).toEqual({ success: true })
    expect(h.state.updated?.status).toBe('rejected')
  })
})
