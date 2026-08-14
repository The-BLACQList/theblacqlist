import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Checkpoints 1.7 + 4.4a — vendor storefront resolution.
 *
 * 1.7 (fixed): the listing select asked PostgREST for `cities(name, state_abbr)`,
 * a column that doesn't exist — `cities` joins out to `states.code`. The whole
 * select errored, `listing` came back null, and every storefront 404'd. The
 * vendor-fixture test keeps that regression covered: the city join is the code
 * path, and the `${name}, ${code}` assertion only passes if it resolved.
 *
 * 4.4a (this spec's red/green): the same select had NO entity_type filter, so
 * every published listing on the site resolved as a storefront. The rule the
 * page now enforces — a storefront is a listing that is vendor-typed OR
 * actually sells something (createProduct/createService attach marketplace rows
 * to any owned listing, and product pages link "Sold by" to
 * /vendors/<owner slug> regardless of type):
 *
 *   • vendor-typed, nothing listed yet → 200, empty-storefront state
 *   • non-vendor with an active product → 200 ("Sold by" links must not break)
 *   • non-vendor with nothing to sell   → 404  (RED on main, GREEN on the fix)
 *
 * Hermetic by design, matching e2e/analytics-emission.spec.ts: creates and
 * deletes its own listings (the product row cascades on listing delete), so it
 * does not assume a particular database's contents.
 */

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const VENDOR_SLUG = `e2e-vendor-${RUN_ID}`
const VENDOR_NAME = `E2E Vendor Fixture ${RUN_ID}`
const SELLER_SLUG = `e2e-seller-${RUN_ID}`
const SELLER_NAME = `E2E Selling Business ${RUN_ID}`
const PLAIN_SLUG = `e2e-plain-${RUN_ID}`
const PLAIN_NAME = `E2E Plain Business ${RUN_ID}`

let svc: SupabaseClient
let listingIds: string[] = []
let cityName: string
let stateCode: string

async function insertListing(
  fields: { name: string; slug: string; entity_type: string },
  categoryId: string,
  cityId: string
): Promise<string> {
  const { data, error } = await svc
    .from('listings')
    .insert({
      ...fields,
      category_id: categoryId,
      city_id: cityId,
      status: 'published',
      tagline: 'Fixture for the vendor storefront spec',
    })
    .select('id')
    .single()
  expect(error, `fixture listing insert failed: ${error?.message}`).toBeNull()
  const id = (data as { id: string }).id
  listingIds.push(id)
  return id
}

test.beforeAll(async () => {
  svc = serviceClient()

  const { data: category, error: catError } = await svc
    .from('categories')
    .select('id')
    .limit(1)
    .single()
  expect(catError, 'a category must exist to hang a fixture listing off').toBeNull()
  const categoryId = (category as { id: string }).id

  // The city is the 1.7 code path: PostgREST only rejects the select when it
  // has to resolve the embedded `cities(...)` column list. Pull the state code
  // too so the assertion can check the value actually reached the page, not
  // merely that the page loaded.
  const { data: city, error: cityError } = await svc
    .from('cities')
    .select('id, name, states(code)')
    .eq('is_active', true)
    .limit(1)
    .single()
  expect(cityError, 'an active city must exist to reproduce the join').toBeNull()

  // This client is untyped, so supabase-js widens an embedded to-one relation to
  // an array. Normalize both shapes rather than asserting one and being wrong on
  // a client-library bump.
  const cityRow = city as unknown as {
    id: string
    name: string
    states: { code: string } | { code: string }[] | null
  }
  cityName = cityRow.name
  stateCode = Array.isArray(cityRow.states)
    ? (cityRow.states[0]?.code ?? '')
    : (cityRow.states?.code ?? '')

  const [, sellerId] = await Promise.all([
    insertListing(
      { name: VENDOR_NAME, slug: VENDOR_SLUG, entity_type: 'vendor' },
      categoryId,
      cityRow.id
    ),
    insertListing(
      { name: SELLER_NAME, slug: SELLER_SLUG, entity_type: 'business' },
      categoryId,
      cityRow.id
    ),
    insertListing(
      { name: PLAIN_NAME, slug: PLAIN_SLUG, entity_type: 'business' },
      categoryId,
      cityRow.id
    ),
  ])

  // The seller's product is what makes it a storefront despite not being
  // vendor-typed. Must be status 'active' — the page only counts active rows.
  const { error: productError } = await svc.from('marketplace_products').insert({
    listing_id: sellerId,
    name: `E2E Fixture Product ${RUN_ID}`,
    slug: `e2e-product-${RUN_ID}`,
    global_slug: `e2e-product-${RUN_ID}`,
    status: 'active',
  })
  expect(productError, `fixture product insert failed: ${productError?.message}`).toBeNull()
})

test.afterAll(async () => {
  if (listingIds.length === 0) return
  // marketplace_products.listing_id is ON DELETE CASCADE — the product goes too.
  await svc.from('listings').delete().in('id', listingIds)
})

test.describe('vendor storefront', () => {
  test('a vendor-typed listing renders its storefront, city join intact (1.7)', async ({
    page,
  }) => {
    const response = await page.goto(`/vendors/${VENDOR_SLUG}`)

    // Assert the status before anything else. Playwright renders a 404 body
    // happily, so a content-only assertion would report a confusing "text not
    // found" instead of the real answer, which is the HTTP code.
    expect(response, 'no response for /vendors/<slug>').not.toBeNull()
    expect(
      response!.status(),
      'a vendor-typed listing must resolve even with nothing listed yet'
    ).toBe(200)

    // A COMING_SOON_MODE redirect also answers 200 (at /coming-soon), so pin
    // the final URL. Without this, the gate being on would make the spec pass
    // while never reaching the page under test.
    expect(page.url(), 'expected to land on the vendor route, not a redirect').toContain(
      `/vendors/${VENDOR_SLUG}`
    )

    await expect(page.getByRole('heading', { name: VENDOR_NAME })).toBeVisible()

    // The city line is the 1.7 code path. `${name}, ${code}` is what the page
    // renders, and it is only reachable if the embedded join resolved.
    if (stateCode) {
      await expect(page.getByText(`${cityName}, ${stateCode}`)).toBeVisible()
    }
  })

  test('a non-vendor listing with an active product still resolves — "Sold by" links depend on it (4.4a)', async ({
    page,
  }) => {
    const response = await page.goto(`/vendors/${SELLER_SLUG}`)

    expect(response, 'no response for /vendors/<slug>').not.toBeNull()
    expect(
      response!.status(),
      'a listing that sells must resolve regardless of entity_type — product pages link "Sold by" here'
    ).toBe(200)
    expect(page.url()).toContain(`/vendors/${SELLER_SLUG}`)

    await expect(page.getByRole('heading', { name: SELLER_NAME })).toBeVisible()
    await expect(page.getByText(`E2E Fixture Product ${RUN_ID}`)).toBeVisible()
  })

  test('a non-vendor listing with nothing to sell is not a storefront — 404 (4.4a)', async ({
    page,
  }) => {
    const response = await page.goto(`/vendors/${PLAIN_SLUG}`)

    // RED on main (which resolves any published listing), GREEN on the fix.
    expect(response, 'no response for /vendors/<slug>').not.toBeNull()
    expect(
      response!.status(),
      'a published non-vendor listing with no marketplace rows must not resolve as a storefront'
    ).toBe(404)
  })
})
