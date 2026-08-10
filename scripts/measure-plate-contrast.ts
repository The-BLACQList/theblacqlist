/**
 * Band-scan contrast harness for the translucent caption plate.
 *
 * `scripts/measure-panel-contrast.ts` cannot measure this surface, and the
 * reason is structural rather than a bug in it: that harness walks up the DOM
 * from each text node until it finds an **opaque** background and computes the
 * ratio against that color. `PHOTO_PLATE_TINT` is translucent, so there is no
 * opaque ancestor short of the page itself — it would walk straight past the
 * veil and report a ratio against the section background, which is a different
 * surface entirely. Keep both: that one still governs the solid surfaces, this
 * one governs the veiled ones.
 *
 * This harness measures the pixels instead of the CSS:
 *
 * 1. Hide **only the text** (`[data-plate-caption]`) with `visibility: hidden`,
 *    which preserves layout so the recorded rectangles stay truthful. The veil,
 *    its mask ramp, and its `backdrop-blur` all stay painted. **This is the step
 *    the first attempt at this got wrong** — its selector caught the overlay
 *    along with the text, so every photographic tile was measured against the
 *    raw unveiled photograph. Any figure produced that way is not evidence.
 * 2. Screenshot the page at `deviceScaleFactor: 1`, so one CSS pixel is one
 *    image pixel and the recorded rectangles index directly into the bitmap.
 * 3. For every text run, composite that run's own foreground color over **every**
 *    pixel of its rectangle and keep the **worst** resulting ratio. Light type
 *    fails on the lightest pixel under it, not on the average.
 * 4. Compare against the WCAG floor that run's font size actually owes.
 *
 * ## Two things this gets right that the naive version did not
 *
 * **Colors are resolved by painting them, not by parsing them.** The triptych
 * body is `text-off-white/80`, whose computed value in Chromium is
 * `oklab(0.967994 0.00116268 -0.00379997 / 0.8)`. A digit-grabbing regex reads
 * those as RGB and reports nonsense — the first run of this harness produced
 * nine "failures" in the 1.08–1.33:1 range that were entirely artifacts of that.
 * `resolve()` instead sets the color as a canvas `fillStyle` over a black ground
 * and again over a white ground, then solves the two reads for alpha and the
 * unpremultiplied channels. Whatever color syntax the browser grows next, this
 * keeps working, because the browser does the parsing.
 *
 * **A translucent foreground is composited before the ratio, not after.** Text
 * at 80% opacity is not its nominal color; it is that color mixed with whatever
 * is behind it, which is why the worst pixel has to be kept as **RGB** rather
 * than collapsed to a luminance. `1.08:1` was the tell — no real color pair on
 * this site lands there.
 *
 * ## The alpha sweep
 *
 * `PHOTO_PLATE_TINT` is an inline style on `[data-plate-veil]` and the ramp is a
 * class, so the tint can be overridden in the page and re-screenshot without a
 * rebuild. `ALPHAS` runs the whole measurement once per candidate and reports the
 * worst gold ratio at each, which turns "how transparent can this be" from an
 * argument into a table. The founder's ask is that the picture read *through* the
 * band — so the answer is the lowest alpha that still clears every floor, not the
 * first one that passes.
 *
 * The binding constraint everywhere is a `text-xs` run — small text owing
 * **4.5:1**, not the 3:1 large-text allowance the white headlines get. The
 * summary column reports the worst run **on the 4.5:1 floor** rather than the
 * worst *gold* run: an earlier version classified rows by comparing them to a
 * hardcoded `#c4a065`, which went blind the instant the accent colour changed
 * and is why no `#ffd867` figure in the record before 2026-08-10 was ever real.
 * `floorFor()` decides pass/fail without reference to colour; the report now
 * does too.
 *
 * ## What it measures that is not literally on screen
 *
 * The panel titles carry `group-hover:text-light-gold`, and hover is a real
 * state owing a real floor. Driving a genuine hover would cost one screenshot
 * per tile, so for every element carrying that class the collect pass emits a
 * **second run over the identical rect** with the foreground resolved from
 * `--color-light-gold`. Same geometry, known colour, no extra screenshots.
 *
 * Usage — against a dev server on :3000:
 *
 * ```
 * pnpm dev                                        # in another shell
 * npx --yes tsx scripts/measure-plate-contrast.ts
 * ```
 *
 * `npx`, not `pnpm exec` — this repo's `pnpm exec tsx` resolves to
 * `[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command "tsx" not found`.
 */
import { chromium } from '@playwright/test'
import sharp from 'sharp'
import { PHOTO_PLATE_TINT } from '../lib/design/surfaces'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const ROUTES = ['/', '/cities']

/** 640 is where `CityChapters` used to break to three columns and 1024 is where
 *  the photographic grids break now; both are worst-case widths that the
 *  original 375/768/1280 triple stepped straight over. */
const WIDTHS = [375, 640, 768, 1024, 1280]

/** Descending, so the first entry is the most opaque candidate. The exit code is
 *  decided by the **shipped** alpha, which is read from `PHOTO_PLATE_TINT` — not
 *  by whatever happens to be first here.
 *
 *  `PLATE_ALPHAS=0.82,0.80,0.78` narrows the sweep when the coarse pass has
 *  already bracketed the boundary — the run costs a full screenshot and scan per
 *  alpha per viewport, so bisecting beats widening. */
const SWEEP = (process.env.PLATE_ALPHAS ?? '0.82,0.80,0.78,0.76,0.70')
  .split(',')
  .map((a) => Number(a.trim()))

/** The single source of truth for both the tint color and the shipped alpha.
 *  Hand-syncing either one against `surfaces.ts` is how a harness quietly starts
 *  measuring a surface that no longer exists. */
const TINT_MATCH = PHOTO_PLATE_TINT.match(
  /rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/
)
if (!TINT_MATCH) {
  throw new Error(`Could not parse PHOTO_PLATE_TINT: ${PHOTO_PLATE_TINT}`)
}
const TINT_RGB = `${TINT_MATCH[1]},${TINT_MATCH[2]},${TINT_MATCH[3]}`
const SHIPPED_ALPHA = Number(TINT_MATCH[4])

/** The shipped value is always measured, whether or not the sweep names it. */
const ALPHAS = SWEEP.includes(SHIPPED_ALPHA) ? SWEEP : [SHIPPED_ALPHA, ...SWEEP]

interface Run {
  panel: string
  text: string
  css: string
  fg: [number, number, number, number]
  fontPx: number
  bold: boolean
  x: number
  y: number
  w: number
  h: number
}

interface Row extends Run {
  route: string
  width: number
  alpha: number
  ratio: number
  floor: number
}

/** Passed to `page.evaluate` as a source string on purpose. tsx compiles with
 *  esbuild's `keepNames`, which injects a `__name` helper that does not exist
 *  inside the page — a compiled function literal throws `ReferenceError:
 *  __name is not defined` the moment it runs. A string is not compiled. */
const COLLECT = `(function () {
  var cv = document.createElement('canvas')
  cv.width = 4
  cv.height = 4
  var cx = cv.getContext('2d', { willReadFrequently: true })

  // Resolve any CSS color — including oklab(... / 0.8) — to unpremultiplied
  // sRGB plus alpha, by painting it over two known grounds and solving:
  //   over black: b = c*a          over white: w = c*a + 255*(1-a)
  //   => a = 1 - (w - b)/255,  c = b/a
  function resolve(col) {
    cx.fillStyle = '#000'
    cx.fillRect(0, 0, 4, 4)
    cx.fillStyle = col
    cx.fillRect(0, 0, 4, 4)
    var b = cx.getImageData(1, 1, 1, 1).data
    cx.fillStyle = '#fff'
    cx.fillRect(0, 0, 4, 4)
    cx.fillStyle = col
    cx.fillRect(0, 0, 4, 4)
    var w = cx.getImageData(1, 1, 1, 1).data
    var a = 1 - ((w[0] - b[0]) + (w[1] - b[1]) + (w[2] - b[2])) / 765
    if (a <= 0.004) return null
    return [b[0] / a, b[1] / a, b[2] / a, a]
  }

  // The hover color, resolved once from the token rather than hardcoded, so the
  // synthetic hover runs below track a brand change automatically.
  var hoverRaw = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-light-gold')
    .trim()
  var hoverFg = hoverRaw ? resolve(hoverRaw) : null

  // The Next.js dev-tools badge lives in a shadow root on a nextjs-portal element
  // and is pinned to the bottom-left of the viewport. A full-page screenshot
  // flattens fixed chrome into the bitmap at whatever y the viewport was sitting
  // on, so the badge lands mid-page — over the /cities chicago caption at 640,
  // where its white glyph read as a 1.00:1 failure that no veil could ever
  // produce. Dev-server furniture, not page content; remove it before any read.
  var portals = document.querySelectorAll('nextjs-portal')
  for (var p = 0; p < portals.length; p++) portals[p].style.display = 'none'

  var runs = []
  var captions = document.querySelectorAll('[data-plate-caption]')
  for (var i = 0; i < captions.length; i++) {
    var cap = captions[i]
    var link = cap.closest('a')
    var label = link ? (link.getAttribute('href') || '?') : '?'
    var leaves = cap.querySelectorAll('span')
    for (var j = 0; j < leaves.length; j++) {
      var el = leaves[j]

      // Own text, not leaf-ness. The previous test skipped any span containing a
      // span, which silently dropped the /cities count line — it wraps an
      // aria-hidden separator, so only the bare '·' glyph was ever measured and
      // the brightest ground on the site went unsampled. Direct text nodes are
      // what this element actually paints; the element's own rect is a
      // conservative superset of where it paints them.
      var own = ''
      for (var k = 0; k < el.childNodes.length; k++) {
        if (el.childNodes[k].nodeType === 3) own += el.childNodes[k].nodeValue
      }
      var txt = own.trim()
      if (!txt) continue

      var r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) continue
      var cs = getComputedStyle(el)
      var fg = resolve(cs.color)
      if (!fg) continue
      var rect = {
        fontPx: parseFloat(cs.fontSize),
        bold: parseInt(cs.fontWeight, 10) >= 700,
        x: Math.round(r.left + window.scrollX),
        y: Math.round(r.top + window.scrollY),
        w: Math.round(r.width),
        h: Math.round(r.height)
      }
      runs.push({
        panel: label,
        text: txt.slice(0, 36),
        css: cs.color,
        fg: fg,
        fontPx: rect.fontPx,
        bold: rect.bold,
        x: rect.x, y: rect.y, w: rect.w, h: rect.h
      })

      // Hover is a real state with a real floor, and driving it for every panel
      // would mean one screenshot per tile. The color is known and the geometry
      // is identical, so a second run over the same rect measures it exactly.
      if (hoverFg && el.className.indexOf('group-hover:text-light-gold') !== -1) {
        runs.push({
          panel: label,
          text: txt.slice(0, 30) + ' [hover]',
          css: hoverRaw,
          fg: hoverFg,
          fontPx: rect.fontPx,
          bold: rect.bold,
          x: rect.x, y: rect.y, w: rect.w, h: rect.h
        })
      }
    }
    cap.style.visibility = 'hidden'
  }
  return runs
})()`

/** sRGB→linear for the 256 integer channel values the screenshot can hold. */
const LUT = Array.from({ length: 256 }, (_, c) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
})

function toLinear(c: number): number {
  const s = Math.min(255, Math.max(0, c)) / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function ratio(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

/** WCAG large text: ≥24px, or ≥18.66px when bold. Everything else owes 4.5:1. */
function floorFor(fontPx: number, bold: boolean): number {
  return fontPx >= 24 || (bold && fontPx >= 18.66) ? 3 : 4.5
}

function label(r: Row): string {
  return `${r.panel} — ${r.text}`
}

async function main() {
  const browser = await chromium.launch()
  const rows: Row[] = []

  for (const route of ROUTES) {
    for (const width of WIDTHS) {
      const page = await browser.newPage({
        viewport: { width, height: 1000 },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
      })
      await page.goto(BASE + route, { waitUntil: 'networkidle' })

      // Force every lazy frame to decode before anything is hidden — a frame
      // that has not painted measures as the panel's own `bg-deep-bg` and would
      // read as a comfortable pass it has not earned.
      //
      // Stepped, not one jump to the bottom. No caller passes `priority`, so
      // every frame is `loading="lazy"` and only enters the viewport if the
      // scroll actually passes through it; at tablet these pages are now several
      // thousand pixels tall, and a single `scrollTo(bottom)` skips most of them.
      const pageHeight = (await page.evaluate(`document.body.scrollHeight`)) as number
      for (let y = 0; y < pageHeight; y += 800) {
        await page.evaluate(`window.scrollTo(0, ${y})`)
        await page.waitForTimeout(150)
      }
      await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`)
      await page.waitForTimeout(600)
      await page.evaluate(`window.scrollTo(0, 0)`)
      await page.waitForTimeout(400)
      // Belt and braces: nothing may still be decoding when the scan starts.
      await page
        .waitForFunction(
          `(function () {
            var imgs = document.querySelectorAll('img')
            for (var i = 0; i < imgs.length; i++) { if (!imgs[i].complete) return false }
            return true
          })()`,
          undefined,
          { timeout: 15000 }
        )
        .catch(() => {
          console.warn(`  ! ${route} @ ${width}: images still decoding after 15s`)
        })

      const runs = (await page.evaluate(COLLECT)) as Run[]

      for (const alpha of ALPHAS) {
        await page.evaluate(`(function () {
          var veils = document.querySelectorAll('[data-plate-veil]')
          for (var i = 0; i < veils.length; i++) {
            veils[i].style.background = 'rgba(${TINT_RGB},${alpha})'
          }
        })()`)
        await page.waitForTimeout(120)

        const shot = await page.screenshot({ fullPage: true })
        const { data, info } = await sharp(shot)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
        const ch = info.channels

        for (const run of runs) {
          const [fr, fg_, fb, fa] = run.fg
          let worst = Infinity
          for (let y = run.y; y < run.y + run.h; y++) {
            if (y < 0 || y >= info.height) continue
            for (let x = run.x; x < run.x + run.w; x++) {
              if (x < 0 || x >= info.width) continue
              const i = (y * info.width + x) * ch
              const gr = data[i]!
              const gg = data[i + 1]!
              const gb = data[i + 2]!
              const groundLum = 0.2126 * LUT[gr]! + 0.7152 * LUT[gg]! + 0.0722 * LUT[gb]!
              // Text at <100% opacity is its nominal color mixed with the ground
              // behind it, so the effective foreground is per-pixel too.
              const textLum =
                fa >= 0.999
                  ? 0.2126 * toLinear(fr) + 0.7152 * toLinear(fg_) + 0.0722 * toLinear(fb)
                  : 0.2126 * toLinear(fr * fa + gr * (1 - fa)) +
                    0.7152 * toLinear(fg_ * fa + gg * (1 - fa)) +
                    0.0722 * toLinear(fb * fa + gb * (1 - fa))
              const rr = ratio(textLum, groundLum)
              if (rr < worst) worst = rr
            }
          }
          if (!Number.isFinite(worst)) continue
          rows.push({
            ...run,
            route,
            width,
            alpha,
            ratio: worst,
            floor: floorFor(run.fontPx, run.bold),
          })
        }
      }

      await page.close()
    }
  }

  await browser.close()

  console.log(
    `\n${rows.length / ALPHAS.length} text runs × ${ALPHAS.length} alphas across ${ROUTES.length} routes × ${WIDTHS.length} widths\n`
  )
  // "Worst 4.5:1 run" rather than "worst gold". Colour classification was a
  // hardcoded RGB triple that went blind the moment the accent colour changed;
  // the floor is what actually decides pass or fail, and `floorFor()` already
  // knows it without looking at a colour at all.
  console.log('alpha  fails  worst 4.5:1  worst overall  worst run')
  console.log('─'.repeat(96))

  const perAlpha = new Map<number, Row[]>()
  for (const alpha of ALPHAS) {
    const set = rows.filter((r) => r.alpha === alpha).sort((a, b) => a.ratio - b.ratio)
    perAlpha.set(alpha, set)
    const fails = set.filter((r) => r.ratio < r.floor)
    const worstSmall = set.filter((r) => r.floor === 4.5)[0]
    const worst = set[0]
    console.log(
      `${alpha.toFixed(2).padStart(5)}  ${String(fails.length).padStart(5)}  ` +
        `${(worstSmall ? worstSmall.ratio.toFixed(2) + ':1' : '—').padStart(11)}  ` +
        `${(worst ? worst.ratio.toFixed(2) + ':1' : '—').padStart(13)}  ` +
        `${worst ? label(worst) : ''}`
    )
  }

  const cleanest = [...ALPHAS]
    .sort((a, b) => a - b)
    .find((a) => perAlpha.get(a)!.every((r) => r.ratio >= r.floor))

  console.log(
    `\nlowest alpha clearing every floor: ${cleanest !== undefined ? cleanest.toFixed(2) : 'none of the candidates'}`
  )

  const detail = [SHIPPED_ALPHA, ...(cleanest !== undefined && cleanest !== SHIPPED_ALPHA ? [cleanest] : [])]
  for (const alpha of detail) {
    console.log(`\n── worst 12 at alpha ${alpha.toFixed(2)} ──`)
    console.log('ratio   floor  px    w     panel / text')
    console.log('─'.repeat(96))
    for (const r of perAlpha.get(alpha)!.slice(0, 12)) {
      const flag = r.ratio < r.floor ? '✗' : ' '
      console.log(
        `${flag}${r.ratio.toFixed(2).padStart(6)} ${r.floor.toFixed(1).padStart(5)}  ` +
          `${String(r.fontPx).padStart(4)}  ${String(r.width).padStart(4)}  ${label(r)}`
      )
    }
  }

  // The shipped alpha is what has to be green; the rest of the sweep is advice.
  // `SHIPPED_ALPHA` comes from `PHOTO_PLATE_TINT`, so an exploratory
  // `PLATE_ALPHAS=` sweep can never move what the exit code is judging.
  console.log(`\nshipped alpha (from PHOTO_PLATE_TINT): ${SHIPPED_ALPHA.toFixed(2)}`)
  process.exitCode = perAlpha.get(SHIPPED_ALPHA)!.some((r) => r.ratio < r.floor) ? 1 : 0
}

void main()
