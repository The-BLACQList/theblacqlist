// =============================================================================
// Ticket 206 — brand and accessibility audit for /for-business
// =============================================================================
// The page Creative's build spec describes (blacqlist-for-business, DR-003 to
// DR-006), checked in a browser at phone, tablet and desktop widths:
//   - Jost only, nothing under 14px, no grey lighter than #6b6b6b on light,
//     all text at least 4.5:1, gold only on dark.
//   - One owner door: a single #start, and on a phone the first fact ends
//     inside the first screen (spec §2: at most 520px down at 375).
//   - Every chapter heading starts on the page's left gutter.
//   - No horizontal scroll, and axe finds no serious or critical violation.
// The shared plan cards (.fb-plans) are left out of the text audit: they are
// unchanged in this ticket and keep the site's own faces and sizes. axe still
// scans them, so a page rule that leaks into the cards fails here.
// =============================================================================

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const WIDTHS = [375, 1024, 1280] as const

type Audit = {
  checked: number
  font: string[]
  size: string[]
  floor: string[]
  gold: string[]
  contrast: string[]
}

function auditText(page: Page): Promise<Audit> {
  return page.evaluate(() => {
    const root = document.getElementById('fb-root')
    if (!root) throw new Error('#fb-root not found')

    const rgba = (s: string): number[] => {
      const m = s.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0]
      return m.length === 3 ? [...m, 1] : m
    }
    const lin = (c: number) => {
      const v = c / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    const lum = (c: number[]) => 0.2126 * lin(c[0]!) + 0.7152 * lin(c[1]!) + 0.0722 * lin(c[2]!)
    const ratio = (a: number[], b: number[]) => {
      const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]
      return (hi + 0.05) / (lo + 0.05)
    }
    // The first mostly opaque surface. A gradient band (the ember) reports a
    // transparent colour over its own dark ground, so read the image too.
    const surface = (el: Element): number[] => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e)
        const c = rgba(cs.backgroundColor)
        if (c[3]! > 0.5) return c
      }
      return [255, 255, 255, 1]
    }
    const over = (fg: number[], bg: number[]) =>
      fg.slice(0, 3).map((v, i) => v * fg[3]! + bg[i]! * (1 - fg[3]!))
    const FLOOR = lum([107, 107, 107]) // #6b6b6b
    const GOLDS = [
      [196, 160, 101],
      [255, 216, 103],
    ]

    const out: Audit = { checked: 0, font: [], size: [], floor: [], gold: [], contrast: [] }
    const seen = new Set<Element>()
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const el = n.parentElement
      if (!el || !n.textContent?.trim() || seen.has(el)) continue
      seen.add(el)
      if (el.closest('.fb-plans, .sr-only, [hidden], script, style')) continue
      const cs = getComputedStyle(el)
      const box = el.getBoundingClientRect()
      if (box.width <= 1 || cs.visibility === 'hidden' || cs.display === 'none') continue

      out.checked++
      const t = `"${n.textContent.trim().slice(0, 40)}"`
      if (!/jost/i.test(cs.fontFamily.split(',')[0] ?? ''))
        out.font.push(`${t} is set in ${cs.fontFamily}`)
      if (parseFloat(cs.fontSize) < 14) out.size.push(`${t} is ${cs.fontSize}`)

      const bg = surface(el)
      const fg = over(rgba(cs.color), bg)
      if (lum(bg) > 0.4) {
        const grey = Math.max(...fg) - Math.min(...fg) < 12
        if (grey && lum(fg) > FLOOR + 0.001)
          out.floor.push(`${t} is ${cs.color} on a light surface`)
        if (GOLDS.some((g) => g.every((v, i) => Math.abs(v - fg[i]!) < 6)))
          out.gold.push(`${t} is gold (${cs.color}) on a light surface`)
      }
      const r = ratio(fg, bg)
      if (r < 4.5)
        out.contrast.push(`${t} is ${r.toFixed(2)}:1 (${cs.color} on rgb(${bg.slice(0, 3)}))`)
    }
    return out
  })
}

async function open(page: Page) {
  await page.goto('/for-business')
  await expect(page.locator('#fb-root h1')).toBeVisible()
}

for (const width of WIDTHS) {
  test.describe(`/for-business at ${width}px`, () => {
    test.use({
      viewport: { width, height: width === 375 ? 667 : 900 },
      contextOptions: { reducedMotion: 'reduce' },
    })

    test('text is Jost, at least 14px, on the floor, gold only on dark', async ({ page }) => {
      await open(page)
      const a = await auditText(page)
      expect(a.checked, 'the audit found text to check').toBeGreaterThan(40)
      expect(a.font, 'Jost only').toEqual([])
      expect(a.size, 'nothing under 14px').toEqual([])
      expect(a.floor, 'no grey lighter than #6b6b6b on light').toEqual([])
      expect(a.gold, 'no gold on light').toEqual([])
      expect(a.contrast, 'all text at least 4.5:1').toEqual([])
    })

    test('the audit catches a planted fault', async ({ page }) => {
      await open(page)
      await page.evaluate(() => {
        const p = document.querySelector<HTMLElement>('#fb-root .s-white .lede')!
        p.style.cssText = 'color:#c4a065;font-size:12px;font-family:Georgia'
      })
      const a = await auditText(page)
      expect(a.font.length).toBeGreaterThan(0)
      expect(a.size.length).toBeGreaterThan(0)
      expect(a.gold.length).toBeGreaterThan(0)
    })

    test('one owner door, chapter headings on the gutter, no sideways scroll', async ({ page }) => {
      await open(page)
      const m = await page.evaluate(() => {
        const root = document.getElementById('fb-root')!
        const wrap = root.querySelector<HTMLElement>('.s-white .wrap')!
        const gutter = Math.round(
          wrap.getBoundingClientRect().left + parseFloat(getComputedStyle(wrap).paddingLeft)
        )
        const fact = [...root.querySelectorAll('.facts li')].find((li) =>
          li.textContent?.includes('A real person checks every claim.')
        )
        return {
          starts: document.querySelectorAll('#start').length,
          startInHero: !!document.querySelector('.hx #start'),
          gutter,
          headings: [...root.querySelectorAll<HTMLElement>('.ch-h')].map((h) => ({
            id: h.id,
            left: Math.round(h.getBoundingClientRect().left),
          })),
          factBottom: fact ? Math.round(fact.getBoundingClientRect().bottom + scrollY) : null,
          sideways: document.documentElement.scrollWidth > window.innerWidth,
        }
      })
      expect(m.starts, 'exactly one #start').toBe(1)
      expect(m.startInHero, '#start is on the hero door').toBe(true)
      expect(m.headings).toHaveLength(4)
      for (const h of m.headings) expect(h.left, `${h.id} left edge`).toBe(m.gutter)
      expect(m.sideways, 'no horizontal scroll').toBe(false)
      if (width === 375) expect(m.factBottom!, 'first fact on the first screen').toBeLessThan(521)
    })

    test('axe finds no serious or critical violation', async ({ page }) => {
      await open(page)
      const results = await new AxeBuilder({ page })
        // The plan cards are scanned too: this page's CSS must not leak into them.
        .include('#fb-root')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      const bad = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `[${v.id}] ${v.help}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
      expect(bad).toEqual([])
    })
  })
}

test.describe('/for-business round trip', () => {
  test('each sample card opens its sample, and Back returns to the page', async ({ page }) => {
    for (const label of ['Storefront', 'Professional', 'Creative']) {
      await open(page)
      await page.getByRole('link', { name: new RegExp(`See the ${label} Sample`) }).click()
      await expect(page).toHaveURL(new RegExp(`/example/${label.toLowerCase()}$`))
      await page.goBack()
      await expect(page).toHaveURL(/\/for-business$/)
    }
  })

  test("the sample banner's Get a Page Like This lands on the hero door", async ({ page }) => {
    await open(page)
    await page.getByRole('link', { name: /See the Storefront Sample/ }).click()
    await expect(page).toHaveURL(/\/example\/storefront$/)
    await page.getByRole('link', { name: 'Get a Page Like This' }).click()
    // /for-business reads plan availability on the server, so allow it a slow first render.
    await expect(page).toHaveURL(/\/for-business#start$/, { timeout: 30_000 })
    await expect(page.locator('#start')).toBeInViewport()
  })
})
