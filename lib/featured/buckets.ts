/**
 * Who competes with whom for the weekly Featured badge (ticket 123).
 *
 * [Decision — founder, 2026-10-05] Featured is earned, never bought: each week
 * it goes to the one listing per listing type with the most positive activity.
 *
 * Every listing lands in exactly ONE bucket, the most specific that fits:
 *
 *   1. its own `entity_type`, when that isn't the generic `business`
 *      (a real `restaurant`, `vendor` or `event` row);
 *   2. otherwise Restaurant, Professional, Creative or Creator, by category, using the
 *      same mapping as the discover Type chips (lib/listings/type-shortcuts.ts);
 *   3. otherwise Services, by location type, same source;
 *   4. otherwise Business.
 *
 * Every imported listing is `entity_type='business'`, so without steps 2 and 3
 * nearly everything would compete in one bucket.
 *
 * The SQL function `award_weekly_featured` takes the rules built here as an
 * argument rather than keeping its own copy, the same pattern as the discover
 * RPCs. `resolveBucket` is the in-memory twin of that SQL, for the tests.
 *
 * Pure and client-safe.
 */

import {
  expandTypeCategoryIds,
  typeLocationTypes,
  type CategoryNode,
  type TypeMatchable,
} from '@/lib/listings/type-shortcuts'
import type { EntityType } from '@/types'

export type FeaturedBucket = EntityType

/** Checked in this order after a listing's own entity_type. */
const MAPPED_ORDER = ['restaurant', 'professional', 'creative', 'creator', 'service_provider'] as const

/** What the badge line calls each bucket: "among Restaurants this week". */
export const BUCKET_LABELS: Record<FeaturedBucket, string> = {
  business: 'Businesses',
  restaurant: 'Restaurants',
  service_provider: 'Services',
  vendor: 'Vendors',
  professional: 'Professionals',
  creative: 'Creatives',
  event: 'Events',
  job: 'Jobs',
  creator: 'Creators',
}

export function bucketLabel(bucket: string): string {
  return BUCKET_LABELS[bucket as FeaturedBucket] ?? 'Businesses'
}

/** One rule as the SQL function receives it, inside `p_buckets`. */
export interface BucketRule {
  bucket: FeaturedBucket
  category_ids: string[]
  location_types: string[]
}

/** The ordered rules for steps 2 and 3, resolved against the live category tree. */
export function buildBucketRules(categories: readonly CategoryNode[]): BucketRule[] {
  return MAPPED_ORDER.map((bucket) => ({
    bucket,
    category_ids: expandTypeCategoryIds(bucket, categories),
    location_types: [...typeLocationTypes(bucket)],
  })).filter((r) => r.category_ids.length > 0 || r.location_types.length > 0)
}

/**
 * The bucket a listing competes in, or null when its type sits out (Jobs, while
 * Jobs is covered). Mirrors the `bucketed` CTE in award_weekly_featured.
 */
export function resolveBucket(
  listing: TypeMatchable,
  rules: readonly BucketRule[],
  excludedTypes: readonly string[] = []
): FeaturedBucket | null {
  if (excludedTypes.includes(listing.entity_type)) return null
  if (listing.entity_type !== 'business') return listing.entity_type as FeaturedBucket
  for (const rule of rules) {
    if (listing.category_id && rule.category_ids.includes(listing.category_id)) return rule.bucket
    if (listing.location_type && rule.location_types.includes(listing.location_type)) {
      return rule.bucket
    }
  }
  return 'business'
}

const EASTERN = 'America/New_York'

/**
 * The Monday (YYYY-MM-DD, Eastern) that starts the last FULL Monday-to-Sunday
 * week before `now`. On a Monday morning that is the Monday a week earlier.
 */
export function lastFullWeekStart(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const sinceMonday = weekdays.indexOf(get('weekday'))
  // Date arithmetic on the Eastern calendar date, done in UTC so no local
  // timezone or DST shift can move it.
  const today = Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')))
  const start = new Date(today - (sinceMonday + 7) * 86_400_000)
  return start.toISOString().slice(0, 10)
}
