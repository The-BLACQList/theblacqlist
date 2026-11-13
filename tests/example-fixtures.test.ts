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
//     coupons unexpired and reviews in the past, on any day the page is seen;
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
import { EXAMPLE_PHOTO_CREDITS } from '@/lib/example/photoCredits'
import { EXAMPLE_ASSET_PATH } from '@/lib/listings/exampleAssets'
import { TIER_LIMITS } from '@/lib/stripe/features'
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
      for (const coupon of entity.coupons ?? [])
        if (coupon.endsAt)
          expect(new Date(coupon.endsAt).getTime(), coupon.title).toBeGreaterThan(now)
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
