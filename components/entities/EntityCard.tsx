import Link from 'next/link'
import Image from 'next/image'
import type { Route } from 'next'
import { Calendar } from 'lucide-react'

import { StatusBadge } from '@/components/ui/status-badge'
import { OwnershipBadge } from '@/components/ui/ownership-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SaveIconButton } from '@/components/ui/save-icon-button'
import { cn } from '@/lib/utils'
import type { DiscoveryEntity } from '@/types'
import { buildEntityUrl } from '@/lib/listings/url'
import { resolveCoverImage } from '@/lib/listings/coverImage'

interface EntityCardProps {
  entity: DiscoveryEntity
  className?: string
  isPriority?: boolean
}

const ENTITY_TYPE_LABELS: Record<DiscoveryEntity['entity_type'], string> = {
  business: 'Business',
  professional: 'Professional',
  creative: 'Creative',
  event: 'Event',
  job: 'Job',
  vendor: 'Vendor',
}

function getLocationString(entity: DiscoveryEntity): string {
  const { location_type, city } = entity
  if (location_type === 'online') return 'Online'
  if (location_type === 'virtual-services') return 'Virtual Services'
  if (location_type === 'ships-nationwide') return 'Ships Nationwide'
  if (city) {
    const base = `${city.name}, ${city.state_abbr}`
    return location_type === 'hybrid' ? `${base} · Hybrid` : base
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

function CoverPlaceholder({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
  return (
    <div className="w-full h-full bg-deep-bg flex items-center justify-center" aria-hidden="true">
      <span className="font-headline text-4xl text-gold select-none">{initials}</span>
    </div>
  )
}

export function EntityCard({ entity, className, isPriority = false }: EntityCardProps) {
  const href = getEntityHref(entity)
  const locationStr = getLocationString(entity)
  const cover = resolveCoverImage(entity.cover_image_path, entity.entity_type, entity.id)

  return (
    <article
      className={cn(
        'group bg-white rounded-xl border border-charcoal/10 overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200',
        className
      )}
    >
      {/* Cover image — 3:2 aspect ratio */}
      <div className="relative w-full aspect-[3/2] bg-deep-bg overflow-hidden shrink-0">
        {cover.src ? (
          <Image
            src={cover.src}
            alt=""
            fill
            priority={isPriority}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <CoverPlaceholder name={entity.name} />
        )}

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
        {/* Badge order: ownership label → trust (claimed/unclaimed) → entity type */}
        <div className="flex items-center gap-2 flex-wrap">
          <OwnershipBadge label={entity.ownership_label} size="small" />
          <StatusBadge tier={entity.trust_tier} size="small" />
          <Badge
            variant="outline"
            className="rounded-full border-charcoal/30 text-charcoal text-[11px] font-subhead font-semibold px-2 py-0.5 h-auto"
          >
            {ENTITY_TYPE_LABELS[entity.entity_type]}
          </Badge>
        </div>

        {/* Name */}
        <h3 className="font-headline text-base text-brand-black leading-snug line-clamp-2">
          <Link href={href as Route} className="hover:underline underline-offset-2">
            {entity.name}
          </Link>
        </h3>

        {/* Category + location */}
        <p className="text-xs font-subhead text-charcoal">
          {entity.category.name}
          <span className="mx-1 text-charcoal-faint">·</span>
          {locationStr}
        </p>

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
            <Link href={href as Route}>View Page</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}
