import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { refuseUnauthorizedCron } from '@/lib/cron/auth'
import { isFeatureEnabled } from '@/lib/env'
import { awardWeeklyFeatured } from '@/lib/featured/award'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * =============================================================================
 * Weekly Featured cron (ticket 123)
 * =============================================================================
 *
 * Monday morning, it awards Featured for the week that just ended: one listing
 * per listing type, by saves, good reviews, shares and contact taps. The rules
 * live in `lib/featured/award.ts` and the migration's SQL function. This file is
 * auth and plumbing on purpose.
 *
 * Gated by FEATURE_EARNED_FEATURED. Off, it changes nothing. The first run with
 * it on clears every flag that wasn't earned that week.
 *
 * Only `/` is cached (revalidate = 1800); listing and browse pages are dynamic
 * and pick the new flags up on their next request.
 * =============================================================================
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const refused = refuseUnauthorizedCron(request, 'featured')
  if (refused) return refused

  const now = new Date()
  if (!isFeatureEnabled('earnedFeatured')) {
    return NextResponse.json({ ranAt: now.toISOString(), skipped: 'earnedFeatured feature flag is off' })
  }

  try {
    // award_weekly_featured is not in the generated types yet.
    const supabase = createServiceClient() as unknown as SupabaseClient
    const summary = await awardWeeklyFeatured(supabase, now)
    revalidatePath('/')
    return NextResponse.json({ ranAt: now.toISOString(), ...summary })
  } catch (err) {
    console.error('[cron/featured] run failed:', err)
    return NextResponse.json(
      { ranAt: now.toISOString(), error: err instanceof Error ? err.message : 'unknown error' },
      { status: 500 }
    )
  }
}
