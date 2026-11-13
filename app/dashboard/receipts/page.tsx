import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { requireOwner } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { listReceiptsToVerify, ownedListingIds } from '@/lib/dashboard/receiptsToVerify'
import { ADMIN_FALLBACK_DAYS } from '@/lib/spend/owner-receipts'
import { ReceiptReviewRow } from '@/components/dashboard/ReceiptReviewRow'

export const metadata: Metadata = { title: 'Receipts to verify | BLACQList Dashboard' }

// =============================================================================
// /dashboard/receipts — the business verifies its own receipts (ticket 183)
// =============================================================================
// `[Decision — founder, 2026-11-13]` A shopper's receipt for this business
// waits here. The owner checks it against their own records and verifies it,
// or says it isn't theirs. Anything left for ADMIN_FALLBACK_DAYS also goes to
// the admin queue.
// =============================================================================

export default async function ReceiptsToVerifyPage() {
  if (!isFeatureEnabled('ownerReceiptReview')) notFound()
  const owner = await requireOwner()
  const listingIds = await ownedListingIds(owner.user.id)
  const receipts = listingIds ? await listReceiptsToVerify(owner.user.id, listingIds) : null

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black mb-2">Receipts to verify</h1>
        <p className="font-body text-sm text-charcoal-soft max-w-xl">
          Shoppers upload receipts to show they supported you. Check each one against your own
          records. When you verify it, their purchase counts toward The Collective and they can
          share a verified post. If you haven&apos;t checked one in {ADMIN_FALLBACK_DAYS} days, The
          BLACQList team will.
        </p>
      </div>

      {receipts === null ? (
        <div
          role="alert"
          className="rounded-xl border border-charcoal/10 bg-white px-6 py-10 text-center"
        >
          <p className="font-subhead text-sm font-semibold text-brand-black">
            We couldn&apos;t load your receipts
          </p>
          <p className="font-body text-xs text-charcoal-soft mt-1">
            Refresh the page to try again.
          </p>
        </div>
      ) : receipts.length === 0 ? (
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
              <ReceiptReviewRow receipt={r} />
            </li>
          ))}
        </ul>
      )}

      <p className="font-body text-xs text-charcoal-faint max-w-xl">
        You see the receipt, the amount, the date and the shopper&apos;s first name and last
        initial, only so you can verify it. Please don&apos;t save or share them.
      </p>
    </div>
  )
}
