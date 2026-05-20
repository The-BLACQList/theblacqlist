import { notFound } from "next/navigation"
import Link from "next/link"
import { BadgeCheck, CheckCircle2, Clock } from "lucide-react"
import type { Metadata } from "next"

import { requireOwner } from "@/lib/dashboard/guard"
import { createClient } from "@/lib/supabase/server"
import { VerificationUploadForm } from "@/components/dashboard/VerificationUploadForm"

interface Props {
  params: Promise<{ entityId: string }>
}

export const metadata: Metadata = { title: "Verification | Dashboard" }

export default async function OwnerVerificationPage({ params }: Props) {
  await requireOwner()
  const { entityId } = await params
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from("listings")
    .select("id, name, trust_tier, verification_status, verification_docs, verification_notes, verified_at, owner_user_id")
    .eq("id", entityId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!listing) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  if (listing.owner_user_id !== user?.id) notFound()

  const { trust_tier, verification_status } = listing

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <Link
          href={`/dashboard/pages/${entityId}`}
          className="inline-flex items-center gap-1 font-subhead text-xs text-charcoal/60 hover:text-charcoal mb-4"
        >
          ← Back to listing
        </Link>
        <h1 className="font-headline text-2xl text-brand-black">Get Verified</h1>
        <p className="font-body text-sm text-charcoal/60 mt-1">
          A Verified badge shows customers your business is legitimate and trusted.
        </p>
      </div>

      {trust_tier !== "claimed" && (
        <div className="rounded-xl border border-charcoal/10 bg-[#f5f5f7] px-5 py-5">
          <p className="font-subhead text-sm font-semibold text-brand-black">
            Verification not available
          </p>
          <p className="font-body text-sm text-charcoal/70 mt-1">
            Verification is only available for claimed listings. Your listing must be claimed first.
          </p>
          <Link
            href="/claim"
            className="inline-flex items-center gap-1 mt-3 font-subhead text-xs font-semibold text-amber-gold hover:text-light-gold"
          >
            Claim this listing →
          </Link>
        </div>
      )}

      {trust_tier === "claimed" && verification_status === "verified" && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-5 flex items-start gap-3">
          <CheckCircle2 className="size-5 shrink-0 text-green-600 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-subhead text-sm font-semibold text-green-800">
              Listing verified
            </p>
            <p className="font-body text-sm text-green-700 mt-0.5">
              {listing.verified_at
                ? `Verified on ${new Date(listing.verified_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
                : "Your listing has been verified."}
            </p>
          </div>
        </div>
      )}

      {trust_tier === "claimed" &&
        (verification_status === "pending" || verification_status === "under_review") && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-5 flex items-start gap-3">
            <Clock className="size-5 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-subhead text-sm font-semibold text-amber-800">
                Under review
              </p>
              <p className="font-body text-sm text-amber-700 mt-0.5">
                Your verification documents have been received. Our team typically responds within
                2–3 business days.
              </p>
            </div>
          </div>
        )}

      {trust_tier === "claimed" &&
        (verification_status === "none" ||
          verification_status === "rejected" ||
          !verification_status) && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-charcoal/10 bg-white px-5 py-4">
              <BadgeCheck className="size-5 shrink-0 text-amber-gold mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-subhead text-sm font-semibold text-brand-black">
                  How it works
                </p>
                <ol className="mt-1.5 space-y-1 font-body text-sm text-charcoal/70 list-decimal list-inside">
                  <li>Upload one or more verification documents below</li>
                  <li>Our team reviews them within 2–3 business days</li>
                  <li>Once approved, your listing shows a Verified badge</li>
                </ol>
              </div>
            </div>

            <VerificationUploadForm
              listingId={entityId}
              rejectionNotes={
                verification_status === "rejected"
                  ? (listing.verification_notes ?? null)
                  : null
              }
            />
          </div>
        )}
    </div>
  )
}
