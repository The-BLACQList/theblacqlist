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
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, ChevronDown, Crosshair } from 'lucide-react'

import { TOUR_STEP_TARGETS, planSpotlight, type TourTarget } from '@/lib/tour/targets'
import {
  applySpotlight,
  prefersReducedMotion,
  resolveVisibleTarget,
  setPendingSpotlight,
} from './spotlight'
import { TourReflectionForm } from './TourReflectionForm'
import type { TourStepState } from './useTourState'

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
  const [awayFrom, setAwayFrom] = useState<string | null>(null)
  const rowRef = useRef<HTMLLIElement | null>(null)
  const wasExpanded = useRef(expanded)
  const panelId = `tour-step-panel-${step.key}`
  const done = step.status === 'done'

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
    if (plan.action === 'navigate' || plan.action === 'hint') {
      setAwayFrom(plan.href)
      return
    }
    // 'focus-rail' — the final reflection has no page target. Expanding the row
    // has already put the textarea on screen; nothing else to do.
    setAwayFrom(null)
  }, [step.key])

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
              : 'border-white/25 text-cream/70'
          }`}
        >
          {done ? <Check className="size-3.5" /> : index + 1}
        </span>
        <span className="min-w-0 flex-1 font-subhead text-sm font-bold text-cream">
          {step.title}
          {/* The numeral/check is aria-hidden, so state reaches a screen reader
              here or not at all. */}
          <span className="sr-only">{done ? ' — done' : ' — not done yet'}</span>
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

          {!done && awayFrom !== null && target !== undefined && (
            <button
              type="button"
              onClick={travel}
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-gold/60 px-4 py-1.5 font-subhead text-sm font-bold text-amber-gold transition-colors hover:bg-amber-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
            >
              {target.hint}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          )}

          {!done && awayFrom === null && target !== undefined && target.kind !== 'in-rail' && (
            <button
              type="button"
              onClick={locate}
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-1.5 font-subhead text-sm text-cream transition-colors hover:border-amber-gold hover:text-amber-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
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
