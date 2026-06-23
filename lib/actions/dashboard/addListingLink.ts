'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'

export type AddListingLinkState = { success: true } | { error: string } | null

export const LINK_TYPES = [
  'website',
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'linkedin',
  'twitter',
  'booking',
  'menu',
  'order',
  'other',
] as const

export async function addListingLinkAction(
  _prev: AddListingLinkState,
  formData: FormData
): Promise<AddListingLinkState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to add a link.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const linkType = formData.get('link_type')?.toString().trim() ?? ''
  const url = formData.get('url')?.toString().trim() ?? ''
  const label = formData.get('label')?.toString().trim() || null

  if (!listingId) return { error: 'Missing listing ID.' }
  if (!(LINK_TYPES as readonly string[]).includes(linkType)) return { error: 'Choose a link type.' }
  if (!url) return { error: 'A URL is required.' }
  if (!/^https:\/\//i.test(url)) return { error: 'The URL must start with https://' }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found or you do not have permission to edit it.' }

  const { data: lastLink } = await supabase
    .from('listing_links')
    .select('display_order')
    .eq('listing_id', listingId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const displayOrder = (lastLink?.display_order ?? -1) + 1

  const { error } = await supabase.from('listing_links').insert({
    listing_id: listingId,
    link_type: linkType,
    url,
    label,
    display_order: displayOrder,
  })

  if (error) return { error: 'Failed to add the link. Please try again.' }

  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug) revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
  revalidatePath(`/dashboard/pages/${listingId}/edit`)

  return { success: true }
}
