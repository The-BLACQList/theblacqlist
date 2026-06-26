import Link from 'next/link'
import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import { approveReceiptAction } from '@/lib/actions/spend/approveReceipt'
import { rejectReceiptAction } from '@/lib/actions/spend/rejectReceipt'
import { ReceiptStatusBadge } from '@/components/spend/ReceiptStatusBadge'

export const metadata: Metadata = { title: 'Receipts — Admin' }

type StatusFilter = 'pending_review' | 'approved' | 'rejected' | 'all'

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
    statusParam === 'approved'
      ? 'approved'
      : statusParam === 'rejected'
        ? 'rejected'
        : statusParam === 'all'
          ? 'all'
          : 'pending_review'

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
      listings(name, slug)
    `
    )
    .order('created_at', { ascending: false })
    .limit(100)

  if (activeFilter !== 'all') {
    query = query.eq('status', activeFilter)
  }

  const { data: receipts } = await query

  const receiptList = receipts ?? []

  const tabs: { label: string; value: StatusFilter }[] = [
    { label: 'Pending review', value: 'pending_review' },
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
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Receipts</h1>
        <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
          Review community receipt submissions
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-6 border-b border-charcoal/10">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/receipts${tab.value === 'pending_review' ? '' : `?status=${tab.value}`}`}
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
            No {activeFilter === 'all' ? '' : activeFilter.replace('_', ' ')} receipts found.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          <div className="divide-y divide-charcoal/5">
            {receiptList.map((receipt) => {
              const listing = receipt.listings as { name: string; slug: string } | null
              const businessLabel = listing?.name ?? receipt.raw_business_name ?? 'Unknown business'

              return (
                <div key={receipt.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-subhead text-sm font-semibold text-brand-black truncate">
                        {businessLabel}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="font-subhead text-xs text-charcoal-soft">
                          {formatDollars(receipt.amount_cents)}
                        </span>
                        <span className="text-charcoal/20">·</span>
                        <span className="font-subhead text-xs text-charcoal-soft">
                          {receipt.purchase_date}
                        </span>
                        <span className="text-charcoal/20">·</span>
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
                        <p className="font-body text-xs text-charcoal-faint mt-1">
                          Receipt image attached
                        </p>
                      )}
                    </div>
                    <ReceiptStatusBadge status={receipt.status} />
                  </div>

                  {receipt.status === 'pending_review' && (
                    <div className="flex items-center gap-3 pt-1">
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
                      <form
                        action={
                          rejectReceiptAction.bind(null, null) as unknown as (
                            formData: FormData
                          ) => Promise<void>
                        }
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="receipt_id" value={receipt.id} />
                        <input
                          name="rejection_reason"
                          type="text"
                          placeholder="Reason (optional)"
                          maxLength={200}
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
