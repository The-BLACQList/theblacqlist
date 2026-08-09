import { test, expect, type Page } from '@playwright/test'
import {
  walkTabOrder,
  interactiveCount,
  activeElementHasVisibleFocus,
  assertModalFocusTrap,
} from './helpers/keyboard'

const RESULTS = 'section[aria-label="Discovery results"]'

// Navigate from /discover to the first listing detail page (no hardcoded slug).
async function gotoFirstListing(page: Page) {
  await page.goto('/discover')
  const grid = page.locator(RESULTS)
  await grid.waitFor()
  await grid.getByRole('link', { name: 'View Page' }).first().click()
  await page.waitForURL((url) => /^\/[^/]+\/[^/]+\/[^/]+/.test(url.pathname), { timeout: 60_000 })
  await page.locator('main').first().waitFor()
}

// Tab until the active element matches `predicate`, or fail after `max` tabs.
async function tabUntil(page: Page, predicate: () => boolean, max = 40): Promise<boolean> {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab')
    if (await page.evaluate(predicate)) return true
  }
  return false
}

test.describe('J. Accessibility — keyboard & focus', () => {
  test('J6 — keyboard nav on listing page (reachable + focus ring)', async ({ page }) => {
    await gotoFirstListing(page)

    // Reachability: tabbing lands on real interactive elements, never lost to <body>.
    const visited = await walkTabOrder(page, 40)
    expect(interactiveCount(visited), 'should reach multiple interactive elements').toBeGreaterThan(4)
    const lostToBody = visited.filter((v) => v.tag === 'body' || v.tag === 'none').length
    expect(lostToBody, 'focus should never be lost to <body>').toBe(0)

    // Focus ring: reach the hero CTA via keyboard and confirm a visible indicator.
    await page.goto(page.url()) // reset focus to top of the same listing
    await page.locator('main').first().waitFor()
    const reached = await tabUntil(page, () => document.activeElement?.id === 'hero-cta')
    expect(reached, 'hero CTA should be keyboard-reachable').toBe(true)
    expect(
      await activeElementHasVisibleFocus(page),
      'hero CTA should show a visible focus ring'
    ).toBe(true)
  })

  test('J7 — keyboard nav through search to first result', async ({ page }) => {
    await page.goto('/discover')
    await page.locator(RESULTS).waitFor()

    // Derive a query word from a real result so the search is guaranteed to match.
    // Scoped to the card heading link on purpose: the results section also holds
    // the "How ranking works" disclosure link (DiscoveryGrid), which precedes the
    // cards in DOM order. A bare `${RESULTS} a` picks that up and searches "How".
    const firstName = await page
      .locator(`${RESULTS} article h3 a`)
      .first()
      .textContent()
    const queryWord = (firstName ?? 'a').trim().split(/\s+/).find((w) => w.length >= 3) ?? 'a'

    // Tab to the search input, type, and submit with Enter.
    const reachedInput = await tabUntil(page, () => document.activeElement?.id === 'discovery-search')
    expect(reachedInput, 'search input should be keyboard-reachable').toBe(true)
    await page.keyboard.type(queryWord)
    await page.keyboard.press('Enter')

    await page.waitForURL((url) => /[?&]q=/.test(url.search), { timeout: 30_000 })
    await page.locator(RESULTS).waitFor()
    await expect(
      page.locator(`${RESULTS} a`).first(),
      `search for "${queryWord}" should return at least one result`
    ).toBeVisible()

    // Tab to the first result link and activate it with Enter. Must be a link
    // inside a result card — the disclosure link sits in the same section and
    // goes to /how-ranking-works, which would never match the listing URL below.
    const reachedResult = await tabUntil(page, () => {
      const el = document.activeElement
      const section = document.querySelector('section[aria-label="Discovery results"]')
      return (
        !!el &&
        !!section &&
        section.contains(el) &&
        el.tagName.toLowerCase() === 'a' &&
        !!el.closest('article')
      )
    })
    expect(reachedResult, 'first result link should be keyboard-reachable').toBe(true)
    await page.keyboard.press('Enter')
    await page.waitForURL((url) => /^\/[^/]+\/[^/]+\/[^/]+/.test(url.pathname), { timeout: 60_000 })
  })

  test('J8 — skip link appears on first Tab', async ({ page }) => {
    for (const path of ['/', '/discover', '/sign-up']) {
      await page.goto(path)
      await page.locator('main').first().waitFor()
      await page.keyboard.press('Tab')

      const isSkipLink = await page.evaluate(
        () => document.activeElement?.getAttribute('href') === '#main-content'
      )
      expect(isSkipLink, `${path}: first Tab should focus the skip link`).toBe(true)

      // focus:not-sr-only should expand it into a real, visible box.
      const box = await page.locator('a[href="#main-content"]').boundingBox()
      expect(box && box.width > 10 && box.height > 10, `${path}: skip link should be visible`).toBe(true)

      // Target exists.
      await expect(page.locator('#main-content')).toHaveCount(1)
    }
  })

  test('J9 — sign-in forgot-password link is in logical focus order', async ({ page }) => {
    await page.goto('/sign-in')
    await page.locator('#password').waitFor()

    // Walk the tab order and record when each key control receives focus.
    const order: string[] = []
    let forgotFocusVisible = false
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab')
      const id = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el) return null
        if (el.id === 'email') return 'email'
        if (el.id === 'password') return 'password'
        if (el.getAttribute('aria-label')?.toLowerCase().includes('password') && el.tagName === 'BUTTON')
          return 'toggle'
        if (el.getAttribute('href') === '/forgot-password') return 'forgot'
        if (el.getAttribute('type') === 'submit') return 'submit'
        return null
      })
      // Reached via keyboard, so :focus-visible applies — check the ring here.
      if (id === 'forgot') forgotFocusVisible = await activeElementHasVisibleFocus(page)
      if (id && order[order.length - 1] !== id) order.push(id)
      if (id === 'submit') break
    }

    const pos = (k: string) => order.indexOf(k)
    expect(pos('forgot'), `forgot-password link not reached by keyboard (order: ${order.join(' → ')})`).toBeGreaterThan(-1)
    expect(pos('password'), 'password field should be focused before the forgot-password link').toBeLessThan(pos('forgot'))
    expect(pos('forgot'), 'forgot-password link should be focused before the submit button').toBeLessThan(pos('submit'))
    expect(forgotFocusVisible, 'forgot-password link should show a focus ring when keyboard-focused').toBe(true)
  })

  test('J15a — modal focus trap: mobile navigation (Radix)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/')
    await page.locator('main').first().waitFor()
    await assertModalFocusTrap(page, {
      trigger: page.getByRole('button', { name: 'Open navigation menu' }),
      name: 'Mobile nav',
    })
  })

  // Report-correction dialog — migrated to Radix Dialog (ticket 096), which
  // provides focus trap, Escape, and focus restore.
  test('J15b — modal focus trap: report-correction dialog', async ({ page }) => {
    await page.goto('/discover')
    await page.locator(RESULTS).getByRole('link', { name: 'View Page' }).first().click()
    await page.waitForURL((url) => /^\/[^/]+\/[^/]+\/[^/]+/.test(url.pathname), { timeout: 60_000 })
    await page.locator('main').first().waitFor()
    await assertModalFocusTrap(page, {
      trigger: page.getByRole('button', { name: 'Report incorrect information' }),
      name: 'Report correction',
    })
  })
})
