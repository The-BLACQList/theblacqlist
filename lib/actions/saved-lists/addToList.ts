'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { fail, ok, untyped, resolveSaveId, GENERIC_ERROR, UNIQUE_VIOLATION } from './shared'
import type { SavedListState } from './shared'

/**
 * File a listing into one of the caller's lists.
 *
 * Takes `listing_id`, not `save_id` — the save row is resolved (and created if
 * needed) server-side by `resolveSaveId`, so the join key never has to be put
 * in the DOM. Adding to a list implies a save; see `shared.ts`.
 */
export async function addToListAction(
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

  const saveId = await resolveSaveId(sb, user.id, listingId)
  if (!saveId) return fail(GENERIC_ERROR)

  const { error } = await sb.from('saved_list_items').insert({ list_id: listId, save_id: saveId })

  // Already filed — the PK `(list_id, save_id)` rejected the duplicate. The
  // desired state holds, so this is a success from the user's point of view
  // (double-tap, or two tabs open on the same card).
  if (error && error.code !== UNIQUE_VIOLATION) return fail(GENERIC_ERROR)

  revalidatePath('/account/saved')
  return ok
}
