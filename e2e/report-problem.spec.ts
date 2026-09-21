import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loginAsAdmin, loginAsOwner } from './helpers/auth'
import { FIXTURE_OWNED_SLUG, fixtureListingUrl } from './helpers/fixtures'

/**
 * Report a problem, end to end (2026-09-21, pre-invite item 1).
 *
 * A signed-in owner sends a report from a listing page; the admin sees it on
 * /admin/feedback under New, moves it to Triaged, and the row leaves the New
 * tab. The whole loop the founder asked for ("somewhere that is immediately
 * actionable") in one test, so it cannot pass with half of it wired.
 *
 * Hermetic: the report body carries a per-run id, the assertions match on
 * that id, and afterAll deletes every row that carries it. The table has no
 * client policies, so cleanup goes through the service client.
 */

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const BODY = `E2E problem report ${RUN_ID}: the save button did nothing on the first click.`

let svc: SupabaseClient

test.beforeAll(() => {
  svc = serviceClient()
})

test.afterAll(async () => {
  await svc.from('problem_reports').delete().like('body', `%${RUN_ID}%`)
})

test.describe('report a problem', () => {
  test('signed-out visitors do not get the button', async ({ page }) => {
    await page.goto(fixtureListingUrl(FIXTURE_OWNED_SLUG))
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Report a problem' })).toHaveCount(0)
  })

  test('owner sends a report; admin sees and triages it', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto(fixtureListingUrl(FIXTURE_OWNED_SLUG))

    const trigger = page.getByRole('button', { name: 'Report a problem' })
    await expect(trigger).toBeVisible()
    await trigger.click()

    const dialog = page.getByRole('dialog', { name: 'Report a problem' })
    await expect(dialog).toBeVisible()

    // Under the floor: the server rejects it and the text survives (controlled
    // textarea), which is the whole reason the form is controlled.
    const textarea = dialog.getByLabel('What went wrong?')
    await textarea.fill('too short')
    await dialog.getByRole('button', { name: 'Send report' }).click()
    await expect(dialog.getByRole('alert')).toContainText('Tell us a little more')
    await expect(textarea).toHaveValue('too short')

    await textarea.fill(BODY)
    await dialog.getByRole('button', { name: 'Send report' }).click()
    await expect(dialog.getByRole('status')).toHaveText('Thanks. We read every one of these.')

    // Row landed with the pathname (no query string) and the owner's role.
    const { data: rows } = await svc
      .from('problem_reports')
      .select('page_path, role, status')
      .like('body', `%${RUN_ID}%`)
    expect(rows).toHaveLength(1)
    const row0 = rows![0]!
    expect(row0.page_path).toBe(fixtureListingUrl(FIXTURE_OWNED_SLUG))
    expect(row0.status).toBe('new')

    // Same browser, new session: the admin works the queue.
    await page.context().clearCookies()
    await loginAsAdmin(page)
    await page.goto('/admin/feedback')
    await expect(page.getByRole('heading', { name: 'Feedback', level: 1 })).toBeVisible()

    const row = page.getByRole('row').filter({ hasText: RUN_ID })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Mark triaged' }).click()

    // The page revalidates; the row leaves New and shows under Triaged.
    await expect(page.getByRole('row').filter({ hasText: RUN_ID })).toHaveCount(0)
    await page.goto('/admin/feedback?status=triaged')
    await expect(page.getByRole('row').filter({ hasText: RUN_ID })).toBeVisible()

    const { data: after } = await svc
      .from('problem_reports')
      .select('status')
      .like('body', `%${RUN_ID}%`)
      .single()
    expect(after?.status).toBe('triaged')
  })
})
