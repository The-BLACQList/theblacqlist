'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { validateListName } from '@/lib/saved-lists/name'

import { fail, ok, untyped, GENERIC_ERROR, UNIQUE_VIOLATION } from './shared'
import type { SavedListState } from './shared'

/**
 * Rename one of the caller's lists.
 *
 * No ownership check in application code on purpose: the update policy is
 * `user_id = auth.uid()`, so an UPDATE against someone else's list matches zero
 * rows. The only thing worth distinguishing is the duplicate-name case.
 */
export async function renameListAction(
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

  const validated = validateListName(formData.get('name')?.toString() ?? '')
  if (!validated.ok) {
    return fail('Please fix the errors below.', { name: validated.message })
  }

  const { error } = await untyped(supabase)
    .from('saved_lists')
    .update({ name: validated.name })
    .eq('id', listId)
    .eq('user_id', user.id)

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return fail('Please fix the errors below.', {
        name: 'You already have a list with that name.',
      })
    }
    return fail(GENERIC_ERROR)
  }

  revalidatePath('/account/saved')
  return ok
}
