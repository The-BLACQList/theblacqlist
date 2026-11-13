// =============================================================================
// Ticket 184 — the page section registry
// =============================================================================
// lib/entity-page/sections.ts is the one list of what a listing page can show:
// the three templates render in its order, the example pages prove every
// section is filled against it, and the click-to-fill editor (ticket 188)
// will read its gates and editor links. Three things can drift and only a
// test would notice:
//
//   1. A template file reorders or drops a SectionMark without the registry
//      following (or the reverse). The order arrays below are pinned to the
//      SectionMark ids in each template's source, in order.
//   2. A gate names a plan feature or an editor anchor that does not exist.
//      Features are checked against FEATURE_MIN_TIER; edit anchors against the
//      ids PageFinishView actually renders.
//   3. applyTierGates stops hiding what a lower plan did not buy. Pinned per
//      plan on the storefront fixture, which fills everything.
//
// vitest here is `env: node` with no jsdom, so the .tsx templates are read as
// source text (the instrument tests/entity-cta.test.ts uses on the same files).
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  ENTITY_SECTIONS,
  TEMPLATE_SECTION_ORDER,
  applyTierGates,
  minTierFor,
  sectionAllowed,
  sectionDef,
  templateKeyFor,
  visibleSections,
  type SectionId,
  type TemplateKey,
} from '@/lib/entity-page/sections'
import { buildExampleEntity } from '@/lib/example/fixtures'
import { FEATURE_MIN_TIER, TIER_LIMITS, canAccess } from '@/lib/stripe/features'
import type { PlanSlug } from '@/lib/stripe/plans'
import type { EntityPageData } from '@/types'

const NOW = new Date('2026-11-13T12:00:00Z')
const PLANS: readonly PlanSlug[] = ['free', 'starter', 'growth', 'premium']
const TEMPLATES: readonly TemplateKey[] = ['storefront', 'professional', 'creative']

const TEMPLATE_FILES: Record<TemplateKey, string> = {
  storefront: 'components/entity-page/templates/StorefrontTemplate.tsx',
  professional: 'components/entity-page/templates/ProfessionalTemplate.tsx',
  creative: 'components/entity-page/templates/CreativeTemplate.tsx',
}

/** The sections ticket 184 added; a page the live loader built never fills them. */
const NEW_SECTIONS: readonly SectionId[] = [
  'logo',
  'coupons',
  'locations',
  'team',
  'shop',
  'booking',
  'hiring',
]

function source(relPath: string): string {
  return readFileSync(path.resolve(process.cwd(), relPath), 'utf8')
}

function sectionMarkIds(relPath: string): string[] {
  return [...source(relPath).matchAll(/<SectionMark id="([a-z-]+)"/g)].map((m) => m[1] ?? '')
}

/** A page shaped the way lib/listings/entityPage.ts builds it today: none of the optional fields. */
function legacyShaped(entity: EntityPageData): EntityPageData {
  const {
    logo: _logo,
    team: _team,
    coupons: _coupons,
    booking: _booking,
    locations: _locations,
    shop: _shop,
    hiring: _hiring,
    ...rest
  } = entity
  return rest
}

describe('registry shape', () => {
  it('every section id is registered once', () => {
    const ids = ENTITY_SECTIONS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(sectionDef(id).id).toBe(id)
  })

  it('every plan gate names a feature FEATURE_MIN_TIER knows', () => {
    for (const def of ENTITY_SECTIONS) {
      if (def.gate.feature) expect(FEATURE_MIN_TIER).toHaveProperty(def.gate.feature)
      if (def.gate.limit) expect(TIER_LIMITS.premium).toHaveProperty(def.gate.limit)
    }
  })

  it('minTierFor is the lowest plan canAccess admits, never a restated number', () => {
    for (const def of ENTITY_SECTIONS) {
      const feature = def.gate.feature
      const expected = feature ? PLANS.find((plan) => canAccess(plan, feature)) : 'free'
      expect(minTierFor(def.id), def.id).toBe(expected)
    }
  })

  it('every edit anchor is one PageFinishView renders', () => {
    const anchors = new Set(
      [...source('components/listings/PageFinishView.tsx').matchAll(/\bid="([a-z-]+)"/g)].map(
        (m) => m[1]
      )
    )
    for (const def of ENTITY_SECTIONS) {
      const href = def.editor.href('listing-1')
      const anchor = href?.match(/\/edit#([a-z-]+)$/)?.[1]
      if (anchor) expect(anchors.has(anchor), `${def.id} → ${href}`).toBe(true)
      if (href) expect(href.startsWith('/dashboard/'), `${def.id} → ${href}`).toBe(true)
    }
  })
})

describe('template order', () => {
  for (const template of TEMPLATES) {
    it(`${template}: the registry order is the SectionMark order in ${TEMPLATE_FILES[template]}`, () => {
      expect(sectionMarkIds(TEMPLATE_FILES[template])).toEqual([
        ...TEMPLATE_SECTION_ORDER[template],
      ])
    })

    it(`${template}: every ordered section is registered for this template, and vice versa`, () => {
      const order = TEMPLATE_SECTION_ORDER[template]
      expect(new Set(order).size).toBe(order.length)
      for (const id of order) expect(sectionDef(id).templates, id).toContain(template)
      // The logo is a SectionMark inside TemplateHero, not a top-level section.
      const registered = ENTITY_SECTIONS.filter(
        (s) => s.templates.includes(template) && s.id !== 'logo'
      ).map((s) => s.id)
      expect([...order].sort()).toEqual(registered.sort())
    })
  }

  it('the logo mark lives in the hero', () => {
    expect(sectionMarkIds('components/entity-page/templates/TemplateHero.tsx')).toEqual(['logo'])
  })

  it('templateKeyFor maps every storefront, professional and creative type; events and jobs get none', () => {
    expect(templateKeyFor('business')).toBe('storefront')
    expect(templateKeyFor('restaurant')).toBe('storefront')
    expect(templateKeyFor('vendor')).toBe('storefront')
    expect(templateKeyFor('professional')).toBe('professional')
    expect(templateKeyFor('service_provider')).toBe('professional')
    expect(templateKeyFor('creative')).toBe('creative')
    expect(templateKeyFor('creator')).toBe('creative')
    expect(templateKeyFor('event')).toBeNull()
    expect(templateKeyFor('job')).toBeNull()
  })
})

describe('applyTierGates on a page that fills everything', () => {
  const full = buildExampleEntity('storefront', NOW)

  it('premium keeps the whole page', () => {
    expect(visibleSections(applyTierGates(full, 'premium'), 'storefront')).toEqual([
      ...TEMPLATE_SECTION_ORDER.storefront,
    ])
  })

  it('growth keeps team and shop, drops coupons, booking and other locations', () => {
    const shown = visibleSections(applyTierGates(full, 'growth'), 'storefront')
    expect(shown).toContain('team')
    expect(shown).toContain('shop')
    expect(shown).not.toContain('coupons')
    expect(shown).not.toContain('booking')
    expect(shown).not.toContain('locations')
  })

  it('starter also drops team and shop, keeps faq and video', () => {
    const shown = visibleSections(applyTierGates(full, 'starter'), 'storefront')
    expect(shown).not.toContain('team')
    expect(shown).not.toContain('shop')
    expect(shown).toContain('faq')
    expect(shown).toContain('video')
  })

  it('free drops faq, video and events and caps the gallery at one photo', () => {
    const gated = applyTierGates(full, 'free')
    const shown = visibleSections(gated, 'storefront')
    expect(shown).not.toContain('faq')
    expect(shown).not.toContain('video')
    expect(shown).not.toContain('events')
    expect(gated.images).toHaveLength(TIER_LIMITS.free.photos ?? 0)
    expect(gated.faqs).toEqual([])
    expect(gated.details.videos).toEqual([])
  })

  it('an unknown or lapsed tier fails closed to free', () => {
    expect(visibleSections(applyTierGates(full, null), 'storefront')).toEqual(
      visibleSections(applyTierGates(full, 'free'), 'storefront')
    )
    expect(visibleSections(applyTierGates(full, 'gold'), 'storefront')).toEqual(
      visibleSections(applyTierGates(full, 'free'), 'storefront')
    )
  })

  it('caps rows to the plan limit instead of hiding the section', () => {
    const many = {
      ...full,
      team: Array.from({ length: 8 }, (_, i) => ({
        id: `t${i}`,
        name: `Person ${i}`,
        role: null,
        bio: null,
        photo: null,
      })),
    }
    expect(applyTierGates(many, 'growth').team).toHaveLength(TIER_LIMITS.growth.teamMembers ?? 0)
    expect(applyTierGates(many, 'premium').team).toHaveLength(8)
  })

  it('never mutates its input', () => {
    const before = JSON.stringify(full)
    applyTierGates(full, 'free')
    expect(JSON.stringify(full)).toBe(before)
  })

  it('the logo needs a claimed listing whatever the plan', () => {
    expect(sectionAllowed('logo', 'premium', undefined, { claimed: false })).toBe(false)
    expect(sectionAllowed('logo', 'free', undefined, { claimed: true })).toBe(true)
    const unclaimed = applyTierGates({ ...full, trust_tier: 'unclaimed' }, 'premium')
    expect(unclaimed.logo).toBeUndefined()
  })

  it('flags hide what the site has not opened, whatever the plan', () => {
    const flagsOff = () => false
    expect(sectionAllowed('shop', 'premium', flagsOff)).toBe(false)
    expect(sectionAllowed('hiring', 'premium', flagsOff)).toBe(false)
    expect(sectionAllowed('coupons', 'premium', flagsOff)).toBe(true)
  })
})

describe('a page the live loader built today', () => {
  for (const template of TEMPLATES) {
    it(`${template}: shows none of the new sections, so live output is unchanged`, () => {
      const legacy = legacyShaped(buildExampleEntity(template, NOW))
      const shown = visibleSections(legacy, template)
      for (const id of NEW_SECTIONS) expect(shown, id).not.toContain(id)
      // …and still shows everything it showed before ticket 184.
      const expected = TEMPLATE_SECTION_ORDER[template].filter((id) => !NEW_SECTIONS.includes(id))
      expect(shown).toEqual(expected)
    })
  }
})
