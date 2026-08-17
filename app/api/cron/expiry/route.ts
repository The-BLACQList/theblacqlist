import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

import { isFeatureEnabled } from '@/lib/env'
import { expireStaleSuggestions, unpublishExpiredJobPostings } from '@/lib/services/expiry/sweeps'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * =============================================================================
 * Daily expiry cron — the scheduled half of two time-based rules
 * =============================================================================
 *
 * The rules themselves live in `lib/services/expiry/sweeps.ts`, which is where
 * the tests are. This file is auth and plumbing on purpose.
 *
 * ── Auth fails closed ───────────────────────────────────────────────────────
 * This endpoint runs on the service role and unpublishes listings. An unset
 * `CRON_SECRET` therefore means "refuse", never "allow" — the same posture as
 * `jobPostingPriceId()` returning null and `isFeatureEnabled()` defaulting off
 * in production. A misconfigured deploy leaves the sweeps un-run, which is the
 * state the product has been in all along and is safe; the alternative is a
 * public URL that can unpublish jobs.
 *
 * 503 rather than 401 for the unset case, because those are different problems:
 * one is a caller without the secret, the other is a deploy missing an env var.
 * Collapsing them would make the second invisible in the cron logs.
 *
 * ── Why both sweeps run even if one fails ───────────────────────────────────
 * They share nothing. Letting a failing suggestion sweep silently cancel the
 * job sweep would hide a listing staying published past its paid window behind
 * an unrelated error. Each is caught separately, both always attempted, and the
 * response is a 500 if either failed so the run shows up red rather than
 * reporting a partial success as success.
 * =============================================================================
 */

export const dynamic = 'force-dynamic'

/** Constant-time compare that does not throw on a length mismatch. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET?.trim()

  if (!expected) {
    console.error('[cron/expiry] CRON_SECRET is not set — refusing to run.')
    return NextResponse.json(
      { error: 'Cron is not configured.', code: 'CRON_NOT_CONFIGURED' },
      { status: 503 }
    )
  }

  const provided = request.headers.get('authorization')
  if (!provided || !secretMatches(provided, `Bearer ${expected}`)) {
    return NextResponse.json({ error: 'Unauthorized.', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()
  const results: Record<string, unknown> = {}
  const failures: string[] = []

  try {
    results.suggestions = await expireStaleSuggestions(supabase, now)
  } catch (err) {
    failures.push('suggestions')
    results.suggestions = { error: err instanceof Error ? err.message : 'unknown error' }
    console.error('[cron/expiry] suggestion sweep failed:', err)
  }

  // Gated because `job_posting_purchases` does not exist in the database until
  // the E-2 migration is applied — querying it before then would fail every run.
  // Nothing is lost by waiting: no posting can expire until 30 days after the
  // first one is bought, and the flag has to be on for one to be bought at all.
  if (isFeatureEnabled('paidPostings')) {
    try {
      results.jobPostings = await unpublishExpiredJobPostings(supabase, now)
    } catch (err) {
      failures.push('jobPostings')
      results.jobPostings = { error: err instanceof Error ? err.message : 'unknown error' }
      console.error('[cron/expiry] job posting sweep failed:', err)
    }
  } else {
    results.jobPostings = { skipped: 'paidPostings feature flag is off' }
  }

  return NextResponse.json(
    { ranAt: now.toISOString(), ...results },
    { status: failures.length > 0 ? 500 : 200 }
  )
}
