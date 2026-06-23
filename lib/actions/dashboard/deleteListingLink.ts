'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'

export type DeleteListingLinkState = { success: true } | { error: string } | null

export async function deleteListingLinkAction(
  _prev: DeleteListingLinkState,
  formData: FormData
): Promise<DeleteListingLinkState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to delete a link.' }

  const linkId = formData.get('link_id')?.toString().trim() ?? ''
  if (!linkId) return { error: 'Missing link ID.' }

  const supabase = await createClient()
  const { data: link } = await supabase
    .from('listing_links')
    .select('id, listing_id, listings(id, slug, status, entity_type, owner_user_id, cities(slug))')
    .eq('id', linkId)
    .maybeSingle()

  if (!link) return { error: 'Link not found.' }

  const listing = link.listings as {
    id: string
    slug: string
    status: string
    entity_type: string
    owner_user_id: string | null
    cities: { slug: string } | null
  } | null

  if (!listing || listing.owner_user_id !== owner.user.id) {
    return { error: 'You do not have permission to delete this link.' }
  }

  const { error } = await supabase.from('listing_links').delete().eq('id', linkId)
  if (error) return { error: 'Failed to delete the link. Please try again.' }

  if (listing.status === 'published' && listing.cities?.slug && listing.slug) {
    revalidatePath(buildEntityUrl(listing.entity_type, listing.cities.slug, listing.slug))
  }
  revalidatePath(`/dashboard/pages/${listing.id}/edit`)

  return { success: true }
}
