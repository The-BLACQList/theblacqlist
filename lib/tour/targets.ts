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
  /** Short button text for the trip to `href`/`fallbackHref`. The hint is the helper text beside it. */
  go?: string
  /**
   * Numbered, find-it-on-the-page steps that replace `hint` in the open row.
   *
   * Only steps 3 and 5 have one. Testers stalled on exactly those two
   * (2026-10-14 notes): both need a listing the tester picks, an action on
   * that page, and then a trip BACK to the rail to write the note, and a
   * single helper sentence could not carry three moves. Still WHERE, not WHY:
   * the copy-boundary test covers these strings too.
   */
  guide?: readonly string[]
}

export const TOUR_STEP_TARGETS: Record<TourStepKey, TourTarget> = {
  search_ran: {
    kind: 'page',
    selectors: ['#discovery-search'],
    href: '/search',
    fallbackHref: '/search',
    go: 'Go to search',
    hint: 'The search field sits at the top of the discovery page.',
  },
  listing_opened: {
    kind: 'page',
    // The results grid is a <section>, not a control, so the spotlight gives it
    // a temporary tabIndex and takes it back on cleanup.
    selectors: ['section[aria-label="Discovery results"]'],
    href: '/discover',
    fallbackHref: '/discover',
    go: 'Go to Discover',
    hint: 'Listing cards fill the results grid below the filters.',
  },
  listing_saved: {
    kind: 'listing-scoped',
    selectors: ['[data-tour="save-listing"]'],
    href: null,
    fallbackHref: '/discover',
    go: 'Find a listing',
    hint: 'The Save control sits beside the name at the top of any listing page, and on every result card.',
    guide: [
      'Open a listing you’d actually visit.',
      'Tap Save, beside the business name.',
      'Come back to this panel and write one line about why.',
    ],
  },
  map_opened: {
    kind: 'page',
    selectors: ['[data-tour="map"]'],
    href: '/map',
    fallbackHref: '/map',
    go: 'Open the map',
    hint: 'Map sits in the main menu at the top of every page.',
  },
  collection_browsed: {
    kind: 'page',
    // Prefix match, not exact: the footer's own link is `/collections` with no
    // trailing segment and correctly does not match.
    selectors: ['a[href^="/collections/"]'],
    href: '/collections',
    fallbackHref: '/collections',
    go: 'Go to collections',
    hint: 'Collection cards are on the collections index.',
  },
  review_or_correction: {
    kind: 'listing-scoped',
    // ⚠ ORDER MATTERS. The correction trigger renders ABOVE the reviews
    // section on a listing page, so a comma-joined selector — which resolves
    // in document order, not list order — would always land on the wrong one.
    //
    // The rating comes FIRST. It sits above the review box, and testers
    // reported finding the stars only after they had written the review
    // (2026-10-14): ringing `#review-body` scrolled them straight past the
    // required field. `#review-body` stays in the list because the submit
    // listener (useTourState) finds the review form by it.
    //
    // `[data-tour="write-review"]` is the trigger rung because the review form
    // mounts on intent: neither the rating nor `#review-body` exists until the
    // form is open, so with it closed the trigger is what the tour must ring.
    // Dropping it would leave step 5 spotlighting the correction link on every
    // listing page a tester had not already opened the form on.
    selectors: [
      '[data-tour="review-rating"]',
      '#review-body',
      '[data-tour="write-review"]',
      '[data-tour="report-correction"]',
    ],
    href: null,
    fallbackHref: '/discover',
    go: 'Find a listing',
    hint: 'The review box is near the bottom of a listing page; the correction link sits above it.',
    guide: [
      'Open a listing you know.',
      'Scroll to Reviews. Pick your stars first, then add a few words.',
      'Or tap Report a correction if something looks out of date.',
      'Come back to this panel and write one line about it.',
    ],
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

/**
 * Where the row's travel button should go for a plan, or null for no button.
 *
 * A row asks this TWICE in its life, not once: when the tester opens it, and
 * again every time the page changes under it. The rail lives in the root
 * layout, so an open row survives navigation. Answering only on open was the
 * step-5 bug: open the row on Discover, tap into a listing, and the row still
 * said "Find a listing" and sent the tester back to Discover from the very page
 * that holds the review box.
 */
export function travelHref(plan: SpotlightPlan): string | null {
  return plan.action === 'navigate' || plan.action === 'hint' ? plan.href : null
}

/**
 * Which steps an interaction could count toward, given a way to test whether it
 * touched a selector.
 *
 * Takes a predicate rather than an Event for the same reason `planSpotlight`
 * takes a boolean: vitest has no DOM here. The caller does the `closest` or
 * `querySelector` work and this decides what it means.
 */
export function evidenceStepKeys(touches: (selector: string) => boolean): TourStepKey[] {
  return TOUR_STEPS.filter((key) =>
    TOUR_STEP_TARGETS[key].selectors.some((selector) => {
      try {
        return touches(selector)
      } catch {
        return false
      }
    })
  )
}

/** sessionStorage key for the last listing page this tab visited. */
export const LAST_LISTING_KEY = 'blacq-tour-last-listing'

/** The last listing page the tester was on, so a row can offer the trip back. */
export interface LastListing {
  id: string
  name: string
  href: string
}

/** Longest listing name the travel button prints before it trims. */
const MAX_BUTTON_NAME = 24

/**
 * Read a stored last-listing value, or null for anything malformed.
 *
 * sessionStorage is writable by any script on the origin, so the href is held
 * to the same rule the route-safety test holds every target to: an in-app
 * absolute path, never `//host` or an external URL.
 */
export function parseLastListing(raw: string | null): LastListing | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { id, name, href } = value as Record<string, unknown>
    if (typeof id !== 'string' || typeof name !== 'string' || typeof href !== 'string') {
      return null
    }
    if (id.length === 0 || name.trim().length === 0) return null
    if (!href.startsWith('/') || href.startsWith('//') || href.includes('\\')) return null
    return { id, name: name.trim(), href }
  } catch {
    return null
  }
}

/**
 * The travel button a row offers: where it goes and what it says.
 *
 * For a listing-scoped step the best destination is the listing the tester was
 * just on, not Discover. "Find a listing" sent a tester who had a page in mind
 * back to a grid of 400 to pick a different one, and one stalled there for
 * good. The trip back is offered only when it can count: never to the
 * tester's own listing (steps 3 and 5 need one that is not theirs) and never
 * to the page they are already on.
 *
 * Still a button the tester taps. D-T3 holds: nothing here navigates.
 */
export function travelButton(
  target: TourTarget,
  href: string | null,
  ctx: { last: LastListing | null; ownListingId: string | null; pathname: string }
): { href: string; label: string } | null {
  if (href === null) return null
  const { last, ownListingId, pathname } = ctx
  if (
    target.kind === 'listing-scoped' &&
    last !== null &&
    last.id !== ownListingId &&
    last.href !== pathname
  ) {
    const name =
      last.name.length > MAX_BUTTON_NAME
        ? `${last.name.slice(0, MAX_BUTTON_NAME - 1).trimEnd()}…`
        : last.name
    return { href: last.href, label: `Back to ${name}` }
  }
  return { href, label: target.go ?? 'Go' }
}

/**
 * The trip a FINISHED step still offers, or null.
 *
 * A done row used to drop its button with the rest of its to-do content, so a
 * tester who had browsed a collection had no way back to the collections from
 * the rail (founder, 2026-10-15). Only page steps get one: they have a single
 * route that holds the thing. A listing-scoped step has no such route, and its
 * note, not a trip, is what a tester comes back for. Never offered on the page
 * the tester is already on.
 *
 * Still a button the tester taps. D-T3 holds: nothing here navigates.
 */
export function revisitButton(
  target: TourTarget,
  pathname: string
): { href: string; label: string } | null {
  if (target.kind !== 'page' || target.href === null || target.go === undefined) return null
  if (target.href === pathname) return null
  return { href: target.href, label: target.go }
}

/** Every href this module can ever send a tester to. The route-safety test walks it. */
export function targetHrefs(): string[] {
  return TOUR_STEPS.flatMap((key) => {
    const t = TOUR_STEP_TARGETS[key]
    return [t.href, t.fallbackHref].filter((h): h is string => h !== null)
  })
}
