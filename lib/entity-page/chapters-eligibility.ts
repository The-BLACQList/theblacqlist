import type { EntityPageData } from '@/types'

/**
 * Which listing pages get the chapters layout (ticket 231).
 *
 * Founder, 2026-11-18: every plan gets it, but a thin listing keeps today's
 * page until it has enough to fill the chapters. Enough means a cover photo,
 * at least four gallery photos and a story. Storefront types only for now
 * (business, restaurant, vendor); the other templates follow in later passes.
 */

const STOREFRONT_TYPES = new Set(['business', 'restaurant', 'vendor'])

/** Gallery photos a page needs before the chapters fill without gaps. */
export const CHAPTERS_MIN_PHOTOS = 4

export function chaptersEligible(
  entity: Pick<EntityPageData, 'entity_type' | 'cover_image_path' | 'images' | 'details'>
): boolean {
  if (!STOREFRONT_TYPES.has(entity.entity_type)) return false
  if (!entity.cover_image_path?.trim()) return false
  if (entity.images.length < CHAPTERS_MIN_PHOTOS) return false
  return Boolean(entity.details.description?.trim())
}

/**
 * Whether this request asked for the chapters layout, before eligibility.
 *
 * - `?layout=stack` always forces today's page, everywhere.
 * - With FEATURE_LISTING_CHAPTERS on, chapters are the default.
 * - Off production (a Preview or local dev), `?layout=chapters` opts one
 *   request in, so the founder can review real pages without an env change.
 * - On production with the flag off, the query is ignored.
 */
export function chaptersRequested({
  flagOn,
  production,
  layout,
}: {
  flagOn: boolean
  production: boolean
  layout: string | string[] | undefined
}): boolean {
  const value = Array.isArray(layout) ? layout[0] : layout
  if (value === 'stack') return false
  if (flagOn) return true
  return !production && value === 'chapters'
}
