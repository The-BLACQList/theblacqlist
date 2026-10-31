import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Camera, Map as MapIcon, Plus, Store } from 'lucide-react'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ReceiptListRow } from '@/components/spend/ReceiptListRow'
import { formatDollarsExact } from '@/lib/spend/personal-spend'
import {
  countedTotalCents,
  receiptTally,
  sortReceipts,
  tallyLine,
} from '@/lib/spend/my-receipts'
import { ReceiptsLoadError } from './ReceiptsLoadError'

export const metadata: Metadata = { title: 'My receipts' }

interface ReceiptRow {
  id: string
  raw_business_name: string | null
  amount_cents: number
  purchase_date: string
  created_at: string
  status: string
  file_path: string | null
  rejection_reason: string | null
  listing_id: string | null
  listings: { name: string } | null
}

const addBtnCls =
  'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60'

/** The three steps from The Collective's first look (ticket 161), in short form. */
const STEPS = [
  { icon: Store, text: 'Shop at a business on the list.' },
  { icon: Camera, text: 'Add a receipt.' },
  { icon: MapIcon, text: 'Your spend joins the map.' },
] as const

export default async function MyReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; updated?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in?next=/account/receipts')

  const { submitted, updated } = await searchParams

  // receipt_uploads has no UPDATE policy, so every receipt read and write goes
  // through the service client, scoped to the caller here.
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('receipt_uploads')
    .select(
      `
      id,
      raw_business_name,
      amount_cents,
      purchase_date,
      created_at,
      status,
      file_path,
      rejection_reason,
      listing_id,
      listings(name)
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const receipts = error ? [] : sortReceipts((data ?? []) as unknown as ReceiptRow[])

  // Categories come from the same place CollectivePanel's do: the listing's
  // category, read as the shopper. If this read fails the rows just show
  // without a chip.
  const listingIds = [
    ...new Set(receipts.map((r) => r.listing_id).filter((v): v is string => v !== null)),
  ]
  const categoryById = new Map<string, string>()
  if (listingIds.length > 0) {
    const { data: listings } = await supabase
      .from('listings')
      .select('id, categories(name)')
      .in('id', listingIds)
    for (const l of (listings ?? []) as unknown as Array<{
      id: string
      categories: { name: string } | null
    }>) {
      if (l.categories?.name) categoryById.set(l.id, l.categories.name)
    }
  }

  const tally = receiptTally(receipts)
  const total = countedTotalCents(receipts)

  return (
    <main>
      <div className="max-w-[640px] mx-auto space-y-6">
        <div>
          <h1 className="font-headline text-2xl text-brand-black">My receipts</h1>
          <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
            Track your support for Black-owned businesses
          </p>
        </div>

        {submitted === 'true' && (
          <div role="status" className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
            <p className="font-subhead text-sm font-semibold text-green-800">Receipt added.</p>
            <p className="font-body text-xs text-green-700 mt-0.5">
              We&apos;ll check it within 3 business days.
            </p>
          </div>
        )}

        {updated === 'true' && (
          <div role="status" className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
            <p className="font-subhead text-sm font-semibold text-green-800">Changes saved.</p>
            <p className="font-body text-xs text-green-700 mt-0.5">
              We&apos;ll check it within 3 business days.
            </p>
          </div>
        )}

        {error ? (
          <div className="rounded-xl bg-white border border-charcoal/10">
            <ReceiptsLoadError />
          </div>
        ) : receipts.length === 0 ? (
          <div className="rounded-xl bg-white border border-charcoal/10 px-5 py-8 sm:px-8">
            <h2 className="font-subhead text-base font-semibold text-brand-black">
              No receipts yet
            </h2>
            <ol className="mt-4 space-y-3">
              {STEPS.map(({ icon: Icon, text }, i) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center size-9 shrink-0 rounded-full bg-amber-gold/15 text-amber">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="font-body text-sm text-brand-black">
                    <span className="sr-only">Step {i + 1}: </span>
                    {text}
                  </span>
                </li>
              ))}
            </ol>
            <Link href="/account/receipts/new" className={`${addBtnCls} mt-6 w-full sm:w-auto`}>
              <Plus className="size-4" aria-hidden="true" />
              Add your first receipt
            </Link>
          </div>
        ) : (
          <>
            <section
              aria-labelledby="counted-heading"
              className="rounded-xl bg-white border border-charcoal/10 p-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
            >
              <div>
                <h2
                  id="counted-heading"
                  className="font-subhead text-xs text-charcoal-soft font-semibold uppercase tracking-wide"
                >
                  Counted so far
                </h2>
                <p className="font-headline text-3xl text-brand-black mt-1 tabular-nums">
                  {formatDollarsExact(total)}
                </p>
                <p className="font-body text-sm text-charcoal-soft mt-0.5">{tallyLine(tally)}</p>
              </div>
              <Link href="/account/receipts/new" className={`${addBtnCls} w-full sm:w-auto`}>
                <Plus className="size-4" aria-hidden="true" />
                Add a receipt
              </Link>
            </section>

            <section
              aria-labelledby="receipts-heading"
              className="rounded-xl bg-white border border-charcoal/10"
            >
              <h2 id="receipts-heading" className="sr-only">
                Your receipts
              </h2>
              <ul className="divide-y divide-charcoal/5 px-5">
                {receipts.map((r) => (
                  <ReceiptListRow
                    key={r.id}
                    id={r.id}
                    businessName={r.listings?.name ?? r.raw_business_name ?? 'A business'}
                    isMatched={r.listing_id !== null}
                    category={r.listing_id ? (categoryById.get(r.listing_id) ?? null) : null}
                    amountCents={r.amount_cents}
                    purchaseDate={r.purchase_date}
                    status={r.status}
                    filePath={r.file_path}
                    rejectionReason={r.rejection_reason}
                  />
                ))}
              </ul>
            </section>
          </>
        )}

        <p className="font-body text-xs text-charcoal-faint text-center">
          Receipt details are private. Only you and BLACQList admins can view your submissions.
        </p>
      </div>
    </main>
  )
}
