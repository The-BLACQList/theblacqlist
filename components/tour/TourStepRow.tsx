'use client'

// One row of the rail — and the thing the founder actually asked for: a step
// you can click that does something.
//
// The old row was a `<li>` of static text. Clicking "Run a search" did nothing,
// so the rail read as a receipt printed next to the page rather than a guide
// through it. A row now does three things: it expands (accordion, one open at a
// time), it rings its target on the page, and when the target is somewhere else
// it offers the trip rather than taking it.
//
// ⚠ D-T3: the row never navigates the browser on its own. Moving someone's page
// out from under them because a background poll ticked a step is a WCAG 3.2.5
// (Change on Request) failure, and it is also just rude — a tester reading a
// listing does not want to be teleported. Navigation is always a button with a
// destination in its label, and the tester taps it.

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowRight, Check, ChevronDown, Crosshair, Pencil } from 'lucide-react'

import { TOUR_STEP_TARGETS, planSpotlight, travelHref, type TourTarget } from '@/lib/tour/targets'
import { rowMarker } from '@/lib/tour/progress'
import {
  applySpotlight,
  prefersReducedMotion,
  resolveVisibleTarget,
  setPendingSpotlight,
} from './spotlight'
import { TourReflectionForm } from './TourReflectionForm'
import type { TourStepState } from './useTourState'

/**
 * When an open row re-checks the page after a navigation. More than one shot
 * because a listing page streams: the review trigger can sit behind a Suspense
 * boundary that has not resolved at first paint.
 */
const RECHECK_DELAYS_MS = [0, 400, 1200] as const

/** `step.key` is widened to `string` in the API mirror; tolerate a miss. */
function targetFor(key: string): TourTarget | undefined {
  return (TOUR_STEP_TARGETS as Record<string, TourTarget | undefined>)[key]
}

export function TourStepRow({
  step,
  index,
  expanded,
  onToggle,
  onReflectionSaved,
}: {
  step: TourStepState
  index: number
  expanded: boolean
  onToggle: (key: string) => void
  onReflectionSaved: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [awayFrom, setAwayFrom] = useState<string | null>(null)
  const rowRef = useRef<HTMLLIElement | null>(null)
  const wasExpanded = useRef(expanded)
  const panelId = `tour-step-panel-${step.key}`
  // ⚠ The founder's actual bug lived in the line this replaces. It read
  // `const done = step.status === 'done'`, which is a two-state question asked
  // of a four-state field — so `act` and `reflect` both answered "false" and
  // rendered byte-identically. Saving a listing DID move the step server-side;
  // the row just had no way to say so. Three states now, derived by a pure
  // function so the mapping is unit-testable outside a .tsx file.
  const marker = rowMarker(step.status)
  const done = marker === 'check'
  const awaitingNote = marker === 'pencil'

  // The rail is a `max-h-[70vh]` panel whose body scrolls. Step 6 sits at the
  // bottom of six rows, so the reflection textarea opened BELOW the fold of the
  // rail's own scroll container — the founder's "there's nowhere for me to
  // write the final reflection" was the form existing off-screen, not missing.
  // `block: 'nearest'` scrolls the rail body and is a no-op when the row is
  // already visible, so an expand near the top costs nothing.
  useEffect(() => {
    if (expanded && !wasExpanded.current) {
      try {
        rowRef.current?.scrollIntoView({ block: 'nearest' })
      } catch {
        // Non-fatal: a row the tester has to scroll to is not worth an error.
      }
    }
    wasExpanded.current = expanded
  }, [expanded])

  /**
   * Find the target on THIS page and ring it, or record that it lives
   * elsewhere so the panel can offer the trip.
   *
   * `planSpotlight` makes the decision — it is pure and unit-tested. This
   * function only supplies the one fact it cannot have (is the element here?)
   * and carries out the verdict.
   */
  const locate = useCallback(() => {
    const target = targetFor(step.key)
    if (target === undefined) return
    const el = resolveVisibleTarget(target.selectors)
    const plan = planSpotlight(target, el !== null)

    if (plan.action === 'spotlight') {
      applySpotlight(el, prefersReducedMotion())
      setAwayFrom(null)
      return
    }
    // 'navigate'/'hint' offer the trip; 'focus-rail' — the final reflection —
    // has no page target, and expanding the row already put the textarea on
    // screen.
    setAwayFrom(travelHref(plan))
  }, [step.key])

  // Re-ask "is the target on THIS page?" whenever the page changes under an
  // open row, or a row opens without a click (follow-the-tour, a step that just
  // moved). The rail survives navigation, so an answer from the last page goes
  // stale: step 5 opened on Discover kept offering "Find a listing" on the
  // listing page itself and sent the tester back to Discover.
  //
  // ⚠ This only updates which button the row offers. It never rings or focuses
  // anything — moving focus because the page changed, not because the tester
  // asked, is the same D-T3 / WCAG 3.2.5 problem as navigating on their behalf.
  useEffect(() => {
    if (!expanded) return
    const target = targetFor(step.key)
    if (target === undefined) return
    const timers = RECHECK_DELAYS_MS.map((delay) =>
      setTimeout(() => {
        const found = resolveVisibleTarget(target.selectors) !== null
        setAwayFrom(travelHref(planSpotlight(target, found)))
      }, delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [pathname, expanded, step.key])

  const handleToggle = useCallback(() => {
    const opening = !expanded
    onToggle(step.key)
    if (opening) locate()
  }, [expanded, onToggle, step.key, locate])

  const travel = useCallback(() => {
    if (awayFrom === null) return
    // Park the intent so the ring fires after the new page paints. The rail
    // survives the navigation (it is in the root layout) but the target's page
    // does not exist yet at this moment.
    setPendingSpotlight(step.key)
    router.push(awayFrom)
  }, [awayFrom, step.key, router])

  const target = targetFor(step.key)

  return (
    <li ref={rowRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-start gap-3 rounded-lg px-1 py-2 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
      >
        <span
          aria-hidden="true"
          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-subhead text-xs font-bold ${
            done
              ? 'border-amber-gold bg-amber-gold/20 text-amber-gold'
              : awaitingNote
                ? 'border-amber-gold text-amber-gold'
                : 'border-white/25 text-cream/70'
          }`}
        >
          {done ? (
            <Check className="size-3.5" />
          ) : awaitingNote ? (
            <Pencil className="size-3" />
          ) : (
            index + 1
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col font-subhead text-sm font-bold text-cream">
          {step.title}
          {/* The numeral/check/pencil is aria-hidden, so state reaches a screen
              reader here or not at all. The middle state needs its own words —
              "not done yet" is true of a reflect step but tells a tester
              nothing about what is actually being waited on. */}
          <span className="sr-only">
            {done ? ' — done' : awaitingNote ? ' — saved, write your note' : ' — not done yet'}
          </span>
          {/* The visible half of the same fact, and the reason it sits INSIDE
              the toggle button rather than beside it: the whole row is already
              the click target, so the hint is tappable without becoming a
              second focusable control or nesting a button in a button. It is
              aria-hidden because the sr-only line above already says this to a
              screen reader — announcing it twice is worse than once. */}
          {awaitingNote && !expanded && (
            <span
              aria-hidden="true"
              className="mt-0.5 flex items-center gap-1 font-subhead text-xs font-normal text-amber-gold"
            >
              Write your note
              <ArrowRight className="size-3" />
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`mt-1 size-4 shrink-0 text-cream/50 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {expanded && (
        <div id={panelId} className="ml-9 pb-2 pr-1">
          {(step.status === 'act' || step.status === 'retry') && step.message && (
            <p className="font-subhead text-sm text-cream/70">{step.message}</p>
          )}

          {!done && awayFrom !== null && target?.go !== undefined && (
            <>
              {/* The button is the short action; the sentence of context
                  stays visible beside it as helper text. */}
              <p className="mt-1 font-subhead text-xs text-cream/60">{target.hint}</p>
              <button
                type="button"
                onClick={travel}
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-gold/60 px-4 py-1.5 font-subhead text-sm font-bold text-amber-gold transition-colors hover:bg-amber-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
              >
                {target.go}
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </>
          )}

          {!done && awayFrom === null && target !== undefined && target.kind !== 'in-rail' && (
            <button
              type="button"
              onClick={locate}
              className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-4 py-1.5 font-subhead text-sm text-cream transition-colors hover:border-amber-gold hover:text-amber-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
            >
              <Crosshair className="size-4" aria-hidden="true" />
              Show me
            </button>
          )}

          {step.status === 'reflect' && (
            <TourReflectionForm step={step} onSaved={onReflectionSaved} />
          )}
        </div>
      )}
    </li>
  )
}
