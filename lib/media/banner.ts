// =============================================================================
// The banner (listings.cover_image_path): sizes, quality and the crop
// =============================================================================
// The banner fills the top of the business page edge to edge, so the screen
// decides how much of it shows (TemplateHero, object-cover, centred):
//
//   computer   about 2.2:1 to 3:1 (full width, 46 to 74% of the screen tall)
//   phone      about 1:1 (a 390px wide screen, 360 to 420px tall)
//   cards      about 4:3, share card 1.9:1
//
// One 2:1 crop serves all of them: a wide screen trims a little from its top
// and bottom, a phone shows its middle half. So owners crop to 2:1 and keep
// the main subject in the middle.
//
// A cropped banner is stored at up to 2400 x 1200 (the stored size cap,
// lib/media/prepareImage.ts) under listings/{id}/cover/. Like an uploaded
// cover, it has no media row and never counts toward the plan's photos.
//
// Client-safe: no sharp, no server imports.
// =============================================================================

/** Width over height of a cropped banner. */
export const BANNER_RATIO = 2

/** The widest a stored banner gets (IMAGE_MAX_EDGE in prepareImage). */
export const BANNER_MAX_WIDTH = 2400

/** At or above this width the banner is sharp on a large screen. */
export const BANNER_SHARP_WIDTH = 1920

/** Below this width the banner looks soft on a computer. */
export const BANNER_MIN_WIDTH = 1200

/** Screen shapes (width / height) the banner is previewed at. */
export const SCREEN_RATIOS = { computer: 2.6, phone: 0.95 } as const

/** The suggested size, in words. */
export const BANNER_SIZE_TIP = `A wide photo, at least ${BANNER_SHARP_WIDTH} × ${BANNER_SHARP_WIDTH / BANNER_RATIO} pixels`

export type BannerQualityLevel = 'sharp' | 'good' | 'soft'

export interface BannerQuality {
  level: BannerQualityLevel
  label: string
  tip: string | null
}

/**
 * How sharp a banner of `width` source pixels looks on a large screen. The
 * width is what the crop covers in the original photo, not the file's size.
 */
export function bannerQuality(width: number): BannerQuality {
  if (width >= BANNER_SHARP_WIDTH) return { level: 'sharp', label: 'Sharp on every screen', tip: null }
  if (width >= BANNER_MIN_WIDTH) {
    return {
      level: 'good',
      label: 'Good on most screens',
      tip: `For the sharpest banner, use a photo at least ${BANNER_SHARP_WIDTH} pixels wide.`,
    }
  }
  return {
    level: 'soft',
    label: 'May look blurry on a computer',
    tip: `This is ${Math.round(width)} pixels wide. Use a photo at least ${BANNER_SHARP_WIDTH} pixels wide, or zoom out.`,
  }
}

export interface Size {
  width: number
  height: number
}

/** A rectangle in the source photo's pixels. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** The largest 2:1 area of a photo, before any zoom. */
export function fullCrop(source: Size): Size {
  const width = Math.min(source.width, source.height * BANNER_RATIO)
  return { width, height: width / BANNER_RATIO }
}

export const MAX_ZOOM = 4

/**
 * The 2:1 crop at `zoom` (1 = as large as the photo allows), centred on
 * `center` (0 to 1 across and down the photo), kept inside the photo.
 */
export function bannerCrop(source: Size, zoom: number, center: { x: number; y: number }): Rect {
  const z = Math.min(MAX_ZOOM, Math.max(1, Number.isFinite(zoom) ? zoom : 1))
  const full = fullCrop(source)
  const width = full.width / z
  const height = full.height / z
  const clamp = (v: number, max: number) => Math.min(Math.max(0, v), Math.max(0, max))
  const cx = Number.isFinite(center.x) ? center.x : 0.5
  const cy = Number.isFinite(center.y) ? center.y : 0.5
  return {
    x: clamp(cx * source.width - width / 2, source.width - width),
    y: clamp(cy * source.height - height / 2, source.height - height),
    width,
    height,
  }
}

/** The centre of `crop`, as 0 to 1 across and down the photo. */
export function cropCenter(source: Size, crop: Rect): { x: number; y: number } {
  return {
    x: (crop.x + crop.width / 2) / source.width,
    y: (crop.y + crop.height / 2) / source.height,
  }
}

/**
 * The part of `crop` a screen of `ratio` (width / height) shows, the way the
 * page's object-cover does: centred, trimming the long sides.
 */
export function visibleArea(crop: Rect, ratio: number): Rect {
  const cropRatio = crop.width / crop.height
  if (ratio >= cropRatio) {
    const height = crop.width / ratio
    return { x: crop.x, y: crop.y + (crop.height - height) / 2, width: crop.width, height }
  }
  const width = crop.height * ratio
  return { x: crop.x + (crop.width - width) / 2, y: crop.y, width, height: crop.height }
}

/**
 * CSS that shows `area` of the photo filling a box of the same shape, with the
 * photo as the box's background.
 */
export function backgroundFor(source: Size, area: Rect): { backgroundSize: string; backgroundPosition: string } {
  const pct = (v: number) => `${Math.round(v * 1000) / 1000}%`
  const sizeX = (source.width / area.width) * 100
  const sizeY = (source.height / area.height) * 100
  const spareX = source.width - area.width
  const spareY = source.height - area.height
  const posX = spareX > 0 ? (area.x / spareX) * 100 : 50
  const posY = spareY > 0 ? (area.y / spareY) * 100 : 50
  return { backgroundSize: `${pct(sizeX)} ${pct(sizeY)}`, backgroundPosition: `${pct(posX)} ${pct(posY)}` }
}

/** The stored size of a crop: its own pixels, never enlarged, at most 2400 wide. */
export function bannerOutputSize(crop: Rect): Size {
  const width = Math.max(1, Math.round(Math.min(crop.width, BANNER_MAX_WIDTH)))
  return { width, height: Math.max(1, Math.round(width / BANNER_RATIO)) }
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

/** True for a banner the owner uploaded for this listing (not a gallery photo). */
export function isUploadedBannerPath(listingId: string, path: string | null | undefined): boolean {
  if (!path || !new RegExp(`^${UUID}$`, 'i').test(listingId)) return false
  return new RegExp(`^listings/${listingId}/cover/${UUID}\\.(jpg|png|webp)$`, 'i').test(path)
}

/**
 * Of a site's photos, the one to suggest as the banner: the first wide enough
 * to stay sharp, else the first photo.
 */
export function pickBannerPhoto<T extends { kind: string; width: number | null }>(photos: readonly T[]): T | null {
  const real = photos.filter((p) => p.kind === 'photo')
  return real.find((p) => (p.width ?? 0) >= BANNER_MIN_WIDTH) ?? real[0] ?? null
}
