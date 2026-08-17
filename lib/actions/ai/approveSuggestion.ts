'use server'

import { revalidatePath } from 'next/cache'
import { loadOwnedSuggestion } from '@/lib/ai/review'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { createServiceClient } from '@/lib/supabase/server'

export type ApproveSuggestionState = { success: true } | { error: string } | null

/**
 * Marks a pending suggestion `approved`. **Changes no listing field.**
 *
 * Approve and apply are two actions on purpose. The safety plan requires a second
 * confirmation before a suggestion overwrites a live field, and the honest way to
 * implement "confirm twice" is two states the owner can see the difference
 * between: approved means "I've read this and I want it", applied means "it is on
 * my page now". A single button that did both would be one misclick from
 * publishing copy the owner had only glanced at.
 */
export async function approveSuggestionAction(
  _prev: ApproveSuggestionState,
  formData: FormData
): Promise<ApproveSuggestionState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to review a suggestion.' }

  const suggestionId = formData.get('suggestion_id')?.toString().trim() ?? ''

  const loaded = await loadOwnedSuggestion(suggestionId, owner.user.id, 'pending')
  if (!loaded.ok) return { error: loaded.error }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('ai_suggestions')
    .update({
      status: 'approved',
      reviewed_by: owner.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', loaded.suggestion.id)
    // Re-checks the state we loaded. Two tabs, two Approves: the second finds no
    // pending row and changes nothing, instead of overwriting the first review.
    .eq('status', 'pending')

  if (error) return { error: 'Could not save your review. Please try again.' }

  revalidatePath(`/dashboard/pages/${loaded.suggestion.listingId}/ai-suggestions`)
  return { success: true }
}
