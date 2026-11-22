'use server'

import { requestSuggestion, type SuggestionRequestResult } from '@/lib/ai/requestSuggestion'
import type { WritingAllowance } from '@/lib/ai/writingHelp'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'

/**
 * The writing-help result for Edit content and Analytics (ticket 138). The card
 * shows the text straight away, so the suggestion comes back whole, along with
 * the allowance after this request so the strip at the top can update.
 */
export type GenerateSuggestionState =
  | SuggestionRequestResult
  | { error: string; code: 'off' | 'auth'; allowance?: WritingAllowance }
  | null

/**
 * Requests one AI suggestion for a listing the signed-in user owns.
 *
 * Checks the feature is on and someone is signed in, then hands over to
 * requestSuggestion (lib/ai/requestSuggestion.ts), which checks the agent,
 * ownership and plan, and is shared with the owner Cue (ticket 203).
 *
 * Runs the mock path unless `ANTHROPIC_API_KEY` and `AI_MONTHLY_CEILING_USD`
 * are both set (see `resolveProvider`). `sample` is passed back so the card can
 * label a mock result honestly rather than assuming which one ran.
 *
 * `site_text` (optional, About only): visible text from the owner's website,
 * sent by the edit page's "Import from my website" so the About can be drafted
 * from it.
 *
 * `item` (optional, ticket 242): JSON naming what a review reply, post or
 * write-up is about. requestSuggestion checks it with parseItemInput.
 */
export async function generateSuggestionAction(
  _prev: GenerateSuggestionState,
  formData: FormData
): Promise<GenerateSuggestionState> {
  if (!isFeatureEnabled('aiBeta')) {
    return { error: "AI help isn't available yet.", code: 'off' }
  }

  const owner = await getOwnerSession()
  if (!owner) return { error: 'Sign in to ask for a suggestion.', code: 'auth' }

  // No revalidatePath: the card shows the returned text, and a page refresh
  // here would reset every field the owner has not saved yet.
  return requestSuggestion(owner.user.id, {
    listingId: formData.get('listing_id')?.toString().trim() ?? '',
    agentType: formData.get('agent_type')?.toString().trim() ?? '',
    siteText: formData.get('site_text')?.toString() ?? null,
    item: parseItemField(formData.get('item')),
  })
}

/** The `item` form field as JSON, or null. Never throws on bad input. */
function parseItemField(value: FormDataEntryValue | null): unknown {
  if (typeof value !== 'string' || !value || value.length > 8000) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
