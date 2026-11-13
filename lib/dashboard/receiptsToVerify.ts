// =============================================================================
// Receipts waiting for a business owner to verify (ticket 183)
// =============================================================================
// receipt_uploads RLS only lets the shopper read their own rows, so these
// reads use the service client. They are always scoped to listing ids the
// owner's own client returned, and never include the owner's own uploads
// (an owner can't verify their own spend; admins do).
//
// What an owner sees, per the founder's decision: the receipt photo (on
// click, via the signed-URL route), amount, purchase date, which page, and
// the buyer's first name and last initial. Never the buyer's notes, email or
// full name.
// =============================================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { maskBuyerName } from '@/lib/spend/owner-receipts'

/** Ids of the owner's live listings, read through their own client. */
export async function ownedListingIds(ownerId: string): Promise<string[] | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('listings')
    .select('id')
    .eq('owner_user_id', ownerId)
    .is('deleted_at', null)
  if (error) return null
  return (data ?? []).map((l) => l.id)
}

/** How many receipts wait for this owner. 0 on a failed read: a badge is a nicety. */
export async function countReceiptsToVerify(
  ownerId: string,
  listingIds: string[]
): Promise<number> {
  if (listingIds.length === 0) return 0
  const { count, error } = await createServiceClient()
    .from('receipt_uploads')
    .select('id', { count: 'exact', head: true })
    .in('listing_id', listingIds)
    .eq('status', 'pending_review')
    .neq('user_id', ownerId)
  return error ? 0 : (count ?? 0)
}

export interface ReceiptToVerify {
  id: string
  buyer: string
  amountCents: number
  purchaseDate: string
  submittedAt: string
  listingName: string
  hasFile: boolean
  filePath: string | null
}

export async function listReceiptsToVerify(
  ownerId: string,
  listingIds: string[]
): Promise<ReceiptToVerify[] | null> {
  if (listingIds.length === 0) return []
  const service = createServiceClient()
  const { data, error } = await service
    .from('receipt_uploads')
    .select('id, user_id, amount_cents, purchase_date, created_at, file_path, listings(name)')
    .in('listing_id', listingIds)
    .eq('status', 'pending_review')
    .neq('user_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return null

  const rows = data ?? []
  const userIds = [...new Set(rows.map((r) => r.user_id))]
  const names = new Map<string, string | null>()
  if (userIds.length > 0) {
    const { data: profiles } = await service
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds)
    for (const p of profiles ?? []) names.set(p.id, p.display_name)
  }

  return rows.map((r) => {
    const listing = r.listings as { name: string } | null
    return {
      id: r.id,
      buyer: maskBuyerName(names.get(r.user_id)),
      amountCents: r.amount_cents,
      purchaseDate: r.purchase_date,
      submittedAt: r.created_at,
      listingName: listing?.name ?? 'Your page',
      hasFile: !!r.file_path,
      filePath: r.file_path,
    }
  })
}
