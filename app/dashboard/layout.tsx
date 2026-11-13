import { redirect } from 'next/navigation'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { createClient } from '@/lib/supabase/server'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { isFeatureEnabled } from '@/lib/env'
import { countReceiptsToVerify, ownedListingIds } from '@/lib/dashboard/receiptsToVerify'
import { getUnreadMessageCount } from '@/lib/messaging/loaders'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Auth-only gate — a signed-in user with zero listings reaches the dashboard and
  // sees an empty state rather than being bounced to /account. Per-listing routes
  // still enforce ownership via requireOwner().
  const owner = await getOwnerSession()
  if (!owner) redirect('/sign-in?next=/dashboard')

  // Same filter as requireOwner(). A failed read counts as having listings:
  // a link that bounces beats hiding a real owner's tools.
  const supabase = await createClient()
  const [{ count, error }, messagesUnread] = await Promise.all([
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('owner_user_id', owner.user.id)
      .is('deleted_at', null),
    isFeatureEnabled('messaging') ? getUnreadMessageCount(supabase) : Promise.resolve(undefined),
  ])
  const hasListings = Boolean(error) || (count ?? 0) > 0

  // Receipts waiting for this owner to verify (ticket 183), for the nav badge.
  // Off, the nav item is hidden (ownerReceiptReview, closed by default).
  const ownerReview = isFeatureEnabled('ownerReceiptReview')
  const listingIds = ownerReview && hasListings ? await ownedListingIds(owner.user.id) : []
  const receiptsToVerify = listingIds
    ? await countReceiptsToVerify(owner.user.id, listingIds)
    : 0

  return (
    <div className="flex min-h-screen flex-col bg-pale-lavender md:flex-row">
      <DashboardSidebar
        ownerEmail={owner.user.email}
        hasListings={hasListings}
        receiptsToVerify={receiptsToVerify}
        showReceipts={ownerReview}
        messagesUnread={messagesUnread}
      />
      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  )
}
