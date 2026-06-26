import { Calendar, CalendarPlus, MapPin, Ticket, Globe, Tag, ExternalLink } from 'lucide-react'
import type { EntityPageData } from '@/types'

const CTA_LABELS: Record<string, string> = {
  'get-tickets': 'Get tickets',
  rsvp: 'RSVP',
  register: 'Register',
  'learn-more': 'Learn more',
  visit: 'Visit',
  contact: 'Contact',
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function EntityEventDetails({ entity }: { entity: EntityPageData }) {
  const event = entity.event
  if (!event) return null

  const start = new Date(event.starts_at)
  const end = event.ends_at ? new Date(event.ends_at) : null
  const sameDay = end && start.toDateString() === end.toDateString()

  const whenLine = sameDay
    ? `${fmtDate(event.starts_at)} · ${fmtTime(event.starts_at)} – ${fmtTime(event.ends_at!)}`
    : end
      ? `${fmtDate(event.starts_at)}, ${fmtTime(event.starts_at)} → ${fmtDate(event.ends_at!)}, ${fmtTime(event.ends_at!)}`
      : `${fmtDate(event.starts_at)} · ${fmtTime(event.starts_at)}`

  const locationParts = event.is_online
    ? null
    : [event.venue_name, event.venue_address, [event.city_name, event.state_abbr].filter(Boolean).join(', ')]
        .filter(Boolean)
        .join(' · ')

  const ctaUrl = event.ticket_url || event.cta_url
  const ctaLabel = CTA_LABELS[event.cta_type] ?? 'Get tickets'

  return (
    <section aria-labelledby="event-details-heading" className="bg-white py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2 id="event-details-heading" className="sr-only">
          Event details
        </h2>

        <div className="md:max-w-3xl space-y-6">
          {/* Key facts */}
          <dl className="grid grid-cols-1 gap-4">
            <div className="flex items-start gap-3">
              <Calendar className="size-5 text-amber shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <dt className="font-subhead text-xs font-semibold uppercase tracking-wide text-charcoal-soft">
                  When
                </dt>
                <dd className="font-body text-base text-brand-black">{whenLine}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              {event.is_online ? (
                <Globe className="size-5 text-amber shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <MapPin className="size-5 text-amber shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div>
                <dt className="font-subhead text-xs font-semibold uppercase tracking-wide text-charcoal-soft">
                  Where
                </dt>
                <dd className="font-body text-base text-brand-black">
                  {event.is_online ? 'Online event' : (locationParts || 'Location to be announced')}
                </dd>
              </div>
            </div>

            {event.price_text && (
              <div className="flex items-start gap-3">
                <Tag className="size-5 text-amber shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <dt className="font-subhead text-xs font-semibold uppercase tracking-wide text-charcoal-soft">
                    Price
                  </dt>
                  <dd className="font-body text-base text-brand-black">{event.price_text}</dd>
                </div>
              </div>
            )}
          </dl>

          <div className="flex flex-wrap items-center gap-3">
            {ctaUrl && (
              <a
                href={ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-amber-gold text-brand-black font-subhead text-sm font-bold hover:bg-amber-gold/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/50 transition-colors"
              >
                <Ticket className="size-4" aria-hidden="true" />
                {ctaLabel}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            )}
            <a
              href={`/api/events/${entity.id}/calendar`}
              className="inline-flex items-center gap-2 h-12 px-5 rounded-full border border-charcoal/20 text-brand-black font-subhead text-sm font-semibold hover:border-amber-gold hover:bg-amber-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/50 transition-colors"
            >
              <CalendarPlus className="size-4 text-amber" aria-hidden="true" />
              Add to calendar
            </a>
          </div>

          {event.organizer && (
            <p className="font-body text-sm text-charcoal-soft">
              Hosted by{' '}
              <a
                href={event.organizer.url}
                className="font-semibold text-brand-black underline decoration-amber-gold/60 underline-offset-2 hover:decoration-amber-gold"
              >
                {event.organizer.name}
              </a>
            </p>
          )}

          {event.description && (
            <div className="pt-2 border-t border-charcoal/10">
              <h3 className="font-headline text-lg text-brand-black mt-5 mb-2">About this event</h3>
              <p className="font-body text-sm leading-relaxed text-charcoal whitespace-pre-line">
                {event.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
