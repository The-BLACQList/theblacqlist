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
import { DEALS_ON_MAX } from '@/lib/listings/deals'
import {
  FEATURE_MIN_TIER,
  canAccess,
  limitsFor,
  type GatedFeature,
  type TierLimits,
} from '@/lib/stripe/features'
import type { PlanSlug } from '@/lib/stripe/plans'
import { factsFor } from '@/lib/listings/facts'
import { galleryAlbums } from '@/lib/listings/galleryAlbums'
import type { EntityPageData, EntityType } from '@/types'

export type SectionId =
  | 'hero'
  | 'logo'
  | 'facts'
  | 'happening-now'
  | 'info-rail'
  | 'order-on'
  | 'find-us'
  | 'deals'
  | 'at-a-glance'
  | 'map'
  | 'hours-overrides'
  | 'locations'
  | 'links'
  | 'story'
  | 'highlights'
  | 'team'
  | 'offerings'
  | 'services'
  | 'capabilities'
  | 'documents'
  | 'portfolio'
  | 'shop'
  | 'booking'
  | 'attributes'
  | 'faq'
  | 'hiring'
  | 'events'
  | 'gallery'
  | 'albums'
  | 'video'
  | 'inquiry'
  | 'reviews'
  | 'credentials'
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
    id: 'facts',
    label: 'Facts line',
    templates: ALL,
    // Part of the basic page (founder 2026-11-13). Ticket 189 wires the live loader.
    gate: {},
    editor: { tool: 'Details', href: edit('details') },
    isFilled: (e) => factsFor(e.details).length > 0,
  },
  {
    id: 'happening-now',
    label: 'Happening now',
    templates: ALL,
    // Main's posts (owner-experience round 2, part F). The site flag and the
    // per-plan active-post cap gate it, as lib/listings/entityPage.ts and
    // shownPosts do. The route renders it above the template, as the live
    // listing route does, so it is registered but never ordered.
    gate: { flag: 'happeningNow', limit: 'activePosts' },
    editor: { tool: 'Happening now', href: page('posts') },
    isFilled: (e) => (e.happeningNow?.length ?? 0) > 0,
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
    // Delivery-app buttons (owner-experience round 2, part D): every plan,
    // behind the orderWhereSold flag, edited on the Services tab.
    id: 'order-on',
    label: 'Order on',
    templates: ALL,
    gate: { flag: 'orderWhereSold' },
    editor: { tool: 'Order on', href: edit('order-on') },
    isFilled: (e) => (e.orderLinks?.length ?? 0) > 0,
  },
  {
    // The stores that carry the business's products (part D), edited on the
    // "Where to find us" tab.
    id: 'find-us',
    label: 'Find us at',
    templates: ALL,
    gate: { flag: 'orderWhereSold' },
    editor: { tool: 'Where to find us', href: edit('where-sold') },
    isFilled: (e) => (e.findUsAt?.length ?? 0) > 0,
  },
  {
    // Main's Deals section (part G, #328): Premium, behind the coupons flag,
    // edited in the Deals card on the edit page's Services tab.
    id: 'deals',
    label: 'Deals',
    templates: ALL,
    gate: { feature: 'coupons', flag: 'coupons' },
    editor: { tool: 'Deals', href: edit('deals') },
    isFilled: (e) => (e.deals?.length ?? 0) > 0,
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
    // Nested in At a Glance. Part of the basic page: live listings already
    // carry lat/lng, so ticket 190 turns it on for them; until then it renders
    // in example mode only.
    id: 'map',
    label: 'Location map',
    templates: ALL,
    gate: {},
    editor: { tool: 'Contact & hours', href: edit('contact') },
    isFilled: (e) => e.details.lat != null && e.details.lng != null,
  },
  {
    // Nested in At a Glance. Hours are basic at every tier (ticket 196).
    id: 'hours-overrides',
    label: 'Special hours',
    templates: ALL,
    gate: {},
    editor: { tool: 'Contact & hours', href: edit('hours') },
    isFilled: (e) => (e.hoursOverrides?.length ?? 0) > 0,
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
    // "Why choose us" bullets or "How it works" steps. Ticket 195 decides the
    // tier and builds the editor; free and page('highlights') until then.
    id: 'highlights',
    label: 'Highlights',
    templates: ALL,
    gate: {},
    editor: { tool: 'Highlights', href: page('highlights') },
    isFilled: (e) => (e.highlights?.length ?? 0) > 0,
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
    // Nested in the Offerings / Services / Capabilities heading: the menu,
    // rate card or commission guide PDF. Ticket 194 decides the tier and the
    // upload role; free until then.
    id: 'documents',
    label: 'Documents',
    templates: ALL,
    gate: {},
    editor: { tool: 'Media', href: page('media') },
    isFilled: (e) => (e.documents?.length ?? 0) > 0,
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
    // Nested in the gallery: the chip row over the grid, shown when photos
    // are filed under two or more albums. Ticket 193 adds the column and the
    // Growth+ gate; the live loader sets no album until then.
    id: 'albums',
    label: 'Photo albums',
    templates: ALL,
    gate: {},
    editor: { tool: 'Photos', href: page('media') },
    isFilled: (e) => galleryAlbums(e.images).length >= 2,
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
    // Licences, certifications, awards and press — the trust the business
    // brings with it. Ticket 192 decides the tier; free until then.
    id: 'credentials',
    label: 'Credentials & press',
    templates: ALL,
    gate: {},
    editor: { tool: 'Credentials', href: page('credentials') },
    isFilled: (e) => (e.credentials?.length ?? 0) > 0,
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
 * Existing sections kept where they were (deals where main's #328 put it);
 * the new ones (locations, team, shop, booking, logo) sit where the plan for ticket 184 put them.
 * The professional and creative templates render trust inside the two-column
 * body as an aside rather than as a section, so it is not in their lists.
 */
export const TEMPLATE_SECTION_ORDER: Record<TemplateKey, readonly SectionId[]> = {
  storefront: [
    'hero',
    'info-rail',
    'at-a-glance',
    'order-on',
    'find-us',
    'deals',
    'locations',
    'links',
    'story',
    'highlights',
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
    'credentials',
    'trust',
    'community',
    'activity',
    'related',
  ],
  professional: [
    'hero',
    'info-rail',
    'at-a-glance',
    'order-on',
    'find-us',
    'deals',
    'locations',
    'services',
    'highlights',
    'booking',
    'story',
    'team',
    'portfolio',
    'shop',
    'attributes',
    'links',
    'credentials',
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
    'at-a-glance',
    'order-on',
    'find-us',
    'deals',
    'locations',
    'portfolio',
    'capabilities',
    'highlights',
    'booking',
    'shop',
    'story',
    'team',
    'attributes',
    'links',
    'credentials',
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
    orderLinks: allowed('order-on') ? entity.orderLinks : undefined,
    findUsAt: allowed('find-us') ? entity.findUsAt : undefined,
    deals: allowed('deals') ? sliceTo(entity.deals, DEALS_ON_MAX) : undefined,
    booking: allowed('booking') ? entity.booking : undefined,
    locations: allowed('locations')
      ? sliceTo(entity.locations, limits.locations === null ? null : limits.locations - 1)
      : undefined,
    shop: allowed('shop') ? entity.shop : undefined,
    hiring: allowed('hiring') ? entity.hiring : undefined,
    happeningNow: allowed('happening-now')
      ? sliceTo(entity.happeningNow, limits.activePosts)
      : undefined,
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
