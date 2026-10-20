import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 106: starting an event. Two checks run before anything is written.
//   · The plan gate. Below Growth an event can never be published, so the
//     draft is refused with the upgrade line instead of becoming a dead end.
//   · The host page. An event started from a page's Events tab is tied to that
//     page, and only to a business-shaped page this owner controls.

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111'
const HOST_ID = '33333333-3333-4333-8333-333333333333'

const h = vi.hoisted(() => ({
  state: {
    paidPostings: true,
    quota: { ok: true, value: { limit: 3, used: 0, atLimit: false, tier: 'growth' } } as
      | { ok: true; value: { limit: number | null; used: number; atLimit: boolean; tier: string } }
      | { ok: false; error: string },
    // Pages this owner controls, by id.
    owned: {} as Record<string, { id: string; entity_type: string }>,
    listingFilters: [] as unknown[][],
    inserts: {} as Record<string, Array<Record<string, unknown>>>,
  },
}))

function builder(table: string) {
  let idFilter: unknown = null
  let ownerFilter: unknown = null
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.select = self
  chain.is = self
  chain.limit = self
  chain.ilike = self
  chain.eq = (...args: unknown[]) => {
    if (table === 'listings') h.state.listingFilters.push(args)
    if (args[0] === 'id') idFilter = args[1]
    if (args[0] === 'owner_user_id') ownerFilter = args[1]
    return chain
  }
  chain.insert = (row: Record<string, unknown>) => {
    ;(h.state.inserts[table] ??= []).push(row)
    return chain
  }
  chain.maybeSingle = async () => {
    if (table === 'categories') {
      return { data: { id: CATEGORY_ID, slug: 'community-events', parent_id: null }, error: null }
    }
    if (table === 'listings' && ownerFilter === 'user-1') {
      return { data: h.state.owned[String(idFilter)] ?? null, error: null }
    }
    return { data: null, error: null }
  }
  chain.single = async () => ({ data: { id: 'event-1' }, error: null })
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null })
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: (table: string) => builder(table),
  }),
  createServiceClient: () => ({ from: (table: string) => builder(table) }),
}))
vi.mock('@/lib/env', () => ({
  isFeatureEnabled: (name: string) =>
    name === 'postingSubmissions' ? true : name === 'paidPostings' ? h.state.paidPostings : false,
}))
vi.mock('@/lib/stripe/jobPostings', async (orig) => ({
  ...(await orig<typeof import('@/lib/stripe/jobPostings')>()),
  eventQuotaFor: async () => h.state.quota,
}))
vi.mock('@/lib/listings/levelRows', () => ({ loadCategoryLevels: async () => null }))
vi.mock('@/lib/listings/geocode', () => ({ geocodeAddress: async () => null }))
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: async () => true }))
vi.mock('@/lib/analytics/server', () => ({ trackServerEvent: () => undefined }))

const { createListingAction } = await import('@/lib/actions/listings/createListing')
const { EVENTS_NEED_GROWTH_MESSAGE } = await import('@/lib/stripe/jobPostings')

function form(extra: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const base: Record<string, string> = {
    entity_type: 'event',
    name: 'Saturday Makers Market',
    tagline: 'Thirty makers in one lot',
    category_id: CATEGORY_ID,
    description: 'Thirty makers, one parking lot, free entry.',
    starts_at: '2026-11-14T10:00',
    venue_name: 'Sweet Auburn Lot',
    ownership_label: 'black_owned',
    ownership_attested: 'true',
    ...extra,
  }
  for (const [k, v] of Object.entries(base)) fd.append(k, v)
  return fd
}

const eventDetails = () => h.state.inserts.listing_details_event?.[0]

beforeEach(() => {
  h.state.paidPostings = true
  h.state.quota = { ok: true, value: { limit: 3, used: 0, atLimit: false, tier: 'growth' } }
  h.state.owned = { [HOST_ID]: { id: HOST_ID, entity_type: 'business' } }
  h.state.listingFilters = []
  h.state.inserts = {}
})

describe('createListingAction for events: the plan gate', () => {
  it.each(['free', 'starter'])(
    'refuses a %s owner with the Growth line and writes nothing',
    async (tier) => {
      h.state.quota = { ok: true, value: { limit: 0, used: 0, atLimit: true, tier } }

      const result = await createListingAction(null, form())

      expect(result).toEqual({ error: EVENTS_NEED_GROWTH_MESSAGE })
      expect(h.state.inserts.listings).toBeUndefined()
    }
  )

  it('lets a Growth owner at the cap save a draft; the count is checked at submit', async () => {
    h.state.quota = { ok: true, value: { limit: 3, used: 3, atLimit: true, tier: 'growth' } }

    const result = await createListingAction(null, form())

    expect(result).toMatchObject({ success: true, listingId: 'event-1' })
  })

  it('stops on a failed allowance read rather than guessing', async () => {
    h.state.quota = { ok: false, error: 'timeout' }

    const result = await createListingAction(null, form())

    expect(result).toEqual({
      error: 'Could not check your event allowance right now. Please try again.',
    })
    expect(h.state.inserts.listings).toBeUndefined()
  })

  it('does not gate while paid postings are off, matching the submit check', async () => {
    h.state.paidPostings = false
    h.state.quota = { ok: true, value: { limit: 0, used: 0, atLimit: true, tier: 'free' } }

    expect(await createListingAction(null, form())).toMatchObject({ success: true })
  })
})

describe('createListingAction for events: the host page', () => {
  it('ties the event to a page the owner controls', async () => {
    const result = await createListingAction(null, form({ organizer_listing_id: HOST_ID }))

    expect(result).toMatchObject({ success: true })
    expect(eventDetails()).toMatchObject({ organizer_listing_id: HOST_ID })
    expect(h.state.listingFilters).toContainEqual(['owner_user_id', 'user-1'])
  })

  it('leaves the host empty when none is given', async () => {
    await createListingAction(null, form())

    expect(eventDetails()).toMatchObject({ organizer_listing_id: null })
  })

  it.each([
    ['someone else’s page', '44444444-4444-4444-8444-444444444444'],
    ['a malformed id', 'not-a-uuid'],
  ])('refuses %s instead of dropping it silently', async (_label, id) => {
    const result = await createListingAction(null, form({ organizer_listing_id: id }))

    expect(result).toEqual({
      error: 'That page could not host this event. Start it again from your page.',
    })
    expect(h.state.inserts.listings).toBeUndefined()
  })

  it('refuses another event as the host', async () => {
    h.state.owned[HOST_ID] = { id: HOST_ID, entity_type: 'event' }

    const result = await createListingAction(null, form({ organizer_listing_id: HOST_ID }))

    expect(result).toHaveProperty('error')
    expect(h.state.inserts.listings).toBeUndefined()
  })
})
