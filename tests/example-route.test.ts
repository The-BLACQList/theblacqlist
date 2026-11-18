// =============================================================================
// Ticket 184 — /example sample pages; open on production since ticket 206
// =============================================================================
// Ticket 184 kept the sample pages off production. Ticket 206 links them from
// For Business, so production renders them too, as clearly labelled samples
// (the banner) that are never indexed. Three layers keep them out of search —
// the layout's robots metadata, robots.ts, and no LocalBusiness JSON-LD on
// production — and each is pinned here so none can be relaxed without a test
// noticing.
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

describe('on production (ticket 206)', () => {
  it('each sample page and the index render, so For Business never links to a 404', async () => {
    const { page, index } = await loadRoutes(true)
    for (const variant of ['storefront', 'professional', 'creative']) {
      const tree = await page.default({ params: params(variant) })
      expect(findProp(tree, 'data-example-variant'), variant).toBe(variant)
    }
    expect(index.default()).toBeTruthy()
    await expect(page.default({ params: params('nope') })).rejects.toThrow(NOT_FOUND)
  })

  it('leaves out the JSON-LD, so the live domain never describes a made-up business', async () => {
    const { page } = await loadRoutes(true)
    for (const variant of ['storefront', 'professional', 'creative']) {
      for (const layout of [undefined, 'stack']) {
        const tree = await page.default({
          params: params(variant),
          searchParams: Promise.resolve({ layout }),
        })
        expect(findProp(tree, 'dangerouslySetInnerHTML'), `${variant} ${layout}`).toBeUndefined()
      }
    }
  })

  it('titles still say it is a sample', async () => {
    const { page } = await loadRoutes(true)
    const meta = await page.generateMetadata({ params: params('storefront') })
    expect(meta.title).toBe('Sample Page: Sample & Co. (Storefront)')
    expect(String(meta.description)).toMatch(/not a real business/i)
  })
})

describe('off production', () => {
  it('an unknown variant is a 404', async () => {
    const { page } = await loadRoutes(false)
    await expect(page.default({ params: params('nope') })).rejects.toThrow(NOT_FOUND)
    await expect(page.default({ params: params('') })).rejects.toThrow(NOT_FOUND)
    await expect(page.generateMetadata({ params: params('nope') })).resolves.toEqual({
      title: 'Page Not Found',
    })
  })

  it('each variant opens on the chapters layout (ticket 204)', async () => {
    const { page } = await loadRoutes(false)
    for (const variant of ['storefront', 'professional', 'creative']) {
      const tree = await page.default({ params: params(variant) })
      expect(findProp(tree, 'data-example-variant')).toBe(variant)
      expect(findProp(tree, 'data-layout'), variant).toBe('chapters')
      expect(findProp(tree, 'mode'), variant).toBeUndefined()
    }
  })

  it('with ?layout=stack, each variant renders its banner and the template in example mode', async () => {
    const { page } = await loadRoutes(false)
    for (const variant of ['storefront', 'professional', 'creative']) {
      const tree = await page.default({
        params: params(variant),
        searchParams: Promise.resolve({ layout: 'stack' }),
      })
      expect(findProp(tree, 'data-example-variant')).toBe(variant)
      expect(findProp(tree, 'data-layout')).toBeUndefined()
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
      // A category-mapped LocalBusiness subtype (ticket 189); the cafe is a CafeOrCoffeeShop.
      expect(data['@type'], variant).toBe(
        variant === 'storefront' ? 'CafeOrCoffeeShop' : 'LocalBusiness'
      )
      expect(data.name).toBe('Sample & Co.')
      expect(data.aggregateRating).toBeTruthy()
      expect(data.address).toBeTruthy()
    }
  })

  it('titles say it is a sample', async () => {
    const { page, index } = await loadRoutes(false)
    const meta = await page.generateMetadata({ params: params('professional') })
    expect(meta.title).toBe('Sample Page: Sample & Co. (Professional)')
    expect(String(meta.description)).toMatch(/not a real business/i)
    expect(index.metadata.title).toBe('Sample Pages: Sample & Co.')
  })

  it('the route is dynamic, so the JSON-LD check reads the live environment', async () => {
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
