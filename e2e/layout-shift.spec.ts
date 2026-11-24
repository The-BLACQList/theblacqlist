import { test, expect, type Page } from '@playwright/test'

// Ticket 272. Speed Insights read CLS 0.23: the page loader was 70% of the screen
// tall, so the footer showed under it and was pushed away when the page arrived.
//
// The first block is exact on any data: it cuts the streamed page off at its loader
// and looks at where the footer is. The second measures real loads and real clicks
// from Home. It reads what the browser counts, so a shift within half a second of a
// click is left out, as it is in the field.

const SIZES = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
]

const PAGES = ['/flow-map', '/map', '/discover', '/jobs']

/** Pages whose own HTML carries the loader. /map shows it only on the way from another page. */
const STREAMED = ['/flow-map', '/discover', '/jobs']

/** Web Vitals "good". */
const LIMIT = 0.1

test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
  },
})

/** Serves the page without the parts that stream in after the loader. */
async function stopAtLoader(page: Page, path: string) {
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      if (route.request().resourceType() !== 'document') return route.continue()
      const response = await route.fetch()
      const html = await response.text()
      const cut = html.search(/<div hidden id="S:/)
      await route.fulfill({ response, body: cut === -1 ? html : html.slice(0, cut) })
    }
  )
  await page.goto(path, { waitUntil: 'commit' })
}

/** The worst window of shifts, the way CLS is defined: gaps under 1s, 5s at most. */
async function watchShifts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number; __resetCls: () => void }
    let sum = 0
    let first = 0
    let last = 0
    w.__cls = 0
    w.__resetCls = () => {
      sum = first = last = 0
      w.__cls = 0
    }
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }
        if (shift.hadRecentInput) continue
        const sameWindow = sum > 0 && shift.startTime - last < 1000 && shift.startTime - first < 5000
        if (!sameWindow) {
          sum = 0
          first = shift.startTime
        }
        sum += shift.value
        last = shift.startTime
        w.__cls = Math.max(w.__cls, sum)
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
}

const readCls = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls)

for (const size of SIZES) {
  test.describe(`Layout shift, ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } })

    for (const path of STREAMED) {
      test(`${path}: the loader keeps the footer below the screen`, async ({ page }) => {
        await stopAtLoader(page, path)
        await expect(page.locator('.blacq-loader')).toBeVisible()
        const footerTop = () =>
          page
            .locator('footer')
            .last()
            .evaluate((el) => Math.ceil(el.getBoundingClientRect().top))
        await expect.poll(footerTop).toBeGreaterThanOrEqual(size.height)
      })
    }

    for (const path of PAGES) {
      test(`${path}: a direct load holds still`, async ({ page }) => {
        await watchShifts(page)
        await page.goto(path)
        await expect(page.locator('.blacq-loader')).toHaveCount(0, { timeout: 60_000 })
        await page.waitForTimeout(4000)
        expect(await readCls(page)).toBeLessThanOrEqual(LIMIT)
      })

      test(`${path}: a click from Home holds still`, async ({ page }) => {
        await watchShifts(page)
        await page.goto('/')
        await page.waitForTimeout(1500)
        const link = page.locator(`a[href="${path}"]`).first()
        // A DOM click works for links inside a closed phone menu.
        await page.evaluate(() => (window as unknown as { __resetCls: () => void }).__resetCls())
        await link.evaluate((el: HTMLElement) => el.click())
        await page.waitForURL(`**${path}`)
        await expect(page.locator('.blacq-loader')).toHaveCount(0, { timeout: 60_000 })
        await page.waitForTimeout(4000)
        expect(await readCls(page)).toBeLessThanOrEqual(LIMIT)
      })
    }
  })
}
