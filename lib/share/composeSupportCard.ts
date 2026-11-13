// =============================================================================
// Draws the support post in the browser (ticket 183)
// =============================================================================
// The shopper's photo never leaves their phone: it is drawn onto a canvas here
// and handed straight to the share sheet. Nothing is uploaded or stored.
//
//   ┌──────────────────────┐
//   │ ◆ THE BLACQLIST      │   (inside Instagram's top safe zone on a story)
//   │                      │
//   │   photo or brand     │
//   │                      │
//   │ I SUPPORTED          │   gold caps
//   │ Mama's Kitchen       │   Jost Light, shrinks to fit 3 lines
//   │ ───                  │
//   │ Atlanta, GA · Nov 3  │
//   │ ✓ Verified by …      │   approved receipts only
//   │ COLLECTIVE MEMBER · THEBLACQLIST.COM
//   └──────────────────────┘
//
// Browser only (canvas, document.fonts). The words come from supportCard.ts.
// =============================================================================

import type { SupportPost } from '@/lib/share/supportCard'

export type SupportFormat = 'story' | 'feed'

export const SUPPORT_CARD_SIZES: Record<SupportFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  feed: { width: 1080, height: 1350 },
}

const DEEP_BG = '#08080a'
const GOLD = '#c4a065'
const CREAM = '#f4f4f7'
const INK_SOFT = '#b5b5b7'

export const MARK_SRC = '/brand/blacqlist-mark-gold-256.png'
export const TEXTURE_SRC = '/brand/node-bg.webp'

export interface SupportPhoto {
  image: CanvasImageSource
  width: number
  height: number
  /** Where the crop sits, 0 to 1 on each axis. 0.5, 0.5 is centred. */
  focusX: number
  focusY: number
}

export interface SupportCardAssets {
  mark: HTMLImageElement | null
  texture: HTMLImageElement | null
  /** CSS font-family lists for the site's Jost and Inter (from next/font). */
  display: string
  body: string
}

export type SupportCardText = Pick<
  SupportPost,
  'stage' | 'businessLabel' | 'cityLabel' | 'dateLabel' | 'collective'
>

/** Load an image and wait until it can be drawn. Handles HEIC where the browser does. */
export async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  await img.decode()
  return img
}

/**
 * The site's fonts as canvas font families. next/font hashes the family name,
 * so read it from the CSS variable the layout sets on <html>, then make sure
 * each weight the card uses is loaded before drawing.
 */
export async function loadSupportFonts(): Promise<Pick<SupportCardAssets, 'display' | 'body'>> {
  const style = getComputedStyle(document.documentElement)
  const display = style.getPropertyValue('--font-jost').trim() || 'sans-serif'
  const body = style.getPropertyValue('--font-inter').trim() || 'sans-serif'
  await Promise.all(
    [`300 100px ${display}`, `500 40px ${display}`, `400 36px ${body}`, `600 30px ${body}`].map(
      (f) => document.fonts.load(f).catch(() => [])
    )
  )
  return { display, body }
}

/** Everything the card needs that isn't the photo. Missing images are drawn without. */
export async function loadSupportAssets(): Promise<SupportCardAssets> {
  const [fonts, mark, texture] = await Promise.all([
    loadSupportFonts(),
    loadImage(MARK_SRC).catch(() => null),
    loadImage(TEXTURE_SRC).catch(() => null),
  ])
  return { ...fonts, mark, texture }
}

/** Text with letter spacing, drawn a character at a time (ctx.letterSpacing isn't everywhere). */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number
): number {
  let cx = x
  for (const ch of text) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + tracking
  }
  return cx - tracking - x
}

/** Split into lines that fit the width. A single word too long for a line stays whole. */
export function wrapLines(
  measure: (s: string) => number,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (!line || measure(next) <= maxWidth) {
      line = next
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Largest name size whose wrapped lines fit in 3 lines and the width. */
function fitName(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  start: number,
  maxWidth: number
): { size: number; lines: string[] } {
  for (let size = start; size >= 48; size -= 4) {
    ctx.font = `300 ${size}px ${family}`
    const lines = wrapLines((s) => ctx.measureText(s).width, text, maxWidth)
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
    if (lines.length <= 3 && widest <= maxWidth) return { size, lines }
  }
  ctx.font = `300 48px ${family}`
  return { size: 48, lines: wrapLines((s) => ctx.measureText(s).width, text, maxWidth).slice(0, 3) }
}

function drawCover(ctx: CanvasRenderingContext2D, photo: SupportPhoto, w: number, h: number) {
  const scale = Math.max(w / photo.width, h / photo.height)
  const dw = photo.width * scale
  const dh = photo.height * scale
  const fx = Math.min(1, Math.max(0, photo.focusX))
  const fy = Math.min(1, Math.max(0, photo.focusY))
  ctx.drawImage(photo.image, (w - dw) * fx, (h - dh) * fy, dw, dh)
}

function drawBrandGround(
  ctx: CanvasRenderingContext2D,
  assets: SupportCardAssets,
  w: number,
  h: number
) {
  ctx.fillStyle = DEEP_BG
  ctx.fillRect(0, 0, w, h)
  if (assets.texture) {
    ctx.save()
    ctx.globalAlpha = 0.35
    const t = assets.texture
    const scale = Math.max(w / t.naturalWidth, h / t.naturalHeight)
    const dw = t.naturalWidth * scale
    const dh = t.naturalHeight * scale
    ctx.drawImage(t, (w - dw) / 2, (h - dh) / 2, dw, dh)
    ctx.restore()
  }
  const glow = ctx.createRadialGradient(w * 0.7, h * 0.28, 0, w * 0.7, h * 0.28, w * 0.75)
  glow.addColorStop(0, 'rgba(196,160,101,0.30)')
  glow.addColorStop(1, 'rgba(8,8,10,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)
}

/** Draw the whole card onto a context sized to the format. Used for the preview and the file. */
export function drawSupportCard(
  ctx: CanvasRenderingContext2D,
  format: SupportFormat,
  text: SupportCardText,
  photo: SupportPhoto | null,
  assets: SupportCardAssets
): void {
  const { width: W, height: H } = SUPPORT_CARD_SIZES[format]
  const story = format === 'story'
  // Instagram and TikTok cover the top ~220px and bottom ~300px of a story.
  const top = story ? 220 : 72
  const bottom = story ? H - 300 : H - 72
  const pad = 80
  const textWidth = W - pad * 2

  ctx.clearRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  if (photo) {
    ctx.fillStyle = DEEP_BG
    ctx.fillRect(0, 0, W, H)
    drawCover(ctx, photo, W, H)
    // Top scrim so the lockup reads on a bright photo.
    const scrim = ctx.createLinearGradient(0, 0, 0, top + 200)
    scrim.addColorStop(0, 'rgba(8,8,10,0.55)')
    scrim.addColorStop(1, 'rgba(8,8,10,0)')
    ctx.fillStyle = scrim
    ctx.fillRect(0, 0, W, top + 200)
  } else {
    drawBrandGround(ctx, assets, W, H)
  }

  // ── Lockup ────────────────────────────────────────────────────────────────
  const markSize = 64
  if (assets.mark) ctx.drawImage(assets.mark, pad, top, markSize, markSize)
  ctx.fillStyle = CREAM
  ctx.font = `500 34px ${assets.display}`
  drawTracked(ctx, 'THE BLACQLIST', pad + (assets.mark ? markSize + 22 : 0), top + 45, 6)

  // ── Text block, laid out from the bottom up ───────────────────────────────
  const footer = text.collective ? 'COLLECTIVE MEMBER · THEBLACQLIST.COM' : 'THEBLACQLIST.COM'
  const meta = [text.cityLabel, text.dateLabel].filter(Boolean).join(' · ')
  const name = fitName(ctx, text.businessLabel, assets.display, story ? 128 : 112, textWidth)
  const lineHeight = Math.round(name.size * 1.08)

  let y = bottom
  const footerY = y
  y -= 72
  const verifiedY = text.stage === 'verified' ? y : null
  if (verifiedY !== null) y -= 76
  const metaY = meta ? y : null
  if (metaY !== null) y -= 70
  const ruleY = y
  y -= 44
  const nameBottom = y
  const nameTop = nameBottom - lineHeight * (name.lines.length - 1)
  const kickerY = nameTop - name.size - 28

  // Gradient behind the text, from just above the kicker to the bottom.
  const fadeTop = Math.max(0, kickerY - (photo ? 360 : 240))
  const fade = ctx.createLinearGradient(0, fadeTop, 0, H)
  fade.addColorStop(0, 'rgba(8,8,10,0)')
  fade.addColorStop(0.45, photo ? 'rgba(8,8,10,0.78)' : 'rgba(8,8,10,0.55)')
  fade.addColorStop(1, photo ? 'rgba(8,8,10,0.94)' : 'rgba(8,8,10,0.85)')
  ctx.fillStyle = fade
  ctx.fillRect(0, fadeTop, W, H - fadeTop)

  ctx.fillStyle = GOLD
  ctx.font = `600 34px ${assets.body}`
  drawTracked(ctx, 'I SUPPORTED', pad, kickerY, 8)

  ctx.fillStyle = CREAM
  ctx.font = `300 ${name.size}px ${assets.display}`
  name.lines.forEach((line, i) => ctx.fillText(line, pad, nameTop + i * lineHeight))

  ctx.fillStyle = GOLD
  ctx.fillRect(pad, ruleY, 120, 3)

  if (metaY !== null) {
    ctx.fillStyle = CREAM
    ctx.font = `400 38px ${assets.body}`
    ctx.fillText(meta, pad, metaY)
  }

  if (verifiedY !== null) {
    // Gold circle with a check, then the stamp line.
    const r = 22
    const cx = pad + r
    const cy = verifiedY - 13
    ctx.fillStyle = GOLD
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = DEEP_BG
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(cx - 10, cy + 1)
    ctx.lineTo(cx - 3, cy + 8)
    ctx.lineTo(cx + 11, cy - 7)
    ctx.stroke()
    ctx.fillStyle = GOLD
    ctx.font = `600 34px ${assets.body}`
    ctx.fillText('Verified by The BLACQList', pad + r * 2 + 18, verifiedY)
  }

  ctx.fillStyle = INK_SOFT
  ctx.font = `600 24px ${assets.body}`
  drawTracked(ctx, footer, pad, footerY, 3)
}

/** Draw the card off-screen and return it as a PNG. */
export async function composeSupportCard(
  format: SupportFormat,
  text: SupportCardText,
  photo: SupportPhoto | null,
  assets: SupportCardAssets
): Promise<Blob> {
  const { width, height } = SUPPORT_CARD_SIZES[format]
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  drawSupportCard(ctx, format, text, photo, assets)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw card'))), 'image/png')
  )
}
