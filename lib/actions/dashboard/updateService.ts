'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'

export type UpdateServiceState = { success: true } | { error: string } | null

export async function updateServiceAction(
  _prev: UpdateServiceState,
  formData: FormData
): Promise<UpdateServiceState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to edit this service.' }

  const serviceId = formData.get('service_id')?.toString().trim() ?? ''
  const name = formData.get('name')?.toString().trim()
  const description = formData.get('description')?.toString().trim()
  const priceDisplay = formData.get('price_display')?.toString().trim()
  const isFeaturedRaw = formData.get('is_featured')?.toString()

  if (!serviceId) return { error: 'Missing service ID.' }
  if (name !== undefined && name.length === 0) return { error: 'Service name cannot be empty.' }
  if (name !== undefined && name.length > 200)
    return { error: 'Service name must be 200 characters or fewer.' }

  const supabase = await createClient()

  // Verify the service belongs to a listing owned by this user
  const { data: service } = await supabase
    .from('services')
    .select('id, listing_id, listings(id, slug, status, entity_type, city_id, cities(slug))')
    .eq('id', serviceId)
    .maybeSingle()

  if (!service) return { error: 'Service not found.' }

  const listing = service.listings as {
    id: string
    slug: string
    status: string
    entity_type: string
    city_id: string | null
    cities: { slug: string } | null
  } | null

  if (!listing) return { error: 'Parent listing not found.' }

  // Verify ownership via RLS-safe query
  const { data: ownerCheck } = await supabase
    .from('listings')
    .select('id')
    .eq('id', listing.id)
    .eq('owner_user_id', owner.user.id)
    .maybeSingle()

  if (!ownerCheck) return { error: 'You do not have permission to edit this service.' }

  interface ServiceUpdate {
    name?: string
    description?: string | null
    price_display?: string | null
    is_featured?: boolean
  }

  const updatePayload: ServiceUpdate = {}
  if (name !== undefined) updatePayload.name = name
  if (description !== undefined) updatePayload.description = description || null
  if (priceDisplay !== undefined) updatePayload.price_display = priceDisplay || null
  if (isFeaturedRaw !== undefined) updatePayload.is_featured = isFeaturedRaw === 'true'

  if (Object.keys(updatePayload).length === 0 && !formData.has('group_label')) {
    return { error: 'No changes to save.' }
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase.from('services').update(updatePayload).eq('id', serviceId)
    if (error) return { error: 'Failed to update service. Please try again.' }
  }

  // Fail-soft: group label updated separately so a not-yet-migrated column can't
  // block the edit (set whenever the form includes the field, empty clears it).
  if (formData.has('group_label')) {
    const groupLabel = formData.get('group_label')?.toString().trim() || null
    await (supabase as unknown as SupabaseClient)
      .from('services')
      .update({ group_label: groupLabel })
      .eq('id', serviceId)
  }

  if (listing.status === 'published') {
    const citySlug = listing.cities?.slug
    if (citySlug && listing.slug) {
      revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
    }
  }

  return { success: true }
}
