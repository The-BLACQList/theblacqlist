import { resolveMediaPath } from '@/lib/listings/coverImage'
import { buildEntityUrl } from '@/lib/listings/url'
import type { EntityPageData } from '@/types'

// The LocalBusiness structured data for a listing page, lifted verbatim from
// app/[citySlug]/[entityType]/[listingSlug]/page.tsx (ticket 184, PR 1B) so it
// can be unit-tested and rendered on the sample pages, where the founder can
// paste a Preview URL into Google's Rich Results test. Its output is pinned by
// tests/jsonld.test.ts: the move changed nothing. Ticket 189 is where it grows
// (opening hours, geo, images, offer catalog, a category-mapped @type) and
// where the two quirks noted inline get fixed.

export const DEFAULT_SITE_URL = 'https://theblacqlist.com'

/** The public origin, as every absolute URL on the site derives it. */
export function siteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL
}

export function buildJsonLd(
  entity: EntityPageData | null,
  entityType: string,
  baseUrl: string = siteBaseUrl()
): Record<string, unknown> | null {
  if (!entity) return null
  const { details, city } = entity
  const logoUrl = resolveMediaPath(entity.logo_path)

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: entity.name,
    description: details.description || entity.tagline,
    url: `${baseUrl}${buildEntityUrl(entityType, city?.slug, entity.slug)}`,
    // schema.org logo must be a fetchable URL. logo_path is a Storage key, so
    // emitting it raw hands crawlers a string like "logos/abc.png" — invalid,
    // and Google drops the property. Resolve it the same way the cover is.
    ...(logoUrl && { logo: logoUrl }),
    // Quirk kept on purpose (ticket 189): `0 && {…}` spreads nothing, so a
    // listing whose average is exactly 0 emits no aggregateRating. Harmless
    // today — a published review cannot score 0 — but it is a truthiness
    // check standing in for a null check.
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
      // Quirk kept on purpose (ticket 189): the spread sets addressLocality to
      // the second address line, and the next key overwrites it, so line 2
      // ("Suite A") never reaches the output. It belongs in streetAddress.
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
