/**
 * The weekly Featured run (ticket 123).
 *
 * [Decision — founder, 2026-10-05] Featured is earned, never bought: each week
 * it goes to the one listing per listing type with the most positive activity.
 *
 * The scoring, the flag writes and the award rows all happen inside one SQL
 * call, `award_weekly_featured` (migration 20261005000000), so they can never
 * disagree. This file only works out which week to score and which listings
 * compete with which, then reports what changed.
 *
 * Server only: it needs the service-role client, the only role allowed to call
 * the function.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { buildBucketRules, lastFullWeekStart } from '@/lib/featured/buckets'
import type { CategoryNode } from '@/lib/listings/type-shortcuts'

/** Jobs sit out while the Jobs board is covered (ticket 122). */
export const FEATURED_EXCLUDED_TYPES = ['job'] as const

interface AwardRow {
  listing_id: string
  bucket: string | null
  score: number | string | null
  featured: boolean
}

export interface FeaturedRunSummary {
  weekStart: string
  winners: { listingId: string; bucket: string; score: number }[]
  cleared: string[]
}

export async function awardWeeklyFeatured(
  supabase: SupabaseClient,
  now: Date
): Promise<FeaturedRunSummary> {
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, slug, parent_id')
  if (catError) throw new Error(`Could not load categories: ${catError.message}`)

  const weekStart = lastFullWeekStart(now)
  const { data, error } = await supabase.rpc('award_weekly_featured', {
    p_week_start: weekStart,
    p_buckets: buildBucketRules((categories ?? []) as CategoryNode[]),
    p_excluded_types: [...FEATURED_EXCLUDED_TYPES],
  })
  if (error) throw new Error(`award_weekly_featured failed: ${error.message}`)

  const rows = (data ?? []) as AwardRow[]
  return {
    weekStart,
    winners: rows
      .filter((r) => r.featured && r.bucket)
      .map((r) => ({ listingId: r.listing_id, bucket: r.bucket as string, score: Number(r.score) })),
    cleared: rows.filter((r) => !r.featured).map((r) => r.listing_id),
  }
}
