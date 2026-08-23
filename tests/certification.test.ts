import { describe, expect, it } from 'vitest'
import {
  CERTIFICATION_MIN_AVG_RATING,
  CERTIFICATION_MIN_REVIEWS,
  CERTIFICATION_MIN_TENURE_DAYS,
  evaluateCertification,
  isBusinessDetailComplete,
  type BusinessDetails,
  type CertificationInput,
} from '@/lib/services/trust/certification'

const NOW = new Date('2026-08-06T12:00:00Z')

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString()
}

const COMPLETE_DETAILS: NonNullable<BusinessDetails> = {
  description: 'A neighborhood bakery.',
  phone: '555-0100',
  email: null,
  websiteUrl: 'https://example.com',
  addressLine1: null,
  cityText: 'Atlanta',
  state: 'GA',
}

// The minimum passing case. Every test below states only what it changes, so a
// future criterion added to CertificationInput breaks compilation here once
// rather than in every test.
function input(overrides: Partial<CertificationInput> = {}): CertificationInput {
  return {
    trustTier: 'verified',
    status: 'published',
    deletedAt: null,
    publishedReviewCount: CERTIFICATION_MIN_REVIEWS,
    avgRating: CERTIFICATION_MIN_AVG_RATING,
    claimApprovedAt: daysAgo(CERTIFICATION_MIN_TENURE_DAYS),
    details: COMPLETE_DETAILS,
    now: NOW,
    ...overrides,
  }
}

describe('evaluateCertification', () => {
  it('promotes a verified listing meeting every threshold', () => {
    expect(evaluateCertification(input())).toEqual({ eligible: true })
  })

  it.each(['unclaimed', 'claimed', 'certified'])(
    'never promotes from trust tier %s',
    (trustTier) => {
      const verdict = evaluateCertification(
        input({ trustTier, publishedReviewCount: 100, avgRating: 5, claimApprovedAt: daysAgo(365) })
      )
      expect(verdict).toEqual({ eligible: false, reason: 'not_verified' })
    }
  )

  it('rejects one review short of the threshold', () => {
    const verdict = evaluateCertification(
      input({ publishedReviewCount: CERTIFICATION_MIN_REVIEWS - 1, claimApprovedAt: daysAgo(365) })
    )
    expect(verdict).toEqual({ eligible: false, reason: 'insufficient_reviews' })
  })

  it('rejects one day short of the tenure threshold', () => {
    const verdict = evaluateCertification(
      input({ claimApprovedAt: daysAgo(CERTIFICATION_MIN_TENURE_DAYS - 1) })
    )
    expect(verdict).toEqual({ eligible: false, reason: 'insufficient_tenure' })
  })

  it('rejects when no approved claim date exists', () => {
    expect(evaluateCertification(input({ claimApprovedAt: null }))).toEqual({
      eligible: false,
      reason: 'no_approved_claim',
    })
  })

  it('checks reviews before tenure so the reason reflects the nearer gap', () => {
    const verdict = evaluateCertification(
      input({ publishedReviewCount: 0, avgRating: null, claimApprovedAt: null })
    )
    expect(verdict).toEqual({ eligible: false, reason: 'insufficient_reviews' })
  })

  // ─── Rating floor — decision 031, 2026-08-22 ───────────────────────────────
  // Decision 009 recorded no floor, so five one-star reviews plus 90 days would
  // have earned the top trust badge with no automated way to take it back.

  it('rejects an average rating below the floor', () => {
    expect(evaluateCertification(input({ avgRating: CERTIFICATION_MIN_AVG_RATING - 0.1 }))).toEqual({
      eligible: false,
      reason: 'insufficient_rating',
    })
  })

  it('rejects five one-star reviews outright', () => {
    expect(evaluateCertification(input({ avgRating: 1 }))).toEqual({
      eligible: false,
      reason: 'insufficient_rating',
    })
  })

  it('admits a listing exactly at the rating floor', () => {
    expect(evaluateCertification(input({ avgRating: CERTIFICATION_MIN_AVG_RATING }))).toEqual({
      eligible: true,
    })
  })

  it('fails closed when the average is missing despite enough reviews', () => {
    expect(evaluateCertification(input({ avgRating: null }))).toEqual({
      eligible: false,
      reason: 'insufficient_rating',
    })
  })

  it('checks the rating before the claim so a bad listing is not gated on tenure', () => {
    expect(evaluateCertification(input({ avgRating: 2, claimApprovedAt: null }))).toEqual({
      eligible: false,
      reason: 'insufficient_rating',
    })
  })

  // ─── Publication state ─────────────────────────────────────────────────────

  // The full non-published half of the listings.status CHECK constraint
  // (20260510000000_initial_blacqlist_mvp_schema.sql:287). 'flagged' matters
  // most: a listing under a flag must not collect the top trust badge.
  it.each(['draft', 'pending', 'unpublished', 'flagged', 'archived'])(
    'never promotes a listing in status %s',
    (status) => {
      expect(evaluateCertification(input({ status }))).toEqual({
        eligible: false,
        reason: 'not_published',
      })
    }
  )

  it('never promotes a soft-deleted listing', () => {
    expect(evaluateCertification(input({ deletedAt: daysAgo(1) }))).toEqual({
      eligible: false,
      reason: 'not_published',
    })
  })

  // ─── Business details completeness ─────────────────────────────────────────

  it('rejects a listing with no business details row at all', () => {
    // Events and jobs write to their own details tables, so this is also what
    // keeps them structurally uncertifiable — matching the INNER JOIN in the
    // SQL twin.
    expect(evaluateCertification(input({ details: null }))).toEqual({
      eligible: false,
      reason: 'details_incomplete',
    })
  })

  it('rejects a blank description', () => {
    expect(
      evaluateCertification(input({ details: { ...COMPLETE_DETAILS, description: null } }))
    ).toEqual({ eligible: false, reason: 'details_incomplete' })
  })

  it('rejects a whitespace-only description', () => {
    expect(
      evaluateCertification(input({ details: { ...COMPLETE_DETAILS, description: '   ' } }))
    ).toEqual({ eligible: false, reason: 'details_incomplete' })
  })

  it('rejects when neither phone nor email is present', () => {
    expect(
      evaluateCertification(
        input({ details: { ...COMPLETE_DETAILS, phone: null, email: null } })
      )
    ).toEqual({ eligible: false, reason: 'details_incomplete' })
  })

  it('rejects when neither website nor street address is present', () => {
    expect(
      evaluateCertification(
        input({ details: { ...COMPLETE_DETAILS, websiteUrl: null, addressLine1: null } })
      )
    ).toEqual({ eligible: false, reason: 'details_incomplete' })
  })

  it.each(['cityText', 'state'] as const)('rejects a missing %s', (field) => {
    expect(
      evaluateCertification(input({ details: { ...COMPLETE_DETAILS, [field]: null } }))
    ).toEqual({ eligible: false, reason: 'details_incomplete' })
  })

  it('checks details last so a complete-but-unqualified listing reports the real gap', () => {
    const verdict = evaluateCertification(
      input({ publishedReviewCount: 0, avgRating: null, details: null })
    )
    expect(verdict).toEqual({ eligible: false, reason: 'insufficient_reviews' })
  })
})

describe('isBusinessDetailComplete', () => {
  it('accepts the complete fixture', () => {
    expect(isBusinessDetailComplete(COMPLETE_DETAILS)).toBe(true)
  })

  it('rejects null details', () => {
    expect(isBusinessDetailComplete(null)).toBe(false)
  })

  it('accepts email in place of phone', () => {
    expect(
      isBusinessDetailComplete({ ...COMPLETE_DETAILS, phone: null, email: 'hi@example.com' })
    ).toBe(true)
  })

  it('accepts a street address in place of a website', () => {
    expect(
      isBusinessDetailComplete({
        ...COMPLETE_DETAILS,
        websiteUrl: null,
        addressLine1: '123 Auburn Ave',
      })
    ).toBe(true)
  })

  it('treats whitespace-only values as absent, matching nullif(btrim(x), \'\') in SQL', () => {
    expect(
      isBusinessDetailComplete({ ...COMPLETE_DETAILS, phone: '  ', email: '\t' })
    ).toBe(false)
  })
})
