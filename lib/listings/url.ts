/**
 * Builds the canonical public URL for a listing page.
 * URL structure: /{citySlug}/{entityType}/{listingSlug}
 *
 * Entities without a city (virtual, service-area, national) use `online` as
 * the first segment: /online/{entityType}/{listingSlug}. It must be three
 * segments — a two-segment /{entityType}/{listingSlug} is captured by the
 * app/[citySlug]/[entityType] category route, which treats the entity type as
 * a city slug and 404s. The listing route resolves by slug alone and renders
 * the "Online" location label when the entity has no city, so any first
 * segment reaches the right page; `online` is reserved — no city row may use
 * it as a slug.
 */
export function buildEntityUrl(
  entityType: string,
  citySlug: string | null | undefined,
  listingSlug: string
): string {
  return `/${citySlug || 'online'}/${entityType}/${listingSlug}`
}

/**
 * Where a category chip on a card or listing hero points: the discover page
 * filtered to that category (children included, via resolveFacetParams).
 * Returns null for a missing slug or the `general` fallback that `mapRow`
 * fills in when a listing has no category, since that slug matches no row.
 */
export function categoryFilterHref(
  category: { slug?: string | null } | null | undefined
): string | null {
  const slug = category?.slug
  if (!slug || slug === 'general') return null
  return `/discover?category=${encodeURIComponent(slug)}`
}
