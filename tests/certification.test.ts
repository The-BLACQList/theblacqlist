import { describe, expect, it } from 'vitest'
import {
  CERTIFICATION_MIN_REVIEWS,
  CERTIFICATION_MIN_TENURE_DAYS,
  evaluateCertification,
} from '@/lib/services/trust/certification'

const NOW = new Date('2026-08-06T12:00:00Z')

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString()
}

describe('evaluateCertification', () => {
  it('promotes a verified listing meeting both thresholds', () => {
    const verdict = evaluateCertification({
      trustTier: 'verified',
      publishedReviewCount: CERTIFICATION_MIN_REVIEWS,
      claimApprovedAt: daysAgo(CERTIFICATION_MIN_TENURE_DAYS),
      now: NOW,
    })
    expect(verdict).toEqual({ eligible: true })
  })

  it.each(['unclaimed', 'claimed', 'certified'])(
    'never promotes from trust tier %s',
    (trustTier) => {
      const verdict = evaluateCertification({
        trustTier,
        publishedReviewCount: 100,
        claimApprovedAt: daysAgo(365),
        now: NOW,
      })
      expect(verdict).toEqual({ eligible: false, reason: 'not_verified' })
    }
  )

  it('rejects one review short of the threshold', () => {
    const verdict = evaluateCertification({
      trustTier: 'verified',
      publishedReviewCount: CERTIFICATION_MIN_REVIEWS - 1,
      claimApprovedAt: daysAgo(365),
      now: NOW,
    })
    expect(verdict).toEqual({ eligible: false, reason: 'insufficient_reviews' })
  })

  it('rejects one day short of the tenure threshold', () => {
    const verdict = evaluateCertification({
      trustTier: 'verified',
      publishedReviewCount: CERTIFICATION_MIN_REVIEWS,
      claimApprovedAt: daysAgo(CERTIFICATION_MIN_TENURE_DAYS - 1),
      now: NOW,
    })
    expect(verdict).toEqual({ eligible: false, reason: 'insufficient_tenure' })
  })

  it('rejects when no approved claim date exists', () => {
    const verdict = evaluateCertification({
      trustTier: 'verified',
      publishedReviewCount: CERTIFICATION_MIN_REVIEWS,
      claimApprovedAt: null,
      now: NOW,
    })
    expect(verdict).toEqual({ eligible: false, reason: 'no_approved_claim' })
  })

  it('checks reviews before tenure so the reason reflects the nearer gap', () => {
    const verdict = evaluateCertification({
      trustTier: 'verified',
      publishedReviewCount: 0,
      claimApprovedAt: null,
      now: NOW,
    })
    expect(verdict).toEqual({ eligible: false, reason: 'insufficient_reviews' })
  })
})
