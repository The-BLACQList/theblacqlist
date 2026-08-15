'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { trackServerEvent } from '@/lib/analytics/server'
import { VALID_DELIVERY_MODES } from '@/lib/constants/marketplace'

type FieldErrors = Partial<Record<string, string>>

export type CreateServiceState =
  | { success: true; serviceId: string; globalSlug: string }
  | { error: string; fieldErrors?: FieldErrors }
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

export async function createServiceAction(
  _prev: unknown,
  formData: FormData
): Promise<CreateServiceState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in to create a service.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const name = formData.get('name')?.toString().trim() ?? ''
  const description = formData.get('description')?.toString().trim() || null
  const priceRaw = formData.get('starting_price_cents')?.toString().trim() || null
  const priceDisplay = formData.get('price_display_text')?.toString().trim() || null
  const duration = formData.get('duration_text')?.toString().trim() || null
  const delivery = formData.get('delivery_mode')?.toString().trim() || 'in_person'
  const bookingUrl = formData.get('booking_url')?.toString().trim() || null
  const coverUrl = formData.get('cover_image_url')?.toString().trim() || null

  const fieldErrors: FieldErrors = {}

  if (!listingId) fieldErrors.listing_id = 'Select a listing.'

  if (name.length < 2) fieldErrors.name = 'Name must be at least 2 characters.'
  else if (name.length > 200) fieldErrors.name = 'Name must be 200 characters or fewer.'

  const priceCents = priceRaw ? Math.round(parseFloat(priceRaw) * 100) : null
  if (priceRaw && (isNaN(priceCents!) || priceCents! < 0)) {
    fieldErrors.starting_price_cents =
      "Enter a valid starting price (or leave blank for 'contact for pricing')."
  }

  if (!VALID_DELIVERY_MODES.includes(delivery as (typeof VALID_DELIVERY_MODES)[number])) {
    fieldErrors.delivery_mode = 'Select a valid delivery option.'
  }

  if (bookingUrl && !isValidUrl(bookingUrl)) {
    fieldErrors.booking_url = 'Booking URL must start with https://'
  }
  if (coverUrl && !isValidUrl(coverUrl)) {
    fieldErrors.cover_image_url = 'Image URL must start with https://'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Please fix the errors below.', fieldErrors }
  }

  // Verify user owns the listing
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug')
    .eq('id', listingId)
    .eq('owner_user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) {
    return {
      error: 'Listing not found or you do not have permission.',
      fieldErrors: { listing_id: 'Invalid listing.' },
    }
  }

  // Generate scoped slug
  let slug = generateSlug(name)
  if (!slug) slug = `service-${Date.now().toString(36)}`

  const { data: existingScoped } = await supabase
    .from('marketplace_services')
    .select('id')
    .eq('listing_id', listingId)
    .eq('slug', slug)
    .maybeSingle()

  if (existingScoped) slug = `${slug}-${Date.now().toString(36)}`

  // Generate globally unique slug
  let globalSlug = `${listing.slug}-${slug}`

  const serviceClient = createServiceClient()
  const { data: existingGlobal } = await serviceClient
    .from('marketplace_services')
    .select('id')
    .eq('global_slug', globalSlug)
    .maybeSingle()

  if (existingGlobal) globalSlug = `${globalSlug}-${Date.now().toString(36)}`

  const { data: svc, error: insertError } = await serviceClient
    .from('marketplace_services')
    .insert({
      listing_id: listingId,
      name,
      slug,
      global_slug: globalSlug,
      description,
      starting_price_cents: priceCents,
      price_display_text: priceDisplay,
      duration_text: duration,
      delivery_mode: delivery,
      booking_url: bookingUrl,
      cover_image_url: coverUrl,
      status: 'draft',
      created_by: user.id,
    })
    .select('id, global_slug')
    .single()

  if (insertError || !svc) {
    return { error: 'Failed to create service. Please try again.' }
  }

  trackServerEvent({
    event_name: 'service_created',
    entity_id: svc.id,
    entity_type: 'marketplace_service',
    user_id: user.id,
    properties: { listing_id: listingId },
  })

  return { success: true, serviceId: svc.id, globalSlug: svc.global_slug }
}
