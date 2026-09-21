import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

import { SUBSCRIBE_RATE_LIMIT_SALT } from '@/lib/env'
import { createServiceClient } from '@/lib/supabase/server'

// =============================================================================
// Durable rate limiting
// =============================================================================
// Replaces the in-memory `Map`s that app/api/search/route.ts and
// app/api/analytics/event/route.ts used to keep. On Fluid Compute an instance is
// reused across concurrent requests but is still replaced, and concurrent
// instances do not share memory — so a Map-based limiter is effectively
// decorative under real traffic. The counter lives in Postgres instead
// (supabase/migrations/20260816000000_rate_limit_counters.sql).
//
// One round trip per call. check_rate_limit() charges the hit and answers in a
// single atomic statement, so this does not read-then-write and cannot
// undercount during a burst.
// =============================================================================

// `rate_limit_counters.bucket` is plain text with no CHECK, so adding a bucket
// is a TypeScript change only; the ledger needs no migration.
export type RateLimitBucket = 'search' | 'analytics_event' | 'problem_report'

const DEFAULT_WINDOW_SECONDS = 60

// check_rate_limit is not in the generated Database types. Same approach as
// lib/listings/facets.ts:145 — narrow the call rather than regenerate types.
type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>

/**
 * Turns a caller identifier into the opaque digest the ledger stores.
 *
 * The raw value never leaves this function and is never stored or logged
 * (.claude/rules/data-privacy.md). User ids are hashed the same way as IPs even
 * though we already hold them elsewhere: it keeps the ledger free of any
 * identifier at all, so the table is worthless on its own, and it removes any
 * chance of a raw user id colliding with a raw IP string in the same key space.
 *
 * Reuses SUBSCRIBE_RATE_LIMIT_SALT rather than introducing a second salt env
 * var. That variable is already set in every environment, and an unset salt
 * would silently degrade these digests to plain sha256 of an IP — brute-forceable
 * across the whole IPv4 space. Sharing a known-good salt is safer here than
 * adding a new one that could be missing.
 */
export function hashRateLimitKey(identifier: string): string {
  return createHash('sha256').update(`${SUBSCRIBE_RATE_LIMIT_SALT}${identifier}`).digest('hex')
}

/**
 * Resolves the client IP from proxy headers.
 *
 * Same resolution order as lib/actions/subscribers/subscribeLaunch.ts:23-27.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for') ?? ''
  return (forwarded.split(',')[0] ?? '').trim() || headers.get('x-real-ip') || 'unknown'
}

/**
 * Charges one hit against `identifier` in `bucket`. Returns true when the
 * request is allowed, false when it is over the limit.
 *
 * FAILS OPEN. If the ledger is unreachable — the migration has not been applied
 * yet, the service-role key is missing, Postgres is down — this returns true and
 * the route serves the request unlimited. That is deliberate and it is the
 * opposite of lib/security/file-signature.ts, which fails closed:
 *
 *   * file-signature guards what enters the system. Letting an unverified upload
 *     through on error would be a security failure, so it must fail closed.
 *   * this guards how *often* a public endpoint may be called. Failing closed
 *     would turn any limiter hiccup into a total outage of public search — a
 *     limiter must never be more dangerous than the abuse it prevents.
 *
 * It also makes the two halves of this change independent: the migration
 * (GATE-DATA) and this code (GATE-DEPLOY) are separate decisions, so there is a
 * real window in which the table does not exist. Same reasoning as
 * subscribeLaunch.ts:52-55.
 */
export async function checkRateLimit(opts: {
  bucket: RateLimitBucket
  identifier: string
  limit: number
  windowSeconds?: number
}): Promise<boolean> {
  const { bucket, identifier, limit, windowSeconds = DEFAULT_WINDOW_SECONDS } = opts

  try {
    const supabase: SupabaseClient = createServiceClient()
    const { data, error } = await (supabase.rpc as unknown as RpcFn)('check_rate_limit', {
      p_bucket: bucket,
      p_key_hash: hashRateLimitKey(identifier),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })

    if (error) return true
    // Only an explicit false denies. A null/undefined answer means the ledger
    // told us nothing useful, which is an outage, not a verdict.
    return data !== false
  } catch {
    // createServiceClient() throws when SUPABASE_SERVICE_ROLE_KEY is unset.
    return true
  }
}
