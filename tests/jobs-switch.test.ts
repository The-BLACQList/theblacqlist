import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 282: FEATURE_JOBS_OPEN off stops every NEW job submission on the
// server, not only on the covered /add-job page. Off, the dashboard's Submit
// button used to run the whole ladder and could open Stripe Checkout.

const h = vi.hoisted(() => ({
  flags: {} as Record<string, boolean>,
  quota: vi.fn(),
  paid: vi.fn(),
  grant: vi.fn(),
  checkout: vi.fn(),
  move: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/env', () => ({ isFeatureEnabled: (f: string) => h.flags[f] ?? false }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({}),
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: h.from,
  }),
}))
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: async () => true }))
vi.mock('@/lib/listings/submitForReview', () => ({ transitionToPendingReview: h.move }))
vi.mock('@/lib/stripe/jobPostingCheckout', () => ({ createJobPostingCheckoutSession: h.checkout }))
vi.mock('@/lib/stripe/jobPostings', async (original) => ({
  ...(await original<typeof import('@/lib/stripe/jobPostings')>()),
  grantIncludedJobPosting: h.grant,
  hasPaidJobPosting: h.paid,
  jobQuotaFor: h.quota,
}))

import { createListingAction } from '@/lib/actions/listings/createListing'
import {
  JOBS_CLOSED_MESSAGE,
  submitJobForReview,
} from '@/lib/services/listings/submitJobForReview'

const NEW = '2026-11-01T00:00:00Z'
const GRANDFATHERED = '2026-01-01T00:00:00Z'
const submit = (created_at = NEW) =>
  submitJobForReview({} as never, { id: 'u1' }, { id: 'job-1', name: 'Line Cook', created_at }, { chargeShown: true })

function nothingHappened() {
  expect(h.grant).not.toHaveBeenCalled()
  expect(h.checkout).not.toHaveBeenCalled()
  expect(h.move).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  h.flags = { jobsOpen: false, paidPostings: true, postingSubmissions: true }
  h.paid.mockResolvedValue({ ok: true, value: false })
  h.quota.mockResolvedValue({
    ok: true,
    value: { limit: 0, used: 0, atLimit: true, nextOpensAt: null, tier: 'free' },
  })
  h.grant.mockResolvedValue({ ok: true })
  h.move.mockResolvedValue({ success: true })
  h.checkout.mockResolvedValue({ url: 'https://pay.example/x' })
})

describe('submitJobForReview with Jobs switched off', () => {
  it.each([true, false])('refuses a new job and changes nothing (paid postings: %s)', async (paidPostings) => {
    h.flags.paidPostings = paidPostings
    expect(await submit()).toEqual({ error: JOBS_CLOSED_MESSAGE })
    nothingHappened()
  })

  it('refuses before an included posting is spent', async () => {
    h.quota.mockResolvedValue({
      ok: true,
      value: { limit: 3, used: 0, atLimit: false, nextOpensAt: null, tier: 'premium' },
    })
    expect(await submit()).toEqual({ error: JOBS_CLOSED_MESSAGE })
    nothingHappened()
  })

  it('refuses a grandfathered draft, which was never paid for', async () => {
    expect(await submit(GRANDFATHERED)).toEqual({ error: JOBS_CLOSED_MESSAGE })
    nothingHappened()
  })

  it.each([true, false])('still submits a job already paid for (paid postings: %s)', async (paidPostings) => {
    h.flags.paidPostings = paidPostings
    h.paid.mockResolvedValue({ ok: true, value: true })
    expect(await submit()).toEqual({ success: true, outcome: 'included' })
    expect(h.move).toHaveBeenCalledTimes(1)
    expect(h.grant).not.toHaveBeenCalled()
    expect(h.checkout).not.toHaveBeenCalled()
  })

  it.each([true, false])('does not read a failed check as paid (paid postings: %s)', async (paidPostings) => {
    h.flags.paidPostings = paidPostings
    h.paid.mockResolvedValue({ ok: false, error: 'x' })
    expect(await submit()).toEqual({
      error: 'Could not check this job posting right now. Please try again.',
    })
    nothingHappened()
  })
})

describe('submitJobForReview with Jobs switched on', () => {
  beforeEach(() => {
    h.flags.jobsOpen = true
  })

  it('opens checkout as before', async () => {
    expect(await submit()).toEqual({ requiresPayment: true, checkoutUrl: 'https://pay.example/x' })
  })

  it('never reads the ledger for a grandfathered draft', async () => {
    expect(await submit(GRANDFATHERED)).toEqual({ success: true, outcome: 'included' })
    expect(h.paid).not.toHaveBeenCalled()
  })
})

describe('createListingAction with Jobs switched off', () => {
  const form = (entityType: string) => {
    const fd = new FormData()
    fd.set('entity_type', entityType)
    return fd
  }
  const closed = 'Job submissions are not open yet.'

  it('refuses a job before any table is touched', async () => {
    expect(await createListingAction(null, form('job'))).toEqual({ error: closed })
    expect(h.from).not.toHaveBeenCalled()
  })

  it.each(['event', 'business'])('does not stop a page of type %s', async (type) => {
    const r = await createListingAction(null, form(type))
    expect(r).not.toEqual({ error: closed })
  })
})
