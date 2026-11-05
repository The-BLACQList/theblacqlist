'use client'

/**
 * The Collective scene (tickets 167 and 171). Round 17 concept D: a tall gold
 * cage you look down into, one floor per level, each category family in its
 * own wedge, spiralling down to a gold hub. Loaded on its own chunk by
 * SiloExperience, only on /flow-map and only after the HTML is on screen.
 *
 * Every published business is drawn. Links only appear for businesses with
 * enough counted receipts behind them. Shoppers are one group: a ring and a
 * glow per family on the top floor, never a dot per person.
 *
 * Everything the reader needs is also in the HUD and the list, so the canvas
 * is aria-hidden. The scene draws only while it's on screen and the tab is
 * visible; with motion off it draws on demand, once per change.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import {
  CATEGORY_FAMILIES,
  FALLBACK_FAMILY_INDEX,
  GOLD,
  GOLD_BRIGHT,
  LABEL_KEEP,
  LEVEL_COLORS,
  SILO,
  ORBIT,
  ORBIT_KEYS,
  SILO_FLOORS,
  businessDisplayName,
  busiestFamily,
  clusterRadius,
  colorForBusiness,
  crowdAnchor,
  focusFrame,
  headingTo,
  linkControlPoints,
  orbitForScroll,
  orbitPose,
  overlaps,
  pickLabels,
  pulseProgress,
  pulseSchedule,
  scrollForFloor,
  smoothDamp,
  snapLabelPos,
  wedgeAngle,
  wedgePoint,
  wrapAngle,
  type ColorBy,
  type LabelBox,
  type LabelCandidate,
  type Orbit,
  type PlacedBusiness,
  type Point3,
  type SiloBusiness,
  type SiloGap,
} from '@/lib/spend/silo-layout'
import { FLOOR_ICON_PATHS } from './floor-icons'

const BG_HEX = '#0a0907'
const BG = new THREE.Color(BG_HEX)
const FOG_DENSITY = 0.0092
const DRAG_THRESHOLD_PX = 5
const LINK_SEGMENTS = 20
const ATLAS_CELLS = 8
const CELL = 128
const GAP_HEX = '#ff8ccf'
/** A gap square's size in scene units. */
const GAP_SIZE = 2.6

export interface SiloSceneProps {
  businesses: readonly SiloBusiness[]
  placed: ReadonlyMap<string, PlacedBusiness>
  colorBy: ColorBy
  /** Same order as `businesses`. False dims the node and hides its link. */
  visible: readonly boolean[]
  selectedId: string | null
  hoveredId: string | null
  focusFloor: number | null
  /** Ambient motion: hub turn and pulses. Off for reduced motion or Pause. */
  motion: boolean
  /** The reader asked for less motion: camera moves snap instead of glide. */
  reducedMotion?: boolean
  /** On screen and the tab is visible. Off means draw nothing new. */
  active: boolean
  /** A business id, or null when the reader clicks empty space. */
  onSelect: (id: string | null) => void
  /** The reader clicked a floor's ring. */
  onPickFloor?: (floor: number) => void
  onHover: (id: string | null) => void
  onContextLost: () => void
  hoverTagRef: RefObject<HTMLDivElement | null>
  youTagRef: RefObject<HTMLDivElement | null>
  /** One child per floor, in SILO_FLOORS order, placed over that floor. */
  signsRef?: RefObject<HTMLDivElement | null>
  /** Wedges with no business on the list yet: a pink square each. */
  gaps: readonly SiloGap[]
  selectedGap: SiloGap | null
  onSelectGap?: (gap: SiloGap | null) => void
  /** A pool of name labels, filled each frame with the nearest businesses. */
  labelsRef?: RefObject<HTMLDivElement | null>
  /** One label per gap, in `gaps` order. */
  gapLabelsRef?: RefObject<HTMLDivElement | null>
}

/** A small fixed-seed generator, so the sky is the same on every visit. */
function seededRandom(start: number): () => number {
  let seed = start
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

/** Uniforms are written each frame, outside React's view of the memo. */
function setUniform(u: { value: number }, value: number) {
  u.value = value
}

/** DOM writes for the canvas and the HUD labels, kept out of hook bodies. */
function setTouchAction(el: HTMLElement, value: string) {
  el.style.touchAction = value
}

function moveLabel(el: HTMLElement, slot: LabelSlot, l: number, t: number) {
  if (l === slot.l && t === slot.t) return
  slot.l = l
  slot.t = t
  el.style.transform = `translate3d(${l}px, ${t}px, 0)`
}

function toggleLabel(el: HTMLElement, slot: LabelSlot, on: boolean) {
  if (slot.on === on) return
  slot.on = on
  el.classList.toggle('on', on)
}

function fillLabel(el: HTMLElement, name: string, family: string, color: string) {
  const b = el.querySelector('b')
  const small = el.querySelector('small')
  const dot = el.querySelector<HTMLElement>('.dot')
  if (b) b.textContent = name
  if (small) small.textContent = family
  if (dot) dot.style.background = color
}

function isPhone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse), (max-width: 640px)').matches
}

export default function SiloScene(props: SiloSceneProps) {
  const { motion, active, onContextLost } = props
  const phone = useMemo(() => isPhone(), [])
  return (
    <Canvas
      aria-hidden="true"
      flat
      frameloop={motion && active ? 'always' : 'demand'}
      dpr={[1, phone ? 1.5 : 2]}
      camera={{ position: [0, 46, 6], fov: phone ? 72 : 62, near: 0.1, far: 900 }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => {
        gl.setClearColor(BG, 1)
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          onContextLost()
        })
      }}
    >
      <fogExp2 attach="fog" args={[BG_HEX, FOG_DENSITY]} />
      <SceneContents {...props} phone={phone} />
    </Canvas>
  )
}

interface Shown {
  b: SiloBusiness
  p: PlacedBusiness
  on: boolean
  /** Resting size in scene units. */
  size: number
}

interface Halo {
  floor: number
  center: Point3
  /** Ring radius in scene units. */
  radius: number
  familyIndex: number
}

type Inner = SiloSceneProps & { phone: boolean }

function SceneContents(props: Inner) {
  const { businesses, placed, visible, motion, active, phone } = props
  const invalidate = useThree((s) => s.invalidate)

  // Any prop change redraws once, even with the loop on demand.
  useEffect(() => {
    if (active) invalidate()
  })

  const textures = useTextures()

  const { shown, halos } = useMemo(() => {
    const rows = businesses
      .map((b, i) => ({ b, p: placed.get(b.id), on: visible[i] ?? true }))
      .filter((x): x is { b: SiloBusiness; p: PlacedBusiness; on: boolean } => !!x.p)

    const counts = new Map<string, number>()
    for (const r of rows) {
      const key = `${r.b.familyIndex}:${r.b.floorIndex}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    // Linked businesses grow with what was spent there. The rest share one
    // size, small enough that a busy wedge doesn't pile up.
    const max = Math.max(1, ...rows.filter((r) => r.b.linked).map((r) => r.b.amountCents))
    const sized: Shown[] = rows.map((r) => {
      if (r.b.linked) return { ...r, size: 0.22 + 0.72 * Math.sqrt(r.b.amountCents / max) }
      const n = counts.get(`${r.b.familyIndex}:${r.b.floorIndex}`) ?? 1
      const spacing = clusterRadius(n) * Math.sqrt(Math.PI / n)
      return { ...r, size: THREE.MathUtils.clamp(spacing * 0.55, 0.16, 0.42) }
    })

    const rings: Halo[] = CATEGORY_FAMILIES.map((_, fi) => ({
      floor: 0,
      center: crowdAnchor(fi),
      radius: SILO.crowdR,
      familyIndex: fi,
    }))
    for (const [key, n] of counts) {
      const [fi, k] = key.split(':').map(Number) as [number, number]
      if (k === 0) continue
      rings.push({ floor: k, center: wedgePoint(fi, k), radius: clusterRadius(n), familyIndex: fi })
    }
    return { shown: sized, halos: rings }
  }, [businesses, placed, visible])

  return (
    <>
      <Controls {...props} shown={shown} halos={halos} />
      <Cage />
      <Sky phone={phone} dot={textures.dot} />
      <Hub glow={textures.glow} motion={motion} />
      <Halos halos={halos} colorBy={props.colorBy} focusFloor={props.focusFloor} textures={textures} />
      <Links shown={shown} colorBy={props.colorBy} selectedId={props.selectedId} />
      {motion && active && <Pulses shown={shown} dot={textures.dot} />}
      <Nodes {...props} shown={shown} textures={textures} />
      <Gaps gaps={props.gaps} selected={props.selectedGap} tex={textures.gap} ring={textures.ring} phone={phone} />
      <Marks shown={shown} selectedId={props.selectedId} ring={textures.ring} />
      <Tags {...props} shown={shown} />
    </>
  )
}

// ─── Textures ────────────────────────────────────────────────────────────────

interface Textures {
  glow: THREE.Texture
  dot: THREE.Texture
  ring: THREE.Texture
  atlas: THREE.Texture
  gap: THREE.Texture
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx) draw(ctx)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function radial(stops: readonly [number, number][], s: number) {
  return canvasTexture(s, s, (ctx) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    for (const [at, a] of stops) g.addColorStop(at, `rgba(255,255,255,${a})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  })
}

/** One cell per floor icon: a dark disc, a white rim, the icon on top. */
function drawNode(ctx: CanvasRenderingContext2D, ox: number, paths: readonly string[]) {
  const s = CELL
  const c = s / 2
  ctx.save()
  ctx.translate(ox, 0)
  const g = ctx.createRadialGradient(c, c * 0.8, 0, c, c, s * 0.4)
  g.addColorStop(0, 'rgba(70,58,34,.96)')
  g.addColorStop(1, 'rgba(14,12,8,.96)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(c, c, s * 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowColor = 'rgba(255,255,255,.9)'
  ctx.shadowBlur = s * 0.06
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = s * 0.05
  ctx.beginPath()
  ctx.arc(c, c, s * 0.4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.translate(c - s * 0.2, c - s * 0.2)
  ctx.scale((s * 0.4) / 24, (s * 0.4) / 24)
  ctx.lineWidth = 2.1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const d of paths) ctx.stroke(new Path2D(d))
  ctx.restore()
}

function useTextures(): Textures {
  const textures = useMemo<Textures>(
    () => ({
      glow: radial(
        [
          [0, 1],
          [0.18, 0.55],
          [0.45, 0.14],
          [1, 0],
        ],
        128
      ),
      dot: radial(
        [
          [0, 1],
          [0.35, 0.7],
          [1, 0],
        ],
        32
      ),
      ring: canvasTexture(128, 128, (ctx) => {
        const s = 128
        ctx.strokeStyle = '#fff'
        ctx.globalAlpha = 0.22
        ctx.lineWidth = 12
        ctx.beginPath()
        ctx.arc(s / 2, s / 2, s / 2 - 10, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.lineWidth = 3.5
        ctx.beginPath()
        ctx.arc(s / 2, s / 2, s / 2 - 10, 0, Math.PI * 2)
        ctx.stroke()
      }),
      atlas: canvasTexture(CELL * ATLAS_CELLS, CELL, (ctx) => {
        FLOOR_ICON_PATHS.forEach((paths, i) => drawNode(ctx, i * CELL, paths))
      }),
      // Round 17's gap: a dashed pink square, a place with no business yet.
      gap: canvasTexture(128, 128, (ctx) => {
        ctx.fillStyle = 'rgba(255,140,207,.18)'
        ctx.fillRect(14, 14, 100, 100)
        ctx.setLineDash([13, 9])
        ctx.lineWidth = 6
        ctx.strokeStyle = GAP_HEX
        ctx.strokeRect(14, 14, 100, 100)
      }),
    }),
    []
  )
  useEffect(
    () => () => {
      Object.values(textures).forEach((t) => t.dispose())
    },
    [textures]
  )
  return textures
}

// ─── Colors ──────────────────────────────────────────────────────────────────

function familyColor(fi: number): string {
  return (CATEGORY_FAMILIES[fi] ?? CATEGORY_FAMILIES[FALLBACK_FAMILY_INDEX]!).color
}

/** A floor ring's color: its family, its level, or plain gold. */
function haloColor(h: Halo, colorBy: ColorBy): string {
  if (colorBy === 'gold') return GOLD
  if (colorBy === 'level') {
    const key = SILO_FLOORS[h.floor]?.key
    return key && key !== 'shoppers' ? LEVEL_COLORS[key] : GOLD
  }
  return familyColor(h.familyIndex)
}

/** Where a link starts: the shopper crowd, in the same color system. */
function crowdColor(fi: number, colorBy: ColorBy): string {
  return colorBy === 'category' ? familyColor(fi) : GOLD
}

// ─── Camera and input ────────────────────────────────────────────────────────

interface Focus {
  kind: 'business' | 'floor' | 'gap'
  orbit: Orbit
}

interface Rig {
  /** Where along the silo the view is, 0 (top) to 1 (bottom). */
  t: number
  az: number
  el: number
  focus: Focus | null
  /** Heading speed a drag leaves behind, in radians a second. */
  spin: number
  dragging: boolean
  /** Seconds to settle, from the last thing that moved the view. */
  ease: number
  /** Where the camera is now, on its way to the goal. */
  cur: Orbit
  vel: Orbit
}

const DRAG_TURN = 0.006
const DRAG_TILT = 0.0032
/** A drag that paused this long before release leaves no spin. */
const SPIN_STALE_MS = 80
/** Radians a second. Even a hard flick coasts under a quarter turn. */
const SPIN_MAX = 3

/** Turns whichever view is live, so a close-up circles what it's looking at. */
function turn(r: Rig, dAz: number, dEl: number) {
  const o = r.focus?.orbit ?? r
  o.az += dAz
  o.el = THREE.MathUtils.clamp(o.el + dEl, ORBIT.minEl, ORBIT.maxEl)
}

function focusOn(r: Rig, kind: Focus['kind'], p: Point3, floor: number | undefined) {
  if (floor !== undefined) r.t = scrollForFloor(floor)
  r.focus = { kind, orbit: focusFrame(p, kind) }
  r.spin = 0
  r.ease = ORBIT.jumpS
}

/** Back to the floor view, keeping the heading so nothing swings round. */
function clearFocus(r: Rig) {
  if (!r.focus) return
  r.az = r.focus.orbit.az
  r.focus = null
  r.ease = ORBIT.jumpS
}

const v3 = (p: Point3) => new THREE.Vector3(p.x, p.y, p.z)
const projected = new THREE.Vector3()
const worldTmp = new THREE.Vector3()

type Pick =
  | { kind: 'business'; id: string }
  | { kind: 'gap'; gap: SiloGap }
  | { kind: 'halo'; halo: Halo }
  | null

function Controls(props: Inner & { shown: readonly Shown[]; halos: readonly Halo[] }) {
  const { camera, gl, invalidate } = useThree()
  const rig = useRef<Rig>({
    t: 0,
    az: 0,
    el: ORBIT.el,
    focus: null,
    spin: 0,
    dragging: false,
    ease: ORBIT.easeS,
    cur: orbitForScroll(0, 0, ORBIT.el),
    vel: { x: 0, y: 0, z: 0, az: 0, el: 0, R: 0 },
  })
  const pendingFloor = useRef<number | null>(null)
  const live = useRef(props)
  useEffect(() => {
    live.current = props
  })

  // First frame: start at the top of the silo, looking down.
  useEffect(() => {
    const { pos, look } = orbitPose(rig.current.cur)
    camera.position.set(pos.x, pos.y, pos.z)
    camera.lookAt(look.x, look.y, look.z)
  }, [camera])

  // A floor from the gauge: turn to its busiest wedge, so its dots are in frame.
  const { focusFloor, selectedId, placed } = props
  useEffect(() => {
    const r = rig.current
    if (focusFloor === null) {
      if (r.focus?.kind === 'floor') clearFocus(r)
      invalidate()
      return
    }
    const fromRing = pendingFloor.current === focusFloor
    pendingFloor.current = null
    if (fromRing) return
    const on = live.current.shown.filter((s) => s.on).map((s) => s.b)
    const family = busiestFamily(on, focusFloor)
    clearFocus(r)
    r.t = scrollForFloor(focusFloor)
    r.el = family === null ? ORBIT.el : ORBIT.floorEl
    if (family !== null) r.az = headingTo(wedgePoint(family, focusFloor))
    r.spin = 0
    r.ease = ORBIT.jumpS
    invalidate()
  }, [focusFloor, invalidate])

  // A business: move in close and look at it.
  useEffect(() => {
    const r = rig.current
    const p = selectedId ? placed.get(selectedId) : undefined
    if (!p) {
      if (r.focus?.kind === 'business') clearFocus(r)
      invalidate()
      return
    }
    focusOn(r, 'business', p, live.current.businesses.find((b) => b.id === selectedId)?.floorIndex)
    invalidate()
  }, [selectedId, placed, invalidate])

  // A gap: frame its square from above, like a floor ring.
  const { selectedGap } = props
  useEffect(() => {
    const r = rig.current
    if (!selectedGap) {
      if (r.focus?.kind === 'gap') clearFocus(r)
      invalidate()
      return
    }
    focusOn(r, 'gap', wedgePoint(selectedGap.familyIndex, selectedGap.floorIndex), selectedGap.floorIndex)
    invalidate()
  }, [selectedGap, invalidate])

  useEffect(() => {
    const el = gl.domElement
    const section = el.closest<HTMLElement>('.silo')
    let down: {
      id: number
      x: number
      y: number
      lastX: number
      lastY: number
      /** When the last move landed, for the speed a drag leaves behind. */
      at: number
      mouse: boolean
      drag: boolean
      /** Touch only: the stage was docked, so a vertical swipe travels. */
      travel: boolean
      axis: 'x' | 'y' | null
    } | null = null
    let hovered: string | null = null

    function pickAt(clientX: number, clientY: number): Pick {
      const rect = el.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      const cam = camera as THREE.PerspectiveCamera
      const kpx = rect.height / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)
      // Screen point and pixel radius for a world point and world radius.
      const toScreen = (p: Point3, worldR: number) => {
        projected.set(p.x, p.y, p.z).project(cam)
        if (projected.z > 1 || projected.z < -1) return null
        const dist = Math.max(cam.position.distanceTo(worldTmp.set(p.x, p.y, p.z)), 0.1)
        return {
          d: Math.hypot(((projected.x + 1) / 2) * rect.width - x, ((1 - projected.y) / 2) * rect.height - y),
          r: (worldR * kpx) / dist,
        }
      }
      let best: Pick = null
      let bestD = Infinity
      for (const s of live.current.shown) {
        if (!s.on) continue
        const sp = toScreen(s.p, s.size)
        if (sp && sp.d < Math.max(sp.r + 6, 12) && sp.d < bestD) {
          bestD = sp.d
          best = { kind: 'business', id: s.b.id }
        }
      }
      if (best) return best
      for (const g of live.current.gaps) {
        const sp = toScreen(wedgePoint(g.familyIndex, g.floorIndex), GAP_SIZE / 2)
        if (sp && sp.d < Math.max(sp.r, 14) && sp.d < bestD) {
          bestD = sp.d
          best = { kind: 'gap', gap: g }
        }
      }
      if (best) return best
      for (const h of live.current.halos) {
        const sp = toScreen(h.center, h.radius + 0.8)
        if (sp && sp.d < Math.max(sp.r, 18) && sp.d < bestD) {
          bestD = sp.d
          best = { kind: 'halo', halo: h }
        }
      }
      return best
    }

    function focusRing(h: Halo) {
      focusOn(rig.current, 'floor', h.center, h.floor)
      const l = live.current
      if (l.selectedId) l.onSelect(null)
      if (l.focusFloor !== h.floor && l.onPickFloor) {
        pendingFloor.current = h.floor
        l.onPickFloor(h.floor)
      }
      invalidate()
    }

    function setHover(id: string | null) {
      if (id === hovered) return
      hovered = id
      live.current.onHover(id)
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      down = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        at: e.timeStamp,
        mouse: e.pointerType !== 'touch',
        drag: false,
        travel: e.pointerType === 'touch' && el.style.touchAction === 'none',
        axis: null,
      }
      rig.current.spin = 0
      el.setPointerCapture?.(e.pointerId)
    }

    const onMove = (e: PointerEvent) => {
      if (down && e.pointerId === down.id) {
        if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_THRESHOLD_PX) {
          down.drag = true
          el.style.cursor = 'grabbing'
        }
        if (down.drag) {
          const r = rig.current
          const dx = e.clientX - down.lastX
          const dy = e.clientY - down.lastY
          // A swipe keeps one direction: sideways turns, up and down travels.
          if (!down.mouse) {
            down.axis ??= Math.abs(e.clientX - down.x) >= Math.abs(e.clientY - down.y) ? 'x' : 'y'
          }
          if (down.mouse || down.axis === 'x') {
            const dAz = -dx * DRAG_TURN
            turn(r, dAz, down.mouse ? dy * DRAG_TILT : 0)
            r.dragging = true
            r.ease = ORBIT.easeS
            const speed = dAz / Math.max((e.timeStamp - down.at) / 1000, 0.001)
            r.spin = THREE.MathUtils.clamp(r.spin * 0.6 + speed * 0.4, -SPIN_MAX, SPIN_MAX)
          } else if (down.travel) travel(-dy * 0.0022, -dy)
          down.at = e.timeStamp
          invalidate()
        }
        down.lastX = e.clientX
        down.lastY = e.clientY
        return
      }
      if (e.pointerType !== 'mouse') return
      const hit = pickAt(e.clientX, e.clientY)
      el.style.cursor = hit ? 'pointer' : ''
      setHover(hit?.kind === 'business' ? hit.id : null)
    }

    const onUp = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return
      const wasDrag = down.drag
      const r = rig.current
      const l = live.current
      if (l.reducedMotion || e.timeStamp - down.at > SPIN_STALE_MS) r.spin = 0
      r.dragging = false
      down = null
      el.releasePointerCapture?.(e.pointerId)
      el.style.cursor = ''
      invalidate()
      if (wasDrag) return
      const hit = pickAt(e.clientX, e.clientY)
      if (hit?.kind === 'business') {
        // The same dot again: a scroll may have left it, so frame it once more.
        const p = hit.id === l.selectedId ? l.placed.get(hit.id) : undefined
        if (p) focusOn(r, 'business', p, l.businesses.find((b) => b.id === hit.id)?.floorIndex)
        l.onSelect(hit.id)
      }
      else if (hit?.kind === 'gap') l.onSelectGap?.(hit.gap)
      else if (hit?.kind === 'halo') focusRing(hit.halo)
      else {
        l.onSelect(null)
        l.onSelectGap?.(null)
      }
    }

    const onCancel = () => {
      down = null
      rig.current.dragging = false
      rig.current.spin = 0
      el.style.cursor = ''
    }

    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && !down) {
        el.style.cursor = ''
        setHover(null)
      }
    }

    /** Moves down (+) or up (-) the silo. Past either end, the page scrolls. */
    function travel(dt: number, pagePx = 0) {
      const r = rig.current
      if (!r.focus && ((r.t <= 0 && dt < 0) || (r.t >= 1 && dt > 0))) {
        if (pagePx) window.scrollBy(0, pagePx)
        return
      }
      r.ease = ORBIT.easeS
      clearFocus(r)
      r.t = THREE.MathUtils.clamp(r.t + dt, 0, 1)
      invalidate()
    }

    // ── Page scroll versus silo travel ──
    //
    // The section is "docked" when it fills the window below the site header.
    // Until then the wheel scrolls the page, and a wheel toward the dock
    // snaps it into place. Once docked the wheel travels the silo, and only a
    // fresh wheel past either end goes back to the page. One gesture never
    // does both, so the page doesn't jump mid-scroll.

    const PANELS = '.ctx, .more-panel, .silo-stage-list-inner, .keymap'
    const GESTURE_GAP_MS = 220

    function dockOffset(rect: DOMRect): number {
      return Math.max(0, window.innerHeight - rect.height)
    }

    function isDocked(rect: DOMRect): boolean {
      const target = dockOffset(rect)
      return (
        Math.abs(rect.top - target) <= 12 ||
        (rect.top <= target && rect.bottom >= window.innerHeight - 1)
      )
    }

    function panelCanScroll(target: EventTarget | null, dy: number): boolean {
      const box = target instanceof Element ? target.closest<HTMLElement>(PANELS) : null
      if (!box) return false
      return dy < 0 ? box.scrollTop > 0 : box.scrollTop + box.clientHeight < box.scrollHeight - 1
    }

    let gesture: { mode: 'snap' | 'scene' | 'page'; last: number } | null = null

    function decide(dy: number): 'snap' | 'scene' | 'page' {
      if (!section) return 'scene'
      const rect = section.getBoundingClientRect()
      if (!isDocked(rect)) {
        const target = dockOffset(rect)
        const toward = (dy > 0 && rect.top > target) || (dy < 0 && rect.top < target)
        if (!toward) return 'page'
        window.scrollTo({
          top: window.scrollY + rect.top - target,
          behavior: live.current.reducedMotion ? 'auto' : 'smooth',
        })
        return 'snap'
      }
      const r = rig.current
      if (!r.focus && ((r.t <= 0 && dy < 0) || (r.t >= 1 && dy > 0))) return 'page'
      return 'scene'
    }

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return
      const dy =
        e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY
      if (Math.abs(dy) <= Math.abs(e.deltaX) || panelCanScroll(e.target, dy)) return
      const now = performance.now()
      if (!gesture || now - gesture.last > GESTURE_GAP_MS) gesture = { mode: decide(dy), last: now }
      gesture.last = now
      if (gesture.mode === 'page') return
      e.preventDefault()
      if (gesture.mode === 'scene') travel(dy * 0.0007)
    }

    // On touch, a vertical swipe on the canvas scrolls the page until the
    // stage is fully on screen, then travels the silo.
    const coarse = window.matchMedia('(pointer: coarse)')
    function updateTouchMode() {
      if (!coarse.matches) {
        setTouchAction(el, '')
        return
      }
      const rect = el.getBoundingClientRect()
      const docked = rect.top >= 0 && rect.bottom <= window.innerHeight + 8 && rect.height > 0
      setTouchAction(el, docked ? 'none' : 'pan-y')
    }
    updateTouchMode()

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    el.addEventListener('pointerleave', onLeave)
    const wheelTarget = section ?? el
    wheelTarget.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('scroll', updateTouchMode, { passive: true })
    window.addEventListener('resize', updateTouchMode)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('pointerleave', onLeave)
      wheelTarget.removeEventListener('wheel', onWheel)
      window.removeEventListener('scroll', updateTouchMode)
      window.removeEventListener('resize', updateTouchMode)
    }
  }, [gl, camera, invalidate])

  useFrame((_, delta) => {
    const l = live.current
    if (!l.active) return
    const r = rig.current
    const dt = Math.min(delta, 0.05)

    // A released drag carries on and fades out.
    if (r.spin && !r.dragging) {
      turn(r, r.spin * dt, 0)
      r.spin *= Math.exp(-4 * dt)
      if (Math.abs(r.spin) < 0.01) r.spin = 0
    }

    const goal = r.focus?.orbit ?? orbitForScroll(r.t, r.az, r.el)
    let settled = !r.spin
    for (const k of ORBIT_KEYS) {
      const gap = k === 'az' ? wrapAngle(goal.az - r.cur.az) : goal[k] - r.cur[k]
      if (l.reducedMotion || (Math.abs(gap) < 0.001 && Math.abs(r.vel[k]) < 0.001)) {
        r.cur[k] = goal[k]
        r.vel[k] = 0
        continue
      }
      const [value, velocity] = smoothDamp(r.cur[k], r.cur[k] + gap, r.vel[k], r.ease, dt)
      r.cur[k] = value
      r.vel[k] = velocity
      settled = false
    }

    const { pos, look } = orbitPose(r.cur)
    camera.position.set(pos.x, pos.y, pos.z)
    camera.lookAt(look.x, look.y, look.z)

    // With the loop on demand, keep drawing until the move settles.
    if (!settled && !l.motion) invalidate()
  })

  return null
}

// ─── The cage, sky and hub ───────────────────────────────────────────────────

function lineGeometry(pts: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  return geo
}

function circle(out: number[], r: number, y: number, seg = 96) {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2
    const a1 = ((i + 1) / seg) * Math.PI * 2
    out.push(Math.cos(a0) * r, y, Math.sin(a0) * r, Math.cos(a1) * r, y, Math.sin(a1) * r)
  }
}

function disposeAll(objects: readonly (THREE.Points | THREE.LineSegments)[]) {
  for (const o of objects) {
    o.geometry.dispose()
    ;(o.material as THREE.Material).dispose()
  }
}

/** Thin gold rings and ribs for the wall, a brighter ring per floor, spokes to each wedge. */
function Cage() {
  const objects = useMemo(() => {
    const faint: number[] = []
    for (let y = 48; y >= -48; y -= 3.4) circle(faint, SILO.R, y, 72)
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      faint.push(Math.cos(a) * SILO.R, 48, Math.sin(a) * SILO.R, Math.cos(a) * SILO.R, -48, Math.sin(a) * SILO.R)
    }
    const floors: number[] = [0, 48, 0, 0, -44, 0]
    for (const y of SILO.y) circle(floors, SILO.R, y)
    const spokes: number[] = []
    const reach = SILO.rA - SILO.cr - 0.6
    SILO.y.forEach((y, k) => {
      for (let i = 0; i < CATEGORY_FAMILIES.length; i++) {
        const a = wedgeAngle(i, k)
        spokes.push(0, y, 0, Math.cos(a) * reach, y, Math.sin(a) * reach)
      }
    })
    const mk = (pts: number[], opacity: number) =>
      new THREE.LineSegments(
        lineGeometry(pts),
        new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity, depthWrite: false })
      )
    return [mk(faint, 0.045), mk(floors, 0.15), mk(spokes, 0.05)]
  }, [])
  useEffect(() => () => disposeAll(objects), [objects])
  return (
    <>
      {objects.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </>
  )
}

/** Far stars and the dust inside the silo. Fixed, seeded, no motion. */
function Sky({ phone, dot }: { phone: boolean; dot: THREE.Texture }) {
  const objects = useMemo(() => {
    const rand = seededRandom(7)
    const n = phone ? 1100 : 2000
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1
      const a = rand() * Math.PI * 2
      const r = 380 + rand() * 200
      const s = Math.sqrt(1 - u * u)
      pos.set([r * s * Math.cos(a), r * u, r * s * Math.sin(a)], i * 3)
      const w = 0.35 + rand() * 0.65
      col.set(rand() < 0.5 ? [w, w * 0.82, w * 0.5] : [w, w * 0.95, w * 0.9], i * 3)
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        size: 1.6,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        fog: false,
        depthWrite: false,
      })
    )

    const m = phone ? 160 : 320
    const mp = new Float32Array(m * 3)
    for (let i = 0; i < m; i++) {
      const r = Math.sqrt(rand()) * (SILO.R - 1)
      const a = rand() * Math.PI * 2
      mp.set([Math.cos(a) * r, 46 - rand() * 92, Math.sin(a) * r], i * 3)
    }
    const moteGeo = new THREE.BufferGeometry()
    moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3))
    const motes = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({
        size: 0.14,
        map: dot,
        color: 0xf6d58a,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    return [stars, motes]
  }, [phone, dot])
  useEffect(() => () => disposeAll(objects), [objects])
  return (
    <>
      {objects.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </>
  )
}

/** Where the money would settle: a turning gold lattice. No label. */
function Hub({ glow, motion }: { glow: THREE.Texture; motion: boolean }) {
  const wire = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (!motion || !wire.current) return
    const dt = Math.min(delta, 0.05)
    wire.current.rotation.y += dt * 0.12
    wire.current.rotation.x += dt * 0.05
  })
  return (
    <group position={[SILO.hub.x, SILO.hub.y, SILO.hub.z]}>
      <mesh ref={wire}>
        <icosahedronGeometry args={[SILO.hubR, 2]} />
        <meshBasicMaterial color={GOLD} wireframe transparent opacity={0.32} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[SILO.hubR * 0.32, 24, 16]} />
        <meshBasicMaterial color="#FFF3D0" />
      </mesh>
      <sprite scale={SILO.hubR * 5.5}>
        <spriteMaterial
          map={glow}
          color={GOLD}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  )
}

// ─── Floor rings ─────────────────────────────────────────────────────────────

function Halos({
  halos,
  colorBy,
  focusFloor,
  textures,
}: {
  halos: readonly Halo[]
  colorBy: ColorBy
  focusFloor: number | null
  textures: Textures
}) {
  return (
    <>
      {halos.map((h) => {
        const color = haloColor(h, colorBy)
        const lit = focusFloor === h.floor
        return (
          <group key={`${h.familyIndex}:${h.floor}`} position={[h.center.x, h.center.y, h.center.z]}>
            <sprite scale={(h.radius + 0.8) * 2.2} renderOrder={1}>
              <spriteMaterial
                map={textures.ring}
                color={color}
                transparent
                opacity={lit ? 0.42 : 0.2}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </sprite>
            {h.floor === 0 && (
              // The shopper crowd: one soft glow, never a dot per person.
              <sprite scale={SILO.crowdR * 2.4} renderOrder={1}>
                <spriteMaterial
                  map={textures.glow}
                  color={color}
                  transparent
                  opacity={0.25}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </sprite>
            )}
          </group>
        )
      })}
    </>
  )
}

// ─── Links and pulses ────────────────────────────────────────────────────────

function linkCurve(s: Shown) {
  const [a, b, c, d] = linkControlPoints(crowdAnchor(s.b.familyIndex), s.p)
  return new THREE.CubicBezierCurve3(v3(a), v3(b), v3(c), v3(d))
}

/** One line per linked business, from its family's crowd down to it. */
function Links({
  shown,
  colorBy,
  selectedId,
}: {
  shown: readonly Shown[]
  colorBy: ColorBy
  selectedId: string | null
}) {
  const line = useMemo(() => {
    const links = shown.filter((s) => s.on && s.b.linked)
    const pos: number[] = []
    const col: number[] = []
    const ca = new THREE.Color()
    const cb = new THREE.Color()
    const c = new THREE.Color()
    for (const s of links) {
      const pts = linkCurve(s).getPoints(LINK_SEGMENTS)
      const k = s.b.id === selectedId ? 0.95 : s.b.isYou ? 0.85 : 0.26
      ca.set(crowdColor(s.b.familyIndex, colorBy)).multiplyScalar(k)
      cb.set(colorForBusiness(s.b, colorBy)).multiplyScalar(k)
      for (let i = 0; i < LINK_SEGMENTS; i++) {
        const p0 = pts[i]!
        const p1 = pts[i + 1]!
        pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z)
        c.copy(ca).lerp(cb, i / LINK_SEGMENTS)
        col.push(c.r, c.g, c.b)
        c.copy(ca).lerp(cb, (i + 1) / LINK_SEGMENTS)
        col.push(c.r, c.g, c.b)
      }
    }
    const geo = lineGeometry(pos)
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    const obj = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    obj.frustumCulled = false
    return obj
  }, [shown, colorBy, selectedId])
  useEffect(() => () => disposeAll([line]), [line])
  return <primitive object={line} />
}

/** One gold pulse per link every one to two minutes (silo-layout pulseSchedule). */
function Pulses({ shown, dot }: { shown: readonly Shown[]; dot: THREE.Texture }) {
  const links = useMemo(() => shown.filter((s) => s.on && s.b.linked), [shown])
  const curves = useMemo(() => links.map(linkCurve), [links])
  const slots = useMemo(() => pulseSchedule(links.map((s) => s.b.id)), [links])
  const points = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(links.length * 3), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(links.length * 3), 3))
    const obj = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 1.2,
        map: dot,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    obj.frustumCulled = false
    return obj
  }, [links, dot])
  useEffect(() => () => disposeAll([points]), [points])

  const gold = useMemo(() => new THREE.Color(GOLD_BRIGHT), [])
  const at = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const pos = points.geometry.getAttribute('position') as THREE.BufferAttribute
    const col = points.geometry.getAttribute('color') as THREE.BufferAttribute
    const now = Date.now()
    slots.forEach((slot, i) => {
      const t = pulseProgress(slot, now)
      // A resting pulse is black, which adds nothing to the picture.
      const k = t === null ? 0 : Math.sin(Math.PI * t)
      curves[i]!.getPoint(t ?? 0, at)
      pos.setXYZ(i, at.x, at.y, at.z)
      col.setXYZ(i, gold.r * k, gold.g * k, gold.b * k)
    })
    pos.needsUpdate = true
    col.needsUpdate = true
  })

  if (links.length === 0) return null
  return <primitive object={points} />
}

// ─── Business nodes ──────────────────────────────────────────────────────────

const NODE_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aIcon;
uniform float uScale;
uniform float uMul;
uniform float uDensity;
varying vec3 vColor;
varying float vIcon;
varying float vFog;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 0.001);
  gl_PointSize = aSize * uMul * uScale / depth;
  vColor = aColor;
  vIcon = aIcon;
  vFog = 1.0 - exp(-uDensity * uDensity * depth * depth);
}
`

const CORE_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uFogColor;
uniform float uCells;
varying vec3 vColor;
varying float vIcon;
varying float vFog;
void main() {
  vec2 uv = vec2((vIcon + gl_PointCoord.x) / uCells, 1.0 - gl_PointCoord.y);
  vec4 t = texture2D(uMap, uv);
  if (t.a < 0.3) discard;
  gl_FragColor = vec4(mix(vColor * t.rgb, uFogColor, vFog), t.a);
  #include <colorspace_fragment>
}
`

const GLOW_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec3 vColor;
varying float vFog;
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(vColor, t.a * 0.28 * (1.0 - vFog));
  #include <colorspace_fragment>
}
`

/**
 * Every business in one draw call: an icon disc per floor, tinted by the
 * color mode, with a soft glow behind it on larger screens.
 */
function Nodes({
  shown,
  colorBy,
  selectedId,
  motion,
  reducedMotion,
  phone,
  textures,
}: Inner & { shown: readonly Shown[]; textures: Textures }) {
  const { gl, camera, invalidate } = useThree()

  const objects = useMemo(() => {
    const n = shown.length
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(n * 3)
    const icon = new Float32Array(n)
    shown.forEach((s, i) => {
      pos.set([s.p.x, s.p.y, s.p.z], i * 3)
      icon[i] = s.b.floorIndex
    })
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aIcon', new THREE.BufferAttribute(icon, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1))
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3))

    const uScale = { value: 1 }
    const uDensity = { value: FOG_DENSITY }
    const core = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: NODE_VERT,
        fragmentShader: CORE_FRAG,
        uniforms: {
          uScale,
          uDensity,
          uMul: { value: 2.0 },
          uMap: { value: textures.atlas },
          uFogColor: { value: BG },
          uCells: { value: ATLAS_CELLS },
        },
        transparent: true,
      })
    )
    core.renderOrder = 2
    core.frustumCulled = false
    let glow: THREE.Points | null = null
    if (!phone) {
      glow = new THREE.Points(
        geo,
        new THREE.ShaderMaterial({
          vertexShader: NODE_VERT,
          fragmentShader: GLOW_FRAG,
          uniforms: { uScale, uDensity, uMul: { value: 3.6 }, uMap: { value: textures.glow } },
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
      glow.renderOrder = 1
      glow.frustumCulled = false
    }
    return { geo, core, glow, uScale }
  }, [shown, phone, textures])

  useEffect(
    () => () => {
      objects.geo.dispose()
      ;(objects.core.material as THREE.Material).dispose()
      ;(objects.glow?.material as THREE.Material | undefined)?.dispose()
    },
    [objects]
  )

  // Colors change with the mode or the filters, never per frame.
  useEffect(() => {
    const attr = objects.geo.getAttribute('aColor') as THREE.BufferAttribute
    const c = new THREE.Color()
    shown.forEach((s, i) => {
      c.set(colorForBusiness(s.b, colorBy))
      if (!s.on) c.lerp(BG, 0.78)
      attr.setXYZ(i, c.r, c.g, c.b)
    })
    attr.needsUpdate = true
    invalidate()
  }, [objects, shown, colorBy, invalidate])

  // Sizes ease toward their resting size; new nodes grow in from nothing.
  const current = useRef<Map<string, number>>(new Map())
  const buf = useMemo(() => new THREE.Vector2(), [])
  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera
    gl.getDrawingBufferSize(buf)
    setUniform(objects.uScale, buf.y / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)))

    const attr = objects.geo.getAttribute('aSize') as THREE.BufferAttribute
    const k = reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, 0.05) * 4)
    const beat = motion ? 1 + Math.sin(performance.now() / 260) * 0.08 : 1
    let moving = false
    shown.forEach((s, i) => {
      const was = current.current.get(s.b.id) ?? 0
      const target = s.on ? s.size : s.size * 0.8
      const now = was + (target - was) * k
      if (Math.abs(target - now) > 0.002) moving = true
      current.current.set(s.b.id, now)
      attr.setX(i, s.b.id === selectedId ? now * beat : now)
    })
    attr.needsUpdate = true
    if (moving && !motion) invalidate()
  })

  return (
    <>
      {objects.glow && <primitive object={objects.glow} />}
      <primitive object={objects.core} />
    </>
  )
}

/** A gold ring around You and a white ring around the picked business. */
function Marks({
  shown,
  selectedId,
  ring,
}: {
  shown: readonly Shown[]
  selectedId: string | null
  ring: THREE.Texture
}) {
  const you = shown.filter((s) => s.b.isYou)
  const sel = selectedId ? shown.find((s) => s.b.id === selectedId) : undefined
  return (
    <>
      {you.map((s) => (
        <sprite key={s.b.id} position={[s.p.x, s.p.y, s.p.z]} scale={Math.max(s.size, 0.4) * 3.2} renderOrder={3}>
          <spriteMaterial map={ring} color={GOLD_BRIGHT} transparent depthTest={false} depthWrite={false} />
        </sprite>
      ))}
      {sel && (
        <sprite position={[sel.p.x, sel.p.y, sel.p.z]} scale={Math.max(sel.size, 0.4) * 4} renderOrder={3}>
          <spriteMaterial map={ring} color="#fcfaf4" transparent depthTest={false} depthWrite={false} />
        </sprite>
      )}
    </>
  )
}

/**
 * A pink dashed square in every wedge with no business on the list yet. The
 * texture carries the colour, so it reads the same on any floor.
 */
function Gaps({
  gaps,
  selected,
  tex,
  ring,
  phone,
}: {
  gaps: readonly SiloGap[]
  selected: SiloGap | null
  tex: THREE.Texture
  ring: THREE.Texture
  phone: boolean
}) {
  const base = phone ? GAP_SIZE * 0.7 : GAP_SIZE
  const isSel = (g: SiloGap) =>
    !!selected && selected.familyIndex === g.familyIndex && selected.floorIndex === g.floorIndex
  return (
    <>
      {gaps.map((g) => {
        const c = wedgePoint(g.familyIndex, g.floorIndex)
        const on = isSel(g)
        return (
          <sprite
            key={`${g.familyIndex}:${g.floorIndex}`}
            position={[c.x, c.y, c.z]}
            scale={on ? base * 1.35 : base}
            renderOrder={2}
          >
            <spriteMaterial map={tex} transparent opacity={0.95} depthWrite={false} />
          </sprite>
        )
      })}
      {selected && (
        <sprite
          position={(() => {
            const c = wedgePoint(selected.familyIndex, selected.floorIndex)
            return [c.x, c.y, c.z] as [number, number, number]
          })()}
          scale={base * 2}
          renderOrder={3}
        >
          <spriteMaterial map={ring} color="#fcfaf4" transparent depthTest={false} depthWrite={false} />
        </sprite>
      )}
    </>
  )
}

// ─── DOM tags and floor signs ────────────────────────────────────────────────

const SIGN_AT: readonly Point3[] = SILO.y.map((y) => ({ x: 0, y: y + 2.6, z: -9 }))

const LABEL_MAX = { desk: 10, phone: 5 }
/** A dot this many pixels across or bigger can carry its name. */
const LABEL_MIN_PX = { desk: 9, phone: 12 }
/** Gap labels show once the camera is this close to the square. */
const GAP_LABEL_DIST = 70
const HUD_SELECTORS = '.hud > *, .ctx, .dock, .silo-tag'

/** How often the names are chosen while the camera moves. */
const LABEL_PICK_MS = 100
const LABEL_H = 34
/** A label's padding, border and dot, for a name not measured yet. */
const LABEL_CHROME_PX = 36
const LABEL_CHAR_PX = 6.5

/** One label element and what it last showed, so a still camera writes nothing. */
interface LabelSlot {
  id: string | null
  filled: string | null
  l: number
  t: number
  on: boolean
  offAt: number
}

const newSlot = (): LabelSlot => ({ id: null, filled: null, l: NaN, t: NaN, on: false, offAt: 0 })

function newLabelState() {
  return {
    slots: [] as LabelSlot[],
    gapSlots: [] as LabelSlot[],
    widths: new Map<string, number>(),
    height: LABEL_H,
    since: new Map<string, number>() as ReadonlyMap<string, number>,
    boxes: [] as LabelBox[],
    frame: 0,
    pickedAt: -Infinity,
    stale: true,
    // The view the labels were last placed for.
    pos: new THREE.Vector3(NaN, NaN, NaN),
    quat: new THREE.Quaternion(),
    w: 0,
    h: 0,
    shown: null as readonly Shown[] | null,
    hovered: null as string | null,
    selected: null as string | null,
    gap: null as SiloGap | null,
  }
}

type LabelState = ReturnType<typeof newLabelState>

/** True when the camera has moved enough to show. Small drift adds up and still counts. */
function cameraMoved(camera: THREE.Camera, st: LabelState): boolean {
  const same =
    camera.position.distanceToSquared(st.pos) < 1e-6 && 1 - Math.abs(camera.quaternion.dot(st.quat)) < 1e-9
  if (same) return false
  st.pos.copy(camera.position)
  st.quat.copy(camera.quaternion)
  return true
}

const sameBoxes = (a: readonly LabelBox[], b: readonly LabelBox[]) =>
  a.length === b.length &&
  a.every((x, i) => {
    const y = b[i]!
    return Math.abs(x.l - y.l) < 1 && Math.abs(x.t - y.t) < 1 && Math.abs(x.r - y.r) < 1 && Math.abs(x.b - y.b) < 1
  })

function Tags({
  shown,
  hoveredId,
  selectedId,
  hoverTagRef,
  youTagRef,
  signsRef,
  labelsRef,
  gapLabelsRef,
  gaps,
  selectedGap,
  phone,
}: Inner & { shown: readonly Shown[] }) {
  const { camera, size, gl, invalidate } = useThree()
  const tagged = hoveredId ?? selectedId
  const hover = tagged ? shown.find((s) => s.b.id === tagged) : undefined
  const you = shown.find((s) => s.b.isYou)

  const byId = useMemo(() => new Map(shown.map((s) => [s.b.id, s])), [shown])
  const labels = useRef(newLabelState())

  useFrame(() => {
    const st = labels.current
    const now = performance.now()
    const resized = st.w !== size.width || st.h !== size.height
    if (resized) {
      st.w = size.width
      st.h = size.height
      st.widths.clear()
    }
    const moved = cameraMoved(camera, st) || resized
    const changed =
      st.shown !== shown || st.hovered !== hoveredId || st.selected !== selectedId || st.gap !== selectedGap
    if (changed) {
      st.shown = shown
      st.hovered = hoveredId
      st.selected = selectedId
      st.gap = selectedGap
    }
    if (moved || changed) st.stale = true

    // The HUD panels, in canvas pixels. Labels never sit under them.
    const due = () => (st.stale || st.since.size > 0) && now - st.pickedAt >= LABEL_PICK_MS
    if (due() || st.frame++ % 20 === 0) {
      const root = gl.domElement.closest('.silo')
      const c = gl.domElement.getBoundingClientRect()
      const boxes = root
        ? Array.from(root.querySelectorAll<HTMLElement>(HUD_SELECTORS))
            .filter((el) => !el.hidden && el.offsetParent !== null)
            .map((el) => {
              const r = el.getBoundingClientRect()
              return { l: r.left - c.left, t: r.top - c.top, r: r.right - c.left, b: r.bottom - c.top }
            })
            .filter((b) => b.r > b.l && b.b > b.t)
        : []
      if (!sameBoxes(boxes, st.boxes)) {
        st.boxes = boxes
        st.stale = true
      }
    }

    const fov = (camera as THREE.PerspectiveCamera).fov ?? 60
    const kpx = size.height / 2 / Math.tan(THREE.MathUtils.degToRad(fov) / 2)
    const toScreen = (p: Point3) => {
      projected.set(p.x, p.y, p.z).project(camera)
      if (projected.z > 1 || projected.z < -1) return null
      return { x: ((projected.x + 1) / 2) * size.width, y: ((1 - projected.y) / 2) * size.height }
    }
    const inView = (x: number, y: number) => x > 0 && x < size.width && y > 0 && y < size.height
    const dotAt = (s: Shown) => {
      const at = toScreen(s.p)
      if (!at) return null
      worldTmp.set(s.p.x, s.p.y, s.p.z)
      const pr = (s.size * kpx) / Math.max(camera.position.distanceTo(worldTmp), 0.1)
      return { ...at, pr, top: at.y + Math.max(pr, 4) + 6 }
    }
    const pool = labelsRef?.current?.children
    const gapEls = gapLabelsRef?.current?.children
    const pick = due()

    if (pick) {
      st.stale = moved
      st.pickedAt = now
      const taken: LabelBox[] = [...st.boxes]

      // Business names: the biggest dots on screen, never on top of each other.
      if (pool) {
        const maxW = phone ? 160 : 220
        const minPx = phone ? LABEL_MIN_PX.phone : LABEL_MIN_PX.desk
        const skip = new Set([hoveredId, selectedId].filter(Boolean))
        const candidates: LabelCandidate[] = []
        for (const s of shown) {
          if (!s.on || s.b.isYou || skip.has(s.b.id)) continue
          const at = dotAt(s)
          if (!at || at.pr < minPx * LABEL_KEEP || !inView(at.x, at.y)) continue
          const w =
            st.widths.get(s.b.id) ??
            Math.min(maxW, LABEL_CHROME_PX + LABEL_CHAR_PX * businessDisplayName(s.b).length)
          candidates.push({ id: s.b.id, x: at.x, top: at.top, size: at.pr, w, h: st.height })
        }
        while (st.slots.length < pool.length) {
          pool[st.slots.length]?.classList.remove('on')
          st.slots.push(newSlot())
        }
        const next = pickLabels({
          candidates,
          held: st.slots.flatMap((slot) => (slot.id ? [slot.id] : [])),
          since: st.since,
          blocked: st.boxes,
          now,
          max: phone ? LABEL_MAX.phone : LABEL_MAX.desk,
          minPx,
          stageW: size.width,
          stageH: size.height,
        })
        st.since = next.since
        taken.push(...next.boxes)

        const keep = new Set(next.ids)
        st.slots.forEach((slot, i) => {
          const el = pool[i]
          if (!slot.id || keep.has(slot.id) || !(el instanceof HTMLElement)) return
          slot.id = null
          slot.offAt = now
          toggleLabel(el, slot, false)
        })
        for (const id of next.ids) {
          if (st.slots.some((slot) => slot.id === id)) continue
          const s = byId.get(id)
          const free = st.slots.filter((slot) => !slot.id)
          const slot =
            free.find((x) => x.filled === id) ?? free.reduce<LabelSlot | null>((a, x) => (!a || x.offAt < a.offAt ? x : a), null)
          const el = slot ? pool[st.slots.indexOf(slot)] : null
          if (!s || !slot || !(el instanceof HTMLElement)) continue
          slot.id = id
          if (slot.filled !== id) {
            slot.filled = id
            fillLabel(
              el,
              businessDisplayName(s.b),
              CATEGORY_FAMILIES[s.b.familyIndex]?.name ?? '',
              familyColor(s.b.familyIndex),
            )
          }
          // A real width only ever arrives once, so one more pick settles it.
          if (!st.widths.has(id)) {
            st.widths.set(id, el.offsetWidth)
            st.height = el.offsetHeight || LABEL_H
            st.stale = true
          }
        }
      }

      // Gap labels: only up close, so the top view stays calm.
      if (gapEls) {
        gaps.forEach((g, i) => {
          const el = gapEls[i]
          if (!(el instanceof HTMLElement)) return
          const slot = (st.gapSlots[i] ??= newSlot())
          const c = wedgePoint(g.familyIndex, g.floorIndex)
          worldTmp.set(c.x, c.y, c.z)
          const near = camera.position.distanceTo(worldTmp) < GAP_LABEL_DIST * (slot.on ? 1.1 : 1)
          const picked =
            !!selectedGap && selectedGap.familyIndex === g.familyIndex && selectedGap.floorIndex === g.floorIndex
          const at = near || picked ? toScreen(c) : null
          if (!at || !inView(at.x, at.y)) {
            toggleLabel(el, slot, false)
            return
          }
          const key = `gap:${g.familyIndex}:${g.floorIndex}`
          if (!st.widths.has(key)) {
            st.widths.set(key, el.offsetWidth)
            st.height = Math.max(st.height, el.offsetHeight)
          }
          const w = st.widths.get(key) ?? 0
          // The same clamps the label lands on, or the box and the label disagree.
          const l = Math.min(Math.max(at.x - w / 2, 0), Math.max(size.width - w, 0))
          const top = Math.min(Math.max(at.y + 16, 0), Math.max(size.height - st.height, 0))
          const box = { l, t: top, r: l + w, b: top + st.height }
          if (!picked && taken.some((t) => overlaps(t, box))) {
            toggleLabel(el, slot, false)
            return
          }
          taken.push(box)
          toggleLabel(el, slot, true)
        })
      }
    }

    // Labels ride with the camera between picks. A still camera writes nothing.
    if (moved || pick) {
      st.slots.forEach((slot, i) => {
        const el = pool?.[i]
        const s = slot.id ? byId.get(slot.id) : undefined
        if (!s || !(el instanceof HTMLElement)) return
        const at = dotAt(s)
        if (!at) return
        const w = st.widths.get(s.b.id) ?? el.offsetWidth
        st.widths.set(s.b.id, w)
        moveLabel(
          el,
          slot,
          snapLabelPos(at.x - w / 2, w, size.width, slot.l),
          snapLabelPos(at.top, st.height, size.height, slot.t),
        )
        toggleLabel(el, slot, true)
      })
      gaps.forEach((g, i) => {
        const el = gapEls?.[i]
        const slot = st.gapSlots[i]
        if (!slot?.on || !(el instanceof HTMLElement)) return
        const at = toScreen(wedgePoint(g.familyIndex, g.floorIndex))
        if (!at) return
        const w = st.widths.get(`gap:${g.familyIndex}:${g.floorIndex}`) ?? el.offsetWidth
        moveLabel(
          el,
          slot,
          snapLabelPos(at.x - w / 2, w, size.width, slot.l),
          snapLabelPos(at.y + 16, st.height, size.height, slot.t),
        )
      })
    }

    const place = (el: Element | null | undefined, p: Point3 | undefined, lift: number, anchor: string) => {
      if (!(el instanceof HTMLElement)) return
      if (!p) {
        el.hidden = true
        return
      }
      projected.set(p.x, p.y, p.z).project(camera)
      if (projected.z > 1 || projected.z < -1) {
        el.hidden = true
        return
      }
      el.hidden = false
      const x = ((projected.x + 1) / 2) * size.width
      const y = ((1 - projected.y) / 2) * size.height
      el.style.transform = `${anchor} translate(${x.toFixed(1)}px, ${(y - lift).toFixed(1)}px)`
    }
    if (moved || changed) {
      place(hoverTagRef.current, hover && !hover.b.isYou ? hover.p : undefined, 18, 'translate(-50%, -100%)')
      place(youTagRef.current, you?.p, 22, 'translate(-50%, -100%)')
      const signs = signsRef?.current?.children
      if (signs) SIGN_AT.forEach((p, k) => place(signs[k], p, 0, 'translate(-50%, -50%)'))
    }

    // Without an ambient loop, nothing else asks for the frame that finishes a pick.
    if (st.stale || st.since.size > 0) invalidate()
  })

  return null
}
