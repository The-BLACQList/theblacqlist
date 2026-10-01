import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * A small gold node network around a center slot, drawn as inline SVG. It speaks
 * the same visual language as the coming-soon canvas
 * (app/coming-soon/node-network-background.tsx) but is static markup: no JS, no
 * canvas, no listeners, so it can render from a Server Component and paint in
 * the first frame.
 *
 * Coordinates are fixed on purpose. Nothing here may use Math.random(): the
 * markup has to be identical on every render.
 *
 * `variant="animate"` adds the class the keyframes in app/globals.css hang off
 * (.blacq-constellation--animate): nodes appear, edges connect, then the whole
 * network pulses. Without it, and always under reduced motion, it renders the
 * finished, fully lit network.
 */

const VIEW = 400
const HUB = { x: 200, y: 200 }
/** Spokes start here so they stop at the edge of the Q instead of crossing it. */
const HUB_CLEAR = 46

// ring 1 hugs the Q, ring 2 sits at the edge. Order is the stagger order.
const NODES = [
  { x: 200, y: 108, r: 3.2, ring: 1 },
  { x: 283, y: 158, r: 2.8, ring: 1 },
  { x: 277, y: 262, r: 3, ring: 1 },
  { x: 190, y: 293, r: 2.8, ring: 1 },
  { x: 111, y: 246, r: 3.2, ring: 1 },
  { x: 118, y: 148, r: 2.8, ring: 1 },
  { x: 262, y: 44, r: 2.4, ring: 2 },
  { x: 352, y: 118, r: 2.6, ring: 2 },
  { x: 370, y: 232, r: 2.4, ring: 2 },
  { x: 318, y: 338, r: 2.6, ring: 2 },
  { x: 212, y: 376, r: 2.4, ring: 2 },
  { x: 94, y: 348, r: 2.6, ring: 2 },
  { x: 34, y: 250, r: 2.4, ring: 2 },
  { x: 52, y: 120, r: 2.6, ring: 2 },
  { x: 140, y: 36, r: 2.4, ring: 2 },
] as const

/** Pairs of NODES indexes. -1 is the hub. */
const EDGES: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [-1, 1],
  [-1, 2],
  [-1, 3],
  [-1, 4],
  [-1, 5],
  [0, 1],
  [1, 2],
  [3, 4],
  [4, 5],
  [5, 0],
  [0, 6],
  [0, 14],
  [1, 7],
  [2, 8],
  [2, 9],
  [3, 10],
  [4, 11],
  [4, 12],
  [5, 13],
  [6, 7],
  [8, 9],
  [11, 12],
  [13, 14],
]

interface Point {
  x: number
  y: number
  r: number
  ring: number
}
const HUB_POINT: Point = { ...HUB, r: 0, ring: 0 }
/** -1 is the hub. */
const at = (i: number): Point => (i < 0 ? HUB_POINT : (NODES[i] ?? HUB_POINT))

// Delays in ms. Inner nodes land first, then the outer ring, then every edge
// draws once both of its ends exist. The pulse starts after the build settles.
const nodeDelay = (i: number) => (i < 0 ? 0 : at(i).ring === 1 ? 120 + i * 70 : 560 + (i - 6) * 60)
const edgeDelay = ([a, b]: readonly [number, number]) => Math.max(nodeDelay(a), nodeDelay(b)) + 160
const PULSE_START = 1700
const pulseDelay = (ring: number) => PULSE_START + ring * 280

function endpoints([a, b]: readonly [number, number]) {
  const from = at(a)
  const to = at(b)
  if (a >= 0) return { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
  const dx = to.x - HUB.x
  const dy = to.y - HUB.y
  const k = HUB_CLEAR / Math.hypot(dx, dy)
  return { x1: HUB.x + dx * k, y1: HUB.y + dy * k, x2: to.x, y2: to.y }
}

type Timed = CSSProperties & { '--d'?: string; '--p'?: string }

interface NodeConstellationProps {
  variant?: 'animate' | 'still'
  className?: string
  style?: CSSProperties
  /** Centered over the hub. The loader and the 404 put the gold Q here. */
  children?: ReactNode
}

export function NodeConstellation({
  variant = 'still',
  className,
  style,
  children,
}: NodeConstellationProps) {
  return (
    <div
      className={cn(
        'blacq-constellation relative aspect-square',
        variant === 'animate' && 'blacq-constellation--animate',
        className
      )}
      style={style}
    >
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient id="blacq-node-glow">
            <stop offset="0%" stopColor="#FFD867" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FFD867" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g strokeLinecap="round">
          {EDGES.map((edge) => {
            const ring = Math.max(at(edge[0]).ring, at(edge[1]).ring)
            const timing: Timed = {
              '--d': `${edgeDelay(edge)}ms`,
              '--p': `${pulseDelay(ring - 0.5)}ms`,
            }
            return (
              <line
                key={`${edge[0]}-${edge[1]}`}
                {...endpoints(edge)}
                pathLength={1}
                className="blacq-c-edge"
                style={timing}
              />
            )
          })}
        </g>

        {NODES.map((node, i) => {
          const timing: Timed = { '--d': `${nodeDelay(i)}ms`, '--p': `${pulseDelay(node.ring)}ms` }
          return (
            <g key={i} style={timing}>
              <circle
                cx={node.x}
                cy={node.y}
                r={node.r * 5}
                fill="url(#blacq-node-glow)"
                className="blacq-c-glow"
              />
              <circle cx={node.x} cy={node.y} r={node.r} className="blacq-c-node" />
            </g>
          )
        })}
      </svg>

      {children && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="relative grid place-items-center">
            <span className="blacq-c-halo" aria-hidden="true" />
            {children}
          </div>
        </div>
      )}
    </div>
  )
}
