// =============================================================================
// Ticket 184 — the "Test Business 123" fixtures
// =============================================================================
// The three sample pages exist to show every Premium feature filled, one per
// template. The checks below are the promise, written down:
//
//   - every section the registry lists for the template is filled, so a
//     section the fixture forgot shows up here, not on a founder walkthrough;
//   - every image is a repo asset under /images/example that exists on disk
//     and has a licence record, and every record has a file — the credit strip
//     and docs/blacqlist/design/example-image-licenses.md are only as honest
//     as this 1:1 check;
//   - dates are relative to the injected clock, so events are always upcoming,
//     deals unexpired and reviews in the past, on any day the page is seen;
//   - the sample never wears the Certified badge, which is earned, never
//     sampled (lib/stripe/features.ts header).
// =============================================================================

import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  TEMPLATE_SECTION_ORDER,
  templateKeyFor,
  applyTierGates,
  visibleSections,
  type TemplateKey,
} from '@/lib/entity-page/sections'
import {
  EXAMPLE_NAME,
  EXAMPLE_VARIANTS,
  buildExampleEntity,
  isExampleVariant,
  type ExampleVariant,
} from '@/lib/example/fixtures'
import { EXAMPLE_ASSET_DIR } from '@/lib/example/fixtures/shared'
import { isHighlightIcon } from '@/components/entity-page/highlightIcons'
import { EXAMPLE_PHOTO_CREDITS } from '@/lib/example/photoCredits'
import { DEALS_ON_MAX, dealEndsLabel, parseDeal } from '@/lib/listings/deals'
import { EXAMPLE_ASSET_PATH } from '@/lib/listings/exampleAssets'
import { factsFor } from '@/lib/listings/facts'
import { filterByAlbum, galleryAlbums } from '@/lib/listings/galleryAlbums'
import {
  POST_BODY_MAX,
  POST_BUTTON_LABEL_MAX,
  POST_HEADLINE_MAX,
  POST_MAX_DAYS,
  endsLabel,
} from '@/lib/listings/happeningNow'
import { futureDateKey, localDateKey } from '@/lib/listings/hoursOverrides'
import { locationPins } from '@/lib/listings/locationPins'
import { founderFirst, splitFounderBio } from '@/lib/listings/team'
import { TIER_LIMITS, activePostLimit } from '@/lib/stripe/features'
import type { EntityPageData } from '@/types'

const NOW = new Date('2026-11-13T12:00:00Z')

const TEMPLATE_OF: Record<ExampleVariant, TemplateKey> = {
  storefront: 'storefront',
  professional: 'professional',
  creative: 'creative',
}

const ASSET_DIR = path.resolve(process.cwd(), 'public', EXAMPLE_ASSET_DIR.replace(/^\//, ''))

/** Every image path a page can carry, wherever the templates read one from. */
function imageSrcs(entity: EntityPageData): string[] {
  const srcs: (string | null | undefined)[] = [
    entity.cover_image_path,
    entity.logo?.src,
    ...entity.images.map((i) => i.src),
    ...entity.reviews.flatMap((r) => r.photos.map((p) => p.src)),
    ...(entity.team ?? []).map((t) => t.photo?.src),
    ...(entity.happeningNow ?? []).map((p) => p.imageUrl),
    ...(entity.shop?.items ?? []).map((i) => i.image?.src),
    ...(entity.hiring?.roles ?? []).map((r) => r.job_details?.businessLogoUrl),
    ...(entity.hiring?.roles ?? []).map((r) => r.cover_image_path),
    ...entity.related.map((r) => r.cover_image_path),
  ]
  return srcs.filter((s): s is string => typeof s === 'string' && s.length > 0)
}

describe('variants', () => {
  it('are exactly storefront, professional and creative', () => {
    expect([...EXAMPLE_VARIANTS]).toEqual(['storefront', 'professional', 'creative'])
    expect(isExampleVariant('storefront')).toBe(true)
    expect(isExampleVariant('nope')).toBe(false)
    expect(isExampleVariant('')).toBe(false)
  })
})

for (const variant of EXAMPLE_VARIANTS) {
  const template = TEMPLATE_OF[variant]

  describe(`${variant}`, () => {
    const entity = buildExampleEntity(variant, NOW)

    it('renders with the template its variant names', () => {
      expect(templateKeyFor(entity.entity_type)).toBe(template)
    })

    it('fills every section the registry lists for that template, plus the logo', () => {
      expect(visibleSections(entity, template)).toEqual([...TEMPLATE_SECTION_ORDER[template]])
      expect(entity.logo).toBeTruthy()
    })

    it('is a Premium, verified — never certified — sample that search engines skip', () => {
      expect(entity.name).toBe(EXAMPLE_NAME)
      expect(entity.id).toBe(`example-${variant}`)
      expect(entity.tier).toBe('premium')
      expect(entity.trust_tier).toBe('verified')
      expect(entity.noindex).toBe(true)
      expect(entity.is_featured).toBe(true)
      expect(entity.messaging?.mode).toBe('compose')
      expect(entity.details.email).toBe('hello@example.com')
      expect(entity.details.phone).toMatch(/^\(404\) 555-01\d\d$/)
    })

    it('stays inside the Premium caps, so the page shows what a real Premium owner could', () => {
      const premium = TIER_LIMITS.premium
      if (premium.photos !== null) expect(entity.images.length).toBeLessThanOrEqual(premium.photos)
      if (premium.locations !== null)
        expect(entity.locations?.length ?? 0).toBeLessThanOrEqual(premium.locations - 1)
      if (premium.jobs !== null)
        expect(entity.hiring?.roles.length ?? 0).toBeLessThanOrEqual(premium.jobs)
      expect(applyTierGates(entity, 'premium')).toEqual(entity)
    })

    it('carries happening-now posts inside main’s rules: live, soonest ending first, within the cap', () => {
      const posts = entity.happeningNow ?? []
      const cap = activePostLimit('premium')
      expect(posts.length).toBeGreaterThanOrEqual(2)
      if (cap !== null) expect(posts.length).toBeLessThanOrEqual(cap)
      expect(new Set(posts.map((p) => p.id)).size).toBe(posts.length)
      const horizon = NOW.getTime() + POST_MAX_DAYS * 24 * 60 * 60 * 1000
      let previous = NOW.getTime()
      for (const post of posts) {
        const ends = Date.parse(post.endsAt)
        expect(ends, post.id).toBeGreaterThan(previous)
        expect(ends, post.id).toBeLessThanOrEqual(horizon)
        previous = ends
        expect(post.headline.trim().length, post.id).toBeGreaterThan(4)
        expect(post.headline.length, post.id).toBeLessThanOrEqual(POST_HEADLINE_MAX)
        expect(post.body?.trim().length ?? 0, post.id).toBeGreaterThan(20)
        expect(post.body?.length ?? 0, post.id).toBeLessThanOrEqual(POST_BODY_MAX)
        expect(post.buttonLabel?.length ?? 0, post.id).toBeLessThanOrEqual(POST_BUTTON_LABEL_MAX)
        expect(endsLabel(post.endsAt, NOW), post.id).not.toBe('Ended')
      }
    })

    it('fills the facts line: a founding year and a price band at least', () => {
      expect(entity.details.founded_year).toBeTypeOf('number')
      expect(entity.details.price_range).toBeTruthy()
      expect(factsFor(entity.details).length).toBeGreaterThanOrEqual(2)
    })

    it('pins the main location and at least one other on the Visit map', () => {
      const pins = locationPins(entity)
      expect(pins.length).toBeGreaterThanOrEqual(2)
      expect(pins[0]?.primary).toBe(true)
      expect(pins.filter((p) => p.primary)).toHaveLength(1)
      for (const p of pins) {
        // Atlanta to Charlotte: anything outside this box is a typo, not a shop.
        expect(p.lat, p.id).toBeGreaterThan(30)
        expect(p.lat, p.id).toBeLessThan(37)
        expect(p.lng, p.id).toBeGreaterThan(-86)
        expect(p.lng, p.id).toBeLessThan(-79)
      }
    })

    it('lists special hours inside the next 30 days, none today, each date once', () => {
      const overrides = entity.hoursOverrides ?? []
      expect(overrides.length).toBeGreaterThanOrEqual(2)
      const today = localDateKey(NOW)
      const horizon = futureDateKey(NOW, 30)
      for (const o of overrides) {
        expect(o.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(o.date > today, o.date).toBe(true)
        expect(o.date <= horizon, o.date).toBe(true)
        expect(o.label).toBeTruthy()
        if (!o.closed) {
          expect(o.open).toMatch(/^\d{2}:\d{2}$/)
          expect(o.close).toMatch(/^\d{2}:\d{2}$/)
        }
      }
      expect(new Set(overrides.map((o) => o.date)).size).toBe(overrides.length)
      expect(overrides.some((o) => o.closed)).toBe(true)
      expect(overrides.some((o) => !o.closed)).toBe(true)
    })

    it('shows at least three highlights of one kind, each naming an icon the allow-list knows', () => {
      const highlights = entity.highlights ?? []
      expect(highlights.length).toBeGreaterThanOrEqual(3)
      expect(new Set(highlights.map((h) => h.kind)).size).toBe(1)
      expect(new Set(highlights.map((h) => h.id)).size).toBe(highlights.length)
      for (const h of highlights) {
        expect(h.title).toBeTruthy()
        expect(h.text).toBeTruthy()
        expect(h.icon !== null && isHighlightIcon(h.icon), `${h.id}: ${h.icon}`).toBe(true)
      }
    })

    it('offers at least one PDF to download, over https', () => {
      const documents = entity.documents ?? []
      expect(documents.length).toBeGreaterThanOrEqual(1)
      for (const d of documents) {
        expect(d.label).toBeTruthy()
        expect(d.href).toMatch(/^https:\/\/.+\.pdf$/)
        expect(d.sizeLabel).toMatch(/^\d+(\.\d+)? (KB|MB)$/)
      }
    })

    it('files every photo under one of at least three albums', () => {
      const albums = galleryAlbums(entity.images)
      expect(albums.length).toBeGreaterThanOrEqual(3)
      expect(new Set(albums).size).toBe(albums.length)
      for (const img of entity.images) {
        expect(img.album, img.id).toBeTruthy()
        expect(albums).toContain(img.album)
      }
      const counted = albums.reduce((n, a) => n + filterByAlbum(entity.images, a).length, 0)
      expect(counted).toBe(entity.images.length)
      expect(filterByAlbum(entity.images, null)).toEqual(entity.images)
    })

    it('names exactly one founder, whose bio opens with a quotable line', () => {
      const founders = (entity.team ?? []).filter((m) => m.isFounder)
      expect(founders).toHaveLength(1)
      const founder = founders[0]!
      expect(founderFirst(entity.team ?? [])[0]).toBe(founder)
      const { quote, rest } = splitFounderBio(founder.bio)
      expect(quote).toBeTruthy()
      expect(quote!.length).toBeLessThanOrEqual(140)
      expect(rest).toBeTruthy()
    })

    it('lists credentials of two or more kinds; press links out, no year is in the future', () => {
      const credentials = entity.credentials ?? []
      expect(credentials.length).toBeGreaterThanOrEqual(3)
      expect(new Set(credentials.map((c) => c.kind)).size).toBeGreaterThanOrEqual(2)
      expect(new Set(credentials.map((c) => c.id)).size).toBe(credentials.length)
      for (const c of credentials) {
        expect(c.title).toBeTruthy()
        expect(c.issuer).toBeTruthy()
        if (c.year !== null) expect(c.year).toBeLessThanOrEqual(NOW.getFullYear())
        if (c.kind === 'press') expect(c.href, c.id).toMatch(/^https:\/\//)
      }
    })

    it('reads every image from the example asset folder, and each file exists', () => {
      const srcs = imageSrcs(entity)
      expect(srcs.length).toBeGreaterThan(12)
      for (const src of srcs) {
        expect(src, src).toMatch(EXAMPLE_ASSET_PATH)
        expect(existsSync(path.resolve(process.cwd(), 'public', src.replace(/^\//, ''))), src).toBe(
          true
        )
      }
    })

    it('has a cover, at least twelve captioned gallery photos and real demo videos', () => {
      expect(entity.cover_image_path).toMatch(EXAMPLE_ASSET_PATH)
      expect(entity.images.length).toBeGreaterThanOrEqual(12)
      for (const image of entity.images) expect(image.alt.trim().length).toBeGreaterThan(8)
      expect(entity.details.videos.length).toBeGreaterThanOrEqual(2)
      for (const video of entity.details.videos)
        expect(video.embed_url).toMatch(/^https:\/\/(www\.youtube\.com|vimeo\.com)\//)
    })

    it('keeps its dates relative to the visit', () => {
      const now = NOW.getTime()
      for (const event of entity.organizerEvents)
        expect(new Date(event.starts_at).getTime(), event.name).toBeGreaterThan(now)
      for (const deal of entity.deals ?? [])
        if (deal.endsAt) expect(new Date(deal.endsAt).getTime(), deal.title).toBeGreaterThan(now)
      for (const role of entity.hiring?.roles ?? []) {
        const closes = role.job_details?.closesAt
        expect(closes, role.name).toBeTruthy()
        if (closes) expect(new Date(closes).getTime(), role.name).toBeGreaterThan(now)
      }
      for (const review of entity.reviews) {
        expect(review.published_at, review.id).toBeTruthy()
        if (review.published_at) expect(new Date(review.published_at).getTime()).toBeLessThan(now)
      }
    })

    it('has deals the Deals editor would accept, in the order main shows them', () => {
      const deals = entity.deals ?? []
      expect(deals.length).toBeGreaterThan(0)
      expect(deals.length).toBeLessThanOrEqual(DEALS_ON_MAX)
      expect(new Set(deals.map((d) => d.id)).size).toBe(deals.length)
      for (const deal of deals) {
        const parsed = parseDeal(
          {
            title: deal.title,
            description: deal.description ?? '',
            code: deal.code ?? '',
            terms: deal.terms ?? '',
            startsAt: '',
            endsAt: deal.endsAt ?? '',
          },
          NOW
        )
        expect(parsed.ok, `${deal.id}: ${parsed.ok ? '' : parsed.error}`).toBe(true)
        if (deal.endsAt) expect(dealEndsLabel(deal.endsAt, NOW), deal.id).not.toBe('Ended')
      }
      // Soonest ending first, deals with no end last (shownDeals in lib/listings/deals.ts).
      const ends = deals.map((d) => (d.endsAt ? Date.parse(d.endsAt) : Number.POSITIVE_INFINITY))
      expect(ends).toEqual([...ends].sort((a, b) => a - b))
    })

    it('is deterministic for a given clock', () => {
      expect(buildExampleEntity(variant, NOW)).toEqual(entity)
    })

    it('has reviews with criteria, photos and owner replies, and a team without stock faces', () => {
      expect(entity.reviews.length).toBeGreaterThanOrEqual(4)
      expect(entity.reviews.some((r) => r.owner_response)).toBe(true)
      expect(entity.reviews.every((r) => r.criteria.length === entity.reviewCriteria.length)).toBe(
        true
      )
      expect(entity.reviewCriteriaAverages.map((a) => a.name)).toEqual(
        entity.reviewCriteria.map((c) => c.name)
      )
      // Headshots are initials avatars: neither stock licence carries a model
      // release, and a stranger labelled "Head barista" implies endorsement.
      for (const member of entity.team ?? []) expect(member.photo, member.name).toBeNull()
    })
  })
}

describe('photo credits ↔ files', () => {
  const files = readdirSync(ASSET_DIR)
    .filter((f) => /\.(webp|jpe?g|png)$/.test(f))
    .sort()
  const credited = EXAMPLE_PHOTO_CREDITS.map((c) => c.file).sort()

  it('every file in public/images/example has exactly one credit, and every credit a file', () => {
    expect(credited).toEqual(files)
    expect(new Set(credited).size).toBe(credited.length)
  })

  it('every stock credit names its page, its author and a licence we may use commercially', () => {
    for (const credit of EXAMPLE_PHOTO_CREDITS) {
      if (credit.license === 'First-party BLACQList artwork') {
        expect(credit.file, credit.file).toMatch(/^logo-/)
        continue
      }
      expect(credit.author?.trim(), credit.file).toBeTruthy()
      expect(credit.pageUrl, credit.file).toMatch(/^https:\/\/(unsplash\.com|www\.pexels\.com)\//)
      expect(['Unsplash License', 'Pexels License']).toContain(credit.license)
      expect(credit.downloadedOn, credit.file).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(credit.identifiablePeople, credit.file).toBe(false)
    }
  })

  it('every file the fixtures reference is in the folder', () => {
    const referenced = new Set(
      EXAMPLE_VARIANTS.flatMap((v) => imageSrcs(buildExampleEntity(v, NOW))).map((s) =>
        path.basename(s)
      )
    )
    for (const file of referenced) expect(files, file).toContain(file)
  })
})
