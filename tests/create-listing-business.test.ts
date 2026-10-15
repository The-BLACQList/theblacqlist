import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 126: the business draft-save writes the city, keeps the founder
// story, seeds the one line, and saves "suggest a category" requests.

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111'
const CITY_ID = '22222222-2222-4222-8222-222222222222'
const PARENT_ID = '44444444-4444-4444-8444-444444444444'

const h = vi.hoisted(() => ({
  state: {
    cities: [] as Array<{ id: string; name: string }>,
    requestError: null as null | { code: string },
    inserts: {} as Record<string, Array<Record<string, unknown>>>,
    cityFilters: [] as Array<[string, unknown[]]>,
    // Rows by id, set in beforeEach; vi.hoisted runs before CATEGORY_ID exists.
    categories: {} as Record<string, Record<string, unknown>>,
    categorySelects: [] as string[],
    categoryError: null as null | { code: string; message: string },
    serviceUpdates: [] as Array<{ table: string; row: Record<string, unknown>; filters: unknown[][] }>,
    geocodeCalls: [] as Array<Record<string, unknown>>,
    geocodeResult: { lat: 33.75, lng: -84.38 } as null | { lat: number; lng: number },
  },
}))

function builder(table: string) {
  let op: 'select' | 'insert' = 'select'
  let idFilter: unknown = null
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.select = (cols?: string) => {
    if (table === 'categories' && typeof cols === 'string') h.state.categorySelects.push(cols)
    return chain
  }
  chain.is = self
  chain.limit = (...args: unknown[]) => {
    if (table === 'cities') h.state.cityFilters.push(['limit', args])
    return chain
  }
  chain.eq = (...args: unknown[]) => {
    if (table === 'cities') h.state.cityFilters.push(['eq', args])
    if (args[0] === 'id') idFilter = args[1]
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
  chain.maybeSingle = async () => {
    if (table !== 'categories') return { data: null, error: null }
    if (h.state.categoryError) return { data: null, error: h.state.categoryError }
    return { data: h.state.categories[String(idFilter)] ?? null, error: null }
  }
  chain.single = async () => ({ data: { id: 'listing-1' }, error: null })
  chain.then = (resolve: (v: unknown) => unknown) => {
    if (table === 'cities') return resolve({ data: h.state.cities, error: null })
    if (table === 'category_requests' && op === 'insert')
      return resolve({ error: h.state.requestError })
    return resolve({ data: null, error: null })
  }
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: (table: string) => builder(table),
  }),
  createServiceClient: () => ({
    from: (table: string) => ({
      update: (row: Record<string, unknown>) => {
        const entry = { table, row, filters: [] as unknown[][] }
        h.state.serviceUpdates.push(entry)
        const chain = {
          eq: (...args: unknown[]) => {
            entry.filters.push(args)
            return chain
          },
          then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
        }
        return chain
      },
    }),
  }),
}))
vi.mock('@/lib/listings/geocode', () => ({
  geocodeAddress: async (input: Record<string, unknown>) => {
    h.state.geocodeCalls.push(input)
    return h.state.geocodeResult
  },
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

// The picked category, and its parent when parentSlug is given.
function setCategory(slug: string, parentSlug: string | null) {
  h.state.categories = {
    [CATEGORY_ID]: { id: CATEGORY_ID, slug, parent_id: parentSlug ? PARENT_ID : null },
  }
  if (parentSlug) h.state.categories[PARENT_ID] = { slug: parentSlug }
}

beforeEach(() => {
  h.state.cities = []
  h.state.requestError = null
  h.state.inserts = {}
  h.state.cityFilters = []
  h.state.categorySelects = []
  h.state.categoryError = null
  h.state.serviceUpdates = []
  h.state.geocodeCalls = []
  h.state.geocodeResult = { lat: 33.75, lng: -84.38 }
  setCategory('bakeries', 'food-dining')
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
      form({
        category_request_name: 'Sourdough bakery',
        category_request_words: 'bread, sourdough',
      })
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

// Ticket 131: creators add themselves through their own sign-up with an 18+
// check (ticket 132), so the business path can't make creator pages.
describe('createListingAction, creator guards', () => {
  it('refuses the creator type until the creator path ships', async () => {
    const res = await createListingAction(null, form({ entity_type: 'creator' }))
    expect(res).toMatchObject({ error: expect.stringContaining('not open yet') })
    expect(h.state.inserts.listings).toBeUndefined()
  })

  it('refuses a business page in a Creators subcategory', async () => {
    setCategory('podcasters', 'creators-influencers')
    const res = await createListingAction(null, form())
    expect(res).toMatchObject({
      fieldErrors: { category_id: expect.stringContaining('own sign-up') },
    })
    expect(h.state.inserts.listings).toBeUndefined()
  })

  it('refuses a business page in the Creators parent', async () => {
    setCategory('creators-influencers', null)
    const res = await createListingAction(null, form())
    expect(res).toMatchObject({ fieldErrors: { category_id: expect.any(String) } })
  })

  it('still allows the agency category Influencer Marketing', async () => {
    setCategory('influencer-marketing', 'social-media-marketing')
    const res = await createListingAction(null, form())
    expect(res).toMatchObject({ success: true })
  })

  // 2026-10-11: a hinted embed from categories to itself fails in PostgREST
  // (PGRST200), and every page in a subcategory was refused as "Invalid
  // category". The lookups must stay plain selects with no embed.
  it('looks up the category and its parent with plain selects', async () => {
    setCategory('authors-writers', 'books-publishing')
    const res = await createListingAction(null, form())
    expect(res).toMatchObject({ success: true })
    expect(h.state.categorySelects.length).toBeGreaterThan(0)
    for (const cols of h.state.categorySelects) expect(cols).not.toMatch(/[!(]/)
  })

  it('does not call a failed lookup an invalid category', async () => {
    h.state.categoryError = { code: 'PGRST200', message: 'Could not find a relationship' }
    const res = await createListingAction(null, form())
    expect(res).toMatchObject({ error: expect.stringContaining('Something went wrong') })
    expect(res && 'fieldErrors' in res ? res.fieldErrors : undefined).toBeUndefined()
    expect(h.state.inserts.listings).toBeUndefined()
  })

  it('still calls a missing category invalid', async () => {
    h.state.categories = {}
    const res = await createListingAction(null, form())
    expect(res).toMatchObject({ fieldErrors: { category_id: expect.stringContaining('Invalid') } })
  })
})

// Ticket 127: what the site import fills in has to survive the draft save.
const HOURS = {
  monday: { open: '08:00', close: '17:00', closed: false },
  tuesday: { open: '08:00', close: '17:00', closed: false },
  wednesday: { open: '08:00', close: '17:00', closed: false },
  thursday: { open: '08:00', close: '17:00', closed: false },
  friday: { open: '08:00', close: '19:00', closed: false },
  saturday: { open: '09:00', close: '14:00', closed: false },
  sunday: { open: '09:00', close: '17:00', closed: true },
}

function detailsRow() {
  const row = h.state.inserts.listing_details_business?.[0]
  if (!row) throw new Error('no details insert')
  return row
}

describe('createListingAction, site import fields', () => {
  it('saves Free social links instead of refusing them', async () => {
    const res = await createListingAction(
      null,
      form({ social_instagram: 'https://instagram.com/sweetauburnbread' })
    )
    expect(res).toMatchObject({ success: true })
    expect(detailsRow().social_instagram).toBe('https://instagram.com/sweetauburnbread')
  })

  it('still refuses a social link that is not a web address', async () => {
    const res = await createListingAction(null, form({ social_instagram: '@sweetauburnbread' }))
    expect(res).toMatchObject({ fieldErrors: { social_instagram: expect.any(String) } })
  })

  it('saves the street address and ZIP with a map pin', async () => {
    const res = await createListingAction(
      null,
      form({ address_line_1: '123 Auburn Ave NE', zip: '30303', city_text: 'Atlanta', state_text: 'GA' })
    )
    expect(res).toMatchObject({ success: true })
    expect(detailsRow()).toMatchObject({
      address_line_1: '123 Auburn Ave NE',
      zip: '30303',
      lat: 33.75,
      lng: -84.38,
    })
    expect(h.state.geocodeCalls).toEqual([
      { address: '123 Auburn Ave NE', city: 'Atlanta', state: 'GA', zip: '30303' },
    ])
  })

  it('saves the address without a pin when geocoding finds nothing', async () => {
    h.state.geocodeResult = null
    await createListingAction(null, form({ address_line_1: '123 Auburn Ave NE' }))
    expect(detailsRow()).toMatchObject({ address_line_1: '123 Auburn Ave NE', lat: null, lng: null })
  })

  it('keeps an online-only business free of a street address', async () => {
    await createListingAction(
      null,
      form({ location_type: 'virtual', address_line_1: '123 Auburn Ave NE', zip: '30303' })
    )
    expect(detailsRow().address_line_1).toBeUndefined()
    expect(h.state.geocodeCalls).toEqual([])
  })

  it('refuses a ZIP that is not five digits', async () => {
    const res = await createListingAction(null, form({ zip: '3030' }))
    expect(res).toMatchObject({ fieldErrors: { zip: expect.any(String) } })
  })

  it('saves hours in the shape the open-now display reads', async () => {
    await createListingAction(null, form({ hours: JSON.stringify(HOURS) }))
    expect(detailsRow().hours).toEqual(HOURS)
  })

  it('refuses hours that are missing a day', async () => {
    const { sunday: _sunday, ...sixDays } = HOURS
    const res = await createListingAction(null, form({ hours: JSON.stringify(sixDays) }))
    expect(res).toMatchObject({ fieldErrors: { hours: expect.stringContaining('Check the times') } })
    expect(h.state.inserts.listings).toBeUndefined()
  })

  it('refuses hours that are not JSON', async () => {
    const res = await createListingAction(null, form({ hours: 'mon 8-5' }))
    expect(res).toMatchObject({ fieldErrors: { hours: expect.any(String) } })
  })

  it('notes the imported site for the review queue', async () => {
    await createListingAction(null, form({ imported_from: 'SweetAuburnBread.com' }))
    expect(h.state.serviceUpdates).toEqual([
      {
        table: 'listings',
        row: { admin_notes: 'Imported from sweetauburnbread.com' },
        filters: [
          ['id', 'listing-1'],
          ['owner_user_id', 'user-1'],
        ],
      },
    ])
  })

  it('ignores an imported_from value that is not a host name', async () => {
    await createListingAction(null, form({ imported_from: 'https://evil.test/<script>' }))
    expect(h.state.serviceUpdates).toEqual([])
  })

  it('writes no note when the import was not used', async () => {
    await createListingAction(null, form())
    expect(h.state.serviceUpdates).toEqual([])
  })
})
