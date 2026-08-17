// =============================================================================
// Checkpoint 6.4 — durable rate limiting replaces the in-memory Maps
// =============================================================================
// app/api/search/route.ts and app/api/analytics/event/route.ts each kept their
// own `Map` of hits. On Fluid Compute an instance is reused across concurrent
// requests but is still replaced, and concurrent instances do not share memory,
// so neither Map bounded anything under real traffic.
//
// The counting itself is atomic inside Postgres and is covered behaviorally by
// tests/migrations/rate-limit-counters.test.ts. What these tests pin down is the
// client half — the contract between the routes and the ledger:
//
//   * an allow answer allows, a deny answer denies
//   * the raw identifier is never handed to the database, only a sha256 digest
//   * different identifiers and different buckets stay separate
//   * the arguments the routes rely on are passed through unchanged
//   * every failure path FAILS OPEN — an unreachable ledger must not take public
//     search down with it, and the migration (GATE-DATA) and this code
//     (GATE-DEPLOY) are separate decisions, so there is a real window in which
//     the table does not exist
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  rpcResult: { data: true as unknown, error: null as unknown },
  rpcThrows: false,
  clientThrows: false,
  calls: [] as { fn: string; args: Record<string, unknown> }[],
}))

vi.mock('@/lib/env', () => ({ SUBSCRIBE_RATE_LIMIT_SALT: 'test-salt' }))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => {
    // Mirrors the real factory, which throws when SUPABASE_SERVICE_ROLE_KEY is unset.
    if (h.clientThrows) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
    return {
      rpc: (fn: string, args: Record<string, unknown>) => {
        h.calls.push({ fn, args })
        if (h.rpcThrows) return Promise.reject(new Error('network down'))
        return Promise.resolve(h.rpcResult)
      },
    }
  },
}))

const { checkRateLimit, hashRateLimitKey, getClientIp } = await import('@/lib/security/rate-limit')

describe('checkRateLimit', () => {
  beforeEach(() => {
    h.rpcResult = { data: true, error: null }
    h.rpcThrows = false
    h.clientThrows = false
    h.calls = []
  })

  it('allows when the ledger says allowed', async () => {
    h.rpcResult = { data: true, error: null }
    await expect(
      checkRateLimit({ bucket: 'search', identifier: '203.0.113.7', limit: 60 })
    ).resolves.toBe(true)
  })

  it('denies when the ledger says denied', async () => {
    h.rpcResult = { data: false, error: null }
    await expect(
      checkRateLimit({ bucket: 'search', identifier: '203.0.113.7', limit: 60 })
    ).resolves.toBe(false)
  })

  it('never hands the raw identifier to the database', async () => {
    await checkRateLimit({ bucket: 'search', identifier: '198.51.100.42', limit: 60 })

    const sent = String(h.calls[0]?.args.p_key_hash ?? '')
    expect(sent).not.toContain('198.51.100.42')
    expect(sent).toMatch(/^[a-f0-9]{64}$/)
    expect(sent).toBe(hashRateLimitKey('198.51.100.42'))
  })

  it('hashes user ids too, not just IPs', async () => {
    const userId = '7f1c3d9e-0000-4000-8000-000000000001'
    await checkRateLimit({ bucket: 'search', identifier: `user:${userId}`, limit: 120 })

    // Keeping the ledger free of every identifier means the table is worthless
    // on its own, and a raw user id can never collide with a raw IP string.
    const sent = String(h.calls[0]?.args.p_key_hash ?? '')
    expect(sent).not.toContain(userId)
    expect(sent).toMatch(/^[a-f0-9]{64}$/)
  })

  it('gives different identifiers different keys', async () => {
    await checkRateLimit({ bucket: 'search', identifier: 'ip-a', limit: 60 })
    await checkRateLimit({ bucket: 'search', identifier: 'ip-b', limit: 60 })

    expect(h.calls[0]?.args.p_key_hash).not.toBe(h.calls[1]?.args.p_key_hash)
  })

  it('passes the bucket, limit and window through unchanged', async () => {
    await checkRateLimit({
      bucket: 'analytics_event',
      identifier: 'x',
      limit: 30,
      windowSeconds: 120,
    })

    expect(h.calls[0]?.fn).toBe('check_rate_limit')
    expect(h.calls[0]?.args).toMatchObject({
      p_bucket: 'analytics_event',
      p_limit: 30,
      p_window_seconds: 120,
    })
  })

  it('defaults to a 60-second window, matching the Maps it replaces', async () => {
    await checkRateLimit({ bucket: 'search', identifier: 'x', limit: 60 })
    expect(h.calls[0]?.args.p_window_seconds).toBe(60)
  })

  it('fails open when the ledger returns an error', async () => {
    h.rpcResult = { data: null, error: { message: 'function check_rate_limit does not exist' } }

    // The migration and this code are separate gate decisions, so this runs
    // before the function exists. A limiter outage must not take search down.
    await expect(
      checkRateLimit({ bucket: 'search', identifier: 'x', limit: 60 })
    ).resolves.toBe(true)
  })

  it('fails open when the call throws', async () => {
    h.rpcThrows = true
    await expect(
      checkRateLimit({ bucket: 'search', identifier: 'x', limit: 60 })
    ).resolves.toBe(true)
  })

  it('fails open when the service-role key is missing', async () => {
    h.clientThrows = true
    await expect(
      checkRateLimit({ bucket: 'search', identifier: 'x', limit: 60 })
    ).resolves.toBe(true)
  })

  it('fails open on a null answer rather than treating it as a deny', async () => {
    h.rpcResult = { data: null, error: null }

    // Only an explicit false is a verdict. Anything else is an outage, and this
    // limiter is deliberately the opposite of lib/security/file-signature.ts,
    // which fails closed because it guards what enters the system.
    await expect(
      checkRateLimit({ bucket: 'search', identifier: 'x', limit: 60 })
    ).resolves.toBe(true)
  })
})

describe('getClientIp', () => {
  it('takes the first entry of x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' })
    // The first entry is the original client; the rest are proxies. Reading the
    // last would give every client behind one proxy a single shared budget.
    expect(getClientIp(headers)).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip', () => {
    expect(getClientIp(new Headers({ 'x-real-ip': '198.51.100.42' }))).toBe('198.51.100.42')
  })

  it('falls back to a constant when no proxy header is present', () => {
    // Everything unattributable shares one budget rather than each request
    // getting a fresh one.
    expect(getClientIp(new Headers())).toBe('unknown')
  })

  it('ignores an empty x-forwarded-for and uses x-real-ip', () => {
    const headers = new Headers({ 'x-forwarded-for': '', 'x-real-ip': '198.51.100.42' })
    expect(getClientIp(headers)).toBe('198.51.100.42')
  })
})
