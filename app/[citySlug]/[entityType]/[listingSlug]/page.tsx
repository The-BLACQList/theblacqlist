import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { getEntityPageFromDB } from '@/lib/listings/entityPage'
import { buildEntityUrl } from '@/lib/listings/url'
import { trackServerEvent } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import { EntityPageHero } from '@/components/entity-page/EntityPageHero'
import { EntityQuickActionBar } from '@/components/entity-page/EntityQuickActionBar'
import { EntityAtAGlance } from '@/components/entity-page/EntityAtAGlance'
import { EntityStorySection } from '@/components/entity-page/EntityStorySection'
import { EntityOfferingsSection } from '@/components/entity-page/EntityOfferingsSection'
import { EntityMediaGallery } from '@/components/entity-page/EntityMediaGallery'
import { EntityReviewsSection } from '@/components/entity-page/EntityReviewsSection'
import { EntityTrustSection } from '@/components/entity-page/EntityTrustSection'
import { EntityCommunityConnection } from '@/components/entity-page/EntityCommunityConnection'
import { EntityPlatformActivity } from '@/components/entity-page/EntityPlatformActivity'
import { EntityRelatedDiscovery } from '@/components/entity-page/EntityRelatedDiscovery'

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

  return {
    title: `${entity.name} | The BLACQList`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: entity.name,
      description: entity.tagline,
      url: canonicalUrl,
      ...(entity.cover_image_path && { images: [entity.cover_image_path] }),
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

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: entity.name,
    description: details.description || entity.tagline,
    url: `${BASE_URL}${buildEntityUrl(entityType, city?.slug, entity.slug)}`,
    ...(entity.logo_path && { logo: entity.logo_path }),
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

export default async function EntityPage({ params }: PageProps) {
  const { entityType, listingSlug } = await params
  const entity = await getEntityPageFromDB(listingSlug)

  if (!entity) notFound()

  const jsonLd = buildJsonLd(entity, entityType)

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

      {/* Hero — bg-deep-bg, fills the max-w-7xl container, top corners rounded */}
      <div className="max-w-7xl mx-auto w-full overflow-hidden rounded-t-xl bg-deep-bg">
        <EntityPageHero entity={entity} initialSaved={initialSaved} />
      </div>

      {/* Sections — each manages its own background and max-width */}

      {/* At a Glance — bg-white */}
      <EntityAtAGlance entity={entity} />

      {/* Story — bg-cream */}
      <EntityStorySection entity={entity} />

      {/* Offerings — bg-white */}
      <EntityOfferingsSection entity={entity} />

      {/* Media Gallery — bg-deep-bg; hidden if no images */}
      <EntityMediaGallery entity={entity} images={entity.images} />

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
    </div>
  )
}
