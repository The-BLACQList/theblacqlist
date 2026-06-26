import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge'
import { ClaimApprovalActions } from '@/components/admin/ClaimApprovalActions'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const serviceClient = createServiceClient()
  const { data } = await serviceClient
    .from('claims')
    .select('listings!claims_listing_id_fkey(name)')
    .eq('id', id)
    .maybeSingle()
  const listing = data?.listings as { name: string } | null
  return { title: listing?.name ? `Claim — ${listing.name}` : 'Claim Detail' }
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 border-b border-charcoal/8 last:border-0">
      <dt className="w-36 shrink-0 font-subhead text-xs text-charcoal-soft pt-0.5">{label}</dt>
      <dd className="flex-1 font-body text-sm text-brand-black">
        {value ?? <span className="text-charcoal-faint">—</span>}
      </dd>
    </div>
  )
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  authorized_agent: 'Authorized Agent',
}

export default async function AdminClaimDetailPage({ params }: PageProps) {
  await requireAdmin()
  const { id } = await params
  const serviceClient = createServiceClient()

  const { data: claim } = await serviceClient
    .from('claims')
    .select(
      'id, status, role_at_business, verification_email, verification_phone, notes, rejection_reason, submitted_at, created_at, reviewed_at, claimant_user_id, reviewed_by, listing_id, listings!claims_listing_id_fkey(id, name, entity_type, status, trust_tier, categories(name))'
    )
    .eq('id', id)
    .maybeSingle()

  if (!claim) notFound()

  const listing = claim.listings as {
    id: string
    name: string
    entity_type: string
    status: string
    trust_tier: string
    categories: { name: string } | null
  } | null

  const category = listing?.categories as { name: string } | null

  // Fetch claimant profile
  const { data: claimantProfile } = claim.claimant_user_id
    ? await serviceClient
        .from('profiles')
        .select('display_name')
        .eq('id', claim.claimant_user_id)
        .maybeSingle()
    : { data: null }

  // Fetch reviewer profile if claim has been reviewed
  const { data: reviewerProfile } = claim.reviewed_by
    ? await serviceClient
        .from('profiles')
        .select('display_name')
        .eq('id', claim.reviewed_by)
        .maybeSingle()
    : { data: null }

  const submittedDate = claim.submitted_at ?? claim.created_at
  const isReviewable = claim.status === 'pending' || claim.status === 'under_review'

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link
        href="/admin/claims"
        className="inline-flex items-center gap-1 font-subhead text-xs text-charcoal-soft hover:text-charcoal"
      >
        ← Back to claims
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1">
          <h1 className="font-headline text-2xl text-brand-black">
            Claim — {listing?.name ?? 'Unknown Business'}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <AdminStatusBadge status={claim.status} />
            {claim.role_at_business && (
              <span className="font-subhead text-xs text-charcoal-soft capitalize">
                {ROLE_LABELS[claim.role_at_business] ?? claim.role_at_business}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Claim + listing details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Claimant info */}
          <div className="rounded-xl border border-charcoal/10 bg-white p-5">
            <h2 className="font-headline text-base text-brand-black mb-3">Claimant</h2>
            <dl>
              <Row label="Name" value={claimantProfile?.display_name ?? 'Unknown'} />
              <Row
                label="User ID"
                value={
                  <span className="font-mono text-xs text-charcoal-soft break-all">
                    {claim.claimant_user_id ?? '—'}
                  </span>
                }
              />
              <Row
                label="Role claimed"
                value={
                  claim.role_at_business ? (
                    <span className="capitalize">
                      {ROLE_LABELS[claim.role_at_business] ?? claim.role_at_business}
                    </span>
                  ) : null
                }
              />
              <Row label="Verification email" value={claim.verification_email} />
              <Row label="Verification phone" value={claim.verification_phone} />
              <Row
                label="Notes"
                value={
                  claim.notes && (
                    <p className="whitespace-pre-wrap leading-relaxed">{claim.notes}</p>
                  )
                }
              />
              <Row label="Submitted" value={new Date(submittedDate).toLocaleString()} />
            </dl>
          </div>

          {/* Listing info */}
          <div className="rounded-xl border border-charcoal/10 bg-white p-5">
            <h2 className="font-headline text-base text-brand-black mb-3">
              Business being claimed
            </h2>
            {listing ? (
              <dl>
                <Row label="Name" value={listing.name} />
                <Row
                  label="Type"
                  value={
                    <span className="capitalize">{listing.entity_type.replace(/_/g, ' ')}</span>
                  }
                />
                <Row label="Category" value={category?.name} />
                <Row label="Listing status" value={<AdminStatusBadge status={listing.status} />} />
                <Row label="Trust tier" value={<AdminStatusBadge status={listing.trust_tier} />} />
                <Row
                  label="View listing"
                  value={
                    <Link
                      href={`/admin/entities/${listing.id}`}
                      className="font-subhead text-xs font-semibold text-amber hover:text-light-gold"
                    >
                      Open entity page →
                    </Link>
                  }
                />
              </dl>
            ) : (
              <p className="font-body text-sm text-charcoal-soft">Associated listing not found.</p>
            )}
          </div>

          {/* Review info (shown if already decided) */}
          {!isReviewable && (
            <div className="rounded-xl border border-charcoal/10 bg-white p-5">
              <h2 className="font-headline text-base text-brand-black mb-3">Review decision</h2>
              <dl>
                <Row
                  label="Reviewed by"
                  value={reviewerProfile?.display_name ?? claim.reviewed_by ?? '—'}
                />
                <Row
                  label="Reviewed at"
                  value={claim.reviewed_at ? new Date(claim.reviewed_at).toLocaleString() : null}
                />
                {claim.rejection_reason && (
                  <Row
                    label="Rejection reason"
                    value={
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {claim.rejection_reason}
                      </p>
                    }
                  />
                )}
              </dl>
            </div>
          )}
        </div>

        {/* Action panel */}
        <div className="space-y-4">
          <div className="rounded-xl border border-charcoal/10 bg-white p-5">
            <h2 className="font-headline text-base text-brand-black mb-4">Admin actions</h2>
            {isReviewable ? (
              <ClaimApprovalActions
                claimId={claim.id}
                claimantName={claimantProfile?.display_name ?? 'this user'}
              />
            ) : (
              <div className="rounded-lg bg-[#f5f5f7] px-4 py-3">
                <p className="font-subhead text-sm text-charcoal-soft">
                  This claim is <strong>{claim.status.replace(/_/g, ' ')}</strong>. No further
                  action needed.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-charcoal/10 bg-white p-5">
            <h2 className="font-headline text-base text-brand-black mb-3">Claim ID</h2>
            <p className="font-mono text-xs text-charcoal-soft break-all">{claim.id}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
