import { isFeatureEnabled } from '@/lib/env'
import { growthIsOpen } from '@/lib/marketplace/entitlements'
import { canAccess } from '@/lib/stripe/features'
import { ITEM_AGENT_GATE, itemHelpFor, type ItemAgentType, type ItemHelp } from './itemHelp'

/**
 * Ticket 242: whether a form shows AI help, a locked note, or nothing, for a
 * page on `tier`. Reads plan availability only when a Starter page would be
 * offered Growth, so every other page skips the `plans` read.
 */
export async function itemHelp(tier: string | null, agentType: ItemAgentType): Promise<ItemHelp> {
  const aiOn = isFeatureEnabled('aiBeta')
  const offersGrowth =
    aiOn && canAccess(tier, 'ai_suggestions') && !canAccess(tier, ITEM_AGENT_GATE[agentType])
  return itemHelpFor(tier, agentType, {
    aiOn,
    growthOpen: offersGrowth ? await growthIsOpen() : false,
  })
}

/**
 * Review replies come with Starter, which is always for sale, so this needs no
 * availability read and can run while a listing page renders.
 */
export function reviewReplyHelp(tier: string | null): ItemHelp {
  return itemHelpFor(tier, 'review_response', {
    aiOn: isFeatureEnabled('aiBeta'),
    growthOpen: false,
  })
}
