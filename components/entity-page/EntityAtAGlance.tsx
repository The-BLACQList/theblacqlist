'use client'

// This file uses a Client Component for the open/closed status indicator.
// The surrounding layout is simple enough that co-locating the whole component
// as a Client Component keeps the boundary clean.

import { Phone, Mail, Globe, MapPin, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { EntityPageData, WeeklyHours, DayHours } from '@/types'
import { ReportCorrectionForm } from '@/components/entity-page/ReportCorrectionForm'

type Day = keyof WeeklyHours
const DAYS: Day[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<Day, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr ?? '0')
  const m = mStr ?? '00'
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m} ${suffix}`
}

function isOpenNow(hours: WeeklyHours): { open: boolean; label: string } {
  const now = new Date()
  const dayIndex = now.getDay() // 0=Sun, 1=Mon, ...
  const dayKey = DAYS[dayIndex === 0 ? 6 : dayIndex - 1] as Day
  const today: DayHours = hours[dayKey]

  if (today.closed) return { open: false, label: 'Closed today' }

  const [oh, om] = today.open.split(':').map(Number)
  const [ch, cm] = today.close.split(':').map(Number)
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const openMins = (oh ?? 0) * 60 + (om ?? 0)
  const closeMins = (ch ?? 0) * 60 + (cm ?? 0)

  if (nowMins >= openMins && nowMins < closeMins) {
    return {
      open: true,
      label: `Open · Closes ${formatTime(today.close)}`,
    }
  }
  if (nowMins < openMins) {
    return {
      open: false,
      label: `Closed · Opens ${formatTime(today.open)}`,
    }
  }
  return { open: false, label: 'Closed now' }
}

function OpenStatusIndicator({ hours }: { hours: WeeklyHours }) {
  // suppressHydrationWarning is intentional: time differs between server and client renders.
  const status = isOpenNow(hours)
  return (
    <span
      suppressHydrationWarning
      className={`inline-flex items-center gap-1.5 font-subhead text-sm ${
        status.open ? 'text-green-600' : 'text-charcoal-soft'
      }`}
    >
      <span
        suppressHydrationWarning
        className={`size-2 rounded-full ${status.open ? 'bg-green-500' : 'bg-charcoal/40'}`}
        aria-hidden="true"
      />
      {status.label}
    </span>
  )
}

interface Props {
  entity: EntityPageData
}

export function EntityAtAGlance({ entity }: Props) {
  const { details } = entity
  const hasAddress = details.address && details.city_name && details.state_abbr

  const fullAddress = hasAddress
    ? [
        details.address,
        details.address_line2,
        `${details.city_name}, ${details.state_abbr} ${details.zip ?? ''}`.trim(),
      ]
        .filter(Boolean)
        .join('\n')
    : null

  const mapsHref = fullAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(fullAddress.replace(/\n/g, ', '))}`
    : null

  const hasSocial = Object.values(details.social).some(Boolean)

  return (
    <section aria-labelledby="at-a-glance-heading" className="bg-white py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="at-a-glance-heading"
          className="font-headline text-[22px] md:text-[28px] text-brand-black mb-8"
        >
          At a Glance
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left column */}
          <div className="flex flex-col gap-5">
            {/* Category */}
            <div>
              <p className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-1.5">
                Category
              </p>
              <Badge variant="secondary" className="font-subhead text-sm rounded-full">
                {entity.category.name}
              </Badge>
            </div>

            {/* Location */}
            {(hasAddress || entity.location_type !== 'physical') && (
              <div>
                <p className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-1.5">
                  Location
                </p>
                {hasAddress && mapsHref ? (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-2 font-body text-sm text-charcoal hover:text-brand-black group"
                  >
                    <MapPin
                      className="size-4 mt-0.5 text-amber flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span className="group-hover:underline whitespace-pre-line">{fullAddress}</span>
                  </a>
                ) : (
                  <p className="font-body text-sm text-charcoal capitalize">
                    {entity.location_type.replace(/-/g, ' ')}
                  </p>
                )}
              </div>
            )}

            {/* Hours */}
            {details.hours && (
              <div>
                <p className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-1.5">
                  Hours
                </p>
                <div className="mb-2">
                  <OpenStatusIndicator hours={details.hours} />
                </div>
                <table className="w-full text-sm font-body text-charcoal">
                  <tbody>
                    {DAYS.map((day) => {
                      const h = details.hours![day]
                      return (
                        <tr key={day} className="border-b border-charcoal/8 last:border-0">
                          <td className="py-1 pr-4 font-subhead font-medium w-10">
                            {DAY_LABELS[day]}
                          </td>
                          <td className="py-1 text-charcoal/80">
                            {h.closed ? 'Closed' : `${formatTime(h.open)} – ${formatTime(h.close)}`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-5">
            {/* Contact */}
            {(details.phone || details.email || details.website_url) && (
              <div>
                <p className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-2">
                  Contact
                </p>
                <div className="flex flex-col gap-2">
                  {details.phone && (
                    <a
                      href={`tel:${details.phone.replace(/\D/g, '')}`}
                      className="inline-flex items-center gap-2 font-body text-sm text-charcoal hover:text-brand-black"
                    >
                      <Phone className="size-4 text-amber flex-shrink-0" aria-hidden="true" />
                      {details.phone}
                    </a>
                  )}
                  {details.email && (
                    <a
                      href={`mailto:${details.email}`}
                      className="inline-flex items-center gap-2 font-body text-sm text-charcoal hover:text-brand-black break-all"
                    >
                      <Mail className="size-4 text-amber flex-shrink-0" aria-hidden="true" />
                      {details.email}
                    </a>
                  )}
                  {details.website_url && (
                    <a
                      href={details.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 font-body text-sm text-charcoal hover:text-brand-black break-all"
                    >
                      <Globe className="size-4 text-amber flex-shrink-0" aria-hidden="true" />
                      {details.website_url.replace(/^https?:\/\/(www\.)?/, '')}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Social */}
            {hasSocial && (
              <div>
                <p className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-2">
                  Social
                </p>
                <div className="flex flex-col gap-1.5">
                  {(
                    [
                      { key: 'instagram', label: 'Instagram' },
                      { key: 'facebook', label: 'Facebook' },
                      { key: 'linkedin', label: 'LinkedIn' },
                      { key: 'tiktok', label: 'TikTok' },
                      { key: 'youtube', label: 'YouTube' },
                      { key: 'twitter', label: 'X / Twitter' },
                    ] as { key: keyof typeof details.social; label: string }[]
                  )
                    .filter(({ key }) => details.social[key])
                    .map(({ key, label }) => (
                      <a
                        key={key}
                        href={details.social[key]!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 font-body text-sm text-charcoal hover:text-brand-black transition-colors"
                      >
                        <ExternalLink
                          className="size-3.5 flex-shrink-0 text-amber"
                          aria-hidden="true"
                        />
                        {label}
                      </a>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-charcoal/8">
          <ReportCorrectionForm listingId={entity.id} />
        </div>
      </div>
    </section>
  )
}
