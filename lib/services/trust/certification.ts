import type { SupabaseClient } from '@supabase/supabase-js'

// Auto-certification rule — founder decision 2026-08-06:
// a Verified listing is promoted to Certified once it has sustained community
// proof: at least CERTIFICATION_MIN_REVIEWS published reviews AND at least
// CERTIFICATION_MIN_TENURE_DAYS since its claim was approved.
// Certified is the top trust tier; promotion is one-way and only ever from
// 'verified' (never skips Claimed → Certified). Demotion is a manual admin act.
export const CERTIFICATION_MIN_REVIEWS = 5
export const CERTIFICATION_MIN_TENURE_DAYS = 90

export type CertificationInput = {
  trustTier: string
  publishedReviewCount: number
  claimApprovedAt: string | null
  now?: Date
}

export type CertificationVerdict =
  | { eligible: true }
  | { eligible: false; reason: 'not_verified' | 'insufficient_reviews' | 'insufficient_tenure' | 'no_approved_claim' }

// Pure rule — unit-tested directly.
export function evaluateCertification({
  trustTier,
  publishedReviewCount,
  claimApprovedAt,
  now = new Date(),
}: CertificationInput): CertificationVerdict {
  if (trustTier !== 'verified') return { eligible: false, reason: 'not_verified' }
  if (publishedReviewCount < CERTIFICATION_MIN_REVIEWS) {
    return { eligible: false, reason: 'insufficient_reviews' }
  }
  if (!claimApprovedAt) return { eligible: false, reason: 'no_approved_claim' }
  const tenureDays = (now.getTime() - new Date(claimApprovedAt).getTime()) / 86_400_000
  if (tenureDays < CERTIFICATION_MIN_TENURE_DAYS) {
    return { eligible: false, reason: 'insufficient_tenure' }
  }
  return { eligible: true }
}

// Checks the rule against live data and promotes the listing when it passes.
// Called after a review is published; failures are logged, never thrown — a
// certification hiccup must not break review moderation.
export async function maybePromoteToCertified(
  serviceClient: SupabaseClient,
  listingId: string
): Promise<{ promoted: boolean }> {
  try {
    const { data: listing } = await serviceClient
      .from('listings')
      .select('trust_tier')
      .eq('id', listingId)
      .maybeSingle()
    if (!listing || listing.trust_tier !== 'verified') return { promoted: false }

    const { count } = await serviceClient
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listingId)
      .eq('status', 'published')

    const { data: claim } = await serviceClient
      .from('claims')
      .select('reviewed_at')
      .eq('listing_id', listingId)
      .eq('status', 'approved')
      .order('reviewed_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const verdict = evaluateCertification({
      trustTier: listing.trust_tier,
      publishedReviewCount: count ?? 0,
      claimApprovedAt: claim?.reviewed_at ?? null,
    })
    if (!verdict.eligible) return { promoted: false }

    const { error } = await serviceClient
      .from('listings')
      .update({ trust_tier: 'certified' })
      .eq('id', listingId)
      .eq('trust_tier', 'verified') // guard against races — promote only from verified
    if (error) {
      console.error('[certification] promotion failed:', listingId, error.message)
      return { promoted: false }
    }
    return { promoted: true }
  } catch (err) {
    console.error('[certification] check failed:', listingId, err)
    return { promoted: false }
  }
}
