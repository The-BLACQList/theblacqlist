import { test, expect } from '@playwright/test'

/**
 * /join flyer admission (pre-invite item 6, 2026-09-21).
 *
 * Needs the dev server started with throwaway values for TESTER_FLYER_CODE,
 * COMING_SOON_BYPASS_TOKEN and COMING_SOON_MODE=true, plus the flyer value in
 * E2E_FLYER_CODE for this process; skipped otherwise so the default suite is
 * unaffected. Without a bypass token the gate has nothing to honor and the
 * right code still ends on /coming-soon, which is correct and is what test 3
 * would report. Never run this against a server holding the real values.
 *
 *   COMING_SOON_MODE=true COMING_SOON_BYPASS_TOKEN=throwaway TESTER_FLYER_CODE=throwaway \
 *   E2E_FLYER_CODE=throwaway pnpm exec playwright test e2e/join-flyer.spec.ts
 */

const FLYER = process.env.E2E_FLYER_CODE

test.describe('/join flyer link', () => {
  test.skip(!FLYER, 'E2E_FLYER_CODE not set; see the header comment')

  test('a wrong code lands on /coming-soon with no cookies set', async ({ page, context }) => {
    await page.goto('/join?code=definitely-not-it')
    await expect(page).toHaveURL(/\/coming-soon$/)
    const names = (await context.cookies()).map((c) => c.name)
    expect(names).not.toContain('bl_preview')
    expect(names).not.toContain('bl_src')
  })

  test('no code at all lands on /coming-soon', async ({ page }) => {
    await page.goto('/join')
    await expect(page).toHaveURL(/\/coming-soon$/)
  })

  test('the right code sets the cookies and lands on sign-up', async ({ page, context }) => {
    await page.goto(`/join?code=${encodeURIComponent(FLYER!)}`)
    await expect(page).toHaveURL(/\/sign-up$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const cookies = await context.cookies()
    const src = cookies.find((c) => c.name === 'bl_src')
    expect(src?.value).toBe('flyer')
    expect(src?.httpOnly).toBe(true)
    // bl_preview only exists when the server has a bypass token configured;
    // when present it must be httpOnly so a page script cannot read it.
    const preview = cookies.find((c) => c.name === 'bl_preview')
    if (preview) expect(preview.httpOnly).toBe(true)
  })

  test('the code is not echoed anywhere in the redirect chain', async ({ page }) => {
    const seen: string[] = []
    page.on('response', (r) => seen.push(r.url()))
    await page.goto('/join?code=probe-value-xyz')
    await expect(page).toHaveURL(/\/coming-soon$/)
    for (const url of seen.slice(1)) expect(url).not.toContain('probe-value-xyz')
  })
})
