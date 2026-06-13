'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { VALID_ENTITY_TYPES, VALID_LOCATION_TYPES, VALID_CTA_TYPES } from '@/lib/constants/listing'

type FieldErrors = Partial<Record<string, string>>

export type CreateListingState =
  | { error: string; fieldErrors?: FieldErrors }
  | { success: true; listingId: string; listingName: string; slug: string }
  | null

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

function isValidUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://')
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function createListingAction(
  _prev: CreateListingState,
  formData: FormData
): Promise<CreateListingState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be signed in to submit a listing.' }
  }

  const entityType = formData.get('entity_type')?.toString().trim() ?? ''
  const name = formData.get('name')?.toString().trim() ?? ''
  const tagline = formData.get('tagline')?.toString().trim() ?? ''
  const categoryId = formData.get('category_id')?.toString().trim() ?? ''
  const description = formData.get('description')?.toString().trim() ?? ''
  const locationType = formData.get('location_type')?.toString().trim() ?? ''
  const cityText = formData.get('city_text')?.toString().trim() || null
  const stateText = formData.get('state_text')?.toString().trim() || null
  const serviceAreaDescription = formData.get('service_area_description')?.toString().trim() || null
  const shipsNationwide = formData.get('ships_nationwide') === 'true'
  const websiteUrl = formData.get('website_url')?.toString().trim() || null
  const email = formData.get('email')?.toString().trim() || null
  const phone = formData.get('phone')?.toString().trim() || null
  const ctaType = formData.get('cta_type')?.toString().trim() ?? ''
  const ctaUrl = formData.get('cta_url')?.toString().trim() || null
  const socialInstagram = formData.get('social_instagram')?.toString().trim() || null
  const socialFacebook = formData.get('social_facebook')?.toString().trim() || null
  const socialTwitter = formData.get('social_twitter')?.toString().trim() || null
  const socialTiktok = formData.get('social_tiktok')?.toString().trim() || null
  const socialLinkedin = formData.get('social_linkedin')?.toString().trim() || null
  const socialYoutube = formData.get('social_youtube')?.toString().trim() || null
  const logoPath = formData.get('logo_path')?.toString().trim() || null
  const coverImagePath = formData.get('cover_image_path')?.toString().trim() || null
  const tempEntityId = formData.get('temp_entity_id')?.toString().trim() || null
  const ownershipAttested = formData.get('ownership_attested') === 'true'

  const fieldErrors: FieldErrors = {}

  if (!VALID_ENTITY_TYPES.includes(entityType as (typeof VALID_ENTITY_TYPES)[number])) {
    fieldErrors.entity_type = 'Select a listing type.'
  }

  if (name.length < 2) {
    fieldErrors.name = 'Name must be at least 2 characters.'
  } else if (name.length > 120) {
    fieldErrors.name = 'Name must be 120 characters or fewer.'
  }

  if (tagline.length < 10) {
    fieldErrors.tagline = 'Short description must be at least 10 characters.'
  } else if (tagline.length > 120) {
    fieldErrors.tagline = 'Short description must be 120 characters or fewer.'
  }

  if (!categoryId) {
    fieldErrors.category_id = 'Select a category.'
  }

  if (description.length < 20) {
    fieldErrors.description = 'Description must be at least 20 characters.'
  } else if (description.length > 2000) {
    fieldErrors.description = 'Description must be 2000 characters or fewer.'
  }

  if (!VALID_LOCATION_TYPES.includes(locationType as (typeof VALID_LOCATION_TYPES)[number])) {
    fieldErrors.location_type = 'Select where you operate.'
  }

  if (!VALID_CTA_TYPES.includes(ctaType as (typeof VALID_CTA_TYPES)[number])) {
    fieldErrors.cta_type = 'Select a primary call to action.'
  }

  if (websiteUrl && !isValidUrl(websiteUrl)) {
    fieldErrors.website_url = 'Website must start with https://'
  }
  if (email && !isValidEmail(email)) {
    fieldErrors.email = 'Enter a valid email address.'
  }
  if (ctaUrl && !isValidUrl(ctaUrl)) {
    fieldErrors.cta_url = 'URL must start with https://'
  }

  const socialFields: [string, string | null][] = [
    ['social_instagram', socialInstagram],
    ['social_facebook', socialFacebook],
    ['social_twitter', socialTwitter],
    ['social_tiktok', socialTiktok],
    ['social_linkedin', socialLinkedin],
    ['social_youtube', socialYoutube],
  ]
  for (const [key, val] of socialFields) {
    if (val && !isValidUrl(val)) {
      fieldErrors[key] = 'Must be a valid URL starting with https://'
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Please fix the errors below.', fieldErrors }
  }

  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .eq('is_active', true)
    .maybeSingle()

  if (!category) {
    return {
      error: 'Please fix the errors below.',
      fieldErrors: { category_id: 'Invalid category. Please select again.' },
    }
  }

  let slug = generateSlug(name)
  if (!slug) slug = `listing-${Date.now().toString(36)}`

  const { data: existingSlug } = await supabase
    .from('listings')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`
  }

  const useId = tempEntityId && /^[0-9a-f-]{36}$/.test(tempEntityId) ? tempEntityId : undefined

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .insert({
      ...(useId ? { id: useId } : {}),
      name,
      entity_type: entityType,
      category_id: categoryId,
      location_type: locationType,
      status: 'draft',
      source: 'owner',
      submitted_by: user.id,
      owner_user_id: user.id,
      tagline: tagline || null,
      slug,
      tier: 'free',
      trust_tier: 'unclaimed',
      ships_nationwide: shipsNationwide,
      service_area_description: serviceAreaDescription,
      logo_path: logoPath,
      cover_image_path: coverImagePath,
      ownership_attested: ownershipAttested,
      ownership_attested_at: ownershipAttested ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (listingError || !listing) {
    console.error('[createListing] listings insert error:', listingError)
    return { error: 'Something went wrong creating your listing. Please try again.' }
  }

  const { error: detailsError } = await supabase.from('listing_details_business').insert({
    listing_id: listing.id,
    description,
    cta_type: ctaType,
    cta_url: ctaUrl,
    email,
    phone,
    website_url: websiteUrl,
    city_text: cityText,
    state: stateText,
    ships_nationwide: shipsNationwide,
    social_instagram: socialInstagram,
    social_facebook: socialFacebook,
    social_twitter: socialTwitter,
    social_tiktok: socialTiktok,
    social_linkedin: socialLinkedin,
    social_youtube: socialYoutube,
  })

  if (detailsError) {
    await supabase.from('listings').delete().eq('id', listing.id)
    return { error: 'Failed to save your business details. Please try again.' }
  }

  const serviceClient = createServiceClient()
  void serviceClient.from('analytics_events').insert({
    event_name: 'listing_draft_created',
    entity_id: listing.id,
    entity_type: 'listing',
    user_id: user.id,
    properties: { entity_type: entityType, category_id: categoryId, source: 'web_form' },
  })

  return { success: true, listingId: listing.id, listingName: name, slug }
}
