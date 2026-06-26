import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { ClaimForm } from '@/components/claim/ClaimForm'

interface PageProps {
  params: Promise<{ listingId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { listingId } = await params
  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('name')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) return { title: 'Claim a Listing | The BLACQList' }

  return {
    title: `Claim ${listing.name} | The BLACQList`,
  }
}

export default async function ClaimListingPage({ params }: PageProps) {
  const { listingId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/sign-in?next=/claim/${listingId}`)
  }

  // ── Fetch listing ─────────────────────────────────────────────────────────
  const { data: listing } = await supabase
    .from('listings')
    .select(
      'id, name, slug, trust_tier, status, listing_details_business(city_text, state), categories(name)'
    )
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) notFound()

  // ── Already claimed state ─────────────────────────────────────────────────
  if (listing.trust_tier !== 'unclaimed') {
    return (
      <main className="min-h-screen bg-pale-lavender pt-16 pb-16 px-4">
        <div className="max-w-[640px] mx-auto">
          <div className="bg-white rounded-xl border border-charcoal/10 p-6 md:p-8">
            <h1 className="font-headline text-2xl text-brand-black mb-2">
              This listing has already been claimed
            </h1>
            <p className="font-body text-sm text-charcoal leading-relaxed mb-4">
              <span className="font-semibold">{listing.name}</span> has already been claimed by its
              owner. If you believe this is an error or need access, please{' '}
              <Link
                href="/contact"
                className="text-amber hover:text-light-gold underline underline-offset-2"
              >
                contact us
              </Link>
              .
            </p>
            <Link
              href="/claim"
              className="inline-flex items-center font-subhead text-sm font-semibold text-amber hover:text-light-gold underline underline-offset-2"
            >
              Search for another listing
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // ── Existing open claim state ─────────────────────────────────────────────
  const { data: existingClaim } = await supabase
    .from('claims')
    .select('id, status, created_at')
    .eq('listing_id', listingId)
    .eq('claimant_user_id', user.id)
    .in('status', ['pending', 'under_review'])
    .maybeSingle()

  if (existingClaim) {
    return (
      <main className="min-h-screen bg-pale-lavender pt-16 pb-16 px-4">
        <div className="max-w-[640px] mx-auto">
          <div className="bg-white rounded-xl border border-amber-gold/30 p-6 md:p-8">
            <h1 className="font-headline text-2xl text-brand-black mb-2">
              You already have a pending claim
            </h1>
            <p className="font-body text-sm text-charcoal leading-relaxed mb-4">
              You submitted a claim for <span className="font-semibold">{listing.name}</span>.
              We&apos;ll contact you once it&apos;s been reviewed.
            </p>
            <Link
              href="/account/claims"
              className="inline-flex items-center font-subhead text-sm font-semibold text-amber hover:text-light-gold underline underline-offset-2"
            >
              View your claims in your account
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // ── Listing details for display ───────────────────────────────────────────
  const details = listing.listing_details_business as {
    city_text: string | null
    state: string | null
  } | null
  const category = (listing.categories as { name: string } | null)?.name
  const locationParts = [details?.city_text, details?.state].filter(Boolean)

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-16 px-4">
      <div className="max-w-[640px] mx-auto">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <Link
            href="/claim"
            className="font-subhead text-xs text-charcoal-soft hover:text-charcoal underline underline-offset-2"
          >
            ← Back to search
          </Link>
        </nav>

        {/* Listing identity */}
        <div className="bg-white rounded-xl border border-charcoal/10 p-5 mb-6">
          <p className="font-subhead text-xs text-charcoal-soft uppercase tracking-wide mb-1">
            Claiming
          </p>
          <p className="font-headline text-xl text-brand-black">{listing.name}</p>
          {(category || locationParts.length > 0) && (
            <p className="font-body text-xs text-charcoal-soft mt-0.5">
              {[category, locationParts.join(', ')].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Page header */}
        <div className="mb-6">
          <h1 className="font-headline text-2xl md:text-3xl text-brand-black mb-1">
            Submit a claim
          </h1>
          <p className="font-body text-sm text-charcoal leading-relaxed">
            Provide your contact details and tell us your role at this business. We&apos;ll review
            your claim within 3–5 business days.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-charcoal/10 p-5 md:p-8">
          <ClaimForm listingId={listing.id} listingName={listing.name} />
        </div>
      </div>
    </main>
  )
}
