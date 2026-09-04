import { Reveal } from '@/components/motion/Reveal'
import { TemplateHero } from '@/components/entity-page/templates/TemplateHero'
import { EntityAnchorTabs, type AnchorTab } from '@/components/entity-page/templates/EntityAnchorTabs'
import { EntityEventDetails } from '@/components/entity-page/EntityEventDetails'
import { EntityMediaGallery } from '@/components/entity-page/EntityMediaGallery'
import { EntityReviewsSection } from '@/components/entity-page/EntityReviewsSection'
import { EntityRelatedDiscovery } from '@/components/entity-page/EntityRelatedDiscovery'
import type { EntityTemplateProps } from '@/lib/entity-page/template'

/**
 * Event archetype — `event`.
 *
 * Events keep their own details block (When/Where, ticket CTA, organizer,
 * about) rather than the storefront's At a Glance: there are no opening hours
 * to report and no "is it open now?" to answer. That is also why
 * `getCtaHref` refuses to fall back to `#visit` for an event — this template
 * has no Visit section, and that guard and this file must change together.
 *
 * Reviews render here `[Decision — founder, 2026-09-02]`: people review an
 * event they attended. Jobs do not get the same treatment.
 */
export function EventTemplate({
  entity,
  initialSaved,
  userId,
  isOwner,
  hasReviewed,
}: EntityTemplateProps) {
  const hasGallery = entity.images.length > 0

  const tabs: AnchorTab[] = [
    { id: 'details', label: 'Details' },
    ...(hasGallery ? [{ id: 'gallery', label: 'Photos' }] : []),
    { id: 'reviews', label: 'Reviews' },
  ]

  return (
    <>
      <TemplateHero entity={entity} initialSaved={initialSaved} variant="event" />
      <EntityAnchorTabs tabs={tabs} />

      <div id="details" className="scroll-mt-32">
        <EntityEventDetails entity={entity} />
      </div>

      <div id="gallery" className="scroll-mt-32">
        <EntityMediaGallery entity={entity} images={entity.images} />
      </div>

      <Reveal>
        <div id="reviews" className="scroll-mt-32">
          <EntityReviewsSection
            entity={entity}
            userId={userId}
            isOwner={isOwner}
            hasReviewed={hasReviewed}
          />
        </div>
      </Reveal>

      <Reveal>
        <EntityRelatedDiscovery entity={entity} />
      </Reveal>
    </>
  )
}
