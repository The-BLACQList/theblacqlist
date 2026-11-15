// =============================================================================
// The logo (listings.logo_path)
// =============================================================================
// The logo sits beside the business name in the page hero (EntityLogo, a
// rounded square at 80px) and on map pins. It is shown cropped to a square, so
// a square image with a little space around the mark reads best.
//
// An uploaded logo goes through POST /api/upload with media_role=logo. It is
// stored under listings/{id}/logo/, re-encoded without EXIF, and like a banner
// it has no media row, so it never counts toward the plan's photos.
//
// Client-safe: no server imports.
// =============================================================================

/** The suggested logo, in words. */
export const LOGO_SIZE_TIP = 'A square image, at least 400 × 400 pixels'

/** The longest side a logo is resized to in the browser before upload. */
export const LOGO_MAX_EDGE = 800

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

/** True for a logo the owner uploaded for this listing. */
export function isUploadedLogoPath(listingId: string, path: string | null | undefined): boolean {
  if (!path || !new RegExp(`^${UUID}$`, 'i').test(listingId)) return false
  return new RegExp(`^listings/${listingId}/logo/${UUID}\\.(jpg|png|webp)$`, 'i').test(path)
}
