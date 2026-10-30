import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Ticket 155: a role past its closing date is 'closed'. The page stays up with the
 * closed banner and no apply action; the role is off the board.
 *
 * Hermetic: creates one closed job (and removes it). Skips cleanly when there is no
 * Supabase service key, when the database does not have the 'closed' status yet
 * (20261031000000 not applied), or when Jobs are covered (FEATURE_JOBS_OPEN off),
 * which e2e/opening-soon.spec.ts owns.
 */

const HAS_SUPABASE = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
)

const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const SLUG = `e2e-job-status-closed-${RUN_ID}`
const NAME = `E2E Status Closed Job ${RUN_ID}`

let svc: SupabaseClient
let citySlug = ''
let listingId: string | null = null
let closedSupported = false

test.beforeAll(async () => {
  if (!HAS_SUPABASE) return
  svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { data: category } = await svc.from('categories').select('id').limit(1).single()
  const { data: city } = await svc.from('cities').select('id, slug').eq('is_active', true).limit(1).single()
  const c = city as { id: string; slug: string }
  citySlug = c.slug

  const { data, error } = await svc
    .from('listings')
    .insert({
      name: NAME,
      slug: SLUG,
      entity_type: 'job',
      category_id: (category as { id: string }).id,
      city_id: c.id,
      status: 'published',
      tagline: 'Fixture for the closed job spec',
    })
    .select('id')
    .single()
  expect(error, `job listing insert failed: ${error?.message}`).toBeNull()
  listingId = (data as { id: string }).id

  const { error: dErr } = await svc.from('listing_details_job').insert({
    listing_id: listingId,
    description: 'A fixture role.',
    employment_type: 'full-time',
    workplace_type: 'on-site',
    apply_email: 'jobs@example.com',
    closes_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  })
  expect(dErr, `job details insert failed: ${dErr?.message}`).toBeNull()

  // What the sweep does. Refused by the old CHECK, so this tells us whether the
  // migration is on this database.
  const { error: closeErr } = await svc.from('listings').update({ status: 'closed' }).eq('id', listingId)
  closedSupported = !closeErr
})

test.afterAll(async () => {
  if (listingId) await svc.from('listings').delete().eq('id', listingId)
})

test.describe('closed job', () => {
  test.skip(!HAS_SUPABASE, 'Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')

  test('the page stays up with the banner and no apply action', async ({ page }) => {
    test.skip(!closedSupported, "This database has no 'closed' status yet")
    const res = await page.goto(`/${citySlug}/job/${SLUG}`)
    test.skip(/isn(’|'|&#x27;)t open yet/.test(await page.content()), 'Jobs are covered on this server')
    // A 404 here is the regression this ticket guards against, so it fails.
    expect(res!.status()).toBe(200)
    await expect(page.getByText(/^Applications closed on /)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy email' })).toHaveCount(0)
  })

  test('the role is not on the board', async ({ page }) => {
    test.skip(!closedSupported, "This database has no 'closed' status yet")
    await page.goto('/jobs')
    const h1 = page.getByRole('heading', { level: 1, name: 'Jobs', exact: true })
    test.skip(!(await h1.isVisible()), 'Jobs board is covered or unavailable here')
    await expect(page.getByText(NAME)).toHaveCount(0)
    await expect(page.locator(`a[href$="/job/${SLUG}"]`)).toHaveCount(0)
  })
})
