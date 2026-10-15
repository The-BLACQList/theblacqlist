'use server'

import { revalidatePath } from 'next/cache'
import { findAgent } from '@/lib/ai/agents'
import { loadGenerateContext } from '@/lib/ai/context'
import { generate, RATE_LIMIT_PER_LISTING_24H } from '@/lib/ai/provider'
import { ownerRejectionMessage } from '@/lib/ai/sanitize'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { aiQuota, canAccess } from '@/lib/stripe/features'
import { createClient } from '@/lib/supabase/server'

export type GenerateSuggestionState =
  | { success: true; provider: 'mock' | 'anthropic' }
  | { error: string }
  | null

/**
 * Requests one AI suggestion for a listing the signed-in user owns.
 *
 * Four things must be true before a single character is generated, checked in
 * this order because each is cheaper than the next: the feature is switched on,
 * the agent exists, the user owns the listing, and the listing's tier includes
 * AI suggestions. The plan's monthly allowance is passed to `generate()`, which
 * enforces it on paid calls. Ownership is checked here — `generate()` trusts its caller and
 * writes with the service role, so this function is the authorization boundary.
 *
 * Runs the mock path unless `ANTHROPIC_API_KEY` and `AI_MONTHLY_CEILING_USD`
 * are both set (see `resolveProvider`). The returned `provider` is passed back
 * so the UI can label the result honestly rather than assuming which one ran.
 */
export async function generateSuggestionAction(
  _prev: GenerateSuggestionState,
  formData: FormData
): Promise<GenerateSuggestionState> {
  if (!isFeatureEnabled('aiBeta')) {
    return { error: 'AI suggestions are not available yet.' }
  }

  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to request a suggestion.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const agentType = formData.get('agent_type')?.toString().trim() ?? ''

  if (!listingId) return { error: 'Missing listing ID.' }

  const agent = findAgent(agentType)
  if (!agent) return { error: 'That suggestion type is not available.' }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, tier')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found or you do not have permission to edit it.' }

  if (!canAccess(listing.tier, 'ai_suggestions')) {
    return { error: 'AI suggestions are available on paid plans. Upgrade to use them.' }
  }

  const context = await loadGenerateContext(listingId)
  if (!context) return { error: 'Listing not found.' }

  const result = await generate({
    agent,
    listingId,
    triggeredBy: owner.user.id,
    context,
    monthlyQuota: aiQuota(listing.tier),
  })

  if (!result.ok) {
    switch (result.code) {
      case 'rate_limited':
        return {
          error: `You've used all ${RATE_LIMIT_PER_LISTING_24H} suggestions for this page today. Try again tomorrow.`,
        }
      case 'quota_reached':
        return {
          error: `You've used all ${result.quota} suggestions your plan includes for this page in the last 30 days.`,
        }
      case 'paused':
        // The monthly spending ceiling is reached, or could not be checked.
        return { error: 'AI suggestions are paused for now. Please try again later.' }
      case 'rejected':
        return { error: ownerRejectionMessage(result.reason) }
      default:
        return { error: 'Could not generate a suggestion right now. Please try again.' }
    }
  }

  revalidatePath(`/dashboard/pages/${listingId}/ai-suggestions`)
  return { success: true, provider: result.provider }
}
