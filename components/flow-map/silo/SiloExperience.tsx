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
  gapLabel,
  gapsPerFloor,
  placeBusinesses,
  siloGaps,
  type ColorBy,
  type SiloBusiness,
  type SiloGap,
} from '@/lib/spend/silo-layout'
import { FloorIcon } from './floor-icons'
import type { SiloNav, SiloSceneProps } from './SiloScene'
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

/** The phone stage, where the card is a bottom sheet. Matches silo.css. */
const PHONE_STAGE = '(max-width: 759px) and (min-height: 501px)'

/** A sideways phone, where the card is a right panel. Matches silo.css. */
const SIDEWAYS_STAGE = '(max-height: 500px)'

/** The sheet still counts as on the bottom edge this far above it, because a
    collapsed iOS toolbar opens a gap under the stage. */
const SHEET_EDGE_PX = 120

/** Name labels the scene can place at once (round 17 shows about ten). */
const LABEL_POOL = 12

/** How far one press of an arrow key moves, as a share of the silo. */
const KEY_TRAVEL = 0.05
/** How far one press of a left or right arrow turns the map, in radians. */
const KEY_TURN = 0.26

/**
 * Lifts the site's pills over the sheet with the same hooks /map uses
 * (globals.css), and gives the hint the sheet's height. 0 lets them drop back.
 * On a sideways phone sidePx is the card's width, and the pills move off the
 * floors and the card instead.
 */
function writeSheetLift(section: HTMLElement, sheetPx: number, liftPx: number, sidePx = 0) {
  section.style.setProperty('--silo-sheet-h', `${sheetPx}px`)
  if (liftPx > 0) {
    document.documentElement.style.setProperty('--map-sheet-h', `${liftPx}px`)
    section.setAttribute('data-map-sheet', '')
  } else {
    document.documentElement.style.removeProperty('--map-sheet-h')
    section.removeAttribute('data-map-sheet')
  }
  if (sidePx > 0) {
    document.documentElement.style.setProperty('--map-card-w', `${sidePx}px`)
    section.setAttribute('data-map-side', '')
  } else {
    document.documentElement.style.removeProperty('--map-card-w')
    section.removeAttribute('data-map-side')
  }
}

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

  const [colorBy, setColorBy] = useState<ColorBy>('category')
  const [filter, setFilter] = useState<Set<string>>(() => new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedGap, setSelectedGap] = useState<SiloGap | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusFloor, setFocusFloor] = useState<number | null>(null)
  // Where the camera is heading, from the scene. Picks and scrolls both land here.
  const [liveFloor, setLiveFloor] = useState(0)
  const [hintGone, setHintGone] = useState(false)
  const [paused, setPaused] = useState(false)
  const [inView, setInView] = useState(true)
  const [moreOpen, setMoreOpen] = useState(false)
  const [keysOpen, setKeysOpen] = useState(false)
  // Read once on the client. The toggle isn't in the first paint (the key map
  // and More start closed), so the server's `true` never shows.
  const [shortcutsOn, setShortcutsOn] = useState(readShortcutsOn)
  const [status, setStatus] = useState('')

  const sectionRef = useRef<HTMLElement>(null)
  const navRef = useRef<SiloNav>(null)
  const moreBtnRef = useRef<HTMLButtonElement>(null)
  const keysBtnRef = useRef<HTMLButtonElement>(null)
  const hoverTagRef = useRef<HTMLDivElement>(null)
  const youTagRef = useRef<HTMLDivElement>(null)
  const signsRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const gapLabelsRef = useRef<HTMLDivElement>(null)

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
  const gaps = useMemo(() => siloGaps(businesses), [businesses])
  const gapCounts = useMemo(() => gapsPerFloor(gaps), [gaps])
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
      setSelectedGap(null)
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

  const selectGap = useCallback((g: SiloGap | null) => {
    setSelectedGap(g)
    if (g) {
      setSelectedId(null)
      setFocusFloor(null)
      setStatus(`${gapLabel(g)}.`)
    }
  }, [])

  function clearCard() {
    setSelectedId(null)
    setSelectedGap(null)
    setFocusFloor(null)
    setStatus('Showing every floor.')
  }

  function pickFloor(i: number) {
    setSelectedId(null)
    setSelectedGap(null)
    const next = focusFloor === i ? null : i
    setFocusFloor(next)
    setStatus(
      next === null ? 'Showing every floor.' : `Showing the ${SILO_FLOORS[i]!.short} floor.`
    )
  }

  function changeLiveFloor(floor: number) {
    setLiveFloor(floor)
    if (floor > 0) setHintGone(true)
  }

  function leaveFloor() {
    setFocusFloor(null)
    setStatus('Showing every floor.')
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

  function toggleColor(next?: ColorBy) {
    const value =
      next ?? (colorBy === 'category' ? 'level' : colorBy === 'level' ? 'gold' : 'category')
    // Gold keeps the kind filter: its key still lists kinds of business.
    const sameKeys = (value === 'level') === (colorBy === 'level')
    setColorBy(value)
    if (!sameKeys) setFilter(new Set())
    setStatus(
      value === 'level'
        ? 'Dots colored by level.'
        : value === 'gold'
          ? 'Dots colored gold.'
          : 'Dots colored by kind of business.'
    )
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

  /** Up, down and floor keys. False leaves the key to the browser. */
  function moveKey(key: string): boolean {
    const nav = navRef.current
    if (!nav) return false
    const last = SILO_FLOORS.length - 1
    const goTo = (floor: number) => {
      if (floor < 0 || floor > last) return false
      if (floor !== focusFloor) pickFloor(floor)
      return true
    }
    if (key === 'ArrowUp') return nav.travel(-KEY_TRAVEL)
    if (key === 'ArrowDown') return nav.travel(KEY_TRAVEL)
    if (key === 'ArrowLeft') nav.turn(-KEY_TURN)
    else if (key === 'ArrowRight') nav.turn(KEY_TURN)
    else if (key === 'PageUp') return goTo(liveFloor - 1)
    else if (key === 'PageDown') return goTo(liveFloor + 1)
    else if (key === 'Home') return goTo(0)
    else if (key === 'End') return goTo(last)
    else return false
    return true
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (moreOpen || e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target as HTMLElement
    if (t.closest('input, textarea, select, [contenteditable="true"]')) return
    if (!t.closest('.ctx') && moveKey(e.key)) {
      e.preventDefault()
      return
    }
    if (e.key === 'Escape') {
      if (keysOpen) closeKeys()
      else if (selectedId) selectBusiness(null)
      else if (selectedGap) setSelectedGap(null)
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

  // The list collapses the track, which can leave the reader below the section.
  useEffect(() => {
    const section = sectionRef.current
    if (showList && section && section.getBoundingClientRect().top < 0) {
      section.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  }, [showList])

  useEffect(() => {
    const section = sectionRef.current
    const sheet = section?.querySelector<HTMLElement>('.ctx')
    if (!section || !sheet || showList) return
    const phone = window.matchMedia(PHONE_STAGE)
    const sideways = window.matchMedia(SIDEWAYS_STAGE)
    let last = ''
    const update = () => {
      const edge = window.innerHeight
      const top = sheet.getBoundingClientRect().top
      const onEdge = top < edge && section.getBoundingClientRect().bottom > edge - SHEET_EDGE_PX
      const lift = phone.matches && onEdge ? Math.round(edge - top) : 0
      const side = sideways.matches && onEdge ? sheet.offsetWidth : 0
      const key = `${sheet.offsetHeight}:${lift}:${side}`
      if (key === last) return
      last = key
      writeSheetLift(section, sheet.offsetHeight, lift, side)
    }
    update()
    const resize = new ResizeObserver(update)
    resize.observe(sheet)
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      resize.disconnect()
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      writeSheetLift(section, 0, 0)
    }
  }, [showList])

  const currentFloor = showScene ? liveFloor : (focusFloor ?? selected?.floorIndex ?? null)
  const showHint =
    showScene &&
    !hintGone &&
    !selected &&
    !selectedGap &&
    focusFloor === null &&
    !keysOpen &&
    !moreOpen

  return (
    <>
      <div className="silo-track" data-mode={showList ? 'list' : 'map'}>
        {!showList && (
          <a className="silo-skip" href="#silo-after">
            Skip past the map
          </a>
        )}
        <section
          ref={sectionRef}
          className={`silo${moreOpen ? ' more-open' : ''}`}
          aria-labelledby="silo-title"
          tabIndex={-1}
          onKeyDown={onKeyDown}
        >
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
                    gaps={gaps}
                    selectedGap={selectedGap}
                    onSelect={(id) => selectBusiness(businesses.find((b) => b.id === id) ?? null)}
                    onSelectGap={selectGap}
                    onPickFloor={pickFloor}
                    onFloorChange={changeLiveFloor}
                    onLeaveFloor={leaveFloor}
                    navRef={navRef}
                    onHover={setHoveredId}
                    onContextLost={() => setContextLost(true)}
                    hoverTagRef={hoverTagRef}
                    youTagRef={youTagRef}
                    signsRef={signsRef}
                    labelsRef={labelsRef}
                    gapLabelsRef={gapLabelsRef}
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
              {showScene && (
                <div className="silo-labels" aria-hidden="true">
                  <div ref={labelsRef}>
                    {Array.from({ length: LABEL_POOL }, (_, i) => (
                      <div key={i} className="silo-lbl">
                        <span className="dot" />
                        <span>
                          <b />
                          <small />
                        </span>
                      </div>
                    ))}
                  </div>
                  <div ref={gapLabelsRef}>
                    {gaps.map((g) => (
                      <div key={`${g.familyIndex}:${g.floorIndex}`} className="silo-lbl gap">
                        <span className="ic">
                          <FloorIcon floor={g.floorIndex} />
                        </span>
                        <span>
                          <b>No {SILO_FLOORS[g.floorIndex]!.short.toLowerCase()} yet</b>
                          <small>{CATEGORY_FAMILIES[g.familyIndex]?.name}</small>
                        </span>
                      </div>
                    ))}
                  </div>
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

          {showHint && <p className="silo-hint">Keep scrolling to see every floor</p>}

          <div className="hud-bg" aria-hidden="true" />

          <div className="hud">
            <div className="brand">
              <h2 id="silo-title">
                <GoldBrandMark className="brand-mark" />
                The Collective
              </h2>
              <p>
                Every business on the list, floor by floor. Lines show money spent once enough
                receipts are counted.
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
              gaps={gapCounts}
              currentFloor={currentFloor}
              youFloors={youFloors}
              onPick={pickFloor}
            />

            <SiloLegend
              colorBy={colorBy}
              active={filter}
              onToggle={toggleFilter}
              onColorBy={toggleColor}
              hasGaps={gaps.length > 0}
            />

            <SiloTicker items={ticker} />
          </div>

          <SiloCard
            selected={selected}
            selectedGap={selectedGap}
            focusFloor={focusFloor === null ? null : (floors[focusFloor] ?? null)}
            floorCount={focusFloor === null ? 0 : (counts[focusFloor] ?? 0)}
            you={you}
            totalSpentCents={totalSpentCents}
            onClear={clearCard}
            legend={
              <SiloLegend
                className="legend-in-card"
                colorBy={colorBy}
                active={filter}
                onToggle={toggleFilter}
                onColorBy={toggleColor}
                hasGaps={gaps.length > 0}
              />
            }
          />

          <div className="dock" role="toolbar" aria-label="Map controls">
            {you && (
              <button type="button" className="find" onClick={findMe}>
                Find me
              </button>
            )}
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
            <SiloKeyMap
              shortcutsOn={shortcutsOn}
              onShortcutsChange={changeShortcuts}
              hasYou={!!you}
            />
          )}

          <SiloMore open={moreOpen} onClose={() => setMoreOpen(false)} returnFocusRef={moreBtnRef}>
            <SiloLegend
              className="legend-in-more"
              colorBy={colorBy}
              active={filter}
              onToggle={toggleFilter}
              onColorBy={toggleColor}
              hasGaps={gaps.length > 0}
            />
            <div className="more-group">
              <h4>Motion</h4>
              <div className="more-row">
                <button
                  type="button"
                  className="more-option"
                  aria-pressed={reducedMotion || paused}
                  onClick={togglePause}
                >
                  {reducedMotion ? 'Motion is off' : paused ? 'Resume motion' : 'Pause motion'}
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
                {AGGREGATE_MIN_TRANSACTIONS} counted receipts, so no total can point back at one
                shopper. We only count the first stop: a shopper&apos;s receipt at a business on the
                list. The floors below say &quot;Not tracked yet&quot; until we can count them
                honestly. <Link href="/flow-map/methodology">Read the method</Link>
              </p>
            </div>
          </SiloMore>

          <p className="sr-only" role="status" aria-live="polite">
            {status}
          </p>
        </section>
      </div>
      <span id="silo-after" className="silo-after" tabIndex={-1} />
    </>
  )
}

function familyKey(b: SiloBusiness): string {
  return (CATEGORY_FAMILIES[b.familyIndex] ?? CATEGORY_FAMILIES[FALLBACK_FAMILY_INDEX]!).key
}
