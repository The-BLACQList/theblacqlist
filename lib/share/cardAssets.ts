import 'server-only'

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Server-side assets for the share-card renderer. Read once per server
// instance. next.config.ts traces assets/fonts and the mark PNG into the
// function bundle (outputFileTracingIncludes), since a readFile path built at
// runtime isn't something the tracer can see.

type Font = { name: string; data: ArrayBuffer; weight: 300 | 500 | 600; style: 'normal' }

let fontsPromise: Promise<Font[]> | null = null
let markPromise: Promise<string> | null = null

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

export function loadCardFonts(): Promise<Font[]> {
  fontsPromise ??= Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/Jost-300.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/Jost-500.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/Inter-600.ttf')),
  ]).then(([jostLight, jostMedium, interSemi]) => [
    { name: 'Jost', data: toArrayBuffer(jostLight), weight: 300, style: 'normal' },
    { name: 'Jost', data: toArrayBuffer(jostMedium), weight: 500, style: 'normal' },
    { name: 'Inter', data: toArrayBuffer(interSemi), weight: 600, style: 'normal' },
  ])
  return fontsPromise
}

export function loadMarkDataUrl(): Promise<string> {
  markPromise ??= readFile(join(process.cwd(), 'public/brand/blacqlist-mark-gold-256.png')).then(
    (buf) => `data:image/png;base64,${buf.toString('base64')}`
  )
  return markPromise
}

const MAX_COVER_BYTES = 5 * 1024 * 1024

/** JPEG starts FF D8 FF; PNG starts 89 50 4E 47. Satori draws nothing else. */
function sniffImageType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'image/png'
  return null
}

/**
 * Fetch a listing cover as a data: URL the renderer can draw. Returns null, and
 * the card falls back to the all-brand design, when:
 * - the URL isn't on our own Supabase Storage host (no fetching arbitrary
 *   owner-pasted URLs from the server);
 * - the fetch fails or is too big;
 * - the image isn't JPEG or PNG (Satori can't decode WebP, measured 2026-11-13).
 */
export async function loadCoverDataUrl(coverUrl: string | null): Promise<string | null> {
  if (!coverUrl) return null
  const storageBase = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!storageBase) return null

  let url: URL
  try {
    url = new URL(coverUrl)
  } catch {
    return null
  }
  if (url.origin !== new URL(storageBase).origin) return null
  if (!url.pathname.startsWith('/storage/v1/object/public/')) return null

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.byteLength > MAX_COVER_BYTES) return null
    const type = sniffImageType(buf)
    if (!type) return null
    return `data:${type};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return null
  }
}
