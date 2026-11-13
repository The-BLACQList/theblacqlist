import { Reveal } from '@/components/motion/Reveal'
import { TemplateHero } from '@/components/entity-page/templates/TemplateHero'
import {
  EntityAnchorTabs,
  type AnchorTab,
} from '@/components/entity-page/templates/EntityAnchorTabs'
import { TemplateInfoRail } from '@/components/entity-page/templates/TemplateInfoRail'
import { TemplateInquiryBand } from '@/components/entity-page/templates/TemplateInquiryBand'
import { EntityAtAGlance } from '@/components/entity-page/EntityAtAGlance'
import { EntityLinks } from '@/components/entity-page/EntityLinks'
import { EntityStorySection } from '@/components/entity-page/EntityStorySection'
import { EntityOfferingsSection } from '@/components/entity-page/EntityOfferingsSection'
import { EntityAttributes } from '@/components/entity-page/EntityAttributes'
import { EntityFaqSection } from '@/components/entity-page/EntityFaqSection'
import { EntityDeals } from '@/components/entity-page/EntityDeals'
import { EntityUpcomingEvents } from '@/components/entity-page/EntityUpcomingEvents'
import { EntityHiringBlock } from '@/components/entity-page/EntityHiringBlock'
import { EntityMediaGallery } from '@/components/entity-page/EntityMediaGallery'
import { EntityVideoSection } from '@/components/entity-page/EntityVideoSection'
import { EntityReviewsSection } from '@/components/entity-page/EntityReviewsSection'
import { EntityTrustSection } from '@/components/entity-page/EntityTrustSection'
import { EntityCommunityConnection } from '@/components/entity-page/EntityCommunityConnection'
import { EntityPlatformActivity } from '@/components/entity-page/EntityPlatformActivity'
import { EntityRelatedDiscovery } from '@/components/entity-page/EntityRelatedDiscovery'
import { EntityLocationsSection } from '@/components/entity-page/EntityLocationsSection'
import { EntityTeamSection } from '@/components/entity-page/EntityTeamSection'
import { EntityShopSection } from '@/components/entity-page/EntityShopSection'
import { EntityBookingSection } from '@/components/entity-page/EntityBookingSection'
import { SectionMark } from '@/components/entity-page/SectionMark'
import { EntityHighlightsSection } from '@/components/entity-page/EntityHighlightsSection'
import { EntityCredentialsSection } from '@/components/entity-page/EntityCredentialsSection'
import { EXAMPLE_BOOKING_NOTE } from '@/lib/entity-page/sections'
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
 *
 * Ticket 184 added the plan-gated sections (other locations, team, shop,
 * booking) in the slots TEMPLATE_SECTION_ORDER.storefront gives them,
 * and a SectionMark around every section. Each new one renders only when its
 * field is set, so a page from today's loader is unchanged.
 */
export function StorefrontTemplate({
  entity,
  initialSaved,
  userId,
  isOwner,
  hasReviewed,
  mode = 'live',
}: EntityTemplateProps) {
  const hasStory = Boolean(entity.details.description?.trim())
  const hasOfferings = entity.details.services.length > 0
  const hasGallery = entity.images.length > 0
  const hasShop = Boolean(entity.shop && entity.shop.items.length > 0)

  const hasDeals = (entity.deals?.length ?? 0) > 0

  const tabs: AnchorTab[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'visit', label: 'Visit' },
    ...(hasDeals ? [{ id: 'deals', label: 'Deals' }] : []),
    ...(hasStory ? [{ id: 'about', label: 'About' }] : []),
    ...(hasOfferings ? [{ id: 'offerings', label: 'Offerings' }] : []),
    ...(hasShop ? [{ id: 'shop', label: 'Shop' }] : []),
    ...(hasGallery ? [{ id: 'gallery', label: 'Gallery' }] : []),
    { id: 'reviews', label: 'Reviews' },
  ]

  return (
    <>
      <SectionMark id="hero">
        <TemplateHero
          entity={entity}
          initialSaved={initialSaved}
          variant="storefront"
          mode={mode}
        />
      </SectionMark>
      <EntityAnchorTabs tabs={tabs} />

      <SectionMark id="info-rail">
        <div id="overview" className="scroll-mt-32">
          <TemplateInfoRail entity={entity} />
        </div>
      </SectionMark>

      {/* The id lives on the call site, never inside EntityAtAGlance — every
          template wraps it, so an id in the component would be duplicated.
          Unconditional on every template because EntityAtAGlance also carries
          the social row, which a listing can have with no address, hours,
          phone or email. */}
      <SectionMark id="at-a-glance">
        <div id="visit" className="scroll-mt-32">
          <EntityAtAGlance entity={entity} mode={mode} />
        </div>
      </SectionMark>

      {/* Main's Deals section (part G, #328). On a sample page the wrapper is
          inert, so Copy code cannot record deal_code_copied for a listing that
          does not exist; live pages render it exactly as main does. */}
      <SectionMark id="deals">
        <div inert={mode === 'example' || undefined} className="contents">
          <EntityDeals listingId={entity.id} deals={entity.deals} now={new Date()} />
        </div>
      </SectionMark>

      <SectionMark id="locations">
        <EntityLocationsSection locations={entity.locations} />
      </SectionMark>

      <SectionMark id="links">
        <EntityLinks entity={entity} />
      </SectionMark>

      <SectionMark id="story">
        <Reveal>
          <div id="about" className="scroll-mt-32">
            <EntityStorySection entity={entity} />
          </div>
        </Reveal>
      </SectionMark>

      <SectionMark id="highlights">
        <EntityHighlightsSection highlights={entity.highlights} />
      </SectionMark>

      <SectionMark id="team">
        <EntityTeamSection team={entity.team} />
      </SectionMark>

      <SectionMark id="offerings">
        <div id="offerings" className="scroll-mt-32">
          <EntityOfferingsSection entity={entity} />
        </div>
      </SectionMark>

      <SectionMark id="shop">
        <div id="shop" className="scroll-mt-32">
          <EntityShopSection shop={entity.shop} />
        </div>
      </SectionMark>

      <SectionMark id="attributes">
        <EntityAttributes attributes={entity.attributes} />
      </SectionMark>
      <SectionMark id="faq">
        <Reveal>
          <EntityFaqSection faqs={entity.faqs} />
        </Reveal>
      </SectionMark>
      <SectionMark id="hiring">
        <EntityHiringBlock entity={entity} mode={mode} />
      </SectionMark>
      <SectionMark id="events">
        <EntityUpcomingEvents entity={entity} />
      </SectionMark>

      <SectionMark id="gallery">
        <div id="gallery" className="scroll-mt-32">
          <EntityMediaGallery entity={entity} images={entity.images} mode={mode} />
        </div>
      </SectionMark>
      <SectionMark id="video">
        <EntityVideoSection entity={entity} />
      </SectionMark>

      <SectionMark id="booking">
        <EntityBookingSection
          booking={entity.booking}
          name={entity.name}
          inertNote={mode === 'example' ? EXAMPLE_BOOKING_NOTE : undefined}
        />
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

      <SectionMark id="credentials">
        <EntityCredentialsSection credentials={entity.credentials} />
      </SectionMark>
      <SectionMark id="trust">
        <EntityTrustSection entity={entity} />
      </SectionMark>
      <SectionMark id="community">
        <EntityCommunityConnection entity={entity} />
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
