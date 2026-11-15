import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 186: the business's marketplace items on its own page. Pinned here:
//   * up to 6 products and 6 services, products first, linked to their pages;
//   * "Shop All" goes to the vendor page and counts every active item;
//   * the section needs the marketplace open AND a Growth+ plan, never on a
//     job or event, and a read error hides it instead of failing the page.

const h = vi.hoisted(() => {
  const calls: { table: string; filters: [string, unknown][] }[] = []
  const state = {
    flagOn: true,
    products: { data: [] as unknown[], count: 0, error: null as unknown },
    services: { data: [] as unknown[], count: 0, error: null as unknown },
  }
  function createServiceClient() {
    return {
      from(table: string) {
        const call = { table, filters: [] as [string, unknown][] }
        calls.push(call)
        const result = table === 'marketplace_products' ? state.products : state.services
        const builder = {
          select: () => builder,
          eq: (col: string, v: unknown) => {
            call.filters.push([col, v])
            return builder
          },
          order: () => builder,
          limit: async () => result,
        }
        return builder
      },
    }
  }
  return { calls, state, createServiceClient: vi.fn(createServiceClient) }
})

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: h.createServiceClient }))
vi.mock('@/lib/env', () => ({
  isFeatureEnabled: (f: string) => f === 'marketplaceOpen' && h.state.flagOn,
}))

import {
  PROFILE_SHOP_MAX,
  loadProfileShop,
  profileShopShows,
  toProfileShop,
  type ProfileProductRow,
  type ProfileServiceRow,
} from '@/lib/marketplace/profileShop'
import { productPriceLabel, servicePriceLabel } from '@/lib/marketplace/priceLabel'

const product = (i: number, over: Partial<ProfileProductRow> = {}): ProfileProductRow => ({
  id: `p${i}`,
  name: `Product ${i}`,
  global_slug: `product-${i}`,
  price_cents: 1900,
  price_display_text: null,
  cover_image_url: null,
  ...over,
})
const service = (i: number, over: Partial<ProfileServiceRow> = {}): ProfileServiceRow => ({
  id: `s${i}`,
  name: `Service ${i}`,
  global_slug: `service-${i}`,
  starting_price_cents: 4500,
  price_display_text: null,
  cover_image_url: null,
  ...over,
})

const LISTING = { id: 'l1', slug: 'blue-door-cafe', tier: 'growth', entity_type: 'business' }

describe('price labels', () => {
  it('prefers the owner’s own wording, then whole dollars', () => {
    expect(productPriceLabel({ price_display_text: 'From $12', price_cents: 1900 })).toBe(
      'From $12'
    )
    expect(productPriceLabel({ price_display_text: null, price_cents: 1900 })).toBe('$19')
    expect(productPriceLabel({ price_display_text: null, price_cents: null })).toBeNull()
    expect(servicePriceLabel({ price_display_text: null, starting_price_cents: 4500 })).toBe(
      'Starting at $45'
    )
    expect(servicePriceLabel({ price_display_text: null, starting_price_cents: null })).toBeNull()
  })
})

describe('toProfileShop', () => {
  it('shows products first, then services, each linked to its own page', () => {
    const shop = toProfileShop({
      slug: 'blue-door-cafe',
      products: [product(1)],
      services: [service(1)],
      total: 2,
    })!
    expect(shop.items.map((i) => [i.kind, i.href, i.priceLabel])).toEqual([
      ['product', '/marketplace/products/product-1', '$19'],
      ['service', '/marketplace/services/service-1', 'Starting at $45'],
    ])
    expect(shop.shopAllHref).toBe('/vendors/blue-door-cafe')
    expect(shop.total).toBe(2)
  })

  it(`caps each kind at ${PROFILE_SHOP_MAX} and keeps the full count for Shop All`, () => {
    const many = Array.from({ length: 9 }, (_, i) => i)
    const shop = toProfileShop({
      slug: 'x',
      products: many.map((i) => product(i)),
      services: many.map((i) => service(i)),
      total: 18,
    })!
    expect(shop.items.filter((i) => i.kind === 'product')).toHaveLength(PROFILE_SHOP_MAX)
    expect(shop.items.filter((i) => i.kind === 'service')).toHaveLength(PROFILE_SHOP_MAX)
    expect(shop.total).toBe(18)
  })

  it('leaves out an item with no page to link to, and is null when nothing is left', () => {
    const shop = toProfileShop({
      slug: 'x',
      products: [product(1, { global_slug: null }), product(2)],
      services: [],
      total: 2,
    })!
    expect(shop.items.map((i) => i.id)).toEqual(['p2'])
    expect(
      toProfileShop({
        slug: 'x',
        products: [product(1, { global_slug: null })],
        services: [],
        total: 1,
      })
    ).toBeNull()
    expect(toProfileShop({ slug: 'x', products: [], services: [], total: 0 })).toBeNull()
  })

  it('keeps a cover image and drops a non-web one', () => {
    const shop = toProfileShop({
      slug: 'x',
      products: [
        product(1, { cover_image_url: 'https://example.com/a.webp' }),
        product(2, { cover_image_url: 'javascript:alert(1)' }),
      ],
      services: [],
      total: 2,
    })!
    expect(shop.items[0]!.image).toMatchObject({ alt: 'Product 1' })
    expect(shop.items[0]!.image?.src).toContain('https://example.com/a.webp')
    expect(shop.items[1]!.image).toBeNull()
  })
})

describe('when the Shop shows', () => {
  beforeEach(() => {
    h.state.flagOn = true
  })

  it('needs a storefront plan (Growth+) and the marketplace open', () => {
    expect(profileShopShows({ tier: 'growth', entity_type: 'business' })).toBe(true)
    expect(profileShopShows({ tier: 'premium', entity_type: 'business' })).toBe(true)
    expect(profileShopShows({ tier: 'starter', entity_type: 'business' })).toBe(false)
    expect(profileShopShows({ tier: 'free', entity_type: 'business' })).toBe(false)
    h.state.flagOn = false
    expect(profileShopShows({ tier: 'premium', entity_type: 'business' })).toBe(false)
  })

  it('never shows on a job or event page', () => {
    expect(profileShopShows({ tier: 'premium', entity_type: 'job' })).toBe(false)
    expect(profileShopShows({ tier: 'premium', entity_type: 'event' })).toBe(false)
  })
})

describe('loadProfileShop', () => {
  beforeEach(() => {
    h.calls.length = 0
    h.createServiceClient.mockClear()
    h.state.flagOn = true
    h.state.products = { data: [product(1)], count: 8, error: null }
    h.state.services = { data: [service(1)], count: 3, error: null }
  })

  it('reads this listing’s active items and counts them all', async () => {
    const shop = await loadProfileShop(LISTING)
    expect(shop?.items).toHaveLength(2)
    expect(shop?.total).toBe(11)
    expect(h.calls.map((c) => c.table).sort()).toEqual([
      'marketplace_products',
      'marketplace_services',
    ])
    for (const c of h.calls) {
      expect(c.filters).toContainEqual(['listing_id', 'l1'])
      expect(c.filters).toContainEqual(['status', 'active'])
    }
  })

  it('does not read at all when the Shop cannot show', async () => {
    expect(await loadProfileShop({ ...LISTING, tier: 'starter' })).toBeNull()
    h.state.flagOn = false
    expect(await loadProfileShop(LISTING)).toBeNull()
    expect(h.createServiceClient).not.toHaveBeenCalled()
  })

  it('hides the section on a read error', async () => {
    h.state.services = { data: [], count: 0, error: { message: 'boom' } }
    expect(await loadProfileShop(LISTING)).toBeNull()
  })
})
