'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { checkAttributeCount } from '@/lib/stripe/planChecks'
import { splitAttributePicks, type AttributePick } from '@/lib/listings/creatorAttributes'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'

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
    .select('id, slug, entity_type, tier, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found or you do not have permission to edit it.' }

  // The new attribute tables are not in the generated Database types yet.
  const sb = supabase as unknown as SupabaseClient

  const submittedIds = Array.from(
    new Set(
      formData
        .getAll('attr')
        .map((v) => v.toString().trim())
        .filter(Boolean)
    )
  )

  const { data: previousRows } = await sb
    .from('listing_attributes')
    .select('value_id')
    .eq('listing_id', listingId)
  const previousIds = ((previousRows as { value_id: string }[] | null) ?? []).map(
    (r) => r.value_id
  )

  // Each id's group, for both the submitted and the saved set.
  const lookupIds = Array.from(new Set([...submittedIds, ...previousIds]))
  const groupOf = new Map<string, { slug: string; active: boolean }>()
  if (lookupIds.length > 0) {
    const { data: values } = await sb
      .from('attribute_values')
      .select('id, is_active, attribute_groups(slug)')
      .in('id', lookupIds)
    for (const v of (values ?? []) as unknown as Array<{
      id: string
      is_active: boolean
      attribute_groups: { slug: string } | null
    }>) {
      groupOf.set(v.id, { slug: v.attribute_groups?.slug ?? '', active: v.is_active })
    }
  }
  const toPicks = (ids: string[], activeOnly: boolean): AttributePick[] =>
    ids.flatMap((id) => {
      const g = groupOf.get(id)
      if (!g || (activeOnly && !g.active)) return []
      return [{ id, groupSlug: g.slug }]
    })

  // Keep only ids that are real, active attribute values. Creator groups are
  // dropped on other types and capped on creators (ticket 132).
  const next = splitAttributePicks(toPicks(submittedIds, true), listing.entity_type)
  if (next.problem) return { error: next.problem }
  const validIds = next.kept.map((p) => p.id)

  // Plan limit (ticket 119). A listing already over the limit can keep its
  // set or trim it, but not grow it. Creator groups don't count (ticket 132).
  const previous = splitAttributePicks(toPicks(previousIds, false), listing.entity_type)
  const limitError = checkAttributeCount(listing.tier, next.planCount, previous.planCount)
  if (limitError) return { error: limitError }

  // Replace the full set: delete existing, then insert the new selection.
  const { error: delError } = await sb
    .from('listing_attributes')
    .delete()
    .eq('listing_id', listingId)
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
  revalidateOwnerEditors(listingId)

  return { success: true, savedAt: new Date().toISOString() }
}
