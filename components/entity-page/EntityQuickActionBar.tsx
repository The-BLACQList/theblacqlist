'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Phone, MapPin, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SaveButton } from '@/components/entity-page/SaveButton'
import { ShareButton } from '@/components/entity-page/ShareButton'
import { getCtaHref, getEntityCtaLabel } from '@/components/entity-page/templates/cta'
import { trackContactTap } from '@/lib/analytics/contactTap'
import { directionsUrl } from '@/lib/listings/directions'
import type { EntityPageData } from '@/types'

interface Props {
  entity: EntityPageData
  initialSaved?: boolean
  /**
   * "I shopped here" (ticket 162). The page decides, because it alone knows
   * the reader is signed in and The Collective is open; see showShoppedHere.
   */
  showShoppedHere?: boolean
}

export function EntityQuickActionBar({
  entity,
  initialSaved = false,
  showShoppedHere = false,
}: Props) {
  const [visible, setVisible] = useState(false)

  const ctaLabel = getEntityCtaLabel(entity)
  // Same resolution the hero uses, so the bar's button and the hero's button
  // always agree. null = no reachable destination → render no button.
  const ctaHref = getCtaHref(entity)
  // Extra buttons by plan (part B). Desktop shows the first one beside the main
  // button and the rest under "More"; the narrow mobile bar puts them all there.
  const extras = entity.buttons ?? []
  const [firstExtra, ...moreExtras] = extras

  const shortName = entity.name.length > 18 ? entity.name.slice(0, 17) + '…' : entity.name

  useEffect(() => {
    const heroCta = document.getElementById('hero-cta')
    if (!heroCta) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry!.isIntersecting)
      },
      { threshold: 0 }
    )
    observer.observe(heroCta)
    return () => observer.disconnect()
  }, [])

  const mapsHref = directionsUrl({
    name: entity.name,
    street: entity.details.address,
    city: entity.details.city_name,
    state: entity.details.state_abbr,
    zip: entity.details.zip,
  })

  // Website, call and directions taps count toward the weekly Featured score.
  const tap = (href: string) => () => trackContactTap(entity.id, href, 'action_bar')
  const phoneHref = entity.details.phone ? `tel:${entity.details.phone.replace(/\D/g, '')}` : null
  const receiptHref = `/account/receipts/new?listing=${entity.id}`

  return (
    <>
      {/* Mobile bar — fixed bottom, slides up. `data-quick-bar` lets the
          floating pills (tour rail, Report a problem) lift above it while it
          shows; see `.lift-over-quick-bar` in app/globals.css. */}
      <div
        aria-hidden={!visible}
        data-quick-bar={visible ? 'shown' : 'hidden'}
        className={cn(
          'md:hidden fixed bottom-0 left-0 right-0 z-40 bg-brand-black border-t border-white/10',
          'transition-transform duration-300 ease-out',
          visible ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="flex items-center gap-3 px-4 py-3 safe-area-inset-bottom">
          {/* At 375px the name, the CTA, "I shopped here" and two icon buttons
              don't all fit, and the name is already the page's heading. */}
          {!showShoppedHere && (
            <span className="font-subhead text-sm font-semibold text-white truncate min-w-0 flex-shrink">
              {shortName}
            </span>
          )}
          {ctaHref && (
            <a
              href={ctaHref}
              onClick={tap(ctaHref)}
              tabIndex={visible ? 0 : -1}
              className="flex-1 inline-flex items-center justify-center h-11 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-gold"
            >
              {ctaLabel}
            </a>
          )}
          {extras.length > 0 && (
            <MoreButtons
              buttons={extras}
              listingId={entity.id}
              visible={visible}
              placement="up"
              className="flex-shrink-0 size-11"
            />
          )}
          {showShoppedHere && (
            <Link
              href={receiptHref}
              tabIndex={visible ? 0 : -1}
              className={cn(
                'inline-flex items-center justify-center h-11 px-3 rounded-full border border-white/30 hover:bg-white/10 text-white font-subhead font-semibold text-sm whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-gold',
                ctaHref ? 'flex-shrink-0' : 'flex-1'
              )}
            >
              I shopped here
            </Link>
          )}
          <SaveButton
            listingId={entity.id}
            initialSaved={initialSaved}
            tabIndex={visible ? 0 : -1}
            surface="bar"
            className="flex-shrink-0 size-11"
          />
          <ShareButton
            listingName={entity.name}
            listingId={entity.id}
            listingSlug={entity.slug}
            cityName={entity.city?.name}
            categoryName={entity.category.name}
            tabIndex={visible ? 0 : -1}
            className="flex-shrink-0 size-11 bg-white/10 hover:bg-white/20 text-white"
          />
        </div>
      </div>

      {/* Desktop bar — fixed top (below nav at 64px), fades in */}
      <div
        aria-hidden={!visible}
        className={cn(
          'hidden md:flex fixed top-16 left-0 right-0 z-40 bg-brand-black border-b border-white/10',
          'transition-opacity duration-300 ease-out h-[52px]',
          visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8 flex items-center gap-4">
          <span className="font-subhead text-sm font-semibold text-white truncate mr-auto">
            {entity.name}
          </span>

          {phoneHref && (
            <a
              href={phoneHref}
              onClick={tap(phoneHref)}
              tabIndex={visible ? 0 : -1}
              className="inline-flex items-center gap-1.5 font-subhead text-sm text-white/70 hover:text-white transition-colors"
              aria-label={`Call ${entity.name}: ${entity.details.phone}`}
            >
              <Phone className="size-4" aria-hidden="true" />
              <span>{entity.details.phone}</span>
            </a>
          )}

          {mapsHref && (
            <a
              href={mapsHref}
              onClick={tap(mapsHref)}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={visible ? 0 : -1}
              aria-label="Get directions"
              className="inline-flex items-center gap-1.5 font-subhead text-sm text-white/70 hover:text-white transition-colors"
            >
              <MapPin className="size-4" aria-hidden="true" />
              <span>Directions</span>
            </a>
          )}

          {showShoppedHere && (
            <Link
              href={receiptHref}
              tabIndex={visible ? 0 : -1}
              className="inline-flex items-center justify-center h-9 px-4 rounded-full border border-white/30 hover:bg-white/10 text-white font-subhead font-semibold text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-gold"
            >
              I shopped here
            </Link>
          )}

          {ctaHref && (
            <a
              href={ctaHref}
              onClick={tap(ctaHref)}
              tabIndex={visible ? 0 : -1}
              className="inline-flex items-center justify-center h-9 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-gold"
            >
              {ctaLabel}
            </a>
          )}

          {firstExtra && (
            <a
              href={firstExtra.href}
              onClick={tap(firstExtra.href)}
              tabIndex={visible ? 0 : -1}
              className="inline-flex items-center justify-center h-9 px-4 rounded-full border border-white/30 hover:bg-white/10 text-white font-subhead font-semibold text-sm whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-gold"
            >
              {firstExtra.label}
            </a>
          )}

          {moreExtras.length > 0 && (
            <MoreButtons
              buttons={moreExtras}
              listingId={entity.id}
              visible={visible}
              placement="down"
              className="size-9"
            />
          )}

          <SaveButton
            listingId={entity.id}
            initialSaved={initialSaved}
            tabIndex={visible ? 0 : -1}
            surface="bar"
            className="size-9"
          />

          <ShareButton
            listingName={entity.name}
            listingId={entity.id}
            listingSlug={entity.slug}
            cityName={entity.city?.name}
            categoryName={entity.category.name}
            tabIndex={visible ? 0 : -1}
            className="size-9 bg-white/10 hover:bg-white/20 text-white"
          />
        </div>
      </div>
    </>
  )
}

/**
 * "More" in the quick-action bar: the page's other buttons in a small menu.
 * Opens up from the mobile bar (it sits at the bottom) and down from the
 * desktop bar. Escape or a click outside closes it.
 */
function MoreButtons({
  buttons,
  listingId,
  visible,
  placement,
  className,
}: {
  buttons: { id: string; href: string; label: string }[]
  listingId: string
  visible: boolean
  placement: 'up' | 'down'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isOpen = open && visible

  useEffect(() => {
    if (!isOpen) return
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label="More buttons"
        tabIndex={visible ? 0 : -1}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-gold',
          className
        )}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
      {isOpen && (
        <ul
          className={cn(
            'absolute right-0 z-50 min-w-[12rem] rounded-xl border border-white/10 bg-brand-black py-1.5 shadow-lg',
            placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          {buttons.map((b) => (
            <li key={b.id}>
              <a
                href={b.href}
                onClick={() => {
                  trackContactTap(listingId, b.href, 'action_bar')
                  setOpen(false)
                }}
                className="block px-4 py-2.5 font-subhead text-sm font-semibold text-white hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
              >
                {b.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
