'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'

export type UpdateListingStatusState =
  | { success: true; status: 'published' | 'draft' }
  | { error: string }
  | null

export async function updateListingStatusAction(
  _prev: UpdateListingStatusState,
  formData: FormData
): Promise<UpdateListingStatusState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to manage this listing.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const action = formData.get('action')?.toString().trim()

  if (!listingId) return { error: 'Missing listing ID.' }
  if (action !== 'publish' && action !== 'unpublish') return { error: 'Invalid action.' }

  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('id, status, trust_tier, slug, entity_type, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found.' }

  const city = listing.cities as { slug: string } | null

  if (action === 'unpublish') {
    if (listing.status !== 'published') {
      return { error: 'Only published listings can be unpublished.' }
    }

    const { error } = await supabase
      .from('listings')
      .update({ status: 'draft' })
      .eq('id', listingId)
      .eq('owner_user_id', owner.user.id)

    if (error) return { error: 'Failed to unpublish. Please try again.' }

    revalidatePath(buildEntityUrl(listing.entity_type, city?.slug, listing.slug))
    return { success: true, status: 'draft' }
  }

  // action === 'publish'
  if (listing.status !== 'draft') {
    return { error: 'Only draft listings can be published.' }
  }
  if (listing.trust_tier === 'unclaimed') {
    return { error: 'This listing must be reviewed before it can be published.' }
  }

  const { error } = await supabase
    .from('listings')
    .update({ status: 'published' })
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)

  if (error) return { error: 'Failed to publish. Please try again.' }

  revalidatePath(buildEntityUrl(listing.entity_type, city?.slug, listing.slug))
  return { success: true, status: 'published' }
}
