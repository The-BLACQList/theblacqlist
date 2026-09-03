'use client'

// Everything the rail knows about WHEN to ask the server again.
//
// Pulled out of TourRail.tsx because the old effect's dependency array was the
// whole of root cause 1: it was `[fetchKey]`, so the rail fetched exactly once
// per mount — and it mounts in the ROOT layout, which App Router never remounts
// on navigation. A tester could search, open a listing, save it and browse a
// collection, and the rail would still be showing the state it read on the
// first page load. `0/6` never moved because nobody ever asked again.
//
// Four things now ask:
//
//   1. THE ROUTE CHANGED — keyed on pathname AND query string. `/search?q=tacos`
//      and `/search?q=atlanta` are the same pathname but different evidence, and
//      the second search is exactly the moment a tester expects step 1 to tick.
//   2. THE TESTER DID SOMETHING that looks like evidence (below).
//   3. THE TAB CAME BACK — they did the thing in another tab, or came back an
//      hour later.
//   4. SOMETHING ASKED — `refresh()`, after a saved reflection or a manual check.
//
// ⚠ The rail NEVER optimistically ticks a step. Every status on screen came from
// GET /api/tour/state, which is the only thing that reads witness evidence.
// A client that guessed "they clicked Save, call it done" would tell a tester
// they had finished a step the server has no record of — the exact failure the
// server-side 'act' vs 'retry' split exists to prevent.

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import { TOUR_STEP_TARGETS } from '@/lib/tour/targets'
import {
  announceTransition,
  statusFingerprint,
  type ProgressSnapshot,
} from '@/lib/tour/progress'

// Mirrors the /api/tour/state response shape. Kept local so the client chunk
// carries no server-module imports — the same reason TourRail.tsx had it.
export type TourStepStatus = 'done' | 'reflect' | 'act' | 'retry'

export interface TourStepState {
  key: string
  title: string
  gated: boolean
  status: TourStepStatus
  prompt: string | null
  message: string | null
}

export interface TourState {
  listingId: string
  completedAt: string | null
  trialGrantedAt: string | null
  canClaim: boolean
  steps: TourStepState[]
}

export type LoadPhase = 'loading' | 'ready' | 'failed' | 'gone'

export interface TourStateHandle {
  phase: LoadPhase
  tour: TourState | null
  /** Latest live-region line. Empty string when there is nothing to announce. */
  announcement: string
  /** True while a background chase is in flight, for the manual check button. */
  checking: boolean
  refresh: () => void
  retry: () => void
}

/**
 * When to re-ask after the tester does something, in milliseconds.
 *
 * Every witness write happens in a Next.js `after()` callback, so the row does
 * not exist yet when the click handler returns — a single immediate refetch
 * reads the state from BEFORE the action and reports nothing changed. The chain
 * exits the moment the fingerprint moves, so the common case costs one fetch,
 * not three.
 *
 * Bounded on purpose. An unbounded poll on a rail that lives in the root layout
 * is a request every N seconds for the entire session, per tester, forever.
 */
const CHASE_DELAYS = [700, 1600, 3200] as const

/** Every selector the tour cares about, flattened out of the target table. */
const EVIDENCE_SELECTORS: readonly string[] = Object.values(TOUR_STEP_TARGETS).flatMap(
  (t) => [...t.selectors]
)

type ReadResult =
  | { kind: 'ok'; data: TourState }
  | { kind: 'gone' }
  | { kind: 'failed' }

export function useTourState(): TourStateHandle {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // ⚠ The query string is part of the key. See note 1 in the header.
  // `useSearchParams` is why TourRailMount must stay inside the
  // <Suspense fallback={null}> at app/layout.tsx — without it this hook opts
  // the whole page out of static rendering.
  const routeKey = `${pathname}?${searchParams.toString()}`

  const [phase, setPhase] = useState<LoadPhase>('loading')
  const [tour, setTour] = useState<TourState | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [checking, setChecking] = useState(false)
  const [fetchKey, setFetchKey] = useState(0)

  const previous = useRef<ProgressSnapshot | null>(null)
  const fingerprint = useRef('')
  const chase = useRef<AbortController | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      chase.current?.abort()
    }
  }, [])

  const read = useCallback(async (signal: AbortSignal): Promise<ReadResult> => {
    const res = await fetch('/api/tour/state', { cache: 'no-store', signal })
    if (res.status === 404) {
      // The server mounted the rail but the API no longer recognises the viewer
      // (flag flipped off mid-session, enrollment ended). Vanish.
      return { kind: 'gone' }
    }
    if (!res.ok) return { kind: 'failed' }
    const body = (await res.json()) as { data?: TourState }
    if (!body.data) return { kind: 'failed' }
    return { kind: 'ok', data: body.data }
  }, [])

  /** Commit a payload. Returns true when it changed something visible. */
  const apply = useCallback((next: TourState): boolean => {
    const snapshot: ProgressSnapshot = {
      steps: next.steps,
      completedAt: next.completedAt,
    }
    const fp = statusFingerprint(snapshot)
    const moved = fp !== fingerprint.current
    // Diffed BEFORE `previous` is overwritten, and null on first load — a live
    // region announces changes, not arrivals.
    const line = announceTransition(previous.current, snapshot)

    fingerprint.current = fp
    previous.current = snapshot
    setTour(next)
    setPhase('ready')
    if (line !== null) setAnnouncement(line)
    return moved
  }, [])

  // Route change · refresh() · retry() · tab regained focus.
  useEffect(() => {
    const controller = new AbortController()
    // Deferred through setTimeout with an abort on cleanup — the
    // ListingCombobox pattern — so no setState runs synchronously inside the
    // effect body and nothing fires after unmount.
    const timer = setTimeout(async () => {
      try {
        const result = await read(controller.signal)
        if (controller.signal.aborted || !alive.current) return
        if (result.kind === 'gone') {
          setPhase('gone')
          return
        }
        if (result.kind === 'failed') {
          setPhase('failed')
          return
        }
        apply(result.data)
      } catch {
        if (!controller.signal.aborted && alive.current) setPhase('failed')
      }
    }, 0)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [routeKey, fetchKey, read, apply])

  /**
   * Ask again a few times, backing off, stopping as soon as anything moves.
   *
   * ⚠ A failed read inside a chase does NOT set phase 'failed'. The rail
   * already has good state on screen and the tester never asked for this
   * request — blanking six correct step rows into an error panel because a
   * background poll caught a blip would be strictly worse than showing state
   * that is a few seconds stale.
   */
  const runChase = useCallback(async () => {
    if (chase.current !== null) return // one chain at a time
    const controller = new AbortController()
    chase.current = controller
    setChecking(true)
    try {
      for (const delay of CHASE_DELAYS) {
        await sleep(delay, controller.signal)
        if (controller.signal.aborted || !alive.current) return
        const result = await read(controller.signal)
        if (controller.signal.aborted || !alive.current) return
        if (result.kind === 'gone') {
          setPhase('gone')
          return
        }
        if (result.kind === 'failed') continue
        if (apply(result.data)) return // learned something — stop early
      }
    } catch {
      // Aborts land here too. A chase that fails is silent by design.
    } finally {
      if (chase.current === controller) chase.current = null
      if (alive.current) setChecking(false)
    }
  }, [read, apply])

  // Evidence listeners.
  //
  // Delegated on `document` rather than wired into SaveButton and ReviewForm,
  // so the tour costs those components exactly nothing — no prop, no import, no
  // callback to forget. They do not know the tour exists, which is why they
  // cannot break it.
  //
  // ⚠ `capture: true, passive: true`. Passive is the point: it is the BROWSER
  // enforcing that this listener can never call preventDefault, so no future
  // edit here can swallow a Save click and stop a tester saving a listing.
  // Capture means we observe before any handler can stopPropagation on us.
  useEffect(() => {
    const onEvidence = (event: Event) => {
      if (!isEvidence(event)) return
      void runChase()
    }
    document.addEventListener('click', onEvidence, { capture: true, passive: true })
    document.addEventListener('submit', onEvidence, { capture: true, passive: true })
    return () => {
      document.removeEventListener('click', onEvidence, { capture: true })
      document.removeEventListener('submit', onEvidence, { capture: true })
    }
  }, [runChase])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setFetchKey((k) => k + 1)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const refresh = useCallback(() => setFetchKey((k) => k + 1), [])
  const retry = useCallback(() => {
    setPhase('loading')
    setFetchKey((k) => k + 1)
  }, [])

  return { phase, tour, announcement, checking, refresh, retry }
}

/**
 * Does this event plausibly touch something the tour watches?
 *
 * Filtering matters: without it every click anywhere on the marketplace would
 * fire a three-request chase. The filter is DRIVEN BY the same target table the
 * spotlight uses, so a selector added there is watched here automatically.
 *
 * Clicks look UP (did the click land inside a Save button?); submits look DOWN
 * (does this form contain the review textarea?) — a submit event's target is
 * the form, which is an ancestor of the field, not a descendant.
 */
function isEvidence(event: Event): boolean {
  const target = event.target
  if (!(target instanceof Element)) return false
  try {
    for (const selector of EVIDENCE_SELECTORS) {
      if (event.type === 'submit') {
        if (target.querySelector(selector) !== null) return true
      } else if (target.closest(selector) !== null) {
        return true
      }
    }
  } catch {
    return false
  }
  return false
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new Error('aborted'))
      },
      { once: true }
    )
  })
}
