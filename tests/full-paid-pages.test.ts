// =============================================================================
// Ticket 233: full pages for paying businesses
// =============================================================================
// The strength meter's gallery item matches the full page's 4-photo rule, the
// editor says what turns the full page on, one video reads "1 Video", and no
// photo appears twice on a Storefront chapters page (Creative F11).
// =============================================================================

import { describe, expect, it } from 'vitest'

import type { EntityPageData } from '@/types'
import { storefrontEntity } from '@/lib/example/fixtures/storefront'
import {
  CHAPTERS_MIN_PHOTOS,
  chaptersEligible,
  chaptersMissing,
} from '@/lib/entity-page/chapters-eligibility'
import { computePageChecklist } from '@/lib/ai/checklist'
import { buildChapterData } from '@/components/entity-page/chapters/model'
import { liveStorefrontPreset } from '@/components/entity-page/chapters/live'
import { photoKey, storefrontPlacedSrcs } from '@/components/entity-page/chapters/presets'
import { videoCountLabel } from '@/components/entity-page/chapters/parts'

const NOW = new Date('2026-11-19T15:00:00Z')
const VISITOR = {
  initialSaved: false,
  userId: null,
  isOwner: false,
  hasReviewed: false,
  path: '/atlanta/business/sample-co',
}

const LISTING = {
  tagline: null,
  meta_title: null,
  meta_description: null,
  cover_image_path: null,
  logo_path: null,
  entity_type: 'business',
}

function galleryItem(mediaCount: number, tier: string | null = 'starter', type = 'business') {
  return computePageChecklist(
    { ...LISTING, entity_type: type },
    null,
    mediaCount,
    0,
    0,
    tier
  ).items.find((i) => i.id === 'gallery')
}

/** The listing with `n` gallery photos, none of them the cover. */
function withPhotos(n: number, over: Partial<EntityPageData> = {}): EntityPageData {
  const e = storefrontEntity(NOW)
  const images = e.images.filter((g) => g.src !== e.cover_image_path).slice(0, n)
  expect(images).toHaveLength(n)
  return { ...e, images, ...over } as EntityPageData
}

/** Every photo key the Storefront page shows: the placed photos, then the gallery. */
function shownSrcs(e: EntityPageData): string[] {
  const preset = liveStorefrontPreset(e)
  const data = buildChapterData(e, preset, NOW, VISITOR)
  const menuShown = data.chapters.some((c) => c.id === 'menu') && data.menu.length > 0
  const placed = storefrontPlacedSrcs(preset, data.cover?.src, menuShown)
  const gallery = data.chapters.some((c) => c.id === 'gallery')
    ? data.gallery.map((g) => photoKey(g.src)).filter((k) => !placed.has(k))
    : []
  return [...placed, ...gallery]
}

describe('strength meter gallery item', () => {
  it('passes at the full page’s minimum, not before', () => {
    expect(CHAPTERS_MIN_PHOTOS).toBe(4)
    expect(galleryItem(3)?.passed).toBe(false)
    expect(galleryItem(4)?.passed).toBe(true)
  })

  it('tells Storefront owners what turns the full page on', () => {
    expect(galleryItem(0)?.hint).toContain('turn on the full page layout')
    expect(galleryItem(0, 'starter', 'professional')?.hint).not.toContain('full page')
  })

  it('stays out of a Free page’s score, which allows 3 photos', () => {
    expect(galleryItem(0, 'free')).toBeUndefined()
    expect(galleryItem(0, 'starter')).toBeDefined()
  })
})

describe('chaptersMissing', () => {
  const ok = { entityType: 'business', hasCover: true, photoCount: 4, hasStory: true }

  it('is empty when the listing has everything', () => {
    expect(chaptersMissing(ok)).toEqual([])
  })

  it('names what is short, in the owner’s words', () => {
    expect(chaptersMissing({ ...ok, hasCover: false, photoCount: 1, hasStory: false })).toEqual([
      'a banner photo',
      '3 more gallery photos',
      'a description',
    ])
    expect(chaptersMissing({ ...ok, photoCount: 3 })).toEqual(['1 more gallery photo'])
  })

  it('is null for types that never get the full page', () => {
    expect(chaptersMissing({ ...ok, entityType: 'professional' })).toBeNull()
  })

  it('agrees with chaptersEligible', () => {
    for (const n of [0, 3, 4, 7]) {
      const e = withPhotos(n)
      const missing = chaptersMissing({
        entityType: e.entity_type,
        hasCover: Boolean(e.cover_image_path),
        photoCount: e.images.length,
        hasStory: Boolean(e.details.description?.trim()),
      })
      expect(missing?.length === 0).toBe(chaptersEligible(e))
    }
  })
})

describe('photoKey', () => {
  it('gives a bare storage path and its public URL the same key', () => {
    const path = 'abc-123/cover.webp'
    const url = `https://x.supabase.co/storage/v1/object/public/listing-media/${path}`
    expect(photoKey(path)).toBe(photoKey(url))
    expect(photoKey(`${url}?v=2`)).toBe(path)
  })

  it('keeps other addresses as they are', () => {
    expect(photoKey('/example/cafe-cover.webp')).toBe('example/cafe-cover.webp')
  })
})

describe('live cover written as a bare storage path', () => {
  it('is never used again in a slot or the gallery', () => {
    const base = withPhotos(7)
    const url = 'https://x.supabase.co/storage/v1/object/public/listing-media/abc/cover.webp'
    const e = {
      ...base,
      cover_image_path: 'abc/cover.webp',
      images: [{ ...base.images[0]!, src: url }, ...base.images],
    } as EntityPageData
    const p = liveStorefrontPreset(e)
    const slots = [...p.duo, ...p.interludes, p.menuPhoto].filter(Boolean).map((x) => x!.src)
    expect(slots).not.toContain(url)
  })
})

describe('video count', () => {
  it('reads "1 Video" for one and "N Videos" for more', () => {
    expect(videoCountLabel(1)).toBe('1 Video')
    expect(videoCountLabel(3)).toBe('3 Videos')
  })
})

describe('no photo repeats on a Storefront page (F11)', () => {
  it('never shows a photo twice, at any gallery size', () => {
    for (const n of [4, 5, 6, 7, 10]) {
      const srcs = shownSrcs(withPhotos(n))
      expect(new Set(srcs).size).toBe(srcs.length)
    }
  })

  it('still shows every photo once', () => {
    const e = withPhotos(10)
    const srcs = new Set(shownSrcs(e))
    for (const g of e.images) expect(srcs.has(photoKey(g.src))).toBe(true)
  })

  it('leaves the cover out of the gallery when it is also a gallery photo', () => {
    const base = withPhotos(7)
    const e = {
      ...base,
      images: [{ ...base.images[0]!, src: base.cover_image_path! }, ...base.images],
    }
    const srcs = shownSrcs(e as EntityPageData)
    expect(srcs.filter((s) => s === photoKey(base.cover_image_path!))).toHaveLength(1)
  })

  it('drops the Gallery chapter when every photo is placed and there are no videos', () => {
    const e = withPhotos(4, {})
    const noExtras = {
      ...e,
      details: { ...e.details, services: [], videos: [] },
    } as EntityPageData
    // No menu: 4 photos fill the duo and two interludes... and one is left.
    expect(liveStorefrontPreset(noExtras).chapters.map((c) => c.id)).toContain('gallery')
    const withMenu = withPhotos(6, {
      details: { ...e.details, videos: [] },
    } as Partial<EntityPageData>)
    // Menu shows: duo 2 + interludes 3 + menu 1 = 6, nothing left for the gallery.
    expect(liveStorefrontPreset(withMenu).chapters.map((c) => c.id)).not.toContain('gallery')
  })

  it('keeps the chapter as Videos when only videos are left', () => {
    const e = withPhotos(6)
    expect(e.details.videos.length).toBeGreaterThan(0)
    const ch = liveStorefrontPreset(e).chapters.find((c) => c.id === 'gallery')
    expect(ch).toMatchObject({ nav: 'Videos', title: 'Videos' })
  })

  it('keeps the menu photo for the gallery when no menu shows', () => {
    const e = withPhotos(6)
    const noMenu = { ...e, details: { ...e.details, services: [] } } as EntityPageData
    expect(liveStorefrontPreset(noMenu).menuPhoto).toBeNull()
    expect(liveStorefrontPreset(noMenu).chapters.find((c) => c.id === 'gallery')?.nav).toBe(
      'Gallery'
    )
  })
})

describe('sample storefront: posts, Shop and review photos are their own (QA233-01, QA233-02)', () => {
  it('repeats no gallery or cover photo, and none of each other', () => {
    const e = storefrontEntity(NOW)
    const pool = new Set(
      [e.cover_image_path, ...e.images.map((g) => g.src)].map((s) => photoKey(s!))
    )
    const own = [
      ...(e.happeningNow ?? []).map((p) => p.imageUrl),
      ...(e.shop?.items ?? []).map((i) => i.image?.src),
      ...e.reviews.flatMap((r) => (r.photos ?? []).map((p) => p.src)),
      ...(e.team ?? []).map((t) => t.photo?.src),
    ]
      .filter((s): s is string => Boolean(s))
      .map(photoKey)
    expect(own.length).toBeGreaterThan(5)
    expect(own.filter((k) => pool.has(k))).toEqual([])
    expect(new Set(own).size).toBe(own.length)
  })
})
