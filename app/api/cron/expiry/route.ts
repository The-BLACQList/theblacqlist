import { NextRequest, NextResponse } from 'next/server'

import { refuseUnauthorizedCron } from '@/lib/cron/auth'
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
 * ── Auth ────────────────────────────────────────────────────────────────────
 * The CRON_SECRET check is shared with the other cron routes and fails closed.
 * See `lib/cron/auth.ts`.
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const refused = refuseUnauthorizedCron(request, 'expiry')
  if (refused) return refused

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
