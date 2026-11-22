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
  buildSiloBusinesses,
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

  return {
    businesses: buildSiloBusinesses({ nodes, listings }),
    totalSpentCents,
    receiptCount,
  }
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
