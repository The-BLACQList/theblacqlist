import type { PlanSlug } from '@/lib/stripe/plans'

export type GatedFeature =
  | 'analytics'
  | 'ai_suggestions'
  | 'priority_placement'
  | 'review_response'

// Tier order for comparison: 0=free, 1=starter, 2=growth, 3=premium
const TIER_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  premium: 3,
}

// Per the monetization spec's tier matrix, every currently-built gated feature
// unlocks at the first paid tier (Starter+). Growth/Premium add features that
// are not yet built (featured placement, sponsored spotlight, etc.).
const FEATURE_MIN_TIER: Record<GatedFeature, number> = {
  analytics: 1, // Starter+
  ai_suggestions: 1, // Starter+
  priority_placement: 1, // Starter+
  review_response: 1, // Starter+
}

export function canAccess(tier: string | null, feature: GatedFeature): boolean {
  const rank = TIER_RANK[tier ?? 'free'] ?? 0
  return rank >= FEATURE_MIN_TIER[feature]
}

// Maximum gallery photos per tier. Premium is a generous hard cap (reads as
// "unlimited" to owners) that bounds storage/egress cost — the one real
// per-listing cost tail. null would mean truly uncapped.
export const PHOTO_LIMITS: Record<PlanSlug, number | null> = {
  free: 1,
  starter: 10,
  growth: 20,
  premium: 50,
}

// Returns the photo cap for a tier (defaults to the free cap for unknown tiers).
export function photoLimit(tier: string | null): number | null {
  if (tier === 'starter') return PHOTO_LIMITS.starter
  if (tier === 'growth') return PHOTO_LIMITS.growth
  if (tier === 'premium') return PHOTO_LIMITS.premium
  return PHOTO_LIMITS.free
}
