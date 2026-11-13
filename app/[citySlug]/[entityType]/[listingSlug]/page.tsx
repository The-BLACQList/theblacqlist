import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { getEntityPageFromDB } from '@/lib/listings/entityPage'
import { buildEntityUrl } from '@/lib/listings/url'
import { listingMetaText } from '@/lib/listings/seo'
import { buildJobPostingJsonLd } from '@/lib/listings/jobPosting'
import { resolveMediaPath } from '@/lib/listings/coverImage'
import { trackServerEvent } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import { EntityQuickActionBar } from '@/components/entity-page/EntityQuickActionBar'
import { EntityTemplateOutlet } from '@/components/entity-page/templates/EntityTemplateOutlet'
import { recordTourWitness } from '@/lib/tour/witness'
import { showShoppedHere } from '@/lib/spend/receipt-prefill'
import { loadListingMessaging } from '@/lib/messaging/loaders'
import { MessageComposer } from '@/components/messaging/MessageComposer'

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

  const locationLabel = entity.city ? `${entity.city.name}, ${entity.city.state_abbr}` : null
  // The owner's own search text wins when set (ticket 126).
  const { title, description } = listingMetaText({
    name: entity.name,
    tagline: entity.tagline,
    categoryName: entity.category.name,
    locationLabel,
    metaTitle: entity.meta_title,
    metaDescription: entity.meta_description,
  })

  // The branded "Look what I found on The BLACQList" card is the link preview
  // everywhere (Facebook, X, Threads, iMessage, WhatsApp). It draws the owner's
  // cover inside it when there is one, and an all-brand card when there isn't,
  // so every business now has a preview image.
  const ogImage = {
    url: `${BASE_URL}/api/share-card/listing/${encodeURIComponent(listingSlug)}?format=og`,
    width: 1200,
    height: 630,
    alt: `${entity.name} on The BLACQList`,
  }

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    ...(entity.noindex && { robots: { index: false, follow: true } }),
    openGraph: {
      title: entity.name,
      description: entity.tagline,
      url: canonicalUrl,
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: entity.name,
      description,
      images: [ogImage],
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
  const { citySlug, entityType, listingSlug } = await params
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

  // In-app messaging depends on who is looking (signed out, the owner, a
  // customer with a thread already, a blocked customer), so it is resolved
  // here and not in the shared loader. Fail-soft: undefined keeps the old
  // mailto: CTA. A new object, so a cached loader result is never mutated.
  // Events and jobs have no inbox switch, so they never get in-app messaging.
  const messaging =
    isEvent || isJob
      ? undefined
      : await loadListingMessaging(supabase, {
          listingId: entity.id,
          ownerUserId: entity.owner_user_id,
          viewerId: user?.id ?? null,
          listingPath: buildEntityUrl(entityType, citySlug, listingSlug),
        })
  const pageEntity = messaging ? { ...entity, messaging } : entity

  return (
    // `data-tour-listing` lets the Tester Tour remember this page so a step row
    // can offer "Back to {name}" instead of Discover (lib/tour/targets.ts).
    // Public facts only: the id and the name are already in the page.
    <div
      className="min-h-screen"
      data-tour-listing={entity.id}
      data-tour-listing-name={entity.name}
    >
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {/* QuickActionBar — Client, appears on scroll */}
      {/* getEntityPageFromDB only returns published listings (and closed
          jobs, which showShoppedHere refuses), so "published" holds here. */}
      <EntityQuickActionBar
        entity={pageEntity}
        initialSaved={initialSaved}
        showShoppedHere={showShoppedHere({
          signedIn: Boolean(user),
          entityType: entity.entity_type,
          collectiveOpen: isFeatureEnabled('collectiveOpen'),
        })}
      />

      {/* Every listing type renders through its own template — the outlet
          picks it, and each template owns its full page including the
          immersive hero. Before PR 6 this was a four-way nested ternary with a
          separately-mounted shared hero above it.

          Keyed by listing id so a listing-to-listing navigation (and a Back
          restore) remounts every client component under it, instead of
          reconciling a new entity into instances still holding the previous
          listing's state. Added after a tester's review, written with one
          listing in the URL, landed on the listing visited before it
          (2026-09-19). The client-side Back path did not reproduce it under
          Playwright; the key makes the invariant hold regardless of path. */}
      <EntityTemplateOutlet
        key={entity.id}
        entity={pageEntity}
        initialSaved={initialSaved}
        userId={user?.id ?? null}
        isOwner={isOwner}
        hasReviewed={hasReviewed}
      />

      {/* One composer per page. It opens for every link to #send-message (the
          hero, the quick bar, the inquiry band, the services links). */}
      {messaging?.mode === 'compose' && (
        <MessageComposer listingId={entity.id} businessName={entity.name} />
      )}
    </div>
  )
}
