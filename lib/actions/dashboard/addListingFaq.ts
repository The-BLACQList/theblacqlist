'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'

export type AddListingFaqState = { success: true } | { error: string } | null

export async function addListingFaqAction(
  _prev: AddListingFaqState,
  formData: FormData
): Promise<AddListingFaqState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to add a question.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const question = formData.get('question')?.toString().trim() ?? ''
  const answer = formData.get('answer')?.toString().trim() ?? ''

  if (!listingId) return { error: 'Missing listing ID.' }
  if (!question) return { error: 'A question is required.' }
  if (question.length > 300) return { error: 'Keep the question under 300 characters.' }
  if (!answer) return { error: 'An answer is required.' }
  if (answer.length > 2000) return { error: 'Keep the answer under 2000 characters.' }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found or you do not have permission to edit it.' }

  // listing_faqs is not in the generated types yet — use the untyped client.
  const sb = supabase as unknown as SupabaseClient
  const { data: lastFaq } = await sb
    .from('listing_faqs')
    .select('display_order')
    .eq('listing_id', listingId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const displayOrder = ((lastFaq as { display_order: number } | null)?.display_order ?? -1) + 1

  const { error } = await sb.from('listing_faqs').insert({
    listing_id: listingId,
    question,
    answer,
    display_order: displayOrder,
  })

  if (error) return { error: 'Failed to add the question. Please try again.' }

  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug) revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
  revalidatePath(`/dashboard/pages/${listingId}/edit`)

  return { success: true }
}
