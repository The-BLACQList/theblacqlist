import type {
  DayHours,
  DiscoveryEntity,
  EntityType,
  EntityVideo,
  GalleryImage,
  LocationType,
  ResolvedImage,
  ReviewItem,
  SocialLinks,
  WeeklyHours,
} from '@/types'

/**
 * Pieces shared by the three "Test Business 123" fixtures (ticket 184).
 *
 * Everything here is illustrative. The sample pages say so in a banner on
 * every visit, so a fictional address, 555 phone numbers and example.com
 * links are the point, not an oversight. Nothing in these files is a
 * measurement of anything — see .claude/rules/no-fabrication.md.
 */

export const EXAMPLE_NAME = 'Test Business 123'
export const EXAMPLE_EMAIL = 'hello@example.com'
export const EXAMPLE_SITE = 'https://example.com'
export const EXAMPLE_OWNER_ID = 'example-owner'

export const ATLANTA = { name: 'Atlanta', slug: 'atlanta-ga', state_abbr: 'GA' } as const

/** Every photo on a sample page lives under this folder (see lib/listings/exampleAssets.ts). */
export const EXAMPLE_ASSET_DIR = '/images/example'

export function asset(file: string): string {
  return `${EXAMPLE_ASSET_DIR}/${file}`
}

export function image(file: string, alt: string): ResolvedImage {
  return { src: asset(file), alt }
}

/** Gallery entries with stable ids, so React keys and tests do not depend on order. */
export function gallery(
  prefix: string,
  items: ReadonlyArray<readonly [file: string, alt: string, album?: string]>
): GalleryImage[] {
  return items.map(([file, alt, album]) => ({
    id: `${prefix}-${file.replace(/\.\w+$/, '')}`,
    src: asset(file),
    alt,
    ...(album ? { album } : {}),
  }))
}

/** `days` after `now`, at `hour` local time, as ISO. Events and deadlines use this so they never go stale. */
export function futureIso(now: Date, days: number, hour = 18): string {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

/** `days` before `now`, as ISO. Review dates use this. */
export function pastIso(now: Date, days: number): string {
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  d.setHours(12, 0, 0, 0)
  return d.toISOString()
}

const CLOSED: DayHours = { open: '00:00', close: '00:00', closed: true }

function open(from: string, to: string): DayHours {
  return { open: from, close: to, closed: false }
}

/** Weekday hours plus a weekend, or closed weekends when `weekend` is null. */
export function weeklyHours(
  weekday: readonly [string, string],
  weekend: readonly [string, string] | null
): WeeklyHours {
  const wd = open(weekday[0], weekday[1])
  const we = weekend ? open(weekend[0], weekend[1]) : CLOSED
  return {
    monday: wd,
    tuesday: wd,
    wednesday: wd,
    thursday: wd,
    friday: wd,
    saturday: we,
    sunday: we,
  }
}

/** All six socials filled, as a Premium page would have them. */
export function socials(handle: string): SocialLinks {
  return {
    instagram: `https://www.instagram.com/${handle}`,
    facebook: `https://www.facebook.com/${handle}`,
    linkedin: `https://www.linkedin.com/company/${handle}`,
    tiktok: `https://www.tiktok.com/@${handle}`,
    youtube: `https://www.youtube.com/@${handle}`,
    twitter: `https://x.com/${handle}`,
  }
}

/**
 * Open-licence demo films from the Blender Foundation (CC BY 3.0), so the
 * Watch section plays something real on Preview instead of a dead embed. One
 * YouTube link and one Vimeo link, which together exercise both players.
 * Credits are recorded in docs/blacqlist/design/example-image-licenses.md.
 */
export const DEMO_VIDEOS: EntityVideo[] = [
  { id: 'video-1', embed_url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', file_url: null },
  { id: 'video-2', embed_url: 'https://vimeo.com/1084537', file_url: null },
]

export const DEMO_VIDEOS_THREE: EntityVideo[] = [
  ...DEMO_VIDEOS,
  { id: 'video-3', embed_url: 'https://www.youtube.com/watch?v=eRsGyueVLvQ', file_url: null },
]

/**
 * Where the demo videos come from, for the banner credits and the licence
 * record. Both are Blender Foundation open movies (CC BY 3.0); the embeds
 * above are the Foundation's own uploads, checked through each host's oEmbed
 * endpoint on 2026-11-13.
 */
export const CC_BY_3_LABEL = 'CC BY 3.0'
export const CC_BY_3_URL = 'https://creativecommons.org/licenses/by/3.0/'

export interface DemoVideoCredit {
  title: string
  author: string
  license: typeof CC_BY_3_LABEL
  licenseUrl: typeof CC_BY_3_URL
  pageUrl: string
}

export const DEMO_VIDEO_CREDITS: readonly DemoVideoCredit[] = [
  {
    title: 'Big Buck Bunny',
    author: 'Blender Foundation',
    license: CC_BY_3_LABEL,
    licenseUrl: CC_BY_3_URL,
    pageUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  },
  {
    title: 'Big Buck Bunny (Vimeo)',
    author: 'Blender Foundation',
    license: CC_BY_3_LABEL,
    licenseUrl: CC_BY_3_URL,
    pageUrl: 'https://vimeo.com/1084537',
  },
  {
    title: 'Sintel',
    author: 'Blender Foundation',
    license: CC_BY_3_LABEL,
    licenseUrl: CC_BY_3_URL,
    pageUrl: 'https://www.youtube.com/watch?v=eRsGyueVLvQ',
  },
]

export interface RelatedSeed {
  name: string
  slug: string
  tagline: string
  category: { name: string; slug: string }
  avg_rating: number
  review_count: number
}

/**
 * Three neighbours for the Related section, which hides below three. Covers
 * are null on purpose: the card falls back to its monogram, which is what
 * most real listings show today, so the sample does not promise more than
 * the product delivers.
 */
export function relatedEntities(
  entityType: EntityType,
  seeds: readonly RelatedSeed[],
  locationType: LocationType = 'physical'
): DiscoveryEntity[] {
  return seeds.map((s, i) => ({
    id: `example-related-${entityType}-${i + 1}`,
    name: s.name,
    slug: s.slug,
    entity_type: entityType,
    tagline: s.tagline,
    description: s.tagline,
    category: s.category,
    city: { ...ATLANTA },
    location_type: locationType,
    trust_tier: i === 0 ? 'verified' : 'claimed',
    tier: i === 0 ? 'premium' : 'free',
    ownership_label: 'black_owned',
    is_featured: false,
    is_sponsored: false,
    logo_path: null,
    cover_image_path: null,
    avg_rating: s.avg_rating,
    review_count: s.review_count,
    save_count: 20 + i * 7,
  }))
}

export interface ReviewSeed {
  reviewer: string
  rating: number
  title: string
  body: string
  daysAgo: number
  criteria: ReadonlyArray<readonly [string, number]>
  photos?: ReadonlyArray<readonly [string, string]>
  ownerResponse?: string
  verified?: boolean
}

export function reviews(prefix: string, now: Date, seeds: readonly ReviewSeed[]): ReviewItem[] {
  return seeds.map((s, i) => ({
    id: `${prefix}-review-${i + 1}`,
    rating: s.rating,
    title: s.title,
    body: s.body,
    published_at: pastIso(now, s.daysAgo),
    is_verified_purchase: s.verified ?? false,
    reviewer_display_name: s.reviewer,
    owner_response: s.ownerResponse ?? null,
    owner_responded_at: s.ownerResponse ? pastIso(now, Math.max(0, s.daysAgo - 2)) : null,
    criteria: s.criteria.map(([name, rating]) => ({ name, rating })),
    photos: (s.photos ?? []).map(([file, alt], j) => ({
      id: `${prefix}-review-${i + 1}-photo-${j + 1}`,
      src: asset(file),
      alt,
    })),
  }))
}

/** One hiring role as the job card reads it (lib/listings/jobCard.ts). */
export function hiringRole(input: {
  id: string
  slug: string
  title: string
  logoFile: string
  employmentType: 'full-time' | 'part-time' | 'contract' | 'internship'
  workplaceType: 'on-site' | 'hybrid' | 'remote'
  salaryMin: number
  salaryMax: number
  salaryPeriod: 'hour' | 'year'
  closesAt: string
  tagline: string
}): DiscoveryEntity {
  return {
    id: input.id,
    name: input.title,
    slug: input.slug,
    entity_type: 'job',
    tagline: input.tagline,
    description: input.tagline,
    category: { name: 'Jobs', slug: 'jobs' },
    city: { ...ATLANTA },
    location_type: input.workplaceType === 'remote' ? 'virtual' : 'physical',
    trust_tier: 'verified',
    tier: 'premium',
    ownership_label: 'black_owned',
    is_featured: false,
    is_sponsored: false,
    logo_path: null,
    cover_image_path: null,
    avg_rating: null,
    review_count: 0,
    save_count: 0,
    job_details: {
      businessName: EXAMPLE_NAME,
      businessLogoUrl: asset(input.logoFile),
      employmentType: input.employmentType,
      workplaceType: input.workplaceType,
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      salaryPeriod: input.salaryPeriod,
      closesAt: input.closesAt,
    },
  }
}

/** Attribute groups as the page shows them: a free-text group name and named values. */
export function attributeGroup(group: string, names: readonly string[]) {
  return {
    group,
    values: names.map((name) => ({
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
      icon: null,
    })),
  }
}

export function faqs(prefix: string, items: ReadonlyArray<readonly [string, string]>) {
  return items.map(([question, answer], i) => ({ id: `${prefix}-faq-${i + 1}`, question, answer }))
}
