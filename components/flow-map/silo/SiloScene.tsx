'use client'

/**
 * The Collective scene (tickets 167, 171 and 246). The Glass Tower: one lit
 * glass tower with a glass plate per floor, each category family in its own
 * wedge, spiralling down to a glowing core. You sit inside it, surrounded, and
 * can back all the way out to see the whole tower. Loaded on its own chunk by
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
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'

import {
  CATEGORY_FAMILIES,
  CLUSTER_WIDE,
  DOT_LIFT,
  FALLBACK_FAMILY_INDEX,
  GOLD,
  GOLD_BRIGHT,
  LABEL_KEEP,
  LEVEL_COLORS,
  ORBIT,
  ORBIT_KEYS,
  SILO_FLOORS,
  businessDisplayName,
  busiestFamily,
  clusterRadius,
  clusterSpacing,
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
  trackProgress,
  floorForHeight,
  smoothDamp,
  clampLabelPos,
  snapLabelPos,
  wedgeAngle,
  wedgePoint,
  wrapAngle,
  ZOOM,
  floorGap,
  fogForZoom,
  shellBottom,
  shellTop,
  stepZoom,
  INTRO,
  PINCH,
  PREVIEW_SPIN,
  SWIPE,
  RECENTER,
  pinchZoom,
  swipeLanding,
  swipeTravel,
  swipeTurnRate,
  zoomAmount,
  zoomOrbit,
  type SiloShape,
  type ColorBy,
  type LabelBox,
  type LabelCandidate,
  type Orbit,
  type PlacedBusiness,
  type Point3,
  type SiloBusiness,
  type SiloGap,
} from '@/lib/spend/silo-layout'
import { demoArrivalAt, type DemoSupplyLink } from '@/lib/spend/collective-demo'
import { FLOOR_ICON_PATHS } from './floor-icons'

const BG_HEX = '#0a0907'
const BG = new THREE.Color(BG_HEX)
/**
 * The clear for the bloom composer. Its render pass clears the linear target
 * with the screen-space value, which lifts the black to a brown, so this one
 * is taken down once more to land on BG after the output pass.
 */
const BG_FOR_COMPOSER = BG.clone().convertSRGBToLinear()
const DRAG_THRESHOLD_PX = 5
/** Enough steps that a long link reads as one smooth curve, not a chain. */
const LINK_SEGMENTS = 64
/** Link width in CSS pixels. Real width, so links stay smooth at any angle. */
const LINK_WIDTH_PX = 1.5
/** Every linked business under the total bar draws at this one size (ticket 250). */
const LINKED_UNCOUNTED_SIZE = 0.55
const ATLAS_CELLS = 8
const CELL = 128
const GAP_HEX = '#ff8ccf'
/** A gap square's size in scene units. */
const GAP_SIZE = 4.6
/** Floor plate tints, Shoppers first: light gold at the top, warmer lower down. */
const PLATE_TINTS = ['#ffe9b8', '#ffd867', '#e9c27a', '#d9a866', '#c99560'] as const

/** What the keys can do to the camera. */
export interface SiloNav {
  /** Moves down (+) or up (-) the silo. False at either end. */
  travel: (dt: number) => boolean
  /** Turns the map, in radians. */
  turn: (dAz: number) => void
  /** Backs out to the whole tower, or back inside. No argument toggles. */
  wholeTower: (on?: boolean) => void
  /** One step out (+1) toward the whole tower, or in (-1). */
  zoomStep: (dir: 1 | -1) => void
  /** Back to the opening view at the current level, with nothing picked (ticket 247). */
  recenter: () => void
}

export interface SiloSceneProps {
  /** The tower's sizes (ticket 246). */
  shape: SiloShape
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
  /** The floor the camera is heading for, each time that changes. */
  onFloorChange?: (floor: number) => void
  /** The reader moved off the floor they picked. */
  onLeaveFloor?: () => void
  navRef?: RefObject<SiloNav | null>
  onHover: (id: string | null) => void
  onContextLost: () => void
  hoverTagRef: RefObject<HTMLDivElement | null>
  youTagRef: RefObject<HTMLDivElement | null>
  /** The view backed out to the whole tower (true) or came back inside. */
  onWholeTowerChange?: (on: boolean) => void
  /** How far out the camera is asked to be: 0 inside, 1 the whole tower. */
  onZoomChange?: (zoom: number) => void
  /** The opening plays: the camera glides in from the whole tower (ticket 247). */
  intro?: boolean
  /** A double-click on empty space recentered the view. */
  onRecenter?: () => void
  /**
   * Phone, in the page (ticket 248): the map takes no gestures and turns slowly
   * on its own, so the page always scrolls.
   */
  preview?: boolean
  /**
   * Phone full-screen (ticket 248): one finger swipes up and down the floors or
   * sideways to turn; two fingers pinch the zoom and tilt. The page never moves.
   */
  full?: boolean
  /**
   * Demo mode (ticket 249): a sample receipt arrives every few seconds, its
   * line growing from the family's crowd to the business. Off with the motion.
   */
  arrivals?: boolean
  /**
   * Demo mode: businesses buying from businesses, drawn between floors. Some
   * cross families, like a cafe buying from a woodshop. Live has none yet.
   */
  supply?: readonly DemoSupplyLink[]
  /** Follow a Dollar: the trail's business ids, top first, and the stop on screen. */
  trail?: { ids: readonly string[]; stop: number } | null
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

/** Thins or thickens the scene fog, kept out of hook bodies. */
function setFog(scene: THREE.Scene, density: number) {
  if (scene.fog instanceof THREE.FogExp2) scene.fog.density = density
}

/** DOM writes for the HUD labels, kept out of hook bodies. */
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
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  return (
    <Canvas
      aria-hidden="true"
      flat
      resize={{ scroll: false }}
      frameloop={motion && active ? 'always' : 'demand'}
      dpr={[1, phone ? 1.5 : 2]}
      camera={{ position: [0, 98, 30], fov: phone ? 72 : 62, near: 0.1, far: 1500 }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => {
        gl.setClearColor(BG, 1)
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          // The renderer drops its own context after unmount, which isn't a failure.
          if (mounted.current) onContextLost()
        })
      }}
    >
      <fogExp2 attach="fog" args={[BG_HEX, props.shape.fogNear]} />
      <SceneContents {...props} phone={phone} />
    </Canvas>
  )
}

interface Shown {
  b: SiloBusiness
  p: PlacedBusiness
  /** Where its link starts: its family's shopper crowd. */
  from: Point3
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
  const { businesses, placed, visible, motion, active, phone, shape } = props
  const invalidate = useThree((s) => s.invalidate)

  // Any prop change redraws once, even with the loop on demand.
  useEffect(() => {
    if (active) invalidate()
  })

  const textures = useTextures()
  // Written each frame by the camera rig, read by every glass and node shader.
  const glass = useMemo<Glass>(
    () => ({
      fog: { value: shape.fogNear },
      floor: { value: 0 },
      out: { value: 0 },
      time: { value: 0 },
    }),
    [shape]
  )

  const { shown, halos } = useMemo(() => {
    const rows = businesses
      .map((b, i) => ({
        b,
        p: placed.get(b.id),
        from: crowdAnchor(b.familyIndex, shape),
        on: visible[i] ?? true,
      }))
      .filter((x): x is { b: SiloBusiness; p: PlacedBusiness; from: Point3; on: boolean } => !!x.p)

    const counts = new Map<string, number>()
    for (const r of rows) {
      const key = `${r.b.familyIndex}:${r.b.floorIndex}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    // Businesses with a total showing grow with what was spent there. Linked
    // ones under the total bar all share one size (ticket 250), so a dot never
    // hints at one shopper's amount. The rest share a size small enough that a
    // busy wedge doesn't pile up.
    const max = Math.max(1, ...rows.filter((r) => r.b.figuresShown).map((r) => r.b.amountCents))
    const sized: Shown[] = rows.map((r) => {
      if (r.b.figuresShown) {
        return { ...r, size: 0.5 + 1.1 * Math.sqrt(r.b.amountCents / max) }
      }
      if (r.b.linked) return { ...r, size: LINKED_UNCOUNTED_SIZE }
      const n = counts.get(`${r.b.familyIndex}:${r.b.floorIndex}`) ?? 1
      const spacing = clusterSpacing(n, shape)
      return { ...r, size: THREE.MathUtils.clamp(spacing * 0.3, 0.32, 0.6) }
    })

    const rings: Halo[] = CATEGORY_FAMILIES.map((_, fi) => ({
      floor: 0,
      center: crowdAnchor(fi, shape),
      radius: shape.crowdR,
      familyIndex: fi,
    }))
    for (const [key, n] of counts) {
      const [fi, k] = key.split(':').map(Number) as [number, number]
      if (k === 0) continue
      rings.push({
        floor: k,
        center: wedgePoint(fi, k, 0, DOT_LIFT * 0.5, 0, shape),
        radius: clusterRadius(n, shape),
        familyIndex: fi,
      })
    }
    return { shown: sized, halos: rings }
  }, [businesses, placed, visible, shape])

  return (
    <>
      <Controls {...props} shown={shown} halos={halos} glass={glass} />
      <GlassTower glass={glass} shape={shape} />
      <Sky phone={phone} dot={textures.dot} shape={shape} />
      <Core glow={textures.glow} motion={motion} glass={glass} shape={shape} />
      <Halos
        shape={shape}
        halos={halos}
        colorBy={props.colorBy}
        focusFloor={props.focusFloor}
        textures={textures}
      />
      <Links shown={shown} colorBy={props.colorBy} selectedId={props.selectedId} />
      {props.supply && props.supply.length > 0 && (
        <SupplyLinks
          shown={shown}
          supply={props.supply}
          colorBy={props.colorBy}
          selectedId={props.selectedId}
          dimmed={!!props.trail}
        />
      )}
      {props.trail && props.trail.ids.length > 0 && (
        <TrailPath shown={shown} trail={props.trail} dot={textures.dot} motion={motion && active} />
      )}
      <PendingLinks shown={shown} />
      {motion && active && <Pulses shown={shown} dot={textures.dot} />}
      {props.arrivals && motion && active && <Arrivals shown={shown} dot={textures.dot} />}
      <Nodes {...props} shown={shown} textures={textures} glass={glass} />
      <Gaps
        shape={shape}
        gaps={props.gaps}
        selected={props.selectedGap}
        tex={textures.gap}
        ring={textures.ring}
        phone={phone}
      />
      <Marks shown={shown} selectedId={props.selectedId} ring={textures.ring} />
      <Tags {...props} shown={shown} />
      {!phone && <Bloom />}
    </>
  )
}

/** Uniforms shared by the glass, the core and the nodes. */
interface Glass {
  fog: { value: number }
  /** The floor the camera is on, as a fraction between floors. */
  floor: { value: number }
  /** 0 inside the tower, 1 at the whole-tower view. */
  out: { value: number }
  time: { value: number }
}

/** A gap square's spot: the middle of its wedge, just above the plate. */
function gapPoint(g: SiloGap, shape: SiloShape): Point3 {
  return wedgePoint(g.familyIndex, g.floorIndex, 0, DOT_LIFT, 0, shape)
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
  // The rings and gap squares lie nearly flat to a camera on the floor. Without
  // anisotropic filtering their thin strokes shimmer at that angle as it moves.
  const gl = useThree((st) => st.gl)
  useEffect(() => {
    const most = Math.min(8, gl.capabilities.getMaxAnisotropy())
    for (const t of [textures.ring, textures.gap]) {
      if (t.anisotropy === most) continue
      t.anisotropy = most
      t.needsUpdate = true
    }
  }, [gl, textures])
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
  /** Track speed of a phone swipe, in track a second, for where it settles (ticket 248). */
  glide: number
  dragging: boolean
  /** Seconds to settle, from the last thing that moved the view. */
  ease: number
  /** Where the camera is now, on its way to the goal. */
  cur: Orbit
  vel: Orbit
  /** 0 is the view as picked, 1 the whole tower from outside (ticket 246). */
  zoom: number
}

const DRAG_TURN = 0.006
const DRAG_TILT = 0.0032
/** A drag that paused this long before release leaves no spin. */
const SPIN_STALE_MS = 80
/** Radians a second. Even a hard flick coasts under a quarter turn. */
const SPIN_MAX = 3
/** How far off a pick the track can go before scrolling lets go of it. */
const PICK_HOLD = 0.03
/** Zoom per pixel of trackpad pinch (a ctrl+wheel event). */
const PINCH_ZOOM = 0.01
/** How much further a phone backs out for the whole tower. */
const PHONE_TOWER_FAR = 0.75
/** And looks a little lower, so the core clears the hint above the sheet. */
const PHONE_TOWER_DROP = 18
/**
 * The zoomed view. A phone shows the tower in a short window above its sheet,
 * so it backs further out and looks a little lower.
 */
function zoomGoal(base: Orbit, zoom: number, phone: boolean, shape: SiloShape): Orbit {
  const o = zoomOrbit(base, zoom, shape)
  if (!phone || zoom <= 0) return o
  const z = Math.min(zoom, 1)
  return { ...o, R: o.R * (1 + PHONE_TOWER_FAR * z), y: o.y - PHONE_TOWER_DROP * z }
}

/** Seconds for the glide out to the whole tower and back. */
const WHOLE_TOWER_S = 0.8
/** Seconds for one zoom step, slow enough to read as a glide. */
const ZOOM_STEP_S = 0.45

/** Turns whichever view is live, so a close-up circles what it's looking at. */
function turn(r: Rig, dAz: number, dEl: number) {
  const o = r.focus?.orbit ?? r
  o.az += dAz
  o.el = THREE.MathUtils.clamp(o.el + dEl, ORBIT.minEl, ORBIT.maxEl)
}

/** The pinned stage and the track it rides in, for a canvas inside them. */
function trackParts(el: HTMLElement) {
  const stage = el.closest<HTMLElement>('.silo')
  const track = stage?.parentElement
  return stage && track ? { stage, track } : null
}

/** Where the page has the stage on its track. Null when the track is off. */
function trackT(el: HTMLElement): number | null {
  const parts = trackParts(el)
  if (!parts) return null
  return trackProgress(parts.track.getBoundingClientRect(), parts.stage.getBoundingClientRect())
}

/** Moves the page to `t` on the track. Instant, so it can't read as a user scroll. */
function seatTrack(el: HTMLElement, t: number) {
  const parts = trackParts(el)
  // Full-screen (ticket 248) locks the page, so the floor moves the camera only.
  if (!parts || parts.track.hasAttribute('data-full')) return
  const track = parts.track.getBoundingClientRect()
  const stage = parts.stage.getBoundingClientRect()
  const room = track.height - stage.height
  const hdr = parseFloat(getComputedStyle(parts.stage).getPropertyValue('--hdr')) || 0
  if (room < 1) {
    // No track, as with reduced motion: bring the stage on screen so its card shows.
    if (stage.top < hdr || stage.bottom > window.innerHeight) {
      window.scrollTo({ top: window.scrollY + stage.top - hdr, behavior: 'instant' })
    }
    return
  }
  window.scrollTo({ top: window.scrollY + track.top - hdr + t * room, behavior: 'instant' })
}

function focusOn(
  r: Rig,
  el: HTMLElement,
  kind: Focus['kind'],
  p: Point3,
  floor: number | undefined,
  shape: SiloShape
) {
  if (floor !== undefined) {
    r.t = scrollForFloor(floor, shape)
    seatTrack(el, r.t)
  }
  r.focus = { kind, orbit: focusFrame(p, kind, shape) }
  r.zoom = 0
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

function Controls(
  props: Inner & { shown: readonly Shown[]; halos: readonly Halo[]; glass: Glass }
) {
  const { camera, gl, invalidate, scene } = useThree()
  const rig = useRef<Rig>({
    t: 0,
    az: 0,
    el: ORBIT.el,
    focus: null,
    spin: 0,
    glide: 0,
    dragging: false,
    ease: ORBIT.easeS,
    cur: orbitForScroll(0, 0, ORBIT.el, props.shape),
    vel: { x: 0, y: 0, z: 0, az: 0, el: 0, R: 0 },
    zoom: 0,
  })
  const outNow = useRef(false)
  const zoomNow = useRef(0)
  const pendingFloor = useRef<number | null>(null)
  const floorNow = useRef<number | null>(null)
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
    const { shape } = live.current
    clearFocus(r)
    r.zoom = 0
    r.t = scrollForFloor(focusFloor, shape)
    seatTrack(gl.domElement, r.t)
    r.el = family === null ? ORBIT.el : ORBIT.floorEl
    if (family !== null) r.az = headingTo(wedgePoint(family, focusFloor, 0, 0, 0, shape))
    r.spin = 0
    r.ease = ORBIT.jumpS
    invalidate()
  }, [focusFloor, gl, invalidate])

  // A business: move in close and look at it.
  useEffect(() => {
    const r = rig.current
    const p = selectedId ? placed.get(selectedId) : undefined
    if (!p) {
      if (r.focus?.kind === 'business') clearFocus(r)
      invalidate()
      return
    }
    focusOn(
      r,
      gl.domElement,
      'business',
      p,
      live.current.businesses.find((b) => b.id === selectedId)?.floorIndex,
      live.current.shape
    )
    invalidate()
  }, [selectedId, placed, gl, invalidate])

  // A gap: frame its square from above, like a floor ring.
  const { selectedGap } = props
  useEffect(() => {
    const r = rig.current
    if (!selectedGap) {
      if (r.focus?.kind === 'gap') clearFocus(r)
      invalidate()
      return
    }
    const { shape } = live.current
    focusOn(r, gl.domElement, 'gap', gapPoint(selectedGap, shape), selectedGap.floorIndex, shape)
    invalidate()
  }, [selectedGap, gl, invalidate])

  useEffect(() => {
    const el = gl.domElement
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
      axis: 'x' | 'y' | null
      /** The swipe has gone far enough that its direction is final (ticket 268). */
      settled: boolean
      /** Where the swipe started, so a change of mind can undo the first stretch. */
      t0: number
      turned: { az: number }
      az0: number
    } | null = null
    let hovered: string | null = null
    // Full-screen (ticket 248): every finger on the map, for a two-finger pinch.
    const fingers = new Map<number, { x: number; y: number }>()
    let pinch: { gap: number; zoom: number; moving: boolean; midY: number } | null = null
    // A pinch ends one finger at a time. Until all are up, nothing is a tap.
    let pinched = false

    function fingerGap(): number {
      const [a, b] = [...fingers.values()]
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
    }

    function fingerMidY(): number {
      const [a, b] = [...fingers.values()]
      return a && b ? (a.y + b.y) / 2 : 0
    }

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
          d: Math.hypot(
            ((projected.x + 1) / 2) * rect.width - x,
            ((1 - projected.y) / 2) * rect.height - y
          ),
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
        const sp = toScreen(gapPoint(g, live.current.shape), GAP_SIZE / 2)
        if (sp && sp.d < Math.max(sp.r, 14) && sp.d < bestD) {
          bestD = sp.d
          best = { kind: 'gap', gap: g }
        }
      }
      if (best) return best
      for (const h of live.current.halos) {
        const sp = toScreen(h.center, haloReach(h))
        if (sp && sp.d < Math.max(sp.r, 18) && sp.d < bestD) {
          bestD = sp.d
          best = { kind: 'halo', halo: h }
        }
      }
      return best
    }

    function focusRing(h: Halo) {
      focusOn(rig.current, el, 'floor', h.center, h.floor, live.current.shape)
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
      const full = !!live.current.full && e.pointerType === 'touch'
      if (full) {
        fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (fingers.size === 2) {
          // A second finger turns the drag into a pinch.
          pinch = { gap: fingerGap(), zoom: rig.current.zoom, moving: false, midY: fingerMidY() }
          pinched = true
          down = null
          rig.current.dragging = false
          rig.current.spin = 0
          rig.current.glide = 0
          el.setPointerCapture?.(e.pointerId)
          return
        }
        if (fingers.size > 2) return
      }
      const turned = rig.current.focus?.orbit ?? rig.current
      down = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        at: e.timeStamp,
        // A finger keeps one direction. In full-screen up and down travels the
        // floors; in the page it's the browser's own scroll.
        mouse: e.pointerType !== 'touch',
        drag: false,
        axis: null,
        settled: false,
        t0: rig.current.t,
        turned,
        az0: turned.az,
      }
      rig.current.spin = 0
      rig.current.glide = 0
      el.setPointerCapture?.(e.pointerId)
    }

    const onMove = (e: PointerEvent) => {
      if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinch && fingers.size >= 2) {
        const r = rig.current
        // Two fingers moving together up or down tilt the view.
        const midY = fingerMidY()
        turn(r, 0, (midY - pinch.midY) * DRAG_TILT)
        pinch.midY = midY
        r.ease = ORBIT.easeS
        const gap = fingerGap()
        if (pinch.moving || Math.abs(gap - pinch.gap) >= PINCH.startPx) {
          pinch.moving = true
          const next = pinchZoom(pinch.zoom, pinch.gap, gap)
          // Backing out leaves a close-up, as Move Farther does.
          if (next > pinch.zoom && r.focus) letGo()
          r.zoom = next
        }
        invalidate()
        return
      }
      if (down && e.pointerId === down.id) {
        if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_THRESHOLD_PX) {
          down.drag = true
          el.style.cursor = 'grabbing'
        }
        if (down.drag) {
          const r = rig.current
          // A swipe keeps one direction: sideways turns, up and down is the
          // browser's own page scroll, or in full-screen the floors. It waits
          // for a clear direction (ticket 268), and over its first stretch it
          // can still change its mind, because a thumb's swipe starts on an arc.
          // A change undoes the other direction and counts the whole move.
          if (!down.mouse && !down.settled) {
            const ax = e.clientX - down.x
            const ay = e.clientY - down.y
            const far = Math.hypot(ax, ay)
            if (far < SWIPE.lockPx) return
            const axis = Math.abs(ax) >= Math.abs(ay) ? 'x' : 'y'
            if (axis !== down.axis) {
              if (down.axis === 'x') down.turned.az = down.az0
              if (down.axis === 'y') r.t = down.t0
              r.spin = 0
              r.glide = 0
              down.axis = axis
              down.lastX = down.x
              down.lastY = down.y
            }
            if (far >= SWIPE.settlePx) down.settled = true
          }
          const dx = e.clientX - down.lastX
          const dy = e.clientY - down.lastY
          const secs = Math.max((e.timeStamp - down.at) / 1000, 0.001)
          if (down.mouse || down.axis === 'x') {
            const rate = down.mouse ? DRAG_TURN : swipeTurnRate(el.clientWidth, DRAG_TURN)
            const dAz = -dx * rate
            turn(r, dAz, down.mouse ? dy * DRAG_TILT : 0)
            r.dragging = true
            r.ease = ORBIT.easeS
            const max = down.mouse ? SPIN_MAX : SWIPE.spinMax
            r.spin = THREE.MathUtils.clamp(r.spin * 0.6 + (dAz / secs) * 0.4, -max, max)
          } else if (live.current.full) {
            const dT = swipeTravel(dy, el.clientHeight)
            if (travel(dT)) {
              r.dragging = true
              const max = SWIPE.glideMax
              r.glide = THREE.MathUtils.clamp(r.glide * 0.6 + (dT / secs) * 0.4, -max, max)
            } else r.glide = 0
          }
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
      if (fingers.delete(e.pointerId)) {
        if (fingers.size < 2) pinch = null
        if (pinched) {
          if (fingers.size === 0) pinched = false
          el.releasePointerCapture?.(e.pointerId)
          return
        }
      }
      if (!down || e.pointerId !== down.id) return
      const wasDrag = down.drag
      const r = rig.current
      const l = live.current
      if (l.reducedMotion || e.timeStamp - down.at > SPIN_STALE_MS) {
        r.spin = 0
        r.glide = 0
      }
      // A phone swipe up or down settles on a floor (ticket 248).
      if (wasDrag && l.full && down.axis === 'y' && !r.focus) {
        r.t = swipeLanding(r.t, r.glide, l.shape)
        r.ease = ORBIT.easeS
      }
      r.glide = 0
      r.dragging = false
      down = null
      el.releasePointerCapture?.(e.pointerId)
      el.style.cursor = ''
      invalidate()
      if (wasDrag) return
      const hit = pickAt(e.clientX, e.clientY)
      if (hit?.kind === 'business') {
        // The same dot again: frame it once more.
        const p = hit.id === l.selectedId ? l.placed.get(hit.id) : undefined
        if (p) {
          const floor = l.businesses.find((b) => b.id === hit.id)?.floorIndex
          focusOn(r, el, 'business', p, floor, l.shape)
        }
        l.onSelect(hit.id)
      } else if (hit?.kind === 'gap') l.onSelectGap?.(hit.gap)
      else if (hit?.kind === 'halo') focusRing(hit.halo)
      else {
        l.onSelect(null)
        l.onSelectGap?.(null)
      }
    }

    const onCancel = (e: PointerEvent) => {
      fingers.delete(e.pointerId)
      if (fingers.size < 2) pinch = null
      if (fingers.size === 0) pinched = false
      down = null
      rig.current.dragging = false
      rig.current.spin = 0
      rig.current.glide = 0
      el.style.cursor = ''
    }

    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && !down) {
        el.style.cursor = ''
        setHover(null)
      }
    }

    function hasPick(): boolean {
      const l = live.current
      return !!rig.current.focus || !!l.selectedId || !!l.selectedGap || l.focusFloor !== null
    }

    /** Closes whatever is picked, for a move that takes the reader off it. */
    function letGo() {
      const l = live.current
      clearFocus(rig.current)
      if (l.selectedId) l.onSelect(null)
      if (l.selectedGap) l.onSelectGap?.(null)
      if (l.focusFloor !== null) l.onLeaveFloor?.()
    }

    /** Moves down (+) or up (-) the silo. False past either end. */
    function travel(dt: number): boolean {
      const r = rig.current
      if (!r.focus && ((r.t <= 0 && dt < 0) || (r.t >= 1 && dt > 0))) return false
      r.ease = ORBIT.easeS
      letGo()
      r.t = THREE.MathUtils.clamp(r.t + dt, 0, 1)
      seatTrack(el, r.t)
      invalidate()
      return true
    }

    const nav = live.current.navRef
    if (nav) {
      nav.current = {
        travel,
        turn: (dAz) => {
          const r = rig.current
          r.ease = ORBIT.easeS
          r.spin = 0
          turn(r, dAz, 0)
          invalidate()
        },
        wholeTower: (on) => {
          const r = rig.current
          const out = on ?? r.zoom < 0.5
          if (out) letGo()
          r.zoom = out ? 1 : 0
          r.spin = 0
          r.ease = live.current.reducedMotion ? ORBIT.easeS : WHOLE_TOWER_S
          invalidate()
        },
        zoomStep: (dir) => {
          const r = rig.current
          const next = stepZoom(r.zoom, dir)
          if (next === r.zoom) return
          // Backing out leaves a close-up; stepping in from one keeps it.
          if (dir > 0 && r.focus) letGo()
          r.zoom = next
          r.spin = 0
          r.ease = live.current.reducedMotion ? ORBIT.easeS : ZOOM_STEP_S
          invalidate()
        },
        recenter,
      }
    }

    /** The opening view at the level the reader is on: inside, nothing picked. */
    function recenter() {
      const r = rig.current
      letGo()
      r.az = RECENTER.az
      r.el = RECENTER.el
      r.zoom = RECENTER.zoom
      r.spin = 0
      r.ease = live.current.reducedMotion ? ORBIT.easeS : WHOLE_TOWER_S
      invalidate()
    }

    // A double-click on empty space recenters. On a dot it stays a pick.
    const onDoubleClick = (e: MouseEvent) => {
      if (pickAt(e.clientX, e.clientY)) return
      recenter()
      live.current.onRecenter?.()
    }

    // A trackpad pinch (or ctrl + wheel) zooms. A plain wheel stays the page
    // scroll, which travels between floors.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const r = rig.current
      r.zoom = THREE.MathUtils.clamp(r.zoom + e.deltaY * PINCH_ZOOM, ZOOM.min, 1)
      r.ease = ORBIT.easeS
      invalidate()
    }

    // The page scroll is the silo's position. A pick has already written its
    // own spot on the track, so only a real move away from it lets go.
    const onScroll = () => {
      const t = trackT(el)
      if (t === null) return
      const r = rig.current
      if (hasPick()) {
        if (Math.abs(t - r.t) <= PICK_HOLD) return
        letGo()
      }
      if (t === r.t) return
      // The zoom holds while scrolling, so the reader can ride the floors from
      // part way out.
      r.t = t
      r.ease = ORBIT.easeS
      invalidate()
    }

    // A reload partway down opens where the page is, with no glide. At the top,
    // the opening starts outside at the whole tower and glides in (ticket 247).
    const start = trackT(el)
    if (start !== null && !hasPick()) {
      const r = rig.current
      const l = live.current
      r.t = start
      const home = orbitForScroll(start, r.az, r.el, l.shape)
      if (l.intro && !l.reducedMotion && start < 0.01) {
        r.cur = zoomGoal(home, 1, l.phone, l.shape)
        r.ease = INTRO.glideS
      } else r.cur = home
      invalidate()
    }

    el.addEventListener('dblclick', onDoubleClick)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (nav) nav.current = null
      el.removeEventListener('dblclick', onDoubleClick)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('scroll', onScroll)
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

    // The phone preview in the page turns slowly on its own (ticket 248).
    // It waits for the opening glide to land.
    if (l.preview && l.motion && !l.intro && !r.focus && !r.dragging) {
      r.az += PREVIEW_SPIN * dt
    }

    const { shape } = l
    const base = r.focus?.orbit ?? orbitForScroll(r.t, r.az, r.el, shape)
    const goal = r.zoom ? zoomGoal(base, r.zoom, l.phone, shape) : base
    const floor = floorForHeight(base.y, shape)
    if (floor !== floorNow.current) {
      floorNow.current = floor
      l.onFloorChange?.(floor)
    }
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

    // Fog thins and the floors even out as the camera backs out of the tower.
    const out = zoomAmount(r.cur.R, shape)
    const { glass } = l
    setUniform(glass.out, out)
    setUniform(glass.fog, fogForZoom(out, shape))
    setFog(scene, glass.fog.value)
    // The lit floor follows the floor being ridden, not the zoomed camera.
    setUniform(
      glass.floor,
      THREE.MathUtils.clamp((shape.y[0]! - base.y) / floorGap(shape), 0, shape.y.length - 1)
    )
    const isOut = r.zoom >= 0.5
    if (isOut !== outNow.current) {
      outNow.current = isOut
      l.onWholeTowerChange?.(isOut)
    }
    if (r.zoom !== zoomNow.current) {
      zoomNow.current = r.zoom
      l.onZoomChange?.(r.zoom)
    }

    // With the loop on demand, keep drawing until the move settles.
    if (!settled && !l.motion) invalidate()
  })

  return null
}

// ─── The cage, sky and hub ───────────────────────────────────────────────────

function disposeAll(objects: readonly (THREE.Points | THREE.Line | THREE.Mesh)[]) {
  for (const o of objects) {
    o.geometry.dispose()
    ;(o.material as THREE.Material).dispose()
  }
}

const FOG_GLSL = /* glsl */ `
float fogF(float d) { float x = uDensity * d; return exp(-x * x); }
`

const GLASS_VERT = /* glsl */ `
varying vec2 vUv;
varying float vD;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vD = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

/** A glass floor: a faint fill, a lit rim, and a little grain. The camera's floor is brightest. */
const PLATE_FRAG = /* glsl */ `
uniform vec3 uTint;
uniform float uIdx;
uniform float uFloor;
uniform float uOut;
uniform float uDensity;
uniform float uEdge;
uniform float uFill;
varying vec2 vUv;
varying float vD;
${FOG_GLSL}
void main() {
  float r = length(vUv - 0.5) * 2.0;
  if (r > 1.0) discard;
  float lit = max(0.0, 1.0 - abs(uFloor - uIdx));
  float dim = mix(mix(0.35, 1.0, lit), 0.85, uOut);
  float edge = smoothstep(0.95, 0.995, r) * (1.0 - smoothstep(0.995, 1.0, r));
  float fill = uFill * (1.0 - r * 0.7);
  float a = (fill + edge * uEdge) * dim * fogF(vD);
  gl_FragColor = vec4(uTint * a, 1.0);
  #include <colorspace_fragment>
}
`

/**
 * Normals and view rays are normalized here, not in the vertex shader: after
 * interpolation a "unit" vector can be a hair long, a dot product a hair over
 * 1, and `pow` of the negative base that follows is NaN on Apple GPUs. One NaN
 * pixel on the core became a black hole once the glow spread it (ticket 267),
 * so every `pow` base is clamped too.
 */
const SAFE_GLSL = /* glsl */ `
vec3 safeNormalize(vec3 v) {
  return v / max(length(v), 1e-6);
}
`

/** The glass wall: almost clear, a band of light at each floor, brighter at the edges. */
const SHELL_VERT = /* glsl */ `
varying float vY;
varying float vD;
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vY = wp.y;
  vec4 mv = viewMatrix * wp;
  vD = -mv.z;
  // Left unnormalized: the fragment shader normalizes them safely.
  vN = normalMatrix * normal;
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

const SHELL_FRAG = /* glsl */ `
uniform vec3 uTint;
uniform float uLevels[${SILO_FLOORS.length}];
uniform float uDensity;
varying float vY;
varying float vD;
varying vec3 vN;
varying vec3 vV;
${FOG_GLSL}
${SAFE_GLSL}
void main() {
  float bands = 0.0;
  for (int i = 0; i < ${SILO_FLOORS.length}; i++) {
    float d = (vY - uLevels[i]) / 2.6;
    bands += exp(-d * d);
  }
  float rim = pow(clamp(1.0 - abs(dot(safeNormalize(vN), safeNormalize(vV))), 0.0, 1.0), 3.0);
  float a = (bands * 0.022 + rim * 0.005) * fogF(vD);
  gl_FragColor = vec4(uTint * a, 1.0);
  #include <colorspace_fragment>
}
`

/** The light that rises from the core up through every floor. */
const COLUMN_FRAG = /* glsl */ `
uniform float uDensity;
varying vec2 vUv;
varying float vD;
${FOG_GLSL}
void main() {
  float a = 0.03 * (0.2 + 0.8 * (1.0 - vUv.y)) * fogF(vD);
  gl_FragColor = vec4(vec3(1.0, 0.8, 0.45) * a, 1.0);
  #include <colorspace_fragment>
}
`

const CORE_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalMatrix * normal;
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

/**
 * Soft gold, a little lighter at the middle, breathing slowly while motion is
 * on. Kept dim on purpose (founder 2026-11-21: "subtle but noticeable").
 */
const SPHERE_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
${SAFE_GLSL}
void main() {
  float fr = pow(clamp(1.0 - dot(safeNormalize(vN), safeNormalize(vV)), 0.0, 1.0), 2.2);
  float breathe = 0.94 + 0.06 * sin(uTime * 0.9);
  vec3 c = mix(vec3(0.26, 0.2, 0.11), vec3(0.17, 0.11, 0.04), fr) * (0.8 + fr * 0.5) * breathe;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`

const glassBlend = {
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
} as const

/** One glass plate per floor and the glass wall (ticket 246). Nothing in here is a label. */
function GlassTower({ glass, shape }: { glass: Glass; shape: SiloShape }) {
  const objects = useMemo(() => {
    const out: THREE.Mesh[] = []
    shape.y.forEach((y, k) => {
      const tint = new THREE.Color(PLATE_TINTS[k] ?? PLATE_TINTS[0])
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(shape.R, 160),
        new THREE.ShaderMaterial({
          ...glassBlend,
          side: THREE.DoubleSide,
          vertexShader: GLASS_VERT,
          fragmentShader: PLATE_FRAG,
          uniforms: {
            uTint: { value: tint },
            uIdx: { value: k },
            uFloor: glass.floor,
            uOut: glass.out,
            uDensity: glass.fog,
            uEdge: { value: 0.2 },
            uFill: { value: 0.0015 },
          },
        })
      )
      m.rotation.x = -Math.PI / 2
      m.position.y = y
      m.renderOrder = -1
      out.push(m)
    })
    const top = shellTop(shape)
    const bottom = shellBottom(shape)
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(shape.R + 0.6, shape.R + 0.6, top - bottom, 160, 1, true),
      new THREE.ShaderMaterial({
        ...glassBlend,
        side: THREE.DoubleSide,
        vertexShader: SHELL_VERT,
        fragmentShader: SHELL_FRAG,
        uniforms: {
          uTint: { value: new THREE.Color(GOLD) },
          uLevels: { value: [...shape.y] },
          uDensity: glass.fog,
        },
      })
    )
    shell.position.y = (top + bottom) / 2
    shell.renderOrder = -1
    return [...out, shell]
  }, [glass, shape])
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
function Sky({ phone, dot, shape }: { phone: boolean; dot: THREE.Texture; shape: SiloShape }) {
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
      // Kept under the bloom threshold so stars stay pin-sharp, never fuzzy.
      const w = 0.3 + rand() * 0.4
      col.set(rand() < 0.5 ? [w, w * 0.82, w * 0.5] : [w, w * 0.95, w * 0.9], i * 3)
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    // A hard 1-2px square twinkles as the view turns, landing on one pixel
    // or two. A soft 2.6px disc covers the same pixels from frame to frame.
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        size: 2.6,
        sizeAttenuation: false,
        map: dot,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        fog: false,
        depthWrite: false,
      })
    )

    // A little dust, kept sparse: hundreds of motes read as haze.
    const m = phone ? 60 : 120
    const mp = new Float32Array(m * 3)
    const top = shellTop(shape)
    const bottom = shellBottom(shape)
    for (let i = 0; i < m; i++) {
      const r = Math.sqrt(rand()) * (shape.R - 1)
      const a = rand() * Math.PI * 2
      mp.set([Math.cos(a) * r, top - rand() * (top - bottom), Math.sin(a) * r], i * 3)
    }
    const moteGeo = new THREE.BufferGeometry()
    moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3))
    const motes = new THREE.Points(
      moteGeo,
      // Big enough to stay over a couple of pixels from across the tower.
      new THREE.PointsMaterial({
        size: 0.7,
        map: dot,
        color: 0xf6d58a,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    return [stars, motes]
  }, [phone, dot, shape])
  useEffect(() => () => disposeAll(objects), [objects])
  return (
    <>
      {objects.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </>
  )
}

/** Where the money settles: a smooth glowing core with a halo, and a column of light up the tower. */
function Core({
  glow,
  motion,
  glass,
  shape,
}: {
  glow: THREE.Texture
  motion: boolean
  glass: Glass
  shape: SiloShape
}) {
  const { hub, hubR } = shape
  const objects = useMemo(() => {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(shape.hubR, 64, 48),
      new THREE.ShaderMaterial({
        vertexShader: CORE_VERT,
        fragmentShader: SPHERE_FRAG,
        uniforms: { uTime: glass.time },
      })
    )
    sphere.position.set(shape.hub.x, shape.hub.y, shape.hub.z)
    const height = shellTop(shape) - shape.hub.y
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, height, 16, 1, true),
      new THREE.ShaderMaterial({
        ...glassBlend,
        vertexShader: GLASS_VERT,
        fragmentShader: COLUMN_FRAG,
        uniforms: { uDensity: glass.fog },
      })
    )
    column.position.set(shape.hub.x, shape.hub.y + height / 2, shape.hub.z)
    return [sphere, column]
  }, [glass, shape])
  useEffect(() => () => disposeAll(objects), [objects])
  useFrame((_, delta) => {
    if (motion) setUniform(glass.time, glass.time.value + Math.min(delta, 0.05))
  })
  return (
    <>
      {objects.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
      <sprite position={[hub.x, hub.y, hub.z]} scale={hubR * 5}>
        <spriteMaterial
          map={glow}
          color={GOLD_BRIGHT}
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </>
  )
}

/** Replaces NaN or Inf with the background, so a bad pixel stays one pixel. */
const NAN_GUARD = {
  name: 'NanGuard',
  uniforms: { tDiffuse: { value: null }, uBg: { value: BG_FOR_COMPOSER } },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec3 uBg;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  bool bad = any(isnan(c)) || any(isinf(c));
  gl_FragColor = bad ? vec4(uBg, 1.0) : c;
}
`,
}

/**
 * The real glow (desktop only; phones keep the baked sprites). three's own
 * composer, so there's no new package. Takes over drawing the frame.
 */
function Bloom() {
  const { gl, scene, camera, size } = useThree()
  const dpr = useThree((s) => s.viewport.dpr)
  const fx = useMemo(() => {
    // The composer draws into its own target, which skips the canvas's
    // antialiasing, so the target gets its own (4x MSAA). Without it the thin
    // links come out jagged on desktop.
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
    const composer = new EffectComposer(gl, target)
    composer.addPass(new RenderPass(scene, camera))
    // The glow's blur spreads a bad pixel across its coarse levels: one NaN
    // turned into a black block hundreds of pixels wide (ticket 267). This
    // pass swaps any NaN or Inf for the background before the glow sees it.
    composer.addPass(new ShaderPass(NAN_GUARD))
    // A high threshold and a short reach: only the bright bits glow, so the
    // dark between them stays clear (founder 2026-11-21: no haze).
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.25, 0.4)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
    return { composer, bloom }
  }, [gl, scene, camera])
  useEffect(() => {
    fx.composer.setPixelRatio(dpr)
    // The glow runs at the composer's full size. Smaller, thin lines and small
    // dots fall between its pixels as the view moves, and the glow flickers.
    fx.composer.setSize(size.width, size.height)
  }, [fx, size, dpr])
  useEffect(() => {
    gl.setClearColor(BG_FOR_COMPOSER, 1)
    return () => {
      gl.setClearColor(BG, 1)
      fx.bloom.dispose()
      fx.composer.dispose()
    }
  }, [fx, gl])
  useFrame((_, delta) => fx.composer.render(delta), 1)
  return null
}

// ─── Floor rings ─────────────────────────────────────────────────────────────

/** How far a ring reaches from its center along the wall, for picking. */
function haloReach(h: Halo): number {
  return h.floor === 0 ? h.radius + 1.5 : h.radius * CLUSTER_WIDE + 1.5
}

function Halos({
  halos,
  colorBy,
  focusFloor,
  textures,
  shape,
}: {
  shape: SiloShape
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
          <HaloRing
            key={`${h.familyIndex}:${h.floor}`}
            h={h}
            shape={shape}
            color={color}
            lit={lit}
            textures={textures}
          />
        )
      })}
    </>
  )
}

/** Seconds for a ring to brighten or dim when its floor is picked. */
const HALO_EASE_S = 0.35

function HaloRing({
  h,
  shape,
  color,
  lit,
  textures,
}: {
  h: Halo
  shape: SiloShape
  color: string
  lit: boolean
  textures: Textures
}) {
  const invalidate = useThree((s) => s.invalidate)
  const ringRef = useRef<THREE.MeshBasicMaterial>(null)
  // Eased, never snapped: a whole floor of rings jumping at once reads as a flash.
  useFrame((_, delta) => {
    const m = ringRef.current
    if (!m) return
    const goal = lit ? 0.26 : 0.1
    const gap = goal - m.opacity
    if (Math.abs(gap) < 0.002) {
      if (gap !== 0) m.opacity = goal
      return
    }
    m.opacity += gap * (1 - Math.exp(-Math.min(delta, 0.05) / (HALO_EASE_S / 4)))
    invalidate()
  })
  return (
    <group position={[h.center.x, h.center.y, h.center.z]}>
      {/* A flat ring on the plate, long along the wall like its cluster. */}
      <group rotation={[0, haloTurn(h, shape), 0]}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[
            (h.floor === 0 ? h.radius + 1.5 : h.radius * CLUSTER_WIDE + 1.5) * 2.2,
            (h.radius + 1.5) * 2.2,
            1,
          ]}
          renderOrder={1}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            ref={ringRef}
            map={textures.ring}
            color={color}
            transparent
            opacity={0.1}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
      {h.floor === 0 && (
        // The shopper crowd: one soft glow, never a dot per person.
        <sprite scale={shape.crowdR * 2} renderOrder={1}>
          <spriteMaterial
            map={textures.glow}
            color={color}
            transparent
            opacity={0.14}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      )}
    </group>
  )
}

/** Turns a flat ring so its long side runs along the wall at its wedge. */
function haloTurn(h: Halo, shape: SiloShape): number {
  const a = wedgeAngle(h.familyIndex, h.floor, shape)
  return Math.atan2(-Math.cos(a), -Math.sin(a))
}

// ─── Links and pulses ────────────────────────────────────────────────────────

function linkCurve(s: Shown) {
  const [a, b, c, d] = linkControlPoints(s.from, s.p)
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
      const k = s.b.id === selectedId ? 0.95 : s.b.isYou ? 0.85 : 0.2
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
    const geo = new LineSegmentsGeometry()
    if (pos.length > 0) {
      geo.setPositions(pos)
      geo.setColors(col)
    }
    const mat = new LineMaterial({
      vertexColors: true,
      linewidth: LINK_WIDTH_PX,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    mat.fog = true
    const obj = new LineSegments2(geo, mat)
    obj.frustumCulled = false
    return obj
  }, [shown, colorBy, selectedId])
  useLinkResolution(line)
  useEffect(() => () => disposeLine(line), [line])
  return <primitive object={line} />
}

/** Fat lines size themselves against the canvas, in CSS pixels. */
function useLinkResolution(line: LineSegments2 | null) {
  const size = useThree((s) => s.size)
  useEffect(() => {
    line?.material.resolution.set(size.width, size.height)
  }, [line, size])
}

function disposeLine(line: LineSegments2) {
  line.geometry.dispose()
  line.material.dispose()
}

/**
 * The reader's own receipts still in review (ticket 250): a dashed gold line
 * from their family's crowd to the business, so they see their connection the
 * moment they send a receipt. Only the reader's own page carries `youPending`,
 * so no one else ever sees these.
 */
function PendingLinks({ shown }: { shown: readonly Shown[] }) {
  const line = useMemo(() => {
    const pending = shown.filter((s) => s.on && s.b.youPending && !s.b.linked)
    if (pending.length === 0) return null
    const pos: number[] = []
    for (const s of pending) {
      const pts = linkCurve(s).getPoints(LINK_SEGMENTS)
      for (let i = 0; i < LINK_SEGMENTS; i++) {
        const p0 = pts[i]!
        const p1 = pts[i + 1]!
        pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z)
      }
    }
    const geo = new LineSegmentsGeometry()
    geo.setPositions(pos)
    const mat = new LineMaterial({
      color: GOLD_BRIGHT,
      linewidth: LINK_WIDTH_PX,
      dashed: true,
      dashSize: 1.4,
      gapSize: 1.0,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    mat.fog = true
    const obj = new LineSegments2(geo, mat)
    obj.computeLineDistances()
    obj.frustumCulled = false
    return obj
  }, [shown])
  useLinkResolution(line)
  useEffect(() => () => (line ? disposeLine(line) : undefined), [line])
  return line ? <primitive object={line} /> : null
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
        size: 2.6,
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

/** An arriving line is a little wider than a resting one, so it reads as new. */
const ARRIVAL_WIDTH_PX = 2.6

/**
 * Demo mode (ticket 249): the sample's newest receipt. Its line grows along the
 * same curve as the resting link, a bright head leading, then fades back into
 * the map before the next one. One line, filled in place: nothing rebuilds.
 * The pick follows demoArrivalAt over every linked business, the same list the
 * ticker reads, so the line and the ticker always name the same business.
 */
function Arrivals({ shown, dot }: { shown: readonly Shown[]; dot: THREE.Texture }) {
  const links = useMemo(() => shown.filter((s) => s.b.linked), [shown])
  const line = useMemo(() => {
    const geo = new LineSegmentsGeometry()
    geo.setPositions(new Float32Array(LINK_SEGMENTS * 6))
    const mat = new LineMaterial({
      color: GOLD_BRIGHT,
      linewidth: ARRIVAL_WIDTH_PX,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    mat.fog = true
    const obj = new LineSegments2(geo, mat)
    obj.frustumCulled = false
    obj.visible = false
    return obj
  }, [])
  const head = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3))
    const obj = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 4.2,
        map: dot,
        color: GOLD_BRIGHT,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    obj.frustumCulled = false
    obj.visible = false
    return obj
  }, [dot])
  useLinkResolution(line)
  useEffect(() => () => disposeLine(line), [line])
  useEffect(() => () => disposeAll([head]), [head])

  const flying = useRef<{ seq: number; curve: THREE.CubicBezierCurve3 | null }>({
    seq: -1,
    curve: null,
  })
  const at = useMemo(() => new THREE.Vector3(), [])
  // Written each frame through refs, the way three objects are meant to be.
  const lineRef = useRef<LineSegments2>(null)
  const headRef = useRef<THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>>(null)
  useFrame(() => {
    const ln = lineRef.current
    const hd = headRef.current
    if (!ln || !hd) return
    const a = demoArrivalAt(Date.now(), links.length)
    const s = a ? links[a.index] : undefined
    if (!a || !s || !s.on) {
      ln.visible = false
      hd.visible = false
      return
    }
    const f = flying.current
    if (a.seq !== f.seq || !f.curve) {
      f.seq = a.seq
      f.curve = linkCurve(s)
      const pts = f.curve.getPoints(LINK_SEGMENTS)
      const start = ln.geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute
      const arr = start.data.array as Float32Array
      for (let i = 0; i < LINK_SEGMENTS; i++) {
        const p0 = pts[i]!
        const p1 = pts[i + 1]!
        arr.set([p0.x, p0.y, p0.z, p1.x, p1.y, p1.z], i * 6)
      }
      start.data.needsUpdate = true
    }
    ln.visible = true
    ln.geometry.instanceCount = Math.max(1, Math.round(a.grow * LINK_SEGMENTS))
    ln.material.opacity = 0.9 * a.glow
    f.curve.getPoint(a.grow, at)
    const hp = hd.geometry.getAttribute('position') as THREE.BufferAttribute
    hp.setXYZ(0, at.x, at.y, at.z)
    hp.needsUpdate = true
    hd.material.opacity = a.grow < 1 ? 1 : a.glow
    hd.visible = true
  })

  return (
    <>
      <primitive ref={lineRef} object={line} />
      <primitive ref={headRef} object={head} />
    </>
  )
}

/** A business-to-business line is thinner than a shopper's, so the floors stay calm. */
const SUPPLY_WIDTH_PX = 1.3

/** From the buyer to the seller, bowing in toward the core like the shopper links. */
function supplyCurve(a: Point3, b: Point3) {
  const [p0, p1, p2, p3] = linkControlPoints(a, b)
  return new THREE.CubicBezierCurve3(v3(p0), v3(p1), v3(p2), v3(p3))
}

/** Appends one curve as line segments, its colour running from `ca` to `cb`. */
function pushCurve(
  pos: number[],
  col: number[],
  curve: THREE.Curve<THREE.Vector3>,
  ca: THREE.Color,
  cb: THREE.Color,
  c: THREE.Color
) {
  const pts = curve.getPoints(LINK_SEGMENTS)
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

function fatLines(pos: number[], col: number[], width: number) {
  const geo = new LineSegmentsGeometry()
  if (pos.length > 0) {
    geo.setPositions(pos)
    geo.setColors(col)
  }
  const mat = new LineMaterial({
    vertexColors: true,
    linewidth: width,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  mat.fog = true
  const obj = new LineSegments2(geo, mat)
  obj.frustumCulled = false
  return obj
}

/**
 * Demo mode: businesses buying from businesses, one faint line each, down the
 * floors. In the kind colours a line runs from the buyer's colour to the
 * seller's, so a cafe buying from a woodshop reads as green into orange. A
 * picked business lights its own lines; a running trail dims them all.
 * Rebuilt only when the data, colours or pick change, never per frame.
 */
function SupplyLinks({
  shown,
  supply,
  colorBy,
  selectedId,
  dimmed,
}: {
  shown: readonly Shown[]
  supply: readonly DemoSupplyLink[]
  colorBy: ColorBy
  selectedId: string | null
  dimmed: boolean
}) {
  const line = useMemo(() => {
    const byId = new Map(shown.map((s) => [s.b.id, s]))
    const pos: number[] = []
    const col: number[] = []
    const ca = new THREE.Color()
    const cb = new THREE.Color()
    const c = new THREE.Color()
    for (const l of supply) {
      const a = byId.get(l.from)
      const b = byId.get(l.to)
      if (!a || !b || !a.on || !b.on) continue
      const lit = selectedId !== null && (l.from === selectedId || l.to === selectedId)
      const k = lit ? 0.8 : dimmed ? 0.05 : 0.13
      ca.set(colorBy === 'category' ? familyColor(a.b.familyIndex) : GOLD).multiplyScalar(k)
      cb.set(colorBy === 'category' ? familyColor(b.b.familyIndex) : GOLD).multiplyScalar(k)
      pushCurve(pos, col, supplyCurve(a.p, b.p), ca, cb, c)
    }
    return fatLines(pos, col, SUPPLY_WIDTH_PX)
  }, [shown, supply, colorBy, selectedId, dimmed])
  useLinkResolution(line)
  useEffect(() => () => disposeLine(line), [line])
  return <primitive object={line} />
}

/** The trail line is the widest on the map: it is what the reader is following. */
const TRAIL_WIDTH_PX = 2.8
/** One run of the spark along the newest hop, then a short rest. */
const TRAIL_SPARK_MS = 1600
const TRAIL_REST_MS = 500

/**
 * Follow a Dollar: the path from the shoppers to the shop, then down the
 * supply lines. Hops already taken are bright gold, the rest of the way faint,
 * and a spark runs the newest hop while motion is on. Built once per stop.
 */
function TrailPath({
  shown,
  trail,
  dot,
  motion,
}: {
  shown: readonly Shown[]
  trail: { ids: readonly string[]; stop: number }
  dot: THREE.Texture
  motion: boolean
}) {
  const { line, hop } = useMemo(() => {
    const byId = new Map(shown.map((s) => [s.b.id, s]))
    const stops = trail.ids.map((id) => byId.get(id)).filter((s): s is Shown => !!s)
    const curves: THREE.Curve<THREE.Vector3>[] = []
    if (stops[0]) curves.push(linkCurve(stops[0]))
    for (let i = 1; i < stops.length; i++) curves.push(supplyCurve(stops[i - 1]!.p, stops[i]!.p))
    const pos: number[] = []
    const col: number[] = []
    const bright = new THREE.Color(GOLD_BRIGHT)
    const faint = new THREE.Color(GOLD).multiplyScalar(0.22)
    const c = new THREE.Color()
    curves.forEach((curve, i) => {
      const tint = i <= trail.stop ? bright : faint
      pushCurve(pos, col, curve, tint, tint, c)
    })
    return {
      line: fatLines(pos, col, TRAIL_WIDTH_PX),
      hop: curves[Math.min(trail.stop, curves.length - 1)] ?? null,
    }
  }, [shown, trail])
  const spark = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3))
    const obj = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 4.2,
        map: dot,
        color: GOLD_BRIGHT,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    obj.frustumCulled = false
    obj.visible = false
    return obj
  }, [dot])
  useLinkResolution(line)
  useEffect(() => () => disposeLine(line), [line])
  useEffect(() => () => disposeAll([spark]), [spark])

  // Each new stop starts its spark from the top of the hop.
  const started = useRef(0)
  useEffect(() => {
    started.current = performance.now()
  }, [hop])
  const at = useMemo(() => new THREE.Vector3(), [])
  const sparkRef = useRef<THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>>(null)
  useFrame(() => {
    const sp = sparkRef.current
    if (!sp) return
    if (!motion || !hop) {
      sp.visible = false
      return
    }
    const run = (performance.now() - started.current) % (TRAIL_SPARK_MS + TRAIL_REST_MS)
    const t = Math.min(1, run / TRAIL_SPARK_MS)
    // Eased, so the spark sets off and lands gently instead of snapping.
    hop.getPoint(t * t * (3 - 2 * t), at)
    const p = sp.geometry.getAttribute('position') as THREE.BufferAttribute
    p.setXYZ(0, at.x, at.y, at.z)
    p.needsUpdate = true
    sp.material.opacity = t < 1 ? 1 : 1 - (run - TRAIL_SPARK_MS) / TRAIL_REST_MS
    sp.visible = true
  })

  return (
    <>
      <primitive object={line} />
      <primitive ref={sparkRef} object={spark} />
    </>
  )
}

// ─── Business nodes ──────────────────────────────────────────────────────────

const NODE_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aIcon;
uniform float uScale;
uniform float uMul;
uniform float uDensity;
uniform float uMinPx;
varying vec3 vColor;
varying float vIcon;
varying float vFog;
varying float vDim;
varying float vPx;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 0.001);
  // A point under a couple of pixels pops on and off as it crosses pixel
  // centres while the camera moves. It keeps a floor size instead, and dims
  // by how much smaller it really is, so it fades out smoothly.
  float px = aSize * uMul * uScale / depth;
  gl_PointSize = max(px, uMinPx);
  vDim = clamp(px / uMinPx, 0.0, 1.0);
  vPx = gl_PointSize;
  vColor = aColor;
  vIcon = aIcon;
  vFog = 1.0 - exp(-uDensity * uDensity * depth * depth);
}
`

const CORE_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uFogColor;
uniform float uCells;
uniform float uPlainPx;
varying vec3 vColor;
varying float vIcon;
varying float vFog;
varying float vDim;
varying float vPx;
void main() {
  // Too small to read, the icon's thin rim and strokes shimmer as it moves,
  // so a small dot is a plain soft disc, blending into the icon as it grows.
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float plainA = 1.0 - smoothstep(max(0.0, 1.0 - 2.0 / vPx), 1.0, d);
  float k = smoothstep(uPlainPx * 0.75, uPlainPx * 1.25, vPx);
  vec4 t = vec4(0.0);
  if (k > 0.0) {
    vec2 uv = vec2((vIcon + gl_PointCoord.x) / uCells, 1.0 - gl_PointCoord.y);
    t = texture2D(uMap, uv);
  }
  float a = mix(plainA, t.a, k);
  if (a < mix(0.02, 0.3, k)) discard;
  vec3 c = vColor * mix(vec3(0.75), t.rgb, k);
  c = mix(c, uFogColor, vFog);
  gl_FragColor = vec4(mix(uFogColor, c, vDim), a);
  #include <colorspace_fragment>
}
`

const GLOW_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec3 vColor;
varying float vFog;
varying float vDim;
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(vColor, t.a * 0.16 * (1.0 - vFog) * vDim);
  #include <colorspace_fragment>
}
`

/** A dot never draws smaller than this many CSS pixels; smaller ones dim instead. */
const NODE_MIN_PX = 2.5
/** Under about this many CSS pixels a dot is a plain disc, not its icon. */
const NODE_PLAIN_PX = 9

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
  glass,
}: Inner & { shown: readonly Shown[]; textures: Textures; glass: Glass }) {
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
    const uMinPx = { value: NODE_MIN_PX }
    const uPlainPx = { value: NODE_PLAIN_PX }
    const uDensity = glass.fog
    const core = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: NODE_VERT,
        fragmentShader: CORE_FRAG,
        uniforms: {
          uScale,
          uDensity,
          uMinPx,
          uMul: { value: 2.0 },
          uMap: { value: textures.atlas },
          uFogColor: { value: BG },
          uCells: { value: ATLAS_CELLS },
          uPlainPx,
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
          uniforms: {
            uScale,
            uDensity,
            uMinPx,
            uMul: { value: 3 },
            uMap: { value: textures.glow },
          },
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
      glow.renderOrder = 1
      glow.frustumCulled = false
    }
    return { geo, core, glow, uScale, uMinPx, uPlainPx }
  }, [shown, phone, textures, glass])

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
    setUniform(objects.uMinPx, NODE_MIN_PX * gl.getPixelRatio())
    setUniform(objects.uPlainPx, NODE_PLAIN_PX * gl.getPixelRatio())

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
        <sprite
          key={s.b.id}
          position={[s.p.x, s.p.y, s.p.z]}
          scale={Math.max(s.size, 0.6) * 3.2}
          renderOrder={3}
        >
          <spriteMaterial
            map={ring}
            color={GOLD_BRIGHT}
            transparent
            depthTest={false}
            depthWrite={false}
          />
        </sprite>
      ))}
      {sel && (
        <sprite
          position={[sel.p.x, sel.p.y, sel.p.z]}
          scale={Math.max(sel.size, 0.6) * 4}
          renderOrder={3}
        >
          <spriteMaterial
            map={ring}
            color="#fcfaf4"
            transparent
            depthTest={false}
            depthWrite={false}
          />
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
  shape,
}: {
  shape: SiloShape
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
        const c = gapPoint(g, shape)
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
            const c = gapPoint(selected, shape)
            return [c.x, c.y, c.z] as [number, number, number]
          })()}
          scale={base * 2}
          renderOrder={3}
        >
          <spriteMaterial
            map={ring}
            color="#fcfaf4"
            transparent
            depthTest={false}
            depthWrite={false}
          />
        </sprite>
      )}
    </>
  )
}

// ─── DOM tags ────────────────────────────────────────────────────────────────

const LABEL_MAX = { desk: 10, phone: 7 }
/** A dot this many pixels across or bigger can carry its name. */
const LABEL_MIN_PX = { desk: 9, phone: 8 }
/** Gap labels show once the camera is this close to the square. */
const GAP_LABEL_DIST = 150
/** The plate radius GAP_LABEL_DIST was tuned on; a wider tower reaches further. */
const GAP_LABEL_R = 42
const HUD_SELECTORS = '.hud > *, .ctx, .dock, .silo-tag, .silo-hint'

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
    camera.position.distanceToSquared(st.pos) < 1e-6 &&
    1 - Math.abs(camera.quaternion.dot(st.quat)) < 1e-9
  if (same) return false
  st.pos.copy(camera.position)
  st.quat.copy(camera.quaternion)
  return true
}

const sameBoxes = (a: readonly LabelBox[], b: readonly LabelBox[]) =>
  a.length === b.length &&
  a.every((x, i) => {
    const y = b[i]!
    return (
      Math.abs(x.l - y.l) < 1 &&
      Math.abs(x.t - y.t) < 1 &&
      Math.abs(x.r - y.r) < 1 &&
      Math.abs(x.b - y.b) < 1
    )
  })

function Tags({
  shown,
  hoveredId,
  selectedId,
  hoverTagRef,
  youTagRef,
  labelsRef,
  gapLabelsRef,
  gaps,
  selectedGap,
  phone,
  shape,
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
      st.shown !== shown ||
      st.hovered !== hoveredId ||
      st.selected !== selectedId ||
      st.gap !== selectedGap
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
              return {
                l: r.left - c.left,
                t: r.top - c.top,
                r: r.right - c.left,
                b: r.bottom - c.top,
              }
            })
            .filter((b) => b.r > b.l && b.b > b.t)
        : []
      // The phone stage hangs over the band's top edge and the sideways stage
      // under its bottom edge, where nothing shows.
      const band = root?.getBoundingClientRect()
      const hung = band ? band.top - c.top : 0
      if (hung > 0) boxes.push({ l: 0, t: 0, r: c.width, b: hung })
      const under = band ? c.bottom - band.bottom : 0
      if (under > 0) boxes.push({ l: 0, t: c.height - under, r: c.width, b: c.height })
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
            free.find((x) => x.filled === id) ??
            free.reduce<LabelSlot | null>((a, x) => (!a || x.offAt < a.offAt ? x : a), null)
          const el = slot ? pool[st.slots.indexOf(slot)] : null
          if (!s || !slot || !(el instanceof HTMLElement)) continue
          slot.id = id
          if (slot.filled !== id) {
            slot.filled = id
            fillLabel(
              el,
              businessDisplayName(s.b),
              CATEGORY_FAMILIES[s.b.familyIndex]?.name ?? '',
              familyColor(s.b.familyIndex)
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
          const c = gapPoint(g, shape)
          worldTmp.set(c.x, c.y, c.z)
          const reach = GAP_LABEL_DIST * (shape.R / GAP_LABEL_R) * (slot.on ? 1.1 : 1)
          const near = camera.position.distanceTo(worldTmp) < reach
          const picked =
            !!selectedGap &&
            selectedGap.familyIndex === g.familyIndex &&
            selectedGap.floorIndex === g.floorIndex
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
          const l = clampLabelPos(at.x - w / 2, w, size.width)
          const top = clampLabelPos(at.y + 16, st.height, size.height)
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
          snapLabelPos(at.top, st.height, size.height, slot.t)
        )
        toggleLabel(el, slot, true)
      })
      gaps.forEach((g, i) => {
        const el = gapEls?.[i]
        const slot = st.gapSlots[i]
        if (!slot?.on || !(el instanceof HTMLElement)) return
        const at = toScreen(gapPoint(g, shape))
        if (!at) return
        const w = st.widths.get(`gap:${g.familyIndex}:${g.floorIndex}`) ?? el.offsetWidth
        moveLabel(
          el,
          slot,
          snapLabelPos(at.x - w / 2, w, size.width, slot.l),
          snapLabelPos(at.y + 16, st.height, size.height, slot.t)
        )
      })
    }

    const place = (
      el: Element | null | undefined,
      p: Point3 | undefined,
      lift: number,
      anchor: string
    ) => {
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
      place(
        hoverTagRef.current,
        hover && !hover.b.isYou ? hover.p : undefined,
        18,
        'translate(-50%, -100%)'
      )
      place(youTagRef.current, you?.p, 22, 'translate(-50%, -100%)')
    }

    // Without an ambient loop, nothing else asks for the frame that finishes a pick.
    if (st.stale || st.since.size > 0) invalidate()
  })

  return null
}
