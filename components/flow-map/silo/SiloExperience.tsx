'use client'

/**
 * The Collective (tickets 167 and 171): concept D, layout B from the round
 * 17 workshop. Every published business is on the map; lines only appear
 * once enough receipts are counted at a business.
 *
 * The HUD is plain HTML and renders first. The Three.js scene loads on its
 * own chunk after mount, and only when the device can draw it. If it can't
 * (no WebGL, low power, lost context, chunk failed), the list shows with the
 * same totals. Every rule about names, floors and motion lives in
 * lib/spend/silo-layout.ts.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import Link from 'next/link'

import { GoldBrandMark } from '@/components/ui/gold-brand-mark'
import { AGGREGATE_MIN_TRANSACTIONS } from '@/lib/spend/aggregate-privacy'

import {
  CATEGORY_FAMILIES,
  FALLBACK_FAMILY_INDEX,
  SILO_FLOORS,
  buildFloors,
  businessDisplayName,
  businessesPerFloor,
  formatDollars,
  placeBusinesses,
  type SiloBusiness,
} from '@/lib/spend/silo-layout'
import { FloorIcon } from './floor-icons'
import type { SiloSceneProps } from './SiloScene'
import { SceneBoundary, SiloList, type SiloCityRow } from './SiloList'
import { SiloMore } from './SiloMore'
import {
  ShortcutsToggle,
  SiloCard,
  SiloGauge,
  SiloKeyMap,
  SiloLegend,
  SiloTicker,
  type SiloTickerItem,
} from './SiloPanels'
import {
  readShortcutsOn,
  useDocumentVisible,
  usePrefersReducedMotion,
  useSiloSupport,
  writeShortcutsOn,
} from './use-silo-support'
import './silo.css'

type Scene = ComponentType<SiloSceneProps>
type ColorChoice = 'category' | 'level'

interface Props {
  totalSpentCents: number
  receiptCount: number
  businesses: readonly SiloBusiness[]
  cities: readonly SiloCityRow[]
  ticker: readonly SiloTickerItem[]
  /** `?you=1`: open focused on the reader's own business. */
  focusYou: boolean
}

export function SiloExperience({
  totalSpentCents,
  receiptCount,
  businesses,
  cities,
  ticker,
  focusYou,
}: Props) {
  const support = useSiloSupport()
  const reducedMotion = usePrefersReducedMotion()
  const docVisible = useDocumentVisible()

  const [Scene, setScene] = useState<Scene | null>(null)
  const [chunkFailed, setChunkFailed] = useState(false)
  const [contextLost, setContextLost] = useState(false)
  const [canvasKey, setCanvasKey] = useState(0)
  const [mapAnyway, setMapAnyway] = useState(false)
  const [listChosen, setListChosen] = useState(false)

  const [colorBy, setColorBy] = useState<ColorChoice>('category')
  const [filter, setFilter] = useState<Set<string>>(() => new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusFloor, setFocusFloor] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  const [inView, setInView] = useState(true)
  const [moreOpen, setMoreOpen] = useState(false)
  const [keysOpen, setKeysOpen] = useState(false)
  // Read once on the client. The toggle isn't in the first paint (the key map
  // and More start closed), so the server's `true` never shows.
  const [shortcutsOn, setShortcutsOn] = useState(readShortcutsOn)
  const [status, setStatus] = useState('')

  const sectionRef = useRef<HTMLElement>(null)
  const moreBtnRef = useRef<HTMLButtonElement>(null)
  const keysBtnRef = useRef<HTMLButtonElement>(null)
  const hoverTagRef = useRef<HTMLDivElement>(null)
  const youTagRef = useRef<HTMLDivElement>(null)
  const signsRef = useRef<HTMLDivElement>(null)

  // ── Derived data ──
  const floors = useMemo(() => buildFloors(totalSpentCents), [totalSpentCents])
  const counts = useMemo(() => businessesPerFloor(businesses), [businesses])
  const placed = useMemo(
    () => new Map(placeBusinesses(businesses).map((p) => [p.id, p])),
    [businesses]
  )
  const visible = useMemo(
    () =>
      businesses.map((b) => {
        if (filter.size === 0) return true
        if (colorBy === 'level') return filter.has(b.level)
        return filter.has(familyKey(b))
      }),
    [businesses, filter, colorBy]
  )
  const stepList = useMemo(() => businesses.filter((_, i) => visible[i]), [businesses, visible])
  const linkedCount = useMemo(() => businesses.filter((b) => b.linked).length, [businesses])
  const youList = useMemo(() => businesses.filter((b) => b.isYou), [businesses])
  const youFloors = useMemo(() => new Set(youList.map((b) => b.floorIndex)), [youList])
  const selected = businesses.find((b) => b.id === selectedId) ?? null
  const hovered = businesses.find((b) => b.id === hoveredId) ?? selected
  const you = youList[0] ?? null

  // ── Which view ──
  const canMap = support === 'ok' || (support === 'low-power' && mapAnyway)
  const wantMap = canMap && !listChosen && !contextLost && !chunkFailed
  const motion = !paused && !reducedMotion
  const active = inView && docVisible && !moreOpen

  useEffect(() => {
    if (!wantMap || Scene) return
    let cancelled = false
    import('./SiloScene')
      .then((m) => {
        if (!cancelled) setScene(() => m.default)
      })
      .catch(() => {
        if (!cancelled) setChunkFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [wantMap, Scene])

  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? true))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // ── Actions ──
  const selectBusiness = useCallback((b: SiloBusiness | null) => {
    setSelectedId(b?.id ?? null)
    if (b) {
      setFocusFloor(null)
      setStatus(`Showing ${businessDisplayName(b)}${b.isYou ? ', you shopped here' : ''}.`)
    }
  }, [])

  const findMe = useCallback(() => {
    if (youList.length === 0) return
    const i = youList.findIndex((b) => b.id === selectedId)
    selectBusiness(youList[(i + 1) % youList.length]!)
  }, [youList, selectedId, selectBusiness])

  const focusedYouOnce = useRef(false)
  useEffect(() => {
    if (!focusYou || focusedYouOnce.current || !you) return
    focusedYouOnce.current = true
    selectBusiness(you)
  }, [focusYou, you, selectBusiness])

  function step(dir: 1 | -1) {
    if (stepList.length === 0) return
    const i = stepList.findIndex((b) => b.id === selectedId)
    const next =
      i === -1
        ? dir === 1
          ? 0
          : stepList.length - 1
        : (i + dir + stepList.length) % stepList.length
    selectBusiness(stepList[next]!)
  }

  function pickFloor(i: number) {
    setSelectedId(null)
    const next = focusFloor === i ? null : i
    setFocusFloor(next)
    setStatus(
      next === null ? 'Showing every floor.' : `Showing the ${SILO_FLOORS[i]!.short} floor.`
    )
  }

  function togglePause() {
    if (reducedMotion) {
      setStatus('Motion stays off because your device asks for less motion.')
      return
    }
    setPaused((p) => {
      setStatus(p ? 'Motion on.' : 'Motion paused.')
      return !p
    })
  }

  function toggleColor(next?: ColorChoice) {
    const value = next ?? (colorBy === 'category' ? 'level' : 'category')
    setColorBy(value)
    setFilter(new Set())
    setStatus(value === 'level' ? 'Dots colored by level.' : 'Dots colored by kind of business.')
  }

  function toggleFilter(key: string) {
    setFilter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      setStatus(next.size === 0 ? 'Showing every business.' : `Showing ${next.size} of the groups.`)
      return next
    })
  }

  function toggleList() {
    setListChosen((v) => !v)
    setStatus(listChosen ? 'Showing the map.' : 'Showing the list.')
  }

  function retryMap() {
    setChunkFailed(false)
    setContextLost(false)
    setListChosen(false)
    setCanvasKey((k) => k + 1)
  }

  function changeShortcuts(on: boolean) {
    setShortcutsOn(on)
    writeShortcutsOn(on)
    setStatus(on ? 'Letter shortcuts on.' : 'Letter shortcuts off.')
  }

  function closeKeys() {
    setKeysOpen(false)
    keysBtnRef.current?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (moreOpen || e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target as HTMLElement
    if (t.closest('input, textarea, select, [contenteditable="true"]')) return
    if (e.key === 'Escape') {
      if (keysOpen) closeKeys()
      else if (selectedId) selectBusiness(null)
      else if (focusFloor !== null) pickFloor(focusFloor)
      return
    }
    if (!shortcutsOn) return
    const k = e.key.toLowerCase()
    if (k === 'y' && you) findMe()
    else if (k === 'c') toggleColor()
    else if (k === 't') toggleList()
    else if (k === 'p') togglePause()
    else if (e.key === '?') setKeysOpen((v) => !v)
    else return
    e.preventDefault()
  }

  // ── Stage content ──
  const showScene = wantMap && Scene !== null
  let listNote: string | null = null
  let listAction: ReactNode = null
  if (!showScene && support !== 'pending' && !(wantMap && !Scene)) {
    if (support === 'no-webgl') {
      listNote = "This device can't draw the map, so here is the same data as a list."
    } else if (support === 'low-power' && !mapAnyway) {
      listNote = 'We show the list first on this device to save battery.'
      listAction = (
        <button type="button" className="silo-retry" onClick={() => setMapAnyway(true)}>
          Show the map anyway
        </button>
      )
    } else if (contextLost || chunkFailed) {
      listNote = contextLost ? 'The map stopped drawing.' : "The map didn't load."
      listAction = (
        <button type="button" className="silo-retry" onClick={retryMap}>
          Try the map again
        </button>
      )
    } else if (listChosen) {
      listAction = (
        <button type="button" className="silo-retry" onClick={toggleList}>
          Back to the map
        </button>
      )
    }
  }
  const showList = !showScene && support !== 'pending' && !(wantMap && !Scene)

  const currentFloor = focusFloor ?? selected?.floorIndex ?? null
  const position = selected ? stepList.findIndex((b) => b.id === selected.id) + 1 : 0

  return (
    <section ref={sectionRef} className="silo" aria-labelledby="silo-title" onKeyDown={onKeyDown}>
      {showList ? (
        <SiloList businesses={businesses} cities={cities} note={listNote} action={listAction} />
      ) : (
        <div className="silo-stage">
          {showScene && Scene && (
            <SceneBoundary key={canvasKey} onError={() => setChunkFailed(true)}>
              <Scene
                businesses={businesses}
                placed={placed}
                colorBy={colorBy}
                visible={visible}
                selectedId={selectedId}
                hoveredId={hoveredId}
                focusFloor={focusFloor}
                motion={motion}
                reducedMotion={reducedMotion}
                active={active}
                onSelect={(id) => selectBusiness(businesses.find((b) => b.id === id) ?? null)}
                onPickFloor={pickFloor}
                onHover={setHoveredId}
                onContextLost={() => setContextLost(true)}
                hoverTagRef={hoverTagRef}
                youTagRef={youTagRef}
                signsRef={signsRef}
              />
            </SceneBoundary>
          )}
          {showScene && (
            <div ref={signsRef} className="silo-signs" aria-hidden="true">
              {SILO_FLOORS.map((f, i) => (
                <div key={f.key} className="silo-sign" hidden>
                  <span className="ic">
                    <FloorIcon floor={i} />
                  </span>
                  <b>{f.short}</b>
                </div>
              ))}
            </div>
          )}
          <div ref={hoverTagRef} className="silo-tag" hidden aria-hidden="true">
            {hovered ? businessDisplayName(hovered) : ''}
          </div>
          <div ref={youTagRef} className="silo-tag is-you" hidden aria-hidden="true">
            You
          </div>
        </div>
      )}

      <div className="hud-bg" aria-hidden="true" />

      <div className="hud">
        <div className="brand">
          <h2 id="silo-title">
            <GoldBrandMark className="brand-mark" />
            The Collective
          </h2>
          <p>
            Every business on the list, floor by floor. Lines show money spent once enough receipts
            are counted.
          </p>
        </div>

        <dl className="kpis">
          <div className="kpi">
            <dt>Spent</dt>
            <dd>{formatDollars(totalSpentCents)}</dd>
          </div>
          <div className="kpi">
            <dt>Receipts</dt>
            <dd>{receiptCount.toLocaleString('en-US')}</dd>
          </div>
          <div className="kpi">
            <dt>Links</dt>
            <dd>{linkedCount.toLocaleString('en-US')}</dd>
          </div>
        </dl>

        <SiloGauge
          floors={floors}
          counts={counts}
          currentFloor={currentFloor}
          youFloors={youFloors}
          onPick={pickFloor}
        />

        <SiloLegend colorBy={colorBy} active={filter} onToggle={toggleFilter} />

        <SiloTicker items={ticker} />
      </div>

      <SiloCard
        selected={selected}
        focusFloor={focusFloor === null ? null : (floors[focusFloor] ?? null)}
        floorCount={focusFloor === null ? 0 : (counts[focusFloor] ?? 0)}
        total={stepList.length}
        position={position}
        linkedCount={stepList.filter((b) => b.linked).length}
        filtered={filter.size > 0}
        totalSpentCents={totalSpentCents}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
      />

      <div className="dock" role="toolbar" aria-label="Map controls">
        {you && (
          <button type="button" className="find" onClick={findMe}>
            Find me
          </button>
        )}
        <button type="button" aria-pressed={reducedMotion || paused} onClick={togglePause}>
          {reducedMotion ? 'Motion is off' : paused ? 'Resume motion' : 'Pause motion'}
        </button>
        <button type="button" onClick={() => toggleColor()}>
          Color: {colorBy === 'level' ? 'Level' : 'Kind'}
        </button>
        <button
          ref={moreBtnRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          More
        </button>
        <button
          ref={keysBtnRef}
          type="button"
          className="keys"
          aria-expanded={keysOpen}
          aria-controls="silo-keymap"
          aria-label="Keyboard keys"
          onClick={() => setKeysOpen((v) => !v)}
        >
          ?
        </button>
      </div>

      {keysOpen && (
        <SiloKeyMap shortcutsOn={shortcutsOn} onShortcutsChange={changeShortcuts} hasYou={!!you} />
      )}

      <SiloMore open={moreOpen} onClose={() => setMoreOpen(false)} returnFocusRef={moreBtnRef}>
        <SiloLegend
          className="legend-in-more"
          colorBy={colorBy}
          active={filter}
          onToggle={toggleFilter}
        />
        <div className="more-group">
          <h4>Color by</h4>
          <div className="more-row">
            <button
              type="button"
              className="more-option"
              aria-pressed={colorBy === 'category'}
              onClick={() => toggleColor('category')}
            >
              Kind of business
            </button>
            <button
              type="button"
              className="more-option"
              aria-pressed={colorBy === 'level'}
              onClick={() => toggleColor('level')}
            >
              Level
            </button>
          </div>
        </div>
        <div className="more-group">
          <h4>View</h4>
          <div className="more-row">
            <button
              type="button"
              className="more-option"
              aria-pressed={showList}
              onClick={toggleList}
            >
              Explore as a list
            </button>
          </div>
        </div>
        <div className="more-group">
          <h4>Keys</h4>
          <ShortcutsToggle on={shortcutsOn} onChange={changeShortcuts} />
        </div>
        <div className="more-group">
          <h4>How we count</h4>
          <p>
            Every published business is on the map. A line appears once a business has at least{' '}
            {AGGREGATE_MIN_TRANSACTIONS} counted receipts, so no total can point back at one shopper. We only count the
            first stop: a shopper&apos;s receipt at a business on the list. The floors below say
            &quot;Not tracked yet&quot; until we can count them honestly.{' '}
            <Link href="/flow-map/methodology">Read the method</Link>
          </p>
        </div>
      </SiloMore>

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  )
}

function familyKey(b: SiloBusiness): string {
  return (CATEGORY_FAMILIES[b.familyIndex] ?? CATEGORY_FAMILIES[FALLBACK_FAMILY_INDEX]!).key
}
