/**
 * The Collective map's layout data (tickets 167 and 171).
 *
 * Pure functions that turn the community spend rows into what the map draws:
 * the five floors, the business nodes, their colors and positions, and the
 * pulse schedule. No React and no Three.js here, so every rule the page
 * promises is unit-tested in one place (tests/silo-layout.test.ts).
 *
 * Honest to the data (Collective workshop rules, spec §20 round 17):
 * - Only the first stop is tracked: shopper to business. The Shoppers floor
 *   shows the total spent. Every floor past it says "Not tracked yet" and
 *   never shows an invented amount.
 * - Shoppers are one group. No shopper is ever a dot.
 * - Every published business is a node, so the spread of businesses shows
 *   before any receipt does (ticket 171). A business is `linked`, with a
 *   connection, from LINK_MIN_TRANSACTIONS (1) counted receipt (ticket 250).
 *   Its total and count only show once AGGREGATE_MIN_TRANSACTIONS receipts
 *   are behind it (`figuresShown`). Below that, every linked dot is the same
 *   size, so nothing drawn points back at one shopper's amount.
 * - Names show for every business (founder, 2026-10-31, ticket 171b): a
 *   published listing is already public.
 * - A gap is a category family with no business yet on a business floor. It
 *   is drawn as a pink dashed square and never claims dollars leave.
 */

import {
  AGGREGATE_MIN_TRANSACTIONS,
  meetsAggregateThreshold,
  meetsLinkThreshold,
} from './aggregate-privacy'
import { BUSINESS_LEVELS, isBusinessLevel, type BusinessLevel } from '@/lib/listings/levels'

// ─── Floors ──────────────────────────────────────────────────────────────────

export type FloorKey = 'shoppers' | BusinessLevel

export interface SiloFloorDef {
  key: FloorKey
  /** One-word label on the gauge. */
  short: string
  /** Singular noun for a business on this floor ("a food shop"). */
  one: string
}

/** Top to bottom: where money starts, then each level it could reach next. */
export const SILO_FLOORS: readonly SiloFloorDef[] = [
  { key: 'shoppers', short: 'Shoppers', one: 'shopper' },
  { key: 'local', short: 'Shops', one: 'shop' },
  { key: 'supplier', short: 'Suppliers', one: 'supplier' },
  { key: 'maker', short: 'Makers', one: 'maker' },
  { key: 'grower', short: 'Growers', one: 'grower' },
]

export interface SiloFloor extends SiloFloorDef {
  index: number
  /** True only for the floor we have real numbers for. */
  tracked: boolean
  /** Cents spent, for the tracked floor. Null everywhere else, never zero. */
  amountCents: number | null
  /** Share of the gauge bar, 0 to 1. */
  barShare: number
}

export const NOT_TRACKED_TEXT = 'Not tracked yet'

export function buildFloors(totalSpentCents: number): SiloFloor[] {
  return SILO_FLOORS.map((def, index) => {
    const tracked = index === 0
    return {
      ...def,
      index,
      tracked,
      amountCents: tracked ? Math.max(0, totalSpentCents) : null,
      barShare: tracked && totalSpentCents > 0 ? 1 : 0,
    }
  })
}

export function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

/** Short words that sit next to a floor bar. */
export function floorValueText(floor: SiloFloor): string {
  if (!floor.tracked || floor.amountCents === null) return NOT_TRACKED_TEXT
  return `${formatDollars(floor.amountCents)} spent`
}

/** What a screen reader hears for a floor, so the bar never relies on color. */
export function floorSpokenLabel(floor: SiloFloor, businessCount: number): string {
  if (!floor.tracked || floor.amountCents === null) {
    const dots =
      floor.key === 'shoppers'
        ? ''
        : `, ${businessCount} ${businessCount === 1 ? 'business' : 'businesses'} on this floor`
    return `${floor.short}: money passed on here is not tracked yet${dots}`
  }
  return `${floor.short}: ${formatDollars(floor.amountCents)} spent with businesses on the list`
}

/** The card's line about the money. Totals only show past the receipt gate. */
export function businessFiguresText(
  b: Pick<SiloBusiness, 'linked' | 'figuresShown' | 'amountCents' | 'transactionCount'>
): string {
  if (!b.linked) return 'No receipts counted here yet.'
  if (!b.figuresShown) {
    return `Receipts are counted here. The total shows once ${AGGREGATE_MIN_TRANSACTIONS} are in.`
  }
  const receipts = b.transactionCount === 1 ? 'receipt' : 'receipts'
  return `${formatDollars(b.amountCents)} spent here, from ${b.transactionCount} ${receipts}.`
}

/** Floor index for a business level. Unknown levels sit with the shops. */
export function floorIndexForLevel(level: string | null | undefined): number {
  const key: BusinessLevel = isBusinessLevel(level) ? level : 'local'
  return SILO_FLOORS.findIndex((f) => f.key === key)
}

// ─── Category families (the default color) ───────────────────────────────────

export interface CategoryFamily {
  key: string
  /** One word for the legend chip. */
  short: string
  /** Full name for tooltips and screen readers. */
  name: string
  /** Lower case words for "a food shop". */
  noun: string
  color: string
  slugs: readonly string[]
}

export const CATEGORY_FAMILIES: readonly CategoryFamily[] = [
  {
    key: 'food',
    short: 'Food',
    name: 'Food and farm',
    noun: 'food',
    color: '#86C95A',
    slugs: ['food-dining', 'agriculture-sustainability'],
  },
  {
    key: 'style',
    short: 'Style',
    name: 'Style and beauty',
    noun: 'style',
    color: '#C08BFF',
    slugs: ['beauty-grooming', 'fashion-apparel', 'retail-gifts'],
  },
  {
    key: 'health',
    short: 'Health',
    name: 'Health and care',
    noun: 'health',
    color: '#43C9B8',
    slugs: ['wellness-health', 'healthcare', 'pet-services', 'childcare-family'],
  },
  {
    key: 'home',
    short: 'Home',
    name: 'Home, trades and travel',
    noun: 'home and trades',
    color: '#F08A4B',
    slugs: ['home-living', 'construction-trades', 'automotive', 'travel-transportation'],
  },
  {
    key: 'culture',
    short: 'Culture',
    name: 'Culture and events',
    noun: 'culture',
    color: '#F25F7A',
    slugs: [
      'events-entertainment',
      'arts-culture',
      'creative-media',
      'books-publishing',
      'photography-videography',
      'spiritual-community',
      'creators-influencers',
    ],
  },
  {
    key: 'services',
    short: 'Services',
    name: 'Business services',
    noun: 'services',
    color: '#E9D8A6',
    slugs: [
      'professional-services',
      'legal-financial',
      'technology',
      'education-tutoring',
      'social-media-marketing',
      'staffing-workforce',
    ],
  },
]

/** Anything we can't place lands in Services rather than inventing a family. */
export const FALLBACK_FAMILY_INDEX = CATEGORY_FAMILIES.length - 1

export function familyIndexForCategorySlug(slug: string | null | undefined): number {
  if (!slug) return FALLBACK_FAMILY_INDEX
  const i = CATEGORY_FAMILIES.findIndex((f) => f.slugs.includes(slug))
  return i === -1 ? FALLBACK_FAMILY_INDEX : i
}

export const LEVEL_COLORS: Record<BusinessLevel, string> = {
  local: '#FFD867',
  supplier: '#F08A4B',
  maker: '#C08BFF',
  grower: '#86C95A',
}

/** Brand gold (ticket 246), the same #C4A065 the rest of the site uses. */
export const GOLD = '#C4A065'
export const GOLD_BRIGHT = '#FFD867'

export type ColorBy = 'category' | 'level' | 'gold'

// ─── Businesses ──────────────────────────────────────────────────────────────

/** One business_node row from flow_nodes. */
export interface BusinessNodeRow {
  entity_id: string
  total_amount_cents: number
  transaction_count: number
}

/** The listing columns the map needs. */
export interface BusinessListingMeta {
  name: string
  href: string | null
  level: string | null
  /** Top-level category slug. */
  categorySlug: string | null
}

export interface SiloBusiness {
  id: string
  /** The listing's public name. Null only if the listing has none. */
  name: string | null
  href: string | null
  level: BusinessLevel
  floorIndex: number
  familyIndex: number
  /**
   * True once a counted receipt is behind this business, so it shows a
   * connection (ticket 250: from LINK_MIN_TRANSACTIONS). False businesses are
   * still drawn, with no line and no amount.
   */
  linked: boolean
  /**
   * True once AGGREGATE_MIN_TRANSACTIONS receipts are behind it, so its total
   * and count can show. Always false when `linked` is false.
   */
  figuresShown: boolean
  /** Zero unless figuresShown. */
  transactionCount: number
  /** Zero unless figuresShown. Kept for the ordering, sizing and list view. */
  amountCents: number
  optedIn: boolean
  isYou: boolean
  /**
   * The reader has a receipt here that is still in review (ticket 250). Only
   * ever set for that reader's own page; it draws their dashed pending line.
   */
  youPending: boolean
}

export interface BuildBusinessesInput {
  nodes: readonly BusinessNodeRow[]
  /** Every published business, keyed by listing id. Each one becomes a node. */
  listings: Readonly<Record<string, BusinessListingMeta>>
  /** Kept for the opt-in column if one ever lands. Names show either way. */
  isNameOptedIn?: (listingId: string) => boolean
  /** Listing ids the signed-in reader has a counted (approved) receipt at. */
  youIds?: ReadonlySet<string>
  /** Listing ids the signed-in reader has a receipt in review at (ticket 250). */
  youPendingIds?: ReadonlySet<string>
}

export function buildSiloBusinesses({
  nodes,
  listings,
  isNameOptedIn,
  youIds,
  youPendingIds,
}: BuildBusinessesInput): SiloBusiness[] {
  const counted = new Map<string, BusinessNodeRow>()
  for (const n of nodes) if (meetsLinkThreshold(n)) counted.set(n.entity_id, n)

  return Object.entries(listings)
    .map(([id, meta]) => {
      const node = counted.get(id)
      const figuresShown = node !== undefined && meetsAggregateThreshold(node)
      const optedIn = isNameOptedIn?.(id) ?? false
      const isYou = youIds?.has(id) ?? false
      const level: BusinessLevel = isBusinessLevel(meta.level) ? meta.level : 'local'
      return {
        id,
        // A published listing's name is already public (founder, 2026-10-31).
        name: meta.name || null,
        href: meta.href,
        level,
        floorIndex: floorIndexForLevel(level),
        familyIndex: familyIndexForCategorySlug(meta.categorySlug),
        linked: node !== undefined,
        figuresShown,
        // Under the aggregate bar, a total could point back at one shopper, so
        // none is kept: not the amount, not the count, not even the order.
        transactionCount: figuresShown ? node.transaction_count : 0,
        amountCents: figuresShown ? node.total_amount_cents : 0,
        optedIn,
        isYou,
        // A receipt already counted draws the solid line, never the dashed one.
        youPending: !isYou && (youPendingIds?.has(id) ?? false),
      }
    })
    .sort(
      (a, b) =>
        Number(b.linked) - Number(a.linked) ||
        Number(b.figuresShown) - Number(a.figuresShown) ||
        b.amountCents - a.amountCents ||
        a.id.localeCompare(b.id)
    )
}

/** "A food shop" or "An x": the article follows the first letter of the words. */
export function anonymousBusinessLabel(
  b: Pick<SiloBusiness, 'familyIndex' | 'floorIndex'>,
  capital = true
): string {
  const fam = CATEGORY_FAMILIES[b.familyIndex] ?? CATEGORY_FAMILIES[FALLBACK_FAMILY_INDEX]!
  const floor = SILO_FLOORS[b.floorIndex] ?? SILO_FLOORS[1]!
  const words = `${fam.noun} ${floor.one}`
  const an = /^[aeiou]/i.test(words)
  const article = capital ? (an ? 'An' : 'A') : an ? 'an' : 'a'
  return `${article} ${words}`
}

/** The label a reader sees for a business: its name, or its kind if it has none. */
export function businessDisplayName(b: SiloBusiness): string {
  return b.name ?? anonymousBusinessLabel(b)
}

export function colorForBusiness(b: SiloBusiness, colorBy: ColorBy): string {
  if (b.isYou) return GOLD_BRIGHT
  if (colorBy === 'gold') return GOLD
  if (colorBy === 'level') return LEVEL_COLORS[b.level]
  return (CATEGORY_FAMILIES[b.familyIndex] ?? CATEGORY_FAMILIES[FALLBACK_FAMILY_INDEX]!).color
}

/** Floors that have at least one business on them, for the gauge's spoken label. */
export function businessesPerFloor(businesses: readonly SiloBusiness[]): number[] {
  const counts = SILO_FLOORS.map(() => 0)
  for (const b of businesses) counts[b.floorIndex] = (counts[b.floorIndex] ?? 0) + 1
  return counts
}

// ─── Gaps (round 17's pink squares) ──────────────────────────────────────────

export interface SiloGap {
  familyIndex: number
  /** 1 to 4: a business floor. Shoppers never have a gap. */
  floorIndex: number
}

/**
 * Every (family, business floor) wedge with no business in it yet. Shown as a
 * pink dashed square: a kind of business the list doesn't have on that floor.
 */
export function siloGaps(businesses: readonly SiloBusiness[]): SiloGap[] {
  const filled = new Set(businesses.map((b) => `${b.familyIndex}:${b.floorIndex}`))
  const gaps: SiloGap[] = []
  for (let k = 1; k < SILO_FLOORS.length; k++) {
    for (let f = 0; f < CATEGORY_FAMILIES.length; f++) {
      if (!filled.has(`${f}:${k}`)) gaps.push({ familyIndex: f, floorIndex: k })
    }
  }
  return gaps
}

/** Gaps per floor, Shoppers first (always zero), for the gauge badges. */
export function gapsPerFloor(gaps: readonly SiloGap[]): number[] {
  const counts = SILO_FLOORS.map(() => 0)
  for (const g of gaps) counts[g.floorIndex] = (counts[g.floorIndex] ?? 0) + 1
  return counts
}

/** "No food growers on the list yet": honest, and never says money leaves. */
export function gapLabel(g: SiloGap): string {
  const fam = CATEGORY_FAMILIES[g.familyIndex] ?? CATEGORY_FAMILIES[FALLBACK_FAMILY_INDEX]!
  const floor = SILO_FLOORS[g.floorIndex] ?? SILO_FLOORS[1]!
  return `No ${fam.noun} ${floor.short.toLowerCase()} on the list yet`
}

/**
 * Kinds of business that would fill each gap, by family key then floor
 * (ticket 173). Written by hand: a category's allowed levels come from its
 * parent, so a raw list would put barbershops on the Suppliers floor. An empty
 * list means the family rarely sits on that floor.
 */
export const GAP_KINDS: Record<string, Record<BusinessLevel, readonly string[]>> = {
  food: {
    local: [
      'Restaurants',
      'Cafes and coffee shops',
      'Bakeries',
      'Food trucks',
      'Caterers',
      'Grocery and corner stores',
    ],
    supplier: [
      'Food distributors',
      'Produce wholesalers',
      'Restaurant supply stores',
      'Meat and seafood wholesalers',
      'Beverage distributors',
    ],
    maker: [
      'Sauce and seasoning makers',
      'Coffee roasters',
      'Packaged snack brands',
      'Breweries, wineries and distilleries',
      'Jam and preserve makers',
    ],
    grower: [
      'Farms and farm stands',
      'Urban farms and community gardens',
      'Orchards',
      'Livestock and poultry farms',
      'Beekeepers and honey farms',
    ],
  },
  style: {
    local: [
      'Hair salons',
      'Barbershops',
      'Nail studios',
      'Clothing boutiques',
      'Gift shops',
      'Jewelry stores',
    ],
    supplier: [
      'Beauty supply stores',
      'Wig and hair distributors',
      'Fabric and textile wholesalers',
      'Wholesale apparel',
      'Packaging and display suppliers',
    ],
    maker: [
      'Clothing designers',
      'Skin and hair care brands',
      'Jewelry makers',
      'Handbag and leather makers',
      'Screen printers',
    ],
    grower: ['Cotton and fiber farms', 'Shea and botanical growers', 'Flower farms'],
  },
  health: {
    local: [
      'Clinics and doctors',
      'Dentists',
      'Therapists and counselors',
      'Pharmacies',
      'Gyms and fitness studios',
      'Pet groomers',
      'Childcare centers',
    ],
    supplier: [
      'Medical supply companies',
      'Fitness equipment dealers',
      'Pet food distributors',
      'Wellness product wholesalers',
    ],
    maker: [
      'Herbal and wellness brands',
      'Natural soap and body care',
      'Supplement makers',
      'Pet treat makers',
    ],
    grower: ['Herb and tea growers', 'Medicinal plant farms', 'Mushroom farms'],
  },
  home: {
    local: [
      'Contractors',
      'Electricians and plumbers',
      'Furniture and decor stores',
      'Auto repair shops',
      'Movers',
      'Cleaning services',
      'Travel agencies',
    ],
    supplier: [
      'Building supply stores',
      'Lumber yards',
      'Auto parts dealers',
      'Hardware wholesalers',
      'Flooring and tile suppliers',
    ],
    maker: [
      'Furniture makers',
      'Carpentry and woodworking shops',
      'Cabinet makers',
      'Candle and home fragrance makers',
      'Metal fabricators',
    ],
    grower: ['Plant nurseries', 'Tree and timber farms', 'Sod and landscape growers'],
  },
  culture: {
    local: [
      'Galleries',
      'Bookstores',
      'Event venues',
      'Photographers',
      'DJs and performers',
      'Dance and music studios',
    ],
    supplier: [
      'Art supply stores',
      'Event rental companies',
      'Sound and lighting rentals',
      'Book distributors',
    ],
    maker: [
      'Artists and illustrators',
      'Authors and publishers',
      'Filmmakers and studios',
      'Musicians and record labels',
      'Podcast studios',
    ],
    grower: ['Flower farms that grow for events'],
  },
  services: {
    local: [
      'Accountants and bookkeepers',
      'Law offices',
      'Tutors and test prep',
      'Marketing agencies',
      'IT support',
      'Staffing agencies',
    ],
    supplier: [
      'Office supply dealers',
      'Commercial printers',
      'Payroll and HR providers',
      'Business software resellers',
    ],
    maker: ['Software and app studios', 'Design studios', 'Course and curriculum makers'],
    grower: [],
  },
}

/** The kinds of business that would fill a gap, or none if the family rarely sits there. */
export function gapKinds(g: SiloGap): readonly string[] {
  const fam = CATEGORY_FAMILIES[g.familyIndex] ?? CATEGORY_FAMILIES[FALLBACK_FAMILY_INDEX]!
  const key = SILO_FLOORS[g.floorIndex]?.key
  if (!key || key === 'shoppers') return []
  return GAP_KINDS[fam.key]?.[key] ?? []
}

// ─── Positions ───────────────────────────────────────────────────────────────

/** Small seeded random so the map looks the same on every visit. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Ticket 246: the Glass Tower (picked 2026-11-21), one lit tower with a glass
 * plate per floor. Floors stack top to bottom (Shoppers up top), and each
 * category family owns one slice of every floor, turning a little floor by
 * floor so the groups spiral down. The glowing core sits under the last floor.
 * All in scene units, kept together in one shape.
 */
export interface SiloShape {
  /** Plate radius: the glass wall. */
  R: number
  /** Where the middle of a family's slice sits: cluster centers and gap squares. */
  rA: number
  /** Smallest cluster radius. */
  cr: number
  /** Largest cluster radius. */
  clusterMax: number
  /** Cluster radius per square root of its businesses: the room between dots. */
  clusterGrow: number
  /** Shopper crowd radius on the top floor. */
  crowdR: number
  /** How far the shopper crowds sit from the middle. */
  crowdA: number
  /** How far each floor turns, in radians. */
  twist: number
  /** Floor heights, Shoppers first. */
  y: readonly number[]
  hub: Point3
  hubR: number
  /** Glass reaches this far above the top floor and below the last one. */
  shellPad: number
  /** Camera distance for the view inside. */
  orbitR: number
  /** Camera distance for the whole tower from outside. */
  zoomR: number
  /** Fog inside, and at the whole view. */
  fogNear: number
  fogFar: number
}

/** The Glass Tower. Wide enough that a busy wedge has room between its dots. */
export const SILO: SiloShape = {
  R: 56,
  rA: 40,
  cr: 5.5,
  clusterMax: 14,
  clusterGrow: 1.4,
  crowdR: 11,
  crowdA: 40,
  twist: 0.32,
  /** 40 apart, so each plate reads as its own storey. */
  y: [80, 40, 0, -40, -80],
  hub: { x: 0, y: -112, z: 0 },
  hubR: 5.5,
  shellPad: 14,
  orbitR: 46,
  zoomR: 250,
  fogNear: 0.0034,
  fogFar: 0.0009,
}

/** How high a business sits above its plate, so the disc never cuts the glass. */
export const DOT_LIFT = 0.9

export interface Point3 {
  x: number
  y: number
  z: number
}

/** Angle of a family's slice on a floor. */
export function wedgeAngle(familyIndex: number, floorIndex: number, shape = SILO): number {
  return (familyIndex / CATEGORY_FAMILIES.length) * Math.PI * 2 + floorIndex * shape.twist
}

/**
 * A point near a slice's middle: `u` across the slice, `v` up, `w` in toward
 * the middle of the floor.
 */
export function wedgePoint(
  familyIndex: number,
  floorIndex: number,
  u = 0,
  v = 0,
  w = 0,
  shape = SILO
): Point3 {
  const r = shape.rA - w
  const a = wedgeAngle(familyIndex, floorIndex, shape)
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: r * c - u * s, y: (shape.y[floorIndex] ?? 0) + v, z: r * s + u * c }
}

/** The tower's largest cluster: on its plate, clear of the core column and the glass. */
export const CLUSTER_MAX_R = SILO.clusterMax

/** A cluster is this much wider along the wall than it is deep. */
export const CLUSTER_WIDE = 1.3

/** Cluster radius grows with the crowd so busy wedges don't pile up. */
export function clusterRadius(count: number, shape = SILO): number {
  return Math.max(shape.cr, Math.min(shape.clusterMax, shape.clusterGrow * Math.sqrt(count)))
}

/** About how far apart neighbours sit in a group of `count`, in scene units. */
export function clusterSpacing(count: number, shape = SILO): number {
  const n = Math.max(1, count)
  return clusterRadius(n, shape) * Math.sqrt((Math.PI * CLUSTER_WIDE) / n)
}

export interface PlacedBusiness extends Point3 {
  id: string
}

const GOLDEN_ANGLE = 2.39996

/**
 * Places each business flat on its floor, in its family's slice, packed as a
 * round sunflower cluster. Same input, same picture.
 */
export function placeBusinesses(
  businesses: readonly SiloBusiness[],
  shape = SILO
): PlacedBusiness[] {
  const groups = new Map<string, SiloBusiness[]>()
  for (const b of businesses) {
    const key = `${b.familyIndex}:${b.floorIndex}`
    const g = groups.get(key)
    if (g) g.push(b)
    else groups.set(key, [b])
  }
  const placed: PlacedBusiness[] = []
  for (const group of groups.values()) {
    // A stable order inside the group, so a new receipt never reshuffles it.
    const ordered = [...group].sort((a, b) => a.id.localeCompare(b.id))
    const n = ordered.length
    const radius = clusterRadius(n, shape)
    ordered.forEach((b, j) => {
      // A little seeded height, so a busy group doesn't read as a flat sheet.
      const lift = DOT_LIFT + mulberry32(hashString(b.id))() * 0.8
      const rad = radius * Math.sqrt((j + 0.5) / n)
      const ang = j * GOLDEN_ANGLE + b.familyIndex
      // In toward the core (+) or out toward the glass (-).
      const inward = rad * Math.sin(ang)
      // Narrow the cluster as it goes in, so it keeps to its own wedge.
      const narrow = (shape.rA - inward) / shape.rA
      const p = wedgePoint(
        b.familyIndex,
        b.floorIndex,
        rad * Math.cos(ang) * CLUSTER_WIDE * narrow,
        lift,
        inward,
        shape
      )
      placed.push({ id: b.id, ...p })
    })
  }
  return placed
}

/** Where a family's shoppers gather on the top floor; links start here. */
export function crowdAnchor(familyIndex: number, shape = SILO): Point3 {
  return wedgePoint(familyIndex, 0, 0, 0, shape.rA - shape.crowdA, shape)
}

/**
 * A gentle curve from the crowd to a business, pulled toward the silo's axis
 * so links bow inward instead of cutting straight across. Returns the four
 * cubic bezier points.
 */
export function linkControlPoints(a: Point3, b: Point3): [Point3, Point3, Point3, Point3] {
  const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
  const f = 0.12 + 0.25 * Math.min(1, d / 70)
  const at = (t: number): Point3 => ({
    x: (a.x + (b.x - a.x) * t) * (1 - f),
    y: a.y + (b.y - a.y) * t,
    z: (a.z + (b.z - a.z) * t) * (1 - f),
  })
  return [a, at(1 / 3), at(2 / 3), b]
}

/** Where scroll starts (just under the top floor). */
const scrollTop = (shape: SiloShape) => shape.y[0]! - 1
/** How far scroll travels, down past the core. */
const scrollSpan = (shape: SiloShape) => scrollTop(shape) - (shape.hub.y - 2)

/** Floor to floor, in scene units. */
export function floorGap(shape = SILO): number {
  return shape.y[0]! - shape.y[1]!
}

/** Top of the glass, and the bottom of the wall just above the core. */
export function shellTop(shape = SILO): number {
  return shape.y[0]! + shape.shellPad
}

export function shellBottom(shape = SILO): number {
  return shape.y[shape.y.length - 1]! - shape.shellPad
}

/** The scroll position that frames a floor. */
export function scrollForFloor(floorIndex: number, shape = SILO): number {
  const y = shape.y[floorIndex] ?? 0
  return Math.min(1, Math.max(0, (scrollTop(shape) - y) / scrollSpan(shape)))
}

/** The floor nearest a height in the silo. */
export function floorForHeight(y: number, shape = SILO): number {
  let nearest = 0
  shape.y.forEach((floorY, i) => {
    if (Math.abs(floorY - y) < Math.abs(shape.y[nearest]! - y)) nearest = i
  })
  return nearest
}

/**
 * How far a pinned stage has ridden down its track, 0 to 1. Null when the
 * track has no room, so scroll means nothing. Reads the stage's offset inside
 * the track, not the window, so a moving phone toolbar can't shift it.
 */
export function trackProgress(
  track: { top: number; height: number },
  stage: { top: number; height: number }
): number | null {
  const room = track.height - stage.height
  if (room < 1) return null
  return Math.min(1, Math.max(0, (stage.top - track.top) / room))
}

// ─── Camera ──────────────────────────────────────────────────────────────────

/** The camera circles a point: heading `az`, tilt `el`, distance `R`. */
export interface Orbit extends Point3 {
  az: number
  el: number
  R: number
}

export const ORBIT_KEYS = ['x', 'y', 'z', 'az', 'el', 'R'] as const

const degrees = (d: number) => (d * Math.PI) / 180

export const ORBIT = {
  /**
   * The default view: inside the tower, a little over a third of the way up
   * to the next floor, looking across the plate, so the floors above and
   * below read as layers.
   */
  el: degrees(40),
  /** Camera distance inside the tower. */
  R: SILO.orbitR,
  /** Lower than the default, so a wedge's dots sit inside the frame. */
  floorEl: degrees(30),
  minEl: degrees(5),
  /** Steep enough to look down a plate, low enough to stay under the floor above. */
  maxEl: degrees(64),
  /** Seconds to settle after a scroll or a drag. */
  easeS: 0.28,
  /** Seconds to settle after a jump to a floor or a dot. */
  jumpS: 0.55,
} as const

/** The same angle between -pi and pi, so a turn always goes the short way. */
export function wrapAngle(a: number): number {
  const turn = Math.PI * 2
  const w = (((a + Math.PI) % turn) + turn) % turn
  return w - Math.PI
}

/** One critically damped step: keeps its speed between calls, never overshoots. */
export function smoothDamp(
  current: number,
  goal: number,
  velocity: number,
  smoothS: number,
  dt: number
): [value: number, velocity: number] {
  const omega = 2 / smoothS
  const x = omega * dt
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const change = current - goal
  const temp = (velocity + omega * change) * dt
  const value = goal + (change + temp) * decay
  if (goal - current > 0 === value > goal) return [goal, 0]
  return [value, (velocity - omega * temp) * decay]
}

export function orbitPose(o: Orbit): { pos: Point3; look: Point3 } {
  const flat = o.R * Math.cos(o.el)
  return {
    pos: {
      x: o.x + flat * Math.sin(o.az),
      y: o.y + o.R * Math.sin(o.el),
      z: o.z + flat * Math.cos(o.az),
    },
    look: { x: o.x, y: o.y, z: o.z },
  }
}

/** The view at a scroll position, circling the silo's center line. */
export function orbitForScroll(t: number, az: number, el: number, shape = SILO): Orbit {
  return { x: 0, y: scrollTop(shape) - t * scrollSpan(shape), z: 0, az, el, R: shape.orbitR }
}

/**
 * Zoom runs from a little closer than the default (ZOOM.min) out to the whole
 * tower seen from outside (1), the sketch's opening shot. Ticket 246.
 */
export const ZOOM = {
  min: -0.4,
  /** Middle of the tower, from the top of the glass down to the core. */
  y: zoomCenterY(SILO),
  /** Far enough to fit the whole tower in a phone's portrait frame. */
  R: SILO.zoomR,
  el: degrees(24),
  /** Fog thins out as the camera backs away, so the tower reads from outside. */
  fogNear: SILO.fogNear,
  fogFar: SILO.fogFar,
  /** One press of Zoom In or Zoom Out: five steps from inside to the whole tower. */
  step: 0.2,
} as const

/** Middle of the tower, from the top of its glass down to the core. */
export function zoomCenterY(shape: SiloShape): number {
  return (shellTop(shape) + shape.hub.y - shape.hubR) / 2
}

/** The view at a zoom level: 0 is the view as given, 1 the whole tower. */
export function zoomOrbit(o: Orbit, zoom: number, shape = SILO): Orbit {
  const z = Math.min(1, Math.max(ZOOM.min, zoom))
  if (z <= 0) return { ...o, R: o.R * (1 + z) }
  // Distance grows by the same factor each step, so the zoom feels even.
  const R = o.R * Math.pow(shape.zoomR / o.R, z)
  const lerp = (a: number, b: number) => a + (b - a) * z
  const el = Math.min(ORBIT.maxEl, Math.max(ORBIT.minEl, o.el + (ZOOM.el - ORBIT.el) * z))
  return { x: lerp(o.x, 0), y: lerp(o.y, zoomCenterY(shape)), z: lerp(o.z, 0), az: o.az, el, R }
}

/** How far out the camera is, 0 inside to 1 at the whole tower, from its distance. */
export function zoomAmount(R: number, shape = SILO): number {
  return Math.min(1, Math.max(0, Math.log(R / shape.orbitR) / Math.log(shape.zoomR / shape.orbitR)))
}

/** Fog density for a zoom amount. */
export function fogForZoom(amount: number, shape = SILO): number {
  const a = Math.min(1, Math.max(0, amount))
  return shape.fogNear + (shape.fogFar - shape.fogNear) * a
}

/** A zoom step from `zoom`, landing on the step grid so the presses stay even. */
export function stepZoom(zoom: number, dir: 1 | -1): number {
  const at = zoom / ZOOM.step
  const mark = dir > 0 ? Math.floor(at + 1e-6) + 1 : Math.ceil(at - 1e-6) - 1
  return Math.min(1, Math.max(ZOOM.min, Math.round(mark * ZOOM.step * 100) / 100))
}

/**
 * Phone full-screen (ticket 248). Zoom per natural-log unit of finger spread:
 * pinching the fingers to half their gap backs out about 0.7 of the way.
 */
export const PINCH = { perLog: 1, startPx: 8 } as const

/**
 * A two-finger pinch: `startZoom` when the fingers were `startGap` apart, now
 * `gap` apart. Fingers together back out toward the whole tower (1); fingers
 * apart move in, never past ZOOM.min. A gap of 0 (one finger lifted) holds.
 */
export function pinchZoom(startZoom: number, startGap: number, gap: number): number {
  if (startGap <= 0 || gap <= 0) return startZoom
  const z = startZoom + Math.log(startGap / gap) * PINCH.perLog
  return Math.min(1, Math.max(ZOOM.min, z))
}

/** Radians a second the phone preview turns on its own (ticket 248): a lap in about 90 s. */
/**
 * Phone full-screen swipes (ticket 248, round 2). Up and down travels the
 * floors: two screens of swipe cover the whole tower, as two screens of page
 * scroll do on a desktop. On release the view settles on a floor; a flick
 * carries it at most half a floor further.
 * Sideways turns, with a softer coast than a mouse, so a flick can't jump.
 */
export const SWIPE = { screens: 2, glideMax: 0.5, spinMax: 1.2, flingS: 0.2 } as const

/** Track travel for a finger moving `dy` px on a stage `height` px tall. Up goes down. */
export function swipeTravel(dy: number, height: number): number {
  if (height <= 0) return 0
  return -dy / (height * SWIPE.screens)
}

/** Where a released swipe settles: the floor nearest where its speed was taking it. */
export function swipeLanding(t: number, glide: number, shape = SILO): number {
  const aim = Math.min(1, Math.max(0, t + glide * SWIPE.flingS))
  let best = t
  let bestGap = Infinity
  shape.y.forEach((_, i) => {
    const floorT = scrollForFloor(i, shape)
    if (Math.abs(floorT - aim) < bestGap) {
      bestGap = Math.abs(floorT - aim)
      best = floorT
    }
  })
  return best
}

export const PREVIEW_SPIN = (Math.PI * 2) / 90

/**
 * Where Recenter goes (ticket 247): the opening heading, tilt and distance,
 * inside the tower, with nothing picked. The level stays where the reader is.
 */
export const RECENTER = { az: 0, el: ORBIT.el, zoom: 0 } as const

/**
 * The opening (ticket 247): the camera starts at the whole tower and glides
 * down inside while the title shows, then the title settles into the HUD.
 */
export const INTRO = {
  /**
   * The title holds over the page until the scene has drawn, so it never plays
   * over an empty frame. Past this the opening plays anyway.
   */
  waitMs: 1500,
  /** Smoothing time for the glide in. About three times this to land. */
  glideS: 1.1,
  /** When the opening is over and its layer leaves the page. Matches silo.css. */
  endMs: 3200,
} as const

/**
 * Whether the opening plays. Not with reduced motion, not on a reload partway
 * down the page, and not for `?you=1`, which opens on the reader's business.
 */
export function introPlays(o: {
  reducedMotion: boolean
  scrolled: boolean
  focusYou: boolean
}): boolean {
  return !o.reducedMotion && !o.scrolled && !o.focusYou
}

/** The heading that stands at the center of the silo and faces a point. */
export function headingTo(p: Point3): number {
  return Math.atan2(-p.x, -p.z)
}

const FOCUS_R = { business: 17, gap: 24, floor: 34 } as const

/** Up close on a dot, a gap or a slice, looking out from the middle of the floor. */
export function focusFrame(p: Point3, kind: keyof typeof FOCUS_R, shape = SILO): Orbit {
  const scale = shape.R / SILO.R
  return { x: p.x, y: p.y, z: p.z, az: headingTo(p), el: degrees(30), R: FOCUS_R[kind] * scale }
}

/** The family with the most businesses on a floor, or null on an empty floor. */
export function busiestFamily(
  businesses: readonly Pick<SiloBusiness, 'familyIndex' | 'floorIndex'>[],
  floorIndex: number
): number | null {
  const counts = new Map<number, number>()
  for (const b of businesses) {
    if (b.floorIndex === floorIndex) counts.set(b.familyIndex, (counts.get(b.familyIndex) ?? 0) + 1)
  }
  let best: number | null = null
  for (const [family, n] of counts) {
    if (best === null || n > (counts.get(best) ?? 0) || (n === counts.get(best) && family < best))
      best = family
  }
  return best
}

// ─── Name labels ─────────────────────────────────────────────────────────────

/** A label on screen stays until its dot is smaller than this share of the floor. */
export const LABEL_KEEP = 0.8
/** A new label must be this much bigger than the one it would replace. */
export const LABEL_SWAP_SIZE = 1.25
/** And it must win for this long first. */
export const LABEL_SWAP_MS = 300

export interface LabelBox {
  l: number
  t: number
  r: number
  b: number
}

export const overlaps = (a: LabelBox, b: LabelBox) =>
  a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b

export interface LabelCandidate {
  id: string
  /** Center of the dot, in stage pixels. */
  x: number
  /** Top edge of the label. */
  top: number
  /** The dot's size on screen. */
  size: number
  w: number
  h: number
}

export interface LabelPick {
  /** Every dot on screen at or above the keep size, not just the winners. */
  candidates: readonly LabelCandidate[]
  /** Who is on screen now. */
  held: readonly string[]
  /** When each waiting label started winning, from the last pick. */
  since: ReadonlyMap<string, number>
  /** HUD panels, in stage pixels. */
  blocked: readonly LabelBox[]
  now: number
  max: number
  minPx: number
  stageW: number
  stageH: number
}

/** Room a label keeps from the edge of the stage. */
const LABEL_EDGE = 8

/** Where one edge of a label sits inside the stage, before rounding. */
export function clampLabelPos(start: number, length: number, stage: number): number {
  return Math.min(Math.max(start, LABEL_EDGE), Math.max(stage - length - LABEL_EDGE, LABEL_EDGE))
}

/** Moves one edge onto a whole pixel inside the stage, and leaves it alone under 1px. */
export function snapLabelPos(start: number, length: number, stage: number, prev: number): number {
  const raw = clampLabelPos(start, length, stage)
  return Math.abs(raw - prev) < 1 ? prev : Math.round(raw)
}

function labelBox(c: LabelCandidate, stageW: number, stageH: number): LabelBox {
  const l = clampLabelPos(c.x - c.w / 2, c.w, stageW)
  const t = clampLabelPos(c.top, c.h, stageH)
  return { l, t, r: l + c.w, b: t + c.h }
}

/**
 * Who carries a name next. Labels on screen go first and keep their place, so a
 * still camera always gets the same answer. Biggest first, ties by id.
 */
export function pickLabels(input: LabelPick): {
  ids: string[]
  boxes: LabelBox[]
  since: Map<string, number>
} {
  const { candidates, held, blocked, now, max, minPx, stageW, stageH } = input
  const bigFirst = (a: LabelCandidate, b: LabelCandidate) =>
    b.size - a.size || (a.id < b.id ? -1 : 1)
  const heldIds = new Set(held)
  const hitsHud = (box: LabelBox) => blocked.some((p) => overlaps(p, box))

  let kept: { c: LabelCandidate; box: LabelBox }[] = []
  for (const c of candidates.filter((x) => heldIds.has(x.id)).sort(bigFirst)) {
    if (kept.length >= max) break
    const box = labelBox(c, stageW, stageH)
    if (hitsHud(box) || kept.some((k) => overlaps(k.box, box))) continue
    kept.push({ c, box })
  }

  const since = new Map<string, number>()
  const onScreen = new Set(kept.map((k) => k.c.id))
  for (const c of candidates.filter((x) => !onScreen.has(x.id) && x.size >= minPx).sort(bigFirst)) {
    const box = labelBox(c, stageW, stageH)
    if (hitsHud(box)) continue
    const hits = kept.filter((k) => overlaps(k.box, box))
    if (hits.length === 0 && kept.length < max) {
      kept.push({ c, box })
      continue
    }
    // No room: it has to beat whatever it lands on, or the smallest label held.
    const out =
      hits.length > 0
        ? hits
        : kept
            .slice()
            .sort((a, b) => bigFirst(b.c, a.c))
            .slice(0, 1)
    if (out.length === 0 || out.some((k) => c.size < k.c.size * LABEL_SWAP_SIZE)) continue
    const first = input.since.get(c.id) ?? now
    if (now - first < LABEL_SWAP_MS) {
      since.set(c.id, first)
      continue
    }
    kept = kept.filter((k) => !out.includes(k))
    kept.push({ c, box })
  }

  return { ids: kept.map((k) => k.c.id), boxes: kept.map((k) => k.box), since }
}

// ─── Pulses ──────────────────────────────────────────────────────────────────

export const PULSE_MIN_MS = 60_000
export const PULSE_MAX_MS = 120_000

export interface PulseSlot {
  linkId: string
  /** How often this link pulses, 60 to 120 seconds. */
  periodMs: number
  /** When in that period its pulse starts, so links don't fire together. */
  offsetMs: number
}

/** One gold pulse per link every one to two minutes, staggered and stable. */
export function pulseSchedule(linkIds: readonly string[]): PulseSlot[] {
  return linkIds.map((linkId) => {
    const rnd = mulberry32(hashString(`pulse:${linkId}`))
    const periodMs = Math.round(PULSE_MIN_MS + rnd() * (PULSE_MAX_MS - PULSE_MIN_MS))
    const offsetMs = Math.round(rnd() * periodMs)
    return { linkId, periodMs, offsetMs }
  })
}

/**
 * Where each link's pulse is at `nowMs`, as 0 to 1 along the link, or null when
 * the link is resting. A pulse takes `travelMs` to run its length.
 */
export function pulseProgress(slot: PulseSlot, nowMs: number, travelMs = 1600): number | null {
  const t = (((nowMs - slot.offsetMs) % slot.periodMs) + slot.periodMs) % slot.periodMs
  return t < travelMs ? t / travelMs : null
}

export const LEVEL_KEYS = BUSINESS_LEVELS
