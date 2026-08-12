'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { fail, untyped, GENERIC_ERROR } from './shared'
import type { SavedListState } from './shared'

/**
 * Delete one of the caller's lists.
 *
 * `saved_list_items.list_id` is `ON DELETE CASCADE`, so the membership rows go
 * with it. The `saves` rows are untouched — deleting a list unfiles businesses,
 * it never unsaves them. "All saved" is unchanged by this action.
 */
export async function deleteListAction(
  _prev: SavedListState,
  formData: FormData
): Promise<SavedListState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/account/saved')

  const listId = formData.get('list_id')?.toString()
  if (!listId) return fail(GENERIC_ERROR)

  const { error } = await untyped(supabase)
    .from('saved_lists')
    .delete()
    .eq('id', listId)
    .eq('user_id', user.id)

  if (error) return fail(GENERIC_ERROR)

  revalidatePath('/account/saved')

  // Delete is only offered for the currently-selected list, so the caller is
  // standing on `?list=<this id>` — send them back to All saved rather than
  // leaving a URL that points at a list that no longer exists.
  redirect('/account/saved')
}
