import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 126: the business draft-save writes the city, keeps the founder
// story, seeds the one line, and saves "suggest a category" requests.

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111'
const CITY_ID = '22222222-2222-4222-8222-222222222222'

const h = vi.hoisted(() => ({
  state: {
    cities: [] as Array<{ id: string; name: string }>,
    requestError: null as null | { code: string },
    inserts: {} as Record<string, Array<Record<string, unknown>>>,
    cityFilters: [] as Array<[string, unknown[]]>,
  },
}))

function builder(table: string) {
  let op: 'select' | 'insert' = 'select'
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.select = self
  chain.is = self
  chain.limit = (...args: unknown[]) => {
    if (table === 'cities') h.state.cityFilters.push(['limit', args])
    return chain
  }
  chain.eq = (...args: unknown[]) => {
    if (table === 'cities') h.state.cityFilters.push(['eq', args])
    return chain
  }
  chain.ilike = (...args: unknown[]) => {
    if (table === 'cities') h.state.cityFilters.push(['ilike', args])
    return chain
  }
  chain.insert = (row: Record<string, unknown>) => {
    op = 'insert'
    ;(h.state.inserts[table] ??= []).push(row)
    return chain
  }
  chain.delete = self
  chain.maybeSingle = async () =>
    table === 'categories' ? { data: { id: CATEGORY_ID }, error: null } : { data: null, error: null }
  chain.single = async () => ({ data: { id: 'listing-1' }, error: null })
  chain.then = (resolve: (v: unknown) => unknown) => {
    if (table === 'cities') return resolve({ data: h.state.cities, error: null })
    if (table === 'category_requests' && op === 'insert') return resolve({ error: h.state.requestError })
    return resolve({ data: null, error: null })
  }
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: (table: string) => builder(table),
  }),
}))
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: async () => true }))
vi.mock('@/lib/analytics/server', () => ({ trackServerEvent: () => undefined }))

const { createListingAction } = await import('@/lib/actions/listings/createListing')

function form(extra: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const base: Record<string, string> = {
    entity_type: 'business',
    name: 'Sweet Auburn Bread',
    category_id: CATEGORY_ID,
    description: 'We bake bread every morning. Come early for sourdough.',
    location_type: 'physical',
    cta_type: 'call',
    ownership_label: 'black_owned',
    ownership_attested: 'true',
    ...extra,
  }
  for (const [k, v] of Object.entries(base)) fd.append(k, v)
  return fd
}

function listingRow() {
  const row = h.state.inserts.listings?.[0]
  if (!row) throw new Error('no listing insert')
  return row
}

beforeEach(() => {
  h.state.cities = []
  h.state.requestError = null
  h.state.inserts = {}
  h.state.cityFilters = []
})

describe('createListingAction, business path', () => {
  it('seeds the one line from the first sentence when it is empty', async () => {
    const res = await createListingAction(null, form())
    expect(res).toMatchObject({ success: true })
    expect(listingRow().tagline).toBe('We bake bread every morning.')
  })

  it('folds the founder story into the description', async () => {
    await createListingAction(null, form({ founder_story: 'My grandmother taught me.' }))
    const details = h.state.inserts.listing_details_business?.[0]
    expect(details?.description).toBe(
      'We bake bread every morning. Come early for sourdough.\n\nMy grandmother taught me.'
    )
  })

  it('puts the limit error on the story when only the story pushes it over', async () => {
    const res = await createListingAction(null, form({ founder_story: 'x'.repeat(290) }))
    expect(res).toMatchObject({ fieldErrors: { founder_story: expect.stringContaining('300') } })
    expect(res && 'fieldErrors' in res ? res.fieldErrors?.description : undefined).toBeUndefined()
  })

  it('writes the picked city id', async () => {
    h.state.cities = [{ id: CITY_ID, name: 'Atlanta' }]
    await createListingAction(null, form({ city_id: CITY_ID }))
    expect(listingRow().city_id).toBe(CITY_ID)
    expect(h.state.inserts.listing_details_business?.[0]?.city_text).toBe('Atlanta')
  })

  it('matches a typed city name to one active city', async () => {
    h.state.cities = [{ id: CITY_ID, name: 'Atlanta' }]
    await createListingAction(null, form({ city_text: 'atlanta' }))
    expect(listingRow().city_id).toBe(CITY_ID)
    expect(h.state.cityFilters).toContainEqual(['ilike', ['name', 'atlanta']])
  })

  it('leaves the city empty when a typed name matches two cities', async () => {
    h.state.cities = [
      { id: CITY_ID, name: 'Columbus' },
      { id: '33333333-3333-4333-8333-333333333333', name: 'Columbus' },
    ]
    const res = await createListingAction(null, form({ city_text: 'Columbus' }))
    expect(res).toMatchObject({ success: true })
    expect(listingRow()).not.toHaveProperty('city_id')
  })

  it('rejects a picked city id that is not active', async () => {
    const res = await createListingAction(null, form({ city_id: CITY_ID }))
    expect(res).toMatchObject({ fieldErrors: { city_id: expect.any(String) } })
    expect(h.state.inserts.listings).toBeUndefined()
  })

  it('rejects a malformed city id before any query', async () => {
    const res = await createListingAction(null, form({ city_id: 'not-a-uuid' }))
    expect(res).toMatchObject({ fieldErrors: { city_id: 'Pick your city from the list.' } })
  })

  it('does not look up a city for an online-only business', async () => {
    h.state.cities = [{ id: CITY_ID, name: 'Atlanta' }]
    await createListingAction(null, form({ location_type: 'virtual', city_text: 'Atlanta' }))
    expect(listingRow()).not.toHaveProperty('city_id')
    expect(h.state.cityFilters).toHaveLength(0)
  })

  it('saves a category suggestion with the owner words', async () => {
    const res = await createListingAction(
      null,
      form({ category_request_name: 'Sourdough bakery', category_request_words: 'bread, sourdough' })
    )
    expect(res).toMatchObject({ success: true })
    expect(res).not.toHaveProperty('warning')
    expect(h.state.inserts.category_requests?.[0]).toMatchObject({
      listing_id: 'listing-1',
      requested_by: 'user-1',
      proposed_name: 'Sourdough bakery',
      owner_words: 'bread, sourdough',
      parent_category_id: CATEGORY_ID,
    })
  })

  it('keeps the draft and warns when the suggestion fails', async () => {
    h.state.requestError = { code: '42501' }
    const res = await createListingAction(null, form({ category_request_name: 'Sourdough bakery' }))
    expect(res).toMatchObject({ success: true, warning: expect.stringContaining('draft is saved') })
  })

  it('rejects a one-letter category name', async () => {
    const res = await createListingAction(null, form({ category_request_name: 'x' }))
    expect(res).toMatchObject({ fieldErrors: { category_request_name: expect.any(String) } })
  })
})
