import 'server-only'

import { findAgent } from '@/lib/ai/agents'
import { getWritingAllowance } from '@/lib/ai/allowance'
import { loadGenerateContext } from '@/lib/ai/context'
import { loadOwnerNames } from '@/lib/ai/ownerName'
import { generate, RATE_LIMIT_PER_LISTING_24H } from '@/lib/ai/provider'
import { ownerRejectionMessage } from '@/lib/ai/sanitize'
import {
  dailyLimitMessage,
  monthlyUsedUpMessage,
  type WritingAllowance,
} from '@/lib/ai/writingHelp'
import { MAX_SITE_TEXT } from '@/lib/import/read-site'
import { aiQuota, canAccess } from '@/lib/stripe/features'
import { createClient } from '@/lib/supabase/server'

/**
 * One writing-help request (ticket 138), shared by the edit page's
 * generateSuggestionAction and the owner Cue's draft_text tool (ticket 203).
 *
 * The caller has already checked that writing help is on and who is signed
 * in. This is the authorization boundary after that: `generate()` trusts its
 * caller and writes with the service role. Checked in order, cheapest first:
 * the agent exists, the user owns the listing, and the listing's plan
 * includes writing help. The plan's monthly allowance and the daily cap are
 * enforced inside `generate()` on paid calls.
 *
 * The result is a **pending** suggestion. Nothing reaches the page until the
 * owner approves and applies it.
 *
 * `siteText` (About only): visible text from the owner's website. Capped at
 * MAX_SITE_TEXT here and sanitized again in buildPromptVars.
 */

export type SuggestionErrorCode =
  | 'invalid'
  | 'locked'
  | 'daily'
  | 'monthly'
  | 'paused'
  | 'rejected'
  | 'failed'

export type SuggestionRequestResult =
  | {
      success: true
      suggestion: { id: string; text: string; sample: boolean; agentType: string }
      allowance: WritingAllowance
    }
  | { error: string; code: SuggestionErrorCode; allowance?: WritingAllowance }

export async function requestSuggestion(
  userId: string,
  args: { listingId: string; agentType: string; siteText?: string | null }
): Promise<SuggestionRequestResult> {
  const { listingId } = args
  if (!listingId) return { error: 'Missing listing ID.', code: 'invalid' }

  const agent = findAgent(args.agentType)
  if (!agent) return { error: 'That kind of suggestion is not available.', code: 'invalid' }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, tier')
    .eq('id', listingId)
    .eq('owner_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) {
    return { error: 'Listing not found or you do not have permission to edit it.', code: 'invalid' }
  }

  if (!canAccess(listing.tier, 'ai_suggestions')) {
    return { error: 'Writing help comes with Starter.', code: 'locked' }
  }

  const loaded = await loadGenerateContext(listingId)
  if (!loaded) return { error: 'Listing not found.', code: 'invalid' }
  const siteText =
    agent.agentType === 'listing_description'
      ? args.siteText?.trim().slice(0, MAX_SITE_TEXT) || null
      : null
  const context = siteText ? { ...loaded, siteText } : loaded

  // The owner's name is read only so it can be taken out of their text before
  // the prompt is built. If it cannot be read, nothing is sent (fail closed).
  const ownerNames = await loadOwnerNames(userId)
  if (!ownerNames.ok) {
    return { error: "Couldn't write a suggestion right now. Try again.", code: 'failed' }
  }

  const result = await generate({
    agent,
    listingId,
    triggeredBy: userId,
    context,
    monthlyQuota: aiQuota(listing.tier),
    ownerNames: ownerNames.names,
  })
  const allowance = await getWritingAllowance(listingId, listing.tier)

  if (!result.ok) {
    switch (result.code) {
      case 'rate_limited': {
        const left = allowance.state === 'ready' ? allowance.left : null
        return {
          error: dailyLimitMessage(RATE_LIMIT_PER_LISTING_24H, left),
          code: 'daily',
          allowance,
        }
      }
      case 'quota_reached': {
        const resetsOn = allowance.state === 'ready' ? allowance.resetsOn : null
        return { error: monthlyUsedUpMessage(resetsOn), code: 'monthly', allowance }
      }
      case 'paused':
        // The monthly spending ceiling is reached, or could not be checked.
        // Owners never see a dollar figure for this.
        return {
          error: 'Writing help is paused for now. Try again later.',
          code: 'paused',
          allowance,
        }
      case 'rejected':
        // A refusal or an empty answer means the page gave too little to write
        // from; say what helps. Anything else stays vague (see ownerRejectionMessage).
        return {
          error:
            result.reason === 'refusal' || result.reason === 'empty'
              ? ownerRejectionMessage('refusal')
              : "That suggestion didn't pass our checks, so we threw it away. Try again or write your own.",
          code: 'rejected',
          allowance,
        }
      default:
        return {
          error: "Couldn't write a suggestion right now. Try again.",
          code: 'failed',
          allowance,
        }
    }
  }

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
