import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { getEntityPageFromDB } from '@/lib/listings/entityPage'
import { buildEntityUrl } from '@/lib/listings/url'
import { buildJobPostingJsonLd } from '@/lib/listings/jobPosting'
import { resolveCoverImage, resolveMediaPath } from '@/lib/listings/coverImage'
import { trackServerEvent } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import { EntityPageHero } from '@/components/entity-page/EntityPageHero'
import { EntityQuickActionBar } from '@/components/entity-page/EntityQuickActionBar'
import { EntityAtAGlance } from '@/components/entity-page/EntityAtAGlance'
import { EntityLinks } from '@/components/entity-page/EntityLinks'
import { EntityEventDetails } from '@/components/entity-page/EntityEventDetails'
import { EntityJobDetails } from '@/components/entity-page/EntityJobDetails'
import { EntityUpcomingEvents } from '@/components/entity-page/EntityUpcomingEvents'
import { EntityStorySection } from '@/components/entity-page/EntityStorySection'
import { EntityOfferingsSection } from '@/components/entity-page/EntityOfferingsSection'
import { EntityAttributes } from '@/components/entity-page/EntityAttributes'
import { EntityFaqSection } from '@/components/entity-page/EntityFaqSection'
import { EntityVideoSection } from '@/components/entity-page/EntityVideoSection'
import { EntityMediaGallery } from '@/components/entity-page/EntityMediaGallery'
import { EntityReviewsSection } from '@/components/entity-page/EntityReviewsSection'
import { EntityTrustSection } from '@/components/entity-page/EntityTrustSection'
import { EntityCommunityConnection } from '@/components/entity-page/EntityCommunityConnection'
import { EntityPlatformActivity } from '@/components/entity-page/EntityPlatformActivity'
import { EntityRelatedDiscovery } from '@/components/entity-page/EntityRelatedDiscovery'
import { ProfessionalTemplate } from '@/components/entity-page/templates/ProfessionalTemplate'
import { CreativeTemplate } from '@/components/entity-page/templates/CreativeTemplate'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ citySlug: string; entityType: string; listingSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { citySlug, entityType, listingSlug } = await params
  const entity = await getEntityPageFromDB(listingSlug)

  if (!entity) {
    return { title: 'Not Found | The BLACQList' }
  }

  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'
  const canonicalUrl = `${BASE_URL}${buildEntityUrl(entityType, citySlug, listingSlug)}`

  const locationLabel = entity.city ? `${entity.city.name}, ${entity.city.state_abbr}` : 'Online'

  const description = `${entity.tagline} — ${entity.category.name} in ${locationLabel}. Discover and support Black-owned businesses on The BLACQList.`

  // An owner cover resolves to an absolute Storage URL, already OG-ready. With
  // no cover there is no OG image — the F-1 fallback is a render-time CSS tile,
  // not a file a social crawler could fetch.
  const cover = resolveCoverImage(entity.cover_image_path, entity.entity_type, entity.id)
  const ogImage = cover.src ?? undefined

  return {
    title: `${entity.name} — ${locationLabel}`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: entity.name,
      description: entity.tagline,
      url: canonicalUrl,
      ...(ogImage && { images: [ogImage] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: entity.name,
      description,
    },
  }
}

function buildJsonLd(entity: Awaited<ReturnType<typeof getEntityPageFromDB>>, entityType: string) {
  if (!entity) return null
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'
  const { details, city } = entity
  const logoUrl = resolveMediaPath(entity.logo_path)

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: entity.name,
    description: details.description || entity.tagline,
    url: `${BASE_URL}${buildEntityUrl(entityType, city?.slug, entity.slug)}`,
    // schema.org logo must be a fetchable URL. logo_path is a Storage key, so
    // emitting it raw hands crawlers a string like "logos/abc.png" — invalid,
    // and Google drops the property. Resolve it the same way the cover is.
    ...(logoUrl && { logo: logoUrl }),
    ...(entity.avg_rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: entity.avg_rating.toFixed(1),
        reviewCount: entity.review_count,
      },
    }),
  }

  if (details.address) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      streetAddress: details.address,
      ...(details.address_line2 && { addressLocality: details.address_line2 }),
      addressLocality: details.city_name ?? city?.name,
      addressRegion: details.state_abbr ?? city?.state_abbr,
      postalCode: details.zip,
      addressCountry: 'US',
    }
  }

  if (details.phone) jsonLd.telephone = details.phone
  if (details.website_url) jsonLd.sameAs = details.website_url

  return jsonLd
}

function buildEventJsonLd(
  entity: Awaited<ReturnType<typeof getEntityPageFromDB>>,
  entityType: string
) {
  if (!entity || !entity.event) return null
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'
  const ev = entity.event

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: entity.name,
    description: ev.description || entity.tagline,
    url: `${BASE_URL}${buildEntityUrl(entityType, entity.city?.slug, entity.slug)}`,
    startDate: ev.starts_at,
    ...(ev.ends_at && { endDate: ev.ends_at }),
    eventAttendanceMode: ev.is_online
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    location: ev.is_online
      ? { '@type': 'VirtualLocation', url: ev.ticket_url ?? `${BASE_URL}` }
      : {
          '@type': 'Place',
          name: ev.venue_name ?? entity.name,
          address: [ev.venue_address, ev.city_name, ev.state_abbr].filter(Boolean).join(', '),
        },
    ...(ev.ticket_url && {
      offers: { '@type': 'Offer', url: ev.ticket_url, ...(ev.price_text && { description: ev.price_text }) },
    }),
    ...(ev.organizer && { organizer: { '@type': 'Organization', name: ev.organizer.name } }),
  }

  return jsonLd
}

export default async function EntityPage({ params }: PageProps) {
  const { entityType, listingSlug } = await params
  const entity = await getEntityPageFromDB(listingSlug)

  if (!entity) notFound()

  const isEvent = entity.entity_type === 'event'
  const isJob = entity.entity_type === 'job'
  // Living Commerce Index templates (Service + Portfolio archetypes).
  const isProfessional =
    entity.entity_type === 'professional' || entity.entity_type === 'service_provider'
  const isCreative = entity.entity_type === 'creative'
  const jsonLd = isEvent
    ? buildEventJsonLd(entity, entityType)
    : isJob
      ? buildJobPostingJsonLd(entity, entityType)
      : buildJsonLd(entity, entityType)

  // Check current user state (saves, ownership, existing review)
  const supabase = await createClient()
  let initialSaved = false
  let isOwner = false
  let hasReviewed = false
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fire-and-forget page view event — never awaited so it can't delay rendering
  trackServerEvent({
    event_name: ANALYTICS_EVENTS.PAGE_VIEW,
    entity_id: entity.id,
    entity_type: 'listing',
    user_id: user?.id ?? null,
  })
  if (user) {
    isOwner = entity.owner_user_id === user.id

    const [saveResult, reviewResult] = await Promise.all([
      supabase
        .from('saves')
        .select('id')
        .eq('user_id', user.id)
        .eq('listing_id', entity.id)
        .maybeSingle(),
      isOwner
        ? Promise.resolve({ data: null })
        : supabase
            .from('reviews')
            .select('id')
            .eq('reviewer_user_id', user.id)
            .eq('listing_id', entity.id)
            .maybeSingle(),
    ])

    initialSaved = !!saveResult.data
    hasReviewed = !!reviewResult.data
  }

  return (
    <div className="min-h-screen">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {/* QuickActionBar — Client, appears on scroll */}
      <EntityQuickActionBar entity={entity} initialSaved={initialSaved} />

      {/* Living Commerce Index templates own their full page (immersive
          full-bleed hero included); other types keep the shared hero. */}
      {isProfessional || isCreative ? null : (
        <div className="max-w-7xl mx-auto w-full overflow-hidden rounded-t-xl bg-deep-bg">
          <EntityPageHero entity={entity} initialSaved={initialSaved} />
        </div>
      )}

      {/* Sections — each manages its own background and max-width */}

      {isProfessional ? (
        <ProfessionalTemplate
          entity={entity}
          initialSaved={initialSaved}
          userId={user?.id ?? null}
          isOwner={isOwner}
          hasReviewed={hasReviewed}
        />
      ) : isCreative ? (
        <CreativeTemplate
          entity={entity}
          initialSaved={initialSaved}
          userId={user?.id ?? null}
          isOwner={isOwner}
          hasReviewed={hasReviewed}
        />
      ) : isEvent ? (
        <>
          {/* Event details — When/Where, ticket CTA, organizer, about */}
          <EntityEventDetails entity={entity} />

          {/* Media Gallery — bg-deep-bg; hidden if no images */}
          <EntityMediaGallery entity={entity} images={entity.images} />

          {/* Related Discovery — bg-pale-lavender; hidden if < 3 related */}
          <EntityRelatedDiscovery entity={entity} />
        </>
      ) : isJob ? (
        <>
          {/* Job details — type/where/pay/closing, apply CTA, hiring company, about */}
          <EntityJobDetails entity={entity} />

          {/* Media Gallery — bg-deep-bg; hidden if no images */}
          <EntityMediaGallery entity={entity} images={entity.images} />

          {/* Related Discovery — bg-pale-lavender; hidden if < 3 related */}
          <EntityRelatedDiscovery entity={entity} />
        </>
      ) : (
        <>
          {/* At a Glance — bg-white */}
          <EntityAtAGlance entity={entity} />

          {/* Owner-managed links (book / menu / order / socials) — bg-white; hidden if none */}
          <EntityLinks entity={entity} />

          {/* Story — bg-cream */}
          <EntityStorySection entity={entity} />

          {/* Offerings — bg-white */}
          <EntityOfferingsSection entity={entity} />

          {/* Attributes & amenities — bg-cream; hidden if none set */}
          <EntityAttributes attributes={entity.attributes} />

          {/* FAQ — bg-white; hidden if no questions */}
          <EntityFaqSection faqs={entity.faqs} />

          {/* Upcoming events this business organizes — bg-cream; hidden if none */}
          <EntityUpcomingEvents entity={entity} />

          {/* Media Gallery — bg-deep-bg; hidden if no images */}
          <EntityMediaGallery entity={entity} images={entity.images} />

          {/* Video — bg-cream; hidden if no (valid) embed */}
          <EntityVideoSection entity={entity} />

          {/* Reviews — bg-white */}
          <EntityReviewsSection
            entity={entity}
            userId={user?.id ?? null}
            isOwner={isOwner}
            hasReviewed={hasReviewed}
          />

          {/* Trust & Verification — bg-pale-lavender */}
          <EntityTrustSection entity={entity} />

          {/* Community — bg-white */}
          <EntityCommunityConnection entity={entity} />

          {/* Platform Activity — bg-cream; hidden if no saves */}
          <EntityPlatformActivity entity={entity} />

          {/* Related Discovery — bg-pale-lavender; hidden if < 3 related */}
          <EntityRelatedDiscovery entity={entity} />
        </>
      )}
    </div>
  )
}
