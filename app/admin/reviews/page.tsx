import Link from 'next/link'
import type { Metadata } from 'next'
import { Star } from 'lucide-react'

import { requireAdmin } from '@/lib/admin/guard'
import { resolveUserLabels, UNKNOWN_USER_LABEL } from '@/lib/admin/userLabel'
import { createServiceClient } from '@/lib/supabase/server'
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge'

export const metadata: Metadata = { title: 'Reviews' }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`size-3 ${i < rating ? 'fill-amber-400 text-amber-400' : 'fill-none text-charcoal/20'}`}
          aria-hidden="true"
        />
      ))}
      <span className="ml-1 font-mono text-xs text-charcoal-soft">{rating}</span>
    </span>
  )
}

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>
}

export default async function AdminReviewsPage({ searchParams }: PageProps) {
  await requireAdmin()
  const { status = 'intake', page = '1' } = await searchParams

  const pageNum = Math.max(1, parseInt(page))
  const limit = 25
  const offset = (pageNum - 1) * limit

  const serviceClient = createServiceClient()

  const { data: reviews, count } = await serviceClient
    .from('reviews')
    .select('id, status, rating, title, body, created_at, reviewer_user_id, listings(name)', {
      count: 'exact',
    })
    .eq('status', status)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)

  const totalPages = Math.ceil((count ?? 0) / limit)

  // Reviewer labels for the visible page: display_name → auth email, batched.
  const reviewerLabels = await resolveUserLabels(
    serviceClient,
    (reviews ?? []).map((r) => r.reviewer_user_id)
  )

  const STATUS_TABS = [
    { value: 'intake', label: 'Pending' },
    { value: 'published', label: 'Published' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'removed', label: 'Removed' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Review moderation</h1>
        <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
          Approve or reject user-submitted reviews before they appear on listing pages.
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-charcoal/10">
        {STATUS_TABS.map(({ value, label }) => (
          <Link
            key={value}
            href={`/admin/reviews?status=${value}`}
            className={`px-4 py-2 font-subhead text-sm font-semibold border-b-2 -mb-px transition-colors ${
              status === value
                ? 'border-amber-gold text-amber'
                : 'border-transparent text-charcoal-soft hover:text-brand-black'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Table */}
      {!reviews || reviews.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
          <p className="font-subhead text-sm text-charcoal-soft">
            No {status === 'intake' ? 'pending' : status} reviews found.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          <table
            className="w-full text-sm"
            aria-label={`${status === 'intake' ? 'pending' : status} reviews`}
          >
            <thead>
              <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                  Reviewer
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden md:table-cell">
                  Business
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden lg:table-cell">
                  Rating
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden lg:table-cell">
                  Excerpt
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden md:table-cell">
                  Submitted
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/5">
              {reviews.map((review) => {
                const listing = review.listings as { name: string } | null
                const reviewerName = review.reviewer_user_id
                  ? (reviewerLabels[review.reviewer_user_id] ?? UNKNOWN_USER_LABEL)
                  : 'Anonymous'
                const excerpt = review.title ?? review.body ?? ''
                return (
                  <tr key={review.id} className="hover:bg-[#f9f9fb] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-subhead text-sm font-semibold text-brand-black">
                        {reviewerName}
                      </p>
                      {review.reviewer_user_id && (
                        <p className="font-mono text-xs text-charcoal-faint mt-0.5">
                          {review.reviewer_user_id.slice(0, 8)}…
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="font-subhead text-sm font-semibold text-brand-black">
                        {listing?.name ?? '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <StarRating rating={review.rating} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell max-w-xs">
                      <p className="font-body text-xs text-charcoal-soft truncate">
                        {excerpt.length > 80 ? `${excerpt.slice(0, 80)}…` : excerpt || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge status={review.status} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-body text-xs text-charcoal-soft">
                        {formatDate(review.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/reviews/${review.id}`}
                        className="font-subhead text-xs font-semibold text-amber hover:text-light-gold"
                        aria-label={`Review submission by ${reviewerName}${listing?.name ? ` for ${listing.name}` : ''}`}
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-charcoal/10">
              <p className="font-body text-xs text-charcoal-soft">
                {count} total · page {pageNum} of {totalPages}
              </p>
              <div className="flex gap-2">
                {pageNum > 1 && (
                  <Link
                    href={`/admin/reviews?status=${status}&page=${pageNum - 1}`}
                    className="px-3 py-1.5 rounded border border-charcoal/15 font-subhead text-xs text-brand-black hover:border-amber-gold/40"
                  >
                    ← Prev
                  </Link>
                )}
                {pageNum < totalPages && (
                  <Link
                    href={`/admin/reviews?status=${status}&page=${pageNum + 1}`}
                    className="px-3 py-1.5 rounded border border-charcoal/15 font-subhead text-xs text-brand-black hover:border-amber-gold/40"
                  >
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
