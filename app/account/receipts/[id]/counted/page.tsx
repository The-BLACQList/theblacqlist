import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { AlertCircle, ArrowUpRight, Check } from 'lucide-react'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { formatDollarsExact } from '@/lib/spend/personal-spend'
import { receiptBusinessName } from '@/lib/spend/receipt-emails'
import { countedScreen, isReceiptId, joinedMap } from '@/lib/spend/counted-receipt'
import { getAppUrl } from '@/lib/env'
import { CountedShare } from '@/components/spend/CountedShare'

export const metadata: Metadata = { title: 'Your spend is counted' }

interface CountedRow {
  id: string
  user_id: string
  status: string
  amount_cents: number
  raw_business_name: string | null
  listing_id: string | null
  aggregate_opt_out: boolean
  listings: { name: string; categories: { name: string } | null } | null
}

const primaryBtnCls =
  'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60'

const linkCls =
  'inline-flex items-center min-h-11 font-subhead text-sm font-semibold text-amber-700 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60 rounded'

const chipCls =
  'inline-flex items-center px-2 py-0.5 rounded-full font-subhead text-xs font-semibold max-w-full truncate'

/** The counted screen (ticket 166, Part A): the moment after a receipt is approved. */
export default async function CountedReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/sign-in?next=/account/receipts/${id}/counted`)

  if (!isReceiptId(id)) notFound()

  // receipt_uploads has no UPDATE policy, so receipt reads go through the
  // service client like the list and edit pages, scoped to the caller here.
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('receipt_uploads')
    .select(
      `
      id,
      user_id,
      status,
      amount_cents,
      raw_business_name,
      listing_id,
      aggregate_opt_out,
      listings ( name, categories ( name ) )
    `
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  const receipt = (data ?? null) as unknown as CountedRow | null
  const screen = countedScreen({ readFailed: !!error, receipt, viewerId: user.id })

  if (screen === 'not_found') notFound()
  if (screen === 'redirect') redirect('/account/receipts')
  if (screen === 'error' || !receipt) {
    return (
      <main>
        <div className="max-w-[560px] mx-auto">
          <div
            role="alert"
            className="rounded-xl bg-white border border-charcoal/10 px-5 py-12 flex flex-col items-center text-center gap-3"
          >
            <AlertCircle className="size-10 text-charcoal" aria-hidden="true" />
            <h1 className="font-headline text-xl text-brand-black">
              We couldn&apos;t load this receipt.
            </h1>
            <p className="font-body text-sm text-charcoal max-w-sm">
              Something went wrong on our end. Try again in a moment.
            </p>
            <Link href="/account/receipts" className={linkCls}>
              Back to My receipts
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const businessName = receiptBusinessName(receipt.listings?.name, receipt.raw_business_name)
  const category = receipt.listings?.categories?.name ?? null
  const onMap = joinedMap(receipt)
  const offMapReason =
    receipt.listing_id === null
      ? "This business isn't on the list yet, so it counts in your total but not on the map."
      : 'You kept this receipt out of the community totals, so it counts in your total but not on the map.'

  return (
    <main>
      <div className="max-w-[560px] mx-auto">
        <section className="rounded-2xl bg-white border border-charcoal/10 px-5 py-10 sm:px-10 flex flex-col items-center text-center">
          {/* The ring draws in once. Reduced motion gets the finished ring. */}
          <div className="relative size-28" aria-hidden="true">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                r="52"
                className="fill-none stroke-amber-gold/20"
                strokeWidth="8"
              />
              <circle
                cx="60"
                cy="60"
                r="52"
                pathLength={100}
                className="blacq-counted-ring fill-none stroke-amber-gold"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="100"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center">
              <Check className="size-10 text-amber-700" strokeWidth={2.5} />
            </span>
          </div>

          <p className="font-headline text-4xl text-brand-black mt-6">
            {formatDollarsExact(receipt.amount_cents)}
          </p>
          <p className="font-subhead text-base text-brand-black mt-1">at {businessName}</p>
          <div className="mt-2">
            {receipt.listing_id === null ? (
              <span className={`${chipCls} bg-charcoal/5 text-charcoal-soft`}>
                Not on the list yet
              </span>
            ) : (
              category && (
                <span className={`${chipCls} bg-pale-lavender text-brand-black`}>{category}</span>
              )
            )}
          </div>

          <h1 className="font-headline text-2xl text-brand-black mt-6">
            {onMap ? 'Your spend joined the map' : 'Your spend is counted'}
          </h1>
          {!onMap && (
            <p className="font-body text-sm text-charcoal mt-2 max-w-sm">{offMapReason}</p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-6">
            {onMap ? (
              <Link href="/flow-map" className={primaryBtnCls}>
                See it on the map
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            ) : (
              <Link href="/account/receipts" className={primaryBtnCls}>
                See my receipts
              </Link>
            )}
            {onMap && (
              <Link href="/account/receipts" className={linkCls}>
                My receipts
              </Link>
            )}
          </div>

          <p className="font-body text-xs text-charcoal-soft mt-4">Nobody’s name is shown.</p>

          {/* Share only what's true: a receipt off the map isn't in The Collective.
              No business has a way to opt in to being named yet, so the text
              names none and links to /flow-map. Wire the opt-in here when it lands. */}
          {onMap && (
            <CountedShare
              origin={getAppUrl()}
              businessName={businessName}
              businessPath={null}
              businessNameOptIn={false}
              amountCents={receipt.amount_cents}
            />
          )}
        </section>
      </div>
    </main>
  )
}
