import { describe, it, expect, vi, beforeEach } from 'vitest'

// Ticket 159. A self-listed page is still `unclaimed` but already has an owner.
// createClaim used to accept a stranger's claim on it, and approveClaim then
// overwrote owner_user_id, so one approval click took the page from the person
// who listed it. Both actions now refuse before writing anything.

const LISTING_ID = '0b6f5c7e-1d2a-4c3b-9e8f-7a6b5c4d3e2f'
const CLAIM_ID = '5d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const OWNER = 'owner-a'
const STRANGER = 'user-b'

const h = vi.hoisted(() => {
  const state = {
    user: { id: 'user-b', email: 'b@example.com' } as { id: string; email: string } | null,
    listing: null as Record<string, unknown> | null,
    claim: null as Record<string, unknown> | null,
    // Rows matched by the guarded listings update in approveClaim.
    listingUpdateRows: [{ id: 'x' }] as { id: string }[],
  }
  const writes: { table: string; op: 'insert' | 'update'; row: Record<string, unknown> }[] = []

  function makeClient() {
    return {
      auth: {
        getUser: async () => ({ data: { user: state.user } }),
        admin: { getUserById: async () => ({ data: { user: null } }) },
      },
      from(table: string) {
        let op: 'select' | 'update' = 'select'
        const builder = {
          select: () => builder,
          eq: () => builder,
          in: () => builder,
          gte: () => builder,
          is: () => builder,
          or: () => builder,
          maybeSingle: async () => ({
            data: table === 'listings' ? state.listing : table === 'claims' && op === 'select' ? state.claim : null,
            error: null,
          }),
          single: async () => ({ data: { id: 'new-claim' }, error: null }),
          insert: (row: Record<string, unknown>) => {
            writes.push({ table, op: 'insert', row })
            return builder
          },
          update: (row: Record<string, unknown>) => {
            op = 'update'
            writes.push({ table, op: 'update', row })
            return builder
          },
          then(resolve: (v: unknown) => void) {
            const data = table === 'listings' && op === 'update' ? state.listingUpdateRows : null
            resolve({ data, count: 0, error: null })
          },
        }
        return builder
      },
    }
  }

  return {
    state,
    writes,
    createClient: vi.fn(async () => makeClient()),
    createServiceClient: vi.fn(() => makeClient()),
    getAdminSession: vi.fn(async () => ({ user: { id: 'admin-1' } })),
    writeAuditLog: vi.fn(async () => undefined),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: h.createClient,
  createServiceClient: h.createServiceClient,
}))
vi.mock('@/lib/security/turnstile', () => ({
  TURNSTILE_ERROR: 'turnstile',
  verifyTurnstileFormData: vi.fn(async () => true),
}))
vi.mock('@/lib/admin/guard', () => ({
  getAdminSession: h.getAdminSession,
  writeAuditLog: h.writeAuditLog,
}))
vi.mock('@/lib/email/resend', () => ({ sendEmail: vi.fn(async () => undefined) }))
vi.mock('@/lib/email/adminRecipients', () => ({ adminNotificationRecipients: () => [] }))
vi.mock('@/lib/env', () => ({ getAppUrl: () => 'https://example.test' }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClaimAction } from '@/lib/actions/claims/createClaim'
import { approveClaimAction } from '@/lib/actions/admin/approveClaim'

function claimForm(): FormData {
  const fd = new FormData()
  fd.set('listing_id', LISTING_ID)
  fd.set('verification_email', 'owner@example.com')
  fd.set('role_at_business', 'owner')
  return fd
}

function approveForm(): FormData {
  const fd = new FormData()
  fd.set('claim_id', CLAIM_ID)
  return fd
}

function setListing(owner: string | null) {
  h.state.listing = {
    id: LISTING_ID,
    name: 'Test Bakery',
    trust_tier: 'unclaimed',
    status: 'published',
    owner_user_id: owner,
  }
}

function setClaim(claimant: string, listingOwner: string | null) {
  h.state.claim = {
    id: CLAIM_ID,
    status: 'pending',
    claimant_user_id: claimant,
    listing_id: LISTING_ID,
    listings: { id: LISTING_ID, name: 'Test Bakery', trust_tier: 'unclaimed', owner_user_id: listingOwner },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.writes.length = 0
  h.state.listing = null
  h.state.claim = null
  h.state.user = { id: STRANGER, email: 'b@example.com' }
  h.state.listingUpdateRows = [{ id: LISTING_ID }]
})

describe('createClaimAction refuses pages that already have an owner', () => {
  it('refuses a stranger on a self-listed page and writes nothing', async () => {
    setListing(OWNER)
    const result = await createClaimAction(null, claimForm())
    expect(result).toEqual({
      error: "This page already has an owner. If you think that's wrong, please contact support.",
    })
    expect(h.writes).toHaveLength(0)
  })

  it('tells the owner they already manage it', async () => {
    setListing(STRANGER)
    const result = await createClaimAction(null, claimForm())
    expect(result).toEqual({ error: 'You already manage this page. Find it in your dashboard.' })
    expect(h.writes).toHaveLength(0)
  })

  it('still accepts a claim on a page with no owner', async () => {
    setListing(null)
    const result = await createClaimAction(null, claimForm())
    expect(result).not.toHaveProperty('error')
    const claimInsert = h.writes.find((w) => w.table === 'claims' && w.op === 'insert')
    expect(claimInsert?.row.claimant_user_id).toBe(STRANGER)
  })
})

describe('approveClaimAction never overwrites a different owner', () => {
  it('refuses before any write when the page has another owner', async () => {
    setClaim(STRANGER, OWNER)
    const result = await approveClaimAction(null, approveForm())
    expect(result).toEqual({
      error:
        'This page already has a different owner. Reject the claim, or ask the founder before changing who owns it.',
    })
    expect(h.writes).toHaveLength(0)
    expect(h.writeAuditLog).not.toHaveBeenCalled()
  })

  it('approves when the claimant is already the owner', async () => {
    setClaim(OWNER, OWNER)
    const result = await approveClaimAction(null, approveForm())
    expect(result).toEqual({ success: true, claimId: CLAIM_ID, listingId: LISTING_ID })
  })

  it('approves an ownerless page and sets the claimant as owner', async () => {
    setClaim(STRANGER, null)
    const result = await approveClaimAction(null, approveForm())
    expect(result).toEqual({ success: true, claimId: CLAIM_ID, listingId: LISTING_ID })
    const listingUpdate = h.writes.find((w) => w.table === 'listings' && w.op === 'update')
    expect(listingUpdate?.row).toMatchObject({ trust_tier: 'claimed', owner_user_id: STRANGER })
    expect(h.writes.some((w) => w.table === 'user_roles' && w.row.user_id === STRANGER)).toBe(true)
  })

  it('rolls the claim back when an owner appeared between the read and the write', async () => {
    setClaim(STRANGER, null)
    h.state.listingUpdateRows = []
    const result = await approveClaimAction(null, approveForm())
    expect(result).toHaveProperty('error')
    const claimUpdates = h.writes.filter((w) => w.table === 'claims' && w.op === 'update')
    expect(claimUpdates.at(-1)?.row).toMatchObject({ status: 'pending', reviewed_at: null })
    expect(h.writes.some((w) => w.table === 'user_roles')).toBe(false)
  })
})
