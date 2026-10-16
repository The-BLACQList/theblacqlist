'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { levelsForCategory, validateLevels } from '@/lib/listings/levels'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'

export type UpdateListingLevelsState =
  | { success: true; savedAt: string }
  | { error: string }
  | null

/**
 * Saves a listing's main level and extras from the owner editor
 * (docs/blacqlist/product/business-levels-2026-10.md). Owner-only. Checked
 * against the levels the listing's category allows, the same rules as the
 * database CHECKs. Levels do not count against the plan's attribute limit.
 *
 * Form encoding: one `primary_level`, any number of `extra_level`.
 */
export async function updateListingLevelsAction(
  _prev: UpdateListingLevelsState,
  formData: FormData
): Promise<UpdateListingLevelsState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to edit this page.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  if (!listingId) return { error: 'Missing listing ID.' }

  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select(
      'id, slug, entity_type, cities(slug), categories!listings_category_id_fkey(default_level, allowed_levels)'
    )
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found or you do not have permission to edit it.' }

  const category = (Array.isArray(listing.categories) ? listing.categories[0] : listing.categories) as
    | { default_level: string | null; allowed_levels: string[] | null }
    | null
  const { allowed_levels } = levelsForCategory(category)

  const primary = formData.get('primary_level')?.toString() ?? ''
  // A stale form can send the main level as an extra too. Drop it rather
  // than refuse the save.
  const extras = Array.from(
    new Set(
      formData
        .getAll('extra_level')
        .map((v) => v.toString())
        .filter((v) => v && v !== primary)
    )
  )
  const check = validateLevels(primary, extras, allowed_levels)
  if (!check.ok) return { error: check.error }

  const { error } = await supabase
    .from('listings')
    .update({ primary_level: check.primary, extra_levels: check.extras })
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
  if (error) {
    console.error('[updateListingLevels] update error:', error)
    return { error: 'Could not save your role. Please try again.' }
  }

  const city = listing.cities as { slug: string } | null
  const publicUrl = buildEntityUrl(listing.entity_type, city?.slug, listing.slug)
  if (publicUrl) revalidatePath(publicUrl)
  revalidateOwnerEditors(listingId)

  return { success: true, savedAt: new Date().toISOString() }
}
