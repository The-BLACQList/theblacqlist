import { describe, it, expect, vi, beforeEach } from 'vitest'

// The upgrade page's free-month card (founder, 2026-10-10): which tester sees
// it, which state it shows, and which tiers it offers. The claim itself is
// covered in tester-tour-claim.test.ts.

const h = vi.hoisted(() => {
  const state = {
    user: { id: 'u1', email: 'tester@example.com' } as { id: string; email: string } | null,
    enrollment: null as Record<string, unknown> | null,
    sessionId: null as string | null,
    listing: { name: 'Hampton Greens', tier: 'free', owner_user_id: 'u1', deleted_at: null } as Record<
      string,
      unknown
    > | null,
    liveSubs: [] as { id?: string; listing_id?: string }[],
    // An owner with no listing on the enrollment: the pages they own.
    ownedListings: [] as { id: string; name: string | null; tier: string | null; status: string }[],
    ownedError: null as { message: string } | null,
    subsError: null as { message: string } | null,
    flagReads: 0,
  }

  function builder(table: string) {
    const q = {
      select: () => q,
      eq: () => q,
      is: () => q,
      in: () => q,
      limit: () => q,
      order: () => q,
      async maybeSingle() {
        if (table === 'tour_enrollments') {
          // The user's own read returns the enrollment; the service read
          // returns just the session id.
          return { data: state.enrollment, error: null }
        }
        if (table === 'listings') return { data: state.listing, error: null }
        return { data: null, error: null }
      },
      then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const result =
          table === 'listings'
            ? { data: state.ownedListings, error: state.ownedError }
            : { data: state.liveSubs, error: state.subsError }
        return Promise.resolve(result).then(
          onFulfilled,
          onRejected
        )
      },
    }
    return q
  }

  const createClient = vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => builder(table),
  }))
  const createServiceClient = vi.fn(() => ({
    from: (table: string) => {
      if (table !== 'tour_enrollments') return builder(table)
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({
          data: { stripe_checkout_session_id: state.sessionId },
          error: null,
        }),
      }
      return q
    },
  }))
  const retrieveSession = vi.fn()
  const isFeatureEnabled = vi.fn(() => {
    state.flagReads++
    return false
  })

  return { state, createClient, createServiceClient, retrieveSession, isFeatureEnabled }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: h.createClient,
  createServiceClient: h.createServiceClient,
}))
vi.mock('@/lib/stripe/client', () => ({
  stripe: { checkout: { sessions: { retrieve: h.retrieveSession } } },
}))
vi.mock('@/lib/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/env')>()),
  isFeatureEnabled: h.isFeatureEnabled,
}))

import { freeMonthTiers, getFreeMonthState } from '@/lib/tour/freeMonth'

beforeEach(() => {
  vi.clearAllMocks()
  h.state.user = { id: 'u1', email: 'tester@example.com' }
  h.state.enrollment = {
    id: 'enr-1',
    listing_id: 'l1',
    completed_at: '2026-09-01T00:00:00Z',
    trial_granted_at: null,
  }
  h.state.sessionId = null
  h.state.listing = { name: 'Hampton Greens', tier: 'free', owner_user_id: 'u1', deleted_at: null }
  h.state.liveSubs = []
  h.state.subsError = null
  h.state.ownedListings = []
  h.state.ownedError = null
  h.state.flagReads = 0
})

describe('freeMonthTiers', () => {
  it('offers every paid tier to a free listing', () => {
    expect(freeMonthTiers('free')).toEqual(['starter', 'growth', 'premium'])
  })

  it('offers only the tiers above a paying listing', () => {
    expect(freeMonthTiers('starter')).toEqual(['growth', 'premium'])
    expect(freeMonthTiers('premium')).toEqual([])
  })
})

describe('getFreeMonthState', () => {
  it('ready for a tester who finished the walk, and never reads the tour flag', async () => {
    expect(await getFreeMonthState()).toEqual({
      status: 'ready',
      listingId: 'l1',
      listingName: 'Hampton Greens',
      currentTier: 'free',
      openTier: null,
      attach: false,
    })
    expect(h.state.flagReads).toBe(0)
  })

  it('no card before the walk is finished', async () => {
    h.state.enrollment!.completed_at = null
    expect(await getFreeMonthState()).toBeNull()
  })

  it('no card for a supporter tester or someone not enrolled', async () => {
    h.state.enrollment!.listing_id = null
    expect(await getFreeMonthState()).toBeNull()
    h.state.enrollment = null
    expect(await getFreeMonthState()).toBeNull()
  })

  it('no card when the listing is no longer the tester\'s', async () => {
    h.state.listing = { name: 'Hampton Greens', tier: 'free', owner_user_id: null, deleted_at: null }
    expect(await getFreeMonthState()).toBeNull()
    h.state.listing = { name: 'Hampton Greens', tier: 'free', owner_user_id: 'u2', deleted_at: null }
    expect(await getFreeMonthState()).toBeNull()
    h.state.listing = {
      name: 'Hampton Greens',
      tier: 'free',
      owner_user_id: 'u1',
      deleted_at: '2026-10-01T00:00:00Z',
    }
    expect(await getFreeMonthState()).toBeNull()
  })

  it('no "used" card either once the listing changed hands', async () => {
    h.state.enrollment!.trial_granted_at = '2026-09-02T00:00:00Z'
    h.state.sessionId = 'cs_1'
    h.retrieveSession.mockResolvedValue({ status: 'complete', metadata: { plan_slug: 'starter' } })
    h.state.listing = { name: 'Hampton Greens', tier: 'starter', owner_user_id: null, deleted_at: null }
    expect(await getFreeMonthState()).toBeNull()
    expect(h.retrieveSession).not.toHaveBeenCalled()
  })

  it('saved when the listing already pays', async () => {
    h.state.listing = { name: 'Hampton Greens', tier: 'starter', owner_user_id: 'u1', deleted_at: null }
    h.state.liveSubs = [{ id: 'sub-1' }]
    expect(await getFreeMonthState()).toMatchObject({ status: 'saved', currentTier: 'starter' })
  })

  it('used, with the tier, once the checkout went through', async () => {
    h.state.enrollment!.trial_granted_at = '2026-09-02T00:00:00Z'
    h.state.sessionId = 'cs_1'
    h.retrieveSession.mockResolvedValue({ status: 'complete', metadata: { plan_slug: 'growth' } })
    expect(await getFreeMonthState()).toEqual({ status: 'used', tier: 'growth' })
  })

  it('ready with openTier set while an earlier checkout is still open', async () => {
    h.state.enrollment!.trial_granted_at = '2026-09-02T00:00:00Z'
    h.state.sessionId = 'cs_1'
    h.retrieveSession.mockResolvedValue({ status: 'open', metadata: { plan_slug: 'starter' } })
    expect(await getFreeMonthState()).toMatchObject({ status: 'ready', openTier: 'starter' })
  })

  it('ready again after an earlier checkout expired', async () => {
    h.state.enrollment!.trial_granted_at = '2026-09-02T00:00:00Z'
    h.state.sessionId = 'cs_1'
    h.retrieveSession.mockResolvedValue({ status: 'expired', metadata: { plan_slug: 'starter' } })
    expect(await getFreeMonthState()).toMatchObject({ status: 'ready', openTier: null })
  })

  it('no card when a read fails, rather than a button the claim would refuse', async () => {
    h.state.subsError = { message: 'boom' }
    expect(await getFreeMonthState()).toBeNull()
    h.state.subsError = null
    h.state.enrollment!.trial_granted_at = '2026-09-02T00:00:00Z'
    h.state.sessionId = 'cs_1'
    h.retrieveSession.mockRejectedValue(new Error('stripe down'))
    expect(await getFreeMonthState()).toBeNull()
  })
})

describe('getFreeMonthState: owner link with no page yet', () => {
  beforeEach(() => {
    h.state.enrollment = {
      id: 'enr-1',
      listing_id: null,
      is_owner: true,
      completed_at: '2026-09-01T00:00:00Z',
      trial_granted_at: null,
    }
  })

  it('waiting, with no page at all', async () => {
    expect(await getFreeMonthState()).toEqual({ status: 'waiting', hasPage: false })
  })

  it('waiting, with a page that is not live yet', async () => {
    h.state.ownedListings = [{ id: 'l1', name: 'Hampton Greens', tier: 'free', status: 'pending' }]
    expect(await getFreeMonthState()).toEqual({ status: 'waiting', hasPage: true })
  })

  it('no card before the walk is finished', async () => {
    h.state.enrollment!.completed_at = null
    expect(await getFreeMonthState()).toBeNull()
  })

  it('ready on the one live page, and the claim names it', async () => {
    h.state.ownedListings = [
      { id: 'l0', name: 'Draft', tier: 'free', status: 'pending' },
      { id: 'l1', name: 'Hampton Greens', tier: 'free', status: 'published' },
    ]
    expect(await getFreeMonthState()).toEqual({
      status: 'ready',
      listingId: 'l1',
      listingName: 'Hampton Greens',
      currentTier: 'free',
      openTier: null,
      attach: true,
    })
  })

  it('saved when the one live page already pays', async () => {
    h.state.ownedListings = [{ id: 'l1', name: 'Hampton Greens', tier: 'starter', status: 'published' }]
    h.state.liveSubs = [{ listing_id: 'l1' }]
    expect(await getFreeMonthState()).toEqual({
      status: 'saved',
      listingId: 'l1',
      listingName: 'Hampton Greens',
      currentTier: 'starter',
    })
  })

  it('asks which page when there is more than one, and marks the paid ones', async () => {
    h.state.ownedListings = [
      { id: 'l1', name: 'Hampton Greens', tier: 'free', status: 'published' },
      { id: 'l2', name: 'Hampton Farms', tier: 'starter', status: 'published' },
    ]
    h.state.liveSubs = [{ listing_id: 'l2' }]
    expect(await getFreeMonthState()).toEqual({
      status: 'pick',
      pages: [
        { listingId: 'l1', listingName: 'Hampton Greens', currentTier: 'free', paid: false },
        { listingId: 'l2', listingName: 'Hampton Farms', currentTier: 'starter', paid: true },
      ],
    })
  })

  it('no card for a supporter with no listing', async () => {
    h.state.enrollment!.is_owner = false
    h.state.ownedListings = [{ id: 'l1', name: 'Hampton Greens', tier: 'free', status: 'published' }]
    expect(await getFreeMonthState()).toBeNull()
  })

  it('no card when a read fails', async () => {
    h.state.ownedError = { message: 'boom' }
    expect(await getFreeMonthState()).toBeNull()
    h.state.ownedError = null
    h.state.ownedListings = [{ id: 'l1', name: 'Hampton Greens', tier: 'free', status: 'published' }]
    h.state.subsError = { message: 'boom' }
    expect(await getFreeMonthState()).toBeNull()
  })
})
