'use client'

import { useEffect, useRef } from 'react'

/**
 * The BLACQList — "The Network Awakens" coming-soon background.
 *
 * A Canvas-2D realization of the brand's signature Gold Node Network motif:
 * gold nodes = Black-owned businesses, thin connectors = relationships, and the
 * brighter "flow markers" emitted on click = dollars circulating in the Black
 * economy. Calm and editorial by default; the field brightens and reaches toward
 * the cursor, and a click sends a ripple + dollars flowing outward.
 *
 * Decorative only — the canvas is aria-hidden and pointer-events-none, so the
 * email form and social links above it stay fully interactive. Interaction is
 * wired on `window`, so the network reacts to the cursor anywhere on the page.
 *
 * Brand constants mirror the --color-* tokens in app/globals.css (and the prior
 * Three.js sketch bl-flow.js): gold #C4A065, flow #EAD3A0, highlight #ffd867.
 */

const GOLD = { r: 0xc4, g: 0xa0, b: 0x65 } // --color-gold  #C4A065
const FLOW = { r: 0xea, g: 0xd3, b: 0xa0 } // brighter "dollar" marker #EAD3A0
const HIGHLIGHT = { r: 0xff, g: 0xd8, b: 0x67 } // --color-light-gold #ffd867

// Balanced intensity (workshopped). Editorial: few nodes, thin lines, calm motion.
// Node count scales with viewport area so phones stay calm/light and desktops fill.
const NODE_AREA_PER = 40000 // px² of canvas per node
const NODE_MIN = 14 // ~375×800 phone → calm
const NODE_MAX = 38 // wide desktop → full
const LINK_DIST = 140 // px — connector range between nodes
const LINK_DIST_SQ = LINK_DIST * LINK_DIST
const CURSOR_DIST = 180 // px — cursor "reach" range
const CURSOR_DIST_SQ = CURSOR_DIST * CURSOR_DIST
const MAX_LINK_OPACITY = 0.22
const CURSOR_LINK_OPACITY = 0.3
const RIPPLE_MS = 600
const TAP_RIPPLE_SPEED = 0.55 // px per ms
const AMBIENT_MIN_MS = 5000 // gap between ambient pulses
const AMBIENT_MAX_MS = 9000

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  baseAlpha: number
  glow: number // 0..1 cursor-driven brightening, eases each frame
}

interface FlowMarker {
  ax: number
  ay: number
  bx: number
  by: number
  t: number // 0..1 along the edge
  speed: number
  life: number // remaining 0..1
}

interface Ripple {
  x: number
  y: number
  start: number // timestamp
  speed: number // px per ms (ambient pulses travel slower)
  alphaScale: number // 1 = tap; <1 = softer ambient pulse
}

function rgba(c: { r: number; g: number; b: number }, a: number): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function NodeNetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Runs only on the client, after first paint — the canvas stays off the LCP path.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    let width = 0
    let height = 0
    let dpr = 1
    const nodes: Node[] = []
    const flows: FlowMarker[] = []
    const ripples: Ripple[] = []

    // Cursor state, in CSS px. `active` gates the reach effect until first move.
    // Only mouse/pen activate it — touch is tap-only (see onPointerMove).
    const cursor = { x: 0, y: 0, active: false }
    let hubIndex = 0
    let nextAmbient = 0 // timestamp of the next self-emitted pulse

    // Cached cursor glow gradient, rebuilt only when the cursor moves.
    let glowCache: CanvasGradient | null = null
    let glowCacheX = NaN
    let glowCacheY = NaN

    function rand(min: number, max: number): number {
      return min + Math.random() * (max - min)
    }

    function targetNodeCount(): number {
      return clamp(Math.round((width * height) / NODE_AREA_PER), NODE_MIN, NODE_MAX)
    }

    function buildNodes(count: number) {
      nodes.length = 0
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: rand(0, width),
          y: rand(0, height),
          vx: rand(-0.05, 0.05),
          vy: rand(-0.05, 0.05),
          radius: rand(1, 2.5),
          baseAlpha: rand(0.25, 0.6),
          glow: 0,
        })
      }
      // One larger ringed "hub" node echoing the Q-mark center node.
      hubIndex = 0
      const hub = nodes[hubIndex]
      if (hub) {
        hub.radius = 3.4
        hub.baseAlpha = 0.7
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      width = rect.width
      height = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas!.width = Math.round(width * dpr)
      canvas!.height = Math.round(height * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Reconcile node count to the new area — only rebuild when the count actually
      // changes, so mobile URL-bar height jitter won't reshuffle the field.
      const desired = targetNodeCount()
      if (nodes.length !== desired) buildNodes(desired)
    }

    function drawConnectors() {
      nodes.forEach((a, i) => {
        nodes.forEach((b, j) => {
          if (j <= i) return
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dsq = dx * dx + dy * dy
          if (dsq > LINK_DIST_SQ) return
          const closeness = 1 - Math.sqrt(dsq) / LINK_DIST
          ctx!.strokeStyle = rgba(GOLD, closeness * MAX_LINK_OPACITY)
          ctx!.lineWidth = 1
          ctx!.beginPath()
          ctx!.moveTo(a.x, a.y)
          ctx!.lineTo(b.x, b.y)
          ctx!.stroke()
        })
      })
    }

    function drawCursorReach() {
      if (!cursor.active) return
      // Soft radial glow trailing the cursor — gradient cached until the cursor moves.
      const cx = Math.round(cursor.x)
      const cy = Math.round(cursor.y)
      if (!glowCache || cx !== glowCacheX || cy !== glowCacheY) {
        const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, CURSOR_DIST)
        g.addColorStop(0, rgba(GOLD, 0.05))
        g.addColorStop(1, rgba(GOLD, 0))
        glowCache = g
        glowCacheX = cx
        glowCacheY = cy
      }
      ctx!.fillStyle = glowCache
      ctx!.fillRect(cx - CURSOR_DIST, cy - CURSOR_DIST, CURSOR_DIST * 2, CURSOR_DIST * 2)

      for (const n of nodes) {
        const dx = n.x - cursor.x
        const dy = n.y - cursor.y
        const dsq = dx * dx + dy * dy
        if (dsq > CURSOR_DIST_SQ) continue
        const closeness = 1 - Math.sqrt(dsq) / CURSOR_DIST
        n.glow = Math.max(n.glow, closeness) // brighten; eased back down in update()
        ctx!.strokeStyle = rgba(HIGHLIGHT, closeness * CURSOR_LINK_OPACITY)
        ctx!.lineWidth = 1
        ctx!.beginPath()
        ctx!.moveTo(n.x, n.y)
        ctx!.lineTo(cursor.x, cursor.y)
        ctx!.stroke()
      }
    }

    function drawNodes() {
      nodes.forEach((n, i) => {
        const color = {
          r: lerp(GOLD.r, FLOW.r, n.glow),
          g: lerp(GOLD.g, FLOW.g, n.glow),
          b: lerp(GOLD.b, FLOW.b, n.glow),
        }
        const alpha = Math.min(1, n.baseAlpha + n.glow * 0.4)
        const radius = n.radius * (1 + n.glow * 0.5)
        ctx!.fillStyle = rgba(color, alpha)
        ctx!.beginPath()
        ctx!.arc(n.x, n.y, radius, 0, Math.PI * 2)
        ctx!.fill()
        // Hub gets a thin ring (the Q-mark echo).
        if (i === hubIndex) {
          ctx!.strokeStyle = rgba(GOLD, Math.min(0.5, alpha))
          ctx!.lineWidth = 1
          ctx!.beginPath()
          ctx!.arc(n.x, n.y, radius + 4, 0, Math.PI * 2)
          ctx!.stroke()
        }
      })
    }

    function drawFlows() {
      for (const f of flows) {
        const x = lerp(f.ax, f.bx, f.t)
        const y = lerp(f.ay, f.by, f.t)
        ctx!.fillStyle = rgba(FLOW, f.life)
        ctx!.beginPath()
        ctx!.arc(x, y, 1.8, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    function drawRipples(now: number) {
      for (const rp of ripples) {
        const age = now - rp.start
        const progress = age / RIPPLE_MS
        const r = age * rp.speed
        const alpha = (1 - progress) * 0.4 * rp.alphaScale
        ctx!.strokeStyle = rgba(GOLD, alpha)
        ctx!.lineWidth = 1.5
        ctx!.beginPath()
        ctx!.arc(rp.x, rp.y, r, 0, Math.PI * 2)
        ctx!.stroke()
        // Flare nodes the ripple front is currently crossing.
        for (const n of nodes) {
          const dx = n.x - rp.x
          const dy = n.y - rp.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (Math.abs(d - r) < 14) n.glow = Math.max(n.glow, alpha * 2)
        }
      }
    }

    interface EmitOpts {
      flows?: number // number of dollar markers to send
      rippleSpeed?: number // px per ms
      rippleAlpha?: number // 1 = full tap; <1 = softer ambient pulse
    }

    // Spawn a ripple at (x, y) and send dollars flowing along the nearest node's edges.
    // Shared by taps (full strength) and ambient circulation (gentle).
    function emit(x: number, y: number, opts: EmitOpts = {}) {
      const flowCount = opts.flows ?? 5
      ripples.push({
        x,
        y,
        start: performance.now(),
        speed: opts.rippleSpeed ?? TAP_RIPPLE_SPEED,
        alphaScale: opts.rippleAlpha ?? 1,
      })
      let nearest: Node | null = null
      let best = Infinity
      for (const n of nodes) {
        const dsq = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y)
        if (dsq < best) {
          best = dsq
          nearest = n
        }
      }
      if (!nearest) return
      const targets = nodes
        .filter((n) => n !== nearest)
        .map((n) => ({ n, d: (n.x - nearest!.x) ** 2 + (n.y - nearest!.y) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, flowCount)
      for (const { n } of targets) {
        flows.push({
          ax: nearest.x,
          ay: nearest.y,
          bx: n.x,
          by: n.y,
          t: 0,
          speed: rand(0.012, 0.025),
          life: 1,
        })
      }
    }

    // Self-emitted "dollars in motion" so the network feels alive without interaction.
    function emitAmbient() {
      const n = nodes[Math.floor(Math.random() * nodes.length)]
      if (!n) return
      emit(n.x, n.y, { flows: 3, rippleSpeed: 0.38, rippleAlpha: 0.55 })
    }

    function update() {
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        // Wrap at edges for a continuous calm drift.
        if (n.x < -5) n.x = width + 5
        else if (n.x > width + 5) n.x = -5
        if (n.y < -5) n.y = height + 5
        else if (n.y > height + 5) n.y = -5
        n.glow *= 0.92 // ease brightening back down
        if (n.glow < 0.01) n.glow = 0
      }
      for (let i = flows.length - 1; i >= 0; i--) {
        const f = flows[i]
        if (!f) continue
        f.t += f.speed
        if (f.t >= 1) f.life -= 0.08
        if (f.t >= 1 && f.life <= 0) flows.splice(i, 1)
      }
      const now = performance.now()
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i]
        if (rp && now - rp.start > RIPPLE_MS) ripples.splice(i, 1)
      }
      // Ambient circulation — only while the loop runs (so off under reduced-motion
      // and when the tab is hidden).
      if (now >= nextAmbient) {
        emitAmbient()
        nextAmbient = now + rand(AMBIENT_MIN_MS, AMBIENT_MAX_MS)
      }
    }

    function render(now: number) {
      ctx!.clearRect(0, 0, width, height)
      drawConnectors()
      drawCursorReach()
      drawRipples(now)
      drawFlows()
      drawNodes()
    }

    // ── Static (reduced-motion) path ──────────────────────────────────────────
    function renderStatic() {
      ctx!.clearRect(0, 0, width, height)
      drawConnectors()
      drawNodes()
    }

    let rafId = 0
    let running = false

    function loop(now: number) {
      update()
      render(now)
      rafId = requestAnimationFrame(loop)
    }

    function start() {
      if (running) return
      running = true
      // Schedule the first ambient pulse a few seconds out (also resets on resume,
      // so the network doesn't pulse instantly when a hidden tab returns).
      nextAmbient = performance.now() + rand(AMBIENT_MIN_MS, AMBIENT_MAX_MS)
      rafId = requestAnimationFrame(loop)
    }

    function stop() {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
    }

    // ── Event handlers ────────────────────────────────────────────────────────
    // Touch is tap-only: only a real hovering pointer (mouse/pen) drives the reach
    // effect, so touch never activates the glow (no stuck-glow artifact).
    function onPointerMove(e: PointerEvent) {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
      const rect = canvas!.getBoundingClientRect()
      cursor.x = e.clientX - rect.left
      cursor.y = e.clientY - rect.top
      cursor.active = true
    }

    function onPointerDown(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      emit(e.clientX - rect.left, e.clientY - rect.top)
    }

    function onVisibility() {
      if (document.hidden) stop()
      else if (!reduceMotion.matches) start()
    }

    function applyMotionPreference() {
      stop()
      resize()
      if (reduceMotion.matches) {
        renderStatic()
      } else {
        start()
      }
    }

    function onResize() {
      resize()
      if (reduceMotion.matches) renderStatic()
    }

    // ── Wire up ───────────────────────────────────────────────────────────────
    resize()
    window.addEventListener('resize', onResize)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    reduceMotion.addEventListener('change', applyMotionPreference)

    applyMotionPreference()

    return () => {
      stop()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('visibilitychange', onVisibility)
      reduceMotion.removeEventListener('change', applyMotionPreference)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
    />
  )
}
