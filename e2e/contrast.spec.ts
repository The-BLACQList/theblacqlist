import { test, expect } from '@playwright/test'

type Rgb = { r: number; g: number; b: number }

// WCAG 2.1 relative-luminance contrast ratio between two colors.
function channelLuminance(c: number): number {
  const cs = c / 255
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
}

function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function parseRgb(str: string): Rgb {
  const m = str.match(/rgba?\(([^)]+)\)/)
  if (!m || !m[1]) throw new Error(`Cannot parse color: ${str}`)
  const parts = m[1].split(',').map((n) => parseFloat(n.trim()))
  const [r, g, b] = parts
  if (r === undefined || g === undefined || b === undefined) {
    throw new Error(`Cannot parse color channels: ${str}`)
  }
  return { r, g, b }
}

export function contrastRatio(c1: Rgb, c2: Rgb): number {
  const l1 = relativeLuminance(c1)
  const l2 = relativeLuminance(c2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

const AA_NORMAL = 4.5

test.describe('J. Accessibility — color contrast', () => {
  test('J12 — amber gold buttons: #000000 on #E2A428 ≥ 4.5:1', () => {
    const ratio = contrastRatio(hexToRgb('#000000'), hexToRgb('#E2A428'))
    expect(ratio, `contrast ratio was ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  test('J13 — body text on cream: #595758 on #FCFAF4 ≥ 4.5:1', () => {
    const ratio = contrastRatio(hexToRgb('#595758'), hexToRgb('#FCFAF4'))
    expect(ratio, `contrast ratio was ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  // Tie the token math to the live UI: the hero CTA uses the amber-gold token.
  test('J12 (live) — hero CTA rendered colors meet 4.5:1', async ({ page }) => {
    await page.goto('/discover')
    await page
      .locator('section[aria-label="Discovery results"]')
      .getByRole('link', { name: 'View Page' })
      .first()
      .click()
    await page.waitForURL((url) => /^\/[^/]+\/[^/]+\/[^/]+/.test(url.pathname), { timeout: 60_000 })

    const cta = page.locator('#hero-cta')
    await cta.waitFor()
    const { bg, fg } = await cta.evaluate((el) => {
      const s = getComputedStyle(el)
      return { bg: s.backgroundColor, fg: s.color }
    })
    const ratio = contrastRatio(parseRgb(bg), parseRgb(fg))
    expect(ratio, `hero CTA contrast was ${ratio.toFixed(2)}:1 (${fg} on ${bg})`).toBeGreaterThanOrEqual(
      AA_NORMAL
    )
  })
})
