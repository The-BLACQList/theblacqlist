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
 *   before any receipt does (ticket 171). A business is only `linked`, with a
 *   connection and a total, once AGGREGATE_MIN_TRANSACTIONS receipts are
 *   behind it.
 * - Names show for every business (founder, 2026-10-31, ticket 171b): a
 *   published listing is already public. Lines and figures stay hidden below
 *   the threshold, because those are what could point back at one shopper.
 * - A gap is a category family with no business yet on a business floor. It
 *   is drawn as a pink dashed square and never claims dollars leave.
 */

import { meetsAggregateThreshold } from './aggregate-privacy'
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

export const GOLD = '#E2A428'
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
   * True once enough receipts are behind this business to show a connection
   * and a total. False businesses are still drawn, with no link and no amount.
   */
  linked: boolean
  /** Zero unless linked. */
  transactionCount: number
  /** Zero unless linked. Kept for the ordering and the list view. */
  amountCents: number
  optedIn: boolean
  isYou: boolean
}

export interface BuildBusinessesInput {
  nodes: readonly BusinessNodeRow[]
  /** Every published business, keyed by listing id. Each one becomes a node. */
  listings: Readonly<Record<string, BusinessListingMeta>>
  /** Kept for the opt-in column if one ever lands. Names show either way. */
  isNameOptedIn?: (listingId: string) => boolean
  /** Listing ids the signed-in reader has a counted (approved) receipt at. */
  youIds?: ReadonlySet<string>
}

export function buildSiloBusinesses({
  nodes,
  listings,
  isNameOptedIn,
  youIds,
}: BuildBusinessesInput): SiloBusiness[] {
  const counted = new Map<string, BusinessNodeRow>()
  for (const n of nodes) if (meetsAggregateThreshold(n)) counted.set(n.entity_id, n)

  return Object.entries(listings)
    .map(([id, meta]) => {
      const node = counted.get(id)
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
        // Under the floor, a total could point back at one shopper, so none is kept.
        transactionCount: node?.transaction_count ?? 0,
        amountCents: node?.total_amount_cents ?? 0,
        optedIn,
        isYou,
      }
    })
    .sort(
      (a, b) =>
        Number(b.linked) - Number(a.linked) ||
        b.amountCents - a.amountCents ||
        a.id.localeCompare(b.id)
    )
}

/** "A food shop" or "An x": the article follows the first letter of the words. */
export function anonymousBusinessLabel(b: Pick<SiloBusiness, 'familyIndex' | 'floorIndex'>, capital = true): string {
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
 * Round 17 concept D: a tall gold silo. Floors stack top to bottom (Shoppers
 * up top), and each category family owns one wedge of the wall, turning a
 * little floor by floor so the clusters spiral down. The hub sits under the
 * last floor. All in scene units.
 */
export const SILO = {
  /** Cage radius. */
  R: 17,
  /** Where cluster centers sit, just inside the cage. */
  rA: 15.2,
  /** Smallest business cluster radius. */
  cr: 3.0,
  /** Shopper crowd radius on the top floor. */
  crowdR: 3.5,
  /** How far each floor turns, in radians. */
  twist: 0.32,
  /** Floor heights, Shoppers first. */
  y: [34, 17, 0, -17, -34] as const,
  hub: { x: 0, y: -47, z: 0 },
  hubR: 4.5,
} as const

export interface Point3 {
  x: number
  y: number
  z: number
}

/** Angle of a family's wedge on a floor. */
export function wedgeAngle(familyIndex: number, floorIndex: number): number {
  return (familyIndex / CATEGORY_FAMILIES.length) * Math.PI * 2 + floorIndex * SILO.twist
}

/**
 * A point near a wedge's center: `u` along the wall, `v` up, `w` in toward the
 * middle of the silo.
 */
export function wedgePoint(familyIndex: number, floorIndex: number, u = 0, v = 0, w = 0): Point3 {
  const r = SILO.rA - w
  const a = wedgeAngle(familyIndex, floorIndex)
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: r * c - u * s, y: (SILO.y[floorIndex] ?? 0) + v, z: r * s + u * c }
}

/**
 * Cluster radius grows with the crowd so busy wedges don't pile up. The cap
 * keeps a full cluster inside its wedge and clear of the floors above and
 * below (17 apart).
 */
export const CLUSTER_MAX_R = 7.5

export function clusterRadius(count: number): number {
  return Math.max(SILO.cr, Math.min(CLUSTER_MAX_R, 0.55 * Math.sqrt(count)))
}

/**
 * How deep a cluster may reach in toward the middle of the silo. A small
 * cluster stays flat against the wall; a busy one becomes a thick slab so its
 * dots stop sitting on top of each other (ticket 171b).
 */
export function clusterDepth(count: number): number {
  return 0.9 + Math.min(5.5, Math.max(0, clusterRadius(count) - SILO.cr) * 1.2)
}

export interface PlacedBusiness extends Point3 {
  id: string
}

const GOLDEN_ANGLE = 2.39996

/**
 * Places each business in its family's wedge on its floor, as a sunflower so
 * the cluster fills evenly at any size. Same input, same picture.
 */
export function placeBusinesses(businesses: readonly SiloBusiness[]): PlacedBusiness[] {
  const groups = new Map<string, SiloBusiness[]>()
  for (const b of businesses) {
    const key = `${b.familyIndex}:${b.floorIndex}`
    const g = groups.get(key)
    if (g) g.push(b)
    else groups.set(key, [b])
  }
  const placed: PlacedBusiness[] = []
  for (const group of groups.values()) {
    // A stable order inside the cluster, so a new receipt never reshuffles it.
    const ordered = [...group].sort((a, b) => a.id.localeCompare(b.id))
    const n = ordered.length
    const radius = clusterRadius(n)
    const deep = clusterDepth(n)
    ordered.forEach((b, j) => {
      const rad = radius * Math.sqrt((j + 0.5) / n)
      const ang = j * GOLDEN_ANGLE + b.familyIndex
      // Mostly inward, a little outward, so the slab stays inside the cage.
      const depth = mulberry32(hashString(b.id))() * deep - 0.45
      // Narrow the slab as it goes in, so it keeps to its own wedge.
      const narrow = (SILO.rA - depth) / SILO.rA
      const p = wedgePoint(b.familyIndex, b.floorIndex, rad * Math.cos(ang) * narrow, rad * Math.sin(ang), depth)
      placed.push({ id: b.id, ...p })
    })
  }
  return placed
}

/** Where a family's shoppers gather on the top floor; links start here. */
export function crowdAnchor(familyIndex: number): Point3 {
  return wedgePoint(familyIndex, 0)
}

/**
 * A gentle curve from the crowd to a business, pulled toward the silo's axis
 * so links bow inward instead of cutting straight across. Returns the four
 * cubic bezier points.
 */
export function linkControlPoints(a: Point3, b: Point3): [Point3, Point3, Point3, Point3] {
  const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
  const f = 0.12 + 0.25 * Math.min(1, d / 30)
  const at = (t: number): Point3 => ({
    x: (a.x + (b.x - a.x) * t) * (1 - f),
    y: a.y + (b.y - a.y) * t,
    z: (a.z + (b.z - a.z) * t) * (1 - f),
  })
  return [a, at(1 / 3), at(2 / 3), b]
}

/** Camera height along the silo for a 0 (top) to 1 (bottom) scroll position. */
export function viewForScroll(t: number): { pos: Point3; look: Point3 } {
  const y = 46 - t * 82
  return { pos: { x: 0, y, z: 6 }, look: { x: 0, y: y - 26, z: -6 } }
}

/** The scroll position that frames a floor. */
export function scrollForFloor(floorIndex: number): number {
  const y = SILO.y[floorIndex] ?? 0
  return Math.min(1, Math.max(0, (33 - y) / 82))
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
