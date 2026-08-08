// =============================================================================
// Trust-tier hardening regression tests
// =============================================================================
// Covers the three defects that shipped in the trust-tier chain:
//
//   T1  The admin tier control offered 'unverified' — not a valid trust_tier —
//       so every attempt hit the DB CHECK and surfaced as "Please try again",
//       while 'unclaimed'/'claimed' were unreachable (no manual demotion path).
//       Guarded here by parsing the real migration SQL, so this class of drift
//       fails CI instead of production.
//
//   T2  A rejection nulled verified_at / verified_by unconditionally, so
//       rejecting a RE-review of an already-verified listing silently erased
//       when and by whom it was originally verified.
//
//   T4  The resubmit guard omitted 'pending' — the very status the submit
//       action writes — so each resubmit stacked another moderation_queue row.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { VALID_TRUST_TIERS, MANUAL_TRUST_TIERS } from '@/lib/constants/listing'

// ── Shared mocks ────────────────────────────────────────────────────────────
// Hoisted so both action suites can reach the same captured state. The email
// templates are mocked at module level to keep @react-email/components (and its
// JSX) out of the node test environment entirely — these tests assert what gets
// written to the database, not what the mail looks like.
const h = vi.hoisted(() => ({
  adminSession: { user: { id: 'admin-1' } } as { user: { id: string } } | null,
  ownerSession: { user: { id: 'owner-1', email: 'owner@example.test' } } as {
    user: { id: string; email: string | undefined }
  } | null,
  listingRow: null as Record<string, unknown> | null,
  openQueueRow: null as { id: string } | null,
  captured: {
    listingUpdate: null as Record<string, unknown> | null,
    queueInserts: [] as Record<string, unknown>[],
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: vi.fn(async () => {}) }))
vi.mock('@/lib/email/templates/verification-submitted', () => ({
  VerificationSubmittedEmail: vi.fn(() => null),
}))
vi.mock('@/lib/email/templates/verification-approved', () => ({
  VerificationApprovedEmail: vi.fn(() => null),
}))
vi.mock('@/lib/email/templates/verification-rejected', () => ({
  VerificationRejectedEmail: vi.fn(() => null),
}))
vi.mock('@/lib/email/templates/verification-admin-notification', () => ({
  VerificationAdminNotificationEmail: vi.fn(() => null),
}))
vi.mock('@/lib/admin/guard', () => ({
  getAdminSession: vi.fn(async () => h.adminSession),
  writeAuditLog: vi.fn(async () => {}),
}))
vi.mock('@/lib/dashboard/guard', () => ({
  getOwnerSession: vi.fn(async () => h.ownerSession),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => makeFakeClient()),
  createServiceClient: vi.fn(() => makeFakeClient()),
}))

// A minimal table-aware fake of the Supabase client, in the shape the existing
// subscription-upsert test established: chainable filters always return the
// builder, terminal reads resolve through maybeSingle, and the builder is
// itself thenable so an awaited write (update + N filters, no maybeSingle)
// settles and records what it tried to persist.
function makeFakeClient() {
  function from(table: string) {
    let pendingUpdate: Record<string, unknown> | null = null

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      is: () => builder,
      update: (row: Record<string, unknown>) => {
        pendingUpdate = row
        return builder
      },
      insert: (row: Record<string, unknown>) => {
        if (table === 'moderation_queue') h.captured.queueInserts.push(row)
        return Promise.resolve({ data: null, error: null })
      },
      maybeSingle: () =>
        Promise.resolve({
          data: table === 'listings' ? h.listingRow : h.openQueueRow,
          error: null,
        }),
      then: (resolve: (v: { data: null; error: null }) => unknown) => {
        if (pendingUpdate && table === 'listings') h.captured.listingUpdate = pendingUpdate
        return Promise.resolve(resolve({ data: null, error: null }))
      },
    }
    return builder
  }

  return { from, auth: { admin: { getUserById: vi.fn(async () => ({ data: { user: null } })) } } }
}

import { updateVerificationStatusAction } from '@/lib/actions/admin/updateVerificationStatus'
import { submitVerificationRequest } from '@/lib/actions/owner/submitVerificationRequest'

function form(entries: Record<string, string | string[]>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) value.forEach((v) => fd.append(key, v))
    else fd.set(key, value)
  }
  return fd
}

beforeEach(() => {
  h.adminSession = { user: { id: 'admin-1' } }
  h.ownerSession = { user: { id: 'owner-1', email: 'owner@example.test' } }
  h.listingRow = null
  h.openQueueRow = null
  h.captured.listingUpdate = null
  h.captured.queueInserts = []
})

// ── T1: the constant cannot drift from the DB CHECK ─────────────────────────

describe('trust_tier constant vs. schema CHECK', () => {
  // Scan every migration and take the LAST `CHECK (trust_tier IN (...))` to
  // define the live constraint — the same "later migration wins" rule that
  // superseded the entity_type constraint in 20260524000001.
  function liveTrustTiersFromMigrations(): string[] {
    const dir = path.resolve(process.cwd(), 'supabase/migrations')
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    let last: string[] | null = null
    const pattern = /CHECK\s*\(\s*trust_tier\s+IN\s*\(([^)]*)\)/gi

    for (const file of files) {
      const sql = readFileSync(path.join(dir, file), 'utf8')
      for (const match of sql.matchAll(pattern)) {
        last = (match[1] ?? '')
          .split(',')
          .map((v) => v.trim().replace(/^'|'$/g, ''))
          .filter(Boolean)
      }
    }
    return last ?? []
  }

  it('finds a trust_tier CHECK in the migrations at all', () => {
    expect(liveTrustTiersFromMigrations().length).toBeGreaterThan(0)
  })

  it('VALID_TRUST_TIERS matches the live CHECK set exactly', () => {
    expect([...VALID_TRUST_TIERS].sort()).toEqual(liveTrustTiersFromMigrations().sort())
  })

  it('every manually-settable tier is a valid tier', () => {
    for (const tier of MANUAL_TRUST_TIERS) {
      expect(VALID_TRUST_TIERS).toContain(tier)
    }
  })

  it('exposes a manual demotion path below verified', () => {
    expect(MANUAL_TRUST_TIERS).toContain('claimed')
    expect(MANUAL_TRUST_TIERS).toContain('unclaimed')
  })
})

// ── T2: rejection must not erase verification provenance ────────────────────

describe('updateVerificationStatusAction provenance', () => {
  it('preserves verified_at/verified_by when rejecting an already-verified listing', async () => {
    h.listingRow = {
      id: 'listing-1',
      name: 'Test Business',
      trust_tier: 'verified',
      verification_status: 'verified',
      owner_user_id: null,
    }

    const result = await updateVerificationStatusAction(
      null,
      form({ listing_id: 'listing-1', decision: 'rejected', notes: 'Docs did not name you.' })
    )

    expect(result).toMatchObject({ success: true, decision: 'rejected' })
    // The write must not mention the provenance columns at all — writing null
    // is exactly the bug; omitting the keys is the fix.
    expect(h.captured.listingUpdate).not.toHaveProperty('verified_at')
    expect(h.captured.listingUpdate).not.toHaveProperty('verified_by')
    expect(h.captured.listingUpdate).toMatchObject({ verification_status: 'rejected' })
  })

  it('does not promote the tier on rejection', async () => {
    h.listingRow = {
      id: 'listing-1',
      name: 'Test Business',
      trust_tier: 'claimed',
      verification_status: 'pending',
      owner_user_id: null,
    }

    await updateVerificationStatusAction(
      null,
      form({ listing_id: 'listing-1', decision: 'rejected' })
    )

    expect(h.captured.listingUpdate).toMatchObject({ trust_tier: 'claimed' })
  })

  it('writes provenance when granting', async () => {
    h.listingRow = {
      id: 'listing-1',
      name: 'Test Business',
      trust_tier: 'claimed',
      verification_status: 'pending',
      owner_user_id: null,
    }

    await updateVerificationStatusAction(
      null,
      form({ listing_id: 'listing-1', decision: 'verified' })
    )

    expect(h.captured.listingUpdate).toMatchObject({
      trust_tier: 'verified',
      verification_status: 'verified',
      verified_by: 'admin-1',
    })
    expect(h.captured.listingUpdate?.verified_at).toEqual(expect.any(String))
  })

  it('refuses to verify an unclaimed listing', async () => {
    h.listingRow = {
      id: 'listing-1',
      name: 'Test Business',
      trust_tier: 'unclaimed',
      verification_status: 'none',
      owner_user_id: null,
    }

    const result = await updateVerificationStatusAction(
      null,
      form({ listing_id: 'listing-1', decision: 'verified' })
    )

    expect(result).toMatchObject({ error: expect.stringContaining('unclaimed') })
    expect(h.captured.listingUpdate).toBeNull()
  })
})

// ── T4: no duplicate verification requests or queue rows ────────────────────

describe('submitVerificationRequest duplicate protection', () => {
  const submitForm = form({ listing_id: 'listing-1', 'doc_paths[]': ['docs/a.pdf'] })

  it('refuses a resubmit while the request is already pending', async () => {
    h.listingRow = {
      id: 'listing-1',
      name: 'Test Business',
      trust_tier: 'claimed',
      verification_status: 'pending',
      owner_user_id: 'owner-1',
    }

    const result = await submitVerificationRequest(null, submitForm)

    expect(result).toMatchObject({ error: expect.stringContaining('under review') })
    expect(h.captured.queueInserts).toHaveLength(0)
  })

  it('accepts a first submit and enqueues exactly one queue row', async () => {
    h.listingRow = {
      id: 'listing-1',
      name: 'Test Business',
      trust_tier: 'claimed',
      verification_status: 'none',
      owner_user_id: 'owner-1',
    }
    h.openQueueRow = null

    const result = await submitVerificationRequest(null, submitForm)

    expect(result).toMatchObject({ success: true })
    expect(h.captured.queueInserts).toHaveLength(1)
    expect(h.captured.queueInserts[0]).toMatchObject({
      entity_id: 'listing-1',
      entity_type: 'listing',
      queue_type: 'verification',
      status: 'pending',
    })
  })

  it('does not stack a second queue row when one is already unresolved', async () => {
    h.listingRow = {
      id: 'listing-1',
      name: 'Test Business',
      trust_tier: 'claimed',
      verification_status: 'rejected',
      owner_user_id: 'owner-1',
    }
    h.openQueueRow = { id: 'queue-1' }

    const result = await submitVerificationRequest(null, submitForm)

    expect(result).toMatchObject({ success: true })
    expect(h.captured.queueInserts).toHaveLength(0)
  })

  it('refuses a listing the caller does not own', async () => {
    h.listingRow = {
      id: 'listing-1',
      name: 'Test Business',
      trust_tier: 'claimed',
      verification_status: 'none',
      owner_user_id: 'someone-else',
    }

    const result = await submitVerificationRequest(null, submitForm)

    expect(result).toMatchObject({ error: expect.stringContaining('do not own') })
    expect(h.captured.queueInserts).toHaveLength(0)
  })
})
