// lib/tour/targets.ts — the record of WHERE each Tester Tour step's evidence
// lives, and the pure decision that drives a step-row click.
//
// vitest runs in a node environment with no jsdom, so none of this can be
// checked by rendering. That is precisely why `planSpotlight` takes a boolean
// rather than a Document: the DOM query stays in the component, and every
// branch that decides what happens next is provable here.

import { describe, expect, it } from 'vitest'

import {
  TOUR_STEP_TARGETS,
  evidenceStepKeys,
  planSpotlight,
  targetHrefs,
  type TourTarget,
} from '@/lib/tour/targets'
import { TOUR_STEPS, type TourStepKey } from '@/lib/tour/steps'
import { isHiddenPath } from '@/lib/tour/routes'
import { TOUR_STEP_COPY } from '@/lib/tour/verify'

describe('TOUR_STEP_TARGETS — completeness', () => {
  it('covers every tour step, and nothing else', () => {
    expect(Object.keys(TOUR_STEP_TARGETS).sort()).toEqual([...TOUR_STEPS].sort())
  })

  it.each(TOUR_STEPS)('%s has a non-empty hint', (key) => {
    expect(TOUR_STEP_TARGETS[key].hint.trim().length).toBeGreaterThan(0)
  })

  it('gives every page-kind target at least one selector', () => {
    for (const key of TOUR_STEPS) {
      const target = TOUR_STEP_TARGETS[key]
      if (target.kind === 'in-rail') continue
      expect(target.selectors.length, key).toBeGreaterThan(0)
    }
  })

  it('gives the in-rail step no selectors and nowhere to navigate', () => {
    const target = TOUR_STEP_TARGETS.final_reflection
    expect(target.kind).toBe('in-rail')
    expect(target.selectors).toEqual([])
    expect(target.href).toBeNull()
    expect(target.fallbackHref).toBeNull()
  })
})

describe('TOUR_STEP_TARGETS — routes', () => {
  it('never points a tester at a route the rail hides itself on', () => {
    // A tour that navigates to /admin or /sign-in unmounts its own rail on
    // arrival, leaving the tester on a page with no way back into the walk.
    for (const href of targetHrefs()) {
      expect(isHiddenPath(href), href).toBe(false)
    }
  })

  it('uses absolute in-app paths, never external or relative ones', () => {
    for (const href of targetHrefs()) {
      expect(href.startsWith('/'), href).toBe(true)
      expect(href.startsWith('//'), href).toBe(false)
    }
  })

  it('never sends a tester to their own enrolled listing', () => {
    // The tour-state payload's only URL-ish field is `listingId` — the
    // tester's OWN listing — and three steps require one that is not theirs.
    // Every fallback must therefore be a discovery surface.
    const listingScoped = TOUR_STEPS.map((k) => TOUR_STEP_TARGETS[k]).filter(
      (t) => t.kind === 'listing-scoped'
    )
    expect(listingScoped.length).toBeGreaterThan(0)
    for (const target of listingScoped) {
      expect(target.href).toBeNull()
      expect(target.fallbackHref).toBe('/discover')
    }
  })
})

describe('TOUR_STEP_TARGETS — the copy boundary', () => {
  // `step.message` (server, from TOUR_STEP_COPY) says what to do and why;
  // `target.hint` (client) says where the thing is. verify.ts imports
  // @/lib/supabase/server, so it is a server module by dependency and its copy
  // cannot move here. If the two ever say the same thing, one of them will
  // eventually be reworded and they will contradict each other in front of a
  // real tester.
  const hints = TOUR_STEPS.map((k) => TOUR_STEP_TARGETS[k].hint)
  const serverCopy = TOUR_STEPS.flatMap((k) => {
    const copy = TOUR_STEP_COPY[k]
    return [copy.title, copy.action, copy.retry, copy.prompt].filter(
      (s): s is string => typeof s === 'string'
    )
  })

  it('shares no string with TOUR_STEP_COPY', () => {
    const overlap = hints.filter((h) => serverCopy.includes(h))
    expect(overlap).toEqual([])
  })

  it('gives every step a distinct hint', () => {
    expect(new Set(hints).size).toBe(hints.length)
  })
})

describe('TOUR_STEP_TARGETS — selector order', () => {
  it('tries #review-body before the correction trigger', () => {
    // Both live on a listing page, and the correction trigger renders ABOVE
    // the reviews section. A comma-joined selector resolves in DOCUMENT order,
    // not list order, so it would always land on the wrong one — the ordered
    // list is the fix, and this asserts the order that makes it work.
    //
    // Asserted by RELATIVE position, not by index: M4.14 added
    // `[data-tour="write-review"]` between the two because the review form now
    // mounts on intent, and a rung added in the middle must not fail a test
    // whose real subject is "the review path outranks the correction link".
    const { selectors } = TOUR_STEP_TARGETS.review_or_correction
    expect(selectors[0]).toBe('#review-body')
    expect(selectors.indexOf('[data-tour="write-review"]')).toBeGreaterThan(0)
    expect(selectors.indexOf('[data-tour="report-correction"]')).toBe(selectors.length - 1)
    expect(selectors.indexOf('[data-tour="write-review"]')).toBeLessThan(
      selectors.indexOf('[data-tour="report-correction"]')
    )
  })

  it('matches collection cards by prefix, so the footer index link does not match', () => {
    // The footer links `/collections` exactly. `a[href^="/collections/"]`
    // requires the trailing segment, so only real collection cards match.
    const selector = TOUR_STEP_TARGETS.collection_browsed.selectors[0]
    expect(selector).toBe('a[href^="/collections/"]')
  })
})

describe('planSpotlight', () => {
  const page: TourTarget = {
    kind: 'page',
    selectors: ['#x'],
    href: '/search',
    fallbackHref: '/search',
    hint: 'somewhere',
  }
  const listingScoped: TourTarget = {
    kind: 'listing-scoped',
    selectors: ['[data-tour="save-listing"]'],
    href: null,
    fallbackHref: '/discover',
    hint: 'somewhere',
  }
  const inRail: TourTarget = {
    kind: 'in-rail',
    selectors: [],
    href: null,
    fallbackHref: null,
    hint: 'here',
  }

  it('spotlights when the target is on this page', () => {
    expect(planSpotlight(page, true)).toEqual({ action: 'spotlight' })
    expect(planSpotlight(listingScoped, true)).toEqual({ action: 'spotlight' })
  })

  it('navigates when a single route reliably holds the target', () => {
    expect(planSpotlight(page, false)).toEqual({ action: 'navigate', href: '/search' })
  })

  it('hints rather than navigating when the tester must pick the page', () => {
    // There is no single listing to send them to — which listing they save is
    // their choice, and it must not be their own.
    expect(planSpotlight(listingScoped, false)).toEqual({ action: 'hint', href: '/discover' })
  })

  it('focuses the rail for the in-rail step, found or not', () => {
    expect(planSpotlight(inRail, true)).toEqual({ action: 'focus-rail' })
    expect(planSpotlight(inRail, false)).toEqual({ action: 'focus-rail' })
  })

  it('never returns navigate or hint without an href', () => {
    for (const key of TOUR_STEPS) {
      for (const found of [true, false]) {
        const plan = planSpotlight(TOUR_STEP_TARGETS[key], found)
        if (plan.action === 'navigate' || plan.action === 'hint') {
          expect(typeof plan.href, `${key}/${found}`).toBe('string')
          expect(plan.href.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('produces a plan for every step in both DOM states', () => {
    const actions = new Set<string>()
    for (const key of TOUR_STEPS as readonly TourStepKey[]) {
      for (const found of [true, false]) {
        actions.add(planSpotlight(TOUR_STEP_TARGETS[key], found).action)
      }
    }
    // All four branches are reachable from the real target table — a plan
    // shape nothing can produce is dead code pretending to be coverage.
    expect(actions).toEqual(new Set(['spotlight', 'navigate', 'hint', 'focus-rail']))
  })
})

describe('evidenceStepKeys', () => {
  it('maps a Save tap to the save step only', () => {
    expect(evidenceStepKeys((sel) => sel === '[data-tour="save-listing"]')).toEqual([
      'listing_saved',
    ])
  })

  it('maps the review field to the review step', () => {
    expect(evidenceStepKeys((sel) => sel === '#review-body')).toEqual(['review_or_correction'])
  })

  it('returns nothing when no target is touched', () => {
    expect(evidenceStepKeys(() => false)).toEqual([])
  })

  it('treats a throwing selector check as not touched', () => {
    expect(
      evidenceStepKeys(() => {
        throw new Error('bad selector')
      })
    ).toEqual([])
  })
})
