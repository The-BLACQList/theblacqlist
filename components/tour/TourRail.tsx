'use client'

// The Tester Tour rail: a fixed panel enrolled testers see on every public
// page (tester-tour-spec.md §7). The client stays deliberately dumb — all six
// per-step verdicts arrive pre-resolved from GET /api/tour/state as
// { key, title, gated, status, prompt, message }; this file never imports
// lib/tour/verify.ts and never derives a status itself. In particular the
// 'act' vs 'retry' distinction (verified absence vs failed read) is decided
// server-side and only RENDERED here, so no client code path can tell a
// tester who already did a thing to go do it.
//
// z-40 keeps the rail under the z-50 fixed header. Route hiding uses PREFIX
// matching — deliberately unlike ChromeGate's exact equality, because /admin
// has children and the rail must not float over any of them.
//
// This file is the SHELL. The three things it used to also be now live beside
// it: when to refetch (useTourState.ts), how a row behaves (TourStepRow.tsx),
// and how the reflection saves (TourReflectionForm.tsx).

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react'

// Prefix-hidden routes. The rail belongs on the public marketplace surfaces
// the tour walks (search, listings, collections, reviews) — not over the
// admin console, the coming-soon gate, auth flows, or onboarding. The policy
// lives in lib/tour/routes.ts so it is testable outside a client chunk.
import { isHiddenPath } from '@/lib/tour/routes'
import { TOUR_STEP_TARGETS, type TourTarget } from '@/lib/tour/targets'
import {
  currentStepKey,
  doneCount,
  optionalUnfinishedSteps,
  pendingReflectionCount,
} from '@/lib/tour/progress'
import { ClaimTrialButton } from './ClaimTrialButton'
import { TourStepRow } from './TourStepRow'
import {
  applySpotlight,
  prefersReducedMotion,
  resolveVisibleTarget,
  takePendingSpotlight,
} from './spotlight'
import { useTourState, type TourState, type TourStepState } from './useTourState'

const COLLAPSE_KEY = 'blacq-tour-collapsed'
/** Two shots at the parked spotlight: after paint, then after data lands. */
const PENDING_RETRIES = [260, 900] as const
/** Module-level so the empty case is referentially stable across renders. */
const NO_STEPS: TourStepState[] = []

// ── The collapse preference, as a tiny external store ────────────────────────
//
// Reading localStorage in a mount effect and calling setCollapsed is the
// obvious version and it is wrong twice: it renders the rail expanded, then
// collapsed, on every single page load for a tester who collapsed it (a visible
// flash and a cascading render the react-hooks lint rightly rejects), and it
// cannot be seeded in the useState initializer because localStorage does not
// exist during SSR.
//
// useSyncExternalStore is the supported answer: it takes a separate SERVER
// snapshot, so the server renders `false` (expanded) while the client reads the
// stored value during hydration, in one render, with no effect.

const collapseListeners = new Set<() => void>()
/** Cached so getSnapshot returns a stable value — required by the hook. */
let collapseSnapshot: boolean | null = null

function readCollapse(): boolean {
  if (collapseSnapshot === null) {
    try {
      collapseSnapshot = localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      // Safari private mode throws on access, not just on write.
      collapseSnapshot = false
    }
  }
  return collapseSnapshot
}

/** The server has no storage; the rail always renders open there. */
function serverCollapse(): boolean {
  return false
}

function writeCollapse(next: boolean): void {
  collapseSnapshot = next
  try {
    localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
  } catch {
    // Non-fatal — the preference just does not survive the next page.
  }
  collapseListeners.forEach((listener) => listener())
}

function subscribeCollapse(listener: () => void): () => void {
  collapseListeners.add(listener)
  return () => {
    collapseListeners.delete(listener)
  }
}

export function TourRail() {
  const pathname = usePathname()
  const router = useRouter()
  const { phase, tour, announcement, attention, checking, refresh, retry } = useTourState()
  const collapsed = useSyncExternalStore(subscribeCollapse, readCollapse, serverCollapse)
  // null = "follow the tour" (the first unfinished step is open). A string
  // pins the tester's own choice; '' means they closed everything.
  const [openStep, setOpenStep] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)

  const steps = tour?.steps ?? NO_STEPS

  // After a saved reflection the server may have stamped completion or
  // flipped step statuses — refetch the rail's state AND refresh the server
  // tree (the action deliberately calls no revalidatePath).
  const handleReflectionSaved = useCallback(() => {
    refresh()
    router.refresh()
  }, [refresh, router])

  const handleToggle = useCallback(
    (key: string) =>
      setOpenStep((prev) => ((prev ?? currentStepKey(steps)) === key ? '' : key)),
    [steps]
  )

  // A spotlight parked by "Go to the search page →" fires here, on the page it
  // was aimed at. Two shots because the target may be behind a Suspense
  // boundary that has not resolved at first paint; `takePendingSpotlight`
  // consumes the intent immediately so a slow page cannot fire it twice.
  useEffect(() => {
    const step = takePendingSpotlight()
    if (step === null) return
    const target = (TOUR_STEP_TARGETS as Record<string, TourTarget | undefined>)[step]
    if (target === undefined) return

    // Every write is deferred out of the effect body — opening the row is a
    // state write and the ring is a DOM write, and neither should run
    // synchronously in the effect that merely discovered the parked intent.
    const timers = [
      setTimeout(() => setOpenStep(step), 0),
      ...PENDING_RETRIES.map((delay, i) =>
        setTimeout(() => {
          const el = resolveVisibleTarget(target.selectors)
          if (el !== null || i === PENDING_RETRIES.length - 1) {
            applySpotlight(el, prefersReducedMotion())
          }
        }, delay)
      ),
    ]
    return () => timers.forEach(clearTimeout)
  }, [pathname])

  // The row that just moved opens itself.
  //
  // ⚠ `attentionSeq` is in the dependency array on purpose, and it is the half
  // that does the work. The same step can become the moving one twice — save a
  // listing, collapse the row by hand, then save another listing that lands on
  // the same key — and a key-only effect reads the second transition as "no
  // change" and leaves the row shut. The sequence makes every movement
  // distinct.
  //
  // `attention` is null on first load by construction (`attentionStep` returns
  // null with no predecessor), so a page load never yanks open a row the tester
  // deliberately closed. Same rule the live region follows: an arrival is not a
  // change.
  const attentionKey = attention?.key ?? null
  const attentionSeq = attention?.seq ?? 0
  useEffect(() => {
    if (attentionKey === null) return
    // Deferred for the same reason as the parked spotlight above: no state
    // write runs synchronously inside an effect body.
    const timer = setTimeout(() => setOpenStep(attentionKey), 0)
    return () => clearTimeout(timer)
  }, [attentionKey, attentionSeq])

  if (isHiddenPath(pathname) || phase === 'gone') return null

  const done = doneCount(steps)
  const total = steps.length || 6
  const complete = tour?.completedAt != null
  const effectiveOpen = openStep ?? currentStepKey(steps)

  // ⚠ Two numbers, not one, and this is the founder's bug stated as arithmetic.
  // Saving a listing moves a step `act → reflect`, which `doneCount` does not
  // count — correctly, because the step is not done until the note is written.
  // So the single count printed the same thing before and after the save. The
  // rail now states progress and the work waiting on the tester separately;
  // neither number is inflated to make something appear to have happened.
  const pending = pendingReflectionCount(steps)
  const count = complete ? 'complete' : `${done}/${total}`
  const countLine = pending > 0 ? `${count} · ${pending} to write` : count

  if (collapsed) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <button
          type="button"
          onClick={() => writeCollapse(false)}
          aria-expanded={false}
          className="inline-flex items-center gap-2 rounded-full border border-amber-gold/40 bg-deep-bg px-4 py-2 font-subhead text-sm text-cream shadow-lg transition-colors hover:border-amber-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
        >
          <span className="font-bold text-amber-gold">Tester Tour</span>
          <span>{countLine}</span>
          <ChevronUp className="size-4" aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <aside
      aria-label="Tester Tour progress"
      className="fixed bottom-4 right-4 z-40 flex max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-amber-gold/40 bg-deep-bg text-cream shadow-2xl"
    >
      {/* ⚠ ALWAYS RENDERED, never conditionally mounted. A live region that
          appears at the same moment as its text is not announced — the browser
          has nothing to diff it against. Mounting it empty and writing into it
          later is the only reliable pattern. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="font-subhead text-sm font-bold text-amber-gold">
          Tester Tour{' '}
          <span className="font-normal text-cream">· {countLine}</span>
        </p>
        <button
          type="button"
          onClick={() => writeCollapse(true)}
          aria-expanded={true}
          aria-label="Collapse the tour panel"
          className="rounded-full p-1 text-cream/70 transition-colors hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="overflow-y-auto px-4 py-3">
        {phase === 'loading' && (
          <p className="flex items-center gap-2 py-4 font-subhead text-sm text-cream/70">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading your tour…
          </p>
        )}

        {phase === 'failed' && (
          // One rail-level retry — the API 500s rather than sending per-step
          // guesses, so the rail must not render six confident step states it
          // does not have.
          <div className="py-4">
            <p className="font-subhead text-sm text-cream/80">
              Couldn&apos;t load your tour progress.
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-2 rounded-full border border-amber-gold/60 px-4 py-1.5 font-subhead text-sm font-bold text-amber-gold transition-colors hover:bg-amber-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
            >
              Try again
            </button>
          </div>
        )}

        {phase === 'ready' && tour && (
          <>
            {/* D-T2: at the end the rail becomes the reward, not a checklist
                with a button under it. The six rows fold away behind "Review
                your walk" and the claim takes their place — but the tester
                still TAPS it. Sending someone to Stripe on a timer, at the
                moment they finish typing, is not a celebration. */}
            {complete && (
              <div className="pb-1">
                <p className="font-subhead text-base font-bold text-amber-gold">
                  That&apos;s the walk. Thank you.
                </p>
                <p className="mt-1 font-subhead text-sm text-cream/80">
                  {tour.trialGrantedAt === null
                    ? 'You finished every written step. Your 30-day Starter trial is ready.'
                    : 'Your trial claim is in — resume checkout if you didn’t finish it.'}
                </p>

                {tour.canClaim || tour.trialGrantedAt !== null ? (
                  <ClaimTrialButton claimed={tour.trialGrantedAt !== null} />
                ) : (
                  // `canClaim` is the server's word, not ours. It can be false
                  // on a complete tour (already subscribed, enrollment closed),
                  // and rendering a claim button the claim route will refuse is
                  // worse than rendering none.
                  <p className="mt-3 font-subhead text-sm text-cream/70">
                    Nothing left to claim on this account.
                  </p>
                )}

                <OptionalLeftovers tour={tour} />

                <button
                  type="button"
                  onClick={() => setReviewing((r) => !r)}
                  aria-expanded={reviewing}
                  className="mt-4 inline-flex items-center gap-1.5 font-subhead text-sm text-cream/70 underline underline-offset-4 transition-colors hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
                >
                  {reviewing ? 'Hide your walk' : 'Review your walk'}
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-4 transition-transform ${reviewing ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
            )}

            {(!complete || reviewing) && (
              <ol
                className={
                  complete ? 'mt-3 space-y-1 border-t border-white/10 pt-3' : 'space-y-1'
                }
              >
                {tour.steps.map((step, index) => (
                  <TourStepRow
                    key={step.key}
                    step={step}
                    index={index}
                    expanded={effectiveOpen === step.key}
                    onToggle={handleToggle}
                    onReflectionSaved={handleReflectionSaved}
                  />
                ))}
              </ol>
            )}

            {!complete && (
              // ⚠ This button NEVER claims success. It re-asks the server and
              // whatever comes back is what renders — a rail that said
              // "checked!" and left a step unticked would be worse than no
              // button at all.
              <button
                type="button"
                onClick={refresh}
                disabled={checking}
                className="mt-3 inline-flex items-center gap-2 font-subhead text-xs text-cream/60 transition-colors hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold disabled:opacity-60"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={`size-3.5 ${checking ? 'animate-spin' : ''}`}
                />
                {checking ? 'Checking…' : 'Did something? Check again'}
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  )
}

/**
 * The un-gated steps a tester skipped, shown once the tour is complete.
 *
 * Completion is the four reflection-gated steps, so a finished tour can sit at
 * 4/6 or 5/6 forever. Without this the rail reads "complete" beside two blank
 * circles and looks broken; naming them as optional is the honest version.
 */
function OptionalLeftovers({ tour }: { tour: TourState }) {
  const leftovers = optionalUnfinishedSteps({
    steps: tour.steps,
    completedAt: tour.completedAt,
  })
  if (leftovers.length === 0) return null
  return (
    <p className="mt-3 font-subhead text-xs text-cream/50">
      Optional, and still open: {leftovers.map((s) => s.title).join(' · ')}
    </p>
  )
}
