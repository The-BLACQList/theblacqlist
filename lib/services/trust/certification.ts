import type { SupabaseClient } from '@supabase/supabase-js'

// Auto-certification rule — founder decisions 009 (2026-08-06), 031 and 032
// (both 2026-08-22).
//
// A Verified listing is promoted to Certified once it has sustained community
// proof AND presents a complete, contactable page. Certified is the top trust
// tier; promotion is one-way and only ever from 'verified' (never skips
// Claimed → Certified). Demotion is a manual admin act — there is no automated
// revocation path, which is why the bar has to be right on the way up.
//
// The six criteria:
//   1. trust_tier = 'verified'
//   2. status = 'published' and not soft-deleted
//   3. >= CERTIFICATION_MIN_REVIEWS published reviews
//   4. average published rating >= CERTIFICATION_MIN_AVG_RATING
//   5. >= CERTIFICATION_MIN_TENURE_DAYS since the earliest approved claim
//   6. business details complete (see isBusinessDetailComplete)
//
// ⚠ TWIN: `auto_grant_certified()` in
// supabase/migrations/20260822000000_certification_rule_alignment.sql implements
// this same rule in SQL as a nightly safety net, because this function is only
// reached when an admin publishes a review (lib/actions/admin/moderateReview.ts).
// A listing that hits 5 reviews on day 40 and never receives a sixth would
// otherwise never be re-evaluated on day 90. The two must be changed together —
// they disagreed for three months before decision 031 and reached opposite
// verdicts on the same listing.
export const CERTIFICATION_MIN_REVIEWS = 5
export const CERTIFICATION_MIN_AVG_RATING = 3.5
export const CERTIFICATION_MIN_TENURE_DAYS = 90

// The subset of `listing_details_business` the rule reads. `null` means the
// listing has no business-details row at all — events and jobs write to their
// own details tables, so they are structurally uncertifiable. That restriction
// was inherited from an INNER JOIN in the original SQL rather than decided;
// it is deliberate as of decision 032 (a 30-day job posting cannot accumulate
// 90 days of tenure anyway).
export type BusinessDetails = {
  description: string | null
  phone: string | null
  email: string | null
  websiteUrl: string | null
  addressLine1: string | null
  cityText: string | null
  state: string | null
} | null

export type CertificationInput = {
  trustTier: string
  status: string
  deletedAt: string | null
  publishedReviewCount: number
  avgRating: number | null
  claimApprovedAt: string | null
  details: BusinessDetails
  now?: Date
}

export type CertificationVerdict =
  | { eligible: true }
  | {
      eligible: false
      reason:
        | 'not_verified'
        | 'not_published'
        | 'insufficient_reviews'
        | 'insufficient_rating'
        | 'no_approved_claim'
        | 'insufficient_tenure'
        | 'details_incomplete'
    }

const present = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.trim() !== ''

// A certified badge must not point at a page with no description or no way to
// reach the business. Mirrors the nullif(btrim(x), '') checks in the SQL twin.
export function isBusinessDetailComplete(details: BusinessDetails): boolean {
  if (!details) return false
  return (
    present(details.description) &&
    (present(details.phone) || present(details.email)) &&
    (present(details.websiteUrl) || present(details.addressLine1)) &&
    present(details.cityText) &&
    present(details.state)
  )
}

// Pure rule — unit-tested directly.
export function evaluateCertification({
  trustTier,
  status,
  deletedAt,
  publishedReviewCount,
  avgRating,
  claimApprovedAt,
  details,
  now = new Date(),
}: CertificationInput): CertificationVerdict {
  if (trustTier !== 'verified') return { eligible: false, reason: 'not_verified' }
  if (status !== 'published' || deletedAt !== null) {
    return { eligible: false, reason: 'not_published' }
  }
  if (publishedReviewCount < CERTIFICATION_MIN_REVIEWS) {
    return { eligible: false, reason: 'insufficient_reviews' }
  }
  // A null average with enough reviews should be impossible (the count trigger
  // maintains both columns over the same population) — fail closed if it happens.
  if (avgRating === null || avgRating < CERTIFICATION_MIN_AVG_RATING) {
    return { eligible: false, reason: 'insufficient_rating' }
  }
  if (!claimApprovedAt) return { eligible: false, reason: 'no_approved_claim' }
  const tenureDays = (now.getTime() - new Date(claimApprovedAt).getTime()) / 86_400_000
  if (tenureDays < CERTIFICATION_MIN_TENURE_DAYS) {
    return { eligible: false, reason: 'insufficient_tenure' }
  }
  if (!isBusinessDetailComplete(details)) {
    return { eligible: false, reason: 'details_incomplete' }
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
    // `review_count` and `avg_rating` are denormalized on `listings` and
    // trigger-maintained over published reviews only
    // (20260630000000_fix_count_triggers_security_definer.sql). Reading them
    // here rather than re-aggregating is what lets this path and the SQL twin
    // provably agree. The trigger is AFTER-and-RETURN NULL, so it has already
    // committed by the time moderateReview.ts calls us.
    const { data: listing } = await serviceClient
      .from('listings')
      .select('trust_tier, status, deleted_at, review_count, avg_rating')
      .eq('id', listingId)
      .maybeSingle()
    if (!listing || listing.trust_tier !== 'verified') return { promoted: false }

    const { data: claim } = await serviceClient
      .from('claims')
      .select('reviewed_at')
      .eq('listing_id', listingId)
      .eq('status', 'approved')
      .order('reviewed_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const { data: detailRow } = await serviceClient
      .from('listing_details_business')
      .select('description, phone, email, website_url, address_line_1, city_text, state')
      .eq('listing_id', listingId)
      .maybeSingle()

    const verdict = evaluateCertification({
      trustTier: listing.trust_tier,
      status: listing.status ?? '',
      deletedAt: listing.deleted_at ?? null,
      publishedReviewCount: listing.review_count ?? 0,
      // numeric(3,2) arrives as a string from PostgREST in some client versions.
      avgRating: listing.avg_rating === null || listing.avg_rating === undefined
        ? null
        : Number(listing.avg_rating),
      claimApprovedAt: claim?.reviewed_at ?? null,
      details: detailRow
        ? {
            description: detailRow.description ?? null,
            phone: detailRow.phone ?? null,
            email: detailRow.email ?? null,
            websiteUrl: detailRow.website_url ?? null,
            addressLine1: detailRow.address_line_1 ?? null,
            cityText: detailRow.city_text ?? null,
            state: detailRow.state ?? null,
          }
        : null,
    })
    if (!verdict.eligible) return { promoted: false }

    const { error } = await serviceClient
      .from('listings')
      .update({
        trust_tier: 'certified',
        // entity-content-model.md:129 — the presence of this timestamp is how
        // an auto-grant is distinguished from an admin grant. The SQL path
        // always set it; this path did not, which made the distinction wrong
        // for every listing promoted after a review.
        certification_auto_granted_at: new Date().toISOString(),
      })
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
