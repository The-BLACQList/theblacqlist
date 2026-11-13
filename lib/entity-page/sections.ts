/**
 * The page section registry (ticket 184).
 *
 * One record per section a listing page can show: which templates render it,
 * what plan or flag unlocks it, where the owner edits it, and how to tell
 * whether a page has filled it. The three templates render in the order given
 * by TEMPLATE_SECTION_ORDER, the example pages prove every section is filled
 * against it (tests/example-fixtures.test.ts), and the click-to-fill editor
 * (ticket 188) will read `editor.href` and `minTierFor` to decide between
 * "fill it" and "upgrade" per section.
 *
 * Pure and client-safe: no I/O, no env reads. Tier minimums come from
 * FEATURE_MIN_TIER in lib/stripe/features.ts and are never restated here.
 */

import type { FeatureFlag } from '@/lib/env'
import {
  FEATURE_MIN_TIER,
  canAccess,
  limitsFor,
  type GatedFeature,
  type TierLimits,
} from '@/lib/stripe/features'
import type { PlanSlug } from '@/lib/stripe/plans'
import type { EntityPageData, EntityType } from '@/types'

export type SectionId =
  | 'hero'
  | 'logo'
  | 'info-rail'
  | 'coupons'
  | 'at-a-glance'
  | 'locations'
  | 'links'
  | 'story'
  | 'team'
  | 'offerings'
  | 'services'
  | 'capabilities'
  | 'portfolio'
  | 'shop'
  | 'booking'
  | 'attributes'
  | 'faq'
  | 'hiring'
  | 'events'
  | 'gallery'
  | 'video'
  | 'inquiry'
  | 'reviews'
  | 'trust'
  | 'community'
  | 'activity'
  | 'related'

export type TemplateKey = 'storefront' | 'professional' | 'creative'

export interface SectionGate {
  /** Plan gate, checked with canAccess. Absent: every plan. */
  feature?: GatedFeature
  /** Site feature flag the section also needs (jobsOpen, marketplaceOpen). */
  flag?: FeatureFlag
  /** Numeric cap from TIER_LIMITS that applies to this section's rows. */
  limit?: keyof Omit<TierLimits, 'analyticsHistoryDays' | 'extraButtons'>
  /** Hidden on unclaimed listings whatever the plan (the logo, like the map pin). */
  requiresClaimed?: boolean
}

export interface SectionEditor {
  /** Short owner-facing name of the tool that fills this section. */
  tool: string
  /** Where the owner edits it. null = the platform fills it (reviews, related). */
  href: (entityId: string) => string | null
}

export interface EntitySectionDef {
  id: SectionId
  label: string
  templates: readonly TemplateKey[]
  gate: SectionGate
  editor: SectionEditor
  /** Whether this page has content for the section. Legacy pages never fill the new optional fields. */
  isFilled: (entity: EntityPageData) => boolean
}

const ALL: readonly TemplateKey[] = ['storefront', 'professional', 'creative']
const edit = (anchor: string) => (id: string) => `/dashboard/pages/${id}/edit#${anchor}`
const page = (segment: string) => (id: string) => `/dashboard/pages/${id}/${segment}`
const system = () => null

const hasServices = (e: EntityPageData) => e.details.services.length > 0
const hasImages = (e: EntityPageData) => e.images.length > 0

export const ENTITY_SECTIONS: readonly EntitySectionDef[] = [
  {
    id: 'hero',
    label: 'Cover & name',
    templates: ALL,
    gate: {},
    editor: { tool: 'Page basics', href: edit('basics') },
    isFilled: () => true,
  },
  {
    id: 'logo',
    label: 'Logo',
    templates: ALL,
    gate: { requiresClaimed: true },
    editor: { tool: 'Photos', href: edit('photos') },
    isFilled: (e) => Boolean(e.logo),
  },
  {
    id: 'info-rail',
    label: 'Quick facts',
    templates: ALL,
    gate: {},
    editor: { tool: 'Contact & hours', href: edit('contact') },
    isFilled: () => true,
  },
  {
    id: 'coupons',
    label: 'Coupons & deals',
    templates: ALL,
    gate: { feature: 'coupons' },
    editor: { tool: 'Deals', href: page('deals') },
    isFilled: (e) => (e.coupons?.length ?? 0) > 0,
  },
  {
    id: 'at-a-glance',
    label: 'Visit',
    templates: ALL,
    gate: {},
    editor: { tool: 'Contact & hours', href: edit('hours') },
    isFilled: () => true,
  },
  {
    id: 'locations',
    label: 'Other locations',
    templates: ALL,
    gate: { feature: 'multi_location', limit: 'locations' },
    editor: { tool: 'Locations', href: page('locations') },
    isFilled: (e) => (e.locations?.length ?? 0) > 0,
  },
  {
    id: 'links',
    label: 'Links',
    templates: ALL,
    gate: {},
    editor: { tool: 'Social & links', href: edit('social') },
    isFilled: (e) => e.links.length > 0,
  },
  {
    id: 'story',
    label: 'About',
    templates: ALL,
    gate: {},
    editor: { tool: 'About', href: edit('about') },
    isFilled: (e) => Boolean(e.details.description?.trim()),
  },
  {
    id: 'team',
    label: 'Team',
    templates: ALL,
    gate: { feature: 'team_members', limit: 'teamMembers' },
    editor: { tool: 'Team', href: page('team') },
    isFilled: (e) => (e.team?.length ?? 0) > 0,
  },
  {
    id: 'offerings',
    label: 'Offerings',
    templates: ['storefront'],
    gate: {},
    editor: { tool: 'Offerings', href: page('offerings') },
    isFilled: hasServices,
  },
  {
    id: 'services',
    label: 'Services',
    templates: ['professional'],
    gate: {},
    editor: { tool: 'Offerings', href: page('offerings') },
    isFilled: hasServices,
  },
  {
    id: 'capabilities',
    label: 'Capabilities',
    templates: ['creative'],
    gate: {},
    editor: { tool: 'Offerings', href: page('offerings') },
    isFilled: hasServices,
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    templates: ['professional', 'creative'],
    gate: {},
    editor: { tool: 'Photos', href: page('media') },
    isFilled: hasImages,
  },
  {
    id: 'shop',
    label: 'Shop',
    templates: ALL,
    gate: { feature: 'storefront', flag: 'marketplaceOpen' },
    editor: { tool: 'Products & services', href: () => '/dashboard/products' },
    isFilled: (e) => (e.shop?.items.length ?? 0) > 0,
  },
  {
    id: 'booking',
    label: 'Booking requests',
    templates: ALL,
    gate: { feature: 'booking_requests' },
    editor: { tool: 'Bookings', href: page('bookings') },
    isFilled: (e) => Boolean(e.booking),
  },
  {
    id: 'attributes',
    label: 'What this business offers',
    templates: ALL,
    gate: {},
    editor: { tool: 'Details', href: edit('details') },
    isFilled: (e) => e.attributes.length > 0,
  },
  {
    id: 'faq',
    label: 'FAQ',
    templates: ALL,
    gate: { feature: 'faqs', limit: 'faqs' },
    editor: { tool: 'FAQ', href: page('offerings') },
    isFilled: (e) => e.faqs.length > 0,
  },
  {
    id: 'hiring',
    label: 'Now hiring',
    templates: ALL,
    gate: { flag: 'jobsOpen', limit: 'jobs' },
    editor: { tool: 'Jobs', href: () => '/dashboard/jobs' },
    isFilled: (e) => (e.hiring?.roles.length ?? 0) > 0,
  },
  {
    id: 'events',
    label: 'Upcoming events',
    templates: ALL,
    gate: { feature: 'events', limit: 'events' },
    editor: { tool: 'Events', href: page('events') },
    isFilled: (e) => e.organizerEvents.length > 0,
  },
  {
    id: 'gallery',
    label: 'Gallery',
    templates: ALL,
    gate: { limit: 'photos' },
    editor: { tool: 'Photos', href: page('media') },
    isFilled: hasImages,
  },
  {
    id: 'video',
    label: 'Video',
    templates: ALL,
    gate: { feature: 'listing_video', limit: 'videos' },
    editor: { tool: 'Video', href: edit('video') },
    isFilled: (e) => e.details.videos.length > 0,
  },
  {
    id: 'inquiry',
    label: 'Get in touch',
    templates: ALL,
    gate: {},
    editor: { tool: 'Main button', href: edit('main-button') },
    isFilled: () => true,
  },
  {
    id: 'reviews',
    label: 'Reviews',
    templates: ALL,
    gate: {},
    editor: { tool: 'Reviews', href: system },
    isFilled: () => true,
  },
  {
    id: 'trust',
    label: 'Trust & verification',
    templates: ['storefront'],
    gate: {},
    editor: { tool: 'Verification', href: page('verification') },
    isFilled: () => true,
  },
  {
    id: 'community',
    label: 'Community',
    templates: ['storefront'],
    gate: {},
    editor: { tool: 'Community', href: system },
    isFilled: () => true,
  },
  {
    id: 'activity',
    label: 'On The BLACQList',
    templates: ALL,
    gate: {},
    editor: { tool: 'Activity', href: system },
    isFilled: (e) => e.save_count > 0,
  },
  {
    id: 'related',
    label: 'You might also like',
    templates: ALL,
    gate: {},
    editor: { tool: 'Related', href: system },
    isFilled: (e) => e.related.length >= 3,
  },
]

const BY_ID: ReadonlyMap<SectionId, EntitySectionDef> = new Map(
  ENTITY_SECTIONS.map((s) => [s.id, s])
)

export function sectionDef(id: SectionId): EntitySectionDef {
  const def = BY_ID.get(id)
  if (!def) throw new Error(`Unknown section: ${id}`)
  return def
}

/**
 * The render order of each template, the same order the template files use.
 * Existing sections kept where they were; the new ones (coupons, locations,
 * team, shop, booking, logo) sit where the plan for ticket 184 put them.
 * The professional and creative templates render trust inside the two-column
 * body as an aside rather than as a section, so it is not in their lists.
 */
export const TEMPLATE_SECTION_ORDER: Record<TemplateKey, readonly SectionId[]> = {
  storefront: [
    'hero',
    'info-rail',
    'coupons',
    'at-a-glance',
    'locations',
    'links',
    'story',
    'team',
    'offerings',
    'shop',
    'attributes',
    'faq',
    'hiring',
    'events',
    'gallery',
    'video',
    'booking',
    'inquiry',
    'reviews',
    'trust',
    'community',
    'activity',
    'related',
  ],
  professional: [
    'hero',
    'info-rail',
    'coupons',
    'at-a-glance',
    'locations',
    'services',
    'booking',
    'story',
    'team',
    'portfolio',
    'shop',
    'attributes',
    'links',
    'gallery',
    'video',
    'inquiry',
    'reviews',
    'hiring',
    'events',
    'faq',
    'activity',
    'related',
  ],
  creative: [
    'hero',
    'info-rail',
    'coupons',
    'at-a-glance',
    'locations',
    'portfolio',
    'capabilities',
    'booking',
    'shop',
    'story',
    'team',
    'attributes',
    'links',
    'gallery',
    'video',
    'inquiry',
    'reviews',
    'hiring',
    'events',
    'faq',
    'activity',
    'related',
  ],
}

/** Which template a listing type renders with; null for events and jobs. */
export function templateKeyFor(entityType: EntityType): TemplateKey | null {
  switch (entityType) {
    case 'business':
    case 'restaurant':
    case 'vendor':
      return 'storefront'
    case 'professional':
    case 'service_provider':
      return 'professional'
    case 'creative':
    case 'creator':
      return 'creative'
    default:
      return null
  }
}

const RANK_TO_SLUG: readonly PlanSlug[] = ['free', 'starter', 'growth', 'premium']

/** The lowest plan that unlocks a section. Derived from FEATURE_MIN_TIER, never restated. */
export function minTierFor(id: SectionId): PlanSlug {
  const feature = sectionDef(id).gate.feature
  if (!feature) return 'free'
  return RANK_TO_SLUG[FEATURE_MIN_TIER[feature]] ?? 'premium'
}

export type FlagReader = (flag: FeatureFlag) => boolean

/** Treats every flag as on; the default for tier-only questions. */
export const ALL_FLAGS_ON: FlagReader = () => true

/**
 * Whether a plan on this site can show a section at all. Content is a separate
 * question (isFilled); so is the numeric cap (applyTierGates slices to it).
 */
export function sectionAllowed(
  id: SectionId,
  tier: PlanSlug | string | null,
  flags: FlagReader = ALL_FLAGS_ON,
  opts: { claimed?: boolean } = {}
): boolean {
  const { gate } = sectionDef(id)
  if (gate.feature && !canAccess(tier, gate.feature)) return false
  if (gate.flag && !flags(gate.flag)) return false
  if (gate.requiresClaimed && opts.claimed === false) return false
  return true
}

function sliceTo<T>(rows: T[] | undefined, cap: number | null): T[] | undefined {
  if (!rows || cap === null) return rows
  return rows.slice(0, Math.max(0, cap))
}

/**
 * The page a plan is entitled to show: gated fields a lower plan cannot show
 * become undefined (section hidden, nothing deleted — ticket 105 policy) and
 * capped lists are cut to the plan's limit. Pure; the input is not mutated.
 *
 * `locations` holds the OTHER locations, so its cap is the plan's location
 * count less the page itself.
 */
export function applyTierGates(
  entity: EntityPageData,
  tier: PlanSlug | string | null,
  flags: FlagReader = ALL_FLAGS_ON
): EntityPageData {
  const limits = limitsFor(tier)
  const allowed = (id: SectionId) =>
    sectionAllowed(id, tier, flags, { claimed: entity.trust_tier !== 'unclaimed' })

  return {
    ...entity,
    logo: allowed('logo') ? entity.logo : undefined,
    team: allowed('team') ? sliceTo(entity.team, limits.teamMembers) : undefined,
    coupons: allowed('coupons') ? entity.coupons : undefined,
    booking: allowed('booking') ? entity.booking : undefined,
    locations: allowed('locations')
      ? sliceTo(entity.locations, limits.locations === null ? null : limits.locations - 1)
      : undefined,
    shop: allowed('shop') ? entity.shop : undefined,
    hiring: allowed('hiring') ? entity.hiring : undefined,
    faqs: allowed('faq') ? (sliceTo(entity.faqs, limits.faqs) ?? []) : [],
    organizerEvents: allowed('events')
      ? (sliceTo(entity.organizerEvents, limits.events) ?? [])
      : [],
    images: sliceTo(entity.images, limits.photos) ?? [],
    details: {
      ...entity.details,
      videos: allowed('video') ? (sliceTo(entity.details.videos, limits.videos) ?? []) : [],
    },
  }
}

/** The sections a template shows for this page: in order, allowed on the plan, and filled. */
export function visibleSections(
  entity: EntityPageData,
  template: TemplateKey,
  flags: FlagReader = ALL_FLAGS_ON
): SectionId[] {
  return TEMPLATE_SECTION_ORDER[template].filter(
    (id) =>
      sectionAllowed(id, entity.tier, flags, { claimed: entity.trust_tier !== 'unclaimed' }) &&
      sectionDef(id).isFilled(entity)
  )
}

/**
 * The note EntityBookingSection shows instead of its submit promise on a
 * sample page. Lives here so the three templates and the Playwright spec read
 * one string.
 */
export const EXAMPLE_BOOKING_NOTE = 'Requests are off on the sample page.'
