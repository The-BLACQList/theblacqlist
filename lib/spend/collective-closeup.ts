// =============================================================================
// The home Collective band's close-up of the Silo (ticket 182)
// =============================================================================
// A small drawing, not the data: nine fixed clusters of dots on four floors.
// How many lines are lit steps up with real purchases, and is never more than
// the real business count. Lines only run from the Shoppers floor to a
// business, because the first stop is the only one anyone can track.
// =============================================================================

import { CATEGORY_FAMILIES, GOLD, mulberry32 } from './silo-layout'

/** One drawing, cropped and scaled per layout. */
export interface CloseUpView {
  /** Board x that lands on the left edge of the drawing. */
  ox: number
  k: number
  dot: number
  width: number
  height: number
  /** Board x used to read a floor's height for its tag. */
  tagX: number
  /** CSS left of the tags, against the art's wrapper. */
  tagLeft: string
}

export interface CloseUpPoint {
  x: number
  y: number
}

export interface CloseUpLine {
  d: string
  color: string
  from: CloseUpPoint
  to: CloseUpPoint
}

export interface CloseUpDot extends CloseUpPoint {
  r: number
  color: string
  lit: boolean
}

export interface CloseUpPulse {
  d: string
  /** Where it rests when motion is off. */
  still: CloseUpPoint
  r: number
  seconds: number
  offsetSeconds: number
}

export interface CloseUpArt {
  floors: { d: string; opacity: number }[]
  walls: string
  lines: CloseUpLine[]
  dots: CloseUpDot[]
  pulses: CloseUpPulse[]
  gaps: (CloseUpPoint & { size: number })[]
  tags: { name: string; y: number }[]
}

export const CLOSE_UP_DESK: CloseUpView = {
  ox: 0,
  k: 1,
  dot: 1,
  width: 1340,
  height: 540,
  tagX: 506,
  tagLeft: '506px',
}

export const CLOSE_UP_PHONE: CloseUpView = {
  ox: 465,
  k: 0.71,
  dot: 0.82,
  width: 667,
  height: 390,
  tagX: 682,
  tagLeft: 'max(12px, calc(50% - 176px))',
}

const SHOPPERS_Y0 = -6
const FLOORS = [
  { name: 'Shoppers', y0: SHOPPERS_Y0, opacity: 0.6 },
  { name: 'Shops', y0: 118, opacity: 0.34 },
  { name: 'Suppliers', y0: 258, opacity: 0.34 },
  { name: 'Makers', y0: 398, opacity: 0.34 },
] as const

const WALL_XS = [560, 760, 980, 1180] as const

const CLUSTERS = [
  { y0: 118, x: 640, family: 0, count: 7 },
  { y0: 118, x: 860, family: 1, count: 8 },
  { y0: 118, x: 1090, family: 3, count: 7 },
  { y0: 118, x: 1240, family: 4, count: 5 },
  { y0: 258, x: 700, family: 2, count: 4 },
  { y0: 258, x: 960, family: 0, count: 5 },
  { y0: 398, x: 610, family: 4, count: 4 },
  { y0: 398, x: 830, family: 1, count: 5 },
  { y0: 398, x: 1060, family: 3, count: 4 },
] as const

/** Clusters take turns lighting up, so a few lines still spread across the floors. */
const LIGHT_TURNS = [1, 5, 8, 2, 4, 0, 7, 3, 6]

/** Where each family's lines leave the Shoppers floor. */
const LINE_START_XS = [660, 1000, 780, 1140, 900, 1240] as const

const GAP_SPOTS = [
  [1180, 258],
  [1240, 398],
] as const

const LINE_STEPS = [
  { purchases: 200, lines: 20 },
  { purchases: 50, lines: 14 },
  { purchases: 10, lines: 8 },
  { purchases: 1, lines: 3 },
] as const

/** Lit lines for the real totals. Steps up, and never passes the business count. */
export function closeUpLineCount(purchases: number, businesses: number): number {
  const step = LINE_STEPS.find((s) => purchases >= s.purchases)
  return Math.min(step?.lines ?? 0, Math.max(0, businesses))
}

export function closeUpPulseCount(lines: number): number {
  return lines > 0 ? Math.max(1, Math.round(lines / 4)) : 0
}

/** The curve every floor shares, in board space. */
export function closeUpFloorY(x: number, y0: number): number {
  const u = (x - 880) / 520
  return y0 + 44 * (1 - u * u)
}

type Cubic = [[number, number], [number, number], [number, number], [number, number]]

function familyColor(family: number): string {
  return CATEGORY_FAMILIES[family]?.color ?? GOLD
}

function round(value: number): number {
  return Number(value.toFixed(1))
}

export function buildCloseUp(lineCount: number, view: CloseUpView): CloseUpArt {
  const px = (x: number) => round((x - view.ox) * view.k)
  const py = (y: number) => round(y * view.k)

  const floors = FLOORS.map((floor) => {
    const points: string[] = []
    for (let x = 400; x <= 1340; x += 20) points.push(`${px(x)} ${py(closeUpFloorY(x, floor.y0))}`)
    return { d: `M${points.join(' L')}`, opacity: floor.opacity }
  })

  const walls = WALL_XS.map(
    (x) => `M${px(x)} ${py(closeUpFloorY(x, SHOPPERS_Y0))} L${px(880 + (x - 880) * 1.1)} ${py(540)}`
  ).join(' ')

  const random = mulberry32(31)
  const nodes = CLUSTERS.flatMap((cluster, clusterIndex) => {
    const centerY = closeUpFloorY(cluster.x, cluster.y0) + 44
    return Array.from({ length: cluster.count }, (_, index) => {
      const radius = 15 * Math.sqrt(index + 0.15)
      const angle = index * 2.399963 + clusterIndex
      return {
        x: cluster.x + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle) * 0.8,
        family: cluster.family,
        clusterIndex,
        index,
        size: 9 + random() * 4,
      }
    })
  })

  const lit = [...nodes]
    .sort(
      (a, b) =>
        a.index - b.index ||
        LIGHT_TURNS.indexOf(a.clusterIndex) - LIGHT_TURNS.indexOf(b.clusterIndex)
    )
    .slice(0, lineCount)
  const litSet = new Set(lit)

  const curves = lit.map((node) => {
    const startX = LINE_START_XS[node.family]
    const startY = closeUpFloorY(startX, SHOPPERS_Y0)
    const rise = node.y - startY
    const points: Cubic = [
      [startX, startY],
      [startX, startY + rise * 0.55],
      [node.x + (880 - node.x) * 0.25, node.y - rise * 0.3],
      [node.x, node.y],
    ]
    return { node, points }
  })

  const pathFor = (points: Cubic) => {
    const [start, c1, c2, end] = points
    return `M${px(start[0])} ${py(start[1])} C${px(c1[0])} ${py(c1[1])} ${px(c2[0])} ${py(c2[1])} ${px(end[0])} ${py(end[1])}`
  }

  const lines = curves.map(({ node, points }) => ({
    d: pathFor(points),
    color: familyColor(node.family),
    from: { x: px(points[0][0]), y: py(points[0][1]) },
    to: { x: px(node.x), y: py(node.y) },
  }))

  const dots = nodes.map((node) => {
    const isLit = litSet.has(node)
    return {
      x: px(node.x),
      y: py(node.y),
      r: round(((node.size + (isLit ? 3 : 0)) * view.dot) / 2),
      color: familyColor(node.family),
      lit: isLit,
    }
  })

  const pulses = curves.slice(0, closeUpPulseCount(lineCount)).map(({ points }, index) => {
    const t = 0.35 + 0.2 * (index % 3)
    const u = 1 - t
    const at = (axis: 0 | 1) =>
      u * u * u * points[0][axis] +
      3 * u * u * t * points[1][axis] +
      3 * u * t * t * points[2][axis] +
      t * t * t * points[3][axis]
    const seconds = 6 + (index % 3) * 1.5
    return {
      d: pathFor(points),
      still: { x: px(at(0)), y: py(at(1)) },
      r: round(3.5 * view.dot),
      seconds,
      offsetSeconds: round(seconds * t),
    }
  })

  const gaps = GAP_SPOTS.map(([x, y0]) => ({
    x: px(x),
    y: py(closeUpFloorY(x, y0) + 44),
    size: round(18 * view.dot),
  }))

  const tags = FLOORS.map((floor) => ({
    name: floor.name,
    y: py(closeUpFloorY(view.tagX, floor.y0) + 6),
  }))

  return { floors, walls, lines, dots, pulses, gaps, tags }
}
