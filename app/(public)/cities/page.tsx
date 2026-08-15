import Link from 'next/link'
import type { Metadata } from 'next'
import { MapPin } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/layout/container'
import { Reveal } from '@/components/motion/Reveal'
import { EmptyState } from '@/components/ui/empty-state'
import { PhotoPanelGround } from '@/components/media/PhotoPanelGround'
import { PhotoPanelCaption } from '@/components/media/PhotoPanelCaption'
import { CITY_PHOTOS } from '@/lib/design/surfaces'
import { cn } from '@/lib/utils'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'

const title = 'Cities | The BLACQList'
const description =
  'Explore Black-owned businesses city by city — Atlanta, Houston, Chicago, Los Angeles, Washington DC, New Orleans, and more. Support your local community.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${BASE_URL}/cities` },
  openGraph: {
    title: 'Black-owned businesses, city by city',
    description,
    url: `${BASE_URL}/cities`,
  },
  twitter: { card: 'summary_large_image', title, description },
}

type CityRow = {
  id: string
  name: string
  slug: string
  metro_area: string | null
  is_active: boolean
  states: { name: string; code: string } | null
}

export default async function CitiesPage() {
  const supabase = await createClient()

  // Coming-soon cities are fetched too — this page's job is to show national
  // coverage, so hiding them here hid the roadmap from the page that carries it.
  const [citiesRes, listingsRes] = await Promise.all([
    supabase
      .from('cities')
      .select('id, name, slug, metro_area, is_active, states!cities_state_id_fkey(name, code)')
      .order('name'),
    // One scan for every count, rather than a count query per city.
    supabase
      .from('listings')
      .select('city_id')
      .eq('status', 'published')
      .is('deleted_at', null),
  ])

  // A failed fetch and a genuinely empty table look identical downstream, so
  // separate them here — "nothing is live yet" and "we couldn't load this" are
  // different messages and only one of them offers a retry.
  const loadFailed = Boolean(citiesRes.error)

  const counts = new Map<string, number>()
  for (const row of listingsRes.data ?? []) {
    if (row.city_id) counts.set(row.city_id, (counts.get(row.city_id) ?? 0) + 1)
  }

  const cities = ((citiesRes.data ?? []) as CityRow[]).map((city) => ({
    ...city,
    listingCount: counts.get(city.id) ?? 0,
  }))

  // Busiest city leads the bento; ties fall back to alphabetical.
  const live = cities
    .filter((c) => c.is_active)
    .sort((a, b) => b.listingCount - a.listingCount || a.name.localeCompare(b.name))
  const comingSoon = cities.filter((c) => !c.is_active)
  const totalListed = live.reduce((sum, c) => sum + c.listingCount, 0)

  return (
    <main className="min-h-screen bg-pale-lavender">
      {/* Hero */}
      <section className="border-b border-charcoal/10">
        <Container className="py-14 md:py-20">
          <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-amber mb-3">
            City chapters
          </p>
          <h1 className="font-headline text-4xl md:text-5xl text-brand-black leading-tight mb-4">
            Black-owned businesses, city by city
          </h1>
          <p className="font-body text-base text-charcoal max-w-xl leading-relaxed">
            Every chapter is a real index of the businesses, professionals, and creatives in one
            metro — claimed, verified, and kept current by the people who run them.
          </p>

          {live.length > 0 && (
            <p className="font-subhead text-sm text-charcoal-soft mt-6">
              <span className="font-semibold text-brand-black">{live.length}</span>{' '}
              {live.length === 1 ? 'city' : 'cities'} live
              <span className="text-charcoal-faint mx-2" aria-hidden="true">
                ·
              </span>
              <span className="font-semibold text-brand-black">
                {totalListed.toLocaleString()}
              </span>{' '}
              {totalListed === 1 ? 'business' : 'businesses'} listed
            </p>
          )}
        </Container>
      </section>

      {/* City chapters */}
      <section className="bg-off-white py-10 md:py-14" aria-labelledby="live-cities-heading">
        <Container>
          <h2 id="live-cities-heading" className="sr-only">
            Live cities
          </h2>

          {loadFailed ? (
            <EmptyState
              level={3}
              heading="Couldn't load the city chapters"
              body="Something went wrong on our end. The map still works, and reloading usually clears it."
              action={{ label: 'Try again', href: '/cities' }}
              secondaryAction={{ label: 'Open the map', href: '/map' }}
              icon={MapPin}
              iconClassName="text-amber"
            />
          ) : live.length === 0 ? (
            <EmptyState
              level={3}
              heading="No city chapters are live yet"
              body="Chapters open as listings are claimed and verified in each metro. In the meantime, everything we've indexed is on the map."
              action={{ label: 'Open the map', href: '/map' }}
              secondaryAction={{ label: 'Browse all listings', href: '/explore' }}
              icon={MapPin}
              iconClassName="text-amber"
            />
          ) : (
            <Reveal>
              {/* Rows grew from 132/156 with the caption plate — it takes a
                  fixed slice of every tile, so the old height left the picture
                  a sliver.

                  This is the one surface still wider than the source's 3:2 at
                  desktop, which means added height reclaims discarded picture
                  instead of spending it: at 1280 a normal tile goes 208 → 248px
                  and the height crop drops from 21.5% to 6.4%. The 1024 band
                  pays for it — it sits at exactly 3:2 today. One `lg:` value,
                  not a four-rung ladder; the extra quality point at 1024 is not
                  worth two more magic numbers. */}
              <div className="grid grid-cols-2 md:grid-cols-3 auto-rows-[184px] md:auto-rows-[208px] lg:auto-rows-[248px] gap-3">
                {live.map((city, i) => {
                  const stateCode = city.states?.code
                  const isFeature = i === 0

                  return (
                    <Link
                      key={city.slug}
                      href={`/discover/${city.slug}`}
                      className={cn(
                        'group relative flex flex-col rounded-xl bg-deep-bg overflow-hidden',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
                        isFeature && 'col-span-2 row-span-2'
                      )}
                    >
                      <PhotoPanelGround
                        src={CITY_PHOTOS[city.slug]}
                        // The feature tile spans two of three columns.
                        //
                        // These are fixed-row tiles, and below xl every one of
                        // them is taller than the source's 3:2 — so the frame
                        // scales by height and renders 1.5 × the row height
                        // wide, well past its own CSS width. The old hints
                        // described the box, not the bitmap, and under-requested
                        // by up to 50%. Over-requesting is the safe direction.
                        sizes={
                          isFeature
                            ? '(max-width: 767px) 155vw, (max-width: 1279px) 84vw, 820px'
                            : '(max-width: 767px) 75vw, (max-width: 1279px) 42vw, 400px'
                        }
                        alt={`${city.name} skyline`}
                      />
                      {/* Spacer, not a wrapper — the frame fills the whole tile
                          behind it. `min-h-0` lets it shrink inside the fixed
                          row instead of pushing the caption out of the tile. */}
                      <span aria-hidden="true" className="block grow min-h-0" />
                      <PhotoPanelCaption className="p-4">
                        {isFeature && (
                          <span className="font-subhead text-[11px] font-bold uppercase tracking-[0.12em] leading-tight text-light-gold mb-2">
                            Most active
                          </span>
                        )}
                        <span
                          className={cn(
                            // Tiles are fixed-height, so a long city name has to clamp
                            // rather than push the count line out of the tile.
                            'font-headline text-white group-hover:text-light-gold transition-colors duration-150 line-clamp-2',
                            isFeature ? 'text-[30px] md:text-[40px]' : 'text-[19px] md:text-[24px]',
                            // After the font-size classes on purpose: tailwind-merge
                            // treats font-size as conflicting with line-height, so an
                            // earlier leading-tight gets stripped.
                            'leading-tight'
                          )}
                        >
                          {city.name}
                        </span>
                        <span className="font-subhead text-xs font-semibold text-light-gold mt-1">
                          {city.listingCount.toLocaleString()}{' '}
                          {city.listingCount === 1 ? 'business' : 'businesses'}
                          {stateCode ? (
                            <>
                              <span aria-hidden="true"> · </span>
                              {stateCode}
                            </>
                          ) : null}
                        </span>
                        {isFeature && city.metro_area && (
                          <span className="font-body text-[13px] leading-tight text-off-white mt-1.5 truncate">
                            {city.metro_area}
                          </span>
                        )}
                      </PhotoPanelCaption>
                    </Link>
                  )
                })}
              </div>
            </Reveal>
          )}

        </Container>
      </section>

      {comingSoon.length > 0 && (
        <section
          className="bg-off-white pb-12 md:pb-16"
          aria-labelledby="coming-soon-cities-heading"
        >
          <Container>
            <Reveal delay={80}>
              <div className="pt-8 border-t border-charcoal/10">
                <h2
                  id="coming-soon-cities-heading"
                  className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-amber mb-1.5"
                >
                  Coming soon
                </h2>
                <p className="font-body text-sm text-charcoal-soft mb-3 max-w-xl">
                  These chapters open as soon as their first listings are indexed.
                </p>
                {/* Plain text, not chips — these cities aren't navigable yet, and the
                    house pill treatment reads as a link the reader can follow. */}
                <p className="font-subhead text-[13px] text-charcoal-soft leading-relaxed max-w-3xl">
                  {comingSoon
                    .map((city) =>
                      city.states?.code ? `${city.name}, ${city.states.code}` : city.name
                    )
                    .join(' · ')}
                </p>
              </div>
            </Reveal>
          </Container>
        </section>
      )}
    </main>
  )
}
