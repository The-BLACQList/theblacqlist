'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'

export type UpdateListingAttributesState =
  | { success: true; savedAt: string }
  | { error: string }
  | null

/**
 * Replaces a listing's attribute selections (amenities, identity, payment, …)
 * with the set submitted from the owner editor. Owner-only; RLS on
 * listing_attributes enforces ownership at the database layer as well.
 *
 * Form encoding: any number of `attr` fields whose value is an attribute_value id.
 */
export async function updateListingAttributesAction(
  _prev: UpdateListingAttributesState,
  formData: FormData
): Promise<UpdateListingAttributesState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to edit this page.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  if (!listingId) return { error: 'Missing listing ID.' }

  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, entity_type, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found or you do not have permission to edit it.' }

  // The new attribute tables are not in the generated Database types yet.
  const sb = supabase as unknown as SupabaseClient

  const submittedIds = Array.from(
    new Set(formData.getAll('attr').map((v) => v.toString().trim()).filter(Boolean))
  )

  // Keep only ids that are real, active attribute values.
  let validIds: string[] = []
  if (submittedIds.length > 0) {
    const { data: valid } = await sb
      .from('attribute_values')
      .select('id')
      .in('id', submittedIds)
      .eq('is_active', true)
    validIds = ((valid as { id: string }[] | null) ?? []).map((r) => r.id)
  }

  // Replace the full set: delete existing, then insert the new selection.
  const { error: delError } = await sb.from('listing_attributes').delete().eq('listing_id', listingId)
  if (delError) return { error: 'Could not update attributes. Please try again.' }

  if (validIds.length > 0) {
    const rows = validIds.map((value_id) => ({ listing_id: listingId, value_id }))
    const { error: insError } = await sb.from('listing_attributes').insert(rows)
    if (insError) return { error: 'Could not save attributes. Please try again.' }
  }

  // Revalidate the public page and the editor.
  const city = listing.cities as { slug: string } | null
  const publicUrl = buildEntityUrl(listing.entity_type, city?.slug, listing.slug)
  if (publicUrl) revalidatePath(publicUrl)
  revalidatePath(`/dashboard/pages/${listingId}/edit`)

  return { success: true, savedAt: new Date().toISOString() }
}
