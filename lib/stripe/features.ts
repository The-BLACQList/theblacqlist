export type GatedFeature = 'analytics' | 'ai_suggestions' | 'priority_placement'

// Tier order for comparison: 0=free, 1=standard, 2=premium
const TIER_RANK: Record<string, number> = {
  free: 0,
  standard: 1,
  premium: 2,
}

const FEATURE_MIN_TIER: Record<GatedFeature, number> = {
  analytics: 1, // standard+
  ai_suggestions: 1, // standard+
  priority_placement: 2, // premium only
}

export function canAccess(tier: string | null, feature: GatedFeature): boolean {
  const rank = TIER_RANK[tier ?? 'free'] ?? 0
  return rank >= FEATURE_MIN_TIER[feature]
}
