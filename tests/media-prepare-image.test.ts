import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { IMAGE_MAX_EDGE, prepareImage, sniffImageType } from '@/lib/media/prepareImage'

// Real images built in memory. The GPS block is the reason this file exists:
// a phone photo's location must never reach the public bucket.

const GPS_EXIF = {
  IFD0: { Make: 'TestPhone', Model: 'Camera 1' },
  IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '33/1 45/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '84/1 23/1 0/1' },
}

function solid(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } })
}

const JPEG_WITH_GPS = await solid(32, 16).withExif(GPS_EXIF).jpeg().toBuffer()
const PNG = await solid(8, 8).png().toBuffer()
const WEBP_WITH_GPS = await solid(8, 8).withExif(GPS_EXIF).webp().toBuffer()
const GIF = Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'binary')

describe('prepareImage', () => {
  it('removes EXIF, including GPS, from a JPEG', async () => {
    expect((await sharp(JPEG_WITH_GPS).metadata()).exif).toBeDefined()
    const out = await prepareImage(JPEG_WITH_GPS, 'image/jpeg')
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.contentType).toBe('image/jpeg')
    expect(out.ext).toBe('jpg')
    expect((await sharp(out.bytes).metadata()).exif).toBeUndefined()
    expect(out.bytes.includes(Buffer.from('TestPhone'))).toBe(false)
  })

  it('removes EXIF from a WebP', async () => {
    const out = await prepareImage(WEBP_WITH_GPS, 'image/webp')
    expect(out.ok && (await sharp(out.bytes).metadata()).exif).toBeFalsy()
  })

  it('scales a large image down to the long-edge cap and keeps the shape', async () => {
    const big = await solid(4800, 1200).jpeg().toBuffer()
    const out = await prepareImage(big, 'image/jpeg')
    expect(out.ok && [out.width, out.height]).toEqual([IMAGE_MAX_EDGE, 600])
  })

  it('never enlarges a small image', async () => {
    const out = await prepareImage(PNG, 'image/png')
    expect(out.ok && [out.width, out.height, out.contentType]).toEqual([8, 8, 'image/png'])
  })

  it('refuses bytes that are not the declared type', async () => {
    expect(await prepareImage(PNG, 'image/jpeg')).toEqual({ ok: false, reason: 'mismatch' })
  })

  it('refuses a declared type we do not store', async () => {
    expect(await prepareImage(GIF, 'image/gif')).toEqual({ ok: false, reason: 'unsupported' })
  })

  it('reads the type from the bytes when none is declared', async () => {
    const out = await prepareImage(WEBP_WITH_GPS)
    expect(out.ok && out.contentType).toBe('image/webp')
    expect(await prepareImage(GIF)).toEqual({ ok: false, reason: 'unsupported' })
  })

  it('refuses a file that only looks like a JPEG in its first bytes', async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2048)])
    expect(await prepareImage(fake, 'image/jpeg')).toEqual({ ok: false, reason: 'unreadable' })
  })
})

describe('sniffImageType', () => {
  it('names the three stored types and nothing else', () => {
    expect(sniffImageType(JPEG_WITH_GPS.subarray(0, 12))).toBe('image/jpeg')
    expect(sniffImageType(PNG.subarray(0, 12))).toBe('image/png')
    expect(sniffImageType(WEBP_WITH_GPS.subarray(0, 12))).toBe('image/webp')
    expect(sniffImageType(GIF.subarray(0, 12))).toBeNull()
  })
})
