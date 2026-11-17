// =============================================================================
// Ticket 204 — brand audit for the chapters layout of the sample pages
// =============================================================================
// The rules the founder and Creative fixed for Round 3, checked in a browser at
// phone, tablet and desktop widths:
//   - Jost only: every piece of visible text is set in Jost.
//   - Text floor: nothing under 14px; on a light surface, no grey text lighter
//     than #6b6b6b, and all text clears 4.5:1 against its surface.
//   - Gold only on dark: champagne gold (#c4a065) and light gold (#ffd867) never
//     colour text on a light surface; amber carries accents there.
//   - One left edge: every chapter heading starts on the page's left gutter.
//   - Reduced motion: with the setting on, nothing waits hidden for a scroll
//     reveal, nothing animates, and the count-up numbers show their final value.
//
// Each audit also runs once against a planted fault, so a selector that stops
// matching cannot let the check pass by looking at nothing.
// =============================================================================

import { expect, test, type Page } from '@playwright/test'

const PAGES = ['storefront', 'professional'] as const
const WIDTHS = [375, 1024, 1280] as const
const url = (variant: string) => `/example/${variant}?layout=chapters`

type Audit = {
  checked: number
  font: string[]
  size: string[]
  floor: string[]
  gold: string[]
  contrast: string[]
}

/** Walks every visible text node under the chapters root and applies the rules. */
function auditText(page: Page): Promise<Audit> {
  return page.evaluate(() => {
    const root = document.getElementById('lp-root')
    if (!root) throw new Error('chapters root #lp-root not found')

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
    /** The first ancestor surface that is mostly opaque; the page itself is white. */
    const surface = (el: Element): number[] => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const c = rgba(getComputedStyle(e).backgroundColor)
        if (c[3]! > 0.5) return c
      }
      return [255, 255, 255, 1]
    }
    const over = (fg: number[], bg: number[]) =>
      fg.slice(0, 3).map((v, i) => v * fg[3]! + bg[i]! * (1 - fg[3]!))
    const FLOOR = lum([107, 107, 107]) // #6b6b6b
    const GOLDS = [
      [196, 160, 101], // --gold #c4a065
      [255, 216, 103], // --lgold #ffd867
    ]

    const out: Audit = { checked: 0, font: [], size: [], floor: [], gold: [], contrast: [] }
    const seen = new Set<Element>()
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const el = n.parentElement
      if (!el || !n.textContent?.trim() || seen.has(el)) continue
      seen.add(el)
      // Not shown: closed disclosures and dialogs, and screen-reader-only text.
      if (el.closest('[hidden], dialog:not([open]), .vh, script, style, noscript')) continue
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

/** Left edge of each chapter heading, and the gutter it should sit on. */
function headingEdges(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById('lp-root')!
    const probe = document.createElement('div')
    probe.style.cssText = 'position:absolute;left:0;width:var(--bl);height:0'
    root.append(probe)
    const gutter = Math.round(probe.getBoundingClientRect().width)
    probe.remove()
    const headings = [...root.querySelectorAll<HTMLElement>('.ch-h')].map((h) => ({
      id: h.id,
      left: Math.round(h.getBoundingClientRect().left),
    }))
    return { gutter, headings }
  })
}

async function open(page: Page, variant: string) {
  await page.goto(url(variant))
  // Wait for hydration: anything planted or measured before it can be wiped by
  // React's mismatch recovery, or read before the motion setting is applied.
  await expect(page.locator('#lp-root')).toHaveAttribute('data-ready', '1')
}

for (const variant of PAGES) {
  for (const width of WIDTHS) {
    test.describe(`${variant} chapters at ${width}px`, () => {
      test.use({ viewport: { width, height: 900 }, contextOptions: { reducedMotion: 'reduce' } })

      test('text is Jost, at least 14px, on the floor, gold only on dark', async ({ page }) => {
        await open(page, variant)
        const a = await auditText(page)
        expect(a.checked, 'the audit found text to check').toBeGreaterThan(100)
        expect(a.font, 'Jost only').toEqual([])
        expect(a.size, 'nothing under 14px').toEqual([])
        expect(a.floor, 'no grey lighter than #6b6b6b on light').toEqual([])
        expect(a.gold, 'no gold on light').toEqual([])
        expect(a.contrast, 'all text at least 4.5:1').toEqual([])
      })

      test('every chapter heading starts on the left gutter', async ({ page }) => {
        await open(page, variant)
        const { gutter, headings } = await headingEdges(page)
        expect(headings.length, 'chapter headings found').toBeGreaterThanOrEqual(5)
        expect(gutter).toBeGreaterThan(0)
        for (const h of headings) expect(h.left, `${h.id} left edge`).toBe(gutter)
      })
    })
  }

  test.describe(`${variant} chapters with reduced motion`, () => {
    test.use({
      viewport: { width: 1280, height: 900 },
      contextOptions: { reducedMotion: 'reduce' },
    })

    test('nothing hides, animates, or counts up', async ({ page }) => {
      await open(page, variant)
      const before = await page.evaluate(() => {
        const el = document.querySelector('[data-count]')
        return el?.textContent ?? null
      })
      expect(before, 'a count-up number is on the page').not.toBeNull()
      // Walk the whole page so any scroll-driven motion would have fired.
      const height = await page.evaluate(() => document.documentElement.scrollHeight)
      for (let y = 0; y < height; y += 600) {
        await page.evaluate((top) => window.scrollTo(0, top), y)
        await page.waitForTimeout(40)
      }
      const state = await page.evaluate(() => {
        const root = document.getElementById('lp-root')!
        const running = document
          .getAnimations()
          // Reduced motion shortens every transition to 0.01ms rather than
          // removing it; one caught mid-flight is not motion.
          .filter(
            (a) => a.playState === 'running' && Number(a.effect?.getTiming().duration ?? 0) > 1
          )
          .map((a) => {
            const t = (a.effect as KeyframeEffect | null)?.target as Element | null
            return `${a.constructor.name} on ${t?.className || t?.tagName}`
          })
        return {
          motion: root.classList.contains('motion'),
          pending: root.querySelectorAll('.pre').length,
          pinned: root.querySelectorAll('.glide.pinned').length,
          count: document.querySelector('[data-count]')?.textContent ?? null,
          running,
        }
      })
      expect(state.motion, 'motion class is off').toBe(false)
      expect(state.pending, 'no section waits hidden for a reveal').toBe(0)
      expect(state.pinned, 'the gallery does not pin and glide').toBe(0)
      expect(state.running, 'no animation is running').toEqual([])
      expect(state.count, 'the count-up shows its final value').toBe(before)
    })
  })
}

// ── The audits catch what they are meant to catch ────────────────────────────

test.describe('reduced-motion self-check', () => {
  test.use({
    viewport: { width: 1280, height: 900 },
    contextOptions: { reducedMotion: 'no-preference' },
  })

  test('with the setting off, motion is on', async ({ page }) => {
    await open(page, 'storefront')
    await expect(page.locator('#lp-root')).toHaveClass(/\bmotion\b/)
    await expect(page.locator('#lp-root .glide.pinned')).toHaveCount(1)
  })
})

test.describe('brand audit self-check', () => {
  test.use({ viewport: { width: 1280, height: 900 }, contextOptions: { reducedMotion: 'reduce' } })

  test('flags a planted fault for each rule', async ({ page }) => {
    await open(page, 'storefront')
    await page.evaluate(() => {
      const root = document.getElementById('lp-root')!
      const plant = (text: string, css: string) => {
        const p = document.createElement('p')
        p.textContent = text
        p.style.cssText = `background:#fff;${css}`
        root.prepend(p)
      }
      plant('Planted serif', 'font-family:Georgia,serif;color:#1a1a1a;font-size:16px')
      plant('Planted small', 'color:#1a1a1a;font-size:12px')
      plant('Planted pale grey', 'color:#8a8a8a;font-size:16px')
      plant('Planted gold on light', 'color:#c4a065;font-size:16px')
      const h = root.querySelector<HTMLElement>('.ch-h')!
      // No transition: reduced motion gives every element a 0.01ms one, and a
      // read straight after the change would still see the old edge.
      h.style.transition = 'none'
      h.style.marginLeft = '13px'
    })
    const a = await auditText(page)
    expect(a.font.join()).toContain('Planted serif')
    expect(a.size.join()).toContain('Planted small')
    expect(a.floor.join()).toContain('Planted pale grey')
    expect(a.gold.join()).toContain('Planted gold on light')
    expect(a.contrast.join()).toContain('Planted gold on light')
    const { gutter, headings } = await headingEdges(page)
    expect(headings[0]!.left).not.toBe(gutter)
  })
})
