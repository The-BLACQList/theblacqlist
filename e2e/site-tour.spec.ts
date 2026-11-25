import { test, expect, type Page } from '@playwright/test'

// The first-visit site tour (ticket 280). It is closed by default everywhere
// and playwright.config.ts does not open it: it would open over every other
// spec's first page. To run this spec:
//
//   FEATURE_SITE_TOUR=true FEATURE_AI_ASSISTANT=true \
//   FEATURE_OWNER_RECEIPT_REVIEW=true pnpm exec playwright test e2e/site-tour.spec.ts
//
// Every test skips when the server says the tour is off. /api/cue is answered
// here, so no test calls Anthropic.

const ROOT = '#blq-site-tour'
const KEY = 'blq-site-tour-v1'
const QUESTION = 'Do you own a Black-owned business?'
const QUIT_NOTE = /You can take the tour again from the link at the bottom of the page/

const tour = (page: Page) => page.locator(ROOT)
const heading = (page: Page) => page.locator(`${ROOT} #blq-tour-title`)
const press = (page: Page, name: string) =>
  tour(page).getByRole('button', { name, exact: true }).click()
const memory = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), KEY)

/** A tour step is up: its card and, once the page has settled, the light. */
async function step(page: Page, title: string, count?: string) {
  await expect(heading(page)).toHaveText(title, { timeout: 25_000 })
  if (count) await expect(page.locator('.blq-tour-count')).toHaveText(count)
  await expect(page.locator('.blq-tour-ring')).toHaveAttribute('d', /^M/, { timeout: 15_000 })
}

/** Nothing of the tour is left on the page. */
async function clean(page: Page) {
  await expect(page.locator('.blq-tour-scrim, .blq-tour-card, .blq-tour-full, .blq-tour-cover')).toHaveCount(0)
  await expect(page.locator('[inert]:not(.silo-intro)')).toHaveCount(0)
  await expect(page.locator('body[data-site-tour-on]')).toHaveCount(0)
  await expect(page.locator('html[data-site-tour-lock]')).toHaveCount(0)
}

async function answerCue(page: Page, after = 300) {
  await page.route('**/api/cue', async (route) => {
    await new Promise((done) => setTimeout(done, after))
    const card = (name: string, i: number) => ({
      id: `e2e-${i}`,
      name,
      href: '/example',
      categoryName: 'Food',
      cityLabel: 'Detroit, MI',
      rating: 4.8,
      reviewCount: 12,
      imageSrc: null,
    })
    const events = [
      { type: 'status', text: 'Searching' },
      { type: 'cards', cards: ['Motor City Catering', 'Sweet Corner Bakery'].map(card) },
      { type: 'done', text: 'Here are two places in Detroit for a party.' },
    ]
    await route
      .fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: events.map((event) => JSON.stringify(event)).join('\n') + '\n',
      })
      .catch(() => {})
  })
}

async function toQuestion(page: Page, path = '/') {
  await page.goto(path)
  await expect(heading(page)).toHaveText(QUESTION, { timeout: 25_000 })
}

async function toCue(page: Page) {
  await toQuestion(page)
  await press(page, 'No, I’m Here to Find One')
  await step(page, 'Ask Cue')
}

test.describe('Site tour', () => {
  test.beforeEach(async ({ request }) => {
    const html = await (await request.get('/')).text()
    test.skip(!html.includes('SiteTourLauncher'), 'The site tour is off on this server')
  })

  test('opens on a first visit to the home page and asks the question', async ({ page }) => {
    await page.goto('/')
    await expect(heading(page)).toHaveText('Welcome to The BLACQList', { timeout: 25_000 })
    await expect(heading(page)).toHaveText(QUESTION)
    await expect(page.locator(ROOT).getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    expect((await memory(page)).seenAt).toBeTruthy()
  })

  test('owner path: every step, then Claim Your Page', async ({ page }) => {
    test.setTimeout(180_000)
    await toQuestion(page, '/for-business')
    await press(page, 'Yes, I Own One')
    await expect(heading(page)).toHaveText('Your Page May Already Be Here')
    await step(page, 'Search Your Business Name', 'Step 1 of 4')
    await expect(page).toHaveURL(/\/search/)
    await press(page, 'Next')
    await step(page, 'Add Your Business', 'Step 2 of 4')
    await expect(page).toHaveURL(/\/for-business/)
    await press(page, 'Next')
    await step(page, 'The Collective · Beta', 'Step 3 of 4')
    await expect(page).toHaveURL(/\/flow-map\?view=live/)
    await press(page, 'Next')
    await step(page, 'Start Free', 'Step 4 of 4')
    await press(page, 'Next')
    await step(page, 'Ready When You Are')
    await expect(tour(page).getByRole('button', { name: 'Add Your Business' })).toBeVisible()
    expect((await memory(page)).completedAt).toBeTruthy()
    await press(page, 'Claim Your Page')
    // Signed out: sign in first, then the claim page (founder, 2026-11-24).
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fclaim/, { timeout: 30_000 })
    await clean(page)
  })

  test('shopper path on a phone, with one Cue answer', async ({ browser, baseURL }) => {
    test.setTimeout(180_000)
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    })
    const page = await context.newPage()
    await answerCue(page, 1500)
    await toCue(page)
    await press(page, 'Try an Example')
    await expect(heading(page)).toHaveText('Cue Is Looking')
    await step(page, 'Cue’s Answer')
    await expect(page.getByText('Motor City Catering')).toBeVisible()
    await press(page, 'Next')
    await step(page, 'Explore the Map')
    await expect(page).toHaveURL(/\/map/)
    for (let i = 0; i < 4; i++) {
      await press(page, 'Next')
      await expect(page.locator(`${ROOT} .blq-tour-card`)).toBeVisible({ timeout: 25_000 })
      const title = await heading(page).textContent()
      if (title === 'Welcome to The BLACQList') break
      await step(page, title ?? '')
    }
    await step(page, 'Welcome to The BLACQList')
    // The lit bar stays above the sheet.
    const bar = await page.locator('[data-site-tour="cue-field"]').boundingBox()
    const sheet = await page.locator('.blq-tour-card').boundingBox()
    expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeLessThanOrEqual(sheet?.y ?? 0)
    await press(page, 'Start Exploring')
    await clean(page)
    await context.close()
  })

  test('End Tour says how to take it again, and a reload stays quiet', async ({ page }) => {
    await toQuestion(page, '/for-business')
    await press(page, 'Yes, I Own One')
    await step(page, 'Search Your Business Name')
    await tour(page).locator('.is-end-tour').click()
    await expect(page.getByText(QUIT_NOTE)).toBeVisible()
    await clean(page)
    await page.reload()
    await page.waitForTimeout(3000)
    await expect(tour(page)).toHaveCount(0)
  })

  test('Not Now ends it for good', async ({ page }) => {
    await toQuestion(page)
    await press(page, 'Not Now')
    await expect(page.getByText(QUIT_NOTE)).toBeVisible()
    await clean(page)
    await page.goto('/for-business')
    await page.waitForTimeout(3000)
    await expect(tour(page)).toHaveCount(0)
  })

  test('the footer link takes it again, from the question', async ({ page }) => {
    await toQuestion(page)
    await press(page, 'Not Now')
    await page.getByRole('contentinfo').getByRole('button', { name: 'Take the Tour' }).click()
    await expect(heading(page)).toHaveText(QUESTION, { timeout: 25_000 })
  })

  test('the footer link goes 30 days after the first visit', async ({ page }) => {
    const old = new Date(Date.now() - 31 * 86_400_000).toISOString()
    await page.addInitScript(
      ([key, at]) => localStorage.setItem(key!, JSON.stringify({ seenAt: at, endedAt: at })),
      [KEY, old]
    )
    await page.goto('/')
    await page.waitForTimeout(2000)
    await expect(page.getByRole('button', { name: 'Take the Tour' })).toHaveCount(0)
  })

  for (const when of ['opening', 'question', 'chapter', 'step', 'crossing'] as const) {
    test(`Esc ends it during the ${when}`, async ({ page }) => {
      await page.goto('/for-business')
      await expect(heading(page)).toHaveText('Welcome to The BLACQList', { timeout: 25_000 })
      if (when !== 'opening') await expect(heading(page)).toHaveText(QUESTION)
      if (when === 'chapter' || when === 'step' || when === 'crossing') {
        await press(page, 'Yes, I Own One')
        await expect(heading(page)).toHaveText('Your Page May Already Be Here')
      }
      if (when === 'step' || when === 'crossing') await step(page, 'Search Your Business Name')
      if (when === 'crossing') {
        await press(page, 'Next')
        await page.waitForTimeout(120)
      }
      await page.keyboard.press('Escape')
      await expect(page.getByText(QUIT_NOTE)).toBeVisible()
      await clean(page)
      expect((await memory(page)).endedAt).toBeTruthy()
    })
  }

  test('a reload picks up at the same step', async ({ page }) => {
    await toQuestion(page, '/for-business')
    await press(page, 'Yes, I Own One')
    await step(page, 'Search Your Business Name')
    await press(page, 'Next')
    await step(page, 'Add Your Business')
    await page.reload()
    await step(page, 'Add Your Business', 'Step 2 of 4')
  })

  test('Back from the first step returns to the question', async ({ page }) => {
    await toQuestion(page, '/for-business')
    await press(page, 'Yes, I Own One')
    await step(page, 'Search Your Business Name')
    await press(page, 'Back')
    await expect(heading(page)).toHaveText(QUESTION)
  })

  test('a first visit deeper in the site gets the small prompt, once', async ({ page }) => {
    await page.goto('/blacqlight')
    const prompt = page.locator('.blq-tour-prompt')
    await expect(prompt).toBeVisible({ timeout: 25_000 })
    await expect(page.locator('[inert]')).toHaveCount(0)
    await prompt.getByRole('button', { name: 'Close' }).click()
    await expect(prompt).toHaveCount(0)
    await page.goto('/')
    await page.waitForTimeout(3000)
    await expect(tour(page)).toHaveCount(0)
  })

  test('the prompt opens the tour', async ({ page }) => {
    await page.goto('/blacqlight')
    await page.locator('.blq-tour-prompt').getByRole('button', { name: 'Take the Tour' }).click()
    await expect(heading(page)).toHaveText(QUESTION, { timeout: 25_000 })
  })

  test('stays off sign-in, account and admin pages', async ({ page }) => {
    for (const path of ['/sign-in', '/account', '/admin']) {
      await page.goto(path)
      await page.waitForTimeout(2500)
      await expect(tour(page)).toHaveCount(0)
    }
  })

  test('reduced motion: every card still comes up', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await toQuestion(page, '/for-business')
    await press(page, 'Yes, I Own One')
    await step(page, 'Search Your Business Name')
    const moving = await page.evaluate(
      (root) =>
        document
          .querySelector(root)!
          .getAnimations({ subtree: true })
          .filter((one) => one.playState === 'running').length,
      ROOT
    )
    expect(moving).toBe(0)
    await context.close()
  })

  test('only the step’s own parts can be used', async ({ page }) => {
    await answerCue(page)
    await toCue(page)
    await expect(page.locator('#ai-guide-input')).toBeEditable()
    const inert = await page
      .getByRole('contentinfo')
      .evaluate((el) => el.closest('[inert]') !== null)
    expect(inert).toBe(true)
  })

  test('the visitor’s own words work too, and the bar keeps its Enter key', async ({ page }) => {
    await answerCue(page)
    await toCue(page)
    await page.locator('#ai-guide-input').fill('a baker')
    await page.keyboard.press('Enter')
    await step(page, 'Cue’s Answer')
    await expect(page).toHaveURL(/\/$/)
  })

  test('Stop keeps the tour on step 1 with Next', async ({ page }) => {
    await answerCue(page, 20_000)
    await toCue(page)
    await press(page, 'Try an Example')
    await expect(heading(page)).toHaveText('Cue Is Looking')
    await page.locator('[data-site-tour="cue-answer"]').getByRole('button', { name: /Stop/ }).click()
    await expect(heading(page)).toHaveText('Ask Cue')
    await press(page, 'Next')
    await step(page, 'Explore the Map')
  })

  test('after 12 seconds without an answer it moves on', async ({ page }) => {
    await answerCue(page, 60_000)
    await toCue(page)
    await press(page, 'Try an Example')
    await expect(heading(page)).toHaveText('Cue Is Looking')
    await expect(heading(page)).toHaveText('Explore the Map', { timeout: 40_000 })
  })

  test('a Cue error moves on and never leaves for /search', async ({ page }) => {
    await page.route('**/api/cue', (route) => route.fulfill({ status: 503, body: '{}' }))
    await toCue(page)
    await press(page, 'Try an Example')
    await step(page, 'Explore the Map')
    await expect(page).toHaveURL(/\/map/)
  })

  test('opening a business ends the tour, and the note shows there', async ({ page }) => {
    await answerCue(page)
    await toCue(page)
    await press(page, 'Try an Example')
    await step(page, 'Cue’s Answer')
    await page.getByText('Motor City Catering').click()
    await expect(page).toHaveURL(/\/example/, { timeout: 30_000 })
    await expect(page.getByText(QUIT_NOTE)).toBeVisible()
    await clean(page)
  })

  test('a slow page still gets the note', async ({ page }) => {
    await answerCue(page)
    await toCue(page)
    await press(page, 'Try an Example')
    await step(page, 'Cue’s Answer')
    await page.route(/\/example/, async (route) => {
      await new Promise((r) => setTimeout(r, 3000))
      await route.continue()
    })
    await page.getByText('Motor City Catering').click()
    // Shown while the page is still on its way…
    await expect(page.getByText(QUIT_NOTE)).toBeVisible()
    // …and still there once it arrives.
    await expect(page).toHaveURL(/\/example/, { timeout: 30_000 })
    await page.waitForTimeout(500)
    await expect(page.getByText(QUIT_NOTE)).toBeVisible()
    await clean(page)
  })
})
