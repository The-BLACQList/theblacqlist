import Link from 'next/link'
import { ExternalLink, CheckCircle, Circle, Clock, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'

function CompletenessItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {done ? (
        <CheckCircle className="size-4 text-green-500 shrink-0" aria-hidden="true" />
      ) : (
        <Circle className="size-4 text-charcoal/25 shrink-0" aria-hidden="true" />
      )}
      <span
        className={`font-body text-sm ${done ? 'text-charcoal/60 line-through' : 'text-charcoal/80'}`}
      >
        {label}
      </span>
    </li>
  )
}

export default async function DashboardPage() {
  const owner = await requireOwner()
  const supabase = await createClient()

  const { data: listings } = await supabase
    .from('listings')
    .select(
      `
      id, name, slug, status, entity_type, trust_tier, tagline, meta_title,
      last_edited_by_owner_at, published_at,
      cities(slug, name),
      listing_details_business(description, phone, website_url, cta_type)
    `
    )
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Dashboard</h1>
        <p className="font-body text-sm text-charcoal/60 mt-0.5">
          Manage your BLACQList business pages.
        </p>
      </div>

      {!listings || listings.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
          <p className="font-body text-charcoal/60">
            No pages found. Contact support if you believe this is an error.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map((listing) => {
            const details = listing.listing_details_business as {
              description: string | null
              phone: string | null
              website_url: string | null
              cta_type: string | null
            } | null

            const city = listing.cities as { slug: string; name: string } | null
            const publicUrl = buildEntityUrl(listing.entity_type, city?.slug, listing.slug)

            const completeness = [
              { done: !!listing.tagline, label: 'Tagline' },
              { done: !!details?.description, label: 'Business description' },
              { done: !!details?.phone || !!details?.website_url, label: 'Contact info' },
              { done: !!details?.cta_type, label: 'Call to action' },
              { done: !!listing.meta_title, label: 'SEO title' },
            ]
            const doneCount = completeness.filter((c) => c.done).length

            return (
              <div key={listing.id} className="rounded-xl border border-charcoal/10 bg-white">
                {/* Header */}
                <div className="px-5 py-4 border-b border-charcoal/8 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-headline text-lg text-brand-black">{listing.name}</h2>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-subhead text-xs font-semibold ${
                          listing.status === 'published'
                            ? 'bg-green-100 text-green-700'
                            : listing.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-charcoal/10 text-charcoal/60'
                        }`}
                      >
                        {listing.status}
                      </span>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-subhead text-xs ${
                          listing.trust_tier === 'claimed' || listing.trust_tier === 'verified'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-charcoal/8 text-charcoal/50'
                        }`}
                      >
                        {listing.trust_tier}
                      </span>
                    </div>
                    {listing.last_edited_by_owner_at && (
                      <p className="font-body text-xs text-charcoal/40 mt-0.5 flex items-center gap-1">
                        <Clock className="size-3" aria-hidden="true" />
                        Last saved {new Date(listing.last_edited_by_owner_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {publicUrl && (
                    <Link
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1.5 text-xs font-subhead text-charcoal/50 hover:text-brand-black transition-colors"
                    >
                      View page <ExternalLink className="size-3" aria-hidden="true" />
                    </Link>
                  )}
                </div>

                {/* Completeness checklist */}
                <div className="px-5 py-4">
                  <p className="font-subhead text-xs font-semibold text-charcoal/50 mb-2 uppercase tracking-wide">
                    Profile completeness — {doneCount}/{completeness.length}
                  </p>
                  <ul className="space-y-1.5 mb-4">
                    {completeness.map(({ done, label }) => (
                      <CompletenessItem key={label} done={done} label={label} />
                    ))}
                  </ul>
                  <Link
                    href={`/dashboard/pages/${listing.id}/edit`}
                    className="inline-flex items-center gap-1.5 font-subhead text-sm font-semibold text-amber-gold hover:underline"
                  >
                    Edit page <ChevronRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
