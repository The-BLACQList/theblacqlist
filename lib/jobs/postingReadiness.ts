import type { SupabaseClient } from '@supabase/supabase-js'

// Ticket 156: where a signed-in user stands on "you can post a job once you own
// a live page". Read by /add-job and the dashboard Post a job card so both show
// the same step. Who may post is unchanged: an owned, published business page.

type AnyClient = SupabaseClient | { from: SupabaseClient['from'] }

export type PostingReadiness =
  | { state: 'none' }
  | { state: 'draft'; pageId: string; pageName: string }
  | { state: 'review'; name: string }
  | { state: 'live' }

export interface OwnedPageRow {
  id: string
  name: string
  status: string
  entity_type: string
}

export interface OpenClaimRow {
  listings: { name: string } | { name: string }[] | null
}

const isBusiness = (p: OwnedPageRow) => p.entity_type !== 'event' && p.entity_type !== 'job'

/** live wins, then review (a pending page or an open claim), then draft. */
export function resolvePostingReadiness(
  pages: OwnedPageRow[],
  openClaims: OpenClaimRow[]
): PostingReadiness {
  const business = pages.filter(isBusiness)
  if (business.some((p) => p.status === 'published')) return { state: 'live' }

  const pending = business.find((p) => p.status === 'pending')
  if (pending) return { state: 'review', name: pending.name }

  const claim = openClaims[0]
  if (claim) {
    const listing = Array.isArray(claim.listings) ? claim.listings[0] : claim.listings
    return { state: 'review', name: listing?.name ?? 'Your claim' }
  }

  const draft = business.find((p) => p.status === 'draft')
  if (draft) return { state: 'draft', pageId: draft.id, pageName: draft.name }

  return { state: 'none' }
}

/** A failed claims read counts as no claim, so the owned-page state still shows. */
export async function loadOpenClaims(supabase: AnyClient, userId: string): Promise<OpenClaimRow[]> {
  const { data, error } = await supabase
    .from('claims')
    .select('listings!claims_listing_id_fkey(name)')
    .eq('claimant_user_id', userId)
    .in('status', ['pending', 'under_review'])
    .order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as unknown as OpenClaimRow[]
}
