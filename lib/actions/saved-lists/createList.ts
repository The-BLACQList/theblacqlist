'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { validateListName } from '@/lib/saved-lists/name'

import { fail, ok, untyped, resolveSaveId, GENERIC_ERROR, UNIQUE_VIOLATION } from './shared'
import type { SavedListState } from './shared'

/**
 * Create a saved list for the signed-in user.
 *
 * Optional `listing_id`: when present the new list is created *and* the listing
 * is filed into it in one submission, which is what the "New list" field inside
 * a card's list dialog does. Creating the list is the operation that matters —
 * if the follow-on file fails, the list still exists and the user can retry the
 * checkbox, so that failure is reported rather than rolled back.
 */
export async function createListAction(
  _prev: SavedListState,
  formData: FormData
): Promise<SavedListState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/account/saved')

  const validated = validateListName(formData.get('name')?.toString() ?? '')
  if (!validated.ok) {
    return fail('Please fix the errors below.', { name: validated.message })
  }

  const sb = untyped(supabase)

  const { data: created, error } = await sb
    .from('saved_lists')
    .insert({ user_id: user.id, name: validated.name })
    .select('id')
    .maybeSingle()

  if (error) {
    // The unique index is `(user_id, lower(btrim(name, E' \t\r\n')))`, so this
    // fires on a case-insensitive duplicate. A 500 here would read as a bug to
    // the user when they have simply reused a name.
    if (error.code === UNIQUE_VIOLATION) {
      return fail('Please fix the errors below.', {
        name: 'You already have a list with that name.',
      })
    }
    return fail(GENERIC_ERROR)
  }

  const listingId = formData.get('listing_id')?.toString()
  if (listingId && created) {
    const saveId = await resolveSaveId(sb, user.id, listingId)
    if (!saveId) return fail('List created, but the business could not be added to it.')

    const { error: itemError } = await sb
      .from('saved_list_items')
      .insert({ list_id: (created as { id: string }).id, save_id: saveId })

    if (itemError && itemError.code !== UNIQUE_VIOLATION) {
      return fail('List created, but the business could not be added to it.')
    }
  }

  revalidatePath('/account/saved')
  return ok
}
