import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { Star } from 'lucide-react'

import { requireAdmin } from '@/lib/admin/guard'
import { resolveUserLabels, UNKNOWN_USER_LABEL } from '@/lib/admin/userLabel'
import { createServiceClient } from '@/lib/supabase/server'
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge'
import { ReviewModerationActions } from '@/components/admin/ReviewModerationActions'
import { buildEntityUrl } from '@/lib/listings/url'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const serviceClient = createServiceClient()
  const { data } = await serviceClient
    .from('reviews')
    .select('listings(name)')
    .eq('id', id)
    .maybeSingle()
  const listing = data?.listings as { name: string } | null
  return { title: listing?.name ? `Review — ${listing.name}` : 'Review Detail' }
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

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`size-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'fill-none text-charcoal/20'}`}
          aria-hidden="true"
        />
      ))}
      <span className="ml-1.5 font-subhead text-sm font-semibold text-brand-black">
        {rating} / 5
      </span>
    </span>
  )
}

export default async function AdminReviewDetailPage({ params }: PageProps) {
  await requireAdmin()
  const { id } = await params
  const serviceClient = createServiceClient()

  const { data: review } = await serviceClient
    .from('reviews')
    .select(
      'id, status, rating, title, body, visit_date, is_verified_purchase, rejection_reason, reviewed_at, created_at, reviewer_user_id, reviewed_by, listing_id, listings(id, name, slug, entity_type, cities(slug))'
    )
    .eq('id', id)
    .maybeSingle()

  if (!review) notFound()

  // Review photos (any approval state — the admin should see pending ones before deciding).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const { data: photoRows } = await serviceClient
    .from('media_attachments')
    .select('id, file_path, is_approved')
    .eq('entity_type', 'review')
    .eq('entity_id', id)
    .order('created_at', { ascending: true })
  const photos = (photoRows ?? []).map((p) => ({
    id: p.id,
    src: `${supabaseUrl}/storage/v1/object/public/listing-media/${p.file_path}`,
    isApproved: p.is_approved,
  }))

  const listing = review.listings as {
    id: string
    name: string
    slug: string
    entity_type: string
    cities: { slug: string } | null
  } | null

  // Reviewer + deciding-admin labels: display_name → auth email, resolved
  // together. This page originated the fallback ladder; it now shares it.
  const userLabels = await resolveUserLabels(serviceClient, [
    review.reviewer_user_id,
    review.reviewed_by,
  ])
  const reviewerLabel = review.reviewer_user_id
    ? (userLabels[review.reviewer_user_id] ?? null)
    : null
  const adminLabel = review.reviewed_by ? (userLabels[review.reviewed_by] ?? null) : null

  const entityHref =
    listing?.slug && listing?.entity_type
      ? buildEntityUrl(listing.entity_type, listing.cities?.slug, listing.slug)
      : null

  const isReviewable = review.status === 'intake' || review.status === 'pending_approval'

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link
        href="/admin/reviews"
        className="inline-flex items-center gap-1 font-subhead text-xs text-charcoal-soft hover:text-charcoal"
      >
        ← Back to reviews
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1">
          <h1 className="font-headline text-2xl text-brand-black">
            Review — {listing?.name ?? 'Unknown Business'}
          </h1>
          <div className="flex items-center gap-3 mt-1.5">
            <AdminStatusBadge status={review.status} />
            <StarRating rating={review.rating} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Review + reviewer details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Review content */}
          <div className="rounded-xl border border-charcoal/10 bg-white p-5">
            <h2 className="font-headline text-base text-brand-black mb-3">Review content</h2>
            {review.title && (
              <p className="font-subhead text-base font-semibold text-brand-black mb-2">
                {review.title}
              </p>
            )}
            {review.body ? (
              <p className="font-body text-sm text-charcoal/80 leading-relaxed whitespace-pre-wrap">
                {review.body}
              </p>
            ) : (
              <p className="font-body text-sm text-charcoal-faint italic">No written review body.</p>
            )}

            <div className="mt-4 pt-4 border-t border-charcoal/8">
              <dl>
                <Row label="Rating" value={<StarRating rating={review.rating} />} />
                {review.visit_date && (
                  <Row
                    label="Visit date"
                    value={new Date(review.visit_date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  />
                )}
                <Row label="Verified visit" value={review.is_verified_purchase ? 'Yes' : 'No'} />
                <Row label="Submitted" value={new Date(review.created_at).toLocaleString()} />
              </dl>
            </div>
          </div>

          {/* Review photos (pending until the review is published) */}
          {photos.length > 0 && (
            <div className="rounded-xl border border-charcoal/10 bg-white p-5">
              <h2 className="font-headline text-base text-brand-black mb-1">
                Photos ({photos.length})
              </h2>
              <p className="font-body text-xs text-charcoal-soft mb-3">
                Publishing this review makes these photos public. Rejecting keeps them hidden.
              </p>
              <div className="flex flex-wrap gap-3">
                {photos.map((p) => (
                  <a
                    key={p.id}
                    href={p.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative block"
                  >
                    <Image
                      src={p.src}
                      alt="Review photo"
                      width={112}
                      height={112}
                      className="size-28 rounded-lg object-cover border border-charcoal/10"
                    />
                    {!p.isApproved && (
                      <span className="absolute top-1 left-1 rounded bg-amber-100 text-amber-800 font-subhead text-[10px] font-semibold px-1.5 py-0.5">
                        Pending
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Reviewer info */}
          <div className="rounded-xl border border-charcoal/10 bg-white p-5">
            <h2 className="font-headline text-base text-brand-black mb-3">Reviewer</h2>
            <dl>
              <Row label="Name" value={reviewerLabel ?? UNKNOWN_USER_LABEL} />
              <Row
                label="User ID"
                value={
                  review.reviewer_user_id ? (
                    <span className="font-mono text-xs text-charcoal-soft break-all">
                      {review.reviewer_user_id}
                    </span>
                  ) : null
                }
              />
            </dl>
          </div>

          {/* Listing info */}
          <div className="rounded-xl border border-charcoal/10 bg-white p-5">
            <h2 className="font-headline text-base text-brand-black mb-3">Business reviewed</h2>
            {listing ? (
              <dl>
                <Row label="Name" value={listing.name} />
                <Row
                  label="View listing"
                  value={
                    entityHref ? (
                      <Link
                        href={entityHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-subhead text-xs font-semibold text-amber hover:text-light-gold"
                      >
                        Open listing page →
                      </Link>
                    ) : (
                      <Link
                        href={`/admin/entities/${listing.id}`}
                        className="font-subhead text-xs font-semibold text-amber hover:text-light-gold"
                      >
                        Open entity admin page →
                      </Link>
                    )
                  }
                />
              </dl>
            ) : (
              <p className="font-body text-sm text-charcoal-soft">Associated listing not found.</p>
            )}
          </div>

          {/* Decision info (shown if already decided) */}
          {!isReviewable && (review.reviewed_at || review.rejection_reason) && (
            <div className="rounded-xl border border-charcoal/10 bg-white p-5">
              <h2 className="font-headline text-base text-brand-black mb-3">Moderation decision</h2>
              <dl>
                <Row
                  label="Decided by"
                  value={adminLabel ?? '—'}
                />
                <Row
                  label="Decided at"
                  value={review.reviewed_at ? new Date(review.reviewed_at).toLocaleString() : null}
                />
                {review.rejection_reason && (
                  <Row
                    label="Rejection reason"
                    value={
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {review.rejection_reason}
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
              <ReviewModerationActions reviewId={review.id} />
            ) : (
              <div className="rounded-lg bg-[#f5f5f7] px-4 py-3">
                <p className="font-subhead text-sm text-charcoal-soft">
                  This review is <strong>{review.status.replace(/_/g, ' ')}</strong>. No further
                  action needed.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-charcoal/10 bg-white p-5">
            <h2 className="font-headline text-base text-brand-black mb-3">Review ID</h2>
            <p className="font-mono text-xs text-charcoal-soft break-all">{review.id}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
