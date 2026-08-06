import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Star, MessageSquare } from 'lucide-react'
import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { buildEntityUrl } from '@/lib/listings/url'

export const metadata: Metadata = { title: 'My Reviews | The BLACQList' }

// reviews.status CHECK = intake / pending_approval / published / rejected / removed.
// RLS ("reviews: authenticated read published or own") lets a user read their own
// reviews at any status, so no migration is needed for this view.
const REVIEW_STATUS: Record<string, { label: string; className: string }> = {
  intake: { label: 'Pending review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending_approval: {
    label: 'Under review',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  published: { label: 'Published', className: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
  removed: { label: 'Removed', className: 'bg-charcoal/5 text-charcoal-soft border-charcoal/15' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function MyReviewsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/account/reviews')

  const { data: rows } = await supabase
    .from('reviews')
    .select(
      `
      id, rating, title, body, status, rejection_reason, created_at,
      listings(name, slug, entity_type, cities!listings_city_id_fkey(slug))
    `
    )
    .eq('reviewer_user_id', user.id)
    .order('created_at', { ascending: false })

  const reviews = (rows ?? []).map((r) => {
    const l = r.listings as {
      name: string
      slug: string
      entity_type: string
      cities: { slug: string } | null
    } | null
    return {
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status,
      rejectionReason: r.rejection_reason,
      createdAt: r.created_at,
      listingName: l?.name ?? 'A business',
      listingUrl: l ? buildEntityUrl(l.entity_type, l.cities?.slug ?? null, l.slug) : null,
    }
  })

  return (
    <main>
      <div className="max-w-[960px] mx-auto">

        <h1 className="font-headline text-3xl text-brand-black mb-2">My reviews</h1>
        <p className="font-subhead text-sm text-charcoal-soft mb-8">
          {reviews.length === 0
            ? 'Reviews you write will appear here, along with their status.'
            : `${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'} · new reviews are checked before they go live`}
        </p>

        {reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-white border border-charcoal/10 flex items-center justify-center mb-4">
              <MessageSquare className="size-7 text-charcoal-faint" aria-hidden="true" />
            </div>
            <h2 className="font-headline text-xl text-brand-black mb-2">No reviews yet</h2>
            <p className="font-subhead text-sm text-charcoal-soft max-w-xs leading-relaxed">
              Visit a business page and share your experience — your reviews show up here.
            </p>
            <Link
              href="/discover"
              className="mt-6 inline-flex items-center justify-center h-11 px-6 rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors"
            >
              Discover businesses
            </Link>
          </div>
        ) : (
          <ul className="space-y-3" aria-label="My reviews">
            {reviews.map((r) => {
              const badge = REVIEW_STATUS[r.status] ?? {
                label: r.status,
                className: 'bg-charcoal/5 text-charcoal-soft border-charcoal/15',
              }
              return (
                <li key={r.id} className="bg-white rounded-xl border border-charcoal/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {r.listingUrl ? (
                        <Link
                          href={r.listingUrl}
                          className="font-headline text-base text-brand-black hover:text-amber transition-colors line-clamp-1"
                        >
                          {r.listingName}
                        </Link>
                      ) : (
                        <span className="font-headline text-base text-brand-black line-clamp-1">
                          {r.listingName}
                        </span>
                      )}
                      <div
                        className="flex items-center gap-0.5 mt-1"
                        aria-label={`${r.rating} out of 5 stars`}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`size-3.5 ${
                              n <= r.rating ? 'fill-amber text-amber' : 'text-charcoal/20'
                            }`}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 font-subhead text-[11px] font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {r.title && (
                    <p className="font-subhead text-sm font-semibold text-brand-black mt-2">
                      {r.title}
                    </p>
                  )}
                  {r.body && (
                    <p className="font-body text-sm text-charcoal mt-1 line-clamp-3">{r.body}</p>
                  )}

                  {r.status === 'rejected' && r.rejectionReason && (
                    <p className="font-subhead text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                      Not published: {r.rejectionReason}
                    </p>
                  )}

                  <p className="font-subhead text-xs text-charcoal-faint mt-2">
                    {formatDate(r.createdAt)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
