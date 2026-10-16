'use server'

import { findAgent } from '@/lib/ai/agents'
import { getWritingAllowance } from '@/lib/ai/allowance'
import { loadGenerateContext } from '@/lib/ai/context'
import { generate, RATE_LIMIT_PER_LISTING_24H } from '@/lib/ai/provider'
import {
  dailyLimitMessage,
  monthlyUsedUpMessage,
  type WritingAllowance,
} from '@/lib/ai/writingHelp'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { aiQuota, canAccess } from '@/lib/stripe/features'
import { createClient } from '@/lib/supabase/server'

/**
 * The writing-help result for Edit content and Analytics (ticket 138). The card
 * shows the text straight away, so the suggestion comes back whole, along with
 * the allowance after this request so the strip at the top can update.
 */
export type GenerateSuggestionState =
  | {
      success: true
      suggestion: { id: string; text: string; sample: boolean; agentType: string }
      allowance: WritingAllowance
    }
  | {
      error: string
      code: 'off' | 'auth' | 'invalid' | 'locked' | 'daily' | 'monthly' | 'paused' | 'rejected' | 'failed'
      allowance?: WritingAllowance
    }
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
 * are both set (see `resolveProvider`). `sample` is passed back so the card can
 * label a mock result honestly rather than assuming which one ran.
 */
export async function generateSuggestionAction(
  _prev: GenerateSuggestionState,
  formData: FormData
): Promise<GenerateSuggestionState> {
  if (!isFeatureEnabled('aiBeta')) {
    return { error: "Writing help isn't available yet.", code: 'off' }
  }

  const owner = await getOwnerSession()
  if (!owner) return { error: 'Sign in to ask for a suggestion.', code: 'auth' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const agentType = formData.get('agent_type')?.toString().trim() ?? ''

  if (!listingId) return { error: 'Missing listing ID.', code: 'invalid' }

  const agent = findAgent(agentType)
  if (!agent) return { error: 'That kind of suggestion is not available.', code: 'invalid' }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, tier')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) {
    return { error: 'Listing not found or you do not have permission to edit it.', code: 'invalid' }
  }

  if (!canAccess(listing.tier, 'ai_suggestions')) {
    return { error: 'Writing help comes with Starter.', code: 'locked' }
  }

  const context = await loadGenerateContext(listingId)
  if (!context) return { error: 'Listing not found.', code: 'invalid' }

  const result = await generate({
    agent,
    listingId,
    triggeredBy: owner.user.id,
    context,
    monthlyQuota: aiQuota(listing.tier),
  })
  const allowance = await getWritingAllowance(listingId, listing.tier)

  if (!result.ok) {
    switch (result.code) {
      case 'rate_limited': {
        const left = allowance.state === 'ready' ? allowance.left : null
        return { error: dailyLimitMessage(RATE_LIMIT_PER_LISTING_24H, left), code: 'daily', allowance }
      }
      case 'quota_reached': {
        const resetsOn = allowance.state === 'ready' ? allowance.resetsOn : null
        return { error: monthlyUsedUpMessage(resetsOn), code: 'monthly', allowance }
      }
      case 'paused':
        // The monthly spending ceiling is reached, or could not be checked.
        // Owners never see a dollar figure for this.
        return { error: 'Writing help is paused for now. Try again later.', code: 'paused', allowance }
      case 'rejected':
        return {
          error:
            "That suggestion didn't pass our checks, so we threw it away. Try again or write your own.",
          code: 'rejected',
          allowance,
        }
      default:
        return { error: "Couldn't write a suggestion right now. Try again.", code: 'failed', allowance }
    }
  }

  // No revalidatePath: the card shows the returned text, and a page refresh
  // here would reset every field the owner has not saved yet.
  return {
    success: true,
    suggestion: {
      id: result.suggestionId,
      text: result.text,
      sample: result.provider === 'mock',
      agentType: agent.agentType,
    },
    allowance,
  }
}
