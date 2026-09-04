import { Star } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { OwnershipBadge } from '@/components/ui/ownership-badge'
import { SaveButton } from '@/components/entity-page/SaveButton'
import { ShareButton } from '@/components/entity-page/ShareButton'
import { CoverImage } from '@/components/media/CoverImage'
import { cn } from '@/lib/utils'
import { getCtaLabel } from '@/types'
import type { EntityPageData } from '@/types'
import { resolveCoverImage } from '@/lib/listings/coverImage'
import { getCtaHref } from '@/components/entity-page/templates/cta'
import { OpenStatus } from '@/components/entity-page/templates/OpenStatus'

/**
 * One hero per template. `professional` and `creative` are the two Living
 * Commerce Index archetypes; `storefront`, `event` and `job` were added when
 * every listing type moved onto the template system (PR 6) and the old
 * EntityPageHero was retired.
 */
export type TemplateHeroVariant = 'professional' | 'creative' | 'storefront' | 'event' | 'job'

interface Props {
  entity: EntityPageData
  initialSaved?: boolean
  /** professional = P-A Immersive Microsite; creative = C-B Cover Story */
  variant: TemplateHeroVariant
}

const TYPE_LABELS: Record<string, string> = {
  business: 'Business',
  restaurant: 'Restaurant',
  vendor: 'Vendor',
  professional: 'Professional',
  service_provider: 'Professional',
  creative: 'Creative',
  event: 'Event',
  job: 'Job',
}

// The hero gets shorter as the page below it gets more utilitarian: a portfolio
// cover earns the full viewport, a job posting does not.
const MIN_HEIGHTS: Record<TemplateHeroVariant, string> = {
  creative: 'min-h-[420px] md:min-h-[74vh]',
  professional: 'min-h-[360px] md:min-h-[62vh]',
  storefront: 'min-h-[360px] md:min-h-[58vh]',
  event: 'min-h-[340px] md:min-h-[52vh]',
  job: 'min-h-[320px] md:min-h-[46vh]',
}

const HEADING_SIZES: Record<TemplateHeroVariant, string> = {
  creative: 'text-[38px] md:text-[56px] lg:text-[64px]',
  professional: 'text-[32px] md:text-[44px] lg:text-[52px]',
  storefront: 'text-[32px] md:text-[44px] lg:text-[52px]',
  event: 'text-[30px] md:text-[40px] lg:text-[46px]',
  job: 'text-[28px] md:text-[38px] lg:text-[42px]',
}

/**
 * Immersive photographic hero for every listing template.
 * Full-bleed cover (or the designed F-1 fallback), badges, name, tagline,
 * and the business-defined CTA inside the hero. The CTA keeps id="hero-cta"
 * so EntityQuickActionBar's IntersectionObserver continues to work.
 */
export function TemplateHero({ entity, initialSaved = false, variant }: Props) {
  const isCreative = variant === 'creative'
  // Events and jobs have no opening hours and no "is it open right now?"
  // question to answer — OpenStatus would render an empty promise there.
  const showOpenStatus = variant !== 'event' && variant !== 'job'
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
        MIN_HEIGHTS[variant],
        // The one surviving piece of EntityPageHero's tier ladder. Its three
        // steps (360 / 400 / 560) collapsed to a single premium bump: the
        // standard step was an 11% difference nobody could see.
        variant === 'storefront' && entity.tier === 'premium' && 'md:min-h-[70vh]'
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

      {/* Ported from EntityPageHero — the only place is_featured surfaces on a
          listing page. Deleting that component without this was a silent
          regression on every featured storefront. */}
      {entity.is_featured && (
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-10">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-gold text-brand-black font-subhead text-xs font-semibold leading-none">
            Featured
          </span>
        </div>
      )}

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

        <h1 className={cn('font-headline text-white leading-tight text-balance', HEADING_SIZES[variant])}>
          {entity.name}
        </h1>

        {!isCreative && locationLine && (
          <p className="flex items-center gap-3 flex-wrap font-body text-sm md:text-[15px] text-off-white/90 mt-2">
            {locationLine}
            {showOpenStatus && <OpenStatus hours={entity.details.hours} surface="dark" />}
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

          {/* Labelled variant + `surface`. `className` is sizing only here — a
              `bg-` class would override the saved state, which is exactly the
              bug this replaced. */}
          <SaveButton
            listingId={entity.id}
            initialSaved={initialSaved}
            variant="pill"
            surface="hero"
            className="h-12 px-6"
          />

          {/* Also ported from EntityPageHero. Share was reachable from every
              storefront listing and from nowhere else once that hero went. */}
          <ShareButton
            listingName={entity.name}
            listingId={entity.id}
            className="size-12 bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm"
            iconClassName="size-5"
          />
        </div>
      </div>
    </div>
  )
}
