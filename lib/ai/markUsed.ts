/**
 * Records that an owner saved a suggestion they put in a field with Use this
 * (ticket 138).
 *
 * The owner's save already happened by the time this runs, through their own
 * client and RLS, exactly like any other save. This only stamps the
 * suggestion row, so it follows three rules:
 *
 * - **It never throws and never blocks the save.** Every failure returns false
 *   and the caller reports the save as the success it was.
 * - **The suggestion must belong to this owner and this listing.** The id comes
 *   from a hidden form field, so it is checked with `loadOwnedSuggestion` (the
 *   one authorization check for suggestions) and then against the listing that
 *   was just saved. A forged id from another listing is ignored.
 * - **The saved field must be the one the suggestion was written for.** That
 *   field is looked up from the agent registry, never from the request. An id
 *   sent with a save that did not include that field is ignored.
 *
 * `edited_before_save` compares the saved text with the suggestion, so we can
 * tell "used as written" from "used as a starting point" without storing the
 * owner's text anywhere new.
 */

import { findAgent } from './agents'
import { loadOwnedSuggestion } from './review'
import { createServiceClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

/** The saved values a suggestion can land in, keyed by column. */
export interface SavedFields {
  description?: string
  meta_title?: string
  meta_description?: string
}

export async function markSuggestionUsed(input: {
  suggestionId: string
  listingId: string
  userId: string
  saved: SavedFields
}): Promise<boolean> {
  const { suggestionId, listingId, userId, saved } = input
  try {
    const loaded = await loadOwnedSuggestion(suggestionId, userId, ['pending', 'approved'])
    if (!loaded.ok || loaded.suggestion.listingId !== listingId) return false

    const target = findAgent(loaded.suggestion.agentType)?.applyTarget
    if (!target) return false
    const savedText = saved[target.column]
    if (savedText === undefined) return false

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

    const now = new Date().toISOString()
    const { error } = await supabase
      .from('ai_suggestions')
      .update({
        status: 'applied',
        reviewed_by: userId,
        reviewed_at: now,
        applied_at: now,
        metadata: {
          ...existing,
          edited_before_save: savedText.trim() !== loaded.suggestion.suggestionText.trim(),
        } as Json,
      })
      .eq('id', loaded.suggestion.id)
      .eq('listing_id', listingId)
      .in('status', ['pending', 'approved'])

    return !error
  } catch {
    return false
  }
}
