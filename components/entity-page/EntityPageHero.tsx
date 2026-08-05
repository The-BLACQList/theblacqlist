import Image from 'next/image'
import { Share2, Star } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { OwnershipBadge } from '@/components/ui/ownership-badge'
import { SaveButton } from '@/components/entity-page/SaveButton'
import { cn } from '@/lib/utils'
import { getCtaLabel } from '@/types'
import type { EntityPageData } from '@/types'
import { resolveCoverImage } from '@/lib/listings/coverImage'

interface Props {
  entity: EntityPageData
  initialSaved?: boolean
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
    <div className="absolute inset-0 bg-gradient-to-br from-charcoal/60 to-brand-black flex items-center justify-center">
      <span className="font-headline text-6xl text-white/20 select-none">{initials}</span>
    </div>
  )
}

export function EntityPageHero({ entity, initialSaved = false }: Props) {
  const isPremium = entity.tier === 'premium'
  const ctaLabel = getCtaLabel(entity.details.cta_type, entity.details.cta_label_override)
  const cover = resolveCoverImage(entity.cover_image_path, entity.entity_type, entity.id)

  // CTA href: "call" type uses tel: link, otherwise use cta_url or fallback "#"
  const ctaHref =
    entity.details.cta_type === 'call' && entity.details.phone
      ? `tel:${entity.details.phone.replace(/\D/g, '')}`
      : (entity.details.cta_url ?? '#')

  return (
    <div
      className={cn(
        'relative overflow-hidden w-full',
        // Heights: mobile 240px; desktop varies by tier
        'h-[240px] md:h-[360px]',
        entity.tier === 'standard' && 'md:h-[400px]',
        isPremium && 'md:h-[560px]'
      )}
    >
      {/* Cover image or placeholder */}
      {cover.src ? (
        <Image
          src={cover.src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <CoverPlaceholder name={entity.name} />
      )}

      {/* Gradient overlay: transparent top → dark bottom */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, transparent 0%, transparent 40%, rgba(0,0,0,0.72) 100%)',
        }}
        aria-hidden="true"
      />

      {/* Ownership + trust badges — upper left */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <OwnershipBadge label={entity.ownership_label} size="small" />
        <StatusBadge tier={entity.trust_tier} size="small" />
      </div>

      {/* Featured badge — upper right */}
      {entity.is_featured && (
        <div className="absolute top-4 right-4 z-10">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-gold text-brand-black font-subhead text-xs font-semibold leading-none">
            Featured
          </span>
        </div>
      )}

      {/* Bottom content: name, tagline, CTA, save/share */}
      <div className="absolute bottom-0 left-0 right-0 px-4 md:px-6 lg:px-8 pb-6 z-10">
        <h1 className="font-headline text-[28px] md:text-[40px] text-white leading-tight mb-1">
          {entity.name}
        </h1>
        <p
          className={cn(
            'font-body text-sm md:text-base text-white/80 line-clamp-2 max-w-xl',
            entity.avg_rating !== null && entity.review_count > 0 ? 'mb-2' : 'mb-4'
          )}
        >
          {entity.tagline}
        </p>

        {entity.avg_rating !== null && entity.review_count > 0 && (
          <div
            className="flex items-center gap-1.5 mb-4"
            aria-label={`${entity.avg_rating.toFixed(1)} out of 5 stars from ${entity.review_count} reviews`}
          >
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={cn(
                  'size-4',
                  i < Math.round(entity.avg_rating!)
                    ? 'fill-amber-gold text-gold'
                    : 'fill-transparent text-white/30'
                )}
                aria-hidden="true"
              />
            ))}
            <span className="font-subhead text-sm font-semibold text-white/90 ml-0.5">
              {entity.avg_rating.toFixed(1)}
            </span>
            <span className="font-body text-xs text-white/60">({entity.review_count})</span>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {/* Primary CTA — id="hero-cta" is the IntersectionObserver target */}
          <a
            id="hero-cta"
            href={ctaHref}
            className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold min-w-[120px]"
          >
            {ctaLabel}
          </a>

          <SaveButton
            listingId={entity.id}
            initialSaved={initialSaved}
            className="size-11 bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm"
          />

          {/* Share — placeholder */}
          <button
            type="button"
            aria-label="Share this listing"
            className="inline-flex items-center justify-center size-11 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm transition-colors"
          >
            <Share2 className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
