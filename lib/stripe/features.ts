import type { PlanSlug } from '@/lib/stripe/plans'

// Tier entitlements — the single source of truth for what each plan unlocks.
//
// Two mechanisms, mirroring how directory platforms (e.g. MyListing) package listings:
//   1. Boolean feature gates  — `canAccess(tier, feature)`  → is this block available at all?
//   2. Numeric field limits   — `TIER_LIMITS[tier]`         → how much of it can they use?
//
// Together these are what make Growth and Premium worth their price. Before 2026-07-27 every gated
// feature unlocked at Starter, which left Growth's only real advantage over Starter as a higher
// photo cap — a $30/mo difference for 10 photos that nobody upgrades for. See
// `docs/blacqlist/monetization/time-to-1m-and-ai-margin-review.md` Part 3.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS DELIBERATELY *NOT* HERE: the Certified Black-Owned badge.
//
// Ownership labels (Black-Owned / Certified Black-Owned / Ally) are never purchasable. Every tier is
// sold to every label at the same price, and certification stays *earned* — verified + published +
// 5 published reviews + 3.5 average + 90 days since claim approval + complete business details — at
// every tier including Free. The rule lives in `lib/services/trust/certification.ts` and its SQL twin
// `20260822000000_certification_rule_alignment.sql`, not here; this comment previously quoted the
// superseded V1 criteria (6 reviews / 4.0 / 90 days "active"), corrected 2026-08-22.
// `certified` must never become a `GatedFeature`; a badge that can be bought is not a trust signal,
// and the flow-map moat is built on that signal being credible.
//
// `verified_badge` below IS tier-gated, and that is a different thing: paying gates the identity
// *attestation check*, not its outcome or any ownership claim.
// ─────────────────────────────────────────────────────────────────────────────

export type GatedFeature =
  // ── Starter+ — "Look legitimate": the credibility tier
  | 'analytics'
  | 'ai_suggestions'
  | 'review_response'
  | 'verified_badge'
  | 'listing_video'
  | 'faqs'
  | 'social_links'
  | 'hide_platform_badge'
  // ── Growth+ — "Get chosen": the merchandising tier
  | 'priority_placement'
  | 'review_criteria'
  | 'storefront'
  | 'service_menu_pricing'
  | 'events'
  | 'team_members'
  | 'featured_collection'
  | 'editorial_eligibility'
  | 'analytics_advanced'
  | 'priority_support'
  // ── Premium — "Own the category": the growth-engine tier
  | 'coupons'
  | 'booking_requests'
  | 'multi_location'
  | 'homepage_featured'
  | 'category_exclusivity'
  | 'spend_impact_panel'
  | 'sonnet_agents'
  | 'dedicated_support'

// Tier order for comparison: 0=free, 1=starter, 2=growth, 3=premium.
// Exported so callers that need to *compare* two tiers (rather than test one
// against a feature) use this ordering instead of re-declaring their own — a
// second copy of it drifting is how a paid tier silently stops outranking a free
// one.
export const TIER_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  premium: 3,
}

const FEATURE_MIN_TIER: Record<GatedFeature, number> = {
  // Starter+ (1)
  analytics: 1,
  ai_suggestions: 1,
  review_response: 1,
  verified_badge: 1,
  listing_video: 1,
  faqs: 1,
  social_links: 1,
  hide_platform_badge: 1,
  // Growth+ (2)
  priority_placement: 2,
  review_criteria: 2,
  storefront: 2,
  service_menu_pricing: 2,
  events: 2,
  team_members: 2,
  featured_collection: 2,
  editorial_eligibility: 2,
  analytics_advanced: 2,
  priority_support: 2,
  // Premium (3)
  coupons: 3,
  booking_requests: 3,
  multi_location: 3,
  homepage_featured: 3,
  category_exclusivity: 3,
  spend_impact_panel: 3,
  sonnet_agents: 3,
  dedicated_support: 3,
}

export function canAccess(tier: string | null, feature: GatedFeature): boolean {
  const rank = TIER_RANK[tier ?? 'free'] ?? 0
  return rank >= FEATURE_MIN_TIER[feature]
}

// Numeric per-field limits. `null` means unlimited — callers must branch on null before comparing
// (see `app/api/media/upload/route.ts` for the established pattern).
//
// Premium is "unlimited" in customer-facing copy but carries generous hard caps on the two drivers
// with real marginal cost — photos (storage/egress) and AI generations (LLM spend). Everything else
// is metadata and genuinely free to uncap.
export interface TierLimits {
  /** Gallery photos. The main storage/egress cost tail. */
  photos: number | null
  /** Embedded videos on the listing page. */
  videos: number | null
  /** FAQ / accordion entries. */
  faqs: number | null
  /** Attribute + tag selections (MyListing-style term limits). */
  attributes: number | null
  /** Marketplace products + services combined. */
  products: number | null
  /** Concurrently active events. */
  events: number | null
  /**
   * Included job postings per rolling 30 days — NOT a cap on jobs.
   * Postings beyond this are purchasable at every tier, including free, so this
   * is an allowance rather than a gate. That is why `jobs` has no `GatedFeature`
   * counterpart: nothing about jobs is tier-locked, only tier-discounted.
   * A posting consumes one slot for 30 days and then the slot refills.
   */
  jobs: number | null
  /** Team members shown on the listing. */
  teamMembers: number | null
  /** Locations (listings) under one owner account. */
  locations: number | null
  /** Successful AI generations per listing per 30 days. Enforced by ticket 104. */
  aiGenerationsPerMonth: number | null
  /** Listing description cap. Free is short on purpose — it is the upgrade prompt. */
  descriptionChars: number | null
  /** How far back the owner analytics dashboard can look. 0 = no analytics. */
  analyticsHistoryDays: number
}

export const TIER_LIMITS: Record<PlanSlug, TierLimits> = {
  free: {
    photos: 1,
    videos: 0,
    faqs: 0,
    attributes: 3,
    products: 0,
    events: 0,
    jobs: 0,
    teamMembers: 0,
    locations: 1,
    aiGenerationsPerMonth: 0,
    descriptionChars: 300,
    analyticsHistoryDays: 0,
  },
  starter: {
    photos: 10,
    videos: 1,
    faqs: 5,
    attributes: 10,
    products: 0,
    events: 0,
    jobs: 0,
    teamMembers: 0,
    locations: 1,
    aiGenerationsPerMonth: 10,
    descriptionChars: null,
    analyticsHistoryDays: 30,
  },
  growth: {
    photos: 25,
    videos: 3,
    faqs: null,
    attributes: null,
    products: 25,
    events: 3,
    jobs: 1,
    teamMembers: 5,
    locations: 1,
    aiGenerationsPerMonth: 100,
    descriptionChars: null,
    analyticsHistoryDays: 365,
  },
  premium: {
    photos: 50,
    videos: null,
    faqs: null,
    attributes: null,
    products: null,
    events: null,
    // Deliberately a number, not `null`, on the tier where everything else is
    // uncapped: a job posting carries real marginal cost (it is the thing being
    // sold), so Premium gets a larger allowance, not an unlimited one. Postings
    // past 3 are purchasable like anyone else's.
    jobs: 3,
    teamMembers: null,
    locations: 3,
    aiGenerationsPerMonth: 500,
    descriptionChars: null,
    analyticsHistoryDays: 365,
  },
}

// Resolves a tier string (possibly null or unrecognized, e.g. a lapsed subscription) to its limits.
// Unknown tiers fall back to free — fail closed, never open.
export function limitsFor(tier: string | null): TierLimits {
  if (tier === 'starter') return TIER_LIMITS.starter
  if (tier === 'growth') return TIER_LIMITS.growth
  if (tier === 'premium') return TIER_LIMITS.premium
  return TIER_LIMITS.free
}

// Maximum gallery photos per tier. Kept as a named export for existing callers.
export const PHOTO_LIMITS: Record<PlanSlug, number | null> = {
  free: TIER_LIMITS.free.photos,
  starter: TIER_LIMITS.starter.photos,
  growth: TIER_LIMITS.growth.photos,
  premium: TIER_LIMITS.premium.photos,
}

// Named accessors. Thin wrappers over `limitsFor`, kept because they read better at call sites and
// because `photoLimit` predates the limits map — its signature must not change.
export function photoLimit(tier: string | null): number | null {
  return limitsFor(tier).photos
}

export function videoLimit(tier: string | null): number | null {
  return limitsFor(tier).videos
}

export function faqLimit(tier: string | null): number | null {
  return limitsFor(tier).faqs
}

export function attributeLimit(tier: string | null): number | null {
  return limitsFor(tier).attributes
}

export function productLimit(tier: string | null): number | null {
  return limitsFor(tier).products
}

export function eventLimit(tier: string | null): number | null {
  return limitsFor(tier).events
}

// Included job postings per rolling 30 days. See `TierLimits.jobs` — this is an
// allowance, not a cap; `lib/stripe/jobPostings.ts` sells anything beyond it.
export function jobLimit(tier: string | null): number | null {
  return limitsFor(tier).jobs
}

export function teamMemberLimit(tier: string | null): number | null {
  return limitsFor(tier).teamMembers
}

export function locationLimit(tier: string | null): number | null {
  return limitsFor(tier).locations
}

export function descriptionCharLimit(tier: string | null): number | null {
  return limitsFor(tier).descriptionChars
}

export function analyticsHistoryDays(tier: string | null): number {
  return limitsFor(tier).analyticsHistoryDays
}

// Monthly AI generation quota per listing. Ticket 104's limiter reads this rather than a hardcoded
// constant, so the cost guardrail and the pricing lever can never drift apart.
export function aiQuota(tier: string | null): number | null {
  return limitsFor(tier).aiGenerationsPerMonth
}

// True when `count` is already at or over the tier's limit for that field. Centralizes the
// null-means-unlimited branch so each call site does not re-derive it.
export function isAtLimit(
  tier: string | null,
  key: keyof Omit<TierLimits, 'analyticsHistoryDays'>,
  count: number
): boolean {
  const limit = limitsFor(tier)[key]
  if (limit === null) return false
  return count >= limit
}
