/**
 * The owner's writing-help allowance, for the strip at the top of Edit content
 * (ticket 138).
 *
 * This is a read for display only. `generate()` still enforces both limits on
 * every request, so a stale strip can never let a request through that the
 * limiter would refuse. The counts come from the same table and the same rules
 * as the limiter:
 *
 * - **Monthly:** completed paid generations in the last 30 days, against
 *   `aiQuota(tier)`. Mock rows cost nothing and do not count, so in mock mode the
 *   strip always shows the full allowance.
 * - **Daily:** every attempt in the last 24 hours, against
 *   `RATE_LIMIT_PER_LISTING_24H`. The page shows this only when it is hit.
 *
 * Both reads fail closed, like the limiter: an unreadable counter shows the
 * allowance as used up rather than inviting a request that would be refused.
 */

import { isFeatureEnabled } from '@/lib/env'
import { aiQuota, canAccess } from '@/lib/stripe/features'
import { createServiceClient } from '@/lib/supabase/server'
import { countRecentRequests, RATE_LIMIT_PER_LISTING_24H } from './provider'
import type { WritingAllowance } from './writingHelp'

export type { WritingAllowance }

const WINDOW_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

/** The arithmetic, kept pure so it can be tested without a database. */
export function allowanceFrom(input: {
  quota: number | null
  used: number
  oldestCountedAt: string | null
  dailyUsed: number
}): Extract<WritingAllowance, { state: 'ready' }> {
  const { quota, used, oldestCountedAt, dailyUsed } = input
  const dailyHit = dailyUsed >= RATE_LIMIT_PER_LISTING_24H
  const perDay = RATE_LIMIT_PER_LISTING_24H
  if (quota === null) {
    return { state: 'ready', limit: null, left: null, resetsOn: null, perDay, dailyHit }
  }

  const left = Number.isFinite(used) ? Math.max(0, quota - used) : 0
  const resetsOn =
    left === 0 && oldestCountedAt
      ? new Date(new Date(oldestCountedAt).getTime() + WINDOW_DAYS * DAY_MS).toISOString()
      : null
  return { state: 'ready', limit: quota, left, resetsOn, perDay, dailyHit }
}

/** Completed paid drafts in the window, plus the oldest one's timestamp. */
async function readMonthlyUse(
  listingId: string
): Promise<{ used: number; oldestCountedAt: string | null }> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS).toISOString()
  const { data, count, error } = await supabase
    .from('ai_generation_requests')
    .select('created_at', { count: 'exact' })
    .eq('listing_id', listingId)
    .eq('status', 'completed')
    .eq('provider', 'anthropic')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(1)

  if (error || count === null) return { used: Number.POSITIVE_INFINITY, oldestCountedAt: null }
  return { used: count, oldestCountedAt: data?.[0]?.created_at ?? null }
}

export async function getWritingAllowance(
  listingId: string,
  tier: string | null
): Promise<WritingAllowance> {
  if (!isFeatureEnabled('aiBeta')) return { state: 'off' }
  if (!canAccess(tier, 'ai_suggestions')) return { state: 'locked' }

  const quota = aiQuota(tier)
  const [monthly, dailyUsed] = await Promise.all([
    quota === null ? Promise.resolve({ used: 0, oldestCountedAt: null }) : readMonthlyUse(listingId),
    countRecentRequests(listingId),
  ])
  return allowanceFrom({ quota, used: monthly.used, oldestCountedAt: monthly.oldestCountedAt, dailyUsed })
}
