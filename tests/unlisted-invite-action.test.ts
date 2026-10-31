// =============================================================================
// Ticket 168: "Email this business" and "Mark STOP received"
// =============================================================================
// Admin only. One send per click. A business emailed before needs confirm=yes.
// A business that said STOP gets nothing. sendEmail is mocked: no test sends.
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    admin: {
      user: { id: 'admin-1', email: 'founder@example.com' },
      role: 'super_admin',
    } as unknown,
    existing: null as Record<string, unknown> | null,
    readError: null as unknown,
    writes: [] as { op: 'insert' | 'update'; values: Record<string, unknown> }[],
  }
  const sendEmail = vi.fn(async (_o: Record<string, unknown>) => {})
  const writeAuditLog = vi.fn(async (_o: Record<string, unknown>) => {})
  const createServiceClient = vi.fn(() => ({
    from() {
      const b = {
        select: () => b,
        eq: () => b,
        is: () => b,
        maybeSingle: async () => ({ data: state.existing, error: state.readError }),
        single: async () => ({ data: { id: 'bis-1' }, error: null }),
        update(values: Record<string, unknown>) {
          state.writes.push({ op: 'update', values })
          return b
        },
        insert(values: Record<string, unknown>) {
          state.writes.push({ op: 'insert', values })
          return b
        },
      }
      return b
    },
  }))
  return { state, sendEmail, writeAuditLog, createServiceClient }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: h.createServiceClient }))
vi.mock('@/lib/admin/guard', () => ({
  getAdminSession: vi.fn(async () => h.state.admin),
  writeAuditLog: h.writeAuditLog,
}))
vi.mock('@/lib/email/resend', () => ({ sendEmail: h.sendEmail }))

import {
  markBusinessOptedOutAction,
  sendBusinessInviteAction,
} from '@/lib/actions/spend/unlistedInvite'

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const base = { business_name: 'Sweet Spot Bakery', email: 'Owner@Example.com' }

describe('sendBusinessInviteAction (ticket 168)', () => {
  beforeEach(() => {
    h.state.admin = { user: { id: 'admin-1', email: 'founder@example.com' }, role: 'super_admin' }
    h.state.existing = null
    h.state.readError = null
    h.state.writes = []
    h.sendEmail.mockClear()
    h.writeAuditLog.mockClear()
    h.createServiceClient.mockClear()
  })

  it('refuses a non-admin and sends nothing', async () => {
    h.state.admin = null
    const result = await sendBusinessInviteAction(null, form(base))
    expect(result).toEqual({ error: 'You do not have permission to perform this action.' })
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.createServiceClient).not.toHaveBeenCalled()
  })

  it('sends a first email once, with the subject and reply-to, and records it', async () => {
    const result = await sendBusinessInviteAction(null, form(base))
    expect(result).toMatchObject({ success: true })
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(h.sendEmail.mock.calls[0]?.[0]).toMatchObject({
      to: 'owner@example.com',
      subject: 'Customers are adding your receipts on The BLACQList',
      replyTo: 'founder@example.com',
    })
    expect(h.state.writes).toHaveLength(1)
    expect(h.state.writes[0]).toMatchObject({
      op: 'insert',
      values: {
        normalized_name: 'sweet spot bakery',
        city: null,
        email_count: 1,
        sent_by: 'admin-1',
      },
    })
    expect(h.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'business_invite.sent' })
    )
  })

  it('never stores or logs the typed address', async () => {
    await sendBusinessInviteAction(null, form(base))
    const saved = JSON.stringify([h.state.writes, h.writeAuditLog.mock.calls])
    expect(saved).not.toMatch(/owner@example\.com/i)
  })

  it('asks to confirm a repeat send and sends nothing', async () => {
    h.state.existing = {
      id: 'bis-1',
      emailed_at: '2026-10-20T00:00:00Z',
      email_count: 1,
      opted_out: false,
    }
    const result = await sendBusinessInviteAction(null, form(base))
    expect(result).toEqual({ needsConfirm: true, emailedAt: '2026-10-20T00:00:00Z' })
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.state.writes).toHaveLength(0)
  })

  it('sends a confirmed repeat once and bumps the count', async () => {
    h.state.existing = {
      id: 'bis-1',
      emailed_at: '2026-10-20T00:00:00Z',
      email_count: 1,
      opted_out: false,
    }
    const result = await sendBusinessInviteAction(null, form({ ...base, confirm: 'yes' }))
    expect(result).toMatchObject({ success: true })
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(h.state.writes[0]).toMatchObject({ op: 'update', values: { email_count: 2 } })
  })

  it('sends nothing to a business that said STOP, even when confirmed', async () => {
    h.state.existing = { id: 'bis-1', emailed_at: null, email_count: 0, opted_out: true }
    const result = await sendBusinessInviteAction(null, form({ ...base, confirm: 'yes' }))
    expect(result).toEqual({ error: 'This business asked us to stop emailing. Nothing was sent.' })
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('rejects a bad address or a missing name without sending', async () => {
    expect(await sendBusinessInviteAction(null, form({ ...base, email: 'not-an-email' }))).toEqual({
      error: 'Enter a valid email address.',
    })
    expect(await sendBusinessInviteAction(null, form({ ...base, business_name: '  ' }))).toEqual({
      error: 'Missing business name.',
    })
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('sends nothing when the check read fails', async () => {
    h.state.readError = { message: 'boom' }
    const result = await sendBusinessInviteAction(null, form(base))
    expect(result).toEqual({ error: "Couldn't check this business. Nothing was sent. Try again." })
    expect(h.sendEmail).not.toHaveBeenCalled()
  })
})

describe('markBusinessOptedOutAction (ticket 168)', () => {
  beforeEach(() => {
    h.state.admin = { user: { id: 'admin-1', email: 'founder@example.com' }, role: 'super_admin' }
    h.state.existing = null
    h.state.readError = null
    h.state.writes = []
    h.writeAuditLog.mockClear()
    h.createServiceClient.mockClear()
  })

  it('refuses a non-admin and writes nothing', async () => {
    h.state.admin = null
    const result = await markBusinessOptedOutAction(null, form({ business_name: 'Corner Shop' }))
    expect(result).toEqual({ error: 'You do not have permission to perform this action.' })
    expect(h.createServiceClient).not.toHaveBeenCalled()
  })

  it('marks a new business as opted out', async () => {
    const result = await markBusinessOptedOutAction(null, form({ business_name: 'Corner Shop' }))
    expect(result).toEqual({ success: true })
    expect(h.state.writes[0]).toMatchObject({
      op: 'insert',
      values: { normalized_name: 'corner shop', city: null, opted_out: true },
    })
    expect(h.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'business_invite.opted_out' })
    )
  })

  it('updates an existing row', async () => {
    h.state.existing = { id: 'bis-1' }
    await markBusinessOptedOutAction(null, form({ business_name: 'Corner Shop' }))
    expect(h.state.writes[0]).toMatchObject({ op: 'update', values: { opted_out: true } })
  })
})
