import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, FileCheck } from 'lucide-react'
import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { ClaimWithdrawButton } from '@/components/claim/ClaimWithdrawButton'
import { buildEntityUrl } from '@/lib/listings/url'

export const metadata: Metadata = {
  title: 'My Claims | The BLACQList',
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: {
    label: 'Pending review',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  under_review: {
    label: 'Under review',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  withdrawn: {
    label: 'Withdrawn',
    className: 'bg-charcoal/5 text-charcoal-soft border-charcoal/15',
  },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function AccountClaimsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/account/claims')

  const { data: claims } = await supabase
    .from('claims')
    .select(
      'id, status, created_at, listings!claims_listing_id_fkey(id, name, slug, entity_type, cities!listings_city_id_fkey(slug), listing_details_business(city_text))'
    )
    .eq('claimant_user_id', user.id)
    .order('created_at', { ascending: false })

  const claimList = (claims ?? []) as Array<{
    id: string
    status: string
    created_at: string
    listings: {
      id: string
      name: string
      slug: string
      entity_type: string
      cities: { slug: string } | null
      listing_details_business: { city_text: string | null } | null
    } | null
  }>

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-12 px-4">
      <div className="max-w-[640px] mx-auto">
        {/* Back nav */}
        <Link
          href="/account"
          className="inline-flex items-center gap-1 font-subhead text-xs text-charcoal-soft hover:text-charcoal mb-6"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Back to account
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-headline text-3xl text-brand-black mb-1">My claims</h1>
          <p className="font-subhead text-sm text-charcoal-soft">
            Listing ownership claims you&apos;ve submitted
          </p>
        </div>

        {/* Empty state */}
        {claimList.length === 0 && (
          <div className="bg-white rounded-xl border border-charcoal/10 p-8 text-center">
            <FileCheck className="size-10 text-charcoal/20 mx-auto mb-3" aria-hidden="true" />
            <p className="font-subhead text-sm font-semibold text-brand-black mb-1">
              No claims yet
            </p>
            <p className="font-body text-sm text-charcoal-soft mb-4">
              You haven&apos;t submitted any listing claims.
            </p>
            <Link
              href="/claim"
              className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
            >
              Find a listing to claim
            </Link>
          </div>
        )}

        {/* Claims list */}
        {claimList.length > 0 && (
          <div className="space-y-3">
            {claimList.map((claim) => {
              const listing = claim.listings
              const city = listing?.listing_details_business?.city_text
              const statusInfo = STATUS_LABELS[claim.status] ?? STATUS_LABELS['pending']!
              const canWithdraw = ['pending', 'under_review'].includes(claim.status)

              return (
                <div key={claim.id} className="bg-white rounded-xl border border-charcoal/10 p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      {listing ? (
                        <Link
                          href={buildEntityUrl(
                            listing.entity_type,
                            listing.cities?.slug,
                            listing.slug
                          )}
                          className="font-subhead text-sm font-semibold text-brand-black hover:text-amber transition-colors"
                        >
                          {listing.name}
                        </Link>
                      ) : (
                        <p className="font-subhead text-sm font-semibold text-brand-black">
                          Listing unavailable
                        </p>
                      )}
                      {city && <p className="font-body text-xs text-charcoal-soft mt-0.5">{city}</p>}
                    </div>
                    <span
                      className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full border font-subhead text-xs font-semibold ${statusInfo.className}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-3 border-t border-charcoal/8">
                    <p className="font-body text-xs text-charcoal-soft">
                      Submitted {formatDate(claim.created_at)}
                    </p>
                    {canWithdraw && <ClaimWithdrawButton claimId={claim.id} />}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
