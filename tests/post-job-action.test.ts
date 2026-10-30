import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  business: null as null | Record<string, unknown>,
  createJobDraft: vi.fn(),
  submitJobForReview: vi.fn(),
  user: { id: 'u1', email: 'o@example.com' } as { id: string; email: string } | null,
  rate: true,
  flag: true,
  listingReads: 0,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'is', 'not']) chain[m] = () => chain
      chain.maybeSingle = async () => {
        if (table === 'listings') {
          // First read is the hiring business; the second is the freshly created draft.
          h.listingReads += 1
          if (h.listingReads === 1) return { data: h.business, error: null }
          return { data: { id: 'draft-1', name: 'Line Cook', created_at: '2026-11-01T00:00:00Z' }, error: null }
        }
        if (table === 'categories') return { data: { id: 'c1', slug: 'food', parent_id: null }, error: null }
        return { data: null, error: null }
      }
      return chain
    },
  }),
}))
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: async () => h.rate }))
vi.mock('@/lib/env', () => ({ isFeatureEnabled: () => h.flag }))
vi.mock('@/lib/listings/levelRows', () => ({ loadCategoryLevels: async () => null }))
vi.mock('@/lib/services/listings/createJobDraft', () => ({ createJobDraft: h.createJobDraft }))
vi.mock('@/lib/services/listings/submitJobForReview', () => ({ submitJobForReview: h.submitJobForReview }))

import { postJobAction } from '@/lib/actions/listings/postJob'
import { EMPTY_POST_JOB } from '@/lib/validations/postJob'

const ATTEMPT = '11111111-1111-4111-8111-111111111111'
const BIZ = '3f0c2a9e-6a41-4b86-9d0e-1f2a3b4c5d6e'
const CAT = '7b1d2c3e-4f50-4a61-8b72-93a4b5c6d7e8'

const values = {
  ...EMPTY_POST_JOB,
  hiringListingId: BIZ,
  name: 'Line Cook',
  tagline: 'Hot line, fast kitchen, good team',
  categoryId: CAT,
  employmentType: 'full-time',
  salaryMin: '18',
  salaryMax: '22',
  salaryPeriod: 'hour',
  applyEmail: 'hiring@example.com',
  description: 'Run the grill station during dinner service.',
}

beforeEach(() => {
  h.business = { id: BIZ, city_id: 'city-1', ownership_label: 'black_owned', ownership_attested: true }
  h.user = { id: 'u1', email: 'o@example.com' }
  h.rate = true
  h.flag = true
  h.listingReads = 0
  h.createJobDraft.mockReset().mockResolvedValue({ ok: true, listingId: ATTEMPT })
  h.submitJobForReview.mockReset().mockResolvedValue({ success: true, outcome: 'included' })
})

describe('postJobAction', () => {
  it('refuses a business the user does not own', async () => {
    h.business = null
    const r = await postJobAction({ values, attemptId: ATTEMPT })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fieldErrors?.hiringListingId).toBeDefined()
    expect(h.createJobDraft).not.toHaveBeenCalled()
  })

  it('copies the label, attestation and city from the business', async () => {
    await postJobAction({ values, attemptId: ATTEMPT })
    const arg = h.createJobDraft.mock.calls[0]![1]
    expect(arg.reuseId).toBe(ATTEMPT)
    expect(arg.fields.ownershipLabel).toBe('black_owned')
    expect(arg.fields.ownershipAttested).toBe(true)
    expect(arg.fields.cityId).toBe('city-1')
    expect(arg.fields.hiringListingId).toBe(BIZ)
  })

  it('nulls pay for a volunteer role', async () => {
    await postJobAction({ values: { ...values, employmentType: 'volunteer' }, attemptId: ATTEMPT })
    const f = h.createJobDraft.mock.calls[0]![1].fields
    expect([f.salaryMin, f.salaryMax, f.salaryPeriod]).toEqual([null, null, null])
  })

  it('rejects missing pay on the server', async () => {
    const r = await postJobAction({ values: { ...values, salaryMin: '' }, attemptId: ATTEMPT })
    expect(r.ok).toBe(false)
    expect(h.createJobDraft).not.toHaveBeenCalled()
  })

  it('returns included when the ladder spends no money', async () => {
    const r = await postJobAction({ values, attemptId: ATTEMPT })
    expect(r).toEqual({ ok: true, listingId: ATTEMPT, outcome: 'included' })
  })

  it('returns a checkout url when payment is needed', async () => {
    h.submitJobForReview.mockResolvedValue({ requiresPayment: true, checkoutUrl: 'https://pay.example/x' })
    const r = await postJobAction({ values, attemptId: ATTEMPT })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.outcome).toBe('checkout')
      expect(r.checkoutUrl).toBe('https://pay.example/x')
    }
  })

  it('stops when signed out, rate limited, or the flag is off', async () => {
    h.user = null
    expect((await postJobAction({ values, attemptId: ATTEMPT })).ok).toBe(false)
    h.user = { id: 'u1', email: 'o@example.com' }
    h.rate = false
    expect((await postJobAction({ values, attemptId: ATTEMPT })).ok).toBe(false)
    h.rate = true
    h.flag = false
    expect((await postJobAction({ values, attemptId: ATTEMPT })).ok).toBe(false)
    expect(h.createJobDraft).not.toHaveBeenCalled()
  })
})
