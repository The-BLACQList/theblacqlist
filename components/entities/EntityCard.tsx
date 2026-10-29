import Link from 'next/link'
import type { Route } from 'next'
import { Calendar, Handshake } from 'lucide-react'

import { StatusBadge } from '@/components/ui/status-badge'
import { OwnershipBadge } from '@/components/ui/ownership-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SaveIconButton } from '@/components/ui/save-icon-button'
import { SponsoredImpression, SponsoredLink } from '@/components/entities/SponsoredTracking'
import { CoverImage } from '@/components/media/CoverImage'
import { cn } from '@/lib/utils'
import type { DiscoveryEntity, LocationType } from '@/types'
import { buildEntityUrl, categoryFilterHref, levelFilterHref } from '@/lib/listings/url'
import { levelPill, LEVEL_META, isBusinessLevel } from '@/lib/listings/levels'
import { partnershipPill } from '@/lib/listings/partnerships'
import { resolveCoverImage } from '@/lib/listings/coverImage'

interface EntityCardProps {
  entity: DiscoveryEntity
  className?: string
  isPriority?: boolean
}

// Only events and jobs keep a type pill: "Event" and "Job" tell a shopper
// something the category doesn't. Every other type is covered by the category
// chip (founder decision 2026-10-16), so "Business" no longer repeats on each card.
const TYPE_PILL_LABELS: Partial<Record<DiscoveryEntity['entity_type'], string>> = {
  event: 'Event',
  job: 'Job',
}

/**
 * What the card's location line says for each of the six live
 * `listings.location_type` values (migration 20260524000001). `standalone`
 * replaces the city line — a virtual business has no meaningful city to show —
 * and `suffix` appends to it.
 *
 * Exhaustive over LocationType on purpose: a seventh value added to the CHECK
 * fails this build instead of quietly rendering nothing. Until 2026-08-15 this
 * was three `if` branches testing the PRE-migration names ('online',
 * 'virtual-services', 'ships-nationwide'), which had matched no row since May,
 * while the four values the DB actually serves had no branch at all — so an
 * online-only listing with no city read "Multiple Locations".
 */
const LOCATION_COPY: Record<LocationType, { standalone?: string; suffix?: string }> = {
  physical: {},
  virtual: { standalone: 'Online only' },
  national: { standalone: 'Ships nationwide' },
  hybrid: { suffix: 'Storefront & online' },
  service_area: { suffix: 'Comes to you' },
  traveling: { suffix: 'Mobile' },
}

function getLocationString(entity: DiscoveryEntity): string {
  const { location_type, city } = entity
  const copy = LOCATION_COPY[location_type]
  if (copy?.standalone) return copy.standalone
  if (city) {
    const base = `${city.name}, ${city.state_abbr}`
    return copy?.suffix ? `${base} · ${copy.suffix}` : base
  }
  return 'Multiple Locations'
}

function getEntityHref(entity: DiscoveryEntity): string {
  return buildEntityUrl(entity.entity_type, entity.city?.slug, entity.slug)
}

function formatEventDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function EntityCard({ entity, className, isPriority = false }: EntityCardProps) {
  const href = getEntityHref(entity)
  const locationStr = getLocationString(entity)
  const cover = resolveCoverImage(entity.cover_image_path, entity.entity_type, entity.id)
  const categoryHref = categoryFilterHref(entity.category)
  // Grower, Maker or Supplier only. Local is the default and goes unsaid.
  const levelText = levelPill(entity.primary_level)
  const levelHref = levelFilterHref(entity.primary_level)
  const typePill = TYPE_PILL_LABELS[entity.entity_type]
  const partnersText = partnershipPill(entity.entity_type, entity.open_to_partnerships)

  // Set only on cards the sponsored path spliced in (lib/listings/query.ts), so
  // the client islands below mount on at most three cards per page. The rest of
  // the grid stays server-rendered.
  const placementId = entity.sponsored_placement_id
  const delivery = placementId
    ? { placementId, listingId: entity.id, position: entity.sponsored_position }
    : null

  return (
    <article
      className={cn(
        'group bg-white rounded-xl border border-charcoal/10 overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200',
        className
      )}
    >
      {delivery && <SponsoredImpression {...delivery} />}

      {/* Cover image — 3:2 aspect ratio */}
      <div className="relative w-full aspect-[3/2] bg-deep-bg overflow-hidden shrink-0">
        <CoverImage
          src={cover.src}
          alt=""
          name={entity.name}
          categoryName={entity.category.name}
          seed={entity.id}
          priority={isPriority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          fallbackSize="card"
          className="group-hover:scale-105 transition-transform duration-300"
        />

        {/* Save / bookmark — real button (handles auth: anon click → sign-in) */}
        <SaveIconButton
          listingId={entity.id}
          listingName={entity.name}
          initialIsSaved={entity.isSaved ?? false}
          className="z-10"
        />

        {/* Featured / Sponsored badge */}
        {(entity.is_featured || entity.is_sponsored) && (
          <div className="absolute top-2 left-2 z-10">
            {entity.is_featured && (
              <span className="inline-block rounded-full bg-amber-gold text-brand-black text-[10px] font-subhead font-bold px-2 py-0.5 uppercase tracking-wide">
                Featured
              </span>
            )}
            {entity.is_sponsored && !entity.is_featured && (
              <span className="inline-block rounded-full bg-charcoal/70 text-white text-[10px] font-subhead font-bold px-2 py-0.5 uppercase tracking-wide">
                Sponsored
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        {/* Pill order: category chip (filters) → level (Grower, Maker or
            Supplier only) → Ally (only when Ally) → trust (only when earned) →
            type (events and jobs only) → partnerships (only when the owner
            switched it on). No Black-Owned, Unclaimed or Local
            pill: none of them helps a shopper narrow things down. */}
        <div className="flex items-center gap-2 flex-wrap">
          {categoryHref && (
            <Link
              href={categoryHref as Route}
              aria-label={`More in ${entity.category.name}`}
              className="relative inline-flex items-center rounded-full border border-charcoal/30 text-charcoal text-[11px] font-subhead font-semibold px-2 py-0.5 hover:bg-charcoal/5 hover:border-charcoal/50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-black after:absolute after:-inset-y-2 after:inset-x-0 after:content-['']"
            >
              {entity.category.name}
            </Link>
          )}
          {levelText && levelHref && isBusinessLevel(entity.primary_level) && (
            <Link
              href={levelHref as Route}
              aria-label={`More ${LEVEL_META[entity.primary_level].emptyNoun}`}
              className="relative inline-flex items-center rounded-full border border-dashed border-charcoal/30 text-charcoal text-[11px] font-subhead font-semibold px-2 py-0.5 hover:bg-charcoal/5 hover:border-charcoal/50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-black after:absolute after:-inset-y-2 after:inset-x-0 after:content-['']"
            >
              {levelText}
            </Link>
          )}
          <OwnershipBadge label={entity.ownership_label} entityType={entity.entity_type} size="small" />
          {entity.trust_tier !== 'unclaimed' && (
            <StatusBadge tier={entity.trust_tier} size="small" />
          )}
          {typePill && (
            <Badge
              variant="outline"
              className="rounded-full border-charcoal/30 text-charcoal text-[11px] font-subhead font-semibold px-2 py-0.5 h-auto"
            >
              {typePill}
            </Badge>
          )}
          {partnersText && (
            <span className="inline-flex items-center gap-1 rounded-full border border-charcoal/30 text-charcoal text-[11px] font-subhead font-semibold px-2 py-0.5">
              <Handshake className="size-3 shrink-0" aria-hidden="true" />
              {partnersText}
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="font-headline text-base text-brand-black leading-snug line-clamp-2">
          {delivery ? (
            <SponsoredLink {...delivery} href={href} className="hover:underline underline-offset-2">
              {entity.name}
            </SponsoredLink>
          ) : (
            <Link href={href as Route} className="hover:underline underline-offset-2">
              {entity.name}
            </Link>
          )}
        </h3>

        {/* Location (the category now sits in the chip above) */}
        <p className="text-xs font-subhead text-charcoal">{locationStr}</p>

        {/* Event date (event cards only) */}
        {entity.entity_type === 'event' && entity.event_starts_at && (
          <p className="text-xs font-subhead font-semibold text-amber flex items-center gap-1">
            <Calendar className="size-3.5 shrink-0" aria-hidden="true" />
            {formatEventDate(entity.event_starts_at)}
          </p>
        )}

        {/* Identity & Ownership chips (e.g. Black-Woman-Owned) */}
        {entity.identity_chips && entity.identity_chips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entity.identity_chips.map((chip) => (
              <span
                key={chip}
                className="inline-block rounded-full bg-pale-lavender text-brand-black text-[10px] font-subhead font-semibold px-2 py-0.5"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        <p className="text-sm font-subhead text-charcoal leading-relaxed line-clamp-2 flex-1">
          {entity.description}
        </p>

        {/* CTA */}
        <div className="mt-2">
          <Button
            asChild
            variant="outline"
            className="w-full border-brand-black text-brand-black font-body font-bold rounded-full min-h-[44px] h-auto hover:bg-brand-black hover:text-white transition-colors"
          >
            {delivery ? (
              <SponsoredLink {...delivery} href={href}>
                View Page
              </SponsoredLink>
            ) : (
              <Link href={href as Route}>View Page</Link>
            )}
          </Button>
        </div>
      </div>
    </article>
  )
}
