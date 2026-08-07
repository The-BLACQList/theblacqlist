import Link from 'next/link'
import { redirect } from 'next/navigation'
import { History, ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import { buildEntityUrl } from '@/lib/listings/url'

export const metadata: Metadata = { title: 'Recently Viewed | Account' }

export default async function RecentlyViewedPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/account/activity')

  // Fetch the most recent page_view events for this user
  const { data: events } = await supabase
    .from('analytics_events')
    .select('entity_id, created_at')
    .eq('user_id', user.id)
    .eq('event_name', ANALYTICS_EVENTS.PAGE_VIEW)
    .eq('entity_type', 'listing')
    .order('created_at', { ascending: false })
    .limit(100)

  // Deduplicate: keep most-recent-first, max 20 unique listings
  const seenIds = new Set<string>()
  const recentIds: string[] = []
  for (const e of events ?? []) {
    if (e.entity_id && !seenIds.has(e.entity_id) && recentIds.length < 20) {
      seenIds.add(e.entity_id)
      recentIds.push(e.entity_id)
    }
  }

  type ListingRow = {
    id: string
    name: string
    slug: string
    tagline: string | null
    entity_type: string
    trust_tier: string
    cities: { name: string; slug: string; states: { code: string } | null } | null
    listing_details_business: { website_url: string | null } | null
  }

  let listings: ListingRow[] = []
  if (recentIds.length > 0) {
    const { data } = await supabase
      .from('listings')
      .select(
        `
        id, name, slug, tagline, entity_type, trust_tier,
        cities!listings_city_id_fkey(name, slug, states!cities_state_id_fkey(code)),
        listing_details_business(website_url)
      `
      )
      .in('id', recentIds)
      .eq('status', 'published')
      .is('deleted_at', null)

    // Re-sort to match recency order from events
    const byId = new Map((data ?? []).map((l) => [l.id, l as unknown as ListingRow]))
    listings = recentIds.map((id) => byId.get(id)).filter((l): l is ListingRow => !!l)
  }

  return (
    <main>
      <div className="max-w-[960px] mx-auto">

        <h1 className="font-headline text-3xl text-brand-black mb-2">Recently viewed</h1>
        <p className="font-subhead text-sm text-charcoal-soft mb-8">
          {listings.length === 0
            ? 'Businesses you visit will appear here.'
            : `${listings.length} recently visited ${listings.length === 1 ? 'business' : 'businesses'}`}
        </p>

        {listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-white border border-charcoal/10 flex items-center justify-center mb-4">
              <History className="size-7 text-charcoal-faint" aria-hidden="true" />
            </div>
            <h2 className="font-headline text-xl text-brand-black mb-2">No visits yet</h2>
            <p className="font-subhead text-sm text-charcoal-soft max-w-xs leading-relaxed">
              Businesses you explore will show up here.
            </p>
            <Link
              href="/discover"
              className="mt-6 inline-flex items-center justify-center h-11 px-6 rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors"
            >
              Discover businesses
            </Link>
          </div>
        ) : (
          <ul className="space-y-3" aria-label="Recently viewed businesses">
            {listings.map((l) => (
              <li
                key={l.id}
                className="bg-white rounded-xl border border-charcoal/10 p-4 flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    href={buildEntityUrl(l.entity_type, l.cities?.slug, l.slug)}
                    className="font-headline text-base text-brand-black hover:text-amber transition-colors line-clamp-1"
                  >
                    {l.name}
                  </Link>
                  {l.tagline && (
                    <p className="font-subhead text-sm text-charcoal-soft mt-0.5 line-clamp-1">
                      {l.tagline}
                    </p>
                  )}
                  {l.cities && (
                    <p className="font-subhead text-xs text-charcoal-faint mt-1">
                      {l.cities.name}
                      {l.cities.states?.code ? `, ${l.cities.states.code}` : ''}
                    </p>
                  )}
                </div>
                {l.listing_details_business?.website_url && (
                  <a
                    href={l.listing_details_business.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Visit ${l.name} website`}
                    className="inline-flex items-center justify-center size-9 rounded-full text-charcoal-faint hover:text-charcoal hover:bg-charcoal/5 transition-colors shrink-0"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
