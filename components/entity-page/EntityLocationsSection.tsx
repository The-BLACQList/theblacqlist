import Link from 'next/link'
import type { Route } from 'next'
import { ChevronRight, MapPin } from 'lucide-react'
import { TemplateSectionHeading } from '@/components/entity-page/templates/TemplateSectionHeading'
import type { LocationLink } from '@/types'

interface Props {
  locations: LocationLink[] | undefined
  bare?: boolean
}

/**
 * The business's other locations (ticket 110; display here, the location
 * group and tier sync in Phase 7). Premium only, up to the plan's location
 * count less this page. Hidden until a loader provides `locations`.
 */
export function EntityLocationsSection({ locations, bare = false }: Props) {
  if (!locations || locations.length === 0) return null

  return (
    <section
      aria-labelledby="locations-heading"
      className={bare ? undefined : 'bg-white py-12 md:py-16'}
    >
      <div className={bare ? undefined : 'max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8'}>
        {bare ? (
          <TemplateSectionHeading
            kicker="More than one door"
            heading="Also at"
            headingId="locations-heading"
          />
        ) : (
          <h2
            id="locations-heading"
            className="font-headline text-[22px] md:text-[28px] text-brand-black mb-6"
          >
            Also at
          </h2>
        )}
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:max-w-3xl">
          {locations.map((loc) => (
            <li key={loc.id}>
              <Link
                href={loc.href as Route}
                className="group flex items-center gap-4 rounded-xl border border-charcoal/10 bg-white p-4 hover:border-amber/50 hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pale-lavender">
                  <MapPin className="size-5 text-amber" aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-subhead text-base font-semibold text-brand-black group-hover:text-amber transition-colors truncate">
                    {loc.label}
                  </span>
                  <span className="block font-body text-xs text-charcoal-soft mt-0.5 truncate">
                    {[loc.addressLine, loc.cityName].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <ChevronRight
                  className="size-5 shrink-0 text-charcoal-faint group-hover:text-amber transition-colors"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
