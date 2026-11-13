// =============================================================================
// Coupons and deals (owner-experience round 2, part G, 2026-11-13).
// =============================================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import {
  DEALS_ON_MAX,
  DEAL_CODE_RE,
  DEAL_MAX_LEAD_DAYS,
  dealEndsLabel,
  dealIsOn,
  dealState,
  dealsAllowed,
  isLiveDeal,
  parseDeal,
  shownDeals,
  toOwnerDeals,
  toPublicDeal,
  type OwnerDeal,
} from '@/lib/listings/deals'
import { endsLabel } from '@/lib/listings/happeningNow'
import { rpcArgs } from '@/lib/listings/facets'
import { checkDealAdd, dealsUpgradeTarget } from '@/lib/stripe/planChecks'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const NOW = new Date('2026-11-13T12:00:00.000Z')
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString()

let seq = 0
function deal(over: Partial<OwnerDeal> = {}): OwnerDeal {
  seq += 1
  return {
    id: `deal-${seq}`,
    title: `Deal ${seq}`,
    description: null,
    code: null,
    terms: null,
    starts_at: at(-DAY),
    ends_at: null,
    status: 'active',
    created_at: at(-DAY + seq * 1000),
    ...over,
  }
}

const input = (over: Record<string, unknown> = {}) => ({
  title: '15% off your first order',
  description: '',
  code: '',
  terms: '',
  startsAt: '',
  endsAt: '',
  ...over,
})

describe('only Premium can put deals on a page', () => {
  it('dealsAllowed is Premium only', () => {
    expect(dealsAllowed('premium')).toBe(true)
    for (const tier of ['free', 'starter', 'growth', null, undefined, 'nonsense']) {
      expect(dealsAllowed(tier)).toBe(false)
    }
  })

  it('checkDealAdd refuses every plan below Premium', () => {
    for (const tier of ['free', 'starter', 'growth', null]) {
      expect(checkDealAdd(tier, 0)).toMatch(/part of Premium/)
    }
    expect(checkDealAdd('premium', 0)).toBeNull()
  })

  it('checkDealAdd caps deals on at once', () => {
    expect(checkDealAdd('premium', DEALS_ON_MAX - 1)).toBeNull()
    expect(checkDealAdd('premium', DEALS_ON_MAX)).toMatch(`up to ${DEALS_ON_MAX} deals`)
  })

  it('dealsUpgradeTarget offers Premium below it, only while it is for sale', () => {
    for (const tier of ['free', 'starter', 'growth', null]) {
      expect(dealsUpgradeTarget(tier, true)).toBe('Premium')
      expect(dealsUpgradeTarget(tier, false)).toBeNull()
    }
    expect(dealsUpgradeTarget('premium', true)).toBeNull()
  })

  it('saveDealAction checks the plan on every publish', () => {
    const src = read('lib/actions/dashboard/deals.ts')
    expect(src).toContain("isFeatureEnabled('coupons')")
    expect(src).toContain('getOwnerSession()')
    expect(src).toContain('checkDealAdd(listing.tier')
    // The check sits inside the publish branch, so drafts, ends and deletes stay open.
    const save = src.slice(src.indexOf('export async function saveDealAction'))
    expect(save.indexOf('if (publish)')).toBeLessThan(save.indexOf('checkDealAdd('))
  })
})

describe('dealState / isLiveDeal / dealIsOn', () => {
  it('reads the status and the window', () => {
    expect(dealState(deal({ status: 'draft' }), NOW)).toBe('draft')
    expect(dealState(deal({ status: 'ended' }), NOW)).toBe('ended')
    expect(dealState(deal(), NOW)).toBe('live')
    expect(dealState(deal({ starts_at: at(HOUR) }), NOW)).toBe('scheduled')
    expect(dealState(deal({ ends_at: at(-HOUR) }), NOW)).toBe('ended')
    expect(dealState(deal({ ends_at: NOW.toISOString() }), NOW)).toBe('ended')
    expect(dealState(deal({ ends_at: at(HOUR) }), NOW)).toBe('live')
  })

  it('a deal with no end runs until the owner ends it', () => {
    expect(isLiveDeal(deal({ ends_at: null, starts_at: at(-365 * DAY) }), NOW)).toBe(true)
  })

  it('on means live or scheduled', () => {
    expect(dealIsOn(deal(), NOW)).toBe(true)
    expect(dealIsOn(deal({ starts_at: at(DAY) }), NOW)).toBe(true)
    expect(dealIsOn(deal({ status: 'draft' }), NOW)).toBe(false)
    expect(dealIsOn(deal({ status: 'ended' }), NOW)).toBe(false)
  })
})

describe('shownDeals', () => {
  it('shows none below Premium, and keeps them saved as hidden', () => {
    const deals = [deal(), deal()]
    for (const tier of ['free', 'starter', 'growth']) {
      const { shown, hidden } = shownDeals(deals, tier, NOW)
      expect(shown).toEqual([])
      expect(hidden).toHaveLength(2)
    }
  })

  it('shows only live deals', () => {
    const live = deal()
    const { shown } = shownDeals(
      [live, deal({ status: 'draft' }), deal({ starts_at: at(DAY) }), deal({ ends_at: at(-HOUR) })],
      'premium',
      NOW
    )
    expect(shown.map((d) => d.id)).toEqual([live.id])
  })

  it('sorts soonest ending first, with no end last', () => {
    const open = deal({ ends_at: null })
    const late = deal({ ends_at: at(5 * DAY) })
    const soon = deal({ ends_at: at(HOUR) })
    const { shown } = shownDeals([open, late, soon], 'premium', NOW)
    expect(shown.map((d) => d.id)).toEqual([soon.id, late.id, open.id])
  })

  it('caps at DEALS_ON_MAX, keeping the oldest', () => {
    const deals = Array.from({ length: DEALS_ON_MAX + 2 }, () => deal())
    const { shown, hidden } = shownDeals(deals, 'premium', NOW)
    expect(shown).toHaveLength(DEALS_ON_MAX)
    expect(hidden.map((d) => d.id)).toEqual(deals.slice(DEALS_ON_MAX).map((d) => d.id))
  })
})

describe('dealEndsLabel', () => {
  it('is null with no end, and the posts label otherwise', () => {
    expect(dealEndsLabel(null, NOW)).toBeNull()
    expect(dealEndsLabel(at(3 * DAY), NOW)).toBe(endsLabel(at(3 * DAY), NOW))
  })
})

describe('parseDeal', () => {
  it('accepts a minimal deal, starting now with no end', () => {
    const r = parseDeal(input(), NOW)
    expect(r).toEqual({
      ok: true,
      value: {
        title: '15% off your first order',
        description: null,
        code: null,
        terms: null,
        starts_at: NOW.toISOString(),
        ends_at: null,
      },
    })
  })

  it('makes every field one line', () => {
    const r = parseDeal(input({ title: ' Two\nlines ', terms: 'One\r\nper  customer' }), NOW)
    expect(r.ok && r.value.title).toBe('Two lines')
    expect(r.ok && r.value.terms).toBe('One per customer')
  })

  it('needs a title, within the limit', () => {
    expect(parseDeal(input({ title: '   ' }), NOW)).toEqual({
      ok: false,
      error: 'Add a title for your deal.',
    })
    expect(parseDeal(input({ title: 'x'.repeat(81) }), NOW).ok).toBe(false)
  })

  it('refuses links', () => {
    for (const field of ['title', 'description', 'terms']) {
      for (const link of ['see https://x.test', 'www.shop.test', 'order at mycakes.com']) {
        expect(parseDeal(input({ [field]: link }), NOW)).toEqual({
          ok: false,
          error: 'Leave links out of your deal.',
        })
      }
    }
  })

  it('checks the code the same way the database does', () => {
    for (const ok of ['WELCOME15', 'a', 'SPRING_SALE-2026']) {
      expect(parseDeal(input({ code: ok }), NOW).ok).toBe(true)
      expect(DEAL_CODE_RE.test(ok)).toBe(true)
    }
    for (const bad of ['TWO WORDS', '-LEADING', 'emoji🎉', 'x'.repeat(41)]) {
      expect(parseDeal(input({ code: bad }), NOW).ok).toBe(false)
    }
    expect(parseDeal(input({ code: ' TRIM ' }), NOW)).toMatchObject({
      ok: true,
      value: { code: 'TRIM' },
    })
  })

  it('moves a past start to now, unless the deal is running and keeps its start', () => {
    const past = at(-2 * DAY)
    expect(parseDeal(input({ startsAt: past }), NOW)).toMatchObject({
      ok: true,
      value: { starts_at: NOW.toISOString() },
    })
    expect(parseDeal(input({ startsAt: past }), NOW, past)).toMatchObject({
      ok: true,
      value: { starts_at: past },
    })
  })

  it('schedules ahead, up to the lead limit', () => {
    expect(parseDeal(input({ startsAt: at(DAY) }), NOW)).toMatchObject({
      ok: true,
      value: { starts_at: at(DAY) },
    })
    expect(parseDeal(input({ startsAt: at((DEAL_MAX_LEAD_DAYS + 1) * DAY) }), NOW).ok).toBe(false)
  })

  it('needs an end in the future and after the start', () => {
    expect(parseDeal(input({ endsAt: 'not a date' }), NOW)).toEqual({
      ok: false,
      error: 'Choose a valid end date.',
    })
    expect(parseDeal(input({ endsAt: at(-HOUR) }), NOW)).toEqual({
      ok: false,
      error: 'Choose an end date in the future.',
    })
    expect(parseDeal(input({ startsAt: at(2 * DAY), endsAt: at(DAY) }), NOW)).toEqual({
      ok: false,
      error: 'Your deal has to end after it starts.',
    })
    expect(parseDeal(input({ endsAt: at(DAY) }), NOW)).toMatchObject({
      ok: true,
      value: { ends_at: at(DAY) },
    })
  })
})

describe('toOwnerDeals / toPublicDeal', () => {
  it('keeps good rows and drops malformed ones', () => {
    const good = {
      id: 'a',
      title: 'T',
      description: '',
      code: 'C1',
      terms: null,
      starts_at: at(0),
      ends_at: null,
      status: 'active',
      created_at: at(0),
    }
    const rows = [
      good,
      null,
      { ...good, id: 1 },
      { ...good, status: 'paused' },
      { ...good, starts_at: null },
      { ...good, ends_at: 5 },
    ]
    const out = toOwnerDeals(rows)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'a', description: null, code: 'C1', ends_at: null })
    expect(toOwnerDeals(null)).toEqual([])
  })

  it('makes the public shape without status or dates the visitor doesn’t need', () => {
    const d = deal({ code: 'X', ends_at: at(DAY) })
    expect(toPublicDeal(d)).toEqual({
      id: d.id,
      title: d.title,
      description: null,
      code: 'X',
      terms: null,
      endsAt: at(DAY),
    })
  })
})

describe('migration 20261117000000_listing_deals', () => {
  const sql = read('supabase/migrations/20261117000000_listing_deals.sql')

  it('keeps the limits the app checks', () => {
    expect(sql).toContain("CHECK (status IN ('draft', 'active', 'ended'))")
    expect(sql).toContain('char_length(btrim(title)) BETWEEN 1 AND 80')
    expect(sql).toContain('char_length(description) BETWEEN 1 AND 300')
    expect(sql).toContain('char_length(terms) BETWEEN 1 AND 300')
    expect(sql).toContain(`code ~ '${DEAL_CODE_RE.source}'`)
    expect(sql).toContain('ends_at IS NULL OR ends_at > starts_at')
  })

  it('lets the public read only live deals on published pages', () => {
    expect(sql).toContain('ALTER TABLE public.listing_deals ENABLE ROW LEVEL SECURITY')
    const anon = sql.slice(
      sql.indexOf('CREATE POLICY "listing_deals: anon read live"'),
      sql.indexOf('-- Authenticated')
    )
    expect(anon).toContain("status = 'active'")
    expect(anon).toContain('starts_at <= now()')
    expect(anon).toContain('ends_at IS NULL OR')
    expect(anon).toContain("status = 'published' AND deleted_at IS NULL")
    for (const p of ['owner insert', 'owner update', 'owner delete']) {
      expect(sql).toContain(`CREATE POLICY "listing_deals: ${p}"`)
    }
  })

  it('adds p_has_deals to both search functions, Premium pages only', () => {
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS search_listings_faceted\(/)
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS facet_counts\(/)
    expect(sql.match(/^\s+p_has_deals\s+boolean DEFAULT NULL$/gm)).toHaveLength(2)
    expect(sql.match(/p_has_deals IS NOT TRUE/g)).toHaveLength(2)
    expect(sql.match(/l\.tier = 'premium'/g)).toHaveLength(2)
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION search_listings_faceted\([\s\S]*?text\[\],\s+boolean\s*\) TO anon, authenticated/
    )
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION facet_counts\([\s\S]*?text\[\],\s+boolean\s*\) TO anon, authenticated/
    )
    expect(sql).toContain("NOTIFY pgrst, 'reload schema'")
  })

  it('has a down plan', () => {
    expect(sql).toMatch(/Down[\s\S]*DROP TABLE IF EXISTS public\.listing_deals;/)
  })
})

describe('wiring', () => {
  it('rpcArgs leaves p_has_deals out unless it is set', () => {
    expect(rpcArgs({ p_q: null, p_has_deals: null })).not.toHaveProperty('p_has_deals')
    expect(rpcArgs({ p_q: null, p_has_deals: true })).toMatchObject({ p_has_deals: true })
  })

  it('never retries a search without p_has_deals', () => {
    expect(read('lib/listings/facets.ts')).toMatch(/'p_has_deals' in args\s*\)\s*return first/)
  })

  it('the Discover filter is behind the flag', () => {
    expect(read('lib/listings/facets.ts')).toContain(
      "p_has_deals: raw.deals && isFeatureEnabled('coupons') ? true : null"
    )
    expect(read('components/discovery/useFacetParams.ts')).toContain("'deals'")
    for (const page of [
      'app/(public)/discover/(index)/page.tsx',
      'app/(public)/discover/[citySlug]/page.tsx',
    ]) {
      expect(read(page)).toContain("showDeals={isFeatureEnabled('coupons')}")
    }
  })

  it('the page read is flagged and capped by plan', () => {
    const src = read('lib/listings/entityPage.ts')
    expect(src).toContain("isFeatureEnabled('coupons')")
    expect(src).toContain('shownDeals(')
  })

  it('every business template shows the section', () => {
    for (const t of ['Storefront', 'Professional', 'Creative']) {
      const src = read(`components/entity-page/templates/${t}Template.tsx`)
      expect(src).toContain('<EntityDeals')
      expect(src).toContain("{ id: 'deals', label: 'Deals' }")
    }
  })

  it('copying a code records deal_code_copied', () => {
    const src = read('components/entity-page/DealCodeButton.tsx')
    expect(src).toContain('ANALYTICS_EVENTS.DEAL_CODE_COPIED')
    expect(src).toContain('navigator.clipboard.writeText')
  })

  it('the editor is on the Services tab, behind the flag', () => {
    expect(read('lib/listings/editTabs.ts')).toContain("services: ['services', 'deals', 'details']")
    expect(read('app/dashboard/pages/[entityId]/edit/page.tsx')).toContain(
      "isFeatureEnabled('coupons')"
    )
  })
})
