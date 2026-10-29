import {
  attributeLimit,
  canAccess,
  descriptionCharLimit,
  faqLimit,
  photoLimit,
  TIER_RANK,
  videoLimit,
} from '@/lib/stripe/features'

// Ticket 119. The plan limits the pricing cards promise, checked on save.
//
// One policy for every check here: keep what exists, block new additions above
// the limit. A check fails only when the owner adds or changes the gated thing.
// Saving an unrelated field (hours, phone) never fails because of content the
// listing already had, and removing gated content is always allowed.
//
// A listing that moves to a lower plan keeps everything it saved. Content over
// the new limits is hidden on the public page, never deleted, and comes back on
// upgrade ([Decision — founder, 2026-10-20], lib/stripe/downgrade.ts).
//
// Upgrade copy: a Free page is told to upgrade to Starter. A Starter page is
// offered Growth only while Growth is for sale (`growthOpen`, read from the live
// `plans` row by the caller, ticket 143). Premium is not for sale, so a Growth
// page at its limit is told how to make room instead.
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

/** The plan an owner at a limit can move up to, or null when none is for sale. */
export type UpgradeTarget = 'Starter' | 'Growth' | null

/**
 * Which plan the limit notes offer. Free gets Starter. Starter gets Growth only
 * while Growth can be bought. Everyone else gets no link.
 */
export function upgradeTarget(tier: string | null, growthOpen: boolean): UpgradeTarget {
  const rank = TIER_RANK[tier ?? 'free'] ?? 0
  if (rank === 0) return 'Starter'
  if (tier === 'starter' && growthOpen) return 'Growth'
  return null
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
 * more than the listing already had. Counts leave out the creator groups,
 * which don't count toward the limit (see lib/listings/creatorAttributes.ts).
 */
export function checkAttributeCount(
  tier: string | null,
  nextCount: number,
  previousCount: number,
  growthOpen = false
): string | null {
  const limit = attributeLimit(tier)
  if (limit === null || nextCount <= limit || nextCount <= previousCount) return null
  return `Your plan includes up to ${limit} details customers filter by. ${makeRoom(tier, 'Remove one, or upgrade for more.', growthOpen)}`
}

/** Adding one FAQ. `existingCount` is how many the listing has now. */
export function checkFaqAdd(
  tier: string | null,
  existingCount: number,
  growthOpen = false
): string | null {
  const limit = faqLimit(tier)
  if (limit === null || existingCount < limit) return null
  if (limit === 0) return 'Common questions are part of Starter. Upgrade to add them to your page.'
  return `Your plan includes up to ${limit} common questions. ${makeRoom(tier, 'Remove one, or upgrade for more.', growthOpen)}`
}

/**
 * Adding one page video, a link or an upload. `existingCount` is how many the
 * page has now. Removing and reordering are always allowed.
 */
export function checkVideoAdd(
  tier: string | null,
  existingCount: number,
  growthOpen = false
): string | null {
  const limit = videoLimit(tier)
  if (limit === null || existingCount < limit) return null
  if (limit === 0) return 'A video is part of Starter. Upgrade to add one to your page.'
  return `Your plan includes ${limit === 1 ? '1 video' : `up to ${limit} videos`}. ${makeRoom(tier, 'Upgrade to add more.', growthOpen)}`
}

/** Adding one gallery photo. `existingCount` counts gallery photos only. */
export function checkPhotoAdd(
  tier: string | null,
  existingCount: number,
  growthOpen = false
): string | null {
  const limit = photoLimit(tier)
  if (limit === null || existingCount < limit) return null
  return `Your plan includes ${limit} photo${limit === 1 ? '' : 's'}. ${makeRoom(tier, 'Upgrade to add more.', growthOpen)}`
}

/**
 * The second sentence of a limit message. Free gets `freeText`, which may
 * mention upgrading (Starter is on sale). Starter is offered Growth while Growth
 * is for sale, and every limit Growth has is higher than Starter's. Otherwise a
 * paid plan is told how to make room.
 */
function makeRoom(tier: string | null, freeText: string, growthOpen: boolean): string {
  const target = upgradeTarget(tier, growthOpen)
  if (target === 'Starter') return freeText
  if (target === 'Growth') return 'Remove one, or upgrade to Growth for more.'
  return 'Remove one to add another.'
}
