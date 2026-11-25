'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'

import { prefersReducedMotion } from '@/components/tour/spotlight'
import { markSiteTourSeenAction } from '@/lib/actions/site-tour/seen'
import { track } from '@/lib/analytics/client'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import {
  collectiveBody,
  SITE_TOUR_BUTTONS,
  SITE_TOUR_CHAPTERS,
  SITE_TOUR_COPY,
  SITE_TOUR_END,
  SITE_TOUR_ESC_HINT,
  SITE_TOUR_EXAMPLE_ASK,
  SITE_TOUR_OPENING,
  SITE_TOUR_QUIT_NOTE,
  SITE_TOUR_WAIT,
} from '@/lib/site-tour/copy'
import {
  captionMode,
  clip,
  inflate,
  lightPath,
  mapLight,
  mapRoom,
  scrollFor,
  union,
  type Box,
  type CaptionMode,
} from '@/lib/site-tour/layout'
import { glideTo, MOTION } from '@/lib/site-tour/motion'
import { isSiteTourHiddenPath } from '@/lib/site-tour/routes'
import {
  CUE_ANSWERED,
  CUE_ASKED,
  CUE_FALLBACK,
  CUE_STOPPED,
  sendCueCommand,
} from '@/lib/site-tour/signals'
import { readMemory, writeMemory, writeRun, type SiteTourStart } from '@/lib/site-tour/state'
import {
  buildItems,
  CUE_ANSWER,
  CUE_FORM,
  CUE_INPUT,
  indexAfterAnswer,
  indexOfKey,
  itemKey,
  nextIndex,
  pathOf,
  previousIndex,
  SILO,
  type SiteTourContext,
  type SiteTourItem,
  type SiteTourPath,
  type SiteTourTarget,
} from '@/lib/site-tour/steps'
import {
  findAll,
  focusQuietly,
  headerBottom,
  holdPage,
  onPage,
  returnFocus,
  TOUR_ROOT_ID,
} from './dom'
import {
  SiteTourCard,
  SiteTourClose,
  SiteTourPrompt,
  SiteTourScrim,
  SiteTourTitleCard,
  SiteTourWelcome,
  type CardAction,
  type CardButton,
} from './parts'
import type { SiteTourOpen } from './SiteTourLauncher'
import { cn } from '@/lib/utils'

type View = 'prompt' | 'opening' | 'welcome' | 'item' | 'leaving' | 'note'
/** Step 1 while Cue works: not asked, answering, or stopped by the visitor. */
type Wait = 'idle' | 'asking' | 'stopped'

interface Props {
  open: SiteTourOpen
  signedIn: boolean
  context: SiteTourContext
  onClose: () => void
}

const INTRO_CLASSES = ['intro-wait', 'intro-play', 'intro-skip']
const BAR_PARTS = ['[data-site-tour="cue-field"]', '[data-site-tour="cue-button"]']
const MAP_BAR = '[data-map-phonebar] > :not([data-map-locate])'
/** A link was followed; show the note even if the page turns out to be this one. */
const NOTE_AFTER_MS = 1500

function targetOf(items: readonly SiteTourItem[], index: number): SiteTourTarget | null {
  const item = items[index]
  if (!item) return null
  if (item.kind === 'step') return item.step
  if (item.kind === 'end') return item.target
  return targetOf(items, index + 1)
}

const windowSize = () => ({ width: window.innerWidth, height: window.innerHeight })

const inRoot = (el: Element | null) => el?.closest(`#${TOUR_ROOT_ID}`) !== null && el !== null

export default function SiteTour({ open, signedIn, context, onClose }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const [view, setView] = useState<View>(
    open.kind === 'prompt' ? 'prompt' : open.kind === 'resume' ? 'item' : 'opening'
  )
  const [path, setPath] = useState<SiteTourPath>(open.kind === 'resume' ? open.run.path : 'shopper')
  const [index, setIndex] = useState(() => {
    if (open.kind !== 'resume') return 0
    const run = buildItems(open.run.path, context)
    // A reload loses Cue's answer, so it resumes at the bar.
    return indexOfKey(run, open.run.key === 'answer' ? 'cue' : open.run.key)
  })
  const [wait, setWaitState] = useState<Wait>('idle')
  const [ready, setReady] = useState(false)
  const [lit, setLit] = useState(false)
  const [covered, setCovered] = useState(false)
  const [live, setLive] = useState(false)
  /** Too little map above the card: no light, and the map isn't offered. */
  const [cramped, setCramped] = useState(false)
  const [barInUse, setBarInUse] = useState(false)
  const [mode, setMode] = useState<CaptionMode>('bar')
  const [hint, setHint] = useState('')
  // Opened on its own: a browser that has seen no click rings the focused
  // title. Held back until the visitor uses the keyboard.
  const [quietFocus, setQuietFocus] = useState(
    open.kind === 'welcome' && (open.start === 'home' || open.start === 'for_business')
  )
  const notePath = useRef<string | null>(null)
  /** A link was followed and its page hasn't come up yet. */
  const followed = useRef(false)

  const items = useMemo(() => buildItems(path, context), [path, context])
  const item = items[index]
  const key = itemKey(item)
  const isCue = key === 'cue' || key === 'answer'
  const target = useMemo(() => targetOf(items, index), [items, index])

  const start = useRef<SiteTourStart>(
    open.kind === 'welcome' ? open.start : open.kind === 'resume' ? open.run.start : 'prompt'
  )
  const opener = useRef<Element | null>(null)
  const waitRef = useRef<Wait>('idle')
  /** Cue landed on its own: change the words, move nothing. */
  const quiet = useRef(false)
  const arrived = useRef(false)
  const over = useRef(false)
  const release = useRef<() => void>(() => {})
  const root = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const scrim = useRef<SVGPathElement>(null)
  const ring = useRef<SVGPathElement>(null)
  const clear = useRef<SVGRectElement>(null)

  const setWait = useCallback((next: Wait) => {
    waitRef.current = next
    setWaitState(next)
  }, [])

  const send = useCallback(
    (event: string, extra: Record<string, string> = {}) =>
      track({ event_name: event, properties: { start: start.current, ...extra } }),
    []
  )

  // ── Opening ───────────────────────────────────────────────────────────────

  const markSeen = useCallback(() => {
    const now = new Date().toISOString()
    if (!readMemory()?.seenAt) writeMemory({ seenAt: now })
    if (signedIn) void markSiteTourSeenAction(readMemory()?.seenAt ?? now)
  }, [signedIn])

  const opened = useRef(false)
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    opener.current = document.activeElement === document.body ? null : document.activeElement
    if (open.kind === 'resume') return
    markSeen()
    if (open.kind === 'welcome') {
      const again = open.start === 'menu' || open.start === 'footer'
      send(again ? ANALYTICS_EVENTS.SITE_TOUR_RESTARTED : ANALYTICS_EVENTS.SITE_TOUR_SHOWN)
    }
  }, [open, markSeen, send])

  useEffect(() => {
    if (view !== 'opening') return
    const timer = window.setTimeout(() => setView('welcome'), MOTION.opening)
    return () => window.clearTimeout(timer)
  }, [view])

  // ── Moving ────────────────────────────────────────────────────────────────

  const goTo = useCallback(
    (next: number, options: { quiet?: boolean; path?: SiteTourPath } = {}) => {
      const onPath = options.path ?? path
      quiet.current = options.quiet ?? false
      arrived.current = quiet.current
      if (!quiet.current) {
        setReady(false)
        setLit(false)
      }
      setHint('')
      setPath(onPath)
      setIndex(next)
      setView('item')
      writeRun({ path: onPath, key: itemKey(buildItems(onPath, context)[next]), start: start.current })
    },
    [path, context]
  )

  const goQuestion = useCallback(() => {
    writeRun(null)
    setWait('idle')
    setCovered(false)
    setReady(false)
    setLit(false)
    setView('welcome')
  }, [setWait])

  /** The tour is over. `note`: say how to take it again, now or on the next page. */
  const finish = useCallback(
    (note: 'now' | 'next' | 'none', focus = true) => {
      if (over.current) return
      over.current = true
      const done = item?.kind === 'end' && view === 'item'
      if (!done) {
        send(ANALYTICS_EVENTS.SITE_TOUR_ENDED, {
          step: view === 'item' ? key : 'welcome',
          ...(view === 'item' ? { path } : {}),
        })
      }
      if (waitRef.current === 'asking') {
        waitRef.current = 'idle'
        if (note !== 'next') sendCueCommand({ type: 'stop' })
      }
      writeRun(null)
      writeMemory({ endedAt: new Date().toISOString() })
      release.current()
      if (focus) returnFocus(opener.current)
      if (note === 'none' || done) {
        onClose()
        return
      }
      notePath.current = window.location.pathname
      followed.current = note === 'next'
      setView(note === 'now' ? 'note' : 'leaving')
    },
    [item, view, key, path, send, onClose]
  )

  // A followed link: the note waits for the next page.
  useEffect(() => {
    if (view !== 'leaving') return
    const arrived = pathname !== notePath.current
    const timer = window.setTimeout(
      () => {
        if (arrived) followed.current = false
        notePath.current = pathname
        setView('note')
      },
      arrived ? 0 : NOTE_AFTER_MS
    )
    return () => window.clearTimeout(timer)
  }, [view, pathname])

  // The note and the prompt go with the page they were on, except that a note shown while
  // a slow page was still loading carries over to it once.
  const promptPath = useRef(pathname)
  useEffect(() => {
    if (view === 'note' && pathname !== notePath.current) {
      if (followed.current) {
        followed.current = false
        notePath.current = pathname
      } else onClose()
    }
    if (view === 'prompt' && pathname !== promptPath.current) {
      writeMemory({ endedAt: new Date().toISOString() })
      onClose()
    }
  }, [view, pathname, onClose])

  useEffect(() => {
    if (!quietFocus) return
    const onKey = () => setQuietFocus(false)
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [quietFocus])

  // Have the next page ready, so a crossing stays short.
  useEffect(() => {
    if (view !== 'item') return
    const next = targetOf(items, nextIndex(items, index, windowSize()))
    if (next && !onPage(next.href)) router.prefetch(next.href)
  }, [view, items, index, router])

  // Go to the item's page, find its target, bring it into view, light it.
  useEffect(() => {
    if (view !== 'item' || !item || !target || over.current) return
    if (quiet.current) {
      quiet.current = false
      return
    }
    const reduce = prefersReducedMotion()
    const began = performance.now()
    const crossing = !onPage(target.href)
    const chapter = item.kind === 'chapter'
    let cancelled = false
    let stopGlide = () => {}
    let frame = 0
    const timers: number[] = []
    if (crossing) router.push(target.href)

    const reveal = () => {
      if (cancelled) return
      setCovered(false)
      setReady(true)
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (cancelled) return
          focusQuietly(title.current)
        })
      })
    }
    const light = () => {
      if (cancelled) return
      arrived.current = true
      reveal()
      if (target.fixed) {
        window.scrollTo(0, 0)
        if (target.caption === 'collective') {
          const silo = document.querySelector(SILO)
          if (silo) window.scrollTo(0, silo.getBoundingClientRect().top + window.scrollY - headerBottom())
        }
        setLit(true)
        return
      }
      // After the card is up, so the scroll clears it.
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return
          const box = union(findAll(target.selectors).map(boxOf))
          const top = card.current?.getBoundingClientRect().top ?? window.innerHeight
          if (!box) {
            setLit(true)
            return
          }
          const to = scrollFor({
            target: inflate(box, target.pad),
            scrollY: window.scrollY,
            headerBottom: headerBottom(),
            captionTop: top,
            top: target.top,
          })
          stopGlide = glideTo(to, reduce || crossing, () => !cancelled && setLit(true))
        }, 60)
      )
    }

    const poll = () => {
      if (cancelled) return
      const elapsed = performance.now() - began
      const here = onPage(target.href)
      const found = here && findAll(target.selectors).length > 0
      const silo = target.caption === 'collective' ? document.querySelector(SILO) : null
      const intro = silo ? INTRO_CLASSES.some((name) => silo.classList.contains(name)) : false
      const late = elapsed > MOTION.collectiveCap
      if (chapter) {
        if (here) arrived.current = true
        if (elapsed >= MOTION.chapter && (found || late)) {
          goTo(nextIndex(items, index, windowSize()))
          return
        }
      } else if ((found && !intro) || late) {
        if (silo && !late) timers.push(window.setTimeout(light, reduce ? 0 : MOTION.collectiveSettle))
        else light()
        return
      } else if (elapsed > MOTION.cross || found) {
        // Never dark for longer than a move: the page shows while it settles.
        if (here) setCovered(false)
        if (!silo) reveal()
      }
      timers.push(window.setTimeout(poll, 80))
    }
    timers.push(
      window.setTimeout(() => {
        if (cancelled) return
        if (chapter) reveal()
        else if (crossing) {
          setCovered(true)
          focusQuietly(root.current)
        }
        poll()
      }, 0)
    )
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      timers.forEach((timer) => window.clearTimeout(timer))
      stopGlide()
    }
  }, [view, item, items, target, index, router, goTo])

  // Leaving the step's page ends the tour.
  useEffect(() => {
    if (view !== 'item' || !target || over.current) return
    const away = arrived.current && pathname !== pathOf(target.href)
    const hidden = isSiteTourHiddenPath(pathname)
    if (!away && !hidden) return
    const timer = window.setTimeout(() => finish(hidden ? 'none' : 'now', false), 0)
    return () => window.clearTimeout(timer)
  }, [view, pathname, target, finish])

  // A step is counted once, when its card shows.
  const counted = useRef('')
  useEffect(() => {
    if (view !== 'item' || !ready || !item) return
    const id = `${path}:${index}`
    if (counted.current === id) return
    counted.current = id
    if (item.kind === 'step') send(ANALYTICS_EVENTS.SITE_TOUR_STEP_VIEWED, { path, step: key })
    if (item.kind === 'end') {
      send(ANALYTICS_EVENTS.SITE_TOUR_COMPLETED, { path })
      const now = new Date().toISOString()
      writeMemory({ completedAt: now, endedAt: now })
      writeRun(null)
    }
  }, [view, ready, item, path, index, key, send])

  useEffect(() => {
    if (view === 'opening' || view === 'welcome') focusQuietly(title.current)
  }, [view])

  // ── Cue ───────────────────────────────────────────────────────────────────

  const cueIndex = useMemo(
    () => items.findIndex((one) => one.kind === 'step' && one.step.key === 'cue'),
    [items]
  )
  useEffect(() => {
    if (view !== 'item' || !isCue || !ready) return
    const focusInBar = () => document.activeElement?.closest(CUE_FORM) != null
    let moved = false
    const onScroll = () => {
      moved = true
    }
    const onAsked = () => {
      setHint('')
      setWait('asking')
      const fromCard = inRoot(document.activeElement)
      moved = false
      window.addEventListener('wheel', onScroll, { passive: true, once: true })
      window.addEventListener('touchmove', onScroll, { passive: true, once: true })
      if (key === 'answer') goTo(cueIndex, { quiet: true })
      if (fromCard) requestAnimationFrame(() => focusQuietly(title.current))
    }
    const onAnswered = (event: Event) => {
      if (waitRef.current !== 'asking') return
      const stopped = (event as CustomEvent<{ stopped?: boolean }>).detail?.stopped
      if (stopped) {
        setWait('stopped')
        return
      }
      setWait('idle')
      const next = items[cueIndex + 1]
      if (next?.kind === 'step' && next.step.key === 'answer') goTo(cueIndex + 1, { quiet: true })
      if (moved || !inRoot(document.activeElement)) return
      window.setTimeout(() => {
        const box = union(findAll([CUE_ANSWER]).map(boxOf))
        if (!box || over.current) return
        const top = card.current?.getBoundingClientRect().top ?? window.innerHeight
        const to = scrollFor({
          target: box,
          scrollY: window.scrollY,
          headerBottom: headerBottom(),
          captionTop: top,
        })
        glideTo(to, prefersReducedMotion(), () => {})
      }, 60)
    }
    const onStopped = () => {
      if (waitRef.current === 'asking') setWait('stopped')
    }
    const skip = () => {
      if (focusInBar()) setWait('stopped')
      else {
        setWait('idle')
        goTo(indexAfterAnswer(items, cueIndex, windowSize()))
      }
    }
    const onFallback = (event: Event) => {
      if (waitRef.current !== 'asking') return
      event.preventDefault()
      skip()
    }
    window.addEventListener(CUE_ASKED, onAsked)
    window.addEventListener(CUE_ANSWERED, onAnswered)
    window.addEventListener(CUE_STOPPED, onStopped)
    window.addEventListener(CUE_FALLBACK, onFallback)
    return () => {
      window.removeEventListener('wheel', onScroll)
      window.removeEventListener('touchmove', onScroll)
      window.removeEventListener(CUE_ASKED, onAsked)
      window.removeEventListener(CUE_ANSWERED, onAnswered)
      window.removeEventListener(CUE_STOPPED, onStopped)
      window.removeEventListener(CUE_FALLBACK, onFallback)
    }
  }, [view, isCue, ready, key, items, cueIndex, goTo, setWait])

  // Cue has 12 seconds, then the tour moves on quietly.
  useEffect(() => {
    if (view !== 'item' || wait !== 'asking') return
    const timer = window.setTimeout(() => {
      const inBar = document.activeElement?.closest(CUE_FORM) != null
      setWait(inBar ? 'stopped' : 'idle')
      sendCueCommand({ type: 'stop' })
      if (!inBar) goTo(indexAfterAnswer(items, cueIndex, windowSize()))
    }, MOTION.wait)
    return () => window.clearTimeout(timer)
  }, [view, wait, items, cueIndex, goTo, setWait])

  // Opening a business, or Keep Chatting, ends the tour and goes there (DR-020).
  // Capture, so the page is released before the link's own work runs.
  useEffect(() => {
    if (view !== 'item' || !isCue) return
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const el = event.target instanceof Element ? event.target : null
      if (!el?.closest(CUE_ANSWER)) return
      const link = el.closest<HTMLAnchorElement>('a[href]')
      const chat = el.closest('[data-site-tour="keep-chatting"]')
      if ((link && link.target !== '_blank') || chat) finish('next', false)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [view, isCue, finish])

  // ── The page under the tour ───────────────────────────────────────────────

  const running = view === 'opening' || view === 'welcome' || view === 'item'
  const full = view === 'opening' || view === 'welcome' || (view === 'item' && item?.kind === 'chapter')
  const step = item?.kind === 'step' ? item.step : null
  const modal = !step?.live || !ready || (cramped && key === 'map')

  useEffect(() => {
    if (!running) return
    let undo = () => {}
    let timer = 0
    const apply = () => {
      undo()
      const keep = modal ? [] : (step?.live ?? []).flatMap((s) => [...document.querySelectorAll(s)])
      const off = modal ? [] : (step?.off ?? []).flatMap((s) => [...document.querySelectorAll(s)])
      undo = holdPage(keep, off)
    }
    apply()
    const watch = new MutationObserver(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(apply, 120)
    })
    watch.observe(document.body, { childList: true, subtree: true })
    document.body.setAttribute('data-site-tour-on', '')
    const stop = () => {
      watch.disconnect()
      window.clearTimeout(timer)
      undo()
      undo = () => {}
      document.body.removeAttribute('data-site-tour-on')
      document.documentElement.style.removeProperty('--blq-tour-pad')
    }
    release.current = stop
    return stop
  }, [running, modal, step])

  useEffect(() => {
    if (!full) return
    document.documentElement.setAttribute('data-site-tour-lock', '')
    return () => document.documentElement.removeAttribute('data-site-tour-lock')
  }, [full])

  // Esc: the bar gets the first one while Cue answers.
  useEffect(() => {
    if (!running && view !== 'note') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return
      if (event.defaultPrevented) {
        if (view === 'item' && document.activeElement?.matches(CUE_INPUT)) {
          window.setTimeout(() => setHint(SITE_TOUR_ESC_HINT), 400)
        }
        return
      }
      if (view === 'note') onClose()
      else finish('now')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, view, finish, onClose])

  // ── Where the light and the caption go ────────────────────────────────────

  const isAnswerBox = isCue && (key === 'answer' || wait !== 'idle')
  const isCollective = target?.caption === 'collective'
  const isMap = key === 'map'
  const roomyRef = useRef(false)
  const turnedRef = useRef(false)
  useEffect(() => {
    roomyRef.current = false
  }, [key])
  useLayoutEffect(() => {
    if (view !== 'item' || !ready || !target || full) return
    let frame = 0
    let last = ''
    const draw = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const head = headerBottom()
      const want = captionMode(target.caption ?? 'bar', vw, vh, isAnswerBox)
      setMode(want)
      const rect = card.current?.getBoundingClientRect()
      const cardTop = rect?.top ?? vh
      const low = want === 'bar' || want === 'sheet'
      const area: Box =
        want === 'side-left'
          ? { x: rect ? rect.right + 24 : 480, y: head, w: Math.max(0, vw - (rect ? rect.right + 24 : 480)), h: vh - head }
          : { x: 0, y: head, w: vw, h: Math.max(0, (low ? cardTop : vh) - head) }

      // The light is the map only, never the phone controls on it (DR-006).
      let mapBox: Box | null = null
      let roomy = true
      if (isMap) {
        const turned = vw > vh
        if (turned !== turnedRef.current) roomyRef.current = false
        turnedRef.current = turned
        // Where the card comes to rest: it is still sliding in on the first reads.
        const restTop = low && card.current ? vh - card.current.offsetHeight : vh
        const boxes = (selector: string) => findAll([selector]).map(boxOf)
        const controls = [...document.querySelectorAll(MAP_BAR)].map((el) => el.getBoundingClientRect().bottom)
        const mapArea = boxes('[data-tour="map"]')[0]
        // Narrower than this, no phone controls means they are still loading.
        if (mapArea && (controls.length > 0 || vw >= 1024)) {
          mapBox = mapLight({
            map: clip(mapArea, { ...area, h: vh - head }) ?? { ...mapArea, h: 0 },
            controlsBottom: controls.length > 0 ? Math.max(head, ...controls) : null,
            locateTop: boxes('[data-map-locate]')[0]?.y ?? null,
            listTop: boxes('[data-map-sheet]')[0]?.y ?? vh,
            cardTop: low ? restTop : null,
          })
        }
        roomy = mapBox !== null && mapRoom(mapBox.h, roomyRef.current)
        roomyRef.current = roomy
        setCramped(!roomy)
      }
      const typing = isAnswerBox && document.querySelector(`${CUE_FORM}:focus-within`) !== null
      setBarInUse(typing)
      let holes: { box: Box; r: number }[] = []
      let rings: { box: Box; r: number }[] = []
      if (lit && isCollective) {
        const box =
          want === 'sheet'
            ? { x: 4, y: 225, w: vw - 8, h: Math.max(0, cardTop - 12 - 225) }
            : { x: 326, y: head + 6, w: vw - 332, h: vh - head - 12 }
        rings = [{ box, r: 2 }]
      } else if (lit && isAnswerBox) {
        holes = findAll([CUE_ANSWER]).map((el) => ({ box: boxOf(el), r: 16 }))
        rings = [...holes]
        if (typing) {
          const bar = findAll(BAR_PARTS).map((el) => ({ box: inflate(boxOf(el), 5), r: 33 }))
          const whole = union(bar.map((one) => one.box))
          if (whole) {
            // Never one light over another: the bar's wins.
            holes = holes.filter((one) => one.box.y > whole.y + whole.h || one.box.y + one.box.h < whole.y)
            rings = [...holes, { box: whole, r: 33 }]
          }
          holes = [...holes, ...bar]
        }
      } else if (lit && isMap) {
        if (mapBox && roomy) holes = [{ box: mapBox, r: 0 }]
        rings = [...holes]
      } else if (lit) {
        holes = findAll(target.selectors).map((el) => ({
          box: inflate(boxOf(el), target.pad),
          r: target.radius,
        }))
        const whole = union(holes.map((one) => one.box))
        if (whole) rings = [{ box: whole, r: target.radius }]
      }
      const light = holes.map((one) => lightPath({ ...one.box, r: one.r }, area)).join('')
      const everywhere = { x: -10_000, y: -10_000, w: 40_000, h: 40_000 }
      const line = rings
        .map((one) => lightPath({ ...inflate(one.box, 3), r: one.r ? one.r + 3 : 0 }, everywhere))
        .join('')
      const state = `${light}|${line}|${vw}|${vh}|${JSON.stringify(area)}|${cardTop}`
      if (state !== last) {
        last = state
        scrim.current?.setAttribute('d', `M0 0H${vw}V${vh}H0Z${light}`)
        ring.current?.setAttribute('d', line)
        const c = clear.current
        // The map starts at the clear area's edges, so its ring sits outside them.
        const out = isMap ? 4 : 0
        c?.setAttribute('x', String(area.x - out))
        c?.setAttribute('y', String(area.y - out))
        c?.setAttribute('width', String(area.w + out))
        c?.setAttribute('height', String(area.h + out))
        // Room at the end of the page, so nothing stays under the card.
        const pad = low && !target.fixed && rect ? rect.height : 0
        document.documentElement.style.setProperty('--blq-tour-pad', `${Math.round(pad)}px`)
      }
      if (isCollective) {
        const pressed = document.querySelectorAll(`${SILO} .silo-view .switch button`)[1]
        setLive(pressed?.getAttribute('aria-pressed') === 'true')
        const kpis = document.querySelector(`${SILO} dl.kpis`)?.getBoundingClientRect()
        card.current?.style.setProperty(
          '--blq-tour-col-top',
          `${Math.round(Math.min(kpis && kpis.height > 0 ? kpis.bottom + 12 : head + 12, vh - 360))}px`
        )
      }
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [view, ready, lit, target, full, isAnswerBox, isCollective, isMap])

  // ── What's on screen ──────────────────────────────────────────────────────

  function onAnswer(answer: 'owner' | 'shopper' | 'notNow') {
    if (answer === 'notNow') {
      finish('now')
      return
    }
    send(ANALYTICS_EVENTS.SITE_TOUR_PATH_CHOSEN, { path: answer })
    goTo(nextIndex(buildItems(answer, context), -1, windowSize()), { path: answer })
  }

  function onBack() {
    if (waitRef.current === 'asking') {
      setWait('idle')
      sendCueCommand({ type: 'stop' })
      focusQuietly(title.current)
      return
    }
    setWait('idle')
    if (key === 'answer') {
      goTo(cueIndex)
      return
    }
    const back = previousIndex(items, index, windowSize())
    if (back < 0) goQuestion()
    else goTo(back)
  }

  function onNext() {
    setWait('idle')
    const size = windowSize()
    goTo(key === 'cue' ? indexAfterAnswer(items, index, size) : nextIndex(items, index, size))
  }

  function onChoice(choice: { href: string | null; cta: string }) {
    send(ANALYTICS_EVENTS.SITE_TOUR_CTA, { path, cta: choice.cta })
    finish('none', choice.href === null)
    if (choice.href) router.push(choice.href)
  }

  function onAction(action: CardAction) {
    if (action === 'back') onBack()
    else if (action === 'next') onNext()
    else if (action === 'example') sendCueCommand({ type: 'ask', words: SITE_TOUR_EXAMPLE_ASK })
    else onChoice(SITE_TOUR_END[path][action])
  }

  let content: React.ReactNode = null
  if (view === 'prompt') {
    content = (
      <SiteTourPrompt
        onOpen={() => {
          send(ANALYTICS_EVENTS.SITE_TOUR_SHOWN)
          setView('opening')
        }}
        onClose={() => {
          writeMemory({ endedAt: new Date().toISOString() })
          returnFocus(null)
          onClose()
        }}
      />
    )
  } else if (view === 'opening') {
    content = (
      <SiteTourTitleCard
        kind="opening"
        titleRef={title}
        title={SITE_TOUR_OPENING}
      />
    )
  } else if (view === 'welcome') {
    content = <SiteTourWelcome titleRef={title} onAnswer={onAnswer} />
  } else if (view === 'item' && item?.kind === 'chapter') {
    const words = SITE_TOUR_CHAPTERS[item.chapter]
    content = (
      <SiteTourTitleCard
        kind="chapter"
        titleRef={title}
        eyebrow={words.eyebrow}
        title={words.title}
        onNext={onNext}
      />
    )
  } else if (view === 'item' && item && ready) {
    let heading = ''
    let body = ''
    let note: string | undefined
    let count: string | null = null
    const buttons: CardButton[] = []
    if (item.kind === 'step') {
      const waiting = key === 'cue' && wait === 'asking'
      const words: { title: string; body: string; note?: string } = waiting
        ? SITE_TOUR_WAIT
        : SITE_TOUR_COPY[item.step.key]
      heading = words.title
      body = isCollective ? collectiveBody(path, live) : words.body
      note = words.note
      count = `Step ${item.number} of ${item.total}`
      buttons.push({ label: SITE_TOUR_BUTTONS.back, kind: 'plain', action: 'back' })
      if (key === 'cue' && wait === 'idle') {
        buttons.push({ label: SITE_TOUR_BUTTONS.example, kind: 'go', action: 'example' })
      } else if (!waiting) {
        buttons.push({ label: SITE_TOUR_BUTTONS.next, kind: 'go', action: 'next' })
      }
    } else if (item.kind === 'end') {
      const words = SITE_TOUR_END[path]
      heading = words.title
      body = words.body
      // A signed-in member already has an account.
      const member = signedIn && words.go.cta === 'create_account'
      buttons.push({
        label: words.other.label,
        kind: member ? 'go' : 'plain',
        action: 'other',
      })
      if (!member) buttons.push({ label: words.go.label, kind: 'go', action: 'go' })
    }
    content = (
      <>
        <SiteTourScrim scrimRef={scrim} ringRef={ring} clipRef={clear} shade={!isCollective} />
        <SiteTourCard
          ref={card}
          titleRef={title}
          mode={mode}
          modal={modal}
          barInUse={barInUse}
          isEnd={item.kind === 'end'}
          count={count}
          title={heading}
          body={body}
          note={note}
          buttons={buttons}
          onAction={onAction}
          onEnd={item.kind === 'end' ? undefined : () => finish('now')}
        />
      </>
    )
  }

  return createPortal(
    <div
      id={TOUR_ROOT_ID}
      ref={root}
      tabIndex={-1}
      className={cn('blq-tour-root', quietFocus && 'is-quiet-focus')}
    >
      {/* First in the tab order; its place on screen is fixed. */}
      {running && <SiteTourClose label={SITE_TOUR_BUTTONS.end} onClick={() => finish('now')} />}
      {view === 'item' && !full && (
        <div className={covered ? 'blq-tour-cover is-on' : 'blq-tour-cover'} aria-hidden="true" />
      )}
      {content}
      <div role="status" className={view === 'note' ? 'blq-tour-quit' : 'sr-only'}>
        {view === 'note' ? (
          <>
            <p>{signedIn ? SITE_TOUR_QUIT_NOTE.signedIn : SITE_TOUR_QUIT_NOTE.signedOut}</p>
            <button type="button" className="blq-tour-quit-x" aria-label="Close" onClick={onClose}>
              <svg viewBox="0 0 16 16" aria-hidden="true" className="blq-tour-cross">
                <path d="M2 2l12 12M14 2L2 14" />
              </svg>
            </button>
          </>
        ) : (
          hint
        )}
      </div>
    </div>,
    document.body
  )
}

function boxOf(el: Element): Box {
  const rect = el.getBoundingClientRect()
  return { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
}
