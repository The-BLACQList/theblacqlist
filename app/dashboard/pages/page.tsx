import Link from 'next/link'
import { ExternalLink, ChevronRight, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'

export default async function DashboardPagesPage() {
  const owner = await requireOwner()
  const supabase = await createClient()

  const { data: listings } = await supabase
    .from('listings')
    .select(
      'id, name, slug, status, entity_type, trust_tier, last_edited_by_owner_at, cities(slug, name)'
    )
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">My Pages</h1>
        <p className="font-body text-sm text-charcoal-soft mt-0.5">Your BLACQList business pages.</p>
      </div>

      {!listings || listings.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
          <p className="font-body text-charcoal-soft">No pages found.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {listings.map((listing) => {
            const city = listing.cities as { slug: string; name: string } | null
            const publicUrl = buildEntityUrl(listing.entity_type, city?.slug, listing.slug)

            return (
              <li key={listing.id} className="rounded-xl border border-charcoal/10 bg-white">
                <div className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-headline text-base text-brand-black">{listing.name}</p>
                      <span
                        className={`px-2 py-0.5 rounded-full font-subhead text-xs font-semibold ${
                          listing.status === 'published'
                            ? 'bg-green-100 text-green-700'
                            : listing.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-charcoal/10 text-charcoal-soft'
                        }`}
                      >
                        {listing.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {city && <p className="font-body text-xs text-charcoal-soft">{city.name}</p>}
                      {listing.last_edited_by_owner_at && (
                        <p className="font-body text-xs text-charcoal-faint flex items-center gap-1">
                          <Clock className="size-3" aria-hidden="true" />
                          Saved {new Date(listing.last_edited_by_owner_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {publicUrl && (
                      <Link
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View public page"
                        className="inline-flex items-center justify-center size-8 rounded-lg text-charcoal-faint hover:text-charcoal hover:bg-charcoal/5 transition-colors"
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                      </Link>
                    )}
                    <Link
                      href={`/dashboard/pages/${listing.id}/edit`}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-xs hover:bg-light-gold transition-colors"
                    >
                      Edit <ChevronRight className="size-3" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
