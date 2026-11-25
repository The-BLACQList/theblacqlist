'use client'

import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, ShieldCheck } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { isOpenNow } from '@/lib/listings/openStatus'
import { resolveRemoteImage } from '@/lib/listings/coverImage'
import { formatMiles } from '@/lib/map/distance'
import { listingPhoto } from '@/lib/map/rankListings'
import { TIER_LABEL, type MapListing } from '@/lib/map/types'
import { cn } from '@/lib/utils'

interface Props {
  listing: MapListing
  selected: boolean
  /** The pointer is on this business's square or dot on the map (ticket 244). */
  hovered: boolean
  /**
   * strip = fixed-width card in the phone carousel, photo on top; on a short
   * screen the photo sits beside the words. grid = fills its cell.
   */
  variant: 'grid' | 'strip'
  /** Miles from the visitor while Near me is on, else null. */
  distance: number | null
  onSelect: (listing: MapListing) => void
  onHover: (id: string | null) => void
}

// The strip's card, and its shape on a short screen (ticket 285): a row, so the
// sheet is about 180px tall instead of 350px. The skeleton uses the same four.
const STRIP_CARD = 'w-[250px] shrink-0 snap-start map-short:w-[280px]'
const STRIP_ROW = 'map-short:flex map-short:items-center map-short:gap-2'
const STRIP_PHOTO = 'map-short:aspect-square map-short:w-20 map-short:shrink-0'
const STRIP_WORDS = 'map-short:mt-0 map-short:min-w-0 map-short:flex-1 map-short:pb-0'

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
export function MapListingCard({ listing, selected, hovered, variant, distance, onSelect, onHover }: Props) {
  const photo = resolveRemoteImage(listingPhoto(listing))
  const open = listing.hours ? isOpenNow(listing.hours) : null
  const hasRating = listing.avgRating !== null && listing.reviewCount > 0

  return (
    <article
      data-listing-id={listing.id}
      className={cn(
        'rounded-[18px] bg-white p-1.5 transition-shadow duration-150',
        variant === 'strip' ? STRIP_CARD : 'w-full',
        selected ? 'ring-2 ring-gold shadow-md' : hovered ? 'ring-2 ring-ink' : 'ring-1 ring-hairline'
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(listing)}
        onMouseEnter={() => onHover(listing.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(listing.id)}
        onBlur={() => onHover(null)}
        aria-label={listing.name}
        aria-pressed={selected}
        className={cn(
          'block w-full rounded-[14px] text-left',
          variant === 'strip' && STRIP_ROW,
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber'
        )}
      >
        <span
          className={cn(
            'relative block aspect-[4/3] overflow-hidden rounded-[14px] bg-ink',
            variant === 'strip' && STRIP_PHOTO
          )}
        >
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
        </span>
        <span className={cn('mt-2 block px-1.5 pb-1', variant === 'strip' && STRIP_WORDS)}>
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
          View Page
        </Link>
      )}
    </article>
  )
}

/**
 * The card before its business arrives. Same box, photo and three text lines as
 * the card above, so a list keeps its height when the real cards replace it.
 */
export function MapListingCardSkeleton({ variant }: Pick<Props, 'variant'>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded-[18px] bg-white p-1.5 ring-1 ring-hairline',
        variant === 'strip' ? STRIP_CARD : 'w-full'
      )}
    >
      <div className={cn(variant === 'strip' && STRIP_ROW)}>
        <Skeleton className={cn('aspect-[4/3] w-full rounded-[14px]', variant === 'strip' && STRIP_PHOTO)} />
        <div className={cn('mt-2 px-1.5 pb-1', variant === 'strip' && STRIP_WORDS)}>
          <SkeletonLine className="font-headline text-[17px] leading-tight" bar="w-3/4" />
          <SkeletonLine className="mt-0.5 text-[13px]" bar="w-1/2" />
          <SkeletonLine className="mt-1 text-[12.5px]" bar="w-2/5" />
        </div>
      </div>
    </div>
  )
}

/** A bar inside an empty line of text, so the line is as tall as the words will be. */
function SkeletonLine({ className, bar }: { className: string; bar: string }) {
  return (
    <div className={cn('relative', className)}>
      &nbsp;
      <Skeleton className={cn('absolute inset-y-[15%] left-0', bar)} />
    </div>
  )
}
