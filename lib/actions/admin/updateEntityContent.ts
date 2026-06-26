'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import { buildEntityUrl } from '@/lib/listings/url'

export type UpdateEntityContentState =
  | { success: true; savedAt: string }
  | { error: string }
  | null

export async function updateEntityContentAction(
  _prev: UpdateEntityContentState,
  formData: FormData
): Promise<UpdateEntityContentState> {
  const admin = await getAdminSession()
  if (!admin) return { error: 'You must be signed in as an admin.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  if (!listingId) return { error: 'Missing listing ID.' }

  const serviceClient = createServiceClient()

  const { data: listing } = await serviceClient
    .from('listings')
    .select('id, slug, name, status, entity_type, city_id, cities(slug)')
    .eq('id', listingId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found.' }

  const listingsUpdate: Record<string, unknown> = {}

  const name = formData.get('name')?.toString().trim()
  const tagline = formData.get('tagline')?.toString().trim()
  const metaTitle = formData.get('meta_title')?.toString().trim()
  const metaDescription = formData.get('meta_description')?.toString().trim()

  if (name !== undefined) {
    if (name.length === 0) return { error: 'Business name cannot be empty.' }
    if (name.length > 200) return { error: 'Business name must be 200 characters or fewer.' }
    listingsUpdate.name = name
  }
  if (tagline !== undefined) {
    if (tagline.length > 140) return { error: 'Tagline must be 140 characters or fewer.' }
    listingsUpdate.tagline = tagline || null
  }
  if (metaTitle !== undefined) {
    if (metaTitle.length > 60) return { error: 'SEO title must be 60 characters or fewer.' }
    listingsUpdate.meta_title = metaTitle || null
  }
  if (metaDescription !== undefined) {
    if (metaDescription.length > 160)
      return { error: 'SEO description must be 160 characters or fewer.' }
    listingsUpdate.meta_description = metaDescription || null
  }

  const detailsUpdate: Record<string, unknown> = {}

  const description = formData.get('description')?.toString().trim()
  const phone = formData.get('phone')?.toString().trim()
  const email = formData.get('email')?.toString().trim()
  const websiteUrl = formData.get('website_url')?.toString().trim()
  const addressLine1 = formData.get('address_line_1')?.toString().trim()
  const addressLine2 = formData.get('address_line_2')?.toString().trim()
  const state = formData.get('state')?.toString().trim()
  const zip = formData.get('zip')?.toString().trim()
  const socialInstagram = formData.get('social_instagram')?.toString().trim()
  const socialFacebook = formData.get('social_facebook')?.toString().trim()
  const socialLinkedin = formData.get('social_linkedin')?.toString().trim()
  const socialTiktok = formData.get('social_tiktok')?.toString().trim()
  const socialYoutube = formData.get('social_youtube')?.toString().trim()
  const socialTwitter = formData.get('social_twitter')?.toString().trim()

  if (description !== undefined) detailsUpdate.description = description || null
  if (phone !== undefined) detailsUpdate.phone = phone || null
  if (email !== undefined) {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: 'Please enter a valid email address.' }
    }
    detailsUpdate.email = email || null
  }
  if (websiteUrl !== undefined) {
    if (websiteUrl && !websiteUrl.startsWith('https://')) {
      return { error: 'Website URL must start with https://' }
    }
    detailsUpdate.website_url = websiteUrl || null
  }
  if (addressLine1 !== undefined) detailsUpdate.address_line_1 = addressLine1 || null
  if (addressLine2 !== undefined) detailsUpdate.address_line_2 = addressLine2 || null
  if (state !== undefined) detailsUpdate.state = state || null
  if (zip !== undefined) detailsUpdate.zip = zip || null

  for (const [key, val] of [
    ['social_instagram', socialInstagram],
    ['social_facebook', socialFacebook],
    ['social_linkedin', socialLinkedin],
    ['social_tiktok', socialTiktok],
    ['social_youtube', socialYoutube],
    ['social_twitter', socialTwitter],
  ] as const) {
    if (val !== undefined) {
      if (val && !val.startsWith('https://')) {
        return { error: `${key.replace('social_', '')} URL must start with https://` }
      }
      detailsUpdate[key] = val || null
    }
  }

  const hasListingsChanges = Object.keys(listingsUpdate).length > 0
  const hasDetailsChanges = Object.keys(detailsUpdate).length > 0

  if (!hasListingsChanges && !hasDetailsChanges) {
    return { error: 'No changes to save.' }
  }

  const now = new Date().toISOString()

  if (hasListingsChanges) {
    const { error } = await serviceClient
      .from('listings')
      .update({ ...listingsUpdate, last_admin_updated_at: now, updated_by: admin.user.id })
      .eq('id', listingId)

    if (error) return { error: 'Failed to save changes. Please try again.' }
  }

  if (hasDetailsChanges) {
    const { error } = await serviceClient
      .from('listing_details_business')
      .upsert({ listing_id: listingId, ...detailsUpdate }, { onConflict: 'listing_id' })

    if (error) return { error: 'Failed to save business details. Please try again.' }
  }

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: 'update_entity_content',
    targetTable: 'listings',
    targetId: listingId,
    beforeState: { name: listing.name },
    afterState: { ...listingsUpdate, details: detailsUpdate },
  })

  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug) {
      revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
    }
  }
  revalidatePath(`/admin/entities/${listingId}`)

  return { success: true, savedAt: now }
}
