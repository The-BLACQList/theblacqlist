import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

// The network and storage are stubbed: this pins how a fetched photo is
// judged, not how it is fetched (safe-fetch has its own suite).

const h = vi.hoisted(() => ({
  fetchResult: null as { body: Buffer } | null,
  fetchError: null as Error | null,
  store: { ok: true, path: 'listings/l1/gallery/x.jpg', mediaId: 'm1' } as Record<string, unknown>,
  storedImage: null as { contentType: string; bytes: Buffer } | null,
}))

vi.mock('@/lib/import/safe-fetch', async (orig) => {
  const real = await orig<typeof import('@/lib/import/safe-fetch')>()
  return {
    ...real,
    safeFetch: vi.fn(async () => {
      if (h.fetchError) throw h.fetchError
      return { url: 'https://x.test/a.jpg', status: 200, contentType: 'text/plain', ...h.fetchResult }
    }),
  }
})

vi.mock('@/lib/media/storeListingImage', async (orig) => {
  const real = await orig<typeof import('@/lib/media/storeListingImage')>()
  return {
    ...real,
    storeListingImage: vi.fn(async ({ image }: { image: { contentType: string; bytes: Buffer } }) => {
      h.storedImage = image
      return h.store
    }),
  }
})

const { importRemoteImage } = await import('@/lib/media/importRemoteImage')
const { SafeFetchError } = await import('@/lib/import/safe-fetch')

const JPEG = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#a52' } })
  .withExif({ IFD0: { Make: 'TestPhone' } })
  .jpeg()
  .toBuffer()

const args = {
  supabase: {} as never,
  userId: 'u1',
  listingId: 'l1',
  role: 'gallery' as const,
  url: 'https://x.test/a.jpg',
}

beforeEach(() => {
  h.fetchResult = { body: JPEG }
  h.fetchError = null
  h.store = { ok: true, path: 'listings/l1/gallery/x.jpg', mediaId: 'm1' }
  h.storedImage = null
})

describe('importRemoteImage', () => {
  it('stores a re-encoded copy, typed from its bytes, without EXIF', async () => {
    expect(await importRemoteImage(args)).toEqual({ ok: true, path: 'listings/l1/gallery/x.jpg', mediaId: 'm1' })
    expect(h.storedImage?.contentType).toBe('image/jpeg')
    expect((await sharp(h.storedImage!.bytes).metadata()).exif).toBeUndefined()
  })

  it('skips a photo the site will not give us', async () => {
    h.fetchError = new SafeFetchError('blocked_address', 'no')
    expect(await importRemoteImage(args)).toMatchObject({ ok: false, reason: 'unreachable' })
    expect(h.storedImage).toBeNull()
  })

  it('says a photo is too large rather than unreachable', async () => {
    h.fetchError = new SafeFetchError('too_large', 'big')
    expect(await importRemoteImage(args)).toMatchObject({ ok: false, reason: 'too_large' })
  })

  it('skips formats we do not store, like an HTML page at an image URL', async () => {
    h.fetchResult = { body: Buffer.from('<html>not a photo</html>') }
    expect(await importRemoteImage(args)).toMatchObject({ ok: false, reason: 'unsupported' })
  })

  it('passes the plan line through so the owner sees the real limit', async () => {
    h.store = { ok: false, code: 'PLAN_LIMIT', error: 'Your plan includes 1 photo. Upgrade to add more.', status: 400 }
    expect(await importRemoteImage(args)).toEqual({
      ok: false,
      reason: 'plan_limit',
      message: 'Your plan includes 1 photo. Upgrade to add more.',
    })
  })

  it('never stores into a page someone else owns', async () => {
    h.store = { ok: false, code: 'FORBIDDEN', error: 'x', status: 403 }
    expect(await importRemoteImage(args)).toMatchObject({ ok: false, reason: 'forbidden' })
  })
})
