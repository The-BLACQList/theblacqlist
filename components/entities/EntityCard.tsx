import Link from 'next/link'
import Image from 'next/image'
import type { Route } from 'next'
import { BookmarkPlus } from 'lucide-react'

import { StatusBadge } from '@/components/ui/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DiscoveryEntity } from '@/types'
import { buildEntityUrl } from '@/lib/listings/url'

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
      <span className="font-headline text-4xl text-amber-gold select-none">{initials}</span>
    </div>
  )
}

export function EntityCard({ entity, className, isPriority = false }: EntityCardProps) {
  const href = getEntityHref(entity)
  const locationStr = getLocationString(entity)

  return (
    <article
      className={cn(
        'group bg-white rounded-xl border border-charcoal/10 overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200',
        className
      )}
    >
      {/* Cover image — 3:2 aspect ratio */}
      <div className="relative w-full aspect-[3/2] bg-deep-bg overflow-hidden shrink-0">
        {entity.cover_image_path ? (
          <Image
            src={entity.cover_image_path}
            alt=""
            fill
            priority={isPriority}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <CoverPlaceholder name={entity.name} />
        )}

        {/* Top-right badges row */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
          {/* Save button — visual placeholder; auth not yet built */}
          <button
            aria-label="Save this listing (sign in required)"
            className="flex items-center justify-center size-10 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-1"
            type="button"
          >
            <BookmarkPlus size={18} aria-hidden="true" />
          </button>
        </div>

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
        {/* Entity type pill + trust badge row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="rounded-full border-charcoal/30 text-charcoal text-[11px] font-subhead font-semibold px-2 py-0.5 h-auto"
          >
            {ENTITY_TYPE_LABELS[entity.entity_type]}
          </Badge>
          <StatusBadge tier={entity.trust_tier} size="small" />
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
          <span className="mx-1 text-charcoal/40">·</span>
          {locationStr}
        </p>

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
