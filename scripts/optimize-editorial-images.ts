/**
 * Optimize editorial photography for the repo.
 *
 *   pnpm images:editorial                    listings/ → editorial/
 *   pnpm images:editorial <src> <out>        any pair of directories
 *
 * The directory pair is an optional argument so a second batch — the city
 * photographs in `public/images/cities/` — runs through the same encoder and the
 * same 150 KB budget instead of being hand-converted. Both paths are resolved
 * relative to the repo root. Defaults are unchanged, so the bare command and the
 * `images:editorial` script keep working exactly as before.
 *
 * Reads every JPEG/PNG in the source, resizes to TARGET_WIDTH preserving the
 * aspect ratio, and writes WebP into OUT_DIR. Run it once when photos are added;
 * the optimized output is what gets committed, and the originals do not enter
 * the repo.
 *
 * Why preserve the aspect ratio rather than crop to a fixed frame: every source
 * here is 3:2 (3840×2560), which is already the house ratio —
 * photographic-style-direction.md specifies "Photo-first cards at 3:2 ratio",
 * and the shipped homepage hero (public/images/hero-bg.jpg) is 3:2 at
 * 1920×1280. Slots that need a different shape crop with CSS `object-cover` at
 * render time, which keeps one file usable in a wide hero and a square card
 * without baking a crop decision into the asset.
 *
 * next/image re-encodes to WebP/AVIF at serve time regardless of source format,
 * so what this script actually buys is repo weight and build input size, not
 * delivered bytes: 68 MB of 3840px JPEGs becomes ~1.5 MB.
 */
import { existsSync } from 'node:fs'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

const ROOT = process.cwd()
const [srcArg, outArg] = process.argv.slice(2)
const SRC_DIR = path.resolve(ROOT, srcArg ?? 'public/images/listings')
const OUT_DIR = path.resolve(ROOT, outArg ?? 'public/images/editorial')

/** Wide enough for a full-bleed hero on a 2x laptop without going 4K. */
const TARGET_WIDTH = 1600
/** Budget per file. Quality steps down until the file fits. */
const MAX_BYTES = 150 * 1024
const QUALITY_LADDER = [82, 76, 70, 64, 58]

async function optimize(file: string): Promise<{ name: string; bytes: number; quality: number }> {
  const input = path.join(SRC_DIR, file)
  const name = `${path.parse(file).name}.webp`

  const pipeline = sharp(input).resize({
    width: TARGET_WIDTH,
    withoutEnlargement: true,
  })

  for (const quality of QUALITY_LADDER) {
    const buffer = await pipeline.clone().webp({ quality, effort: 6 }).toBuffer()
    const last = quality === QUALITY_LADDER[QUALITY_LADDER.length - 1]
    if (buffer.byteLength <= MAX_BYTES || last) {
      await writeFile(path.join(OUT_DIR, name), buffer)
      return { name, bytes: buffer.byteLength, quality }
    }
  }

  // Unreachable: the ladder always writes on its final step.
  throw new Error(`Failed to encode ${file}`)
}

async function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(`Source directory not found: ${path.relative(ROOT, SRC_DIR)}`)
    process.exit(1)
  }

  await mkdir(OUT_DIR, { recursive: true })

  const files = (await readdir(SRC_DIR)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort()
  if (files.length === 0) {
    console.error(`No images found in ${path.relative(ROOT, SRC_DIR)}`)
    process.exit(1)
  }

  let sourceBytes = 0
  let outputBytes = 0
  let overBudget = 0

  for (const file of files) {
    sourceBytes += (await stat(path.join(SRC_DIR, file))).size
    const { name, bytes, quality } = await optimize(file)
    outputBytes += bytes
    const kb = Math.round(bytes / 1024)
    const flag = bytes > MAX_BYTES ? '  ⚠ over budget' : ''
    if (bytes > MAX_BYTES) overBudget += 1
    console.log(`${name.padEnd(34)} ${String(kb).padStart(4)} KB  q${quality}${flag}`)
  }

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`
  console.log(`\n${files.length} images: ${mb(sourceBytes)} → ${mb(outputBytes)}`)
  console.log(`Output: ${path.relative(ROOT, OUT_DIR)}`)

  if (overBudget > 0) {
    console.error(`\n${overBudget} file(s) exceeded the ${MAX_BYTES / 1024} KB budget.`)
    process.exit(1)
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
