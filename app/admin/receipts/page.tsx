import Link from 'next/link'
import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import { approveReceiptAction } from '@/lib/actions/spend/approveReceipt'
import { rejectReceiptAction } from '@/lib/actions/spend/rejectReceipt'
import { ReceiptStatusBadge } from '@/components/spend/ReceiptStatusBadge'
import { ReceiptImageButton } from '@/components/spend/ReceiptImageButton'
import {
  FIX_REASON_MAX_LENGTH,
  OTHER_FIX_REASON,
  RECEIPT_FIX_REASONS,
} from '@/lib/spend/receipt-emails'
import { ADMIN_FALLBACK_DAYS, needsAdminReview } from '@/lib/spend/owner-receipts'
import { UNLISTED_WAIT_DAYS, addListingHref, unlistedWait } from '@/lib/spend/unlisted'
import { isFeatureEnabled } from '@/lib/env'

export const metadata: Metadata = { title: 'Receipts — Admin' }

// Ticket 183: businesses verify their own receipts. The default tab is what
// still needs an admin: an unclaimed business, or one the owner hasn't checked
// in ADMIN_FALLBACK_DAYS. Admins can still act on any pending receipt from
// "All pending". A receipt for a business that isn't on The BLACQList can't be
// approved by anyone; it sits in "Waiting for the business" until the shopper
// links it to a listing (lib/spend/unlisted.ts).
type StatusFilter = 'needs_admin' | 'waiting' | 'pending_review' | 'approved' | 'rejected' | 'all'

interface Props {
  searchParams: Promise<{ status?: string }>
}

function formatDollars(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function AdminReceiptsPage({ searchParams }: Props) {
  await requireAdmin()
  const { status: statusParam } = await searchParams
  const activeFilter: StatusFilter =
    statusParam === 'waiting'
      ? 'waiting'
      : statusParam === 'pending_review'
        ? 'pending_review'
        : statusParam === 'approved'
          ? 'approved'
          : statusParam === 'rejected'
            ? 'rejected'
            : statusParam === 'all'
              ? 'all'
              : 'needs_admin'

  const serviceClient = createServiceClient()

  let query = serviceClient
    .from('receipt_uploads')
    .select(
      `
      id,
      user_id,
      raw_business_name,
      amount_cents,
      purchase_date,
      status,
      file_path,
      notes,
      created_at,
      rejection_reason,
      listing_id,
      verified_by_role,
      listings(name, slug, owner_user_id)
    `
    )
    .order('created_at', { ascending: false })
    // The admin tab filters after the read, so it reads further back.
    .limit(activeFilter === 'needs_admin' ? 500 : 100)

  if (activeFilter === 'needs_admin') {
    query = query.eq('status', 'pending_review').not('listing_id', 'is', null)
  } else if (activeFilter === 'waiting') {
    query = query.eq('status', 'pending_review').is('listing_id', null)
  } else if (activeFilter !== 'all') {
    query = query.eq('status', activeFilter)
  }

  const { data: receipts } = await query

  // With owner review off, every matched pending receipt needs an admin.
  const ownerReview = isFeatureEnabled('ownerReceiptReview')
  const now = new Date()
  const receiptList = (receipts ?? []).filter(
    (r) =>
      activeFilter !== 'needs_admin' ||
      !ownerReview ||
      needsAdminReview(
        r,
        (r.listings as { owner_user_id: string | null } | null)?.owner_user_id ?? null,
        now
      )
  )

  const tabs: { label: string; value: StatusFilter }[] = [
    { label: 'Needs an admin', value: 'needs_admin' },
    { label: 'Waiting for the business', value: 'waiting' },
    { label: 'All pending', value: 'pending_review' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'All', value: 'all' },
  ]

  const tabCls = (v: StatusFilter) =>
    v === activeFilter
      ? 'font-subhead text-sm font-semibold text-brand-black border-b-2 border-amber-gold pb-2'
      : 'font-subhead text-sm text-charcoal-soft hover:text-brand-black pb-2 transition-colors'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline text-2xl text-brand-black">Receipts</h1>
          <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
            {activeFilter === 'waiting'
              ? `These businesses aren't on The BLACQList, so the receipts can't be counted. Each waits up to ${UNLISTED_WAIT_DAYS} days for the shopper to link it to a listed business.`
              : ownerReview
                ? `Businesses verify their own receipts. This tab shows the ones that need you: an unclaimed business, or waiting more than ${ADMIN_FALLBACK_DAYS} days.`
                : 'Review community receipt submissions'}
          </p>
        </div>
        {/* Ticket 168: businesses on receipts that aren't listings yet. */}
        <Link
          href="/admin/receipts/unlisted"
          className="inline-flex items-center min-h-11 font-subhead text-sm font-semibold text-amber-700 underline underline-offset-2 hover:text-brand-black"
        >
          Not on the list
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-6 border-b border-charcoal/10">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/receipts${tab.value === 'needs_admin' ? '' : `?status=${tab.value}`}`}
            className={tabCls(tab.value)}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {receiptList.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
          <p className="font-subhead text-sm font-semibold text-brand-black">No receipts</p>
          <p className="font-body text-xs text-charcoal-soft mt-1">
            {activeFilter === 'needs_admin'
              ? 'Nothing needs an admin right now.'
              : activeFilter === 'waiting'
                ? 'No receipts are waiting for a business to join.'
                : `No ${activeFilter === 'all' ? '' : activeFilter.replace('_', ' ')} receipts found.`}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          <div className="divide-y divide-charcoal/5">
            {receiptList.map((receipt) => {
              const listing = receipt.listings as {
                name: string
                slug: string
                owner_user_id: string | null
              } | null
              const businessLabel = listing?.name ?? receipt.raw_business_name ?? 'Unknown business'
              const wait = unlistedWait(receipt, now)

              return (
                <div key={receipt.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-subhead text-sm font-semibold text-brand-black truncate">
                          {businessLabel}
                        </p>
                        {/* businessLabel falls back to the typed-in name, so a
                            matched and an unmatched receipt look identical
                            above. An unmatched one contributes nothing to the
                            community breakdowns — say so before approval, not
                            after. */}
                        {!listing && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full font-subhead text-xs font-semibold bg-charcoal/5 text-charcoal-soft shrink-0">
                            {wait === 'stopped'
                              ? `Stopped waiting after ${UNLISTED_WAIT_DAYS} days`
                              : 'Not on The BLACQList'}
                          </span>
                        )}
                        {listing && !listing.owner_user_id && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full font-subhead text-xs font-semibold bg-charcoal/5 text-charcoal-soft shrink-0">
                            Unclaimed business
                          </span>
                        )}
                        {receipt.verified_by_role === 'owner' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full font-subhead text-xs font-semibold bg-amber-gold/15 text-amber-700 shrink-0">
                            Reviewed by the business
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="font-subhead text-xs text-charcoal-soft">
                          {formatDollars(receipt.amount_cents)}
                        </span>
                        <span aria-hidden="true" className="text-charcoal/20">
                          ·
                        </span>
                        <span className="font-subhead text-xs text-charcoal-soft">
                          {receipt.purchase_date}
                        </span>
                        <span aria-hidden="true" className="text-charcoal/20">
                          ·
                        </span>
                        <span className="font-body text-xs text-charcoal-faint">
                          Submitted {formatDate(receipt.created_at)}
                        </span>
                      </div>
                      {receipt.notes && (
                        <p className="font-body text-xs text-charcoal-soft mt-1.5 italic">
                          &ldquo;{receipt.notes}&rdquo;
                        </p>
                      )}
                      {receipt.rejection_reason && (
                        <p className="font-body text-xs text-red-600 mt-1.5">
                          Rejection reason: {receipt.rejection_reason}
                        </p>
                      )}
                      {receipt.file_path && (
                        <div className="mt-2">
                          <ReceiptImageButton
                            receiptId={receipt.id}
                            filePath={receipt.file_path}
                            businessLabel={businessLabel}
                          />
                        </div>
                      )}
                    </div>
                    <ReceiptStatusBadge status={receipt.status} />
                  </div>

                  {receipt.status === 'pending_review' && (
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {/* Only listed businesses count: no Approve without a listing. */}
                      {!listing ? (
                        <p className="font-body text-xs text-charcoal-soft basis-full">
                          Can&apos;t be counted until it&apos;s linked to a business on The
                          BLACQList.{' '}
                          {receipt.raw_business_name && (
                            <Link
                              href={addListingHref(receipt.raw_business_name)}
                              className="font-semibold text-amber-700 underline underline-offset-2 hover:text-brand-black"
                            >
                              Add {receipt.raw_business_name} as a listing
                            </Link>
                          )}
                        </p>
                      ) : (
                        <form
                          action={
                            approveReceiptAction.bind(null, null) as unknown as (
                              formData: FormData
                            ) => Promise<void>
                          }
                        >
                          <input type="hidden" name="receipt_id" value={receipt.id} />
                          <button
                            type="submit"
                            className="h-8 px-4 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-xs transition-colors"
                          >
                            Approve
                          </button>
                        </form>
                      )}
                      <form
                        action={
                          rejectReceiptAction.bind(null, null) as unknown as (
                            formData: FormData
                          ) => Promise<void>
                        }
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="receipt_id" value={receipt.id} />
                        {/* Preset reasons (ticket 165). The chosen words go in the
                            shopper's needs-a-fix email and are saved as today. */}
                        <label htmlFor={`reason-${receipt.id}`} className="sr-only">
                          Reason it needs a fix
                        </label>
                        <select
                          id={`reason-${receipt.id}`}
                          name="rejection_reason"
                          required
                          defaultValue=""
                          className="h-8 px-2 rounded-lg border border-charcoal/20 bg-white font-body text-xs text-brand-black focus:outline-none focus:ring-1 focus:ring-amber-gold/60 w-56"
                        >
                          <option value="" disabled>
                            Pick a reason
                          </option>
                          {RECEIPT_FIX_REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                          <option value={OTHER_FIX_REASON}>Other</option>
                        </select>
                        <label htmlFor={`reason-other-${receipt.id}`} className="sr-only">
                          Other reason, used when Other is picked
                        </label>
                        <input
                          id={`reason-other-${receipt.id}`}
                          name="rejection_reason_other"
                          type="text"
                          placeholder="If Other, say why"
                          maxLength={FIX_REASON_MAX_LENGTH}
                          className="h-8 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-xs text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-1 focus:ring-amber-gold/60 w-48"
                        />
                        <button
                          type="submit"
                          className="h-8 px-4 rounded-full border border-charcoal/20 text-charcoal-soft hover:bg-red-50 hover:border-red-200 hover:text-red-600 font-subhead font-bold text-xs transition-colors"
                        >
                          Reject
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
