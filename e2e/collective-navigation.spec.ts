import { test, expect, type Page } from '@playwright/test'

// Tickets 174-179. The Collective has to hold still at rest, follow the page
// while it scrolls, and keep its card and controls on screen at every size.
// Software WebGL so the scene draws in headless Chromium. The specs read the
// HUD, so they hold on any data, staging or a fresh database.

test.use({
  launchOptions: {
    args: [
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--enable-unsafe-swiftshader',
    ],
  },
})

const SIZES = [
  { name: 'phone 375', width: 375, height: 812, touch: true },
  { name: 'sideways phone 844x390', width: 844, height: 390, touch: true },
  { name: 'desktop 1280', width: 1280, height: 800, touch: false },
]

async function openMap(page: Page) {
  await page.goto('/flow-map')
  await page.locator('.silo-stage canvas').waitFor({ timeout: 60_000 })
  await page.waitForTimeout(1500)
}

async function pickFloor(page: Page, index: number, touch: boolean) {
  const floor = page.locator('.gauge .fl').nth(index)
  if (touch) await floor.tap()
  else await floor.click()
  await expect(floor).toHaveAttribute('aria-current', 'location')
  await page.waitForTimeout(2500)
}

/** Every label's text and place, one row per animation frame. */
function labelFrames(page: Page, frames: number) {
  return page.evaluate(
    (count) =>
      new Promise<string[]>((resolve) => {
        const rows: string[] = []
        const read = () => {
          rows.push(
            [...document.querySelectorAll<HTMLElement>('.silo-lbl.on')]
              .map((el) => `${el.textContent}|${el.style.transform}`)
              .join('\n'),
          )
          if (rows.length === count) resolve(rows)
          else requestAnimationFrame(read)
        }
        requestAnimationFrame(read)
      }),
    frames,
  )
}

function sidewaysOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
}

for (const size of SIZES) {
  test.describe(`Collective navigation at ${size.name}`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.touch,
      isMobile: size.touch,
    })

    test('labels hold still at rest', async ({ page }) => {
      await openMap(page)
      await pickFloor(page, 1, size.touch)
      // Software drawing runs at a few frames a second, so the camera lands late.
      await page.waitForTimeout(6000)
      const rows = await labelFrames(page, 120)
      expect(new Set(rows).size).toBe(1)
    })

    test('the gauge follows the floor while the page scrolls', async ({ page }) => {
      await openMap(page)
      const current = page.locator(".gauge .fl[aria-current='location']")
      const floors = page.locator('.gauge .fl')
      // Halfway down the track is the middle floor, whichever way it got there.
      await page.evaluate(() => {
        const track = document.querySelector('.silo-track') as HTMLElement
        const stage = document.querySelector('.silo') as HTMLElement
        const start = track.getBoundingClientRect().top + window.scrollY - stage.offsetTop
        const travel = track.offsetHeight - stage.offsetHeight
        window.scrollTo({ top: start + travel * 0.41, behavior: 'instant' })
      })
      await expect(current).toHaveCount(1)
      await expect(floors.nth(2)).toHaveAttribute('aria-current', 'location')
    })

    test('a floor pick shows the card with no scrolling', async ({ page }) => {
      await openMap(page)
      await pickFloor(page, 1, size.touch)
      const card = page.locator('.ctx')
      await expect(card).toContainText('Shops')
      const box = await card.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y).toBeLessThan(size.height - 40)
    })

    test('More sits above the header', async ({ page }) => {
      await openMap(page)
      const more = page.getByRole('button', { name: 'More', exact: true }).first()
      if (size.touch) await more.tap()
      else await more.click()
      await page.locator('.more-panel').waitFor()
      await page.waitForTimeout(500)
      const onTop = await page.evaluate(() => {
        const panel = document.querySelector('.more-panel') as HTMLElement
        const box = panel.getBoundingClientRect()
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + 12)
        return !!hit?.closest('.more-panel')
      })
      expect(onTop).toBe(true)
      await page.keyboard.press('Escape')
      await expect(page.locator('.more-panel')).toBeHidden()
      await expect(more).toBeFocused()
    })

    test('the page never scrolls sideways', async ({ page }) => {
      await openMap(page)
      expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0)
      await pickFloor(page, 1, size.touch)
      expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0)
    })

    test('choosing the list keeps the way back to the map', async ({ page }) => {
      await openMap(page)
      const more = page.getByRole('button', { name: 'More', exact: true }).first()
      if (size.touch) await more.tap()
      else await more.click()
      await page.locator('.more-option', { hasText: 'Explore as a list' }).click()
      await expect(page.getByRole('button', { name: 'Back to the map' })).toBeVisible()
      // The renderer drops its context a moment after unmount.
      await page.waitForTimeout(1000)
      await expect(page.getByText('The map stopped drawing.')).toHaveCount(0)
      expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0)
    })
  })
}

test.describe('Collective with reduced motion', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })

  test('no pin, and every floor is still reachable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openMap(page)
    const position = await page.evaluate(() => getComputedStyle(document.querySelector('.silo')!).position)
    expect(position).not.toBe('sticky')
    for (const index of [1, 4]) {
      const floor = page.locator('.gauge .fl').nth(index)
      await floor.tap()
      await expect(floor).toHaveAttribute('aria-current', 'location')
      await expect(page.locator('.ctx')).toBeInViewport()
    }
  })
})
