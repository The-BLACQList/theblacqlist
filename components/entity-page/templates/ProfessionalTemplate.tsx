import type { EntityTemplateProps } from '@/lib/entity-page/template'
import { Reveal } from '@/components/motion/Reveal'
import { TemplateHero } from '@/components/entity-page/templates/TemplateHero'
import {
  EntityAnchorTabs,
  type AnchorTab,
} from '@/components/entity-page/templates/EntityAnchorTabs'
import { TemplateInfoRail } from '@/components/entity-page/templates/TemplateInfoRail'
import { TemplateSectionHeading } from '@/components/entity-page/templates/TemplateSectionHeading'
import { TemplateServices } from '@/components/entity-page/templates/TemplateServices'
import { TemplateStory } from '@/components/entity-page/templates/TemplateStory'
import { PortfolioReel } from '@/components/entity-page/templates/PortfolioReel'
import { TemplateInquiryBand } from '@/components/entity-page/templates/TemplateInquiryBand'
import { TemplateTrustPanel } from '@/components/entity-page/templates/TemplateTrustPanel'
import { EntityLinks } from '@/components/entity-page/EntityLinks'
import { EntityAttributes } from '@/components/entity-page/EntityAttributes'
import { EntityFaqSection } from '@/components/entity-page/EntityFaqSection'
import { EntityDeals } from '@/components/entity-page/EntityDeals'
import { EntityAtAGlance } from '@/components/entity-page/EntityAtAGlance'
import { EntityMediaGallery } from '@/components/entity-page/EntityMediaGallery'
import { EntityVideoSection } from '@/components/entity-page/EntityVideoSection'
import { EntityUpcomingEvents } from '@/components/entity-page/EntityUpcomingEvents'
import { EntityHiringBlock } from '@/components/entity-page/EntityHiringBlock'
import { EntityCouponsSection } from '@/components/entity-page/EntityCouponsSection'
import { EntityLocationsSection } from '@/components/entity-page/EntityLocationsSection'
import { EntityTeamSection } from '@/components/entity-page/EntityTeamSection'
import { EntityShopSection } from '@/components/entity-page/EntityShopSection'
import { EntityBookingSection } from '@/components/entity-page/EntityBookingSection'
import { SectionMark } from '@/components/entity-page/SectionMark'
import { EXAMPLE_BOOKING_NOTE } from '@/lib/entity-page/sections'
import { EntityPlatformActivity } from '@/components/entity-page/EntityPlatformActivity'
import { EntityReviewsSection } from '@/components/entity-page/EntityReviewsSection'
import { EntityRelatedDiscovery } from '@/components/entity-page/EntityRelatedDiscovery'

/**
 * Service archetype — the P-A "Immersive Microsite" template for
 * professional listings (Living Commerce Index proof page #1).
 * Immersive hero → sticky tabs → quick-info rail → services first →
 * editorial story with sticky trust aside → gallery → reviews → visit →
 * related.
 */
export function ProfessionalTemplate({
  entity,
  initialSaved,
  userId,
  isOwner,
  hasReviewed,
  mode = 'live',
}: EntityTemplateProps) {
  const hasServices = entity.details.services.length > 0
  const hasStory = Boolean(entity.details.description?.trim())
  const hasGallery = entity.images.length > 0
  const hasTeam = Boolean(entity.team && entity.team.length > 0)

  const hasDeals = (entity.deals?.length ?? 0) > 0

  const tabs: AnchorTab[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'visit', label: 'Visit' },
    ...(hasDeals ? [{ id: 'deals', label: 'Deals' }] : []),
    ...(hasServices ? [{ id: 'services', label: 'Services' }] : []),
    ...(hasStory ? [{ id: 'about', label: 'About' }] : []),
    ...(hasTeam ? [{ id: 'team', label: 'Team' }] : []),
    ...(hasGallery ? [{ id: 'gallery', label: 'Gallery' }] : []),
    { id: 'reviews', label: 'Reviews' },
  ]

  return (
    <>
      <SectionMark id="hero">
        <TemplateHero
          entity={entity}
          initialSaved={initialSaved}
          variant="professional"
          mode={mode}
        />
      </SectionMark>
      <EntityAnchorTabs tabs={tabs} />
      <SectionMark id="info-rail">
        <div id="overview" className="scroll-mt-32">
          <TemplateInfoRail entity={entity} />
        </div>
      </SectionMark>

      <SectionMark id="coupons">
        <EntityCouponsSection coupons={entity.coupons} />
      </SectionMark>

      {/* At a Glance sits right under the quick facts on every template
          (ticket 140). Unconditional, as on Storefront, because it also
          carries the social row, which a page can have with no address,
          hours, phone or email. */}
      <SectionMark id="at-a-glance">
        <div id="visit" className="scroll-mt-32">
          <EntityAtAGlance entity={entity} />
        </div>
      </SectionMark>

      <SectionMark id="locations">
        <EntityLocationsSection locations={entity.locations} />
      </SectionMark>

      {/* Main content + sticky trust aside. The plan-gated sections (booking,
          team, shop — ticket 184) sit in the main column in registry order and
          render bare, with the kicker heading the column already uses. */}
      <Reveal>
        <div className="bg-white">
          <div className="max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10 py-10 md:py-14 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10">
            <div className="flex flex-col gap-12 md:gap-14 min-w-0">
              <SectionMark id="services">
                <TemplateServices entity={entity} />
              </SectionMark>
              <SectionMark id="booking">
                <EntityBookingSection
                  booking={entity.booking}
                  name={entity.name}
                  inertNote={mode === 'example' ? EXAMPLE_BOOKING_NOTE : undefined}
                  bare
                />
              </SectionMark>
              <SectionMark id="story">
                <TemplateStory entity={entity} imageSide="left" />
              </SectionMark>
              <SectionMark id="team">
                <div id="team" className="scroll-mt-32">
                  <EntityTeamSection team={entity.team} bare />
                </div>
              </SectionMark>
              <SectionMark id="portfolio">
                {hasGallery && (
                  <section aria-labelledby="featured-work-heading">
                    <TemplateSectionHeading
                      kicker="Featured work"
                      heading="Recent work"
                      headingId="featured-work-heading"
                    />
                    <PortfolioReel images={entity.images} />
                  </section>
                )}
              </SectionMark>
              <SectionMark id="shop">
                <div id="shop" className="scroll-mt-32">
                  <EntityShopSection shop={entity.shop} bare />
                </div>
              </SectionMark>
              <SectionMark id="attributes">
                <EntityAttributes attributes={entity.attributes} bare />
              </SectionMark>
              <SectionMark id="links">
                <EntityLinks entity={entity} bare />
              </SectionMark>
            </div>

            <aside aria-label="Trust and verification">
              <TemplateTrustPanel entity={entity} />
            </aside>
          </div>
        </div>
      </Reveal>

      <SectionMark id="gallery">
        {hasGallery && (
          <div id="gallery" className="scroll-mt-32">
            <EntityMediaGallery entity={entity} images={entity.images} />
          </div>
        )}
      </SectionMark>

      <SectionMark id="video">
        <EntityVideoSection entity={entity} />
      </SectionMark>

      <SectionMark id="inquiry">
        <Reveal>
          <TemplateInquiryBand entity={entity} />
        </Reveal>
      </SectionMark>

      <SectionMark id="reviews">
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
      </SectionMark>

      <SectionMark id="hiring">
        <EntityHiringBlock entity={entity} mode={mode} />
      </SectionMark>
      <SectionMark id="events">
        <EntityUpcomingEvents entity={entity} />
      </SectionMark>

      <SectionMark id="faq">
        <Reveal>
          <EntityFaqSection faqs={entity.faqs} />
        </Reveal>
      </SectionMark>
      <SectionMark id="activity">
        <EntityPlatformActivity entity={entity} />
      </SectionMark>
      <SectionMark id="related">
        <Reveal>
          <EntityRelatedDiscovery entity={entity} />
        </Reveal>
      </SectionMark>
    </>
  )
}
