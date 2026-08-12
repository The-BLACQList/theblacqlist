'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { fail, ok, untyped, GENERIC_ERROR } from './shared'
import type { SavedListState } from './shared'

/**
 * Unfile a listing from one of the caller's lists.
 *
 * This is the inverse of `addToList` and the same control in the UI — the
 * checkbox that filed it unchecks to remove it. The `saves` row stays: removing
 * from a list is not unsaving, and the business remains under "All saved".
 *
 * A no-op delete (already removed) is reported as success — the desired state
 * holds either way, and surfacing an error for it would be noise.
 */
export async function removeFromListAction(
  _prev: SavedListState,
  formData: FormData
): Promise<SavedListState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/account/saved')

  const listId = formData.get('list_id')?.toString()
  const listingId = formData.get('listing_id')?.toString()
  if (!listId || !listingId) return fail(GENERIC_ERROR)

  const sb = untyped(supabase)

  // Look up rather than create — there is nothing to remove if the listing was
  // never saved, so `resolveSaveId`'s insert path would be wrong here.
  const { data: save } = await sb
    .from('saves')
    .select('id')
    .eq('user_id', user.id)
    .eq('listing_id', listingId)
    .maybeSingle()

  if (!save) {
    revalidatePath('/account/saved')
    return ok
  }

  const { error } = await sb
    .from('saved_list_items')
    .delete()
    .eq('list_id', listId)
    .eq('save_id', (save as { id: string }).id)

  if (error) return fail(GENERIC_ERROR)

  revalidatePath('/account/saved')
  return ok
}
