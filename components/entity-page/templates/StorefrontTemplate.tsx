import { Reveal } from '@/components/motion/Reveal'
import { TemplateHero } from '@/components/entity-page/templates/TemplateHero'
import { EntityAnchorTabs, type AnchorTab } from '@/components/entity-page/templates/EntityAnchorTabs'
import { TemplateInfoRail } from '@/components/entity-page/templates/TemplateInfoRail'
import { TemplateInquiryBand } from '@/components/entity-page/templates/TemplateInquiryBand'
import { EntityAtAGlance } from '@/components/entity-page/EntityAtAGlance'
import { EntityLinks } from '@/components/entity-page/EntityLinks'
import { EntityStorySection } from '@/components/entity-page/EntityStorySection'
import { EntityOfferingsSection } from '@/components/entity-page/EntityOfferingsSection'
import { EntityAttributes } from '@/components/entity-page/EntityAttributes'
import { EntityFaqSection } from '@/components/entity-page/EntityFaqSection'
import { EntityUpcomingEvents } from '@/components/entity-page/EntityUpcomingEvents'
import { EntityMediaGallery } from '@/components/entity-page/EntityMediaGallery'
import { EntityVideoSection } from '@/components/entity-page/EntityVideoSection'
import { EntityReviewsSection } from '@/components/entity-page/EntityReviewsSection'
import { EntityTrustSection } from '@/components/entity-page/EntityTrustSection'
import { EntityCommunityConnection } from '@/components/entity-page/EntityCommunityConnection'
import { EntityPlatformActivity } from '@/components/entity-page/EntityPlatformActivity'
import { EntityRelatedDiscovery } from '@/components/entity-page/EntityRelatedDiscovery'
import type { EntityTemplateProps } from '@/lib/entity-page/template'

/**
 * Storefront archetype — `business`, `restaurant` and `vendor`.
 *
 * This is the section list the listing page used to render inline, lifted
 * verbatim and in the same order, plus the three things that made the
 * professional template read better than it did: the immersive TemplateHero,
 * the sticky anchor tabs, and the quick-info rail. Nothing was dropped.
 *
 * Visit comes early here, unlike the microsite templates — for a shop or a
 * restaurant, "where and when" is the question, not the footnote.
 */
export function StorefrontTemplate({
  entity,
  initialSaved,
  userId,
  isOwner,
  hasReviewed,
}: EntityTemplateProps) {
  const hasStory = Boolean(entity.details.description?.trim())
  const hasOfferings = entity.details.services.length > 0
  const hasGallery = entity.images.length > 0

  const tabs: AnchorTab[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'visit', label: 'Visit' },
    ...(hasStory ? [{ id: 'about', label: 'About' }] : []),
    ...(hasOfferings ? [{ id: 'offerings', label: 'Offerings' }] : []),
    ...(hasGallery ? [{ id: 'gallery', label: 'Gallery' }] : []),
    { id: 'reviews', label: 'Reviews' },
  ]

  return (
    <>
      <TemplateHero entity={entity} initialSaved={initialSaved} variant="storefront" />
      <EntityAnchorTabs tabs={tabs} />

      <div id="overview" className="scroll-mt-32">
        <TemplateInfoRail entity={entity} />
      </div>

      {/* The id lives on the call site, never inside EntityAtAGlance — every
          template wraps it, so an id in the component would be duplicated.
          Unconditional here (unlike the microsite templates, which gate on
          hasVisit) because EntityAtAGlance also carries the social row, which
          a listing can have with no address, hours, phone or email. */}
      <div id="visit" className="scroll-mt-32">
        <EntityAtAGlance entity={entity} />
      </div>

      <EntityLinks entity={entity} />

      <Reveal>
        <div id="about" className="scroll-mt-32">
          <EntityStorySection entity={entity} />
        </div>
      </Reveal>

      <div id="offerings" className="scroll-mt-32">
        <EntityOfferingsSection entity={entity} />
      </div>

      <EntityAttributes attributes={entity.attributes} />
      <Reveal>
        <EntityFaqSection faqs={entity.faqs} />
      </Reveal>
      <EntityUpcomingEvents entity={entity} />

      <div id="gallery" className="scroll-mt-32">
        <EntityMediaGallery entity={entity} images={entity.images} />
      </div>
      <EntityVideoSection entity={entity} />

      <Reveal>
        <TemplateInquiryBand entity={entity} />
      </Reveal>

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

      <EntityTrustSection entity={entity} />
      <EntityCommunityConnection entity={entity} />
      <EntityPlatformActivity entity={entity} />
      <Reveal>
        <EntityRelatedDiscovery entity={entity} />
      </Reveal>
    </>
  )
}
