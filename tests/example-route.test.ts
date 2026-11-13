// =============================================================================
// Ticket 184 — /example is Preview and staging only
// =============================================================================
// The sample pages must never answer on production: the fixture carries a
// fictional business, example.com links and illustrative reviews, which
// docs/blacqlist/data/seed-data-plan.md §10 forbids on the live site. Three
// layers say so — the page's own IS_PRODUCTION check, the layout's robots
// metadata, and robots.ts — and each is pinned here so none can be relaxed
// without a test noticing.
//
// IS_PRODUCTION is a module constant, so each case re-imports the page with
// vi.doMock after vi.resetModules. The outlet and banner are stubbed: this
// test is about the route's decisions, not the templates.
// =============================================================================

import { createElement, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const NOT_FOUND = 'NEXT_NOT_FOUND (test sentinel)'

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error(NOT_FOUND)
  },
}))

vi.mock('@/components/entity-page/templates/EntityTemplateOutlet', () => ({
  EntityTemplateOutlet: (props: { mode?: string; entity: { id: string } }) =>
    createElement(
      'div',
      { 'data-testid': 'outlet', 'data-mode': props.mode ?? 'live' },
      props.entity.id
    ),
}))

vi.mock('@/components/example/ExampleBanner', () => ({
  ExampleBanner: (props: { variant: string }) =>
    createElement('aside', { 'data-testid': 'banner' }, props.variant),
}))

async function loadRoutes(isProduction: boolean) {
  vi.resetModules()
  vi.doMock('@/lib/env', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/env')>()),
    IS_PRODUCTION: isProduction,
  }))
  const [page, index] = await Promise.all([
    import('@/app/example/[variant]/page'),
    import('@/app/example/page'),
  ])
  return { page, index }
}

const params = (variant: string) => Promise.resolve({ variant })

/** Walks a server-rendered element tree looking for a prop value. */
function findProp(node: unknown, key: string): unknown {
  if (!node || typeof node !== 'object') return undefined
  const el = node as ReactElement<Record<string, unknown>>
  if (el.props && key in el.props) return el.props[key]
  const children = el.props?.children
  const list = Array.isArray(children) ? children : [children]
  for (const child of list) {
    const found = findProp(child, key)
    if (found !== undefined) return found
  }
  return undefined
}

afterEach(() => {
  vi.doUnmock('@/lib/env')
})

describe('on production', () => {
  it('every sample route is a 404, whatever the variant', async () => {
    const { page, index } = await loadRoutes(true)
    await expect(page.default({ params: params('storefront') })).rejects.toThrow(NOT_FOUND)
    await expect(page.default({ params: params('nope') })).rejects.toThrow(NOT_FOUND)
    expect(() => index.default()).toThrow(NOT_FOUND)
  })

  it('metadata is the not-found title, so nothing names the sample in a <title>', async () => {
    const { page } = await loadRoutes(true)
    await expect(page.generateMetadata({ params: params('storefront') })).resolves.toEqual({
      title: 'Page not found',
    })
  })
})

describe('off production', () => {
  it('an unknown variant is a 404', async () => {
    const { page } = await loadRoutes(false)
    await expect(page.default({ params: params('nope') })).rejects.toThrow(NOT_FOUND)
    await expect(page.default({ params: params('') })).rejects.toThrow(NOT_FOUND)
    await expect(page.generateMetadata({ params: params('nope') })).resolves.toEqual({
      title: 'Page not found',
    })
  })

  it('each variant renders its banner and the template in example mode', async () => {
    const { page } = await loadRoutes(false)
    for (const variant of ['storefront', 'professional', 'creative']) {
      const tree = await page.default({ params: params(variant) })
      expect(findProp(tree, 'data-example-variant')).toBe(variant)
      const outlet = findProp(tree, 'mode')
      expect(outlet, variant).toBe('example')
      expect(findProp(tree, 'userId')).toBeNull()
      expect(findProp(tree, 'isOwner')).toBe(false)
      expect(findProp(tree, 'initialSaved')).toBe(false)
    }
  })

  it('carries the LocalBusiness JSON-LD a live listing emits', async () => {
    const { page } = await loadRoutes(false)
    for (const variant of ['storefront', 'professional', 'creative']) {
      const tree = await page.default({ params: params(variant) })
      const html = findProp(tree, 'dangerouslySetInnerHTML') as { __html: string } | undefined
      expect(html?.__html, variant).toBeTruthy()
      const data = JSON.parse(html!.__html) as Record<string, unknown>
      expect(data['@context']).toBe('https://schema.org')
      expect(data['@type']).toBe('LocalBusiness')
      expect(data.name).toBe('Test Business 123')
      expect(data.aggregateRating).toBeTruthy()
      expect(data.address).toBeTruthy()
    }
  })

  it('titles say it is a sample', async () => {
    const { page, index } = await loadRoutes(false)
    const meta = await page.generateMetadata({ params: params('professional') })
    expect(meta.title).toBe('Sample page: Test Business 123 (Professional)')
    expect(String(meta.description)).toMatch(/not a real business/i)
    expect(index.metadata.title).toBe('Sample pages: Test Business 123')
  })

  it('the route is dynamic, so the production check reads the live environment', async () => {
    const { page, index } = await loadRoutes(false)
    expect(page.dynamic).toBe('force-dynamic')
    expect(index.dynamic).toBe('force-dynamic')
  })
})

describe('indexing', () => {
  it('the layout tells crawlers not to index or follow', async () => {
    const layout = await import('@/app/example/layout')
    const robots = layout.metadata.robots
    expect(robots).toBeTypeOf('object')
    if (!robots || typeof robots !== 'object') throw new Error('robots metadata missing')
    expect(robots.index).toBe(false)
    expect(robots.follow).toBe(false)
    expect(robots.googleBot).toMatchObject({ index: false, follow: false })
  })

  it('robots.txt disallows the prefix', async () => {
    const { default: robots } = await import('@/app/robots')
    const result = robots()
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules]
    const disallowed = rules.flatMap((rule) =>
      Array.isArray(rule.disallow) ? rule.disallow : rule.disallow ? [rule.disallow] : []
    )
    expect(disallowed).toContain('/example/')
  })
})
