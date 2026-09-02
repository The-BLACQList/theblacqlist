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
import { readFileSync } from 'node:fs'
import path from 'node:path'

const h = vi.hoisted(() => ({
  ip: '203.0.113.7',
  attemptCount: 0,
  countError: null as { message: string } | null,
  subscriberInsertError: null as { code: string } | null,
  captured: {
    attemptInserts: [] as Record<string, unknown>[],
    subscriberInserts: [] as Record<string, unknown>[],
    subscriberUpdates: [] as { row: Record<string, unknown>; filters: Record<string, unknown> }[],
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
        // The 23505 promote path chains .update().eq().eq() and awaits the
        // result, so the builder has to be both chainable and thenable.
        update: (row: Record<string, unknown>) => {
          const filters: Record<string, unknown> = {}
          h.captured.subscriberUpdates.push({ row, filters })
          const builder = {
            eq: (col: string, val: unknown) => {
              filters[col] = val
              return builder
            },
            then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
          }
          return builder
        },
      }
    },
  }),
}))

const { subscribeLaunchAction } = await import('@/lib/actions/subscribers/subscribeLaunch')

function form(email: string, source?: string): FormData {
  const fd = new FormData()
  fd.set('email', email)
  // Omitted entirely when not given — the coming-soon form posts no `source`,
  // and the action has to keep defaulting for it.
  if (source !== undefined) fd.set('source', source)
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
    h.captured.subscriberUpdates = []
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

// =============================================================================
// C4 — waitlist source attribution
// =============================================================================
// `launch_subscribers.source` is unconstrained text written by the service-role
// client, and /pricing now posts a `source` chosen in the browser. Two safety
// properties hold that together:
//   * the allowlist — an arbitrary client string is never written through
//   * the guarded promote — an existing generic row is upgraded to a tier
//     interest, but one tier interest never overwrites another
// =============================================================================

describe('subscribeLaunchAction source attribution', () => {
  beforeEach(() => {
    h.ip = '203.0.113.7'
    h.attemptCount = 0
    h.countError = null
    h.subscriberInsertError = null
    h.captured.attemptInserts = []
    h.captured.subscriberInserts = []
    h.captured.subscriberUpdates = []
    h.captured.countFilters = []
  })

  it('defaults the source when the form omits it', async () => {
    await subscribeLaunchAction(null, form('plain@example.test'))

    expect(h.captured.subscriberInserts[0]).toMatchObject({ source: 'coming-soon' })
  })

  it('writes an allowlisted source through', async () => {
    await subscribeLaunchAction(null, form('growth@example.test', 'pricing-growth'))

    expect(h.captured.subscriberInserts[0]).toMatchObject({ source: 'pricing-growth' })
  })

  it('writes the /for-vendors source through', async () => {
    // The marketplace requires the Growth tier, which is deliberately not for
    // sale, so /for-vendors captures interest instead of routing to a checkout
    // that would 422. If this source were ever dropped from the allowlist the
    // page would keep working and silently record every vendor as a generic
    // coming-soon signup — under-counting the exact demand signal the founder
    // is using to decide whether to build vendor storefronts next.
    await subscribeLaunchAction(null, form('vendor@example.test', 'for-vendors'))

    expect(h.captured.subscriberInserts[0]).toMatchObject({ source: 'for-vendors' })
  })

  it('falls back to the default for an unrecognized source', async () => {
    await subscribeLaunchAction(null, form('evil@example.test', 'attacker-controlled'))

    // The whole point of the allowlist: the column the founder reads to decide
    // what to build next must not be writable to arbitrary strings by anyone
    // who can POST the form.
    expect(h.captured.subscriberInserts[0]).toMatchObject({ source: 'coming-soon' })
  })

  it('promotes an existing generic row on a duplicate, guarded on the old value', async () => {
    h.subscriberInsertError = { code: '23505' }
    const result = await subscribeLaunchAction(null, form('already@example.test', 'pricing-premium'))

    expect(result).toEqual({ success: true })
    expect(h.captured.subscriberUpdates).toHaveLength(1)
    expect(h.captured.subscriberUpdates[0]?.row).toEqual({ source: 'pricing-premium' })
    // The .eq('source', 'coming-soon') guard is what stops a later
    // pricing-premium signup from erasing an earlier pricing-growth interest.
    expect(h.captured.subscriberUpdates[0]?.filters).toEqual({
      email: 'already@example.test',
      source: 'coming-soon',
    })
  })

  it('does not promote when the duplicate carries the default source', async () => {
    h.subscriberInsertError = { code: '23505' }
    const result = await subscribeLaunchAction(null, form('already@example.test'))

    expect(result).toEqual({ success: true })
    expect(h.captured.subscriberUpdates).toHaveLength(0)
  })
})

// =============================================================================
// The allowlist is a two-file invariant
// =============================================================================
// A page declares the `source` it posts; the action decides whether to honour
// it. Nothing links the two at compile time — the option values are plain
// strings on one side and a Set literal on the other. Drift is silent by
// construction: the form keeps submitting, the subscriber keeps getting
// recorded, and only the attribution is lost. Source-text is the only place the
// pair can be compared, following tests/impact-report.test.ts:328-333.
// =============================================================================

describe('waitlist source declarations match the allowlist', () => {
  const read = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), 'utf8')
  const actionSrc = read('lib/actions/subscribers/subscribeLaunch.ts')

  // Scoped to the Set literal so a `source` string appearing in a comment or in
  // the promote path cannot make a missing entry look present.
  const allowlistBlock = actionSrc.match(/const ALLOWED_SOURCES = new Set\(\[([\s\S]*?)\]\)/)?.[1]

  it('parses the ALLOWED_SOURCES literal', () => {
    expect(allowlistBlock).toBeDefined()
  })

  it('allowlists every source /for-vendors declares', () => {
    const pageSrc = read('app/(public)/for-vendors/page.tsx')
    const declared = [...pageSrc.matchAll(/value:\s*'([^']+)'/g)].map((m) => m[1])

    // A page that declares no source at all would pass an "every" assertion
    // vacuously, so pin the count too.
    expect(declared).toHaveLength(1)
    for (const value of declared) {
      expect(allowlistBlock).toContain(`'${value}'`)
    }
  })
})
