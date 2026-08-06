import type { EntityPageData } from '@/types'
import { TemplateHero } from '@/components/entity-page/templates/TemplateHero'
import { EntityAnchorTabs, type AnchorTab } from '@/components/entity-page/templates/EntityAnchorTabs'
import { TemplateInfoRail } from '@/components/entity-page/templates/TemplateInfoRail'
import { TemplateServices } from '@/components/entity-page/templates/TemplateServices'
import { TemplateStory } from '@/components/entity-page/templates/TemplateStory'
import { TemplateTrustPanel } from '@/components/entity-page/templates/TemplateTrustPanel'
import { EntityLinks } from '@/components/entity-page/EntityLinks'
import { EntityAttributes } from '@/components/entity-page/EntityAttributes'
import { EntityFaqSection } from '@/components/entity-page/EntityFaqSection'
import { EntityAtAGlance } from '@/components/entity-page/EntityAtAGlance'
import { EntityMediaGallery } from '@/components/entity-page/EntityMediaGallery'
import { EntityVideoSection } from '@/components/entity-page/EntityVideoSection'
import { EntityUpcomingEvents } from '@/components/entity-page/EntityUpcomingEvents'
import { EntityPlatformActivity } from '@/components/entity-page/EntityPlatformActivity'
import { EntityReviewsSection } from '@/components/entity-page/EntityReviewsSection'
import { EntityRelatedDiscovery } from '@/components/entity-page/EntityRelatedDiscovery'

interface Props {
  entity: EntityPageData
  initialSaved: boolean
  userId: string | null
  isOwner: boolean
  hasReviewed: boolean
}

/**
 * Service archetype — the P-A "Immersive Microsite" template for
 * professional listings (Living Commerce Index proof page #1).
 * Immersive hero → sticky tabs → quick-info rail → services first →
 * editorial story with sticky trust aside → gallery → reviews → visit →
 * related.
 */
export function ProfessionalTemplate({ entity, initialSaved, userId, isOwner, hasReviewed }: Props) {
  const hasServices = entity.details.services.length > 0
  const hasStory = Boolean(entity.details.description?.trim())
  const hasGallery = entity.images.length > 0
  const hasVisit = Boolean(
    entity.details.address || entity.details.hours || entity.details.phone || entity.details.email
  )

  const tabs: AnchorTab[] = [
    { id: 'overview', label: 'Overview' },
    ...(hasServices ? [{ id: 'services', label: 'Services' }] : []),
    ...(hasStory ? [{ id: 'about', label: 'About' }] : []),
    ...(hasGallery ? [{ id: 'gallery', label: 'Gallery' }] : []),
    { id: 'reviews', label: 'Reviews' },
    ...(hasVisit ? [{ id: 'visit', label: 'Visit' }] : []),
  ]

  return (
    <>
      <TemplateHero entity={entity} initialSaved={initialSaved} variant="professional" />
      <EntityAnchorTabs tabs={tabs} />
      <div id="overview" className="scroll-mt-32">
        <TemplateInfoRail entity={entity} />
      </div>

      {/* Main content + sticky trust aside */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10 py-10 md:py-14 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10">
          <div className="flex flex-col gap-12 md:gap-14 min-w-0">
            <TemplateServices entity={entity} />
            <TemplateStory entity={entity} imageSide="left" />
            <EntityAttributes attributes={entity.attributes} bare />
            <EntityLinks entity={entity} bare />
          </div>

          <aside aria-label="Trust and verification">
            <TemplateTrustPanel entity={entity} />
          </aside>
        </div>
      </div>

      {hasGallery && (
        <div id="gallery" className="scroll-mt-32">
          <EntityMediaGallery entity={entity} images={entity.images} />
        </div>
      )}

      <EntityVideoSection entity={entity} />

      <div id="reviews" className="scroll-mt-32">
        <EntityReviewsSection
          entity={entity}
          userId={userId}
          isOwner={isOwner}
          hasReviewed={hasReviewed}
        />
      </div>

      <EntityUpcomingEvents entity={entity} />

      {hasVisit && (
        <div id="visit" className="scroll-mt-32">
          <EntityAtAGlance entity={entity} />
        </div>
      )}

      <EntityFaqSection faqs={entity.faqs} />
      <EntityPlatformActivity entity={entity} />
      <EntityRelatedDiscovery entity={entity} />
    </>
  )
}
