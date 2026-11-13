// The banner: quality rules, the 2:1 crop, previews, and the wiring that keeps
// the photo as sharp as the source allows.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BANNER_MAX_WIDTH,
  backgroundFor,
  bannerCrop,
  bannerOutputSize,
  bannerQuality,
  cropCenter,
  fullCrop,
  isUploadedBannerPath,
  pickBannerPhoto,
  visibleArea,
} from '@/lib/media/banner'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const ID = '0b7c6f3e-1d2a-4c5b-9e8f-7a6b5c4d3e2f'

describe('bannerQuality', () => {
  it('rates by the width the crop covers', () => {
    expect(bannerQuality(2400).level).toBe('sharp')
    expect(bannerQuality(1920).level).toBe('sharp')
    expect(bannerQuality(1500).level).toBe('good')
    expect(bannerQuality(1500).tip).toMatch(/1920/)
    expect(bannerQuality(900).level).toBe('soft')
    expect(bannerQuality(900).tip).toMatch(/900 pixels wide/)
  })
})

describe('the crop', () => {
  const wide = { width: 4000, height: 3000 }
  const tall = { width: 1200, height: 1600 }

  it('starts as the largest 2:1 area', () => {
    expect(fullCrop(wide)).toEqual({ width: 4000, height: 2000 })
    expect(fullCrop(tall)).toEqual({ width: 1200, height: 600 })
    expect(fullCrop({ width: 3000, height: 1000 })).toEqual({ width: 2000, height: 1000 })
  })

  it('zooms in around the centre and never leaves the photo', () => {
    expect(bannerCrop(wide, 1, { x: 0.5, y: 0.5 })).toEqual({ x: 0, y: 500, width: 4000, height: 2000 })
    expect(bannerCrop(wide, 2, { x: 0.5, y: 0.5 })).toEqual({ x: 1000, y: 1000, width: 2000, height: 1000 })
    expect(bannerCrop(wide, 2, { x: 0, y: 1 })).toEqual({ x: 0, y: 2000, width: 2000, height: 1000 })
    expect(bannerCrop(wide, 99, { x: 0.5, y: 0.5 }).width).toBe(1000)
    expect(bannerCrop(wide, Number.NaN, { x: Number.NaN, y: 0.5 }).width).toBe(4000)
  })

  it('cropCenter gives back a centre the crop can reach', () => {
    const crop = bannerCrop(wide, 2, { x: 0, y: 0 })
    expect(cropCenter(wide, crop)).toEqual({ x: 0.25, y: 1 / 6 })
  })

  it('a phone shows the middle of the crop, a computer trims top and bottom', () => {
    const crop = { x: 0, y: 0, width: 2000, height: 1000 }
    const phone = visibleArea(crop, 1)
    expect(phone).toEqual({ x: 500, y: 0, width: 1000, height: 1000 })
    const computer = visibleArea(crop, 2.5)
    expect(computer).toEqual({ x: 0, y: 100, width: 2000, height: 800 })
  })

  it('backgroundFor places that area in a box of its shape', () => {
    const css = backgroundFor({ width: 4000, height: 2000 }, { x: 1000, y: 500, width: 2000, height: 1000 })
    expect(css).toEqual({ backgroundSize: '200% 200%', backgroundPosition: '50% 50%' })
    const whole = backgroundFor({ width: 2000, height: 1000 }, { x: 0, y: 0, width: 2000, height: 1000 })
    expect(whole.backgroundPosition).toBe('50% 50%')
  })

  it('stores the crop at its own pixels, up to 2400 wide, never enlarged', () => {
    expect(bannerOutputSize({ x: 0, y: 0, width: 4000, height: 2000 })).toEqual({ width: BANNER_MAX_WIDTH, height: 1200 })
    expect(bannerOutputSize({ x: 0, y: 0, width: 1500, height: 750 })).toEqual({ width: 1500, height: 750 })
  })
})

describe('isUploadedBannerPath', () => {
  it('accepts only this listing’s cover folder', () => {
    const file = '1f2e3d4c-5b6a-4789-8a7b-6c5d4e3f2a1b'
    expect(isUploadedBannerPath(ID, `listings/${ID}/cover/${file}.jpg`)).toBe(true)
    expect(isUploadedBannerPath(ID, `listings/${ID}/gallery/${file}.jpg`)).toBe(false)
    expect(isUploadedBannerPath(ID, `listings/${ID}/cover/../x/${file}.jpg`)).toBe(false)
    expect(isUploadedBannerPath(ID, `listings/other/cover/${file}.jpg`)).toBe(false)
    expect(isUploadedBannerPath('not-a-uuid', `listings/not-a-uuid/cover/${file}.jpg`)).toBe(false)
    expect(isUploadedBannerPath(ID, null)).toBe(false)
  })
})

describe('pickBannerPhoto', () => {
  const p = (url: string, kind: string, width: number | null) => ({ url, kind, width })

  it('suggests the first photo wide enough to stay sharp', () => {
    expect(pickBannerPhoto([p('logo', 'logo', 3000), p('a', 'photo', 600), p('b', 'photo', 1600)])?.url).toBe('b')
  })

  it('falls back to the first photo, and to none', () => {
    expect(pickBannerPhoto([p('a', 'photo', 600), p('b', 'photo', null)])?.url).toBe('a')
    expect(pickBannerPhoto([p('logo', 'logo', 3000)])).toBeNull()
  })
})

describe('wiring', () => {
  it('the Photos card shows the banner, its quality and the crop', () => {
    const grid = read('components/dashboard/MediaGrid.tsx')
    expect(grid).toContain('<BannerPanel')
    expect(grid).toContain('<BannerCropDialog')
    expect(grid).toContain('Use as banner')
    // Uploads keep up to the stored size, not 1920.
    expect(grid).toMatch(/compressImage\(file: File, maxPx = 2400, quality = 0\.9\)/)
  })

  it('a crop is drawn from the original and uploaded as the cover, outside the photo count', () => {
    const editor = read('components/dashboard/BannerEditor.tsx')
    expect(editor).toContain("fd.append('media_role', 'cover')")
    expect(editor).toContain("imageSmoothingQuality = 'high'")
    expect(editor).toMatch(/setBannerAction\(\{ listingId, path \}\)/)
    const store = read('lib/media/storeListingImage.ts')
    expect(store).toMatch(/const isGallery = role === 'gallery'/)
  })

  it('the banner action checks the owner and the path, and cleans up the old banner', () => {
    const action = read('lib/actions/dashboard/setBanner.ts')
    expect(action).toContain("'use server'")
    expect(action).toMatch(/\.eq\('owner_user_id', owner\.user\.id\)/)
    expect(action).toContain('isUploadedBannerPath(listingId, path)')
    expect(action).toContain('isUploadedBannerPath(listingId, previous)')
  })

  it('the page serves the banner at quality 90', () => {
    expect(read('next.config.ts')).toMatch(/qualities: \[75, 90\]/)
    expect(read('components/entity-page/templates/TemplateHero.tsx')).toMatch(/priority\s+quality=\{90\}/)
  })
})
