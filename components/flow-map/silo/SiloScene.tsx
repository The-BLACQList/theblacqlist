'use client'

/**
 * The Silo scene (ticket 167). Loaded on its own chunk by SiloExperience,
 * only on /flow-map and only after the HTML is on screen.
 *
 * Everything the reader needs is also in the HUD and the list, so the canvas
 * is aria-hidden. The scene draws only while it's on screen and the tab is
 * visible; with motion off it draws on demand, once per change.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

import {
  FLOOR_SPACING,
  GOLD,
  GOLD_BRIGHT,
  SILO_FLOORS,
  SILO_RADIUS,
  colorForBusiness,
  floorY,
  pulseProgress,
  pulseSchedule,
  type ColorBy,
  type PlacedBusiness,
  type SiloBusiness,
} from '@/lib/spend/silo-layout'

const BG = new THREE.Color('#0a0907')
const INK = new THREE.Color('#fcfaf4')
const DOT_RADIUS = 0.11
const SHOPPERS = new THREE.Vector3(0, floorY(0), 0)
const DRAG_THRESHOLD_PX = 4

export interface SiloSceneProps {
  businesses: readonly SiloBusiness[]
  placed: ReadonlyMap<string, PlacedBusiness>
  colorBy: ColorBy
  /** Same order as `businesses`. False dims the dot and hides its link. */
  visible: readonly boolean[]
  selectedId: string | null
  hoveredId: string | null
  focusFloor: number | null
  /** Ambient motion: drift and pulses. Off for reduced motion or Pause. */
  motion: boolean
  /** On screen and the tab is visible. Off means draw nothing new. */
  active: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  onContextLost: () => void
  hoverTagRef: RefObject<HTMLDivElement | null>
  youTagRef: RefObject<HTMLDivElement | null>
}

export default function SiloScene(props: SiloSceneProps) {
  const { motion, active, onContextLost } = props
  return (
    <Canvas
      aria-hidden="true"
      frameloop={motion && active ? 'always' : 'demand'}
      dpr={[1, 2]}
      camera={{ position: [0, 3, 15], fov: 42, near: 0.1, far: 100 }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => {
        gl.setClearColor(BG, 0)
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          onContextLost()
        })
      }}
      onPointerMissed={() => props.onHover(null)}
    >
      <SceneContents {...props} />
    </Canvas>
  )
}

function SceneContents(props: SiloSceneProps) {
  const { businesses, placed, visible, motion, active } = props
  const invalidate = useThree((s) => s.invalidate)

  // Any prop change redraws once, even with the loop on demand.
  useEffect(() => {
    if (active) invalidate()
  })

  const shown = useMemo(
    () =>
      businesses
        .map((b, i) => ({ b, p: placed.get(b.id), on: visible[i] ?? true }))
        .filter((x): x is { b: SiloBusiness; p: PlacedBusiness; on: boolean } => !!x.p),
    [businesses, placed, visible]
  )

  return (
    <>
      <CameraRig {...props} />
      <Floors />
      <Shoppers />
      <Links shown={shown} />
      {motion && active && <Pulses shown={shown} />}
      <Dots shown={shown} {...props} />
      <Rings shown={shown} selectedId={props.selectedId} />
      <Tags shown={shown} {...props} />
    </>
  )
}

// ─── Camera ──────────────────────────────────────────────────────────────────

function CameraRig({ placed, selectedId, focusFloor, motion, active }: SiloSceneProps) {
  const { camera, gl, invalidate } = useThree()
  const yaw = useRef(0.6)
  const pitch = useRef(0.22)
  const target = useRef(new THREE.Vector3(0, floorY(2), 0))
  const dist = useRef(15)

  useEffect(() => {
    const el = gl.domElement
    let down: { x: number; y: number; yaw: number; pitch: number } | null = null
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, yaw: yaw.current, pitch: pitch.current }
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const dx = e.clientX - down.x
      const dy = e.clientY - down.y
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
      yaw.current = down.yaw - dx * 0.006
      pitch.current = THREE.MathUtils.clamp(down.pitch + dy * 0.004, -0.15, 0.9)
      invalidate()
    }
    const onUp = () => {
      down = null
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [gl, invalidate])

  const goal = useMemo(() => {
    const sel = selectedId ? placed.get(selectedId) : undefined
    if (sel) return { target: new THREE.Vector3(sel.x, sel.y, sel.z), dist: 7.5 }
    if (focusFloor !== null)
      return { target: new THREE.Vector3(0, floorY(focusFloor), 0), dist: 11 }
    return { target: new THREE.Vector3(0, floorY(2), 0), dist: 15 }
  }, [placed, selectedId, focusFloor])

  useFrame((_, delta) => {
    if (!active) return
    const dt = Math.min(delta, 0.05)
    if (motion) yaw.current += dt * 0.035
    const k = 1 - Math.exp(-dt * 5)
    target.current.lerp(goal.target, k)
    dist.current += (goal.dist - dist.current) * k
    const cp = Math.cos(pitch.current)
    camera.position.set(
      target.current.x + Math.sin(yaw.current) * cp * dist.current,
      target.current.y + Math.sin(pitch.current) * dist.current,
      target.current.z + Math.cos(yaw.current) * cp * dist.current
    )
    camera.lookAt(target.current)
    // Keep drawing on demand until the focus move settles.
    const settled =
      target.current.distanceTo(goal.target) < 0.005 && Math.abs(goal.dist - dist.current) < 0.005
    if (!settled && !motion) invalidate()
  })

  return null
}

// ─── Static structure ────────────────────────────────────────────────────────

function ringPoints(radius: number, y: number, segments = 96): THREE.Vector3[] {
  return Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2
    return new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius)
  })
}

function Floors() {
  const rings = useMemo(
    () =>
      SILO_FLOORS.map((_, i) => {
        const geo = new THREE.BufferGeometry().setFromPoints(ringPoints(SILO_RADIUS, floorY(i)))
        return { geo, tracked: i === 0 }
      }),
    []
  )
  const shaft = useMemo(
    () =>
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, floorY(0) + FLOOR_SPACING * 0.4, 0),
        new THREE.Vector3(0, floorY(SILO_FLOORS.length - 1) - FLOOR_SPACING * 0.4, 0),
      ]),
    []
  )
  useEffect(
    () => () => {
      rings.forEach((r) => r.geo.dispose())
      shaft.dispose()
    },
    [rings, shaft]
  )

  return (
    <group>
      {rings.map((r, i) => (
        <lineLoop key={i} geometry={r.geo}>
          <lineBasicMaterial
            color={r.tracked ? GOLD : '#fcfaf4'}
            transparent
            opacity={r.tracked ? 0.55 : 0.14}
          />
        </lineLoop>
      ))}
      <lineSegments geometry={shaft}>
        <lineBasicMaterial color="#fcfaf4" transparent opacity={0.1} />
      </lineSegments>
    </group>
  )
}

/** Shoppers are one group: a single gold glow, never a dot per person. */
function Shoppers() {
  return (
    <group position={SHOPPERS}>
      <mesh>
        <sphereGeometry args={[0.34, 24, 16]} />
        <meshBasicMaterial color={GOLD_BRIGHT} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.7, 24, 16]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.16} depthWrite={false} />
      </mesh>
    </group>
  )
}

interface Shown {
  b: SiloBusiness
  p: PlacedBusiness
  on: boolean
}

function Links({ shown }: { shown: readonly Shown[] }) {
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (const s of shown) {
      if (!s.on) continue
      pts.push(SHOPPERS, new THREE.Vector3(s.p.x, s.p.y, s.p.z))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [shown])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={GOLD} transparent opacity={0.16} depthWrite={false} />
    </lineSegments>
  )
}

const tmp = new THREE.Object3D()

/** One gold pulse per link every one to two minutes (silo-layout pulseSchedule). */
function Pulses({ shown }: { shown: readonly Shown[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const links = useMemo(() => shown.filter((s) => s.on), [shown])
  const slots = useMemo(() => pulseSchedule(links.map((s) => s.b.id)), [links])
  const ends = useMemo(() => links.map((s) => new THREE.Vector3(s.p.x, s.p.y, s.p.z)), [links])

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const now = Date.now()
    slots.forEach((slot, i) => {
      const t = pulseProgress(slot, now)
      if (t === null) {
        tmp.scale.setScalar(0)
        tmp.position.copy(SHOPPERS)
      } else {
        tmp.position.lerpVectors(SHOPPERS, ends[i]!, t)
        tmp.scale.setScalar(1 - t * 0.4)
      }
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  if (links.length === 0) return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, links.length]} frustumCulled={false}>
      <sphereGeometry args={[0.07, 10, 8]} />
      <meshBasicMaterial color={GOLD_BRIGHT} />
    </instancedMesh>
  )
}

// ─── Business dots ───────────────────────────────────────────────────────────

function Dots({
  shown,
  colorBy,
  onSelect,
  onHover,
}: { shown: readonly Shown[] } & Pick<SiloSceneProps, 'colorBy' | 'onSelect' | 'onHover'>) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const c = new THREE.Color()
    shown.forEach((s, i) => {
      tmp.position.set(s.p.x, s.p.y, s.p.z)
      tmp.scale.setScalar(s.b.isYou ? 1.35 : 1)
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
      c.set(colorForBusiness(s.b, colorBy))
      if (!s.on) c.lerp(BG, 0.78)
      mesh.setColorAt(i, c)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    invalidate()
  }, [shown, colorBy, invalidate])

  if (shown.length === 0) return null

  const idAt = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.instanceId === undefined ? null : (shown[e.instanceId]?.b.id ?? null)

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, shown.length]}
      onPointerMove={(e) => {
        e.stopPropagation()
        const id = idAt(e)
        setCursor(gl.domElement, id ? 'pointer' : '')
        onHover(id)
      }}
      onPointerOut={() => {
        setCursor(gl.domElement, '')
        onHover(null)
      }}
      onClick={(e) => {
        if (e.delta > DRAG_THRESHOLD_PX) return
        e.stopPropagation()
        const id = idAt(e)
        if (id) onSelect(id)
      }}
    >
      <sphereGeometry args={[DOT_RADIUS, 16, 12]} />
      <meshBasicMaterial />
    </instancedMesh>
  )
}

/** Gold ring for You, a white ring for the selected dot. Both lie on the floor. */
function Rings({ shown, selectedId }: { shown: readonly Shown[]; selectedId: string | null }) {
  const you = shown.filter((s) => s.b.isYou)
  const sel = selectedId ? shown.find((s) => s.b.id === selectedId) : undefined
  return (
    <>
      {you.map((s) => (
        <mesh key={s.b.id} position={[s.p.x, s.p.y, s.p.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.26, 0.028, 8, 40]} />
          <meshBasicMaterial color={GOLD_BRIGHT} />
        </mesh>
      ))}
      {sel && (
        <mesh position={[sel.p.x, sel.p.y, sel.p.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.36, 0.02, 8, 48]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      )}
    </>
  )
}

function setCursor(el: HTMLElement, cursor: string) {
  el.style.cursor = cursor
}

// ─── DOM tags that follow a dot ──────────────────────────────────────────────

const projected = new THREE.Vector3()

function Tags({
  shown,
  hoveredId,
  selectedId,
  hoverTagRef,
  youTagRef,
}: { shown: readonly Shown[] } & Pick<
  SiloSceneProps,
  'hoveredId' | 'selectedId' | 'hoverTagRef' | 'youTagRef'
>) {
  const { camera, size } = useThree()
  const tagged = hoveredId ?? selectedId
  const hover = tagged ? shown.find((s) => s.b.id === tagged) : undefined
  const you = shown.find((s) => s.b.isYou)

  function place(el: HTMLDivElement | null, p: PlacedBusiness | undefined, lift: number) {
    if (!el) return
    if (!p) {
      el.hidden = true
      return
    }
    projected.set(p.x, p.y, p.z).project(camera)
    if (projected.z > 1) {
      el.hidden = true
      return
    }
    el.hidden = false
    const x = ((projected.x + 1) / 2) * size.width
    const y = ((1 - projected.y) / 2) * size.height
    el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${(y - lift).toFixed(1)}px)`
  }

  useFrame(() => {
    place(hoverTagRef.current, hover && hover.b.id !== you?.b.id ? hover.p : undefined, 18)
    place(youTagRef.current, you?.p, 22)
  })

  return null
}
