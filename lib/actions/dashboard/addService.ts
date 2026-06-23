'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'

export type AddServiceState = { success: true; serviceId: string } | { error: string } | null

export async function addServiceAction(
  _prev: AddServiceState,
  formData: FormData
): Promise<AddServiceState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to add a service.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const name = formData.get('name')?.toString().trim() ?? ''
  const description = formData.get('description')?.toString().trim() || null
  const priceDisplay = formData.get('price_display')?.toString().trim() || null
  const groupLabel = formData.get('group_label')?.toString().trim() || null

  if (!listingId) return { error: 'Missing listing ID.' }
  if (!name) return { error: 'Service name is required.' }
  if (name.length > 200) return { error: 'Service name must be 200 characters or fewer.' }

  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, city_id, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found or you do not have permission to edit it.' }

  // Get current max display_order
  const { data: lastService } = await supabase
    .from('services')
    .select('display_order')
    .eq('listing_id', listingId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const displayOrder = (lastService?.display_order ?? -1) + 1

  const { data: newService, error } = await supabase
    .from('services')
    .insert({
      listing_id: listingId,
      name,
      description,
      price_display: priceDisplay,
      display_order: displayOrder,
    })
    .select('id')
    .single()

  if (error || !newService) return { error: 'Failed to add service. Please try again.' }

  // Fail-soft: set the group label separately so a not-yet-migrated column never
  // blocks adding a service (the group simply won't stick until the migration runs).
  if (groupLabel) {
    await (supabase as unknown as SupabaseClient)
      .from('services')
      .update({ group_label: groupLabel })
      .eq('id', newService.id)
  }

  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug) {
      revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
    }
  }

  return { success: true, serviceId: newService.id }
}
