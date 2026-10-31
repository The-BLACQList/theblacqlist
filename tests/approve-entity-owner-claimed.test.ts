import { describe, it, expect, vi, beforeEach } from 'vitest'

// Ticket 158 (founder pick 3A). An owner who adds and attests their own page
// gets the same review a claim gets, so approval makes it Claimed, writes an
// approved claim row (starts the 90-day Certified clock) and grants the owner
// role. Staff-seeded pages, events and jobs approve exactly as before.

const LISTING_ID = '2a7c9e10-4b3d-4f6e-8a1b-0c2d3e4f5a6b'
const OWNER = 'owner-1'
const ADMIN = 'admin-1'

const h = vi.hoisted(() => {
  const state = {
    listing: null as Record<string, unknown> | null,
    claimInsertError: null as { message: string } | null,
    roleInsertError: null as { message: string; code?: string } | null,
  }
  const writes: { table: string; op: 'insert' | 'update'; row: Record<string, unknown> }[] = []

  function makeClient() {
    return {
      auth: { admin: { getUserById: async () => ({ data: { user: null } }) } },
      from(table: string) {
        let op: 'select' | 'insert' | 'update' = 'select'
        const result = () => {
          if (table === 'claims' && op === 'insert') {
            return state.claimInsertError
              ? { data: null, error: state.claimInsertError }
              : { data: { id: 'claim-new' }, error: null }
          }
          if (table === 'user_roles' && op === 'insert') return { data: null, error: state.roleInsertError }
          return { data: null, error: null }
        }
        const builder = {
          select: () => builder,
          eq: () => builder,
          in: () => builder,
          maybeSingle: async () => ({ data: table === 'listings' ? state.listing : null, error: null }),
          single: async () => result(),
          insert: (row: Record<string, unknown>) => {
            op = 'insert'
            writes.push({ table, op: 'insert', row })
            return builder
          },
          update: (row: Record<string, unknown>) => {
            op = 'update'
            writes.push({ table, op: 'update', row })
            return builder
          },
          then(resolve: (v: unknown) => void) {
            resolve(result())
          },
        }
        return builder
      },
    }
  }

  return {
    state,
    writes,
    createServiceClient: vi.fn(() => makeClient()),
    getAdminSession: vi.fn(async () => ({ user: { id: 'admin-1' } })),
    writeAuditLog: vi.fn(async (_entry: Record<string, unknown>) => undefined),
  }
})

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: h.createServiceClient }))
vi.mock('@/lib/admin/guard', () => ({
  getAdminSession: h.getAdminSession,
  writeAuditLog: h.writeAuditLog,
}))
vi.mock('@/lib/email/resend', () => ({ sendEmail: vi.fn(async () => undefined) }))
vi.mock('@/lib/services/listings/jobGoLive', () => ({ applyJobGoLiveDefaults: vi.fn(async () => undefined) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { approveEntityAction } from '@/lib/actions/admin/approveEntity'

function form(): FormData {
  const fd = new FormData()
  fd.set('listing_id', LISTING_ID)
  return fd
}

function setListing(overrides: Record<string, unknown> = {}) {
  h.state.listing = {
    id: LISTING_ID,
    name: 'Test Bakery',
    status: 'pending',
    trust_tier: 'unclaimed',
    slug: 'test-bakery',
    entity_type: 'business',
    submitted_by: OWNER,
    published_at: null,
    source: 'owner',
    ownership_attested: true,
    owner_user_id: OWNER,
    cities: { slug: 'atlanta' },
    ...overrides,
  }
}

const listingUpdate = () => h.writes.find((w) => w.table === 'listings' && w.op === 'update')?.row
const auditEntry = () => h.writeAuditLog.mock.calls[0]?.[0] as Record<string, Record<string, unknown>>

beforeEach(() => {
  vi.clearAllMocks()
  h.writes.length = 0
  h.state.claimInsertError = null
  h.state.roleInsertError = null
})

describe('owner-submitted, attested page', () => {
  it('publishes as claimed and writes the claim and the owner role', async () => {
    setListing()
    const result = await approveEntityAction(null, form())
    expect(result).toEqual({ success: true, listingId: LISTING_ID, listingName: 'Test Bakery' })

    expect(listingUpdate()).toMatchObject({ status: 'published', trust_tier: 'claimed' })

    const claim = h.writes.find((w) => w.table === 'claims' && w.op === 'insert')?.row
    expect(claim).toMatchObject({
      listing_id: LISTING_ID,
      claimant_user_id: OWNER,
      status: 'approved',
      role_at_business: 'owner',
      reviewed_by: ADMIN,
      notes: 'Owner-submitted page, ownership attested at submission',
    })
    // The Certified clock reads reviewed_at, so it must be the publish time.
    expect(claim?.reviewed_at).toBe(listingUpdate()?.published_at)

    const role = h.writes.find((w) => w.table === 'user_roles' && w.op === 'insert')?.row
    expect(role).toEqual({ user_id: OWNER, role: 'owner', listing_id: LISTING_ID, granted_by: ADMIN })

    const audit = auditEntry()
    expect(audit.beforeState).toMatchObject({ trust_tier: 'unclaimed' })
    expect(audit.afterState).toMatchObject({ trust_tier: 'claimed', claim_id: 'claim-new' })
    expect(audit.afterState).not.toHaveProperty('owner_path_errors')
  })

  it('still publishes as claimed when the claim and role writes fail, and logs why', async () => {
    setListing()
    h.state.claimInsertError = { message: 'boom' }
    h.state.roleInsertError = { message: 'nope', code: '42501' }
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await approveEntityAction(null, form())
    expect(result).toHaveProperty('success', true)
    expect(listingUpdate()).toMatchObject({ trust_tier: 'claimed' })
    // No rollback of the publish.
    expect(h.writes.filter((w) => w.table === 'listings' && w.op === 'update')).toHaveLength(1)

    const audit = auditEntry()
    expect(audit.afterState).toMatchObject({ claim_id: null })
    expect(audit.afterState?.owner_path_errors).toEqual(['claim insert: boom', 'owner role insert: nope'])
    errSpy.mockRestore()
  })

  it('treats an existing owner role as fine', async () => {
    setListing()
    h.state.roleInsertError = { message: 'duplicate key', code: '23505' }
    await approveEntityAction(null, form())
    expect(auditEntry().afterState).not.toHaveProperty('owner_path_errors')
  })
})

describe('pages that approve exactly as before', () => {
  const cases: [string, Record<string, unknown>][] = [
    ['a staff-seeded page with no owner', { source: 'admin', ownership_attested: false, owner_user_id: null }],
    ['an imported page', { source: 'import' }],
    ['an owner page without the attestation', { ownership_attested: false }],
    ['a job', { entity_type: 'job' }],
    ['an event', { entity_type: 'event' }],
    ['a page that is already claimed', { trust_tier: 'claimed' }],
  ]

  it.each(cases)('%s keeps its trust tier and gets no claim or role', async (_label, overrides) => {
    setListing(overrides)
    const result = await approveEntityAction(null, form())
    expect(result).toHaveProperty('success', true)
    expect(listingUpdate()).not.toHaveProperty('trust_tier')
    expect(h.writes.some((w) => w.table === 'claims')).toBe(false)
    expect(h.writes.some((w) => w.table === 'user_roles')).toBe(false)
    expect(auditEntry().afterState).not.toHaveProperty('claim_id')
  })
})
