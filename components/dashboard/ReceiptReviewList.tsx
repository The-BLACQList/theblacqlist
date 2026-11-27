'use client'

import { useState } from 'react'

import { ReceiptReviewRow } from '@/components/dashboard/ReceiptReviewRow'
import type { ReceiptToVerify } from '@/lib/dashboard/receiptsToVerify'

/**
 * The receipts waiting for this owner, plus the line that says what just
 * happened. The line lives here, not in the row: after Approve or Not Ours the
 * page refreshes and the row is gone, so a line inside it never showed
 * (found 2026-11-26, ticket 288).
 */
export function ReceiptReviewList({ receipts }: { receipts: ReceiptToVerify[] }) {
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <>
      <div role="status" aria-live="polite">
        {notice && (
          <p className="rounded-xl border border-amber-gold/40 bg-amber-gold/10 px-5 py-4 font-subhead text-sm text-brand-black">
            {notice}
          </p>
        )}
      </div>

      {receipts.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-10 text-center">
          <p className="font-subhead text-sm font-semibold text-brand-black">
            You&apos;re all caught up
          </p>
          <p className="font-body text-xs text-charcoal-soft mt-1">
            We&apos;ll email you when a shopper uploads a receipt for your business.
          </p>
        </div>
      ) : (
        <ul className="rounded-xl border border-charcoal/10 bg-white divide-y divide-charcoal/5 overflow-hidden">
          {receipts.map((r) => (
            <li key={r.id}>
              <ReceiptReviewRow receipt={r} onDone={setNotice} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
