// =============================================================================
// "Order on" platforms and "Find us at" stores (owner-experience round 2,
// part D, 2026-11-13).
// =============================================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import {
  ORDER_PLATFORMS,
  ORDER_PLATFORM_IDS,
  ORDER_URL_MAX,
  STOCKIST_AREAS_MAX,
  ZIP_RE,
  isZip,
  parseAreas,
  parseCity,
  parseOrderUrl,
  parseServiceArea,
  parseStockist,
  parseZip,
  stockistAreaLabel,
  toOrderLinks,
  toRetailChains,
  toStockists,
  type RetailChain,
} from '@/lib/listings/whereSold'
import { rpcArgs } from '@/lib/listings/facets'
import { searchSchema } from '@/lib/validations/search'
import { hasFacetFilters, parseDiscoverParams } from '@/lib/listings/discover-params'
import { tabForAnchor, visibleTabs } from '@/lib/listings/editTabs'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const CHAINS: RetailChain[] = [
  { slug: 'whole-foods', name: 'Whole Foods Market' },
  { slug: 'kroger', name: 'Kroger' },
]

describe('parseOrderUrl: each platform takes only its own domain', () => {
  it('accepts a store link on the platform, and on a subdomain', () => {
    expect(parseOrderUrl('doordash', 'https://www.doordash.com/store/niecys-123/')).toEqual({
      ok: true,
      value: 'https://www.doordash.com/store/niecys-123/',
    })
    expect(parseOrderUrl('grubhub', 'https://www.grubhub.com/restaurant/x/1')).toMatchObject({
      ok: true,
    })
    expect(parseOrderUrl('instacart', 'https://www.instacart.com/store/x')).toMatchObject({
      ok: true,
    })
    expect(parseOrderUrl('ubereats', 'https://www.ubereats.com/store/x/abc')).toMatchObject({
      ok: true,
    })
  })

  it('accepts DoorDash storefront links on order.online', () => {
    expect(ORDER_PLATFORMS.doordash.hosts).toContain('order.online')
    expect(parseOrderUrl('doordash', 'https://order.online/store/x-123')).toMatchObject({
      ok: true,
    })
  })

  it('adds https to a bare link and upgrades http', () => {
    expect(parseOrderUrl('doordash', 'doordash.com/store/x')).toEqual({
      ok: true,
      value: 'https://doordash.com/store/x',
    })
    expect(parseOrderUrl('grubhub', 'http://www.grubhub.com/r/1')).toEqual({
      ok: true,
      value: 'https://www.grubhub.com/r/1',
    })
  })

  it('refuses another platform’s link', () => {
    expect(parseOrderUrl('doordash', 'https://www.ubereats.com/store/x')).toMatchObject({
      ok: false,
    })
    expect(parseOrderUrl('instacart', 'https://order.online/store/x')).toMatchObject({ ok: false })
  })

  it('refuses look-alike hosts', () => {
    for (const url of [
      'https://doordash.com.evil.example/store',
      'https://evildoordash.com/store',
      'https://evil.example/doordash.com',
      'https://evil.example/?u=https://doordash.com',
    ]) {
      expect(parseOrderUrl('doordash', url), url).toMatchObject({ ok: false })
    }
  })

  it('refuses logins, ports, other schemes, spaces and blanks', () => {
    for (const url of [
      'https://user:pw@doordash.com/store',
      'https://doordash.com:8443/store',
      'javascript:alert(1)',
      'ftp://doordash.com/x',
      'https://doordash.com/a b',
      '',
      '   ',
      null,
    ]) {
      expect(parseOrderUrl('doordash', url), String(url)).toMatchObject({ ok: false })
    }
  })

  it('refuses a link over the limit', () => {
    const long = `https://doordash.com/${'a'.repeat(ORDER_URL_MAX)}`
    expect(parseOrderUrl('doordash', long)).toMatchObject({ ok: false })
  })

  it('names the domain to use in the error', () => {
    const r = parseOrderUrl('instacart', 'https://example.com')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('instacart.com')
  })
})

describe('zips and cities', () => {
  it('a zip is 5 digits, the same as the database', () => {
    expect(ZIP_RE.source).toBe('^\\d{5}$')
    expect(isZip('30318')).toBe(true)
    for (const z of ['3031', '303180', '30318-1234', 'abcde', ' 30318', 30318]) {
      expect(isZip(z), String(z)).toBe(false)
    }
  })

  it('parseZip keeps the first five of a ZIP+4 and trims', () => {
    expect(parseZip(' 30318 ')).toBe('30318')
    expect(parseZip('30318-1234')).toBe('30318')
    expect(parseZip('3031')).toBeNull()
    expect(parseZip('Atlanta, GA')).toBeNull()
  })

  it('parseCity writes "City, ST"', () => {
    expect(parseCity('atlanta, ga')).toBe('Atlanta, GA')
    expect(parseCity('  east  point ,GA ')).toBe('East Point, GA')
    expect(parseCity('winston-salem, nc')).toBe('Winston-Salem, NC')
    expect(parseCity('McDonough, GA')).toBe('McDonough, GA')
  })

  it('parseCity needs a real state and no extra commas', () => {
    expect(parseCity('Atlanta')).toBeNull()
    expect(parseCity('Atlanta, Georgia')).toBeNull()
    expect(parseCity('Atlanta, ZZ')).toBeNull()
    expect(parseCity('Atlanta, GA, USA')).toBeNull()
    expect(parseCity('30318, GA')).toBeNull()
  })

  it('parseAreas sorts zips from cities and drops duplicates', () => {
    expect(parseAreas(['30318', 'atlanta, ga', 'Atlanta, GA', '30318-0001', ''])).toEqual({
      ok: true,
      value: { cities: ['Atlanta, GA'], zips: ['30318'] },
    })
  })

  it('parseAreas names an entry it cannot read', () => {
    const r = parseAreas(['30318', 'Midtown'])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Midtown')
  })

  it(`parseAreas caps one store at ${STOCKIST_AREAS_MAX}`, () => {
    const zips = Array.from({ length: STOCKIST_AREAS_MAX + 1 }, (_, i) =>
      String(30000 + i).padStart(5, '0')
    )
    expect(parseAreas(zips)).toMatchObject({ ok: false })
    expect(parseAreas(zips.slice(0, STOCKIST_AREAS_MAX))).toMatchObject({ ok: true })
  })
})

describe('parseStockist', () => {
  it('a chain slug or its typed name becomes the chain', () => {
    for (const store of ['whole-foods', 'whole foods market']) {
      expect(parseStockist({ store, nationwide: false, areas: ['30318'] }, CHAINS), store).toEqual({
        ok: true,
        value: {
          chain_slug: 'whole-foods',
          store_name: null,
          nationwide: false,
          areas: { cities: [], zips: ['30318'] },
        },
      })
    }
  })

  it('any other name is the owner’s own store', () => {
    expect(
      parseStockist(
        { store: ' Sweet  Auburn Market ', nationwide: false, areas: ['Atlanta, GA'] },
        CHAINS
      )
    ).toMatchObject({
      ok: true,
      value: { chain_slug: null, store_name: 'Sweet Auburn Market' },
    })
  })

  it('needs a place or nationwide, and nationwide drops the places', () => {
    expect(parseStockist({ store: 'kroger', nationwide: false, areas: [] }, CHAINS)).toMatchObject({
      ok: false,
    })
    expect(
      parseStockist({ store: 'kroger', nationwide: true, areas: ['30318'] }, CHAINS)
    ).toMatchObject({ ok: true, value: { nationwide: true, areas: { cities: [], zips: [] } } })
  })

  it('refuses blanks, links and long names', () => {
    const p = (store: unknown) => parseStockist({ store, nationwide: true, areas: [] }, CHAINS)
    expect(p('')).toMatchObject({ ok: false })
    expect(p(null)).toMatchObject({ ok: false })
    expect(p('www.example.com')).toMatchObject({ ok: false })
    expect(p('x'.repeat(81))).toMatchObject({ ok: false })
  })
})

describe('parseServiceArea', () => {
  it('is one line, optional, with no links', () => {
    expect(parseServiceArea('  Metro\nAtlanta ')).toEqual({ ok: true, value: 'Metro Atlanta' })
    expect(parseServiceArea('')).toEqual({ ok: true, value: null })
    expect(parseServiceArea('see https://x.example')).toMatchObject({ ok: false })
    expect(parseServiceArea('a'.repeat(201))).toMatchObject({ ok: false })
  })
})

describe('row mappers', () => {
  it('toOrderLinks keeps platform order and re-checks each link', () => {
    expect(
      toOrderLinks([
        { platform: 'ubereats', url: 'https://www.ubereats.com/store/x' },
        { platform: 'doordash', url: 'https://www.doordash.com/store/x' },
        { platform: 'grubhub', url: 'https://evil.example/' },
        { platform: 'postmates', url: 'https://postmates.com/x' },
        null,
      ])
    ).toEqual([
      { platform: 'doordash', label: 'DoorDash', url: 'https://www.doordash.com/store/x' },
      { platform: 'ubereats', label: 'Uber Eats', url: 'https://www.ubereats.com/store/x' },
    ])
    expect(toOrderLinks(null)).toEqual([])
  })

  it('toStockists names chains, sorts by position and sorts the places', () => {
    const out = toStockists([
      {
        id: 'b',
        chain_slug: null,
        store_name: 'Sweet Auburn Market',
        nationwide: false,
        position: 2,
        created_at: '2026-11-13T00:00:00Z',
        retail_chains: null,
        listing_stockist_areas: [
          { kind: 'zip', value: '30318' },
          { kind: 'city', value: 'Decatur, GA' },
          { kind: 'city', value: 'Atlanta, GA' },
        ],
      },
      {
        id: 'a',
        chain_slug: 'whole-foods',
        store_name: null,
        nationwide: true,
        position: 1,
        created_at: '2026-11-13T00:00:00Z',
        retail_chains: [{ name: 'Whole Foods Market' }],
        listing_stockist_areas: [],
      },
      // A chain whose name didn't come back is left out, not shown as a slug.
      { id: 'c', chain_slug: 'kroger', store_name: null, position: 0, retail_chains: null },
    ])
    expect(out.map((s) => s.id)).toEqual(['a', 'b'])
    expect(out[0]).toMatchObject({ name: 'Whole Foods Market', nationwide: true })
    expect(out[1]).toMatchObject({
      name: 'Sweet Auburn Market',
      cities: ['Atlanta, GA', 'Decatur, GA'],
      zips: ['30318'],
    })
    expect(stockistAreaLabel(out[0]!)).toBe('Nationwide')
    expect(stockistAreaLabel(out[1]!)).toBe('Atlanta, GA · Decatur, GA · 30318')
  })

  it('toRetailChains sorts by name and drops malformed rows', () => {
    expect(
      toRetailChains([{ slug: 'kroger', name: 'Kroger' }, { slug: 1 }, ...CHAINS.slice(0, 1)])
    ).toEqual([
      { slug: 'kroger', name: 'Kroger' },
      { slug: 'whole-foods', name: 'Whole Foods Market' },
    ])
  })
})

describe('Discover params', () => {
  it('searchSchema takes known apps and a zip, and refuses the rest', () => {
    const ok = searchSchema.safeParse({ order_on: 'doordash,instacart', sold_near: '30318-1234' })
    expect(ok.success).toBe(true)
    if (ok.success) {
      expect(ok.data.order_on).toEqual(['doordash', 'instacart'])
      expect(ok.data.sold_near).toBe('30318')
    }
    expect(searchSchema.safeParse({ order_on: 'postmates' }).success).toBe(false)
    expect(searchSchema.safeParse({ sold_near: 'Atlanta' }).success).toBe(false)
    expect(searchSchema.safeParse({ sold_near: '3031' }).success).toBe(false)
  })

  it('parseDiscoverParams reads both, and a bad zip is ignored', () => {
    const p = parseDiscoverParams({ order_on: 'doordash,grubhub', sold_near: '30318' })
    expect(p.order_on).toEqual(['doordash', 'grubhub'])
    expect(p.sold_near).toBe('30318')
    expect(parseDiscoverParams({ sold_near: 'abc' }).sold_near).toBeUndefined()
  })

  it('either one counts as a filter for the empty state', () => {
    expect(hasFacetFilters({ order_on: 'doordash' })).toBe(true)
    expect(hasFacetFilters({ sold_near: '30318' })).toBe(true)
    expect(hasFacetFilters({})).toBe(false)
  })

  it('rpcArgs leaves both out unless set', () => {
    const none = rpcArgs({ p_q: null, p_platforms: null, p_stockist_zip: null })
    expect(none).not.toHaveProperty('p_platforms')
    expect(none).not.toHaveProperty('p_stockist_zip')
    expect(
      rpcArgs({ p_q: null, p_platforms: ['doordash'], p_stockist_zip: '30318' })
    ).toMatchObject({ p_platforms: ['doordash'], p_stockist_zip: '30318' })
  })
})

describe('migration 20261118000000_order_where_sold', () => {
  const sql = read('supabase/migrations/20261118000000_order_where_sold.sql')

  it('keeps the platforms and limits the app checks', () => {
    expect(sql).toContain(
      `CHECK (platform IN (${ORDER_PLATFORM_IDS.map((p) => `'${p}'`).join(', ')}))`
    )
    expect(sql).toContain(`char_length(url) <= ${ORDER_URL_MAX}`)
    expect(sql).toContain("url ~ '^https://")
    expect(sql).toContain('CHECK ((chain_slug IS NULL) <> (store_name IS NULL))')
    expect(sql).toContain("kind = 'zip' AND value ~ '^[0-9]{5}$'")
    expect(sql).toContain("value ~ '^[^,]+, [A-Z]{2}$'")
    expect(sql).toContain('listing_stockists_listing_chain_key')
    expect(sql).toContain('listing_stockist_areas_kind_value_idx')
  })

  it('seeds the 20 chains', () => {
    const seed = sql.slice(
      sql.indexOf('INSERT INTO public.retail_chains'),
      sql.indexOf('ON CONFLICT', sql.indexOf('INSERT INTO public.retail_chains'))
    )
    expect(seed.match(/\('[a-z0-9-]+', '(?:[^']|'')+'\)/g)).toHaveLength(20)
    for (const slug of ['whole-foods', 'kroger', 'publix', 'heb', 'hy-vee']) {
      expect(seed).toContain(`('${slug}',`)
    }
  })

  it('turns on RLS with public read on published pages and owner writes', () => {
    for (const t of ['listing_order_platforms', 'listing_stockists', 'listing_stockist_areas']) {
      expect(sql).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`)
      for (const p of [
        'anon read',
        'authenticated read',
        'owner insert',
        'owner update',
        'owner delete',
      ]) {
        expect(sql, `${t}: ${p}`).toContain(`CREATE POLICY "${t}: ${p}"`)
      }
    }
    expect(sql).toContain('ALTER TABLE public.retail_chains ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('CREATE POLICY "retail_chains: public read"')
    expect(sql).not.toMatch(/CREATE POLICY "retail_chains: [^"]*(insert|update|delete)"/)
    const anon = sql.slice(
      sql.indexOf('CREATE POLICY "listing_stockists: anon read"'),
      sql.indexOf('CREATE POLICY "listing_stockists: authenticated read"')
    )
    expect(anon).toContain("status = 'published'")
    expect(anon).toContain('deleted_at IS NULL')
  })

  it('adds p_platforms and p_stockist_zip last to both search functions', () => {
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS search_listings_faceted\(/)
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS facet_counts\(/)
    expect(sql.match(/^\s+p_platforms\s+text\[\]\s+DEFAULT NULL,$/gm)).toHaveLength(2)
    expect(sql.match(/^\s+p_stockist_zip\s+text\s+DEFAULT NULL$/gm)).toHaveLength(2)
    expect(sql.match(/lop\.platform = ANY \(p_platforms\)/g)).toHaveLength(2)
    expect(sql.match(/lsa\.value = p_stockist_zip/g)).toHaveLength(2)
    expect(sql.match(/ls\.nationwide/g)?.length).toBeGreaterThanOrEqual(2)
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION search_listings_faceted\([\s\S]*?boolean, text\[\], text\s*\) TO anon, authenticated/
    )
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION facet_counts\([\s\S]*?boolean, text\[\], text\s*\) TO anon, authenticated/
    )
    expect(sql.trimEnd().endsWith("NOTIFY pgrst, 'reload schema';")).toBe(true)
  })

  it('has a down plan', () => {
    expect(sql).toMatch(
      /Down[\s\S]*DROP TABLE IF EXISTS public\.listing_stockist_areas, public\.listing_stockists,/
    )
  })
})

describe('wiring', () => {
  it('never retries a search without the new filters', () => {
    expect(read('lib/listings/facets.ts')).toMatch(
      /'p_platforms' in args \|\|\s*'p_stockist_zip' in args\s*\)\s*return first/
    )
  })

  it('the Discover filters are behind the flag', () => {
    const facets = read('lib/listings/facets.ts')
    expect(facets).toContain("const whereSoldOn = isFeatureEnabled('orderWhereSold')")
    expect(facets).toContain('p_platforms: platforms.length > 0 && whereSoldOn ? platforms : null')
    expect(facets).toContain('p_stockist_zip: soldNear && whereSoldOn ? soldNear : null')
    const keys = read('components/discovery/useFacetParams.ts')
    expect(keys).toContain("'order_on'")
    expect(keys).toContain("'sold_near'")
    for (const page of [
      'app/(public)/discover/(index)/page.tsx',
      'app/(public)/discover/[citySlug]/page.tsx',
    ]) {
      expect(
        read(page).match(/showOrderWhereSold=\{isFeatureEnabled\('orderWhereSold'\)\}/g)
      ).toHaveLength(2)
    }
  })

  it('the new filters skip sponsored slots and the legacy fallback', () => {
    for (const f of ['lib/listings/query.ts', 'lib/services/search.ts']) {
      const src = read(f)
      expect(src, f).toContain('resolved.p_platforms ||')
      expect(src, f).toContain('resolved.p_stockist_zip ||')
    }
  })

  it('the page read is flagged, and skips jobs and events', () => {
    const src = read('lib/listings/entityPage.ts')
    expect(src).toContain(
      "return isFeatureEnabled('orderWhereSold') && entityType !== 'job' && entityType !== 'event'"
    )
    expect(src).toContain('toOrderLinks(orderLinkData)')
    expect(src).toContain('toStockists(stockistData)')
    expect(src).toContain('service_area_description')
  })

  it('every business template shows both sections', () => {
    for (const t of ['Storefront', 'Professional', 'Creative']) {
      const src = read(`components/entity-page/templates/${t}Template.tsx`)
      expect(src).toContain('<EntityOrderOn')
      expect(src).toContain('<EntityFindUsAt')
      expect(src).toContain("{ id: 'find-us', label: 'Find us at' }")
    }
  })

  it('order buttons are text links that open safely, with no logos', () => {
    const src = read('components/entity-page/EntityOrderOn.tsx')
    expect(src).toContain('rel="noopener noreferrer nofollow"')
    expect(src).not.toMatch(/<img|<Image/)
  })

  it('the editors sit on the Services and Where tabs, behind the flag', () => {
    expect(tabForAnchor('order-on')).toBe('services')
    expect(tabForAnchor('location')).toBe('where')
    expect(tabForAnchor('where-sold')).toBe('where')
    expect(read('app/dashboard/pages/[entityId]/edit/page.tsx')).toContain(
      "isFeatureEnabled('orderWhereSold')"
    )
  })

  it('a tab with nothing to show is hidden, but Basics never is', () => {
    const shown = visibleTabs((id) => id !== 'location' && id !== 'where-sold')
    expect(shown.map((t) => t.id)).not.toContain('where')
    expect(visibleTabs(() => false).map((t) => t.id)).toEqual(['basics'])
  })

  it('every save checks the flag and ownership', () => {
    const src = read('lib/actions/dashboard/whereSold.ts')
    expect(src).toContain("isFeatureEnabled('orderWhereSold')")
    expect(src.match(/await ownedListing\(/g)?.length).toBeGreaterThanOrEqual(5)
  })
})
