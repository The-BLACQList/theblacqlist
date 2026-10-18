import {
  attributeLimit,
  canAccess,
  descriptionCharLimit,
  faqLimit,
  photoLimit,
} from '@/lib/stripe/features'

// Ticket 119. The plan limits the pricing cards promise, checked on save.
//
// One policy for every check here: keep what exists, block new additions above
// the limit. A check fails only when the owner adds or changes the gated thing.
// Saving an unrelated field (hours, phone) never fails because of content the
// listing already had, and removing gated content is always allowed. A listing
// that downgrades keeps what it had (logged as an open item, 2026-10-03).
//
// Each function returns a message the owner can act on, or null when the save
// may go ahead. The callers own the reads; these stay pure so they are easy to
// test.

export const SOCIAL_FIELDS = [
  'social_instagram',
  'social_facebook',
  'social_linkedin',
  'social_tiktok',
  'social_youtube',
  'social_twitter',
] as const

export type SocialField = (typeof SOCIAL_FIELDS)[number]

/** listing_links types that are social profiles. The rest (website, menu, booking...) are not gated. */
export const SOCIAL_LINK_TYPES = [
  'instagram',
  'facebook',
  'linkedin',
  'tiktok',
  'youtube',
  'twitter',
] as const

export function isSocialLinkType(linkType: string): boolean {
  return (SOCIAL_LINK_TYPES as readonly string[]).includes(linkType)
}

/**
 * Social links are Starter for businesses and free on creator pages (ticket
 * 133, founder decision 2026-10-08): for a creator, socials are the page.
 */
export function socialLinksAllowed(tier: string | null, entityType?: string | null): boolean {
  return entityType === 'creator' || canAccess(tier, 'social_links')
}

const SOCIAL_UPGRADE = 'Social links are part of Starter. Upgrade to add them to your page.'

function norm(value: string | null | undefined): string {
  return (value ?? '').trim()
}

/** Description length. Checked only when the text changes. */
export function checkDescription(
  tier: string | null,
  next: string,
  previous: string | null | undefined
): string | null {
  if (norm(next) === norm(previous)) return null
  const limit = descriptionCharLimit(tier)
  if (limit === null || next.length <= limit) return null
  return `Your plan includes a description of up to ${limit} characters. Shorten it, or upgrade to Starter for no limit.`
}

/**
 * Social links are a Starter feature, free on creator pages. On Free, clearing a
 * link is fine and an unchanged link is fine. Adding or changing one is not.
 */
export function checkSocialLinks(
  tier: string | null,
  next: Partial<Record<SocialField, string | undefined>>,
  previous: Partial<Record<SocialField, string | null>> | null | undefined,
  entityType?: string | null
): string | null {
  if (socialLinksAllowed(tier, entityType)) return null
  for (const field of SOCIAL_FIELDS) {
    const value = next[field]
    if (value === undefined) continue
    if (!norm(value)) continue
    if (norm(value) !== norm(previous?.[field])) {
      return SOCIAL_UPGRADE
    }
  }
  return null
}

/**
 * Adding one row in the Links section. A social profile added there gets the
 * same plan check as the Social section, so the Links section is not a way
 * around it. Other link types keep today's rules.
 */
export function checkLinkAdd(
  tier: string | null,
  linkType: string,
  entityType?: string | null
): string | null {
  if (!isSocialLinkType(linkType)) return null
  if (socialLinksAllowed(tier, entityType)) return null
  return SOCIAL_UPGRADE
}

/**
 * Filter details (attributes). Over the limit is allowed only when it is not
 * more than the listing already had.
 */
export function checkAttributeCount(
  tier: string | null,
  nextCount: number,
  previousCount: number
): string | null {
  const limit = attributeLimit(tier)
  if (limit === null || nextCount <= limit || nextCount <= previousCount) return null
  return `Your plan includes up to ${limit} details customers filter by. Remove one, or upgrade for more.`
}

/** Adding one FAQ. `existingCount` is how many the listing has now. */
export function checkFaqAdd(tier: string | null, existingCount: number): string | null {
  const limit = faqLimit(tier)
  if (limit === null || existingCount < limit) return null
  if (limit === 0) return 'Common questions are part of Starter. Upgrade to add them to your page.'
  return `Your plan includes up to ${limit} common questions. Remove one, or upgrade for more.`
}

/** Page video, a link or an upload. Clearing is always allowed, and so is saving the same one. */
export function checkVideo(
  tier: string | null,
  next: string | null,
  previous: string | null | undefined
): string | null {
  if (!norm(next)) return null
  if (norm(next) === norm(previous)) return null
  if (canAccess(tier, 'listing_video')) return null
  return 'A video is part of Starter. Upgrade to add one to your page.'
}

/** Adding one gallery photo. `existingCount` counts gallery photos only. */
export function checkPhotoAdd(tier: string | null, existingCount: number): string | null {
  const limit = photoLimit(tier)
  if (limit === null || existingCount < limit) return null
  return `Your plan includes ${limit} photo${limit === 1 ? '' : 's'}. Upgrade to add more.`
}
