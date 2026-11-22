import 'server-only'

import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import type { createClient } from '@/lib/supabase/server'
import { getAdminRole } from '@/lib/admin/guard'
import { countReceiptsToVerify } from '@/lib/dashboard/receiptsToVerify'
import { isCovered } from '@/lib/features/covered'
import { isFeatureEnabled } from '@/lib/env'
import { getUnreadMessageCount } from '@/lib/messaging/loaders'
import {
  PAGE_COOKIE,
  type ShellCounts,
  type ShellFlags,
  type ShellPage,
} from '@/lib/account/shellNav'

type Client = Awaited<ReturnType<typeof createClient>>

export interface ShellData {
  displayName: string
  memberSince: string
  pages: ShellPage[]
  /** The page last chosen in the switcher, if any (validated on the client). */
  cookiePageId: string | null
  isOwner: boolean
  isAdmin: boolean
  counts: ShellCounts
  flags: ShellFlags
}

/**
 * Everything the signed-in menu needs, in one round of parallel reads. Used by
 * both the /account and /dashboard layouts so the menu is the same on both.
 */
export async function loadShellData(supabase: Client, user: User): Promise<ShellData> {
  const displayName =
    (user.user_metadata?.display_name as string | undefined) ?? user.email?.split('@')[0] ?? 'there'
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : ''

  const messagingOn = isFeatureEnabled('messaging')
  const ownerReceipts = isFeatureEnabled('ownerReceiptReview')
  const countOf = (table: 'saves' | 'reviews' | 'claims' | 'receipt_uploads', column: string) =>
    supabase.from(table).select('id', { count: 'exact', head: true }).eq(column, user.id)

  const [saved, reviews, claims, claimsPending, receipts, owned, adminRole, messagesUnread, jar] =
    await Promise.all([
      countOf('saves', 'user_id'),
      countOf('reviews', 'reviewer_user_id'),
      countOf('claims', 'claimant_user_id'),
      supabase
        .from('claims')
        .select('id', { count: 'exact', head: true })
        .eq('claimant_user_id', user.id)
        .eq('status', 'pending'),
      countOf('receipt_uploads', 'user_id'),
      supabase
        .from('listings')
        .select('id, name, tier')
        .eq('owner_user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      getAdminRole(user.id),
      messagingOn ? getUnreadMessageCount(supabase) : Promise.resolve(undefined),
      cookies(),
    ])

  const pages: ShellPage[] = (owned.data ?? []).map((l) => ({
    id: l.id as string,
    name: (l.name as string | null) ?? 'Your Page',
    tier: (l.tier as string | null) ?? null,
  }))
  // A failed read counts as owning: a link that bounces beats hiding a real
  // owner's tools (same rule the dashboard layout had).
  const isOwner = pages.length > 0 || Boolean(owned.error)

  const receiptsToVerify =
    ownerReceipts && pages.length > 0
      ? await countReceiptsToVerify(
          user.id,
          pages.map((p) => p.id)
        )
      : 0

  return {
    displayName,
    memberSince,
    pages,
    cookiePageId: jar.get(PAGE_COOKIE)?.value ?? null,
    isOwner,
    isAdmin: adminRole !== null,
    counts: {
      saved: saved.count ?? 0,
      reviews: reviews.count ?? 0,
      claims: claims.count ?? 0,
      claimsPending: claimsPending.count ?? 0,
      receipts: receipts.count ?? 0,
      messagesUnread,
      receiptsToVerify,
    },
    flags: {
      ownerReceipts,
      posts: isFeatureEnabled('happeningNow'),
      bookings: isFeatureEnabled('bookingRequests'),
      collectiveSoon: isCovered('collective'),
    },
  }
}
