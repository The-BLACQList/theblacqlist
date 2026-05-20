import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge'
import { EntityApprovalActions } from '@/components/admin/EntityApprovalActions'
import { TrustTierActions } from '@/components/admin/TrustTierActions'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const serviceClient = createServiceClient()
  const { data } = await serviceClient.from('listings').select('name').eq('id', id).maybeSingle()
  return { title: data?.name ?? 'Entity Detail' }
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 border-b border-charcoal/8 last:border-0">
      <dt className="w-36 shrink-0 font-subhead text-xs text-charcoal/60 pt-0.5">{label}</dt>
      <dd className="flex-1 font-body text-sm text-brand-black">
        {value ?? <span className="text-charcoal/40">—</span>}
      </dd>
    </div>
  )
}

export default async function AdminEntityDetailPage({ params }: PageProps) {
  await requireAdmin()
  const { id } = await params
  const serviceClient = createServiceClient()

  const { data: listing } = await serviceClient
    .from('listings')
    .select(
      'id, name, entity_type, status, trust_tier, tagline, created_at, submitted_by, source, category_id, categories(name), listing_details_business(description, email, phone, website_url, city_text, state, cta_type, social_instagram, social_facebook)'
    )
    .eq('id', id)
    .maybeSingle()

  if (!listing) notFound()

  const details = listing.listing_details_business as {
    description: string | null
    email: string | null
    phone: string | null
    website_url: string | null
    city_text: string | null
    state: string | null
    cta_type: string | null
    social_instagram: string | null
    social_facebook: string | null
  } | null

  const category = listing.categories as { name: string } | null

  // Fetch submitter profile if available
  const { data: submitterProfile } = listing.submitted_by
    ? await serviceClient
        .from('profiles')
        .select('display_name')
        .eq('id', listing.submitted_by)
        .maybeSingle()
    : { data: null }

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link
        href="/admin/entities"
        className="inline-flex items-center gap-1 font-subhead text-xs text-charcoal/60 hover:text-charcoal"
      >
        ← Back to entities
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1">
          <h1 className="font-headline text-2xl text-brand-black">{listing.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <AdminStatusBadge status={listing.status} />
            <AdminStatusBadge status={listing.trust_tier} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Listing details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-charcoal/10 bg-white p-5">
            <h2 className="font-headline text-base text-brand-black mb-3">Listing info</h2>
            <dl>
              <Row label="Name" value={listing.name} />
              <Row label="Tagline" value={listing.tagline} />
              <Row
                label="Type"
                value={<span className="capitalize">{listing.entity_type.replace(/_/g, ' ')}</span>}
              />
              <Row label="Category" value={category?.name} />
              <Row label="Status" value={<AdminStatusBadge status={listing.status} />} />
              <Row label="Trust tier" value={<AdminStatusBadge status={listing.trust_tier} />} />
              <Row label="Source" value={listing.source} />
              <Row
                label="Submitted by"
                value={submitterProfile?.display_name ?? listing.submitted_by ?? 'Unknown'}
              />
              <Row label="Submitted at" value={new Date(listing.created_at).toLocaleString()} />
            </dl>
          </div>

          <div className="rounded-xl border border-charcoal/10 bg-white p-5">
            <h2 className="font-headline text-base text-brand-black mb-3">Business details</h2>
            {details ? (
              <dl>
                <Row
                  label="Description"
                  value={
                    details.description && (
                      <p className="whitespace-pre-wrap leading-relaxed">{details.description}</p>
                    )
                  }
                />
                <Row
                  label="Location"
                  value={[details.city_text, details.state].filter(Boolean).join(', ') || null}
                />
                <Row label="Email" value={details.email} />
                <Row label="Phone" value={details.phone} />
                <Row
                  label="Website"
                  value={
                    details.website_url && (
                      <a
                        href={details.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-gold hover:underline truncate block"
                      >
                        {details.website_url}
                      </a>
                    )
                  }
                />
                <Row label="CTA type" value={details.cta_type} />
                <Row label="Instagram" value={details.social_instagram} />
                <Row label="Facebook" value={details.social_facebook} />
              </dl>
            ) : (
              <p className="font-body text-sm text-charcoal/50">No business details found.</p>
            )}
          </div>
        </div>

        {/* Action panel */}
        <div className="space-y-4">
          <div className="rounded-xl border border-charcoal/10 bg-white p-5">
            <h2 className="font-headline text-base text-brand-black mb-4">Admin actions</h2>
            {listing.status === 'pending' ? (
              <EntityApprovalActions listingId={listing.id} listingName={listing.name} />
            ) : (
              <div className="rounded-lg bg-[#f5f5f7] px-4 py-3">
                <p className="font-subhead text-sm text-charcoal/60">
                  This listing is <strong>{listing.status}</strong>. No further action needed.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-charcoal/10 bg-white p-5">
            <h2 className="font-headline text-base text-brand-black mb-4">Trust tier</h2>
            <TrustTierActions listingId={listing.id} currentTier={listing.trust_tier} />
          </div>

          <div className="rounded-xl border border-charcoal/10 bg-white p-5">
            <h2 className="font-headline text-base text-brand-black mb-3">Listing ID</h2>
            <p className="font-mono text-xs text-charcoal/60 break-all">{listing.id}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
