// =============================================================================
// My receipts: the counted total, the tally and the order (ticket 164)
// =============================================================================
// Shoppers see three words for the three review states: Counted (approved),
// Waiting (pending_review) and Needs a fix (rejected). Only counted receipts
// add to the total, because only an approved receipt reaches The Collective.
// =============================================================================

export type ReceiptStatus = 'pending_review' | 'approved' | 'rejected'

/** What the shopper reads on the pill, so status never rests on color alone. */
export const RECEIPT_STATUS_LABEL: Record<ReceiptStatus, string> = {
  approved: 'Counted',
  pending_review: 'Waiting',
  rejected: 'Needs a fix',
}

export interface MyReceipt {
  status: string
  amount_cents: number
  purchase_date: string
  created_at: string
}

export interface ReceiptTally {
  counted: number
  waiting: number
  needsFix: number
}

export function receiptTally(receipts: readonly Pick<MyReceipt, 'status'>[]): ReceiptTally {
  const tally: ReceiptTally = { counted: 0, waiting: 0, needsFix: 0 }
  for (const r of receipts) {
    if (r.status === 'approved') tally.counted += 1
    else if (r.status === 'pending_review') tally.waiting += 1
    else if (r.status === 'rejected') tally.needsFix += 1
  }
  return tally
}

/** "4 counted · 1 waiting · 1 needs a fix", leaving out the parts at zero. */
export function tallyLine(tally: ReceiptTally): string {
  const parts: string[] = []
  if (tally.counted > 0) parts.push(`${tally.counted} counted`)
  if (tally.waiting > 0) parts.push(`${tally.waiting} waiting`)
  if (tally.needsFix > 0)
    parts.push(`${tally.needsFix} ${tally.needsFix === 1 ? 'needs' : 'need'} a fix`)
  return parts.join(' · ')
}

/** The sum of approved receipts only. Waiting and needs-a-fix count for nothing yet. */
export function countedTotalCents(
  receipts: readonly Pick<MyReceipt, 'status' | 'amount_cents'>[]
): number {
  return receipts.reduce((sum, r) => (r.status === 'approved' ? sum + r.amount_cents : sum), 0)
}

/**
 * Needs-a-fix rows first, because those are the ones that get forgotten. Then
 * newest first by the date on the receipt, with the newest added breaking a
 * tie. Returns a new array.
 */
export function sortReceipts<T extends Pick<MyReceipt, 'status' | 'purchase_date' | 'created_at'>>(
  receipts: readonly T[]
): T[] {
  return [...receipts].sort((a, b) => {
    const fixA = a.status === 'rejected' ? 0 : 1
    const fixB = b.status === 'rejected' ? 0 : 1
    if (fixA !== fixB) return fixA - fixB
    if (a.purchase_date !== b.purchase_date) return a.purchase_date < b.purchase_date ? 1 : -1
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1
    return 0
  })
}
