// Where each Tester Tour step's evidence actually lives on the page — the
// record that lets the rail spotlight a thing instead of only describing it.
//
// This file is the CLIENT half of a deliberate copy split:
//
//   * `TOUR_STEP_COPY` (lib/tour/verify.ts) says WHAT to do and WHY. It is a
//     server module by dependency — verify.ts imports `@/lib/supabase/server`
//     at its top — so its strings reach the rail only through the API payload.
//   * `TOUR_STEP_TARGETS` (here) says WHERE the thing is. Nothing in this file
//     imports anything but `./steps`, so it is safe in a client bundle.
//
// A test asserts the two string sets are disjoint. If a hint here starts
// telling a tester what to do, the two halves have started to drift and one of
// them will eventually contradict the other in front of a real tester.
//
// The `fallbackHref` trap, recorded so it is not re-introduced: the tour-state
// payload's only URL-ish field is `listingId` — the tester's OWN listing — and
// steps 2, 3 and 5 all require a listing that is NOT theirs. Every fallback
// here therefore points at a discovery surface, never at the enrolled listing.

import { TOUR_STEPS, type TourStepKey } from './steps'

/**
 * How a step's target relates to the page the tester is currently on.
 *
 *   * `page`           — a specific route holds it; we can send them there.
 *   * `listing-scoped` — it only exists on *a* listing page, and which listing
 *                        is the tester's choice, so there is no single href.
 *   * `in-rail`        — the target is the rail itself; there is nowhere to go.
 */
export type TourTargetKind = 'page' | 'listing-scoped' | 'in-rail'

export interface TourTarget {
  kind: TourTargetKind
  /**
   * CSS selectors tried IN ORDER. Order is load-bearing where a page holds
   * more than one candidate — see `review_or_correction` below.
   */
  selectors: readonly string[]
  /** The route that reliably holds this target, or null when none does. */
  href: string | null
  /** Where to point a tester who is nowhere near the target. Never their own listing. */
  fallbackHref: string | null
  /** WHERE the thing is. Never what to do — that is `step.message`. */
  hint: string
}

export const TOUR_STEP_TARGETS: Record<TourStepKey, TourTarget> = {
  search_ran: {
    kind: 'page',
    selectors: ['#discovery-search'],
    href: '/search',
    fallbackHref: '/search',
    hint: 'The search field sits at the top of the discovery page.',
  },
  listing_opened: {
    kind: 'page',
    // The results grid is a <section>, not a control, so the spotlight gives it
    // a temporary tabIndex and takes it back on cleanup.
    selectors: ['section[aria-label="Discovery results"]'],
    href: '/discover',
    fallbackHref: '/discover',
    hint: 'Listing cards fill the results grid below the filters.',
  },
  listing_saved: {
    kind: 'listing-scoped',
    selectors: ['[data-tour="save-listing"]'],
    href: null,
    fallbackHref: '/discover',
    hint: 'The Save control sits in the action row of any listing page.',
  },
  collection_browsed: {
    kind: 'page',
    // Prefix match, not exact: the footer's own link is `/collections` with no
    // trailing segment and correctly does not match.
    selectors: ['a[href^="/collections/"]'],
    href: '/collections',
    fallbackHref: '/collections',
    hint: 'Collection cards are on the collections index.',
  },
  review_or_correction: {
    kind: 'listing-scoped',
    // ⚠ ORDER MATTERS. The correction trigger renders ABOVE the reviews
    // section on a listing page, so a comma-joined selector — which resolves
    // in document order, not list order — would always land on the wrong one.
    selectors: ['#review-body', '[data-tour="report-correction"]'],
    href: null,
    fallbackHref: '/discover',
    hint: 'The review box is near the bottom of a listing page; the correction link sits above it.',
  },
  final_reflection: {
    kind: 'in-rail',
    selectors: [],
    href: null,
    fallbackHref: null,
    hint: 'This last one is written right here in this panel.',
  },
}

/**
 * What the rail should do when a tester clicks a step row.
 *
 *   * `spotlight`  — the target is on this page and visible; ring it.
 *   * `navigate`   — it is not here, but one route reliably holds it.
 *   * `focus-rail` — the target is the rail itself.
 *   * `hint`       — it is not here and no single route holds it; say where to
 *                    start looking and offer a discovery surface.
 */
export type SpotlightPlan =
  | { action: 'spotlight' }
  | { action: 'navigate'; href: string }
  | { action: 'focus-rail' }
  | { action: 'hint'; href: string }

/**
 * Decide what a step-row click should do.
 *
 * `found` is a BOOLEAN, not a Document or an Element, and that is the whole
 * point: vitest runs in a node environment with no jsdom (vitest.config.ts),
 * so a function that queried the DOM itself could not be tested at all. The
 * caller does the one line of DOM work and hands the verdict here.
 */
export function planSpotlight(target: TourTarget, found: boolean): SpotlightPlan {
  if (target.kind === 'in-rail') return { action: 'focus-rail' }
  if (found) return { action: 'spotlight' }
  if (target.href !== null) return { action: 'navigate', href: target.href }
  if (target.fallbackHref !== null) return { action: 'hint', href: target.fallbackHref }
  return { action: 'focus-rail' }
}

/** Every href this module can ever send a tester to. The route-safety test walks it. */
export function targetHrefs(): string[] {
  return TOUR_STEPS.flatMap((key) => {
    const t = TOUR_STEP_TARGETS[key]
    return [t.href, t.fallbackHref].filter((h): h is string => h !== null)
  })
}
