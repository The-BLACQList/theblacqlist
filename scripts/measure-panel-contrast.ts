/**
 * Throwaway measurement harness for the caption-plate redesign.
 *
 * The panels used to set their text over a photograph, so measuring them meant
 * sampling pixels under the type and guessing at the worst case. They now set it
 * on `PHOTO_PLATE` — a solid `bg-deep-bg` band — so the ground is a computed
 * style, not a frame, and the ratio is exact rather than a band scan.
 *
 * Run against a dev server already on :3000:
 *   pnpm exec tsx scripts/measure-panel-contrast.ts
 *
 * `reducedMotion: 'reduce'` is mandatory, not tidiness: `components/motion/
 * Reveal.tsx` puts its hidden state inside `@media (prefers-reduced-motion:
 * no-preference)`, so without it every capture comes back blank.
 */
import { chromium } from '@playwright/test'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const WIDTHS = [375, 768, 1280]
const PAGES = [
  { path: '/', label: 'home' },
  { path: '/cities', label: 'cities' },
]

function srgbToLinear(c: number) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance([r, g, b]: [number, number, number]) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function ratio(fg: [number, number, number], bg: [number, number, number]) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x)
  return (a! + 0.05) / (b! + 0.05)
}

function parseRgb(value: string): [number, number, number] | null {
  const m = value.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

type Sample = {
  page: string
  width: number
  text: string
  color: string
  bg: string
  fontPx: number
  bold: boolean
}

async function main() {
  const browser = await chromium.launch()
  const rows: Sample[] = []

  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: 1200 },
      reducedMotion: 'reduce',
      deviceScaleFactor: 2,
    })
    const page = await context.newPage()

    for (const { path, label } of PAGES) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(600)

      // Passed as source text, not a closure: tsx compiles with esbuild's
      // keepNames, which injects a `__name` helper that does not exist in the
      // page. A string is evaluated verbatim and sidesteps it entirely.
      const samples = (await page.evaluate(`(() => {
        var out = []

        // Walk up from a text node until an element paints an opaque background.
        // The plate is that element; the picture region above it never is.
        var groundOf = function (el) {
          var node = el
          while (node) {
            var bg = getComputedStyle(node).backgroundColor
            var m = bg.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?/)
            if (m && (m[4] === undefined || Number(m[4]) === 1)) return bg
            node = node.parentElement
          }
          return 'rgb(255, 255, 255)'
        }

        // Only the panels this redesign touched: links whose ground is deep-bg.
        var links = Array.prototype.slice
          .call(document.querySelectorAll('a'))
          .filter(function (a) { return a.className.indexOf('bg-deep-bg') !== -1 })

        links.forEach(function (link) {
          var spans = Array.prototype.slice
            .call(link.querySelectorAll('span'))
            .filter(function (s) {
              if (s.getAttribute('aria-hidden') === 'true') return false
              // Leaf text only — a wrapper's textContent would double-count.
              if (s.querySelector('span')) return false
              return (s.textContent || '').trim().length > 0
            })
          spans.forEach(function (span) {
            var cs = getComputedStyle(span)
            out.push({
              text: (span.textContent || '').trim().slice(0, 42),
              color: cs.color,
              bg: groundOf(span),
              fontPx: parseFloat(cs.fontSize),
              bold: Number(cs.fontWeight) >= 700,
            })
          })
        })
        return out
      })()`)) as {
        text: string
        color: string
        bg: string
        fontPx: number
        bold: boolean
      }[]

      for (const s of samples) rows.push({ page: label, width, ...s })

      await page.screenshot({
        path: `.tmp-shots/${label}-${width}.png`,
        fullPage: true,
      })
    }

    await context.close()
  }

  await browser.close()

  // WCAG: 18.66px bold or 24px+ is "large text" and owes 3:1; everything else 4.5:1.
  let worst = Infinity
  let fails = 0
  const seen = new Set<string>()

  console.log('\npage    w     size  bold  ratio   owes  verdict  text')
  console.log('-'.repeat(78))
  for (const r of rows) {
    const fg = parseRgb(r.color)
    const bg = parseRgb(r.bg)
    if (!fg || !bg) continue
    const large = r.fontPx >= 24 || (r.bold && r.fontPx >= 18.66)
    const owes = large ? 3 : 4.5
    const value = ratio(fg, bg)
    const pass = value >= owes
    if (!pass) fails++
    worst = Math.min(worst, value / owes)

    const key = `${r.page}|${r.width}|${r.color}|${r.bg}|${r.fontPx}|${r.bold}`
    if (seen.has(key)) continue
    seen.add(key)

    console.log(
      `${r.page.padEnd(7)} ${String(r.width).padEnd(5)} ${String(r.fontPx).padEnd(5)} ` +
        `${(r.bold ? 'y' : 'n').padEnd(5)} ${value.toFixed(2).padStart(5)}  ` +
        `${owes.toFixed(1).padStart(4)}  ${(pass ? 'PASS' : 'FAIL').padEnd(7)}  ${r.text}`
    )
  }

  console.log('-'.repeat(78))
  console.log(`${rows.length} text spans measured · ${fails} below floor`)
  console.log(`worst margin over its own floor: ${worst.toFixed(2)}×`)
}

main()
