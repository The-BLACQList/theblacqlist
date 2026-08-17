'use server'

import { revalidatePath } from 'next/cache'
import { loadOwnedSuggestion } from '@/lib/ai/review'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { createServiceClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

export type RejectSuggestionState = { success: true } | { error: string } | null

const MAX_REASON_CHARS = 200

/**
 * Marks a pending suggestion `rejected`, with an optional reason.
 *
 * The reason is optional and stays optional. Requiring one would turn "this isn't
 * how I talk about my business" into a form to fill in, and the predictable result
 * is owners approving mediocre copy because rejecting it costs more effort. What
 * we want to measure is what gets rejected; why is a bonus.
 *
 * The reason is merged into `metadata` rather than replacing it, so the `provider`
 * value the generation wrote survives. Losing that would erase the only record
 * that a given suggestion came from the mock tier.
 */
export async function rejectSuggestionAction(
  _prev: RejectSuggestionState,
  formData: FormData
): Promise<RejectSuggestionState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to review a suggestion.' }

  const suggestionId = formData.get('suggestion_id')?.toString().trim() ?? ''
  const reason = formData.get('reason')?.toString().trim() ?? ''

  if (reason.length > MAX_REASON_CHARS) {
    return { error: `Keep the reason under ${MAX_REASON_CHARS} characters.` }
  }

  const loaded = await loadOwnedSuggestion(suggestionId, owner.user.id, 'pending')
  if (!loaded.ok) return { error: loaded.error }

  const supabase = createServiceClient()

  const { data: current } = await supabase
    .from('ai_suggestions')
    .select('metadata')
    .eq('id', loaded.suggestion.id)
    .maybeSingle()

  const existing =
    current?.metadata && typeof current.metadata === 'object' && !Array.isArray(current.metadata)
      ? (current.metadata as Record<string, unknown>)
      : {}

  const { error } = await supabase
    .from('ai_suggestions')
    .update({
      status: 'rejected',
      reviewed_by: owner.user.id,
      reviewed_at: new Date().toISOString(),
      metadata: (reason ? { ...existing, rejection_reason: reason } : existing) as Json,
    })
    .eq('id', loaded.suggestion.id)
    .eq('status', 'pending')

  if (error) return { error: 'Could not save your review. Please try again.' }

  revalidatePath(`/dashboard/pages/${loaded.suggestion.listingId}/ai-suggestions`)
  return { success: true }
}
