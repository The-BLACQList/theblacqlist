import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight, MapPin } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/layout/container'

export const metadata: Metadata = {
  title: 'Cities | The BLACQList',
  description:
    'Explore Black-owned businesses across Atlanta, Houston, Chicago, and more. Find and support your local community.',
}

export default async function CitiesPage() {
  const supabase = await createClient()

  const { data: cities } = await supabase
    .from('cities')
    .select('id, name, slug, metro_area, states!cities_state_id_fkey(name, code)')
    .eq('is_active', true)
    .order('name')

  const cityList = (cities ?? []) as Array<{
    id: string
    name: string
    slug: string
    metro_area: string | null
    states: { name: string; code: string } | null
  }>

  // Fetch listing counts for all active cities in parallel
  const counts = await Promise.all(
    cityList.map((city) =>
      supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('city_id', city.id)
        .eq('status', 'published')
        .is('deleted_at', null)
    )
  )

  const citiesWithCounts = cityList.map((city, i) => ({
    ...city,
    listingCount: counts[i]?.count ?? 0,
  }))

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-16">
      {/* Header */}
      <div className="border-b border-charcoal/10 bg-white">
        <Container className="py-8 md:py-12">
          <h1 className="font-headline text-3xl md:text-4xl text-brand-black mb-2">Cities</h1>
          <p className="font-subhead text-sm text-charcoal-soft">
            Black-owned businesses, city by city.
          </p>
        </Container>
      </div>

      {/* City grid */}
      <Container className="py-8">
        {citiesWithCounts.length === 0 ? (
          <p className="font-body text-sm text-charcoal-soft">No cities available yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {citiesWithCounts.map((city) => {
              const locationLabel = city.states ? `${city.name}, ${city.states.code}` : city.name

              return (
                <Link
                  key={city.slug}
                  href={`/discover/${city.slug}`}
                  className="group bg-white rounded-xl border border-charcoal/10 p-6 hover:border-amber-gold/40 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h2 className="font-headline text-xl text-brand-black group-hover:text-amber transition-colors">
                        {city.name}
                      </h2>
                      <p className="font-subhead text-xs text-charcoal-soft mt-0.5 flex items-center gap-1">
                        <MapPin className="size-3 shrink-0" aria-hidden="true" />
                        {city.states?.name ?? locationLabel}
                      </p>
                    </div>
                    <ChevronRight
                      className="size-5 text-charcoal/25 group-hover:text-amber transition-colors shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  </div>

                  {city.metro_area && (
                    <p className="font-body text-xs text-charcoal/45 mb-3 truncate">
                      {city.metro_area}
                    </p>
                  )}

                  <p className="font-subhead text-sm font-semibold text-brand-black">
                    {city.listingCount} {city.listingCount === 1 ? 'business' : 'businesses'} listed
                  </p>
                </Link>
              )
            })}
          </div>
        )}
      </Container>
    </main>
  )
}
