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

import { evidenceStepKeys } from '@/lib/tour/targets'
import {
  announceTransition,
  attentionStep,
  statusFingerprint,
  watchedStepMoved,
  type ProgressSnapshot,
  type ProgressStatus,
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

/**
 * The step that just moved, plus a monotonic sequence number.
 *
 * ⚠ The sequence is load-bearing, not decoration. The rail opens `key` in an
 * effect, and a tester who saves a listing, collapses the row themselves, then
 * saves another listing produces the SAME key twice — which a bare string would
 * render as "no change" and the row would stay shut. `seq` makes every
 * transition distinct, so the effect fires once per actual movement.
 */
export interface TourAttention {
  key: string
  seq: number
}

export interface TourStateHandle {
  phase: LoadPhase
  tour: TourState | null
  /** Latest live-region line. Empty string when there is nothing to announce. */
  announcement: string
  /**
   * The step that moved on the most recent payload, or null when nothing has.
   * Null on first load — an arrival is not a change (see `attentionStep`).
   */
  attention: TourAttention | null
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
 * exits the moment a step the tester acted on moves (see `watchedStepMoved`),
 * so the common case costs one or two fetches, not four.
 *
 * The last rung is for a cold start: the Save request itself has to land
 * before the read can see it, and on a cold function that can take a few
 * seconds. The whole chain still ends about 11.5s after the tap.
 *
 * Bounded on purpose. An unbounded poll on a rail that lives in the root layout
 * is a request every N seconds for the entire session, per tester, forever.
 */
const CHASE_DELAYS = [700, 1600, 3200, 6000] as const

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
  const [attention, setAttention] = useState<TourAttention | null>(null)
  const [checking, setChecking] = useState(false)
  const [fetchKey, setFetchKey] = useState(0)

  const previous = useRef<ProgressSnapshot | null>(null)
  const fingerprint = useRef('')
  const chase = useRef<AbortController | null>(null)
  // Steps the tester has acted on since the last chase ended, each with the
  // status it had at that moment. The chase stops when one of THESE moves.
  const watch = useRef<Map<string, ProgressStatus | undefined>>(new Map())
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
    // Both diffed BEFORE `previous` is overwritten, and both null on first
    // load — a live region announces changes, not arrivals, and the same is
    // true of opening a row: page load must not fight the tester's own choice.
    const line = announceTransition(previous.current, snapshot)
    const moving = attentionStep(previous.current, snapshot)

    fingerprint.current = fp
    previous.current = snapshot
    setTour(next)
    setPhase('ready')
    if (line !== null) setAnnouncement(line)
    if (moving !== null) {
      setAttention((prev) => ({ key: moving, seq: (prev?.seq ?? 0) + 1 }))
    }
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
   * Ask again a few times, backing off, stopping as soon as a watched step moves.
   *
   * Every payload is still applied, so a tick that lands mid-chase (the
   * `listing_opened` witness, typically) shows up at once. It just does not end
   * the chase: that was the bug where a Save on a listing page never counted
   * until the tester went back to /discover.
   *
   * A new piece of evidence restarts the chain rather than being dropped, so a
   * second tap resets the clock instead of riding out the tail of the first.
   *
   * ⚠ A failed read inside a chase does NOT set phase 'failed'. The rail
   * already has good state on screen and the tester never asked for this
   * request — blanking six correct step rows into an error panel because a
   * background poll caught a blip would be strictly worse than showing state
   * that is a few seconds stale.
   */
  const runChase = useCallback(async () => {
    chase.current?.abort() // one chain at a time: the newest evidence wins
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
        apply(result.data)
        if (watchedStepMoved(watch.current, result.data)) return // stop early
      }
    } catch {
      // Aborts land here too. A chase that fails is silent by design.
    } finally {
      // An aborted chain was replaced by a newer one, which now owns the
      // watch list and the checking flag. Only the live chain clears them.
      if (chase.current === controller) {
        chase.current = null
        watch.current = new Map()
        if (alive.current) setChecking(false)
      }
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
      const keys = evidenceKeys(event)
      if (keys.length === 0) return
      for (const key of keys) {
        // Keep the first baseline: a second tap on the same step is still
        // measured against where it stood before the first one.
        if (watch.current.has(key)) continue
        watch.current.set(key, previous.current?.steps.find((s) => s.key === key)?.status)
      }
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

  return { phase, tour, announcement, attention, checking, refresh, retry }
}

/**
 * Which tour steps this event plausibly counts toward. Empty means none.
 *
 * Filtering matters: without it every click anywhere on the marketplace would
 * fire a four-request chase. The filter is DRIVEN BY the same target table the
 * spotlight uses, so a selector added there is watched here automatically.
 *
 * Clicks look UP (did the click land inside a Save button?); submits look DOWN
 * (does this form contain the review textarea?) — a submit event's target is
 * the form, which is an ancestor of the field, not a descendant.
 */
function evidenceKeys(event: Event): string[] {
  const target = event.target
  if (!(target instanceof Element)) return []
  return evidenceStepKeys((selector) =>
    event.type === 'submit'
      ? target.querySelector(selector) !== null
      : target.closest(selector) !== null
  )
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
