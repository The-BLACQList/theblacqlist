'use client'

import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, ShieldCheck } from 'lucide-react'
import { isOpenNow } from '@/lib/listings/openStatus'
import { resolveRemoteImage } from '@/lib/listings/coverImage'
import { formatMiles } from '@/lib/map/distance'
import { listingPhoto } from '@/lib/map/rankListings'
import { TIER_LABEL, type MapListing } from '@/lib/map/types'
import { cn } from '@/lib/utils'

interface Props {
  listing: MapListing
  /** Pin number, or null when this listing is a small dot on the map. */
  number: number | null
  selected: boolean
  /** strip = fixed 250px card in the phone carousel. grid = fills its cell. */
  variant: 'grid' | 'strip'
  /** Miles from the visitor while Near me is on, else null. */
  distance: number | null
  onSelect: (listing: MapListing) => void
  onHover: (id: string | null) => void
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

function TierMark({ tier }: { tier: MapListing['trustTier'] }) {
  if (tier === 'certified') return <ShieldCheck className="size-3.5" aria-hidden="true" />
  if (tier === 'verified') return <BadgeCheck className="size-3.5" aria-hidden="true" />
  return null
}

/**
 * One business as a photo card. The whole card selects its pin; the page link
 * appears once the card is selected so a keyboard user always has a way in.
 */
export function MapListingCard({ listing, number, selected, variant, distance, onSelect, onHover }: Props) {
  const photo = resolveRemoteImage(listingPhoto(listing))
  const open = listing.hours ? isOpenNow(listing.hours) : null
  const hasRating = listing.avgRating !== null && listing.reviewCount > 0
  const label = number ? `${listing.name}, number ${number}` : listing.name

  return (
    <article
      data-listing-id={listing.id}
      className={cn(
        'rounded-[18px] bg-white p-1.5 transition-shadow duration-150',
        variant === 'strip' ? 'w-[250px] shrink-0 snap-start' : 'w-full',
        selected ? 'ring-2 ring-gold shadow-md' : 'ring-1 ring-hairline'
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(listing)}
        onMouseEnter={() => onHover(listing.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(listing.id)}
        onBlur={() => onHover(null)}
        aria-label={label}
        aria-pressed={selected}
        className="block w-full rounded-[14px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      >
        <span className="relative block aspect-[4/3] overflow-hidden rounded-[14px] bg-ink">
          {photo ? (
            <Image
              src={photo.src}
              unoptimized={photo.unoptimized}
              alt=""
              fill
              sizes="(min-width: 1024px) 220px, 250px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center font-headline text-2xl text-gold">
              {initials(listing.name)}
            </span>
          )}
          {number && (
            <span
              aria-hidden="true"
              className="absolute right-2 top-2 flex size-[26px] items-center justify-center rounded-full bg-ground font-headline text-[13px] text-white"
            >
              {number}
            </span>
          )}
        </span>
        <span className="mt-2 block px-1.5 pb-1">
          <span className="block truncate font-headline text-[17px] leading-tight text-ink">
            {listing.name}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-charcoal">
            {[distance !== null ? formatMiles(distance) : null, listing.category, open?.label]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-amber">
            <TierMark tier={listing.trustTier} />
            {TIER_LABEL[listing.trustTier]}
            {hasRating && (
              <span className="font-normal text-charcoal">
                · {listing.avgRating!.toFixed(1)} stars, {listing.reviewCount} reviews
              </span>
            )}
          </span>
        </span>
      </button>
      {selected && (
        <Link
          href={listing.href}
          className="mx-1.5 mb-1.5 mt-1 flex min-h-11 items-center justify-center rounded-xl bg-ground text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          View page
        </Link>
      )}
    </article>
  )
}
