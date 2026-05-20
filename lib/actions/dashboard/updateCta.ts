'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { VALID_CTA_TYPES } from '@/lib/constants/listing'
import { buildEntityUrl } from '@/lib/listings/url'

export type UpdateCtaState = { success: true; savedAt: string } | { error: string } | null

export async function updateCtaAction(
  _prev: UpdateCtaState,
  formData: FormData
): Promise<UpdateCtaState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to edit this page.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const ctaType = formData.get('cta_type')?.toString().trim() ?? ''
  const ctaUrl = formData.get('cta_url')?.toString().trim() || null
  const ctaLabelOverride = formData.get('cta_label_override')?.toString().trim() || null

  if (!listingId) return { error: 'Missing listing ID.' }
  if (!ctaType) return { error: 'CTA type is required.' }
  if (!(VALID_CTA_TYPES as readonly string[]).includes(ctaType)) {
    return { error: 'Invalid CTA type.' }
  }
  if (ctaType !== 'call' && !ctaUrl) {
    return { error: 'A URL is required for this CTA type.' }
  }
  if (ctaUrl && !ctaUrl.startsWith('https://')) {
    return { error: 'CTA URL must start with https://' }
  }
  if (ctaLabelOverride && ctaLabelOverride.length > 50) {
    return { error: 'Button label must be 50 characters or fewer.' }
  }

  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, city_id, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found or you do not have permission to edit it.' }

  const { error } = await supabase.from('listing_details_business').upsert(
    {
      listing_id: listingId,
      cta_type: ctaType,
      cta_url: ctaType === 'call' ? null : ctaUrl,
      cta_label_override: ctaLabelOverride,
    },
    { onConflict: 'listing_id' }
  )

  if (error) return { error: 'Failed to save CTA. Please try again.' }

  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug) {
      revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
    }
  }

  const now = new Date().toISOString()
  return { success: true, savedAt: now }
}
