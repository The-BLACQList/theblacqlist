// =============================================================================
// Ticket 231: the chapters layout on real Storefront listings
// =============================================================================
// Which listings get it (eligibility), which requests ask for it (flag and the
// Preview opt-in), and what the live model builds from a loader-shaped entity:
// real trust tier, real links, the viewer's actions, and chapters that drop
// out of the page and the nav when the listing has nothing to fill them.
// =============================================================================

import { describe, expect, it } from 'vitest'

import type { EntityPageData } from '@/types'
import { storefrontEntity } from '@/lib/example/fixtures/storefront'
import {
  CHAPTERS_MIN_PHOTOS,
  chaptersEligible,
  chaptersRequested,
} from '@/lib/entity-page/chapters-eligibility'
import { buildChapterData, type LiveInput } from '@/components/entity-page/chapters/model'
import { liveStorefrontPreset } from '@/components/entity-page/chapters/live'
import { STOREFRONT_PRESET } from '@/components/entity-page/chapters/presets'

const NOW = new Date('2026-11-18T15:00:00Z')
const VISITOR: LiveInput = {
  initialSaved: false,
  userId: null,
  isOwner: false,
  hasReviewed: false,
  path: '/atlanta/business/sample-co',
}

function full(): EntityPageData {
  return storefrontEntity(NOW)
}

/** A listing with the minimum the layout needs and nothing else. */
function thin(): EntityPageData {
  const e = full()
  return {
    ...e,
    trust_tier: 'unclaimed',
    ownership_label: 'ally',
    details: {
      ...e.details,
      address: null,
      address_line2: null,
      hours: null,
      services: [],
      videos: [],
      social: {
        instagram: null,
        facebook: null,
        linkedin: null,
        tiktok: null,
        youtube: null,
        twitter: null,
      },
      lat: null,
      lng: null,
    },
    images: e.images.slice(0, CHAPTERS_MIN_PHOTOS),
    reviews: [],
    reviewCriteriaAverages: [],
    deals: [],
    locations: [],
    findUsAt: [],
    orderLinks: [],
    links: [],
    buttons: [],
    documents: [],
    faqs: [],
    attributes: [],
    happeningNow: [],
  } as EntityPageData
}

describe('chaptersEligible', () => {
  it('takes a Storefront listing with a cover, four photos and a story', () => {
    expect(chaptersEligible(full())).toBe(true)
    expect(chaptersEligible(thin())).toBe(true)
  })

  it.each([
    ['no cover', (e: EntityPageData) => ({ ...e, cover_image_path: '  ' })],
    ['three photos', (e: EntityPageData) => ({ ...e, images: e.images.slice(0, 3) })],
    ['no story', (e: EntityPageData) => ({ ...e, details: { ...e.details, description: '' } })],
    ['a non-Storefront type', (e: EntityPageData) => ({ ...e, entity_type: 'professional' })],
    // Ticket 239 (founder, 2026-11-21): the full layout is Starter and up,
    // even for a Free page we added ourselves with plenty of photos.
    ['a Free plan', (e: EntityPageData) => ({ ...e, tier: 'free' })],
  ] as const)('keeps today’s page with %s', (_, change) => {
    expect(chaptersEligible(change(full()) as EntityPageData)).toBe(false)
  })

  it('takes every paid plan', () => {
    // The row holds a plan slug; types/index.ts Tier still says 'standard'.
    for (const tier of ['starter', 'growth', 'premium'])
      expect(chaptersEligible({ ...full(), tier } as unknown as EntityPageData)).toBe(true)
  })

  it('takes restaurants and vendors too', () => {
    for (const t of ['restaurant', 'vendor'] as const)
      expect(chaptersEligible({ ...full(), entity_type: t })).toBe(true)
  })
})

describe('chaptersRequested', () => {
  it('is off in production without the flag, whatever the query says', () => {
    expect(chaptersRequested({ flagOn: false, production: true, layout: 'chapters' })).toBe(false)
    expect(chaptersRequested({ flagOn: false, production: true, layout: undefined })).toBe(false)
  })

  it('opts one request in off production with ?layout=chapters', () => {
    expect(chaptersRequested({ flagOn: false, production: false, layout: 'chapters' })).toBe(true)
    expect(chaptersRequested({ flagOn: false, production: false, layout: ['chapters'] })).toBe(true)
    expect(chaptersRequested({ flagOn: false, production: false, layout: undefined })).toBe(false)
  })

  it('is the default with the flag on', () => {
    expect(chaptersRequested({ flagOn: true, production: true, layout: undefined })).toBe(true)
  })

  it('?layout=stack always forces today’s page', () => {
    for (const production of [true, false])
      for (const flagOn of [true, false])
        expect(chaptersRequested({ flagOn, production, layout: 'stack' })).toBe(false)
  })
})

describe('buildChapterData on a live listing', () => {
  it('leaves the sample page as it was when no viewer is given', () => {
    const data = buildChapterData(full(), STOREFRONT_PRESET, NOW)
    expect(data.live).toBeNull()
    expect(data.place).toBe('Atlanta')
    expect(data.links.every((l) => l.href === null)).toBe(true)
    expect(data.videos.every((v) => v.title.startsWith('Sample Video') && v.href === null)).toBe(
      true
    )
  })

  it('builds real links, a real city and the viewer’s actions', () => {
    const e = full()
    const data = buildChapterData(e, liveStorefrontPreset(e), NOW, VISITOR)
    expect(data.live).not.toBeNull()
    expect(data.place).toBe(e.city?.name ?? null)
    expect(data.links.length).toBeGreaterThan(0)
    expect(data.links.every((l) => typeof l.href === 'string' && l.href.length > 0)).toBe(true)
    // Signed out: the review action is a sign-in link back to the reviews.
    expect(data.live?.review).toBe('sign_in')
    expect(data.live?.signInHref).toBe(
      `/sign-in?next=${encodeURIComponent('/atlanta/business/sample-co#reviews')}`
    )
    // Pass 2 on live pages.
    expect(data.events).toEqual([])
    expect(data.jobs).toEqual([])
    expect(data.related).toEqual([])
    expect(data.shop).toBeNull()
    expect(data.booking).toBeNull()
    expect(data.happening.every((p) => p.button === null)).toBe(true)
  })

  it('takes the trust badge and line from the listing’s tier', () => {
    const e = full()
    const tier = (t: EntityPageData['trust_tier']) =>
      buildChapterData({ ...e, trust_tier: t }, liveStorefrontPreset(e), NOW, VISITOR)
    expect(tier('unclaimed').badges.filter((b) => b.tier !== null)).toEqual([])
    expect(tier('unclaimed').trust).toBeNull()
    expect(tier('unclaimed').live?.claimHref).toBe(`/claim/${e.id}`)
    expect(tier('claimed').badges).toContainEqual({ label: 'Claimed', tier: 1 })
    expect(tier('claimed').trust).toBeNull()
    expect(tier('claimed').live?.claimHref).toBeNull()
    expect(tier('verified').badges).toContainEqual({ label: 'Verified', tier: 2 })
    expect(tier('verified').trust?.short).toBe('Verified by The BLACQList')
    expect(tier('certified').badges).toContainEqual({ label: 'BLACQList Certified', tier: 3 })
    expect(tier('certified').trust?.short).toBe('BLACQList Certified')
  })

  it('gives a signed-in customer the form, and the owner and a past reviewer neither', () => {
    const e = full()
    const p = liveStorefrontPreset(e)
    const as = (v: Partial<LiveInput>) => buildChapterData(e, p, NOW, { ...VISITOR, ...v }).live
    expect(as({ userId: 'u1' })?.review).toBe('write')
    expect(as({ userId: 'u1', isOwner: true })?.review).toBeNull()
    expect(as({ userId: 'u1', hasReviewed: true })?.review).toBeNull()
  })
})

describe('liveStorefrontPreset', () => {
  it('lists every chapter a full listing fills, and never Shop', () => {
    const ids = liveStorefrontPreset(full()).chapters.map((c) => c.id)
    expect(ids).toEqual(['welcome', 'visit', 'menu', 'gallery', 'reviews', 'more'])
  })

  it('drops Visit and Menu from the page and the nav when a thin listing has neither', () => {
    const e = thin()
    const preset = liveStorefrontPreset(e)
    const data = buildChapterData(e, preset, NOW, VISITOR)
    expect(data.chapters.map((c) => c.id)).toEqual(['welcome', 'gallery', 'reviews', 'more'])
  })

  it('calls the menu Offerings unless the listing is a restaurant', () => {
    const e = full()
    const menu = (t: EntityPageData['entity_type']) =>
      liveStorefrontPreset({ ...e, entity_type: t }).chapters.find((c) => c.id === 'menu')
    expect(menu('restaurant')?.nav).toBe('Menu')
    expect(menu('business')?.nav).toBe('Offerings')
  })

  it('names the chapter Offers when a listing has deals but no menu', () => {
    const e = full()
    const noMenu = { ...e, details: { ...e.details, services: [] } } as EntityPageData
    const menu = liveStorefrontPreset(noMenu).chapters.find((c) => c.id === 'menu')
    expect(menu).toMatchObject({ nav: 'Offers', title: 'Offers' })
    expect(buildChapterData(noMenu, liveStorefrontPreset(noMenu), NOW, VISITOR).menu).toEqual([])
  })

  it('takes photos from the gallery, skips the cover and never repeats one', () => {
    const e = full()
    const p = liveStorefrontPreset({
      ...e,
      cover_image_path: e.images[0]!.src,
      images: [e.images[0]!, ...e.images.slice(0, 5)],
    })
    const used = [...p.duo, ...p.interludes, p.menuPhoto].filter(Boolean).map((x) => x!.src)
    expect(used).not.toContain(e.images[0]!.src)
    expect(new Set(used).size).toBe(used.length)
  })

  it('leaves photo slots empty when the gallery runs short', () => {
    const e = thin()
    const p = liveStorefrontPreset({ ...e, cover_image_path: e.images[0]!.src })
    // Four photos, one of them the cover: the duo and one interlude, nothing more.
    expect(p.duo).toHaveLength(2)
    expect(p.interludes).toEqual([
      e.images[3] && { src: e.images[3].src, alt: e.images[3].alt },
      null,
      null,
    ])
    expect(p.menuPhoto).toBeNull()
  })

  it('builds the glance line from the founding year and attributes', () => {
    const e = full()
    const g = liveStorefrontPreset(e).glance
    expect(g.length).toBeLessThanOrEqual(3)
    if (e.details.founded_year) expect(g[0]).toBe(`Est. ${e.details.founded_year}`)
  })
})
