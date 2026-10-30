import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Ticket 151: the job page as a fact sheet.
 *
 * Hermetic: creates one open and one closed job (and removes them), so it does not
 * assume what the database holds. Skips cleanly when there is no Supabase service
 * key or the Jobs feature is covered (FEATURE_JOBS_OPEN off), the way the other
 * flag-gated specs do. playwright.config.ts opens the flag for the server it boots.
 */

const HAS_SUPABASE = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
)

const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const OPEN_SLUG = `e2e-job-open-${RUN_ID}`
const CLOSED_SLUG = `e2e-job-closed-${RUN_ID}`

let svc: SupabaseClient
let citySlug = ''
const listingIds: string[] = []

async function insertJob(slug: string, name: string, closesAt: string, cityId: string, categoryId: string) {
  const { data, error } = await svc
    .from('listings')
    .insert({
      name,
      slug,
      entity_type: 'job',
      category_id: categoryId,
      city_id: cityId,
      status: 'published',
      tagline: 'Fixture for the job page spec',
    })
    .select('id')
    .single()
  expect(error, `job listing insert failed: ${error?.message}`).toBeNull()
  const id = (data as { id: string }).id
  listingIds.push(id)
  const { error: dErr } = await svc.from('listing_details_job').insert({
    listing_id: id,
    description: 'A fixture role.',
    employment_type: 'full-time',
    workplace_type: 'on-site',
    apply_email: 'jobs@example.com',
    closes_at: closesAt,
  })
  expect(dErr, `job details insert failed: ${dErr?.message}`).toBeNull()
}

test.beforeAll(async () => {
  if (!HAS_SUPABASE) return
  svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { data: category } = await svc.from('categories').select('id').limit(1).single()
  const { data: city } = await svc.from('cities').select('id, slug').eq('is_active', true).limit(1).single()
  const categoryId = (category as { id: string }).id
  const c = city as { id: string; slug: string }
  citySlug = c.slug
  const future = new Date(Date.now() + 30 * 86_400_000).toISOString()
  const past = new Date(Date.now() - 5 * 86_400_000).toISOString()
  await insertJob(OPEN_SLUG, `E2E Open Job ${RUN_ID}`, future, c.id, categoryId)
  await insertJob(CLOSED_SLUG, `E2E Closed Job ${RUN_ID}`, past, c.id, categoryId)
})

test.afterAll(async () => {
  if (listingIds.length === 0) return
  await svc.from('listings').delete().in('id', listingIds)
})

test.describe('job page fact sheet', () => {
  test.skip(!HAS_SUPABASE, 'Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')

  test('open job at 375px: fact sheet, email, and a fixed apply bar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const res = await page.goto(`/${citySlug}/job/${OPEN_SLUG}`)
    test.skip(res?.status() === 404 || /isn(’|'|&#x27;)t open yet/.test(await page.content()), 'Jobs are covered on this server')
    expect(res!.status()).toBe(200)

    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible()
    await expect(page.locator('dl dt', { hasText: 'Closes' })).toBeVisible()
    await expect(page.getByText('jobs@example.com').first()).toBeVisible()

    const bar = page.locator('div.fixed.bottom-0', { has: page.getByRole('button', { name: 'Copy email' }) })
    await expect(bar).toBeVisible()
    expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe('fixed')
  })

  test('open job at 1280px: no sticky bar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const res = await page.goto(`/${citySlug}/job/${OPEN_SLUG}`)
    test.skip(res?.status() === 404, 'Jobs are covered on this server')
    expect(page.locator('div.fixed.bottom-0')).toHaveCount(1)
    await expect(page.locator('div.fixed.bottom-0')).toBeHidden()
  })

  test('closed job keeps a 200 page with the closed banner and no apply action', async ({ page }) => {
    const res = await page.goto(`/${citySlug}/job/${CLOSED_SLUG}`)
    test.skip(res?.status() === 404, 'Jobs are covered on this server')
    expect(res!.status()).toBe(200)
    await expect(page.getByText(/^Applications closed on /)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy email' })).toHaveCount(0)
  })
})
