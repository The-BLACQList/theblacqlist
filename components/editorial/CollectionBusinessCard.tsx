import Image from 'next/image'
import Link from 'next/link'

import { StatusBadge } from '@/components/ui/status-badge'
import { buildEntityUrl } from '@/lib/listings/url'

type TrustTier = 'unclaimed' | 'claimed' | 'verified' | 'certified'

export interface CollectionListing {
  id: string
  name: string
  slug: string
  tagline: string | null
  entity_type: string
  trust_tier: TrustTier
  cover_image_path: string | null
  cities: { slug: string; name: string; states: { code: string } | null } | null
}

interface Props {
  listing: CollectionListing
  /** Editorial note: why this business is in the collection. */
  blurb?: string | null
  /** Optional short pill, e.g. "Editor's pick". */
  headline?: string | null
  /** 1-based position shown as an index marker. */
  position: number
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

export function CollectionBusinessCard({ listing, blurb, headline, position }: Props) {
  const city = listing.cities
  const location = city ? (city.states?.code ? `${city.name}, ${city.states.code}` : city.name) : null
  const href = buildEntityUrl(listing.entity_type, city?.slug, listing.slug)
  const showBadge = listing.trust_tier === 'verified' || listing.trust_tier === 'certified'

  return (
    <article className="group relative flex flex-col sm:flex-row gap-4 sm:gap-5 rounded-2xl border border-charcoal/10 bg-white p-4 sm:p-5 transition-colors hover:border-gold/40">
      {/* Thumbnail: cover image or initials placeholder */}
      <Link
        href={href}
        aria-hidden="true"
        tabIndex={-1}
        className="relative shrink-0 h-40 sm:h-28 sm:w-28 w-full overflow-hidden rounded-xl bg-deep-bg"
      >
        {listing.cover_image_path ? (
          <Image
            src={listing.cover_image_path}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 112px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-charcoal/50 to-deep-bg">
            <span className="font-headline text-2xl text-gold/60 select-none">
              {initialsOf(listing.name)}
            </span>
          </div>
        )}
        {/* Position marker */}
        <span className="absolute top-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-deep-bg/80 font-subhead text-[11px] font-bold text-gold">
          {position}
        </span>
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {headline && (
            <span className="inline-block rounded-full bg-gold/15 text-amber font-subhead text-[11px] font-bold uppercase tracking-wide px-2 py-0.5">
              {headline}
            </span>
          )}
          {showBadge && <StatusBadge tier={listing.trust_tier} size="small" />}
          <span className="font-subhead text-[11px] text-charcoal-soft capitalize">
            {listing.entity_type.replace(/_/g, ' ')}
          </span>
          {location && (
            <>
              <span className="text-charcoal/25" aria-hidden="true">
                ·
              </span>
              <span className="font-subhead text-[11px] text-charcoal-soft">{location}</span>
            </>
          )}
        </div>

        <h3 className="font-headline text-lg text-brand-black leading-snug">
          <Link href={href} className="transition-colors hover:text-amber">
            {listing.name}
          </Link>
        </h3>

        {/* Editorial blurb takes priority; fall back to the listing tagline */}
        {blurb ? (
          <p className="font-body text-sm text-charcoal mt-1.5 leading-relaxed">{blurb}</p>
        ) : (
          listing.tagline && (
            <p className="font-body text-sm text-charcoal-soft mt-1.5 leading-relaxed line-clamp-2">
              {listing.tagline}
            </p>
          )
        )}

        <Link
          href={href}
          className="inline-flex items-center gap-1 mt-3 font-subhead text-xs font-bold text-amber hover:underline"
        >
          View page
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  )
}
