import type { EntityPageData } from '@/types'
import { TemplateHero } from '@/components/entity-page/templates/TemplateHero'
import { EntityAnchorTabs, type AnchorTab } from '@/components/entity-page/templates/EntityAnchorTabs'
import { TemplateInfoRail } from '@/components/entity-page/templates/TemplateInfoRail'
import { TemplateSectionHeading } from '@/components/entity-page/templates/TemplateSectionHeading'
import { PortfolioReel } from '@/components/entity-page/templates/PortfolioReel'
import { TemplateCapabilities } from '@/components/entity-page/templates/TemplateCapabilities'
import { TemplateStory } from '@/components/entity-page/templates/TemplateStory'
import { TemplateTrustPanel } from '@/components/entity-page/templates/TemplateTrustPanel'
import { TemplateInquiryBand } from '@/components/entity-page/templates/TemplateInquiryBand'
import { EntityLinks } from '@/components/entity-page/EntityLinks'
import { EntityFaqSection } from '@/components/entity-page/EntityFaqSection'
import { EntityAtAGlance } from '@/components/entity-page/EntityAtAGlance'
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
 * Portfolio archetype — the C-B "Cover Story" template for creative
 * listings (Living Commerce Index proof page #2). Cover hero → sticky
 * tabs → portfolio reel → capabilities → story with sticky trust aside →
 * inquiry band → reviews → visit → related.
 */
export function CreativeTemplate({ entity, initialSaved, userId, isOwner, hasReviewed }: Props) {
  const hasPortfolio = entity.images.length > 0
  const hasCapabilities = entity.details.services.length > 0
  const hasStory = Boolean(entity.details.description?.trim())
  const hasVisit = Boolean(
    entity.details.address || entity.details.hours || entity.details.phone || entity.details.email
  )

  const tabs: AnchorTab[] = [
    ...(hasPortfolio ? [{ id: 'portfolio', label: 'Portfolio' }] : []),
    ...(hasCapabilities ? [{ id: 'capabilities', label: 'Capabilities' }] : []),
    ...(hasStory ? [{ id: 'about', label: 'About' }] : []),
    { id: 'reviews', label: 'Reviews' },
    ...(hasVisit ? [{ id: 'visit', label: 'Visit' }] : []),
  ]

  return (
    <>
      <TemplateHero entity={entity} initialSaved={initialSaved} variant="creative" />
      <EntityAnchorTabs tabs={tabs} />
      <TemplateInfoRail entity={entity} />

      <div className="bg-white">
        <div className="max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10 py-10 md:py-14 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10">
          <div className="flex flex-col gap-12 md:gap-14 min-w-0">
            {hasPortfolio && (
              <section id="portfolio" aria-labelledby="portfolio-heading" className="scroll-mt-32">
                <TemplateSectionHeading
                  kicker="Selected work"
                  heading="Portfolio"
                  headingId="portfolio-heading"
                />
                <PortfolioReel images={entity.images} />
              </section>
            )}

            <TemplateCapabilities entity={entity} />
            <TemplateStory entity={entity} imageSide="right" />
            <EntityLinks entity={entity} bare />
          </div>

          <aside aria-label="Trust and verification">
            <TemplateTrustPanel entity={entity} />
          </aside>
        </div>
      </div>

      <TemplateInquiryBand entity={entity} />

      <div id="reviews" className="scroll-mt-32">
        <EntityReviewsSection
          entity={entity}
          userId={userId}
          isOwner={isOwner}
          hasReviewed={hasReviewed}
        />
      </div>

      {hasVisit && (
        <div id="visit" className="scroll-mt-32">
          <EntityAtAGlance entity={entity} />
        </div>
      )}

      <EntityFaqSection faqs={entity.faqs} />
      <EntityRelatedDiscovery entity={entity} />
    </>
  )
}
