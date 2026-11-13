import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isReceiptId } from '@/lib/spend/counted-receipt'
import { buildSupportPost, supportScreen, type SupportReceipt } from '@/lib/share/supportCard'
import { getAppUrl } from '@/lib/env'
import { SupportPostStudio } from '@/components/support-share/SupportPostStudio'

export const metadata: Metadata = { title: 'Share your support' }

const linkCls =
  'inline-flex items-center min-h-11 font-subhead text-sm font-semibold text-amber-700 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60 rounded'

/**
 * The support post (ticket 183): after adding a receipt, the shopper can post
 * that they supported the business. Right after the upload it says
 * "Supported"; once the business verifies it, "Verified by The BLACQList".
 *
 * This page reads only what the post shows. It never selects the amount or
 * the receipt photo, so neither can reach the card.
 */
export default async function SupportSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ new?: string }>
}) {
  const [{ id }, { new: isNewParam }] = await Promise.all([params, searchParams])
  const isNew = isNewParam === '1'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/sign-in?next=/account/receipts/${id}/share`)

  if (!isReceiptId(id)) notFound()

  // receipt_uploads reads go through the service client like the list and
  // counted pages, scoped to the caller here.
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('receipt_uploads')
    .select(
      `
      user_id,
      status,
      purchase_date,
      listing_id,
      aggregate_opt_out,
      listings ( name, slug, entity_type, cities ( name, state_abbr, slug ) )
    `
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  const receipt = (data ?? null) as unknown as SupportReceipt | null
  const screen = supportScreen({ readFailed: !!error, receipt, viewerId: user.id })

  if (screen === 'not_found') notFound()
  if (screen === 'redirect') redirect('/account/receipts')
  const post =
    receipt && screen === 'show' ? buildSupportPost({ origin: getAppUrl(), receipt }) : null

  if (!post) {
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

  const heading = isNew
    ? post.collective
      ? 'You just added to The Collective 🖤'
      : 'Receipt added 🖤'
    : post.stage === 'verified'
      ? 'Your support is verified'
      : 'Share your support'

  const sub =
    post.stage === 'verified'
      ? 'Your receipt is verified, so your post gets the verified stamp.'
      : 'Share a post that you supported this business. Once your receipt is verified, you can share it again with the verified stamp.'

  return (
    <main>
      <div className="max-w-[560px] mx-auto">
        <section className="rounded-2xl bg-white border border-charcoal/10 px-5 py-8 sm:px-10 flex flex-col gap-6">
          <div className="text-center">
            <h1 className="font-headline text-2xl text-brand-black">{heading}</h1>
            <p className="font-body text-sm text-charcoal mt-2">{sub}</p>
          </div>

          <SupportPostStudio post={post} />

          <div className="flex justify-center">
            <Link
              href={isNew ? '/account/receipts?submitted=true' : '/account/receipts'}
              className={linkCls}
            >
              {isNew ? 'Not now' : 'Back to My receipts'}
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
