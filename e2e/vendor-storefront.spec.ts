import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Checkpoint 1.7 — every vendor storefront 404s.
 *
 * app/(public)/vendors/[slug]/page.tsx asked PostgREST for
 * `cities(name, state_abbr)`. There is no `state_abbr` column on `cities` — it
 * carries `state_id` and joins out to `states.code`
 * (20260510000000_initial_schema.sql). PostgREST rejects the select, the query
 * returns null, and `if (!listing) notFound()` fires on the very next line.
 *
 * So the failure is not "some vendors 404" — it is *every* vendor, for every
 * slug, always. The defect lives in the listing select, which means any
 * published listing reproduces it. No marketplace product or service fixture is
 * needed: a bare published listing is enough to distinguish "the page rendered"
 * from "the page 404'd", and the empty-storefront state is the correct render
 * for a vendor with nothing listed yet.
 *
 * This must go RED against main and GREEN against the fix. If it passes on
 * both, it is not testing the defect.
 *
 * Hermetic by design, matching e2e/analytics-emission.spec.ts: it creates and
 * deletes its own listing rather than depending on a seeded slug, so it does
 * not assume a particular database's contents.
 */

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const SLUG = `e2e-vendor-${RUN_ID}`
const NAME = `E2E Vendor Fixture ${RUN_ID}`

let svc: SupabaseClient
let listingId: string
let cityName: string
let stateCode: string

test.beforeAll(async () => {
  svc = serviceClient()

  const { data: category, error: catError } = await svc
    .from('categories')
    .select('id')
    .limit(1)
    .single()
  expect(catError, 'a category must exist to hang a fixture listing off').toBeNull()

  // The city is the whole point: it is the relationship the broken select
  // reached through. A city-less fixture would render fine even on main and
  // prove nothing — PostgREST only rejects the select when it has to resolve
  // the embedded `cities(...)` column list. Pull the state code too so the
  // assertion can check the value actually reached the page, not merely that
  // the page loaded.
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

  const { data: listing, error: insertError } = await svc
    .from('listings')
    .insert({
      name: NAME,
      slug: SLUG,
      entity_type: 'business',
      category_id: (category as { id: string }).id,
      city_id: cityRow.id,
      status: 'published',
      tagline: 'Fixture for the vendor storefront spec',
    })
    .select('id')
    .single()
  expect(insertError, `fixture listing insert failed: ${insertError?.message}`).toBeNull()

  listingId = (listing as { id: string }).id
})

test.afterAll(async () => {
  if (!listingId) return
  await svc.from('listings').delete().eq('id', listingId)
})

test.describe('vendor storefront', () => {
  test('a published listing with a city renders its storefront instead of 404ing', async ({
    page,
  }) => {
    const response = await page.goto(`/vendors/${SLUG}`)

    // Assert the status before anything else. Playwright renders a 404 body
    // happily, so a content-only assertion would report a confusing "text not
    // found" instead of the real answer, which is the HTTP code.
    expect(response, 'no response for /vendors/<slug>').not.toBeNull()
    expect(
      response!.status(),
      'the vendor storefront must not 404 — the listing select is failing'
    ).toBe(200)

    // A COMING_SOON_MODE redirect also answers 200 (at /coming-soon), so pin
    // the final URL. Without this, the gate being on would make the spec pass
    // while never reaching the page under test.
    expect(page.url(), 'expected to land on the vendor route, not a redirect').toContain(
      `/vendors/${SLUG}`
    )

    await expect(page.getByRole('heading', { name: NAME })).toBeVisible()

    // The city line is the fixed code path. `${name}, ${code}` is what the page
    // renders, and it is only reachable if the embedded join resolved.
    if (stateCode) {
      await expect(page.getByText(`${cityName}, ${stateCode}`)).toBeVisible()
    }
  })
})
