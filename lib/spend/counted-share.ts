// =============================================================================
// The counted screen's share text (ticket 166, Part C)
// =============================================================================
// Built in the browser from what the counted screen already shows. Nothing is
// stored and no public page is made: the text goes to the phone's share sheet
// or the clipboard, and that's all.
//
// Two privacy rules live here, so they can be tested without a page:
// - The amount is left out unless the shopper switches it on.
// - The business is named only when it has opted in to showing its name in
//   The Collective. Otherwise the text says "a local business" and links to
//   /flow-map instead of the business page.
// =============================================================================

import { formatDollarsExact } from '@/lib/spend/personal-spend'

export interface CountedShareInput {
  /** Absolute origin, e.g. https://theblacqlist.com. No trailing slash needed. */
  origin: string
  businessName: string
  /** Site path of the business page, e.g. /atlanta/business/some-cafe. */
  businessPath: string | null
  /** The business opted in to showing its name in The Collective. */
  businessNameOptIn: boolean
  amountCents: number
  includeAmount: boolean
}

export interface CountedShare {
  text: string
  url: string
}

export const COLLECTIVE_PATH = '/flow-map'

export function buildCountedShare(input: CountedShareInput): CountedShare {
  const origin = input.origin.replace(/\/+$/, '')
  const named = input.businessNameOptIn && input.businessName.trim() !== ''
  const where = named ? input.businessName.trim() : 'a local business'
  const lead = input.includeAmount
    ? `I spent ${formatDollarsExact(input.amountCents)} at ${where}`
    : `I shopped at ${where}`
  const path = named && input.businessPath ? input.businessPath : COLLECTIVE_PATH

  return {
    text: `${lead} and added my receipt to The Collective on The BLACQList.`,
    url: `${origin}${path}`,
  }
}

/** The text and link as one string, for the clipboard and the hand-copy box. */
export function countedShareMessage(share: CountedShare): string {
  return `${share.text} ${share.url}`
}
