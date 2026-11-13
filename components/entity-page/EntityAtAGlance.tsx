'use client'

// This file uses a Client Component for the open/closed status indicator.
// The surrounding layout is simple enough that co-locating the whole component
// as a Client Component keeps the boundary clean.

import { Phone, Mail, Globe, MapPin, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { trackContactTap } from '@/lib/analytics/contactTap'
import { directionsUrl } from '@/lib/listings/directions'
import { upcomingOverrides } from '@/lib/listings/hoursOverrides'
import { locationPins } from '@/lib/listings/locationPins'
import { formatTime, isOpenNow } from '@/lib/listings/openStatus'
import { LOCATION_TYPE_META } from '@/lib/constants/listing'
import type { EntityRenderMode } from '@/lib/entity-page/template'
import type { EntityPageData, HoursOverride, WeeklyHours } from '@/types'
import { ReportCorrectionForm } from '@/components/entity-page/ReportCorrectionForm'
import { DistanceFromYou } from '@/components/entity-page/DistanceFromYou'
import { EntityHoursOverrides } from '@/components/entity-page/EntityHoursOverrides'
import { EntityLocationMap } from '@/components/entity-page/EntityLocationMap'
import { SectionMark } from '@/components/entity-page/SectionMark'

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

// Social values are stored as bare handles OR full URLs. A bare handle dropped
// straight into href becomes a broken RELATIVE link (e.g. /blackcoffeeatl), so
// normalize to an absolute profile URL per platform.
const SOCIAL_BASE: Record<string, string> = {
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
  linkedin: 'https://www.linkedin.com/in/',
  tiktok: 'https://tiktok.com/@',
  youtube: 'https://youtube.com/@',
  twitter: 'https://x.com/',
}
function normalizeSocialUrl(platform: string, raw: string): string {
  const v = raw.trim()
  if (/^https?:\/\//i.test(v)) return v // already an absolute URL
  if (v.includes('/') && v.includes('.')) return `https://${v}` // looks like a domain path
  const handle = v.replace(/^@+/, '')
  return (SOCIAL_BASE[platform] ?? 'https://') + handle
}

function OpenStatusIndicator({
  hours,
  overrides,
}: {
  hours: WeeklyHours
  overrides?: readonly HoursOverride[]
}) {
  // suppressHydrationWarning is intentional: time differs between server and client renders.
  const status = isOpenNow(hours, overrides)
  return (
    <span
      suppressHydrationWarning
      className={`inline-flex items-center gap-1.5 font-subhead text-sm ${
        status.open ? 'text-success' : 'text-charcoal-soft'
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
  /** Example pages show the mini map now; live pages get it in ticket 190. */
  mode?: EntityRenderMode
}

export function EntityAtAGlance({ entity, mode = 'live' }: Props) {
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

  const mapsHref = hasAddress
    ? directionsUrl({
        name: entity.name,
        street: [details.address, details.address_line2].filter(Boolean).join(' '),
        city: details.city_name,
        state: details.state_abbr,
        zip: details.zip,
      })
    : null

  const hasSocial = Object.values(details.social).some(Boolean)

  // Live listings already carry lat/lng, so the map is example-only until
  // ticket 190 measures it on a real page and flips it on.
  const pins = mode === 'example' ? locationPins(entity) : []
  // Only the window moves with the clock, and the fixtures keep every date
  // well inside it, so server and client render the same rows.
  const upcoming = upcomingOverrides(entity.hoursOverrides, new Date())

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
                  <>
                    <a
                      href={mapsHref}
                      onClick={() => trackContactTap(entity.id, mapsHref, 'at_a_glance')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-2 font-body text-sm text-charcoal hover:text-brand-black group"
                    >
                      <MapPin
                        className="size-4 mt-0.5 text-amber flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="group-hover:underline whitespace-pre-line">
                        {fullAddress}
                      </span>
                    </a>
                    {details.lat != null && details.lng != null && (
                      <DistanceFromYou lat={details.lat} lng={details.lng} />
                    )}
                  </>
                ) : (
                  <p className="font-body text-sm text-charcoal">
                    {LOCATION_TYPE_META[entity.location_type].label}
                  </p>
                )}
                {pins.length > 0 && (
                  <SectionMark id="map">
                    <EntityLocationMap pins={pins} directionsHref={mapsHref} className="mt-4" />
                  </SectionMark>
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
                  <OpenStatusIndicator hours={details.hours} overrides={entity.hoursOverrides} />
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
                          <td className="py-1 text-charcoal">
                            {h.closed ? 'Closed' : `${formatTime(h.open)} – ${formatTime(h.close)}`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {upcoming.length > 0 && (
                  <SectionMark id="hours-overrides">
                    <EntityHoursOverrides overrides={upcoming} />
                  </SectionMark>
                )}
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
                      onClick={(e) =>
                        trackContactTap(entity.id, e.currentTarget.href, 'at_a_glance')
                      }
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
                      onClick={(e) =>
                        trackContactTap(entity.id, e.currentTarget.href, 'at_a_glance')
                      }
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
                        href={normalizeSocialUrl(key, details.social[key]!)}
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
