import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Reads whether the currently-focused element has a visible focus indicator.
 * Accepts a UA-default outline ('auto'/'solid'), an author outline, or a
 * Tailwind `focus-visible:ring-*` (which renders as a box-shadow).
 */
export async function activeElementHasVisibleFocus(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body || el === document.documentElement) return false
    const s = getComputedStyle(el)
    const outlineVisible =
      s.outlineStyle !== 'none' && parseFloat(s.outlineWidth || '0') > 0
    const outlineAuto = s.outlineStyle === 'auto'
    const ring = s.boxShadow && s.boxShadow !== 'none'
    return Boolean(outlineVisible || outlineAuto || ring)
  })
}

/** Tag/role of the currently focused element, for reachability assertions. */
export async function activeElementInfo(page: Page): Promise<{ tag: string; role: string | null; label: string | null }> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    return {
      tag: el ? el.tagName.toLowerCase() : 'none',
      role: el?.getAttribute('role') ?? null,
      label: el?.getAttribute('aria-label') ?? el?.textContent?.trim().slice(0, 40) ?? null,
    }
  })
}

const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary'])

/**
 * Tabs through the page up to `maxTabs` times, recording each focused element.
 * Returns the list of focused tags so the caller can assert reachability and
 * that focus is never lost to <body> (a sign of a focus management bug).
 */
export async function walkTabOrder(page: Page, maxTabs = 40) {
  const visited: Array<{ tag: string; role: string | null; label: string | null; focusVisible: boolean }> = []
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab')
    const info = await activeElementInfo(page)
    if (info.tag === 'none' || info.tag === 'body') {
      visited.push({ ...info, focusVisible: false })
      continue
    }
    const focusVisible = await activeElementHasVisibleFocus(page)
    visited.push({ ...info, focusVisible })
  }
  return visited
}

export function interactiveCount(visited: Array<{ tag: string }>): number {
  return visited.filter((v) => INTERACTIVE_TAGS.has(v.tag)).length
}

/**
 * Asserts a modal traps focus and is dismissible by keyboard (test J15):
 *  1. Opening the trigger moves focus into the dialog.
 *  2. Tabbing repeatedly never escapes the dialog.
 *  3. Escape closes the dialog and returns focus to the trigger.
 *
 * Throws with a descriptive message on the first violated expectation, so a
 * modal that lacks proper focus management produces a clear, actionable failure.
 */
export async function assertModalFocusTrap(
  page: Page,
  opts: { trigger: Locator; name: string; dialogSelector?: string }
) {
  const dialogSelector = opts.dialogSelector ?? '[role="dialog"]'
  await opts.trigger.scrollIntoViewIfNeeded()
  await opts.trigger.focus()
  await opts.trigger.press('Enter')

  const dialog = page.locator(dialogSelector).first()
  await expect(dialog, `${opts.name}: dialog should open`).toBeVisible()

  // 1. Focus must move into the dialog.
  const focusEntered = await dialog.evaluate((d) => d.contains(document.activeElement))
  expect(focusEntered, `${opts.name}: focus should move into the dialog on open`).toBe(true)

  // 2. Tabbing must stay within the dialog (focus trap).
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    const stillInside = await dialog.evaluate((d) => d.contains(document.activeElement))
    expect(stillInside, `${opts.name}: focus escaped the dialog after ${i + 1} Tab(s)`).toBe(true)
  }

  // 3. Escape closes and restores focus to the trigger.
  await page.keyboard.press('Escape')
  await expect(dialog, `${opts.name}: Escape should close the dialog`).toBeHidden()
  const focusRestored = await opts.trigger.evaluate((t) => t === document.activeElement)
  expect(focusRestored, `${opts.name}: focus should return to the trigger after close`).toBe(true)
}
