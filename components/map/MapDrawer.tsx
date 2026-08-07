'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { isOpenNow } from '@/lib/listings/openStatus'
import { cn } from '@/lib/utils'
import type { MapListing } from '@/components/map/MapExplore'

interface Props {
  listings: MapListing[]
  totalCount: number
  loadError: boolean
  highlightId: string | null
  onHover: (id: string | null) => void
  onSelect: (listing: MapListing) => void
}

const TIER_LABEL: Record<MapListing['trustTier'], string> = {
  certified: '★ Certified',
  verified: '✓ Verified',
  claimed: 'Claimed',
  unclaimed: 'Unclaimed',
}

/**
 * The floating results drawer (desktop left panel / mobile bottom sheet).
 * This list is the accessible, keyboard-first path to every business on the
 * map — the canvas is an enhancement, never the only way in.
 */
export function MapDrawer({ listings, totalCount, loadError, highlightId, onHover, onSelect }: Props) {
  const [open, setOpen] = useState(true)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Show results list"
        className="absolute left-3 bottom-3 md:top-20 md:bottom-auto z-20 flex items-center gap-2 min-h-11 px-4 rounded-full bg-deep-bg/90 border border-off-white/25 text-off-white font-subhead text-[13px] font-semibold backdrop-blur-sm hover:bg-deep-bg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        <PanelLeftOpen className="size-4" aria-hidden="true" />
        {totalCount} businesses
      </button>
    )
  }

  return (
    <section
      aria-label="Businesses on the map"
      className={cn(
        'absolute z-20 bg-deep-bg/92 border border-off-white/15 backdrop-blur-md text-off-white flex flex-col overflow-hidden',
        // Mobile: bottom sheet. Desktop: left drawer.
        'inset-x-3 bottom-3 max-h-[42dvh] rounded-2xl',
        'md:inset-x-auto md:left-3 md:top-20 md:bottom-3 md:w-[300px] md:max-h-none md:rounded-xl'
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-off-white/10">
        <h2 className="font-headline text-[15px] text-white">
          {loadError ? 'Businesses' : `${listings.length} in view`}
          {!loadError && totalCount > 0 && (
            <span className="font-subhead text-[11px] text-off-white/60 ml-2">
              of {totalCount}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Hide results list"
          className="flex size-9 items-center justify-center rounded-md text-off-white/70 hover:text-white hover:bg-off-white/10 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <PanelLeftClose className="size-4" aria-hidden="true" />
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2 list-none m-0">
        {loadError && (
          <li className="p-4 text-center">
            <p className="font-body text-sm text-off-white/80">
              Couldn&apos;t load the map listings.
            </p>
            <Link
              href="/discover"
              className="font-subhead text-sm font-bold text-gold underline underline-offset-2"
            >
              Browse on Discover instead →
            </Link>
          </li>
        )}
        {!loadError && listings.length === 0 && (
          <li className="p-4 text-center font-body text-sm text-off-white/70">
            No businesses in this view — zoom out or switch city.
          </li>
        )}
        {listings.map((listing) => {
          const openState = listing.hours ? isOpenNow(listing.hours) : null
          const active = listing.id === highlightId
          return (
            <li key={listing.id}>
              <button
                type="button"
                onClick={() => onSelect(listing)}
                onMouseEnter={() => onHover(listing.id)}
                onFocus={() => onHover(listing.id)}
                className={cn(
                  'w-full text-left rounded-lg bg-white text-brand-black px-3 py-2.5 transition-shadow duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
                  active && 'ring-2 ring-gold shadow-[0_0_16px_rgba(255,216,103,0.45)]'
                )}
              >
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="font-headline text-[14px] leading-tight">{listing.name}</span>
                  {(listing.isSponsored || listing.isFeatured) && (
                    <span className="rounded-full bg-pale-lavender text-charcoal text-[9.5px] font-subhead font-bold px-1.5 py-px uppercase tracking-wide">
                      {listing.isFeatured ? 'Featured' : 'Sponsored'}
                    </span>
                  )}
                </span>
                <span className="block font-subhead text-[11.5px] text-charcoal-soft mt-0.5">
                  {[listing.category, TIER_LABEL[listing.trustTier]].filter(Boolean).join(' · ')}
                </span>
                <span className="flex items-center justify-between mt-0.5">
                  {openState ? (
                    <span
                      className={cn(
                        'font-subhead text-[11px] font-semibold',
                        openState.open ? 'text-success' : 'text-charcoal-soft'
                      )}
                    >
                      {openState.label}
                    </span>
                  ) : (
                    <span />
                  )}
                  <Link
                    href={listing.href}
                    onClick={(e) => e.stopPropagation()}
                    className="font-subhead text-[11px] font-bold text-amber hover:text-brand-black underline underline-offset-2"
                  >
                    View page →
                  </Link>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
