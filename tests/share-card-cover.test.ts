import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { coverBytesToDataUrl, loadCoverDataUrl, sniffCoverType } from '@/lib/share/cardAssets'

// Ticket 231: the share card drew no cover when the cover was WebP, because
// Satori only draws JPEG and PNG. WebP covers are now re-encoded as JPEG.

const STORAGE = 'https://example.supabase.co'

async function image(format: 'webp' | 'jpeg' | 'png', width = 64, height = 32) {
  const img = sharp({ create: { width, height, channels: 3, background: '#b8860b' } })
  return new Uint8Array(await img[format]().toBuffer())
}

function decode(dataUrl: string) {
  return Buffer.from(dataUrl.split(',')[1] ?? '', 'base64')
}

describe('sniffCoverType', () => {
  it('knows JPEG, PNG and WebP and nothing else', async () => {
    expect(sniffCoverType(await image('jpeg'))).toBe('image/jpeg')
    expect(sniffCoverType(await image('png'))).toBe('image/png')
    expect(sniffCoverType(await image('webp'))).toBe('image/webp')
    expect(sniffCoverType(new TextEncoder().encode('GIF89a-not-a-cover'))).toBeNull()
    expect(sniffCoverType(new Uint8Array([0x52, 0x49]))).toBeNull()
  })
})

describe('coverBytesToDataUrl', () => {
  it('passes JPEG and PNG through unchanged', async () => {
    const jpeg = await image('jpeg')
    const url = await coverBytesToDataUrl(jpeg)
    expect(url?.startsWith('data:image/jpeg;base64,')).toBe(true)
    expect(decode(url!).equals(Buffer.from(jpeg))).toBe(true)
    expect((await coverBytesToDataUrl(await image('png')))?.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('re-encodes a WebP cover as a JPEG the card can draw', async () => {
    const url = await coverBytesToDataUrl(await image('webp', 2400, 1600))
    expect(url?.startsWith('data:image/jpeg;base64,')).toBe(true)
    const meta = await sharp(decode(url!)).metadata()
    expect(meta.format).toBe('jpeg')
    expect(meta.width).toBe(1920)
    expect(meta.height).toBe(1280)
  })

  it('returns null for bytes that only look like WebP', async () => {
    const fake = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 garbage')
    expect(await coverBytesToDataUrl(fake)).toBeNull()
  })
})

describe('loadCoverDataUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('fetches a WebP cover from our storage and returns a JPEG', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', STORAGE)
    const webp = await image('webp')
    const fetchMock = vi.fn(async () => new Response(webp))
    vi.stubGlobal('fetch', fetchMock)
    const url = await loadCoverDataUrl(`${STORAGE}/storage/v1/object/public/listing-media/x/cover/a.webp`)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(url?.startsWith('data:image/jpeg;base64,')).toBe(true)
  })

  it('never fetches a cover from another host', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', STORAGE)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await loadCoverDataUrl('https://elsewhere.example/storage/v1/object/public/a.webp')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
