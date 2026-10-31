import Link from 'next/link'

import { formatDollarsExact } from '@/lib/spend/personal-spend'
import { RECEIPT_STATUS_LABEL, type ReceiptStatus } from '@/lib/spend/my-receipts'
import { countedReceiptHref } from '@/lib/spend/counted-receipt'
import { ReceiptImageButton } from './ReceiptImageButton'
import { UnlistedInvite } from './UnlistedInvite'

interface Props {
  id: string
  /** The listing's name when matched, else what the shopper typed. */
  businessName: string
  /** False when the receipt was never bound to a listing. */
  isMatched: boolean
  /** The listing's category, or null when it has none or the read failed. */
  category: string | null
  amountCents: number
  purchaseDate: string
  status: string
  /**
   * Storage path, not a URL: ReceiptImageButton mints its own signed URL and
   * needs the extension to tell a photo from a PDF.
   */
  filePath: string | null
  /** Only set on a receipt that needs a fix. */
  rejectionReason: string | null
  /** Site origin for the invite link on an unmatched receipt (ticket 168). */
  origin?: string
}

const PILL_CLS: Record<ReceiptStatus, string> = {
  approved: 'bg-green-50 text-green-800 border-green-200',
  pending_review: 'bg-amber-50 text-amber-800 border-amber-200',
  rejected: 'bg-red-50 text-red-800 border-red-200',
}

const chipCls =
  'inline-flex items-center px-2 py-0.5 rounded-full font-subhead text-xs font-semibold max-w-full truncate'

/** "Oct 20, 2026". The date has no time, so it is read as UTC and never shifts a day. */
function formatPurchaseDate(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return isoDay
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** One line on My receipts (ticket 164). */
export function ReceiptListRow({
  id,
  businessName,
  isMatched,
  category,
  amountCents,
  purchaseDate,
  status,
  filePath,
  rejectionReason,
  origin,
}: Props) {
  const known = status in RECEIPT_STATUS_LABEL ? (status as ReceiptStatus) : null
  const needsFix = status === 'rejected'
  const counted = status === 'approved'

  return (
    <li className="py-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-subhead text-sm font-semibold text-brand-black break-words">
          {businessName}
        </p>
        <span className="shrink-0 font-subhead text-sm font-semibold text-brand-black tabular-nums">
          {formatDollarsExact(amountCents)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="font-body text-xs text-charcoal-soft">
          <time dateTime={purchaseDate}>{formatPurchaseDate(purchaseDate)}</time>
        </span>
        {!isMatched ? (
          <span className={`${chipCls} bg-charcoal/5 text-charcoal-soft`}>Not on the list yet</span>
        ) : category ? (
          <span className={`${chipCls} bg-pale-lavender text-brand-black`}>{category}</span>
        ) : null}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full border font-subhead text-xs font-semibold ${
            known ? PILL_CLS[known] : 'bg-charcoal/5 text-charcoal-soft border-charcoal/10'
          }`}
        >
          {known ? RECEIPT_STATUS_LABEL[known] : status}
        </span>
      </div>

      {!isMatched && <UnlistedInvite origin={origin} businessName={businessName} />}

      {status === 'pending_review' && (
        <p className="font-body text-xs text-charcoal-soft">
          We&apos;ll check it within 3 business days.
        </p>
      )}

      {needsFix && (
        <p className="font-body text-xs text-red-800">
          <span className="font-semibold">What to fix:</span>{' '}
          {rejectionReason ?? 'Check the amount, date and photo, then send it back.'}
        </p>
      )}

      {(filePath || needsFix || counted || status === 'pending_review') && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {needsFix && (
            <Link
              href={`/account/receipts/${id}/edit`}
              className="inline-flex items-center justify-center h-11 px-5 w-full sm:w-auto rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60"
            >
              Fix and resend
              <span className="sr-only"> your {businessName} receipt</span>
            </Link>
          )}
          {filePath && (
            <ReceiptImageButton receiptId={id} filePath={filePath} businessLabel={businessName} />
          )}
          {/* Counted receipts are locked: their amount is already in the totals.
              They open the counted screen instead (ticket 166). */}
          {counted && (
            <Link
              href={countedReceiptHref(id)}
              className="inline-flex items-center min-h-11 px-2 font-subhead text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-brand-black"
            >
              See it counted
              <span className="sr-only"> for your {businessName} receipt</span>
            </Link>
          )}
          {status === 'pending_review' && (
            <Link
              href={`/account/receipts/${id}/edit`}
              className="inline-flex items-center min-h-11 px-2 font-subhead text-xs font-semibold text-charcoal-soft underline underline-offset-2 hover:text-brand-black"
            >
              Edit
              <span className="sr-only"> your {businessName} receipt</span>
            </Link>
          )}
        </div>
      )}
    </li>
  )
}
