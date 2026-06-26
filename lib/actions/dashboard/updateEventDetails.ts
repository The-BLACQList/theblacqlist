'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'

export type UpdateEventDetailsState = { success: true } | { error: string; field?: string } | null

function isHttpsUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

export async function updateEventDetailsAction(
  _prev: UpdateEventDetailsState,
  formData: FormData
): Promise<UpdateEventDetailsState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to edit this event.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  if (!listingId) return { error: 'Missing listing ID.' }

  const startsAtRaw = formData.get('starts_at')?.toString().trim() ?? ''
  const endsAtRaw = formData.get('ends_at')?.toString().trim() || ''
  const isOnline = formData.get('is_online') === 'true'
  const venueName = formData.get('venue_name')?.toString().trim() || null
  const venueAddress = formData.get('venue_address')?.toString().trim() || null
  const cityText = formData.get('city_text')?.toString().trim() || null
  const stateText = formData.get('state_text')?.toString().trim() || null
  const ticketUrl = formData.get('ticket_url')?.toString().trim() || null
  const priceText = formData.get('price_text')?.toString().trim() || null
  const description = formData.get('description')?.toString().trim() || null
  const organizerRaw = formData.get('organizer_listing_id')?.toString().trim() || ''

  const start = startsAtRaw ? new Date(startsAtRaw) : null
  if (!start || isNaN(start.getTime())) return { error: 'Enter a valid start date and time.', field: 'starts_at' }
  let endsAtIso: string | null = null
  if (endsAtRaw) {
    const end = new Date(endsAtRaw)
    if (isNaN(end.getTime())) return { error: 'Enter a valid end date and time.', field: 'ends_at' }
    if (end < start) return { error: 'End must be after the start.', field: 'ends_at' }
    endsAtIso = end.toISOString()
  }
  if (!isOnline && !venueName) {
    return { error: 'Add a venue name, or mark the event online.', field: 'venue_name' }
  }
  if (ticketUrl && !isHttpsUrl(ticketUrl)) {
    return { error: 'Ticket link must start with https://', field: 'ticket_url' }
  }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing || listing.entity_type !== 'event') {
    return { error: 'Event not found or you do not have permission to edit it.' }
  }

  // Validate the organizer is a listing this owner controls (if provided).
  let organizerId: string | null = null
  if (organizerRaw) {
    const { data: org } = await supabase
      .from('listings')
      .select('id')
      .eq('id', organizerRaw)
      .eq('owner_user_id', owner.user.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (org) organizerId = org.id
  }

  const sb = supabase as unknown as SupabaseClient
  const { error } = await sb
    .from('listing_details_event')
    .update({
      starts_at: start.toISOString(),
      ends_at: endsAtIso,
      is_online: isOnline,
      venue_name: venueName,
      venue_address: venueAddress,
      city_text: cityText,
      state: stateText,
      ticket_url: ticketUrl,
      cta_url: ticketUrl,
      price_text: priceText,
      description,
      organizer_listing_id: organizerId,
    })
    .eq('listing_id', listingId)

  if (error) return { error: 'Failed to save event details. Please try again.' }

  // Keep the parent listing's location_type consistent with the online toggle.
  await supabase
    .from('listings')
    .update({ location_type: isOnline ? 'virtual' : 'physical' })
    .eq('id', listingId)

  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug) revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
  revalidatePath(`/dashboard/pages/${listingId}/edit`)

  return { success: true }
}
