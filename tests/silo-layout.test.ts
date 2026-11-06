import { describe, expect, it } from 'vitest'
import { AGGREGATE_MIN_TRANSACTIONS } from '@/lib/spend/aggregate-privacy'
import {
  CATEGORY_FAMILIES,
  FALLBACK_FAMILY_INDEX,
  LABEL_KEEP,
  LABEL_SWAP_MS,
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
  pickLabels,
  wedgePoint,
  placeBusinesses,
  pulseProgress,
  pulseSchedule,
  snapLabelPos,
  SILO,
  clusterRadius,
  clusterDepth,
  CLUSTER_MAX_R,
  crowdAnchor,
  linkControlPoints,
  ORBIT,
  busiestFamily,
  focusFrame,
  headingTo,
  orbitForScroll,
  orbitPose,
  scrollForFloor,
  floorForHeight,
  smoothDamp,
  wrapAngle,
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
      const { pos } = orbitPose(orbitForScroll(t, 0, ORBIT.el))
      expect(pos.y).toBeGreaterThan(SILO.y[k]!)
    }
  })
})

describe('camera', () => {
  it('holds the same default view as before the orbit', () => {
    for (const t of [0, 0.3, 1]) {
      const { pos, look } = orbitPose(orbitForScroll(t, 0, ORBIT.el))
      expect(pos.x).toBeCloseTo(0)
      expect(pos.y).toBeCloseTo(46 - t * 82)
      expect(pos.z).toBeCloseTo(6)
      expect(look.y).toBeCloseTo(33 - t * 82)
      expect(look.z).toBeCloseTo(0)
    }
  })

  it('wraps a turn the short way round', () => {
    expect(wrapAngle(0.2)).toBeCloseTo(0.2)
    expect(wrapAngle(Math.PI * 2 - 0.2)).toBeCloseTo(-0.2)
    expect(wrapAngle(-Math.PI * 2 + 0.2)).toBeCloseTo(0.2)
    expect(wrapAngle(Math.PI * 7 + 0.1)).toBeCloseTo(-Math.PI + 0.1)
  })

  it('settles on the goal without overshooting, at any frame rate', () => {
    for (const dt of [1 / 120, 1 / 60, 1 / 20]) {
      let value = 0
      let velocity = 0
      let last = 0
      for (let i = 0; i < 5 / dt; i++) {
        ;[value, velocity] = smoothDamp(value, 10, velocity, ORBIT.easeS, dt)
        expect(value).toBeGreaterThanOrEqual(last)
        expect(value).toBeLessThanOrEqual(10)
        last = value
      }
      expect(value).toBeCloseTo(10, 3)
    }
  })

  it('keeps its speed when the goal moves mid-way', () => {
    const [, speed] = smoothDamp(0, 10, 0, ORBIT.easeS, 1 / 60)
    const [value] = smoothDamp(1, 0, speed, ORBIT.easeS, 1 / 60)
    expect(value).toBeGreaterThan(1)
  })

  it('frames a point from the middle of the silo, looking out', () => {
    const p = wedgePoint(2, 3)
    for (const kind of ['business', 'gap', 'floor'] as const) {
      const { pos, look } = orbitPose(focusFrame(p, kind))
      expect(look).toEqual({ x: p.x, y: p.y, z: p.z })
      expect(Math.hypot(pos.x, pos.z)).toBeLessThan(Math.hypot(p.x, p.z))
      expect(pos.y).toBeGreaterThan(p.y)
    }
  })

  it('finds the busiest family on a floor', () => {
    const list = [
      { familyIndex: 1, floorIndex: 4 },
      { familyIndex: 2, floorIndex: 4 },
      { familyIndex: 2, floorIndex: 4 },
      { familyIndex: 3, floorIndex: 1 },
      { familyIndex: 3, floorIndex: 1 },
      { familyIndex: 3, floorIndex: 1 },
    ]
    expect(busiestFamily(list, 4)).toBe(2)
    expect(busiestFamily(list, 0)).toBeNull()
    expect(busiestFamily(list.slice(0, 2), 4)).toBe(1)
  })

  it('faces a floor wedge with its dots inside the frame', () => {
    const fov = 62
    for (let floor = 1; floor < SILO.y.length; floor++) {
      const p = wedgePoint(0, floor)
      const az = headingTo(p)
      const { pos, look } = orbitPose(orbitForScroll(scrollForFloor(floor), az, ORBIT.floorEl))
      const toLook = [look.x - pos.x, look.y - pos.y, look.z - pos.z]
      const toDot = [p.x - pos.x, p.y - pos.y, p.z - pos.z]
      const dot = toLook.reduce((sum, v, i) => sum + v * toDot[i]!, 0)
      const off = Math.acos(dot / (Math.hypot(...toLook) * Math.hypot(...toDot)))
      expect((off * 180) / Math.PI).toBeLessThan(fov / 2)
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

describe('pickLabels', () => {
  const dot = (id: string, x: number, size = 20, w = 100) => ({ id, x, top: 100, size, w, h: 34 })
  const base = {
    candidates: [] as ReturnType<typeof dot>[],
    held: [] as string[],
    since: new Map<string, number>(),
    blocked: [],
    now: 0,
    max: 10,
    minPx: 9,
    stageW: 1000,
    stageH: 700,
  }

  it('gives the same answer on every pass when nothing moves', () => {
    const candidates = [dot('a', 100, 30), dot('b', 150, 25), dot('c', 500, 20)]
    let held: string[] = []
    let since = new Map<string, number>()
    const seen = new Set<string>()
    for (let now = 0; now < 2000; now += 100) {
      const r = pickLabels({ ...base, candidates, held, since, now })
      held = r.ids
      since = r.since
      seen.add([...r.ids].sort().join())
    }
    expect(seen).toEqual(new Set(['a,c']))
  })

  it('stops flipping when a label measures wider than first thought', () => {
    // On main this pair swapped every frame. The real width only ever arrives once.
    const narrow = [dot('a', 100, 30), dot('b', 230, 28, 80)]
    const first = pickLabels({ ...base, candidates: narrow })
    expect(first.ids).toEqual(['a', 'b'])
    const wide = [dot('a', 100, 30), dot('b', 230, 28, 220)]
    let held = first.ids
    for (let now = 100; now < 1000; now += 100) {
      held = pickLabels({ ...base, candidates: wide, held, now }).ids
      expect(held).toEqual(['a'])
    }
  })

  it('holds its picks under small size and position noise', () => {
    let held = pickLabels({ ...base, candidates: [dot('a', 100), dot('b', 300), dot('c', 500)], max: 2 }).ids
    const start = [...held]
    for (let i = 0; i < 200; i++) {
      const n = i % 2 ? 0.4 : -0.4
      const candidates = [dot('a', 100 + n, 20 + n), dot('b', 300 - n, 20 - n), dot('c', 500 + n, 20 + n)]
      held = pickLabels({ ...base, candidates, held, max: 2, now: i * 100 }).ids
    }
    expect(held).toEqual(start)
  })

  it('does not disturb the others when one label leaves', () => {
    const candidates = [dot('a', 100, 30), dot('b', 300, 25), dot('c', 500, 20)]
    const held = pickLabels({ ...base, candidates }).ids
    const r = pickLabels({ ...base, candidates: candidates.slice(1), held })
    expect(r.ids).toEqual(['b', 'c'])
    expect(r.boxes.map((b) => b.l)).toEqual([250, 450])
  })

  it('keeps a shrinking label down to the keep size, and no further', () => {
    const size = (s: number) => [dot('a', 100, s)]
    expect(pickLabels({ ...base, candidates: size(9 * LABEL_KEEP), held: ['a'] }).ids).toEqual(['a'])
    expect(pickLabels({ ...base, candidates: size(9 * LABEL_KEEP) }).ids).toEqual([])
  })

  it('drops a label under a HUD panel', () => {
    const blocked = [{ l: 0, t: 0, r: 200, b: 200 }]
    expect(pickLabels({ ...base, candidates: [dot('a', 100)], held: ['a'], blocked }).ids).toEqual([])
  })

  it('makes a bigger dot wait before it replaces a label', () => {
    const candidates = [dot('a', 100, 20), dot('b', 110, 30)]
    const first = pickLabels({ ...base, candidates, held: ['a'] })
    expect(first.ids).toEqual(['a'])
    expect(first.since.get('b')).toBe(0)
    const early = pickLabels({ ...base, candidates, held: ['a'], since: first.since, now: LABEL_SWAP_MS - 1 })
    expect(early.ids).toEqual(['a'])
    const late = pickLabels({ ...base, candidates, held: ['a'], since: early.since, now: LABEL_SWAP_MS })
    expect(late.ids).toEqual(['b'])
    expect(late.since.size).toBe(0)
  })

  it('never replaces a label for a dot under 1.25x its size', () => {
    const candidates = [dot('a', 100, 20), dot('b', 110, 24)]
    const r = pickLabels({ ...base, candidates, held: ['a'], now: 5000 })
    expect(r.ids).toEqual(['a'])
    expect(r.since.size).toBe(0)
  })

  it('honours the cap, biggest first', () => {
    const candidates = Array.from({ length: 20 }, (_, i) => dot(`d${i}`, i * 120 + 60, 40 - i, 100))
    const r = pickLabels({ ...base, candidates, max: 5, stageW: 3000 })
    expect(r.ids).toEqual(['d0', 'd1', 'd2', 'd3', 'd4'])
  })

  it('checks the clamped box, not the raw one', () => {
    const r = pickLabels({ ...base, candidates: [dot('a', 5)] })
    expect(r.boxes[0]).toMatchObject({ l: 0, r: 100 })
  })
})

describe('snapLabelPos', () => {
  it('lands on whole pixels inside the stage', () => {
    expect(snapLabelPos(10.4, 100, 500, NaN)).toBe(10)
    expect(snapLabelPos(-30, 100, 500, NaN)).toBe(0)
    expect(snapLabelPos(450, 100, 500, NaN)).toBe(400)
  })

  it('ignores anything under a pixel, even across a rounding edge', () => {
    let at = snapLabelPos(100.5, 100, 500, NaN)
    for (let i = 0; i < 100; i++) at = snapLabelPos(100.5 + (i % 2 ? 0.4 : -0.4), 100, 500, at)
    expect(at).toBe(snapLabelPos(100.5, 100, 500, NaN))
  })

  it('follows a real move', () => {
    expect(snapLabelPos(103, 100, 500, 100)).toBe(103)
  })
})

describe('floorForHeight', () => {
  it('names each floor at its own height', () => {
    SILO.y.forEach((y, i) => expect(floorForHeight(y)).toBe(i))
  })

  it('switches floors halfway between them', () => {
    expect(floorForHeight(SILO.y[0]! - 8)).toBe(0)
    expect(floorForHeight(SILO.y[0]! - 9)).toBe(1)
  })

  it('stays on the end floors past the top and bottom', () => {
    expect(floorForHeight(SILO.y[0]! + 40)).toBe(0)
    expect(floorForHeight(SILO.hub.y)).toBe(SILO.y.length - 1)
  })

  it('lands on the floor a pick travels to', () => {
    SILO.y.forEach((_, i) => {
      expect(floorForHeight(orbitForScroll(scrollForFloor(i), 0, 0).y)).toBe(i)
    })
  })
})
