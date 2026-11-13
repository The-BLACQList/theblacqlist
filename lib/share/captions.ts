// =============================================================================
// Share captions. Pure, so the privacy rules can be tested without a page.
// =============================================================================
// Two rules hold for every caption:
// - No amount, ever. A support post celebrates the visit, not the spend.
// - No name of the person sharing. They are the one posting it.
// =============================================================================

export const BLACQLIST_HANDLE = '@theblacqlist'

export interface ProfileCaptionInput {
  businessName: string
  categoryName?: string | null
  cityName?: string | null
}

/** "Look what I found on The BLACQList 👀 Mama's Kitchen, Restaurant in Atlanta." */
export function profileCaption({
  businessName,
  categoryName,
  cityName,
}: ProfileCaptionInput): string {
  const name = businessName.trim()
  const what = [categoryName?.trim(), cityName?.trim() ? `in ${cityName.trim()}` : null]
    .filter(Boolean)
    .join(' ')
  return `Look what I found on The BLACQList 👀 ${name}${what ? `, ${what}` : ''}.`
}

export type SupportStage = 'supported' | 'verified'

export interface SupportCaptionInput {
  businessName: string
  stage: SupportStage
  /**
   * The receipt joins The Collective's map. False for a receipt with no
   * matched business or one kept out of the totals, so the caption doesn't
   * claim something that isn't true. Defaults to true.
   */
  collective?: boolean
}

/**
 * "I supported Mama's Kitchen 🖤 Adding to #TheCollective on @theblacqlist."
 * The verified stage adds the stamp line. Only ever called for a receipt the
 * business has confirmed, so "verified" is true when it says so.
 */
export function supportCaption({
  businessName,
  stage,
  collective = true,
}: SupportCaptionInput): string {
  const tail = collective
    ? `Adding to #TheCollective on ${BLACQLIST_HANDLE}.`
    : `Found on ${BLACQLIST_HANDLE}.`
  const base = `I supported ${businessName.trim()} 🖤 ${tail}`
  return stage === 'verified' ? `${base} Verified by The BLACQList.` : base
}
