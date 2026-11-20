// =============================================================================
// Ticket 235: the "payment received" email and the admin Unpublish
// =============================================================================
// Pinned here:
//   - a paid job's poster gets one email when the payment lands, and a Stripe
//     redelivery (listing no longer a draft) never sends a second;
//   - nothing about that email can fail the webhook, or Stripe would retry a
//     payment that was already fulfilled;
//   - only an admin can take a job down, only a live job, and it lands on
//     'unpublished' (which the owner can't undo) rather than 'draft'.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { render } from '@react-email/components'

const h = vi.hoisted(() => ({
  sendEmail: vi.fn(async (_args: { to: string; subject: string }) => {}),
  transitionToPendingReview: vi.fn(async () => ({ success: true as const })),
  writeSystemAuditLog: vi.fn(async () => {}),
  writeAuditLog: vi.fn(async () => {}),
  getAdminSession: vi.fn(),
  revalidatePath: vi.fn(),
  serviceClient: null as unknown,
}))

vi.mock('@/lib/email/resend', () => ({ sendEmail: h.sendEmail }))
vi.mock('@/lib/listings/submitForReview', () => ({
  transitionToPendingReview: h.transitionToPendingReview,
}))
vi.mock('@/lib/audit/system', () => ({ writeSystemAuditLog: h.writeSystemAuditLog }))
vi.mock('@/lib/admin/guard', () => ({
  getAdminSession: h.getAdminSession,
  writeAuditLog: h.writeAuditLog,
}))
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => h.serviceClient }))

import {
  formatChargedAmount,
  handleCheckoutSessionCompleted,
} from '@/lib/services/billing/webhookHandlers'
import { JobPostingPaidEmail, jobPostingPaidSubject } from '@/lib/email/templates/job-posting-paid'
import { unpublishJobAction } from '@/lib/actions/admin/unpublishJob'

type Row = Record<string, unknown>

/**
 * A small Supabase fake: reads filter on `eq`, updates record what they wrote
 * and which rows they matched. `auth` is optional so a test can leave it out,
 * the way the older purchase-test fake does.
 */
function fakeClient(
  tables: Record<string, Row[]>,
  opts: { authEmail?: string | null; noAuth?: boolean; updateError?: string } = {}
) {
  const updates: { table: string; row: Row; filters: Row }[] = []
  const client: Record<string, unknown> = {
    from(table: string) {
      const filters: Row = {}
      let pendingUpdate: Row | null = null
      const rows = () =>
        (tables[table] ?? []).filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v))
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filters[col] = val
          return builder
        },
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        upsert: async () => ({ error: null }),
        update: (row: Row) => {
          pendingUpdate = row
          return builder
        },
        then: (res: (v: { data: Row[] | null; error: { message: string } | null }) => unknown) => {
          if (pendingUpdate) {
            updates.push({ table, row: pendingUpdate, filters: { ...filters } })
            if (opts.updateError) return res({ data: null, error: { message: opts.updateError } })
            return res({ data: rows().map((r) => ({ id: r.id })), error: null })
          }
          return res({ data: rows(), error: null })
        },
      }
      return builder
    },
  }
  if (!opts.noAuth) {
    client.auth = {
      admin: {
        getUserById: async () => ({
          data: { user: opts.authEmail ? { email: opts.authEmail } : null },
        }),
      },
    }
  }
  return { client: client as never, updates }
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.NEXT_PUBLIC_SITE_URL
})

// ── The email itself ─────────────────────────────────────────────────────────

describe('the payment received email', () => {
  it('has a Title Case subject naming the role', () => {
    expect(jobPostingPaidSubject('Line Cook')).toBe('Payment Received for Line Cook')
  })

  it('says what was charged, what happens next, and links to the role', async () => {
    const html = await render(
      JobPostingPaidEmail({
        jobTitle: 'Line Cook',
        amount: '$9.99',
        roleUrl: 'https://theblacqlist.com/dashboard/pages/l1/posted',
      })
    )
    expect(html).toContain('Your Role Is in Review')
    expect(html).toContain('$9.99')
    expect(html).toContain('3 to 5')
    expect(html).toContain('30 days')
    expect(html).toContain('https://theblacqlist.com/dashboard/pages/l1/posted')
    expect(html).toContain('See Your Role')
    expect(html).toContain('support@theblacqlist.com')
    expect(html).not.toContain('—')
  })

  it('leaves the amount out when there is none', async () => {
    const html = await render(
      JobPostingPaidEmail({ jobTitle: 'Line Cook', amount: null, roleUrl: 'https://x.test/r' })
    )
    expect(html).toContain('We received your payment.')
    expect(html).not.toContain('payment of')
  })
})

describe('formatChargedAmount', () => {
  it('formats what Stripe charged', () => {
    expect(formatChargedAmount(999, 'usd')).toBe('$9.99')
    expect(formatChargedAmount(4900, 'USD')).toBe('$49.00')
  })

  it('is null when nothing was charged or the currency is junk', () => {
    expect(formatChargedAmount(0, 'usd')).toBeNull()
    expect(formatChargedAmount(null, 'usd')).toBeNull()
    expect(formatChargedAmount(999, 'not-a-currency')).toBeNull()
  })
})

// ── Sending it from the webhook ──────────────────────────────────────────────

function session(over: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_1',
    payment_status: 'paid',
    amount_total: 999,
    currency: 'usd',
    payment_intent: 'pi_test_1',
    customer_details: { email: 'poster@example.test' },
    metadata: { purpose: 'job_posting', listing_id: 'l1', user_id: 'u1' },
    ...over,
  } as unknown as Stripe.Checkout.Session
}

const draftJob = { id: 'l1', owner_user_id: 'u1', status: 'draft', name: 'Line Cook' }

describe('handleCheckoutSessionCompleted sends the email', () => {
  it('sends once, to the checkout email, after the job moves to review', async () => {
    const { client } = fakeClient({ listings: [draftJob] })
    await handleCheckoutSessionCompleted(client, session())

    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    const args = h.sendEmail.mock.calls[0]![0] as { to: string; subject: string }
    expect(args.to).toBe('poster@example.test')
    expect(args.subject).toBe('Payment Received for Line Cook')
    expect(h.transitionToPendingReview.mock.invocationCallOrder[0]).toBeLessThan(
      h.sendEmail.mock.invocationCallOrder[0]!
    )
  })

  it('does not send again on a redelivery, once the job is past draft', async () => {
    for (const status of ['pending', 'published']) {
      const { client } = fakeClient({ listings: [{ ...draftJob, status }] })
      await handleCheckoutSessionCompleted(client, session())
    }
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('falls back to the account email when checkout has none', async () => {
    const { client } = fakeClient({ listings: [draftJob] }, { authEmail: 'account@example.test' })
    await handleCheckoutSessionCompleted(client, session({ customer_details: null }))
    expect((h.sendEmail.mock.calls[0]![0] as { to: string }).to).toBe('account@example.test')
  })

  it('skips quietly when there is no address at all', async () => {
    const { client } = fakeClient({ listings: [draftJob] }, { authEmail: null })
    await handleCheckoutSessionCompleted(client, session({ customer_details: null }))
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('never fails the webhook, even when the lookup or the send throws', async () => {
    const { client } = fakeClient({ listings: [draftJob] }, { noAuth: true })
    await expect(
      handleCheckoutSessionCompleted(client, session({ customer_details: null }))
    ).resolves.toBeUndefined()

    h.sendEmail.mockRejectedValueOnce(new Error('resend down'))
    const second = fakeClient({ listings: [draftJob] })
    await expect(handleCheckoutSessionCompleted(second.client, session())).resolves.toBeUndefined()
    expect(h.writeSystemAuditLog).toHaveBeenCalled()
  })
})

// ── Admin Unpublish ──────────────────────────────────────────────────────────

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const liveJob = {
  id: 'l1',
  status: 'published',
  entity_type: 'job',
  slug: 'line-cook',
  cities: { slug: 'atlanta' },
}

describe('unpublishJobAction', () => {
  beforeEach(() => {
    h.getAdminSession.mockResolvedValue({ user: { id: 'admin-1' } })
  })

  it('refuses anyone who is not an admin', async () => {
    h.getAdminSession.mockResolvedValue(null)
    const { client, updates } = fakeClient({ listings: [liveJob] })
    h.serviceClient = client
    expect(await unpublishJobAction(null, form({ listing_id: 'l1' }))).toMatchObject({
      error: expect.stringContaining('permission'),
    })
    expect(updates).toHaveLength(0)
  })

  it('takes a live job down to unpublished, with the note, and says so everywhere', async () => {
    const { client, updates } = fakeClient({ listings: [liveJob] })
    h.serviceClient = client
    const res = await unpublishJobAction(
      null,
      form({ listing_id: 'l1', note: '  Role was filled offline.  ' })
    )

    expect(res).toEqual({ success: true })
    expect(updates).toHaveLength(1)
    expect(updates[0]!.row).toMatchObject({
      status: 'unpublished',
      moderation_notes: 'Role was filled offline.',
    })
    // Only a still-live row moves.
    expect(updates[0]!.filters).toMatchObject({ id: 'l1', status: 'published' })
    expect(h.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'unpublish_job', targetId: 'l1', adminUserId: 'admin-1' })
    )
    const paths = h.revalidatePath.mock.calls.map((c) => c[0])
    expect(paths).toEqual(
      expect.arrayContaining(['/jobs', '/atlanta/job/line-cook', '/dashboard/pages/l1/edit'])
    )
  })

  it('leaves the notes alone when no note is given', async () => {
    const { client, updates } = fakeClient({ listings: [liveJob] })
    h.serviceClient = client
    await unpublishJobAction(null, form({ listing_id: 'l1', note: '   ' }))
    expect(updates[0]!.row).not.toHaveProperty('moderation_notes')
  })

  it('refuses a job that is not live, and anything that is not a job', async () => {
    for (const listing of [
      { ...liveJob, status: 'pending' },
      { ...liveJob, status: 'closed' },
      { ...liveJob, entity_type: 'business' },
    ]) {
      const { client, updates } = fakeClient({ listings: [listing] })
      h.serviceClient = client
      expect(await unpublishJobAction(null, form({ listing_id: 'l1' }))).toHaveProperty('error')
      expect(updates).toHaveLength(0)
    }
    expect(h.writeAuditLog).not.toHaveBeenCalled()
  })

  it('reports a failed write instead of claiming success', async () => {
    const { client } = fakeClient({ listings: [liveJob] }, { updateError: 'db down' })
    h.serviceClient = client
    expect(await unpublishJobAction(null, form({ listing_id: 'l1' }))).toHaveProperty('error')
    expect(h.writeAuditLog).not.toHaveBeenCalled()
  })
})

// ── What the owner sees ──────────────────────────────────────────────────────

describe("the owner's Visibility card", () => {
  const src = readFileSync(
    path.resolve(process.cwd(), 'components/dashboard/PublishSection.tsx'),
    'utf8'
  )

  it('has a Taken Down state for a job an admin unpublished, with the support address', () => {
    expect(src).toContain("currentStatus === 'unpublished' && entityType === 'job'")
    expect(src).toContain('Taken Down')
    expect(src).toContain('SUPPORT_EMAIL')
  })
})
