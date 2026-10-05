import { test, expect, type APIRequestContext } from '@playwright/test'

// Opening-soon covers (ticket 122). Marketplace, Jobs and The Collective sit
// behind FEATURE_*_OPEN flags. Off, proxy.ts shows the cover at the feature's
// own address and its data APIs answer 403. On, the real pages come back.
//
// The flags default OFF everywhere, but playwright.config.ts opens them for the
// server it boots so the rest of the suite keeps seeing the real pages. To
// exercise the covers, keep them closed explicitly:
//
//   FEATURE_COLLECTIVE_OPEN=false FEATURE_JOBS_OPEN=false \
//   FEATURE_MARKETPLACE_OPEN=false pnpm exec playwright test e2e/opening-soon.spec.ts
//
// Each test probes the server first and runs the branch that matches, so the
// spec passes in either state and never asserts the wrong one.

async function collectiveCovered(request: APIRequestContext): Promise<boolean> {
  const res = await request.get('/api/community-spend')
  return res.status() === 403
}

async function pageCovered(request: APIRequestContext, path: string): Promise<boolean> {
  const html = await (await request.get(path)).text()
  return /isn(&#x27;|')t open yet/.test(html)
}

test.describe('Opening-soon covers', () => {
  test('The Collective APIs refuse while covered', async ({ request }) => {
    test.skip(!(await collectiveCovered(request)), 'The Collective is open on this server')

    for (const path of ['/api/community-spend', '/api/flow-map/summary']) {
      const res = await request.get(path)
      expect(res.status(), path).toBe(403)
      expect(await res.json()).toMatchObject({ code: 'FEATURE_NOT_OPEN' })
    }
  })

  test('The Collective map shows the cover at its own address', async ({ page, request }) => {
    test.skip(!(await collectiveCovered(request)), 'The Collective is open on this server')

    await page.goto('/flow-map')
    await expect(page).toHaveURL(/\/flow-map$/)
    await expect(
      page.getByRole('heading', { level: 1, name: "The Collective isn't open yet." })
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Tell me when it opens' })).toBeVisible()
  })

  for (const [path, name] of [
    ['/marketplace', 'The Marketplace'],
    ['/jobs', 'Jobs'],
  ] as const) {
    test(`${path} shows the cover while covered`, async ({ page, request }) => {
      test.skip(!(await pageCovered(request, path)), `${name} is open on this server`)

      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(
        page.getByRole('heading', { level: 1, name: `${name} isn't open yet.` })
      ).toBeVisible()
    })
  }

  test('the cover is not indexed', async ({ request }) => {
    test.skip(!(await collectiveCovered(request)), 'The Collective is open on this server')

    const html = await (await request.get('/flow-map')).text()
    expect(html).toMatch(/<meta name="robots" content="noindex/)
  })

  test('/soon sends people to the real page once a feature is open', async ({ request }) => {
    test.skip(await collectiveCovered(request), 'The Collective is covered on this server')

    const res = await request.get('/soon/collective', { maxRedirects: 0 })
    expect([307, 308]).toContain(res.status())
    expect(res.headers()['location']).toMatch(/\/flow-map$/)
  })

  test('The Collective data API answers when open', async ({ request }) => {
    test.skip(await collectiveCovered(request), 'The Collective is covered on this server')

    const res = await request.get('/api/community-spend')
    expect(res.status()).not.toBe(403)
  })
})
