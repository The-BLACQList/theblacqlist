import { Star } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { OwnershipBadge } from '@/components/ui/ownership-badge'
import { SaveButton } from '@/components/entity-page/SaveButton'
import { CoverImage } from '@/components/media/CoverImage'
import { cn } from '@/lib/utils'
import { getCtaLabel } from '@/types'
import type { EntityPageData } from '@/types'
import { resolveCoverImage } from '@/lib/listings/coverImage'
import { getCtaHref } from '@/components/entity-page/templates/cta'
import { OpenStatus } from '@/components/entity-page/templates/OpenStatus'

interface Props {
  entity: EntityPageData
  initialSaved?: boolean
  /** professional = P-A Immersive Microsite; creative = C-B Cover Story */
  variant: 'professional' | 'creative'
}

const TYPE_LABELS: Record<string, string> = {
  professional: 'Professional',
  service_provider: 'Professional',
  creative: 'Creative',
}

/**
 * Immersive photographic hero for the Living Commerce Index templates.
 * Full-bleed cover (or the designed F-1 fallback), badges, name, tagline,
 * and the business-defined CTA inside the hero. The CTA keeps id="hero-cta"
 * so EntityQuickActionBar's IntersectionObserver continues to work.
 */
export function TemplateHero({ entity, initialSaved = false, variant }: Props) {
  const isCreative = variant === 'creative'
  const cover = resolveCoverImage(entity.cover_image_path, entity.entity_type, entity.id)
  const ctaLabel = getCtaLabel(entity.details.cta_type, entity.details.cta_label_override)
  const ctaHref = getCtaHref(entity)
  const typeLabel = TYPE_LABELS[entity.entity_type as string] ?? 'Business'
  const locationLine = [entity.category?.name, entity.city ? `${entity.city.name}, ${entity.city.state_abbr}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-deep-bg flex items-end',
        isCreative ? 'min-h-[420px] md:min-h-[74vh]' : 'min-h-[360px] md:min-h-[62vh]'
      )}
    >
      <CoverImage
        src={cover.src}
        alt=""
        name={entity.name}
        categoryName={entity.category?.name}
        seed={entity.id}
        priority
        scrim={cover.src ? 'bottom' : 'none'}
        fallbackSize="hero"
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-5 md:px-8 lg:px-10 pt-24 pb-9 md:pb-10">
        {isCreative && entity.category?.name && (
          <p className="font-subhead text-xs md:text-[13px] font-bold uppercase tracking-[0.22em] text-gold mb-2.5">
            {entity.category.name}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap mb-3">
          <OwnershipBadge label={entity.ownership_label} size="small" />
          <StatusBadge tier={entity.trust_tier} size="small" />
          <span className="inline-flex items-center h-[26px] px-2.5 rounded-full border border-off-white/40 font-subhead text-[12px] font-semibold text-off-white">
            {typeLabel}
          </span>
        </div>

        <h1
          className={cn(
            'font-headline text-white leading-tight text-balance',
            isCreative
              ? 'text-[38px] md:text-[56px] lg:text-[64px]'
              : 'text-[32px] md:text-[44px] lg:text-[52px]'
          )}
        >
          {entity.name}
        </h1>

        {!isCreative && locationLine && (
          <p className="flex items-center gap-3 flex-wrap font-body text-sm md:text-[15px] text-off-white/90 mt-2">
            {locationLine}
            <OpenStatus hours={entity.details.hours} surface="dark" />
          </p>
        )}
        {isCreative && entity.city && (
          <p className="flex items-center gap-3 flex-wrap font-body text-sm md:text-[15px] text-off-white/90 mt-2">
            {entity.city.name}, {entity.city.state_abbr}
            <OpenStatus hours={entity.details.hours} surface="dark" />
          </p>
        )}

        <span className="blacq-hero-rule mt-3" aria-hidden="true" />

        {entity.tagline && (
          <p className="font-body text-base md:text-[17px] text-off-white/90 max-w-2xl mt-2">
            {entity.tagline}
          </p>
        )}

        {entity.avg_rating !== null && entity.review_count > 0 && (
          <div
            className="flex items-center gap-1.5 mt-3"
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

        <div className="flex items-center gap-3 flex-wrap mt-6">
          {/* id="hero-cta" is EntityQuickActionBar's IntersectionObserver target;
              the bar no-ops when the element is absent (no real CTA destination) */}
          {ctaHref && (
            <a
              id="hero-cta"
              href={ctaHref}
              className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold min-w-[140px]"
            >
              {ctaLabel}
            </a>
          )}

          {isCreative && entity.images.length > 0 && (
            <a
              href="#portfolio"
              className="inline-flex items-center justify-center h-12 px-7 rounded-full border border-off-white/40 bg-off-white/10 hover:bg-off-white/20 text-white font-subhead font-bold text-sm backdrop-blur-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              View Portfolio
            </a>
          )}

          {/* Labelled variant + `surface`, matching EntityPageHero. `className`
              is sizing only here — a `bg-` class would override the saved
              state, which is exactly the bug this replaced. */}
          <SaveButton
            listingId={entity.id}
            initialSaved={initialSaved}
            variant="pill"
            surface="hero"
            className="h-12 px-6"
          />
        </div>
      </div>
    </div>
  )
}
