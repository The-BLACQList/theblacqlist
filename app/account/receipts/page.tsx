import Link from "next/link"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { ArrowLeft, Plus } from "lucide-react"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { ReceiptListRow } from "@/components/spend/ReceiptSubmissionForm"

export const metadata: Metadata = { title: "My Receipts" }

export default async function MyReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in?next=/account/receipts")

  const { submitted } = await searchParams

  const serviceClient = createServiceClient()

  const { data: receipts } = await serviceClient
    .from("receipt_uploads")
    .select(`
      id,
      raw_business_name,
      amount_cents,
      purchase_date,
      status,
      file_path,
      listing_id,
      listings(name)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const receiptList = receipts ?? []

  const totalApproved = receiptList
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + r.amount_cents, 0)

  function formatDollars(cents: number) {
    return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
  }

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-12 px-4">
      <div className="max-w-[640px] mx-auto space-y-6">
        <div>
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal/50 hover:text-amber-gold mb-4 transition-colors"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Account
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-headline text-2xl text-brand-black">My receipts</h1>
              <p className="font-subhead text-sm text-charcoal/60 mt-0.5">
                Track your support for Black-owned businesses
              </p>
            </div>
            <Link
              href="/account/receipts/new"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors shrink-0"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add receipt
            </Link>
          </div>
        </div>

        {/* Success banner */}
        {submitted === "true" && (
          <div role="status" className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
            <p className="font-subhead text-sm font-semibold text-green-800">
              Receipt submitted — thank you!
            </p>
            <p className="font-body text-xs text-green-700 mt-0.5">
              Our team will review it within 1–3 business days.
            </p>
          </div>
        )}

        {/* Impact summary */}
        {totalApproved > 0 && (
          <div className="rounded-xl bg-white border border-charcoal/10 p-5">
            <p className="font-subhead text-xs text-charcoal/50 font-semibold uppercase tracking-wide">
              Verified community spend
            </p>
            <p className="font-headline text-3xl text-brand-black mt-1">
              {formatDollars(totalApproved)}
            </p>
            <p className="font-body text-xs text-charcoal/50 mt-0.5">
              Across {receiptList.filter((r) => r.status === "approved").length} approved {receiptList.filter((r) => r.status === "approved").length === 1 ? "receipt" : "receipts"}
            </p>
          </div>
        )}

        {/* Receipt list */}
        <div className="rounded-xl bg-white border border-charcoal/10 overflow-hidden">
          {receiptList.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-subhead text-sm font-semibold text-brand-black">No receipts yet</p>
              <p className="font-body text-xs text-charcoal/50 mt-1 mb-4">
                Submit a receipt to start tracking your community impact.
              </p>
              <Link
                href="/account/receipts/new"
                className="inline-flex items-center gap-2 h-9 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
              >
                <Plus className="size-4" aria-hidden="true" />
                Submit your first receipt
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-charcoal/5 px-5">
              {receiptList.map((receipt) => {
                const listing = receipt.listings as { name: string } | null
                return (
                  <ReceiptListRow
                    key={receipt.id}
                    id={receipt.id}
                    rawBusinessName={receipt.raw_business_name}
                    listingName={listing?.name ?? null}
                    amountCents={receipt.amount_cents}
                    purchaseDate={receipt.purchase_date}
                    status={receipt.status}
                    hasFile={!!receipt.file_path}
                  />
                )
              })}
            </div>
          )}
        </div>

        <p className="font-body text-xs text-charcoal/40 text-center">
          Receipt details are private. Only you and BLACQList admins can view your submissions.
        </p>
      </div>
    </main>
  )
}
