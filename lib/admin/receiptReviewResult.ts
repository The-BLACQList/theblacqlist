// =============================================================================
// What an admin sees after Approve or Reject on /admin/receipts (ticket 293)
// =============================================================================
// The reviewed row leaves the tab on refresh, so the result can't live in the
// row. The form wrappers (lib/actions/spend/adminReceiptForms.ts) redirect back
// to the same tab with `?result=<code>` and the page shows that code's line.
// Only fixed codes travel in the URL, never free text.
// =============================================================================

import { UNLISTED_CANT_APPROVE } from '@/lib/spend/unlisted'

export const ADMIN_RECEIPT_RESULTS = {
  approved: "Approved. The purchase now counts, and we've let the shopper know.",
  sent_back: "Done. We've asked the shopper to check their receipt.",
  already_reviewed: 'Someone already reviewed that receipt.',
  unlisted: UNLISTED_CANT_APPROVE,
  failed: "That didn't go through. Please try again.",
} as const

export type AdminReceiptResult = keyof typeof ADMIN_RECEIPT_RESULTS

/** Success codes show as a confirmation; the rest as a problem. */
export function isResultOk(code: AdminReceiptResult): boolean {
  return code === 'approved' || code === 'sent_back'
}

/** The admin tabs, as /admin/receipts reads them from `?status=`. */
export const ADMIN_RECEIPT_TABS = [
  'needs_admin',
  'waiting',
  'pending_review',
  'approved',
  'rejected',
  'all',
] as const

export type AdminReceiptTab = (typeof ADMIN_RECEIPT_TABS)[number]

export function parseAdminReceiptTab(value: string | undefined | null): AdminReceiptTab {
  return (ADMIN_RECEIPT_TABS as readonly string[]).includes(value ?? '')
    ? (value as AdminReceiptTab)
    : 'needs_admin'
}

export function parseAdminReceiptResult(
  value: string | undefined | null
): AdminReceiptResult | null {
  return value && Object.hasOwn(ADMIN_RECEIPT_RESULTS, value) ? (value as AdminReceiptResult) : null
}

/** Turn an admin action's state into a result code. */
export function adminReceiptResultCode(
  kind: 'approve' | 'reject',
  state: { success: true } | { error: string } | null
): AdminReceiptResult {
  if (state && 'success' in state) return kind === 'approve' ? 'approved' : 'sent_back'
  const error = state?.error ?? ''
  if (error === UNLISTED_CANT_APPROVE) return 'unlisted'
  if (error === 'This receipt was already reviewed.' || error.startsWith('Only pending receipts'))
    return 'already_reviewed'
  return 'failed'
}

/** Back to the same tab, with the result line. */
export function adminReceiptsResultHref(tab: AdminReceiptTab, result: AdminReceiptResult): string {
  const params = new URLSearchParams()
  if (tab !== 'needs_admin') params.set('status', tab)
  params.set('result', result)
  return `/admin/receipts?${params.toString()}`
}
