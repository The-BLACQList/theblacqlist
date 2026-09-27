import { describe, it, expect, vi, beforeEach } from 'vitest'

// The listings owner guard (20260926000000_listings_entitlement_guard.sql)
// refuses any job status change made from a user session. These tests pin the
// two owner actions to that rule: Submit for review moves a job on the service
// role (after its own checks), and the dashboard Publish button refuses jobs
// outright instead of sending an update the database will reject.

const h = vi.hoisted(() => {
  const state: {
    user: { id: string; email: string } | null
    listing: Record<string, unknown> | null
    serviceClientThrows: boolean
  } = { user: null, listing: null, serviceClientThrows: false }

  const updates: Record<string, unknown>[] = []

  function makeUserClient() {
    return {
      kind: 'user' as const,
      auth: { getUser: async () => ({ data: { user: state.user } }) },
      from() {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          maybeSingle: async () => ({ data: state.listing, error: null }),
          update: (row: Record<string, unknown>) => {
            updates.push(row)
            return { eq: () => ({ eq: async () => ({ error: null }) }) }
          },
        }
        return builder
      },
    }
  }

  const serviceClient = { kind: 'service' as const }
  const createClient = vi.fn(async () => makeUserClient())
  const createServiceClient = vi.fn(() => {
    if (state.serviceClientThrows) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
    return serviceClient
  })
  const transitionToPendingReview = vi.fn(async () => ({ success: true as const }))
  const getOwnerSession = vi.fn(async () => (state.user ? { user: state.user } : null))

  return {
    state,
    updates,
    serviceClient,
    createClient,
    createServiceClient,
    transitionToPendingReview,
    getOwnerSession,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: h.createClient,
  createServiceClient: h.createServiceClient,
}))
// paidPostings off: the payment ladder has its own suite
// (job-posting-purchase.test.ts). What is under test here is which client
// performs the transition once the ladder has passed.
vi.mock('@/lib/env', () => ({ isFeatureEnabled: () => false }))
vi.mock('@/lib/listings/submitForReview', () => ({
  transitionToPendingReview: h.transitionToPendingReview,
}))
vi.mock('@/lib/stripe/jobPostingCheckout', () => ({ createJobPostingCheckoutSession: vi.fn() }))
vi.mock('@/lib/stripe/jobPostings', () => ({
  eventQuotaFor: vi.fn(),
  grantIncludedJobPosting: vi.fn(),
  hasPaidJobPosting: vi.fn(),
  jobQuotaFor: vi.fn(),
  JOB_LIMIT_ENFORCED_FROM: '2026-01-01T00:00:00Z',
}))
vi.mock('@/lib/dashboard/guard', () => ({ getOwnerSession: h.getOwnerSession }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/listings/url', () => ({ buildEntityUrl: () => '/l/x' }))

import { submitListingForReviewAction } from '@/lib/actions/listings/submitListingForReview'
import { updateListingStatusAction } from '@/lib/actions/dashboard/updateListingStatus'

const LISTING_ID = '3f1c2b9a-6d4e-4a7b-9c1d-2e5f8a0b7c64'

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  h.updates.length = 0
  h.state.user = { id: 'u1', email: 'owner@example.com' }
  h.state.serviceClientThrows = false
  h.state.listing = {
    id: LISTING_ID,
    name: 'Line Cook',
    status: 'draft',
    entity_type: 'job',
    owner_user_id: 'u1',
    created_at: '2026-09-01T00:00:00Z',
    trust_tier: 'claimed',
    slug: 'line-cook',
    cities: { slug: 'atlanta' },
  }
})

describe('submitListingForReviewAction: which client moves the listing', () => {
  it('moves a job to review on the service role, still scoped to the owner', async () => {
    const res = await submitListingForReviewAction(null, form({ listing_id: LISTING_ID }))

    expect(res).toEqual({ success: true })
    expect(h.transitionToPendingReview).toHaveBeenCalledWith(h.serviceClient, LISTING_ID, 'u1')
  })

  it('moves a business on the user session, as before', async () => {
    h.state.listing = { ...h.state.listing, entity_type: 'business' }

    await submitListingForReviewAction(null, form({ listing_id: LISTING_ID }))

    const [client] = h.transitionToPendingReview.mock.calls[0]! as unknown as [{ kind: string }]
    expect(client.kind).toBe('user')
    expect(h.createServiceClient).not.toHaveBeenCalled()
  })

  it('returns a plain error when the service role is unavailable, without transitioning', async () => {
    h.state.serviceClientThrows = true

    const res = await submitListingForReviewAction(null, form({ listing_id: LISTING_ID }))

    expect(res).toEqual({ error: 'Could not submit this job right now. Please try again.' })
    expect(h.transitionToPendingReview).not.toHaveBeenCalled()
  })

  it('never reaches the service role for someone else\'s job', async () => {
    h.state.listing = { ...h.state.listing, owner_user_id: 'someone-else' }

    const res = await submitListingForReviewAction(null, form({ listing_id: LISTING_ID }))

    expect(res).toEqual({ error: 'You do not have permission to submit this listing.' })
    expect(h.createServiceClient).not.toHaveBeenCalled()
    expect(h.transitionToPendingReview).not.toHaveBeenCalled()
  })

  it('never reaches the service role for a job that is not a draft', async () => {
    h.state.listing = { ...h.state.listing, status: 'published' }

    const res = await submitListingForReviewAction(null, form({ listing_id: LISTING_ID }))

    expect(res).toEqual({ error: 'Only draft listings can be submitted for review.' })
    expect(h.createServiceClient).not.toHaveBeenCalled()
  })
})

describe('updateListingStatusAction: jobs never publish from the dashboard', () => {
  it('refuses to publish a job and writes nothing', async () => {
    const res = await updateListingStatusAction(
      null,
      form({ listing_id: LISTING_ID, action: 'publish' })
    )

    expect(res).toEqual({ error: 'Job listings go live through Submit for review.' })
    expect(h.updates).toEqual([])
  })

  it('still publishes a claimed business draft', async () => {
    h.state.listing = { ...h.state.listing, entity_type: 'business' }

    const res = await updateListingStatusAction(
      null,
      form({ listing_id: LISTING_ID, action: 'publish' })
    )

    expect(res).toEqual({ success: true, status: 'published' })
    expect(h.updates).toEqual([{ status: 'published' }])
  })

  it('still lets an owner unpublish a live job', async () => {
    h.state.listing = { ...h.state.listing, status: 'published' }

    const res = await updateListingStatusAction(
      null,
      form({ listing_id: LISTING_ID, action: 'unpublish' })
    )

    expect(res).toEqual({ success: true, status: 'draft' })
    expect(h.updates).toEqual([{ status: 'draft' }])
  })
})
