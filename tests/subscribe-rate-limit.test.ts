// =============================================================================
// Checkpoint 1.6 — durable rate limit on the coming-soon capture
// =============================================================================
// subscribeLaunchAction is UNAUTHENTICATED and inserts with the service-role
// client. Before this change it had no throttle of any kind, so anyone could
// drive unbounded writes into launch_subscribers.
//
// What these tests pin down:
//   * under the limit, the subscriber insert happens
//   * at the limit, the throttle error is returned AND no row is written to
//     either table (count-first, so an attacker cannot grow the ledger)
//   * a malformed submission still consumes budget, or the limit is bypassable
//     by sending garbage
//   * the raw IP is never handed to the database — only a sha256 digest
//   * a unique violation still returns { success: true } (pre-existing
//     behaviour that must survive the change: the form is not an enumeration
//     oracle)
//   * if the ledger is unreachable the action FAILS OPEN — the code merge and
//     the migration are separate gates, so this runs before the table exists
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  ip: '203.0.113.7',
  attemptCount: 0,
  countError: null as { message: string } | null,
  subscriberInsertError: null as { code: string } | null,
  captured: {
    attemptInserts: [] as Record<string, unknown>[],
    subscriberInserts: [] as Record<string, unknown>[],
    countFilters: [] as Record<string, unknown>[],
  },
}))

vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', h.ip]]) as unknown as Headers,
}))

vi.mock('@/lib/env', () => ({ SUBSCRIBE_RATE_LIMIT_SALT: 'test-salt' }))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from(table: string) {
      if (table === 'launch_subscribe_attempts') {
        const filters: Record<string, unknown> = {}
        const builder = {
          select: () => builder,
          eq: (col: string, val: unknown) => {
            filters[col] = val
            return builder
          },
          gte: (col: string, val: unknown) => {
            filters[col] = val
            h.captured.countFilters.push(filters)
            return Promise.resolve({ count: h.attemptCount, error: h.countError })
          },
          insert: (row: Record<string, unknown>) => {
            h.captured.attemptInserts.push(row)
            return Promise.resolve({ error: null })
          },
        }
        return builder
      }
      return {
        insert: (row: Record<string, unknown>) => {
          h.captured.subscriberInserts.push(row)
          return Promise.resolve({ error: h.subscriberInsertError })
        },
      }
    },
  }),
}))

const { subscribeLaunchAction } = await import('@/lib/actions/subscribers/subscribeLaunch')

function form(email: string): FormData {
  const fd = new FormData()
  fd.set('email', email)
  return fd
}

describe('subscribeLaunchAction rate limiting', () => {
  beforeEach(() => {
    h.ip = '203.0.113.7'
    h.attemptCount = 0
    h.countError = null
    h.subscriberInsertError = null
    h.captured.attemptInserts = []
    h.captured.subscriberInserts = []
    h.captured.countFilters = []
  })

  it('subscribes normally when under the limit', async () => {
    h.attemptCount = 4
    const result = await subscribeLaunchAction(null, form('new@example.test'))

    expect(result).toEqual({ success: true })
    expect(h.captured.subscriberInserts).toHaveLength(1)
    expect(h.captured.attemptInserts).toHaveLength(1)
  })

  it('throttles at the limit and writes nothing to either table', async () => {
    h.attemptCount = 5
    const result = await subscribeLaunchAction(null, form('new@example.test'))

    expect(result).toEqual({
      error: 'Too many attempts. Please try again in a few minutes.',
    })
    // Count-first is the point: rejecting must not itself grow the ledger, or a
    // sustained attack writes one row per request forever.
    expect(h.captured.attemptInserts).toHaveLength(0)
    expect(h.captured.subscriberInserts).toHaveLength(0)
  })

  it('spends budget on a malformed submission too', async () => {
    h.attemptCount = 0
    const result = await subscribeLaunchAction(null, form('not-an-email'))

    expect(result).toEqual({ error: 'Please enter a valid email address.' })
    // If validation ran first, an attacker would bypass the limit entirely by
    // sending garbage — every rejected request would cost them nothing.
    expect(h.captured.attemptInserts).toHaveLength(1)
    expect(h.captured.subscriberInserts).toHaveLength(0)
  })

  it('never hands the raw IP to the database', async () => {
    h.ip = '198.51.100.42'
    await subscribeLaunchAction(null, form('new@example.test'))

    const written = String(h.captured.attemptInserts[0]?.ip_hash ?? '')
    expect(written).not.toContain('198.51.100.42')
    expect(written).toMatch(/^[a-f0-9]{64}$/)

    const queried = String(h.captured.countFilters[0]?.ip_hash ?? '')
    expect(queried).toBe(written)
  })

  it('gives different IPs independent budgets', async () => {
    await subscribeLaunchAction(null, form('a@example.test'))
    h.ip = '198.51.100.99'
    await subscribeLaunchAction(null, form('b@example.test'))

    const [first, second] = h.captured.attemptInserts.map((r) => r.ip_hash)
    expect(first).not.toBe(second)
  })

  it('still reports success on a duplicate email (23505)', async () => {
    h.subscriberInsertError = { code: '23505' }
    const result = await subscribeLaunchAction(null, form('already@example.test'))

    // Pre-existing behaviour that must survive: telling a repeat visitor they
    // are already on the list turns the form into an enumeration oracle.
    expect(result).toEqual({ success: true })
  })

  it('fails open when the ledger is unreachable', async () => {
    h.countError = { message: 'relation "launch_subscribe_attempts" does not exist' }
    h.attemptCount = 0

    const result = await subscribeLaunchAction(null, form('new@example.test'))

    // The code merge (GATE-DEPLOY) and the migration (GATE-DATA) are separate
    // decisions, so there is a real window where this table does not exist yet.
    // A limiter outage must not take the capture form down with it.
    expect(result).toEqual({ success: true })
    expect(h.captured.subscriberInserts).toHaveLength(1)
    expect(h.captured.attemptInserts).toHaveLength(0)
  })
})
