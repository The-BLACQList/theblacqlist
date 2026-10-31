// =============================================================================
// The counted screen: who sees it, and what it says (ticket 166, Part A)
// =============================================================================
// /account/receipts/[id]/counted is the moment after a receipt is approved.
// Pure helpers only, so the owner check can be tested without a request.
// =============================================================================

export type CountedScreen = 'show' | 'not_found' | 'redirect' | 'error'

interface CountedReceipt {
  user_id: string
  status: string
}

const RECEIPT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Receipt ids are uuids. Anything else is a 404 before the read, so a junk id
 * never shows the "couldn't load" state that a real read failure gets.
 */
export function isReceiptId(id: string): boolean {
  return RECEIPT_ID_RE.test(id)
}

/**
 * What the page does for this viewer.
 * - A failed read shows the error state; it says nothing about whose it is.
 * - No row, or a row that isn't the viewer's, is a 404. Never a 403, which
 *   would confirm the receipt exists.
 * - The viewer's own receipt that isn't approved goes back to My receipts.
 */
export function countedScreen(args: {
  readFailed: boolean
  receipt: CountedReceipt | null
  viewerId: string
}): CountedScreen {
  if (args.readFailed) return 'error'
  if (!args.receipt || args.receipt.user_id !== args.viewerId) return 'not_found'
  if (args.receipt.status !== 'approved') return 'redirect'
  return 'show'
}

/**
 * Whether an approved receipt is on the map. The map only sums receipts bound
 * to a listing that the shopper didn't keep out of the totals.
 */
export function joinedMap(receipt: {
  listing_id: string | null
  aggregate_opt_out: boolean
}): boolean {
  return receipt.listing_id !== null && !receipt.aggregate_opt_out
}

export function countedReceiptHref(receiptId: string): string {
  return `/account/receipts/${receiptId}/counted`
}

/** The map line, shared by the counted screen and the counted email. */
export const JOINED_MAP_LINE = 'Your spend joined the map.'
export const OFF_MAP_LINE = "It's in your total. This one isn't on the map."
