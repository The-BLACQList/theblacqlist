/**
 * The Collective's demo mode (ticket 249).
 *
 * While real activity is thin, the map opens on sample data so a visitor can
 * see what it becomes: about 400 made-up businesses across every business
 * floor, with lines, totals and a new receipt arriving every few seconds.
 *
 * Rules (founder, 2026-11-21):
 * - Opens in Demo while fewer than DEMO_UNTIL_LINKED real businesses have a
 *   line. A Demo / Live switch is always on screen, `?view=demo|live` picks one,
 *   and the visitor's last choice is remembered.
 * - Made-up businesses only. Every demo business has no link (`href: null`), so
 *   nothing on the map can point at a real listing, and nothing is written.
 * - A "Sample Data" badge shows for as long as Demo is on.
 *
 * Pure and seeded: the same sample every visit, and every rule here is tested
 * in tests/collective-demo.test.ts. The businesses go through the same
 * buildSiloBusinesses as live data, so the 1-receipt line and the 5-receipt
 * total apply to the sample too.
 */

import type { BusinessLevel } from '@/lib/listings/levels'
import {
  CATEGORY_FAMILIES,
  FALLBACK_FAMILY_INDEX,
  SILO_FLOORS,
  buildSiloBusinesses,
  businessDisplayName,
  hashString,
  mulberry32,
  type BusinessListingMeta,
  type BusinessNodeRow,
  type SiloBusiness,
} from './silo-layout'

/** Demo opens by itself until this many real businesses have a line. */
export const DEMO_UNTIL_LINKED = 25

export type CollectiveView = 'demo' | 'live'

/** The cookie that remembers a visitor's Demo / Live choice. */
export const VIEW_COOKIE = 'bl_collective_view'
/** Thirty days. */
export const VIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export const SAMPLE_BADGE = 'Sample Data'
export const SAMPLE_NOTE = 'Not real businesses or spending.'
/** The opening title in Demo, in place of the real total. */
export const DEMO_INTRO_LINE = 'See Where Our Money Could Go'

export function parseView(value: unknown): CollectiveView | null {
  return value === 'demo' || value === 'live' ? value : null
}

export interface ViewInput {
  /** `?view=` from the URL. */
  param?: unknown
  /** The remembered choice, from VIEW_COOKIE. */
  stored?: unknown
  /** Real businesses with a line. */
  realLinked: number
  /** The reader has a line of their own, counted or in review. */
  hasOwnLines: boolean
  /** `?you=1`: the reader came to see their own business. */
  focusYou: boolean
}

/**
 * Which data the map opens on. A reader looking for their own line always gets
 * Live, because Demo never holds it. Then the URL, then the remembered choice,
 * then Demo while real activity is thin.
 */
export function pickView({
  param,
  stored,
  realLinked,
  hasOwnLines,
  focusYou,
}: ViewInput): CollectiveView {
  if (focusYou) return 'live'
  const asked = parseView(param) ?? parseView(stored)
  if (asked) return asked
  if (hasOwnLines) return 'live'
  return realLinked < DEMO_UNTIL_LINKED ? 'demo' : 'live'
}

// ─── The sample ──────────────────────────────────────────────────────────────

/** Changing it changes every sample business, so it is fixed. */
const DEMO_SEED = 'collective-demo-249'

/** Roughly how many sample businesses there are. */
export const DEMO_SIZE = 400

/**
 * Share of the sample on each business floor. The lower floors are thinner, as
 * they will be on the real list, but every floor has life.
 */
const FLOOR_SHARE: Record<BusinessLevel, number> = {
  local: 0.46,
  supplier: 0.2,
  maker: 0.2,
  grower: 0.14,
}

/**
 * Family and floor pairs left empty, so the pink gap squares still show what
 * the list is missing. Keys are `${family.key}:${level}`.
 */
const DEMO_GAPS = new Set(['services:grower', 'culture:grower', 'health:supplier'])

const NAME_FIRST = [
  'Amberlane',
  'Bellwether',
  'Bluebird',
  'Brightwater',
  'Cedar Row',
  'Cobalt',
  'Copper Hill',
  'Driftwood',
  'Elmstead',
  'Fernway',
  'Fieldnote',
  'Goldleaf',
  'Harbor Light',
  'Hollis',
  'Ivory Gate',
  'Juniper',
  'Kestrel',
  'Larkspur',
  'Linden',
  'Marigold',
  'Meadowlark',
  'Northstar',
  'Oakmoss',
  'Paloma',
  'Quill',
  'Redbud',
  'Riverside',
  'Saffron',
  'Sable',
  'Sorrel',
  'Sweetgum',
  'Tamarind',
  'Thistle',
  'Umber',
  'Velvet Hour',
  'Willow Bend',
  'Wren',
  'Yarrow',
  'Zinnia',
  'Ashby',
] as const

/** Last words by family, then by floor, so a name reads like its dot. */
const NAME_LAST: Record<string, Record<BusinessLevel, readonly string[]>> = {
  food: {
    local: ['Kitchen', 'Bakehouse', 'Cafe', 'Table', 'Grill', 'Market'],
    supplier: ['Provisions', 'Food Supply', 'Wholesale Produce'],
    maker: ['Sauce Works', 'Creamery', 'Pantry Goods'],
    grower: ['Farm', 'Orchard', 'Gardens', 'Growers'],
  },
  style: {
    local: ['Boutique', 'Salon', 'Barbershop', 'Goods'],
    supplier: ['Beauty Supply', 'Textile Supply', 'Trade Goods'],
    maker: ['Atelier', 'Apothecary', 'Leatherworks', 'Studio'],
    grower: ['Botanicals', 'Cotton Farm', 'Herb Farm'],
  },
  health: {
    local: ['Wellness', 'Family Care', 'Pet Care', 'Pharmacy'],
    supplier: ['Medical Supply'],
    maker: ['Remedies', 'Naturals', 'Skin Lab'],
    grower: ['Herb Gardens', 'Tea Farm'],
  },
  home: {
    local: ['Home Goods', 'Auto Care', 'Hardware', 'Movers'],
    supplier: ['Building Supply', 'Lumber', 'Parts Co.'],
    maker: ['Woodworks', 'Ceramics', 'Furniture Co.'],
    grower: ['Timber', 'Tree Farm', 'Nursery'],
  },
  culture: {
    local: ['Books', 'Gallery', 'Records', 'Events'],
    supplier: ['Print Supply', 'Stage Supply'],
    maker: ['Press', 'Media', 'Sound Studio', 'Pictures'],
    grower: ['Fiber Farm'],
  },
  services: {
    local: ['Tax Services', 'Tutoring', 'Consulting', 'Law Office'],
    supplier: ['Staffing', 'Office Supply', 'Logistics'],
    maker: ['Software', 'Design Co.', 'Print Works'],
    grower: ['Seed Co.'],
  },
}

export interface DemoCollective {
  businesses: SiloBusiness[]
  totalSpentCents: number
  receiptCount: number
  /** Businesses buying from businesses, down the floors (see buildDemoSupply). */
  supply: DemoSupplyLink[]
}

/** Business-floor levels, top to bottom. */
const DEMO_LEVELS: readonly BusinessLevel[] = ['local', 'supplier', 'maker', 'grower']

/** A rough lognormal: most receipts are small, a few are large. */
function receiptCents(rnd: () => number): number {
  const dollars = Math.exp(2.6 + rnd() * 1.6 + rnd() * 1.2)
  return Math.round(Math.min(900, Math.max(8, dollars)) * 100)
}

/**
 * The seeded sample. About 55% of businesses have a line, and about half of
 * those clear the total bar, the same mix the live map is heading for.
 */
export function buildDemoCollective(): DemoCollective {
  const rnd = mulberry32(hashString(DEMO_SEED))
  const listings: Record<string, BusinessListingMeta> = {}
  const nodes: BusinessNodeRow[] = []
  const usedNames = new Set<string>()
  let totalSpentCents = 0
  let receiptCount = 0
  let n = 0

  for (const level of DEMO_LEVELS) {
    const onFloor = Math.round(DEMO_SIZE * FLOOR_SHARE[level])
    const families = CATEGORY_FAMILIES.filter((f) => !DEMO_GAPS.has(`${f.key}:${level}`))
    // Uneven groups, so wedges differ in size the way real ones do.
    const weights = families.map(() => 0.5 + rnd())
    const sum = weights.reduce((a, b) => a + b, 0)

    families.forEach((family, fi) => {
      const count = Math.max(2, Math.round((onFloor * weights[fi]!) / sum))
      const lasts = NAME_LAST[family.key]?.[level] ?? ['Co.']
      for (let k = 0; k < count; k++) {
        const id = `demo-${String(n++).padStart(3, '0')}`
        let name = ''
        for (let tries = 0; tries < 6 && (!name || usedNames.has(name)); tries++) {
          const first = NAME_FIRST[Math.floor(rnd() * NAME_FIRST.length)]!
          const last = lasts[Math.floor(rnd() * lasts.length)]!
          name = `${first} ${last}`
        }
        if (usedNames.has(name)) name = `${name} ${k + 2}`
        usedNames.add(name)

        listings[id] = {
          name,
          // Never a link: a demo business has no page to open.
          href: null,
          level,
          categorySlug: family.slugs[0] ?? null,
        }

        const roll = rnd()
        if (roll < 0.55) {
          // Half of the linked ones clear the total bar (5 receipts).
          const receipts = roll < 0.28 ? 5 + Math.floor(rnd() * 40) : 1 + Math.floor(rnd() * 4)
          let cents = 0
          for (let r = 0; r < receipts; r++) cents += receiptCents(rnd)
          nodes.push({ entity_id: id, total_amount_cents: cents, transaction_count: receipts })
          totalSpentCents += cents
          receiptCount += receipts
        }
      }
    })
  }

  const businesses = buildSiloBusinesses({ nodes, listings })
  return {
    businesses,
    totalSpentCents,
    receiptCount,
    supply: buildDemoSupply(businesses),
  }
}

// ─── Businesses buying from businesses ──────────────────────────────────────

/**
 * One sample purchase between two businesses: `from` buys from `to`, so money
 * moves from `from` to `to`. Demo only: the live map doesn't track these yet,
 * which is why its lower floors say "Not tracked yet".
 */
export interface DemoSupplyLink {
  from: string
  to: string
  /** The two businesses are in different families, like a cafe buying furniture. */
  cross: boolean
  /** A service the buyer pays for (taxes, staffing, design), not goods it sells on. */
  service: boolean
}

/** Most buyers stay in their own family; the rest cross. */
const SUPPLY_SAME_FAMILY = 0.68
/** Some buyers have two suppliers on the floor below. */
const SUPPLY_SECOND = 0.3
/** Share of buyers that also pay a services business. */
const SUPPLY_SERVICE = 0.16

/**
 * Where a family's businesses buy when they cross, by family key: a cafe buys
 * furniture and printed menus, a salon buys from an apothecary, a woodshop
 * buys upholstery cloth.
 */
const CROSS_BUYS: Record<string, readonly string[]> = {
  food: ['home', 'culture'],
  style: ['health'],
  health: ['style', 'food'],
  home: ['style'],
  culture: ['home', 'food'],
  services: ['home', 'culture'],
}

const familyKeyOf = (b: SiloBusiness) =>
  (CATEGORY_FAMILIES[b.familyIndex] ?? CATEGORY_FAMILIES[FALLBACK_FAMILY_INDEX]!).key

/**
 * Seeded purchases between sample businesses. Shops with a line buy from
 * suppliers, suppliers from makers, makers from growers: every business that
 * sells to one above it buys from the floor below in turn, so a dollar can be
 * followed down the tower. About a third cross into another family, and some
 * buyers also pay a services business (a tax office, staffing, design).
 */
export function buildDemoSupply(businesses: readonly SiloBusiness[]): DemoSupplyLink[] {
  const rnd = mulberry32(hashString(`${DEMO_SEED}:supply`))
  const byPlace = new Map<string, SiloBusiness[]>()
  for (const b of businesses) {
    const key = `${b.floorIndex}:${familyKeyOf(b)}`
    const list = byPlace.get(key)
    if (list) list.push(b)
    else byPlace.set(key, [b])
  }
  const services = businesses.filter(
    (b) => familyKeyOf(b) === 'services' && (b.level === 'local' || b.level === 'supplier')
  )
  const buying = new Set(businesses.filter((b) => b.linked).map((b) => b.id))
  const out: DemoSupplyLink[] = []
  const lastBuyingFloor = SILO_FLOORS.length - 2

  for (let floor = 1; floor <= lastBuyingFloor; floor++) {
    for (const b of businesses) {
      if (b.floorIndex !== floor || !buying.has(b.id)) continue
      const own = familyKeyOf(b)
      const taken = new Set<string>()
      const n = rnd() < SUPPLY_SECOND ? 2 : 1
      for (let k = 0; k < n; k++) {
        const stay = rnd() < SUPPLY_SAME_FAMILY
        const crosses = CROSS_BUYS[own] ?? []
        const first = stay ? own : crosses[Math.floor(rnd() * crosses.length)]
        // A family with no one on the floor below (a gap) buys across instead.
        const order = [first, ...crosses, own].filter((f): f is string => !!f)
        const pool = order.map((f) => byPlace.get(`${floor + 1}:${f}`) ?? []).find((l) => l.length)
        if (!pool) continue
        const seller = pool[Math.floor(rnd() * pool.length)]!
        if (taken.has(seller.id)) continue
        taken.add(seller.id)
        buying.add(seller.id)
        out.push({
          from: b.id,
          to: seller.id,
          cross: seller.familyIndex !== b.familyIndex,
          service: false,
        })
      }
      if (own !== 'services' && services.length > 0 && rnd() < SUPPLY_SERVICE) {
        const pro = services[Math.floor(rnd() * services.length)]!
        out.push({ from: b.id, to: pro.id, cross: true, service: true })
      }
    }
  }
  return out
}

// ─── Follow a Dollar ─────────────────────────────────────────────────────────

/** A trail never runs longer than this (workshop round 6). */
export const TRAIL_MAX_STOPS = 5

/**
 * One sample shopper's dollar, as business ids: the shop it was spent at, then
 * down the floors along the supply lines, ending at a grower or wherever the
 * chain stops. `n` picks which dollar, so Follow Another Dollar shows a new one.
 * Services are left out: the trail follows the goods. A trail crosses into
 * another family at most once, so it reads as one chain, not a tour.
 */
export function demoDollarTrail(
  businesses: readonly SiloBusiness[],
  supply: readonly DemoSupplyLink[],
  n: number
): string[] {
  const byId = new Map(businesses.map((b) => [b.id, b]))
  const sells = new Map<string, string[]>()
  for (const l of supply) {
    if (l.service) continue
    const list = sells.get(l.from)
    if (list) list.push(l.to)
    else sells.set(l.from, [l.to])
  }
  // How many more stops a dollar can make from each business.
  const reach = new Map<string, number>()
  const depth = (id: string): number => {
    const known = reach.get(id)
    if (known !== undefined) return known
    reach.set(id, 0)
    const d = 1 + Math.max(0, ...(sells.get(id) ?? []).map(depth))
    reach.set(id, d)
    return d
  }
  // A services shop (a tutor, a law office) has no goods to follow.
  const shops = businesses.filter(
    (b) => b.linked && b.level === 'local' && familyKeyOf(b) !== 'services' && sells.has(b.id)
  )
  if (shops.length === 0) return []
  const longest = Math.max(...shops.map((b) => depth(b.id)))
  const starts = shops.filter((b) => depth(b.id) === longest)

  const rnd = mulberry32(hashString(`${DEMO_SEED}:trail:${n}`))
  const trail = [starts[Math.floor(rnd() * starts.length)]!.id]
  while (trail.length < TRAIL_MAX_STOPS) {
    const next = (sells.get(trail[trail.length - 1]!) ?? []).filter((id) => !trail.includes(id))
    if (next.length === 0) break
    const best = Math.max(...next.map(depth))
    const deepest = next.filter((id) => depth(id) === best)
    const here = byId.get(trail[trail.length - 1]!)
    const crossed = trail.some(
      (id, i) => i > 0 && byId.get(id)?.familyIndex !== byId.get(trail[i - 1]!)?.familyIndex
    )
    const same = deepest.filter((id) => byId.get(id)?.familyIndex === here?.familyIndex)
    const pick = crossed && same.length > 0 ? same : deepest
    trail.push(pick[Math.floor(rnd() * pick.length)]!)
  }
  return trail.filter((id) => byId.has(id))
}

export interface TrailStop {
  name: string
  /** "Food and farm · Shops" */
  where: string
  /** What happens to the dollar here, in one or two plain sentences. No amounts. */
  text: string
  /** This stop is in a different family from the one before it. */
  crossed: boolean
}

/** Ends a sentence, without doubling the stop on a name like "Parts Co." */
const stop = (s: string) => (s.endsWith('.') ? s : `${s}.`)

const SELL_VERB: Record<string, (buyer: string, seller: string) => string> = {
  supplier: (buyer, seller) => stop(`${buyer} restocks from ${seller}`),
  maker: (buyer, seller) => stop(`${buyer} buys goods made by ${seller}`),
  grower: (buyer, seller) => `${buyer} buys what ${seller} grows.`,
}

/** The words for each stop on a trail. Plain sentences, never an amount. */
export function trailStops(
  businesses: readonly SiloBusiness[],
  trail: readonly string[]
): TrailStop[] {
  const byId = new Map(businesses.map((b) => [b.id, b]))
  const stops = trail.map((id) => byId.get(id)).filter((b): b is SiloBusiness => !!b)
  return stops.map((b, i) => {
    const fam = CATEGORY_FAMILIES[b.familyIndex] ?? CATEGORY_FAMILIES[FALLBACK_FAMILY_INDEX]!
    const floor = SILO_FLOORS[b.floorIndex]
    const name = businessDisplayName(b)
    const prev = i > 0 ? stops[i - 1] : undefined
    const crossed = !!prev && prev.familyIndex !== b.familyIndex
    const last = i === stops.length - 1
    let text = prev
      ? `${(SELL_VERB[b.level] ?? SELL_VERB.supplier!)(businessDisplayName(prev), name)} Part of the dollar moves with it.`
      : stop(`A shopper spends a dollar at ${name}`)
    if (crossed) {
      const from = CATEGORY_FAMILIES[prev.familyIndex] ?? CATEGORY_FAMILIES[FALLBACK_FAMILY_INDEX]!
      text += ` This crosses from ${from.noun} into ${fam.noun}.`
    }
    if (last && stops.length > 1) {
      text +=
        b.level === 'grower'
          ? ' The trail ends where the goods start: with the people who grow them.'
          : ' The trail ends here for now: no one below it on the list yet.'
    }
    return { name, where: `${fam.name} · ${floor?.short ?? ''}`, text, crossed }
  })
}

// ─── Arrivals ────────────────────────────────────────────────────────────────

/**
 * A new sample receipt every few seconds: its line grows from the family's
 * crowd to the business, a pulse rides it in, and it fades back to the map.
 */
export const DEMO_ARRIVAL = {
  everyMs: 3600,
  growMs: 1500,
} as const

export interface DemoArrival {
  /** Which arrival this is, counting up from the epoch. */
  seq: number
  /** The business's index in the list the caller passed. */
  index: number
  /** 0 to 1: how much of the line has grown. */
  grow: number
  /** 1 while growing, then fading to 0 before the next one. */
  glow: number
}

/** Which linked business an arrival lands at. Stable for a given `seq`. */
export function demoArrivalIndex(seq: number, count: number): number {
  if (count <= 0) return -1
  return Math.floor(mulberry32(hashString(`arrive:${seq}`))() * count)
}

/** The arrival in flight at `nowMs`, or null with nothing to land on. */
export function demoArrivalAt(nowMs: number, count: number): DemoArrival | null {
  if (count <= 0) return null
  const seq = Math.floor(nowMs / DEMO_ARRIVAL.everyMs)
  const phase = nowMs - seq * DEMO_ARRIVAL.everyMs
  const grow = Math.min(1, phase / DEMO_ARRIVAL.growMs)
  const fade = DEMO_ARRIVAL.everyMs - DEMO_ARRIVAL.growMs
  const glow =
    phase < DEMO_ARRIVAL.growMs ? 1 : Math.max(0, 1 - (phase - DEMO_ARRIVAL.growMs) / fade)
  return { seq, index: demoArrivalIndex(seq, count), grow, glow }
}

/** The last `n` arrivals up to `seq`, newest first, for the ticker. */
export function recentDemoArrivals(seq: number, count: number, n = 3): number[] {
  const out: number[] = []
  for (let s = seq; s > seq - n; s--) out.push(demoArrivalIndex(s, count))
  return out
}
