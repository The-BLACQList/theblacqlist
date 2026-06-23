import Link from 'next/link'
import { Calendar, Globe, MapPin, ChevronRight } from 'lucide-react'
import type { EntityPageData } from '@/types'

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function EntityUpcomingEvents({ entity }: { entity: EntityPageData }) {
  const events = entity.organizerEvents ?? []
  if (events.length === 0) return null

  return (
    <section aria-labelledby="upcoming-events-heading" className="bg-cream py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="upcoming-events-heading"
          className="font-headline text-[22px] md:text-[28px] text-brand-black mb-6"
        >
          Upcoming events
        </h2>
        <ul className="md:max-w-3xl divide-y divide-charcoal/10 border-y border-charcoal/10">
          {events.map((ev) => (
            <li key={ev.id}>
              <Link
                href={ev.url}
                className="group flex items-center gap-4 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/50 rounded"
              >
                <div className="flex flex-col items-center justify-center shrink-0 w-14 text-center">
                  <Calendar className="size-4 text-amber" aria-hidden="true" />
                  <span className="font-subhead text-xs font-semibold text-brand-black mt-1">
                    {fmtWhen(ev.starts_at)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-subhead font-semibold text-base text-brand-black group-hover:text-amber transition-colors truncate">
                    {ev.name}
                  </p>
                  <p className="font-body text-xs text-charcoal-soft mt-0.5 flex items-center gap-1.5">
                    {ev.is_online ? (
                      <>
                        <Globe className="size-3 shrink-0" aria-hidden="true" /> Online
                      </>
                    ) : (
                      <>
                        <MapPin className="size-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {ev.venue_name || ev.city_name || 'In person'}
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    {fmtTime(ev.starts_at)}
                  </p>
                </div>
                <ChevronRight
                  className="size-5 text-charcoal-faint group-hover:text-amber shrink-0 transition-colors"
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
