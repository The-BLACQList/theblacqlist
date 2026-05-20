import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/flow-map/personal-impact
// Auth-gated. Returns the authenticated user's aggregated community spend impact.
// Source: receipt_uploads (the only table with user_id).
// spend_events has no user_id by design — personal attribution comes from receipts only.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required.', code: 'AUTH_REQUIRED' },
      { status: 401 }
    )
  }

  const serviceClient = createServiceClient()

  // All receipts for this user (approved + pending)
  const { data: receipts, error } = await serviceClient
    .from('receipt_uploads')
    .select('id, listing_id, amount_cents, status')
    .eq('user_id', user.id)
    .in('status', ['approved', 'pending_review'])

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load personal impact.', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }

  const userReceipts = receipts ?? []
  const approved = userReceipts.filter((r) => r.status === 'approved')
  const pending = userReceipts.filter((r) => r.status === 'pending_review')

  const totalAmountCents = approved.reduce((sum, r) => sum + r.amount_cents, 0)
  const uniqueBusinessIds = new Set(approved.map((r) => r.listing_id).filter(Boolean))
  const uniqueBusinesses = uniqueBusinessIds.size

  // Enrich with business names for top businesses list
  const topListingIds = approved.reduce<Record<string, number>>((acc, r) => {
    if (r.listing_id) acc[r.listing_id] = (acc[r.listing_id] ?? 0) + r.amount_cents
    return acc
  }, {})

  const sortedListingIds = Object.entries(topListingIds)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => id)

  let topBusinesses: {
    listing_id: string
    name: string
    slug: string
    amount_cents: number
    receipt_count: number
  }[] = []
  if (sortedListingIds.length > 0) {
    const { data: listings } = await serviceClient
      .from('listings')
      .select('id, name, slug')
      .in('id', sortedListingIds)

    const listingMap = Object.fromEntries(
      (listings ?? []).map((l) => [l.id, { name: l.name, slug: l.slug }])
    )

    topBusinesses = sortedListingIds.map((listingId) => ({
      listing_id: listingId,
      name: listingMap[listingId]?.name ?? 'Unknown Business',
      slug: listingMap[listingId]?.slug ?? '',
      amount_cents: topListingIds[listingId] ?? 0,
      receipt_count: approved.filter((r) => r.listing_id === listingId).length,
    }))
  }

  return NextResponse.json({
    data: {
      total_amount_cents: totalAmountCents,
      unique_businesses: uniqueBusinesses,
      approved_receipt_count: approved.length,
      pending_receipt_count: pending.length,
      top_businesses: topBusinesses,
    },
  })
}
