import { describe, expect, it } from 'vitest'
import { AGGREGATE_MIN_TRANSACTIONS } from '@/lib/spend/aggregate-privacy'
import {
  CATEGORY_FAMILIES,
  FALLBACK_FAMILY_INDEX,
  GOLD,
  GOLD_BRIGHT,
  LEVEL_COLORS,
  NOT_TRACKED_TEXT,
  PULSE_MAX_MS,
  PULSE_MIN_MS,
  SILO_FLOORS,
  anonymousBusinessLabel,
  buildFloors,
  buildSiloBusinesses,
  businessDisplayName,
  colorForBusiness,
  familyIndexForCategorySlug,
  floorIndexForLevel,
  floorSpokenLabel,
  floorValueText,
  GAP_KINDS,
  gapKinds,
  gapLabel,
  gapsPerFloor,
  siloGaps,
  placeBusinesses,
  pulseProgress,
  pulseSchedule,
  SILO,
  clusterRadius,
  clusterDepth,
  CLUSTER_MAX_R,
  crowdAnchor,
  linkControlPoints,
  scrollForFloor,
  viewForScroll,
  type BusinessListingMeta,
  type BusinessNodeRow,
} from '@/lib/spend/silo-layout'

const MIN = AGGREGATE_MIN_TRANSACTIONS

function listing(over: Partial<BusinessListingMeta> = {}): BusinessListingMeta {
  return {
    name: 'Test Listing',
    href: '/listing/test',
    level: 'local',
    categorySlug: 'food-dining',
    ...over,
  }
}

describe('buildFloors', () => {
  it('tracks only the first floor and shows its total', () => {
    const floors = buildFloors(123_400)
    expect(floors).toHaveLength(SILO_FLOORS.length)
    expect(floors[0]!.tracked).toBe(true)
    expect(floors[0]!.amountCents).toBe(123_400)
    expect(floorValueText(floors[0]!)).toBe('$1,234 spent')
  })

  it('says "Not tracked yet" on every lower floor and never invents an amount', () => {
    const floors = buildFloors(500_000)
    for (const f of floors.slice(1)) {
      expect(f.tracked).toBe(false)
      expect(f.amountCents).toBeNull()
      expect(f.barShare).toBe(0)
      expect(floorValueText(f)).toBe(NOT_TRACKED_TEXT)
    }
    expect(NOT_TRACKED_TEXT).toBe('Not tracked yet')
  })

  it('gives an empty first floor no bar', () => {
    const floors = buildFloors(0)
    expect(floors[0]!.barShare).toBe(0)
    expect(floorValueText(floors[0]!)).toBe('$0 spent')
  })

  it('reads every floor aloud in words, with "spent" and never "circulated"', () => {
    const floors = buildFloors(250_000)
    const spoken = floors.map((f) => floorSpokenLabel(f, 3))
    expect(spoken[0]).toBe('Shoppers: $2,500 spent with businesses on the list')
    expect(spoken[1]).toBe(
      'Shops: money passed on here is not tracked yet, 3 businesses on this floor'
    )
    expect(floorSpokenLabel(floors[2]!, 1)).toMatch(/1 business on this floor$/)
    for (const s of spoken) expect(s).not.toMatch(/circulat/i)
  })
})

describe('floors and families', () => {
  it('maps levels to floors and puts unknown levels with the shops', () => {
    expect(floorIndexForLevel('local')).toBe(1)
    expect(floorIndexForLevel('supplier')).toBe(2)
    expect(floorIndexForLevel('maker')).toBe(3)
    expect(floorIndexForLevel('grower')).toBe(4)
    expect(floorIndexForLevel(null)).toBe(1)
    expect(floorIndexForLevel('wholesale')).toBe(1)
  })

  it('maps category slugs to a family and falls back to Services', () => {
    expect(CATEGORY_FAMILIES[familyIndexForCategorySlug('food-dining')]!.key).toBe('food')
    expect(CATEGORY_FAMILIES[familyIndexForCategorySlug('beauty-grooming')]!.key).toBe('style')
    expect(familyIndexForCategorySlug('not-a-category')).toBe(FALLBACK_FAMILY_INDEX)
    expect(familyIndexForCategorySlug(null)).toBe(FALLBACK_FAMILY_INDEX)
    expect(CATEGORY_FAMILIES[FALLBACK_FAMILY_INDEX]!.key).toBe('services')
  })

  it('never puts a slug in two families', () => {
    const all = CATEGORY_FAMILIES.flatMap((f) => f.slugs)
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('buildSiloBusinesses', () => {
  const nodes: BusinessNodeRow[] = [
    { entity_id: 'a', total_amount_cents: 9000, transaction_count: MIN },
    { entity_id: 'b', total_amount_cents: 7000, transaction_count: MIN + 4 },
    { entity_id: 'below', total_amount_cents: 99_000, transaction_count: MIN - 1 },
    { entity_id: 'gone', total_amount_cents: 5000, transaction_count: MIN },
  ]
  const listings = {
    a: listing({ name: 'Alpha', level: 'maker' }),
    b: listing({ name: 'Beta', categorySlug: 'beauty-grooming' }),
    below: listing({ name: 'Below' }),
  }

  it('shows every published business, linked ones first', () => {
    const out = buildSiloBusinesses({ nodes, listings, isNameOptedIn: () => false })
    // 'gone' has receipts but no published listing, so it is not on the map.
    expect(out.map((b) => b.id)).toEqual(['a', 'b', 'below'])
    expect(out.map((b) => b.linked)).toEqual([true, true, false])
  })

  it('keeps no total for a business under the min-transactions floor', () => {
    const out = buildSiloBusinesses({ nodes, listings, isNameOptedIn: () => false })
    const below = out.find((b) => b.id === 'below')!
    expect(below.amountCents).toBe(0)
    expect(below.transactionCount).toBe(0)
  })

  it('shows a business with no receipts at all as an unlinked node', () => {
    const out = buildSiloBusinesses({
      nodes: [],
      listings: { fresh: listing({ level: 'grower' }) },
      isNameOptedIn: () => false,
    })
    expect(out).toHaveLength(1)
    expect(out[0]!.linked).toBe(false)
    expect(out[0]!.floorIndex).toBe(4)
  })

  // Founder, 2026-10-31 (ticket 171b): names show on the Collective, just not
  // the lines or the numbers.
  it('shows every business by name, with its link, even below the floor', () => {
    const out = buildSiloBusinesses({ nodes, listings })
    expect(out.find((b) => b.id === 'a')!.name).toBe('Alpha')
    expect(out.find((b) => b.id === 'b')!.name).toBe('Beta')
    const below = out.find((b) => b.id === 'below')!
    expect(below.name).not.toBeNull()
    expect(below.href).not.toBeNull()
    expect(below.amountCents).toBe(0)
    expect(businessDisplayName(out[0]!)).toBe('Alpha')
  })

  it('falls back to the kind of business when a listing has no name', () => {
    const [b] = buildSiloBusinesses({ nodes: [], listings: { x: listing({ name: '' }) } })
    expect(b!.name).toBeNull()
    expect(businessDisplayName(b!)).toBe(anonymousBusinessLabel(b!))
  })

  it("marks the reader's own business as You", () => {
    const mine = buildSiloBusinesses({ nodes, listings, youIds: new Set(['a']) })
    expect(mine.find((b) => b.id === 'a')!.isYou).toBe(true)
    const someoneElse = buildSiloBusinesses({ nodes, listings })
    expect(someoneElse.find((b) => b.id === 'a')!.isYou).toBe(false)
  })

  it('places levels on their floor and families by category', () => {
    const out = buildSiloBusinesses({ nodes, listings, isNameOptedIn: () => false })
    expect(out[0]!.floorIndex).toBe(3)
    expect(CATEGORY_FAMILIES[out[1]!.familyIndex]!.key).toBe('style')
  })
})

describe('labels and colors', () => {
  it('picks the right article for an anonymous label', () => {
    expect(anonymousBusinessLabel({ familyIndex: 0, floorIndex: 1 })).toBe('A food shop')
    expect(anonymousBusinessLabel({ familyIndex: 0, floorIndex: 1 }, false)).toBe('a food shop')
    // "home and trades" starts with h, so it stays "A".
    expect(anonymousBusinessLabel({ familyIndex: 3, floorIndex: 2 })).toBe(
      'A home and trades supplier'
    )
  })

  it('colors by category by default, keeps gold for you, and switches to level', () => {
    const [b] = buildSiloBusinesses({
      nodes: [{ entity_id: 'x', total_amount_cents: 1, transaction_count: MIN }],
      listings: { x: listing({ level: 'grower', categorySlug: 'beauty-grooming' }) },
      isNameOptedIn: () => false,
    })
    expect(colorForBusiness(b!, 'category')).toBe(CATEGORY_FAMILIES[1]!.color)
    expect(colorForBusiness(b!, 'level')).toBe(LEVEL_COLORS.grower)
    expect(colorForBusiness(b!, 'gold')).toBe(GOLD)
    expect(colorForBusiness({ ...b!, isYou: true }, 'category')).toBe(GOLD_BRIGHT)
  })
})

describe('placement', () => {
  function makeMany(n: number, categorySlug = 'food-dining') {
    return buildSiloBusinesses({
      nodes: [],
      listings: Object.fromEntries(
        Array.from({ length: n }, (_, i) => [`biz-${i}`, listing({ categorySlug })])
      ),
      isNameOptedIn: () => false,
    })
  }

  it('places businesses the same way every time', () => {
    const many = makeMany(30)
    const a = placeBusinesses(many)
    expect(a).toEqual(placeBusinesses(many))
    expect(a).toHaveLength(30)
  })

  it('keeps each business near its own floor and inside the cage', () => {
    const many = [
      ...makeMany(400),
      ...makeMany(12, 'beauty-grooming').map((b) => ({ ...b, id: `s-${b.id}`, floorIndex: 4 })),
    ]
    const placed = placeBusinesses(many)
    const byId = new Map(many.map((b) => [b.id, b]))
    for (const p of placed) {
      const b = byId.get(p.id)!
      const spread = clusterRadius(400)
      expect(Math.abs(p.y - SILO.y[b.floorIndex]!)).toBeLessThanOrEqual(spread)
      expect(Math.hypot(p.x, p.z)).toBeLessThan(SILO.R + SILO.cr)
    }
  })

  it('does not move a cluster when one more business joins another family', () => {
    const food = makeMany(10)
    const before = placeBusinesses(food)
    const after = placeBusinesses([
      ...food,
      ...makeMany(3, 'beauty-grooming').map((b) => ({ ...b, id: `s-${b.id}` })),
    ])
    for (const p of before) expect(after.find((q) => q.id === p.id)).toEqual(p)
  })

  it('spreads a busy cluster wider and deeper than a small one', () => {
    expect(clusterRadius(300)).toBeGreaterThan(clusterRadius(40))
    expect(clusterDepth(300)).toBeGreaterThan(clusterDepth(5))
    // Two full clusters on neighbouring floors never touch.
    expect(2 * CLUSTER_MAX_R).toBeLessThan(SILO.y[0] - SILO.y[1])
    // The deepest slab still stays outside the hub column.
    expect(SILO.rA - clusterDepth(10_000)).toBeGreaterThan(SILO.hubR)
  })

  it('grows the cluster with the crowd, within limits', () => {
    expect(clusterRadius(1)).toBe(SILO.cr)
    expect(clusterRadius(10_000)).toBe(CLUSTER_MAX_R)
    expect(clusterRadius(200)).toBeGreaterThan(SILO.cr)
  })

  it('starts links on the top floor and bows them toward the middle', () => {
    const a = crowdAnchor(0)
    expect(a.y).toBe(SILO.y[0])
    const b = { x: 10, y: -34, z: 5 }
    const [p0, p1, p2, p3] = linkControlPoints(a, b)
    expect(p0).toEqual(a)
    expect(p3).toEqual(b)
    const straight = (t: number) => Math.hypot(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)
    expect(Math.hypot(p1.x, p1.z)).toBeLessThan(straight(1 / 3))
    expect(Math.hypot(p2.x, p2.z)).toBeLessThan(straight(2 / 3))
  })

  it('frames each floor with the scroll position', () => {
    for (let k = 0; k < SILO.y.length; k++) {
      const t = scrollForFloor(k)
      expect(t).toBeGreaterThanOrEqual(0)
      expect(t).toBeLessThanOrEqual(1)
      const { pos } = viewForScroll(t)
      expect(pos.y).toBeGreaterThan(SILO.y[k]!)
    }
  })
})

describe('pulses', () => {
  it('gives each link one pulse every one to two minutes', () => {
    const slots = pulseSchedule(['l1', 'l2', 'l3', 'l4', 'l5'])
    for (const s of slots) {
      expect(s.periodMs).toBeGreaterThanOrEqual(PULSE_MIN_MS)
      expect(s.periodMs).toBeLessThanOrEqual(PULSE_MAX_MS)
      expect(s.offsetMs).toBeGreaterThanOrEqual(0)
      expect(s.offsetMs).toBeLessThanOrEqual(s.periodMs)
    }
    expect(pulseSchedule(['l1'])).toEqual(pulseSchedule(['l1']))
  })

  it('runs a pulse once per period and rests otherwise', () => {
    const slot = { linkId: 'x', periodMs: 60_000, offsetMs: 1000 }
    expect(pulseProgress(slot, 1000)).toBe(0)
    expect(pulseProgress(slot, 1800)).toBeCloseTo(0.5)
    expect(pulseProgress(slot, 3000)).toBeNull()
    expect(pulseProgress(slot, 61_000)).toBe(0)
  })
})

describe('gaps', () => {
  it('marks every family on every business floor as a gap when the list is empty', () => {
    const gaps = siloGaps([])
    expect(gaps).toHaveLength(CATEGORY_FAMILIES.length * (SILO_FLOORS.length - 1))
    expect(gaps.every((g) => g.floorIndex >= 1)).toBe(true)
    expect(gapsPerFloor(gaps)).toEqual([0, 6, 6, 6, 6])
  })

  it('fills a wedge once one business is in it, linked or not', () => {
    const out = buildSiloBusinesses({
      nodes: [],
      listings: { f: listing({ level: 'grower', categorySlug: 'food-dining' }) },
    })
    const gaps = siloGaps(out)
    expect(gaps.some((g) => g.familyIndex === 0 && g.floorIndex === 4)).toBe(false)
    expect(gapsPerFloor(gaps)[4]).toBe(CATEGORY_FAMILIES.length - 1)
  })

  it('names a gap honestly, without saying money leaves', () => {
    const label = gapLabel({ familyIndex: 0, floorIndex: 4 })
    expect(label).toBe('No food growers on the list yet')
    expect(label).not.toMatch(/leave|dollar|\$/i)
  })

  it('lists kinds of business for every gap (ticket 173)', () => {
    for (const fam of CATEGORY_FAMILIES) {
      expect(GAP_KINDS[fam.key], fam.key).toBeDefined()
    }
    expect(gapKinds({ familyIndex: 0, floorIndex: 4 })).toContain('Farms and farm stands')
    expect(gapKinds({ familyIndex: 1, floorIndex: 2 })).toContain('Beauty supply stores')
    // Shoppers is never a gap, and Services rarely has growers.
    expect(gapKinds({ familyIndex: 0, floorIndex: 0 })).toEqual([])
    expect(gapKinds({ familyIndex: FALLBACK_FAMILY_INDEX, floorIndex: 4 })).toEqual([])
  })

  it('keeps the kinds lists short, plain and free of ownership labels', () => {
    for (const byFloor of Object.values(GAP_KINDS)) {
      for (const kinds of Object.values(byFloor)) {
        expect(kinds.length).toBeLessThanOrEqual(7)
        for (const k of kinds) expect(k).not.toMatch(/—|black|ally|owned/i)
      }
    }
  })
})
