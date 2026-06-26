'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'

export type DeleteListingFaqState = { success: true } | { error: string } | null

export async function deleteListingFaqAction(
  _prev: DeleteListingFaqState,
  formData: FormData
): Promise<DeleteListingFaqState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to delete a question.' }

  const faqId = formData.get('faq_id')?.toString().trim() ?? ''
  if (!faqId) return { error: 'Missing question ID.' }

  const supabase = await createClient()
  // listing_faqs is not in the generated types yet — use the untyped client.
  const sb = supabase as unknown as SupabaseClient
  const { data: faq } = await sb
    .from('listing_faqs')
    .select('id, listing_id')
    .eq('id', faqId)
    .maybeSingle()

  const listingId = (faq as { listing_id: string } | null)?.listing_id
  if (!listingId) return { error: 'Question not found.' }

  // Verify ownership against the listings table (RLS also enforces this).
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'You do not have permission to delete this question.' }

  const { error } = await sb.from('listing_faqs').delete().eq('id', faqId)
  if (error) return { error: 'Failed to delete the question. Please try again.' }

  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug) revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
  revalidatePath(`/dashboard/pages/${listing.id}/edit`)

  return { success: true }
}
