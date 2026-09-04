import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { getEntityPageFromDB } from '@/lib/listings/entityPage'
import { buildEntityUrl } from '@/lib/listings/url'
import { buildJobPostingJsonLd } from '@/lib/listings/jobPosting'
import { resolveCoverImage, resolveMediaPath } from '@/lib/listings/coverImage'
import { trackServerEvent } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import { EntityQuickActionBar } from '@/components/entity-page/EntityQuickActionBar'
import { EntityTemplateOutlet } from '@/components/entity-page/templates/EntityTemplateOutlet'
import { recordTourWitness } from '@/lib/tour/witness'

// No `revalidate` declared on purpose: PublicHeader reads cookies in the root
// layout, so every route is already dynamic and a revalidate here is dead —
// declaring one would misstate the page's render mode (M4.9).

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

  // Taglines are owner-written and land here both with and without terminal
  // punctuation, so trim it before adding our own period. Without this, a
  // tagline like "...since 1947." renders "since 1947.. Food & Dining".
  const tagline = entity.tagline.replace(/[.!?]+\s*$/, '')
  const description = `${tagline}. ${entity.category.name} in ${locationLabel}. Discover and support Black-owned businesses on The BLACQList.`

  // An owner cover resolves to an absolute Storage URL, already OG-ready. With
  // no cover there is no OG image — the F-1 fallback is a render-time CSS tile,
  // not a file a social crawler could fetch.
  const cover = resolveCoverImage(entity.cover_image_path, entity.entity_type, entity.id)
  const ogImage = cover.src ?? undefined

  return {
    title: `${entity.name} in ${locationLabel}`,
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

  // Which template renders the page is EntityTemplateOutlet's call, not this
  // file's — it covers all eight entity types exhaustively. These two booleans
  // survive only because structured data still branches by schema.org type,
  // which is a different question from layout.
  const isEvent = entity.entity_type === 'event'
  const isJob = entity.entity_type === 'job'
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
  // Tour evidence: an enrolled tester opened a listing that isn't their own —
  // the ownership check lives inside recordTourWitness. Swallows all failures.
  await recordTourWitness('listing_opened', { listingOwnerId: entity.owner_user_id })
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

      {/* Every listing type renders through its own template — the outlet
          picks it, and each template owns its full page including the
          immersive hero. Before PR 6 this was a four-way nested ternary with a
          separately-mounted shared hero above it. */}
      <EntityTemplateOutlet
        entity={entity}
        initialSaved={initialSaved}
        userId={user?.id ?? null}
        isOwner={isOwner}
        hasReviewed={hasReviewed}
      />
    </div>
  )
}
