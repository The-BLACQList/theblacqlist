// =============================================================================
// Receipt emails: the words, the switch and the fix reasons (ticket 165)
// =============================================================================
// Two emails go to the shopper after review. "Counted" when a receipt is
// approved, unless they turned it off in settings. "Needs a quick fix" when it
// is rejected, always, because the shopper has something to do.
//
// Pure helpers only, so the copy and the rules can be tested without a send.
// =============================================================================

import { formatDollarsExact } from '@/lib/spend/personal-spend'

export const RECEIPT_COUNTED_SUBJECT = 'Your receipt is counted'
export const RECEIPT_NEEDS_FIX_SUBJECT = 'Your receipt needs a quick fix'

/** Used when a receipt has no matched listing and no typed business name. */
export const UNNAMED_BUSINESS = 'a business on The BLACQList'

/** The preset reasons on the admin review card, in the order they show. */
export const RECEIPT_FIX_REASONS = [
  'Photo is hard to read',
  "Amount doesn't match the photo",
  "Date doesn't match the photo",
  "Business isn't on the list",
  'Looks like a duplicate',
] as const

/** The value of the "Other" choice. Its free text is what gets saved. */
export const OTHER_FIX_REASON = 'other'

export const FIX_REASON_MAX_LENGTH = 200

/** Shown in the email when a rejection was saved with no reason at all. */
export const FALLBACK_FIX_REASON = 'Something on this receipt needs a second look.'

/**
 * The text saved to rejection_reason. A preset saves its own words. "Other"
 * saves the typed text, trimmed and capped. Anything else, or "Other" with
 * nothing typed, saves null, as an empty reason did before.
 */
export function pickRejectionReason(
  choice: string | null | undefined,
  otherText: string | null | undefined
): string | null {
  const picked = (choice ?? '').trim()
  if ((RECEIPT_FIX_REASONS as readonly string[]).includes(picked)) return picked
  if (picked === OTHER_FIX_REASON) {
    const typed = (otherText ?? '').trim().slice(0, FIX_REASON_MAX_LENGTH)
    return typed || null
  }
  return null
}

/**
 * Whether to send the counted email. Only an explicit false turns it off. A
 * failed profile read, a missing row or a missing column all mean "on", so a
 * read problem never silently stops the email.
 */
export function wantsCountedEmail(
  profile: { receipt_counted_emails?: boolean | null } | null | undefined
): boolean {
  return profile?.receipt_counted_emails !== false
}

/** The business name as the shopper would know it. */
export function receiptBusinessName(
  listingName: string | null | undefined,
  rawBusinessName: string | null | undefined
): string {
  return listingName?.trim() || rawBusinessName?.trim() || UNNAMED_BUSINESS
}

/** "Your $42.50 at Sweet Auburn Bread Company is counted." */
export function countedLine(amountCents: number, businessName: string): string {
  return `Your ${formatDollarsExact(amountCents)} at ${businessName} is counted.`
}
