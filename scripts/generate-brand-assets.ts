/**
 * Generate the first-party brand raster assets from the SVG masters.
 *
 *   pnpm brand:assets        (or: npx tsx scripts/generate-brand-assets.ts)
 *
 * Produces four PNGs that ship as committed files:
 *
 *   public/og-default.png            1200×630  site-wide social share card
 *   app/apple-icon.png                180×180  iOS home-screen icon
 *   public/icons/icon-192.png         192×192  PWA manifest, purpose "any"
 *   public/icons/icon-512.png         512×512  PWA manifest, purpose "any"
 *   public/icons/icon-maskable-512.png 512×512 PWA manifest, purpose "maskable"
 *   public/brand/blacqlist-mark-gold-256.png  ≤256  logo spot (nav, footer, auth, sidebars)
 *   public/brand/blacqlist-mark-gold-144.png  ≤144  same, for small fixed-size uses
 *
 * Why a committed PNG rather than a generated route
 * -------------------------------------------------
 * The obvious alternative is `app/opengraph-image.tsx` with next/og's
 * `ImageResponse`. It was rejected: Satori requires an explicitly loaded font
 * buffer, and this project's display face (Jost) exists only through
 * `next/font/google` — there is no local TTF, and committing one would add a
 * binary plus a license record for no gain. Rasterizing text through librsvg has
 * the same problem from the other direction: it needs the font installed in
 * fontconfig on the build machine.
 *
 * Both problems disappear because the brand SVGs in public/brand/ are fully
 * outlined — zero <text> elements [Measured — grep, 2026-08-09]. They rasterize
 * pixel-identically with no font available at all. So the card carries the
 * lockup and nothing else; every OG client renders the page title and
 * description as real text beneath the image anyway, which is where those words
 * belong.
 *
 * Why the artwork is first-party
 * ------------------------------
 * Canva Pro restriction 3 (docs/blacqlist/design/editorial-image-licenses.md)
 * forbids licensed stock in a trademark or brand mark, and a site-wide default
 * OG image sits close enough to a brand mark to stay clear of. Everything here
 * derives from our own SVGs.
 *
 * Re-run after any change to public/brand/*.svg or app/icon.svg and commit the
 * output.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

const ROOT = process.cwd()

/**
 * Brand deep background — the ground every dark surface on the site uses.
 *
 * This is `--color-deep-bg` as it is actually defined at app/globals.css:17,
 * not the `#19191E` quoted in photographic-style-direction.md. The doc predates
 * the token and the token is what ships, so the share card matches the site
 * rather than the doc.
 */
const DEEP_BG = '#08080a'

/** Wordmark + node-Q, white text on a dark ground. Outlined, no font needed. */
const LOCKUP_DARK = path.join(ROOT, 'public/brand/blacqlist-lockup-dark.svg')
/**
 * The standalone gold node-Q. app/icon.svg rather than
 * public/brand/blacqlist-mark-gold.svg: same artwork, but 6 lines of flat paths
 * with no filter/clipPath defs, which rasterizes cleaner at icon sizes.
 */
const MARK = path.join(ROOT, 'app/icon.svg')
/**
 * The founder's gold artwork, used as-is in the logo spots (2026-09-24). Unlike
 * app/icon.svg this is not flat paths: it is a masked, embedded raster with a
 * gradient finish, 187 KB of SVG. Shipping that to every page is wasteful, so it
 * is rasterized once here, trimmed to its ink, on a transparent ground.
 */
const GOLD_MARK = path.join(ROOT, 'public/brand/blacqlist-mark-gold.svg')

/**
 * Render an SVG to a raster buffer that fits inside a box, trimmed to its ink.
 *
 * `trim()` is the important part. Both source SVGs carry a generous transparent
 * margin inside their viewBox — enough that an untrimmed composite is really
 * being laid out by whatever padding the design file happened to have. Trimming
 * first makes the margin below a deliberate number instead of an inherited one,
 * and it keeps these outputs stable if a future export changes the viewBox.
 *
 * librsvg rasterizes at `density` DPI before sharp resizes, so a low density on
 * a large downscale produces soft edges. 300 renders every source here well
 * above any target size; the resize down is what sets final sharpness.
 */
async function renderSvg(svgPath: string, box: { width: number; height: number }): Promise<Buffer> {
  return sharp(svgPath, { density: 300 })
    .trim()
    .resize({ ...box, fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer()
}

/**
 * Composite a rendered SVG centered on a solid canvas, inset by `margin` on
 * every side. The artwork scales to fit the inset box in whichever dimension
 * binds first, so its own aspect ratio is always preserved.
 */
async function onCanvas(
  svgPath: string,
  canvas: { width: number; height: number },
  margin: number
): Promise<Buffer> {
  const art = await renderSvg(svgPath, {
    width: canvas.width - margin * 2,
    height: canvas.height - margin * 2,
  })
  return sharp({
    create: {
      width: canvas.width,
      height: canvas.height,
      channels: 4,
      background: DEEP_BG,
    },
  })
    .composite([{ input: art, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

interface Asset {
  out: string
  buffer: () => Promise<Buffer>
  note: string
}

const ASSETS: Asset[] = [
  {
    out: 'public/og-default.png',
    // 1200×630 is the Open Graph / summary_large_image standard. A 200px inset
    // lands the lockup at roughly two thirds of the frame width and keeps it
    // well clear of the safe-area crop some clients apply at the edges.
    note: 'lockup, 200px inset',
    buffer: () => onCanvas(LOCKUP_DARK, { width: 1200, height: 630 }, 200),
  },
  {
    out: 'app/apple-icon.png',
    note: 'mark at ~70% — iOS rounds corners, it does not mask',
    buffer: () => onCanvas(MARK, { width: 180, height: 180 }, 27),
  },
  {
    out: 'public/icons/icon-192.png',
    note: 'purpose "any"',
    buffer: () => onCanvas(MARK, { width: 192, height: 192 }, 21),
  },
  {
    out: 'public/icons/icon-512.png',
    note: 'purpose "any"',
    buffer: () => onCanvas(MARK, { width: 512, height: 512 }, 56),
  },
  {
    out: 'public/icons/icon-maskable-512.png',
    // The maskable safe zone is a circle of 80% diameter, and platforms crop
    // aggressively inside it. Holding the mark to ~55% of the canvas survives
    // every mask shape Android applies.
    note: 'purpose "maskable" — mark at ~55% for the safe zone',
    buffer: () => onCanvas(MARK, { width: 512, height: 512 }, 115),
  },
  {
    out: 'public/brand/blacqlist-mark-gold-256.png',
    // Transparent, not on DEEP_BG: the logo spots sit on both dark and light
    // grounds. 256 covers the largest spot (48px) at 3x with room to spare.
    note: 'gold mark, transparent, trimmed',
    buffer: () => renderSvg(GOLD_MARK, { width: 256, height: 256 }).then(compress),
  },
  {
    out: 'public/brand/blacqlist-mark-gold-144.png',
    note: 'gold mark, transparent, trimmed',
    buffer: () => renderSvg(GOLD_MARK, { width: 144, height: 144 }).then(compress),
  },
]

/** Re-encode a rendered PNG at the highest zlib level; transparency is kept. */
function compress(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer()
}

async function main() {
  await mkdir(path.join(ROOT, 'public/icons'), { recursive: true })

  for (const asset of ASSETS) {
    const buffer = await asset.buffer()
    await writeFile(path.join(ROOT, asset.out), buffer)
    const kb = Math.round(buffer.byteLength / 1024)
    console.log(`${asset.out.padEnd(34)} ${String(kb).padStart(4)} KB   ${asset.note}`)
  }

  console.log(`\n${ASSETS.length} brand assets generated.`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
