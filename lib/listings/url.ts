/**
 * Builds the canonical public URL for a listing page.
 * URL structure: /{citySlug}/{entityType}/{listingSlug}
 * For online-only entities (no city): /{entityType}/{listingSlug}
 */
export function buildEntityUrl(
  entityType: string,
  citySlug: string | null | undefined,
  listingSlug: string
): string {
  if (!citySlug) return `/${entityType}/${listingSlug}`
  return `/${citySlug}/${entityType}/${listingSlug}`
}
