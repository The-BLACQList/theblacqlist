// =============================================================================
// Ticket 241: advanced analytics on Growth and Premium
// =============================================================================
// Founder 2026-11-21: "build what we can track now". These pin the gate, the
// period-compare maths, the Storefront and Events and Jobs summaries, the
// Starter locked card, and the two tracking fixes that make the numbers real:
// storefront clicks are actually inserted, and product and service pages send
// a view.
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

import {
  advancedPreviewLines,
  canCompare,
  changeLabel,
  changeText,
  clickRate,
  periodChange,
  summarizeInsights,
  TOP_ITEMS,
  type InsightRow,
} from '@/lib/analytics/advanced'
import { canAccess } from '@/lib/stripe/features'

const root = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(root, p), 'utf8')

describe('the analytics_advanced gate', () => {
  it('is Growth and up', () => {
    expect(canAccess('free', 'analytics_advanced')).toBe(false)
    expect(canAccess('starter', 'analytics_advanced')).toBe(false)
    expect(canAccess('growth', 'analytics_advanced')).toBe(true)
    expect(canAccess('premium', 'analytics_advanced')).toBe(true)
  })

  it('is what the analytics page checks', () => {
    const page = read('app/dashboard/pages/[entityId]/analytics/page.tsx')
    expect(page).toContain("canAccess(listing.tier, 'analytics_advanced')")
    expect(page).toContain('Advanced Analytics Comes with Growth')
  })
})

describe('canCompare', () => {
  it('compares only when the plan holds the period before too', () => {
    expect(canCompare(7, 'growth')).toBe(true)
    expect(canCompare(30, 'growth')).toBe(true)
    expect(canCompare(90, 'growth')).toBe(true)
    // 12 months would need 24 months of history.
    expect(canCompare(365, 'growth')).toBe(false)
    expect(canCompare(365, 'premium')).toBe(false)
  })

  it('never lets Starter read past its 30 days', () => {
    expect(canCompare(7, 'starter')).toBe(true)
    expect(canCompare(30, 'starter')).toBe(false)
    expect(canCompare(7, 'free')).toBe(false)
  })
})

describe('periodChange', () => {
  it('works out the percent change, rounded', () => {
    expect(periodChange(125, 100)).toEqual({ direction: 'up', percent: 25 })
    expect(periodChange(90, 100)).toEqual({ direction: 'down', percent: 10 })
    expect(periodChange(1, 3)).toEqual({ direction: 'down', percent: 67 })
    expect(periodChange(0, 4)).toEqual({ direction: 'down', percent: 100 })
  })

  it('says no change when the counts match or round to 0%', () => {
    expect(periodChange(10, 10)).toEqual({ direction: 'same', percent: 0 })
    expect(periodChange(1001, 1000)).toEqual({ direction: 'same', percent: 0 })
  })

  it('shows nothing when the period before had nothing', () => {
    expect(periodChange(12, 0)).toBeNull()
    expect(periodChange(0, 0)).toBeNull()
  })

  it('never relies on colour alone', () => {
    expect(changeText({ direction: 'up', percent: 25 })).toBe('▲ 25%')
    expect(changeText({ direction: 'down', percent: 10 })).toBe('▼ 10%')
    expect(changeText({ direction: 'same', percent: 0 })).toBe('No change')
    expect(changeLabel({ direction: 'up', percent: 25 }, 30)).toBe('Up 25% from the 30 days before')
  })
})

describe('summarizeInsights', () => {
  const row = (kind: string, name: string, views: number, clicks: number): InsightRow => ({
    item_kind: kind,
    item_id: `${kind}-${name}`,
    item_name: name,
    views,
    clicks,
  })

  it('totals the storefront and works out the click rate', () => {
    const s = summarizeInsights([
      row('product', 'Candle', 40, 4),
      row('service', 'Braids', 10, 1),
      row('event', 'Pop-up', 99, 9),
    ])
    expect(s.storefront).toMatchObject({ itemCount: 2, views: 50, clicks: 5, rate: 10 })
  })

  it('lists the top items by views, then clicks, and skips quiet ones', () => {
    const rows = [
      row('product', 'A', 5, 0),
      row('product', 'B', 9, 1),
      row('product', 'C', 9, 3),
      row('product', 'Quiet', 0, 0),
      row('service', 'D', 1, 0),
      row('service', 'E', 2, 0),
      row('service', 'F', 3, 0),
    ]
    const top = summarizeInsights(rows).storefront.top
    expect(top).toHaveLength(TOP_ITEMS)
    expect(top.map((i) => i.name)).toEqual(['C', 'B', 'A', 'F', 'E'])
    expect(summarizeInsights(rows).storefront.itemCount).toBe(7)
  })

  it('keeps events and jobs apart from the storefront', () => {
    const s = summarizeInsights([row('job', 'Barista', 3, 1), row('event', 'Market', 8, 2)])
    expect(s.storefront.itemCount).toBe(0)
    expect(s.storefront.rate).toBeNull()
    expect(s.postings.map((p) => p.name)).toEqual(['Market', 'Barista'])
  })

  it('ignores kinds it does not know and reads bigint strings', () => {
    const s = summarizeInsights([
      row('coupon', 'X', 1, 1),
      { ...row('product', 'Y', 0, 0), views: '7' as unknown as number },
    ])
    expect(s.storefront.views).toBe(7)
    expect(s.storefront.itemCount).toBe(1)
  })

  it('gives no rate without views', () => {
    expect(clickRate(0, 3)).toBeNull()
    expect(clickRate(8, 2)).toBe(25)
  })
})

describe('the Starter locked card', () => {
  it('lists storefront numbers only while the marketplace is open', () => {
    const closed = advancedPreviewLines({ marketplaceOpen: false, jobsOpen: true })
    expect(closed.join(' ')).not.toMatch(/storefront/i)
    expect(advancedPreviewLines({ marketplaceOpen: true, jobsOpen: true })).toContain(
      'Views and clicks for each storefront item'
    )
  })

  it('names jobs only while job posting is open', () => {
    expect(advancedPreviewLines({ marketplaceOpen: false, jobsOpen: false })).toContain(
      'Views and taps for the events you post'
    )
  })

  it('never promises Shop sales', () => {
    for (const line of advancedPreviewLines({ marketplaceOpen: true, jobsOpen: true })) {
      expect(line).not.toMatch(/sales|orders|payout|revenue/i)
      expect(line).not.toContain('—')
    }
  })
})

describe('owner_listing_insights migration', () => {
  const sql = read('supabase/migrations/20261203000000_owner_listing_insights.sql')

  it('checks ownership itself, since it bypasses RLS', () => {
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toMatch(/owner_user_id = auth\.uid\(\)[\s\S]*RAISE EXCEPTION 'not authorized'/)
    expect(sql).toContain('REVOKE ALL ON FUNCTION owner_listing_insights')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION owner_listing_insights')
    expect(sql).toContain('DOWN PLAN')
  })

  it('attributes rows by the real tables, not a visitor-sent property', () => {
    expect(sql).toContain('mp.listing_id = p_listing_id')
    expect(sql).toContain('ms.listing_id = p_listing_id')
    expect(sql).toContain('de.organizer_listing_id = p_listing_id')
    expect(sql).toContain('dj.hiring_listing_id = p_listing_id')
    expect(sql).not.toMatch(/properties\s*->>\s*'listing_id'/)
  })

  it("leaves out other owners' events and jobs that name this page", () => {
    const count = sql.match(/AND l\.owner_user_id = auth\.uid\(\)/g) ?? []
    expect(count).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Tracking fixes
// ---------------------------------------------------------------------------

const tracked: Array<Record<string, unknown>> = []
vi.mock('@/lib/analytics/server', () => ({
  trackServerEvent: (input: Record<string, unknown>) => {
    tracked.push(input)
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
  createServiceClient: () => {
    throw new Error('the route must not insert through a lazy builder')
  },
}))

describe('POST /api/marketplace/cta-click', () => {
  beforeEach(() => {
    tracked.length = 0
  })

  it('records the click (it was a void insert that never ran)', async () => {
    const { POST } = await import('@/app/api/marketplace/cta-click/route')
    const res = await POST(
      new NextRequest('http://localhost/api/marketplace/cta-click', {
        method: 'POST',
        body: JSON.stringify({
          entity_type: 'product',
          entity_id: 'p1',
          listing_id: 'l1',
          cta_type: 'shop-now',
          destination_url: 'https://shop.example/candle',
        }),
      })
    )
    expect(res.status).toBe(200)
    expect(tracked).toEqual([
      expect.objectContaining({
        event_name: 'cta_click',
        entity_type: 'product',
        entity_id: 'p1',
        properties: expect.objectContaining({ listing_id: 'l1', cta_type: 'shop-now' }),
      }),
    ])
  })

  it('records nothing for a bad request', async () => {
    const { POST } = await import('@/app/api/marketplace/cta-click/route')
    const res = await POST(
      new NextRequest('http://localhost/api/marketplace/cta-click', {
        method: 'POST',
        body: JSON.stringify({ entity_type: 'product', entity_id: 'p1', listing_id: 'l1' }),
      })
    )
    expect(res.status).toBe(400)
    expect(tracked).toHaveLength(0)
  })

  it('has no void insert left', () => {
    const code = read('app/api/marketplace/cta-click/route.ts')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')
    expect(code).not.toMatch(/void\s+\w+\.from\(/)
  })
})

describe('product and service view events', () => {
  for (const [file, entityType, varName] of [
    ['app/(public)/marketplace/products/[slug]/page.tsx', 'product', 'product'],
    ['app/(public)/marketplace/services/[slug]/page.tsx', 'service', 'svc'],
  ] as const) {
    it(`${entityType} pages send marketplace_product_viewed from the server`, () => {
      const src = read(file)
      expect(src).toContain('ANALYTICS_EVENTS.MARKETPLACE_PRODUCT_VIEWED')
      expect(src).toContain(`entity_type: '${entityType}'`)
      expect(src).toContain(`entity_id: ${varName}.id`)
      // A cached page would send one view per revalidate, not per visit.
      expect(src).not.toMatch(/export const revalidate/)
      // After the not-found check, so a missing item sends nothing.
      expect(src.indexOf(`if (!${varName}) notFound()`)).toBeLessThan(
        src.indexOf('MARKETPLACE_PRODUCT_VIEWED')
      )
    })
  }

  it('is no longer listed as declared-but-not-emitted', () => {
    const constants = read('lib/analytics/constants.ts')
    const declared = constants.slice(constants.indexOf('Declared, nothing emits them yet'))
    expect(declared.slice(0, 300)).not.toContain('marketplace_product_viewed')
  })
})
