// =============================================================================
// Owners verify receipts (ticket 183)
// =============================================================================
// `[Decision — founder, 2026-11-13]` The business verifies its own receipts.
// The owner sees the receipt photo, amount, date and the buyer's first name
// and last initial. Admins handle unclaimed listings and anything still
// waiting after ADMIN_FALLBACK_DAYS. Unmatched receipts wait for the business
// to join instead (lib/spend/unlisted.ts); nobody approves them.
//
// Pure helpers only, so the rules can be tested without a database.
// =============================================================================

import { FIX_REASON_MAX_LENGTH, OTHER_FIX_REASON } from '@/lib/spend/receipt-emails'

/** After this many days unreviewed, a claimed listing's receipt shows in the admin queue too. */
export const ADMIN_FALLBACK_DAYS = 7

export const UNKNOWN_BUYER = 'A BLACQList member'

/**
 * "Jordan Smith" → "Jordan S.", "Jordan" → "Jordan". Anything that isn't a
 * plain name (empty, an email address) becomes "A BLACQList member". Never
 * more than the first name and one initial.
 */
export function maskBuyerName(displayName: string | null | undefined): string {
  const clean = displayName?.trim().replace(/\s+/g, ' ') ?? ''
  if (!clean || clean.includes('@')) return UNKNOWN_BUYER
  const words = clean.split(' ')
  const first = words[0] ?? ''
  const lastWord = words.length > 1 ? words[words.length - 1] : undefined
  const initial = lastWord ? Array.from(lastWord)[0]?.toUpperCase() : undefined
  return initial && /\p{L}/u.test(initial) ? `${first} ${initial}.` : first
}

export type OwnerReviewCheck = 'ok' | 'not_found' | 'own_receipt' | 'not_pending'

/**
 * Whether this owner may verify or reject this receipt.
 * - Not their listing (or no listing): not_found. Never says it exists.
 * - Their own purchase: own_receipt. An owner can't verify their own spend.
 * - Already reviewed: not_pending.
 */
export function ownerCanReview(args: {
  receipt: { user_id: string; status: string } | null
  listingOwnerId: string | null | undefined
  viewerId: string
}): OwnerReviewCheck {
  if (!args.receipt || !args.listingOwnerId || args.listingOwnerId !== args.viewerId) {
    return 'not_found'
  }
  if (args.receipt.user_id === args.viewerId) return 'own_receipt'
  if (args.receipt.status !== 'pending_review') return 'not_pending'
  return 'ok'
}

/**
 * Whether a pending receipt belongs in the admin queue by default: a business
 * nobody has claimed, or an owner who hasn't got to it in ADMIN_FALLBACK_DAYS.
 * An unmatched receipt never does: it can't be approved, it waits for the
 * business to join (ticket 183).
 */
export function needsAdminReview(
  receipt: { listing_id: string | null; created_at: string },
  listingOwnerId: string | null | undefined,
  now: Date
): boolean {
  if (!receipt.listing_id) return false
  if (!listingOwnerId) return true
  const age = now.getTime() - new Date(receipt.created_at).getTime()
  return age >= ADMIN_FALLBACK_DAYS * 24 * 60 * 60 * 1000
}

/** The ISO time before which a claimed listing's receipt falls back to admins. */
export function adminFallbackCutoff(now: Date): string {
  return new Date(now.getTime() - ADMIN_FALLBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

/** The owner's reasons for "Not ours", in the order they show. Saved word for word. */
export const OWNER_REJECT_REASONS = [
  "This isn't a purchase from us",
  "The amount doesn't match our records",
  "The date doesn't match our records",
] as const

/**
 * The text saved to rejection_reason for an owner rejection. Same rules as the
 * admin picker: a preset saves its own words, "Other" saves the typed text
 * trimmed and capped, anything else saves null.
 */
export function pickOwnerRejectionReason(
  choice: string | null | undefined,
  other: string | null | undefined
): string | null {
  if ((OWNER_REJECT_REASONS as readonly string[]).includes(choice ?? '')) return choice!
  if (choice === OTHER_FIX_REASON) {
    const typed = other?.trim().slice(0, FIX_REASON_MAX_LENGTH) ?? ''
    return typed || null
  }
  return null
}

/**
 * Who may open a receipt's photo: the shopper who uploaded it, an admin, or
 * the owner of the receipt's business while it is waiting for them to verify.
 * Once reviewed, the owner no longer needs it, so it closes again.
 */
export function canViewReceiptFile(args: {
  viewerId: string
  isAdmin: boolean
  receipt: { user_id: string; status: string; listing_id: string | null }
  listingOwnerId: string | null | undefined
}): boolean {
  if (args.receipt.user_id === args.viewerId || args.isAdmin) return true
  return (
    !!args.receipt.listing_id &&
    !!args.listingOwnerId &&
    args.listingOwnerId === args.viewerId &&
    args.receipt.status === 'pending_review'
  )
}

/** The owner email's subject and headline: "Jordan S. supported Mama's Kitchen". */
export function receiptToVerifyLine(buyer: string, businessName: string): string {
  return `${buyer} supported ${businessName}`
}

/** Email the owner only when there is one, and it isn't the shopper. */
export function shouldNotifyOwner(
  listingOwnerId: string | null | undefined,
  uploaderId: string
): listingOwnerId is string {
  return !!listingOwnerId && listingOwnerId !== uploaderId
}

// ── Shopper-facing copy ─────────────────────────────────────────────────────
// [Needs professional review] Both lines change with ownerReceiptReview: on,
// the business sees the receipt. They must match the privacy policy that is in
// effect, so they switch with the same flag that opens owner review.

/** Under a waiting receipt. */
export function pendingReviewLine(ownerReview: boolean): string {
  return ownerReview
    ? 'The business or our team will check it soon.'
    : 'We’ll check it within 3 business days.'
}

/** The privacy note on the receipt form and My receipts. */
export function receiptPrivacyNote(ownerReview: boolean): string {
  return ownerReview
    ? 'Receipt details are private. Only you, BLACQList admins and the business you bought from can see your receipt. The business sees your first name and last initial, only to verify your purchase.'
    : 'Receipt details are private. Only you and BLACQList admins can see your receipt.'
}
