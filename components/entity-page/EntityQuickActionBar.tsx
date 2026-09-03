'use client'

import { useEffect, useState } from 'react'
import { Phone, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCtaLabel } from '@/types'
import { SaveButton } from '@/components/entity-page/SaveButton'
import { ShareButton } from '@/components/entity-page/ShareButton'
import { getCtaHref } from '@/components/entity-page/templates/cta'
import type { EntityPageData } from '@/types'

interface Props {
  entity: EntityPageData
  initialSaved?: boolean
}

export function EntityQuickActionBar({ entity, initialSaved = false }: Props) {
  const [visible, setVisible] = useState(false)

  const ctaLabel = getCtaLabel(entity.details.cta_type, entity.details.cta_label_override)
  // Same resolution the hero uses, so the bar's button and the hero's button
  // always agree. null = no reachable destination → render no button.
  const ctaHref = getCtaHref(entity)

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

  const mapsHref = entity.details.address
    ? `https://maps.google.com/?q=${encodeURIComponent(
        [
          entity.details.address,
          entity.details.city_name,
          entity.details.state_abbr,
          entity.details.zip,
        ]
          .filter(Boolean)
          .join(', ')
      )}`
    : null

  return (
    <>
      {/* Mobile bar — fixed bottom, slides up */}
      <div
        aria-hidden={!visible}
        className={cn(
          'md:hidden fixed bottom-0 left-0 right-0 z-40 bg-brand-black border-t border-white/10',
          'transition-transform duration-300 ease-out',
          visible ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="flex items-center gap-3 px-4 py-3 safe-area-inset-bottom">
          <span className="font-subhead text-sm font-semibold text-white truncate min-w-0 flex-shrink">
            {shortName}
          </span>
          {ctaHref && (
            <a
              href={ctaHref}
              tabIndex={visible ? 0 : -1}
              className="flex-1 inline-flex items-center justify-center h-10 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-gold"
            >
              {ctaLabel}
            </a>
          )}
          <SaveButton
            listingId={entity.id}
            initialSaved={initialSaved}
            tabIndex={visible ? 0 : -1}
            surface="bar"
            className="flex-shrink-0"
          />
          <ShareButton
            listingName={entity.name}
            listingId={entity.id}
            tabIndex={visible ? 0 : -1}
            className="flex-shrink-0 size-10 bg-white/10 hover:bg-white/20 text-white"
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

          {entity.details.phone && (
            <a
              href={`tel:${entity.details.phone.replace(/\D/g, '')}`}
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

          {ctaHref && (
            <a
              href={ctaHref}
              tabIndex={visible ? 0 : -1}
              className="inline-flex items-center justify-center h-9 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-gold"
            >
              {ctaLabel}
            </a>
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
            tabIndex={visible ? 0 : -1}
            className="size-9 bg-white/10 hover:bg-white/20 text-white"
          />
        </div>
      </div>
    </>
  )
}
