import 'server-only'

import { createServiceClient } from '@/lib/supabase/server'

// One source for "how many things are waiting on an admin". The overview page
// and the admin layout (sidebar pills) both read this, so the number on the
// stat card and the number next to the nav item can never disagree.
//
// Added after the founder walked the tester path with their own test business
// sitting in the queue and saw nothing on the dashboard or the side menu that
// said so (2026-09-19). The count existed; it was one figure among five on the
// overview and absent from every other admin page.
//
// Each query is a `head: true` count: no rows travel, only the number.

export interface PendingCounts {
  /** Listings of any entity type awaiting first review (`listings.status = 'pending'`). */
  entities: number
  /** Ownership claims not yet decided. */
  claims: number
  /** Verification requests in the moderation queue. */
  verifications: number
  /** Corrections, review flags and flagged listings in the moderation queue. */
  reports: number
  /** Receipts awaiting approval (`receipt_uploads.status = 'pending_review'`). */
  receipts: number
  /** Reviews written by the community and not yet moderated (`reviews.status = 'intake'`). */
  reviews: number
}

export async function getPendingCounts(): Promise<PendingCounts> {
  const serviceClient = createServiceClient()

  const [entities, claims, verifications, reports, receipts, reviews] = await Promise.all([
    serviceClient
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      // /admin/entities filters soft-deleted rows out of its queue; the count
      // has to match what the founder sees when they click through.
      .is('deleted_at', null),
    serviceClient
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'under_review']),
    serviceClient
      .from('moderation_queue')
      .select('id', { count: 'exact', head: true })
      .eq('queue_type', 'verification')
      .eq('status', 'pending'),
    serviceClient
      .from('moderation_queue')
      .select('id', { count: 'exact', head: true })
      .in('queue_type', ['correction', 'review', 'flagged_listing'])
      .eq('status', 'pending'),
    // Receipts never enter moderation_queue and their pending value is
    // `pending_review`, the one /admin/receipts filters its default tab on.
    serviceClient
      .from('receipt_uploads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review'),
    // /admin/reviews calls `intake` "Pending" in its tabs.
    serviceClient
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'intake'),
  ])

  return {
    entities: entities.count ?? 0,
    claims: claims.count ?? 0,
    verifications: verifications.count ?? 0,
    reports: reports.count ?? 0,
    receipts: receipts.count ?? 0,
    reviews: reviews.count ?? 0,
  }
}

/**
 * The counts keyed by the sidebar href they belong next to. Kept here rather
 * than in the sidebar so the client component knows nothing about tables, and
 * so a renamed route fails typecheck in one place.
 */
export function toSidebarCounts(counts: PendingCounts): Record<string, number> {
  return {
    '/admin/entities': counts.entities,
    '/admin/claims': counts.claims,
    '/admin/verification': counts.verifications,
    '/admin/reviews': counts.reviews,
    '/admin/reports': counts.reports,
    '/admin/receipts': counts.receipts,
  }
}
