// =============================================================================
// PR 5 · bug 1 — the dead hero CTA
// =============================================================================
// From the founder's walkthrough: every listing page that is not professional,
// service_provider or creative rendered its primary button as
// `href={entity.details.cta_url ?? '#'}`. Unclaimed listings — which is most
// events and jobs, the two types that never got a cta_url — therefore shipped a
// gold "Get Tickets" / "Apply Now" button that navigates nowhere.
//
// The correct helper already existed (`templates/cta.ts`, returning null rather
// than a dead href) but only the two Living Commerce Index templates called it.
// The fix routes every hero and EntityQuickActionBar through the same helper
// and renders NOTHING when it returns null. A missing button is honest; a
// button that does nothing is not.
//
// PR 6 then deleted EntityPageHero outright — all five listing types now render
// through TemplateHero — so the call sites below are the two that remain.
//
// The helper's last fallback is the '#visit' anchor, which is the part that can
// silently regress: it is only a real destination on pages that actually render
// an At a Glance block. Events and jobs render EntityEventDetails /
// EntityJobDetails instead and have no such block, so returning '#visit' for
// them would swap one dead href for another. That guard is the reason this file
// tests entity_type at all.
//
// vitest here is `env: node` with no jsdom (vitest.config.ts), so the pure
// helper is exercised directly and the two .tsx call sites are pinned by source
// text — the same instrument tests/save-controls.test.ts uses on these files.
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { getCtaHref } from '@/components/entity-page/templates/cta'
import type { CTAType, EntityPageData, EntityType } from '@/types'

function source(relPath: string): string {
  return readFileSync(path.resolve(process.cwd(), relPath), 'utf8')
}

interface Overrides {
  entity_type?: EntityType
  cta_type?: CTAType
  cta_url?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  hours?: Record<string, unknown> | null
}

/** Only the six fields getCtaHref reads; the rest of EntityPageData is irrelevant here. */
function entity(overrides: Overrides = {}): EntityPageData {
  const { entity_type = 'business', ...details } = overrides
  return {
    entity_type,
    details: {
      cta_type: 'learn-more',
      cta_url: null,
      phone: null,
      email: null,
      address: null,
      hours: null,
      ...details,
    },
  } as unknown as EntityPageData
}

describe('getCtaHref — resolution ladder', () => {
  it('prefers tel: when the business chose the "call" CTA and has a phone', () => {
    // Ahead of cta_url deliberately: "Call Now" that opens a website is a lie
    // about what the button does.
    const href = getCtaHref(
      entity({ cta_type: 'call', phone: '(313) 555-0142', cta_url: 'https://example.com' })
    )
    expect(href).toBe('tel:3135550142')
  })

  it('strips punctuation from the phone number', () => {
    expect(getCtaHref(entity({ cta_type: 'call', phone: '+1 (313) 555-0142' }))).toBe(
      'tel:13135550142'
    )
  })

  it('falls through to cta_url when "call" is chosen but no phone exists', () => {
    expect(getCtaHref(entity({ cta_type: 'call', cta_url: 'https://example.com/book' }))).toBe(
      'https://example.com/book'
    )
  })

  it('uses the owner-configured cta_url for every other CTA type', () => {
    expect(getCtaHref(entity({ cta_type: 'shop', cta_url: 'https://shop.example.com' }))).toBe(
      'https://shop.example.com'
    )
  })

  it('falls back to tel: then mailto: for a listing with no configured CTA', () => {
    expect(getCtaHref(entity({ phone: '313-555-0142', email: 'hi@example.com' }))).toBe(
      'tel:3135550142'
    )
    expect(getCtaHref(entity({ email: 'hi@example.com' }))).toBe('mailto:hi@example.com')
  })

  it('falls back to the #visit anchor when only an address or hours exist', () => {
    expect(getCtaHref(entity({ address: '1234 Woodward Ave' }))).toBe('#visit')
    expect(getCtaHref(entity({ hours: { mon: { open: '09:00', close: '17:00' } } }))).toBe('#visit')
  })

  it('returns null — not "#" — when there is no reachable destination', () => {
    // THE bug. Callers render no button at all on null.
    expect(getCtaHref(entity())).toBeNull()
  })
})

describe('getCtaHref — the #visit anchor is guarded by entity_type', () => {
  // Events and jobs render EntityEventDetails / EntityJobDetails and never
  // render EntityAtAGlance, so there is no id="visit" on those pages. Returning
  // it would replace a dead href="#" with a dead href="#visit".
  it.each(['event', 'job'] as const)('never returns #visit for a %s', (entity_type) => {
    expect(getCtaHref(entity({ entity_type, address: '1234 Woodward Ave' }))).toBeNull()
    expect(getCtaHref(entity({ entity_type, hours: { mon: {} } }))).toBeNull()
  })

  it('still resolves tel:/mailto:/cta_url for events and jobs', () => {
    // The guard narrows only the anchor step — a job with an application URL or
    // an event with a phone still gets its button.
    expect(getCtaHref(entity({ entity_type: 'job', cta_url: 'https://apply.example.com' }))).toBe(
      'https://apply.example.com'
    )
    expect(getCtaHref(entity({ entity_type: 'event', phone: '313-555-0142' }))).toBe(
      'tel:3135550142'
    )
  })

  it.each(['business', 'restaurant', 'professional', 'service_provider', 'creative', 'vendor'] as const)(
    'returns #visit for a %s, which does render At a Glance',
    (entity_type) => {
      expect(getCtaHref(entity({ entity_type, address: '1234 Woodward Ave' }))).toBe('#visit')
    }
  )
})

describe('the #visit anchor exists wherever the helper can return it', () => {
  // A returned '#visit' is only honest if something on the page carries that id.
  // Since PR 6 the listing page renders no sections of its own — every type
  // goes through a template — so the storefront template is where the default
  // listing's anchor now lives.
  it('the storefront template wraps At a Glance in id="visit"', () => {
    const src = source('components/entity-page/templates/StorefrontTemplate.tsx')
    expect(src).toMatch(/id="visit"[\s\S]{0,120}<EntityAtAGlance/)
  })

  it.each([
    'components/entity-page/templates/ProfessionalTemplate.tsx',
    'components/entity-page/templates/CreativeTemplate.tsx',
  ])('%s carries the same anchor', (file) => {
    expect(source(file)).toContain('id="visit"')
  })

  it('the templates gate that anchor on a superset of the helper\'s condition', () => {
    // hasVisit = address || hours || phone || email. The helper only reaches its
    // '#visit' step after phone and email have already been ruled out, so its
    // condition (address || hours) is strictly narrower — the anchor is always
    // present when the helper returns it, and no option plumbing is needed.
    for (const file of [
      'components/entity-page/templates/ProfessionalTemplate.tsx',
      'components/entity-page/templates/CreativeTemplate.tsx',
    ]) {
      const src = source(file)
      expect(src).toMatch(/const hasVisit = Boolean\(/)
      const clause = src.slice(src.indexOf('const hasVisit'), src.indexOf('const hasVisit') + 200)
      expect(clause).toContain('address')
      expect(clause).toContain('hours')
    }
  })

  it('EntityAtAGlance does not carry the id itself', () => {
    // Both templates already wrap it in their own <div id="visit">, so an id
    // inside the component would be duplicated on every template page.
    expect(source('components/entity-page/EntityAtAGlance.tsx')).not.toContain('id="visit"')
  })
})

describe('no call site renders a CTA without a destination', () => {
  const CALL_SITES = [
    'components/entity-page/EntityQuickActionBar.tsx',
    'components/entity-page/templates/TemplateHero.tsx',
  ] as const

  it.each(CALL_SITES)('%s derives its href from the shared helper', (file) => {
    const src = source(file)
    expect(src).toContain("from '@/components/entity-page/templates/cta'")
    expect(src).toContain('getCtaHref(entity)')
  })

  it.each(CALL_SITES)('%s no longer falls back to a dead href', (file) => {
    // The exact shape of the original bug.
    expect(source(file)).not.toMatch(/cta_url\s*\?\?\s*'#'/)
  })

  it.each(CALL_SITES)('%s renders the anchor only when ctaHref is non-null', (file) => {
    const src = source(file)
    const guards = src.match(/\{ctaHref && \(/g) ?? []
    expect(guards.length, `${file} should guard every CTA anchor`).toBeGreaterThan(0)

    // Every href={ctaHref} must sit inside such a guard. The quick action bar
    // has two — a mobile bar and a desktop bar — and only one was wrapped in an
    // earlier draft.
    const uses = src.match(/href=\{ctaHref\}/g) ?? []
    expect(uses.length).toBe(guards.length)
  })

  it('keeps id="hero-cta" on the hero anchor', () => {
    // e2e/contrast.spec.ts:66 and e2e/keyboard-a11y.spec.ts:43 locate it, and
    // EntityQuickActionBar observes it to decide when to slide in. Since PR 6
    // TemplateHero is the only hero in the codebase, and it must carry the id
    // exactly once — a duplicate id would make both e2e locators strict-mode
    // ambiguous.
    // Matched as a standalone JSX attribute line so the two prose mentions of
    // the id in this file's own comments do not count toward the total.
    const hero = source('components/entity-page/templates/TemplateHero.tsx')
    expect(hero.match(/^\s*id="hero-cta"$/gm) ?? []).toHaveLength(1)
  })

  it('the quick action bar no-ops when the hero CTA is absent', () => {
    // Its IntersectionObserver target does not exist on a listing with no
    // destination, so the bar must return early rather than throw.
    const src = source('components/entity-page/EntityQuickActionBar.tsx')
    expect(src).toMatch(/const heroCta = document\.getElementById\('hero-cta'\)\s*\n\s*if \(!heroCta\) return/)
  })
})
