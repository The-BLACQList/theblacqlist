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
  LEVEL_COLORS,
  SILO,
  SILO_FLOORS,
  clusterRadius,
  colorForBusiness,
  crowdAnchor,
  linkControlPoints,
  pulseProgress,
  pulseSchedule,
  scrollForFloor,
  viewForScroll,
  wedgeAngle,
  wedgePoint,
  type ColorBy,
  type PlacedBusiness,
  type Point3,
  type SiloBusiness,
} from '@/lib/spend/silo-layout'
import { FLOOR_ICON_PATHS } from './floor-icons'

const BG_HEX = '#0a0907'
const BG = new THREE.Color(BG_HEX)
const FOG_DENSITY = 0.0092
const DRAG_THRESHOLD_PX = 5
const LINK_SEGMENTS = 20
const ATLAS_CELLS = 8
const CELL = 128

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
  kind: 'business' | 'floor'
  pos: THREE.Vector3
  look: THREE.Vector3
  yaw0: number
  pitch0: number
}

const UP = new THREE.Vector3(0, 1, 0)
const rightTmp = new THREE.Vector3()

/** Turns a view direction by yaw and pitch, never quite straight up or down. */
function rotateDir(d: THREE.Vector3, yaw: number, pitch: number): THREE.Vector3 {
  d.applyAxisAngle(UP, yaw)
  if (pitch) {
    const right = rightTmp.copy(d).cross(UP).normalize()
    if (right.lengthSq() > 0.0001) d.applyAxisAngle(right, pitch)
  }
  const len = d.length()
  d.normalize()
  if (Math.abs(d.y) > 0.97) {
    d.y = Math.sign(d.y) * 0.97
    const hz = Math.sqrt(1 - 0.97 * 0.97)
    const hl = Math.hypot(d.x, d.z) || 1
    d.x = (d.x / hl) * hz
    d.z = (d.z / hl) * hz
  }
  return d.multiplyScalar(len)
}

const v3 = (p: Point3) => new THREE.Vector3(p.x, p.y, p.z)
const projected = new THREE.Vector3()
const worldTmp = new THREE.Vector3()

type Pick = { kind: 'business'; id: string } | { kind: 'halo'; halo: Halo } | null

function Controls(props: Inner & { shown: readonly Shown[]; halos: readonly Halo[] }) {
  const { camera, gl, invalidate } = useThree()
  const rig = useRef({
    t: 0,
    yaw: 0,
    pitch: 0,
    focus: null as Focus | null,
    look: v3(viewForScroll(0).look),
  })
  const pendingFloor = useRef<number | null>(null)
  const live = useRef(props)
  useEffect(() => {
    live.current = props
  })

  // First frame: start at the top of the silo, looking down.
  useEffect(() => {
    const v = viewForScroll(0)
    camera.position.set(v.pos.x, v.pos.y, v.pos.z)
    camera.lookAt(rig.current.look)
  }, [camera])

  // A floor from the gauge: frame it level, no turn.
  const { focusFloor, selectedId, placed } = props
  useEffect(() => {
    if (focusFloor === null) return
    const fromRing = pendingFloor.current === focusFloor
    pendingFloor.current = null
    if (fromRing) return
    const r = rig.current
    r.t = scrollForFloor(focusFloor)
    r.yaw = 0
    r.pitch = 0
    r.focus = null
    invalidate()
  }, [focusFloor, invalidate])

  // A business: move in close and look at it.
  useEffect(() => {
    const r = rig.current
    const p = selectedId ? placed.get(selectedId) : undefined
    if (!p) {
      if (r.focus?.kind === 'business') r.focus = null
      invalidate()
      return
    }
    const floor = live.current.businesses.find((b) => b.id === selectedId)?.floorIndex
    if (floor !== undefined) r.t = scrollForFloor(floor)
    r.focus = {
      kind: 'business',
      pos: new THREE.Vector3(p.x * 0.55, p.y + 4, p.z * 0.55),
      look: v3(p),
      yaw0: r.yaw,
      pitch0: r.pitch,
    }
    invalidate()
  }, [selectedId, placed, invalidate])

  useEffect(() => {
    const el = gl.domElement
    let down: {
      id: number
      x: number
      y: number
      lastX: number
      lastY: number
      mouse: boolean
      drag: boolean
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
      const r = rig.current
      const c = h.center
      r.t = scrollForFloor(h.floor)
      r.focus = {
        kind: 'floor',
        pos: new THREE.Vector3(c.x * 0.25, c.y + 6, c.z * 0.25),
        look: v3(c),
        yaw0: r.yaw,
        pitch0: r.pitch,
      }
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
        mouse: e.pointerType !== 'touch',
        drag: false,
      }
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
          r.yaw -= (e.clientX - down.lastX) * 0.0042
          // On touch, up and down scroll the page, so only a mouse tilts.
          if (down.mouse) r.pitch = THREE.MathUtils.clamp(r.pitch - (e.clientY - down.lastY) * 0.0032, -1.1, 1.1)
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
      down = null
      el.releasePointerCapture?.(e.pointerId)
      el.style.cursor = ''
      if (wasDrag) return
      const hit = pickAt(e.clientX, e.clientY)
      if (hit?.kind === 'business') live.current.onSelect(hit.id)
      else if (hit?.kind === 'halo') focusRing(hit.halo)
      else live.current.onSelect(null)
    }

    const onCancel = () => {
      down = null
      el.style.cursor = ''
    }

    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && !down) {
        el.style.cursor = ''
        setHover(null)
      }
    }

    // The wheel travels down the silo. At either end it hands the scroll
    // back to the page, so the section never traps the reader.
    const onWheel = (e: WheelEvent) => {
      const r = rig.current
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      if (!r.focus && ((r.t <= 0 && dy < 0) || (r.t >= 1 && dy > 0))) return
      e.preventDefault()
      r.focus = null
      r.t = THREE.MathUtils.clamp(r.t + dy * 0.0007, 0, 1)
      invalidate()
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl, camera, invalidate])

  const goalPos = useMemo(() => new THREE.Vector3(), [])
  const goalLook = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    const l = live.current
    if (!l.active) return
    const r = rig.current
    if (r.focus) {
      goalPos.copy(r.focus.pos)
      dir.copy(r.focus.look).sub(r.focus.pos)
      rotateDir(dir, r.yaw - r.focus.yaw0, r.pitch - r.focus.pitch0)
    } else {
      const v = viewForScroll(r.t)
      goalPos.set(v.pos.x, v.pos.y, v.pos.z)
      dir.set(v.look.x - v.pos.x, v.look.y - v.pos.y, v.look.z - v.pos.z)
      rotateDir(dir, r.yaw, r.pitch)
    }
    goalLook.copy(goalPos).add(dir)

    if (l.reducedMotion) {
      camera.position.copy(goalPos)
      r.look.copy(goalLook)
    } else {
      const dt = Math.min(delta, 0.05)
      camera.position.lerp(goalPos, 1 - Math.exp(-dt * 2.6))
      r.look.lerp(goalLook, 1 - Math.exp(-dt * 4))
    }
    camera.lookAt(r.look)

    // With the loop on demand, keep drawing until the move settles.
    const settled = camera.position.distanceTo(goalPos) < 0.01 && r.look.distanceTo(goalLook) < 0.01
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

// ─── DOM tags and floor signs ────────────────────────────────────────────────

const SIGN_AT: readonly Point3[] = SILO.y.map((y) => ({ x: 0, y: y + 2.6, z: -9 }))

function Tags({
  shown,
  hoveredId,
  selectedId,
  hoverTagRef,
  youTagRef,
  signsRef,
}: Inner & { shown: readonly Shown[] }) {
  const { camera, size } = useThree()
  const tagged = hoveredId ?? selectedId
  const hover = tagged ? shown.find((s) => s.b.id === tagged) : undefined
  const you = shown.find((s) => s.b.isYou)

  useFrame(() => {
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
    place(hoverTagRef.current, hover && !hover.b.isYou ? hover.p : undefined, 18, 'translate(-50%, -100%)')
    place(youTagRef.current, you?.p, 22, 'translate(-50%, -100%)')
    const signs = signsRef?.current?.children
    if (signs) SIGN_AT.forEach((p, k) => place(signs[k], p, 0, 'translate(-50%, -50%)'))
  })

  return null
}
