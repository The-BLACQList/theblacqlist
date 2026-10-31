import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ReceiptSubmissionForm } from '@/components/spend/ReceiptSubmissionForm'

export const metadata: Metadata = { title: 'Edit your receipt' }

interface ListingJoin {
  id: string
  name: string
  cities: { name: string } | null
}

export default async function EditReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/sign-in?next=/account/receipts/${id}/edit`)

  // Same route the account list and the write action take: receipt_uploads
  // carries owner SELECT/INSERT policies but no UPDATE policy, so ownership is
  // enforced here by scoping the query to the caller rather than by RLS.
  const serviceClient = createServiceClient()
  const { data: receipt } = await serviceClient
    .from('receipt_uploads')
    .select(
      `
      id,
      raw_business_name,
      amount_cents,
      purchase_date,
      notes,
      aggregate_opt_out,
      status,
      file_path,
      rejection_reason,
      listings ( id, name, cities ( name ) )
    `
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  // A receipt belonging to someone else is genuinely not found here, rather
  // than forbidden — a 403 would confirm the row exists.
  if (!receipt) notFound()

  // An approved receipt is locked for the same reason the action refuses it:
  // its amount is already folded into the community totals. Send the user back
  // to the list instead of rendering a form whose save can only fail. A
  // rejected one can be fixed and resent (ticket 164).
  if (receipt.status !== 'pending_review' && receipt.status !== 'rejected') {
    redirect('/account/receipts')
  }
  const needsFix = receipt.status === 'rejected'

  const listing = receipt.listings as unknown as ListingJoin | null

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-12 px-4">
      <div className="max-w-[560px] mx-auto space-y-6">
        <div>
          <Link
            href="/account/receipts"
            className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal-soft hover:text-amber mb-4 transition-colors"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            My receipts
          </Link>
          <h1 className="font-headline text-2xl text-brand-black">
            {needsFix ? 'Fix and resend' : 'Edit your receipt'}
          </h1>
          <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
            {needsFix
              ? "Fix what's below and send it back. We'll check it within 3 business days."
              : 'Fix anything you entered wrong. You can edit while it is still waiting.'}
          </p>
        </div>

        {needsFix && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="font-subhead text-sm font-semibold text-red-800">What to fix</p>
            <p className="font-body text-sm text-red-800 mt-0.5">
              {receipt.rejection_reason ?? 'Check the amount, date and photo.'}
            </p>
          </div>
        )}

        <div className="rounded-xl bg-white border border-charcoal/10 p-6">
          <ReceiptSubmissionForm
            receipt={{
              id: receipt.id,
              rawBusinessName: receipt.raw_business_name,
              listing: listing
                ? { id: listing.id, name: listing.name, cityName: listing.cities?.name ?? null }
                : null,
              amountCents: receipt.amount_cents,
              purchaseDate: receipt.purchase_date,
              notes: receipt.notes,
              aggregateOptOut: receipt.aggregate_opt_out,
              hasFile: receipt.file_path !== null,
              needsFix,
            }}
          />
        </div>
      </div>
    </main>
  )
}
