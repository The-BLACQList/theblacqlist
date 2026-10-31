/**
 * Silo layout data (ticket 167).
 *
 * Pure functions that turn the community spend rows into what the Silo map
 * draws: the five floors, the business dots, their colors and positions, and
 * the pulse schedule. No React and no Three.js here, so every rule the page
 * promises is unit-tested in one place (tests/silo-layout.test.ts).
 *
 * Honest to the data (Collective workshop rules, spec §20 round 17):
 * - Only the first stop is tracked: shopper to business. The Shoppers floor
 *   shows the total spent. Every floor past it says "Not tracked yet" and
 *   never shows an invented amount.
 * - Shoppers are one group. No shopper is ever a dot.
 * - A business only appears once AGGREGATE_MIN_TRANSACTIONS receipts are
 *   behind its total, and its name only shows when it has opted in. There is
 *   no opt-in column yet, so every caller passes `() => false` today.
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
  /** Null unless the business opted in, or it is the reader's own "You". */
  name: string | null
  href: string | null
  level: BusinessLevel
  floorIndex: number
  familyIndex: number
  transactionCount: number
  /** Kept for the ordering and the list view, which shows it under the anonymous label. */
  amountCents: number
  optedIn: boolean
  isYou: boolean
}

export interface BuildBusinessesInput {
  nodes: readonly BusinessNodeRow[]
  listings: Readonly<Record<string, BusinessListingMeta>>
  isNameOptedIn: (listingId: string) => boolean
  /** Listing ids the signed-in reader has a counted (approved) receipt at. */
  youIds?: ReadonlySet<string>
}

export function buildSiloBusinesses({
  nodes,
  listings,
  isNameOptedIn,
  youIds,
}: BuildBusinessesInput): SiloBusiness[] {
  return nodes
    .filter((n) => meetsAggregateThreshold(n))
    .filter((n) => listings[n.entity_id] !== undefined)
    .map((n) => {
      const meta = listings[n.entity_id]!
      const optedIn = isNameOptedIn(n.entity_id)
      const isYou = youIds?.has(n.entity_id) ?? false
      const level: BusinessLevel = isBusinessLevel(meta.level) ? meta.level : 'local'
      // The reader already knows where they shopped, so their own business is
      // named for them. Nobody else sees that name unless the business opts in.
      const showName = optedIn || isYou
      return {
        id: n.entity_id,
        name: showName ? meta.name : null,
        href: showName ? meta.href : null,
        level,
        floorIndex: floorIndexForLevel(level),
        familyIndex: familyIndexForCategorySlug(meta.categorySlug),
        transactionCount: n.transaction_count,
        amountCents: n.total_amount_cents,
        optedIn,
        isYou,
      }
    })
    .sort((a, b) => b.amountCents - a.amountCents || a.id.localeCompare(b.id))
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

/** The label a reader sees for a business: its name if allowed, otherwise its kind. */
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

export const FLOOR_SPACING = 2.2
export const SILO_RADIUS = 4.2

/** Height of a floor in scene units. Shoppers at the top. */
export function floorY(floorIndex: number): number {
  return (2 - floorIndex) * FLOOR_SPACING
}

export interface Point2 {
  x: number
  z: number
}

/**
 * Pushes dots that sit closer than `minDist` apart, a little at a time, so a
 * crowded neighborhood opens up without leaving it. Deterministic: same input,
 * same output. Points never move further than `maxShift` from where they began.
 */
export function spreadPoints(
  points: readonly Point2[],
  minDist: number,
  { iterations = 24, maxShift = minDist * 1.5 }: { iterations?: number; maxShift?: number } = {}
): Point2[] {
  const out = points.map((p) => ({ x: p.x, z: p.z }))
  for (let it = 0; it < iterations; it++) {
    let moved = false
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]!
        const b = out[j]!
        const dx = b.x - a.x
        const dz = b.z - a.z
        const d = Math.hypot(dx, dz)
        if (d >= minDist) continue
        let ux: number
        let uz: number
        if (d < 1e-6) {
          // Same spot: split them along a fixed angle picked from their order.
          const ang = ((i * 7 + j * 13) % 360) * (Math.PI / 180)
          ux = Math.cos(ang)
          uz = Math.sin(ang)
        } else {
          ux = dx / d
          uz = dz / d
        }
        const push = (minDist - d) / 2
        a.x -= ux * push
        a.z -= uz * push
        b.x += ux * push
        b.z += uz * push
        moved = true
      }
    }
    // Keep each point near home.
    for (let i = 0; i < out.length; i++) {
      const o = points[i]!
      const p = out[i]!
      const sx = p.x - o.x
      const sz = p.z - o.z
      const s = Math.hypot(sx, sz)
      if (s > maxShift) {
        p.x = o.x + (sx / s) * maxShift
        p.z = o.z + (sz / s) * maxShift
      }
    }
    if (!moved) break
  }
  return out
}

export interface PlacedBusiness {
  id: string
  x: number
  y: number
  z: number
}

export const DOT_MIN_DISTANCE = 0.42

/**
 * Places each business on its floor. Each category family owns a slice of the
 * ring, so neighbors share a color, then crowded dots are spread apart.
 */
export function placeBusinesses(businesses: readonly SiloBusiness[]): PlacedBusiness[] {
  const placed: PlacedBusiness[] = []
  const familyCount = CATEGORY_FAMILIES.length
  const slice = (Math.PI * 2) / familyCount
  for (let f = 1; f < SILO_FLOORS.length; f++) {
    const onFloor = businesses.filter((b) => b.floorIndex === f)
    if (onFloor.length === 0) continue
    const home = onFloor.map((b) => {
      const rnd = mulberry32(hashString(b.id))
      const ang = b.familyIndex * slice + slice * (0.12 + rnd() * 0.76)
      const r = SILO_RADIUS * (0.35 + rnd() * 0.55)
      return { x: Math.cos(ang) * r, z: Math.sin(ang) * r }
    })
    const spread = spreadPoints(home, DOT_MIN_DISTANCE)
    onFloor.forEach((b, i) => {
      placed.push({ id: b.id, x: spread[i]!.x, y: floorY(f), z: spread[i]!.z })
    })
  }
  return placed
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
