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
  parseLastListing,
  revisitButton,
  targetHrefs,
  travelButton,
  travelHref,
  type LastListing,
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

  it.each(TOUR_STEPS)('%s has a short travel-button label', (key) => {
    // The label is a button, the hint is helper text: a sentence here wraps to
    // three lines on a phone. The in-rail step has nowhere to travel, so no label.
    const { go, kind } = TOUR_STEP_TARGETS[key]
    if (kind === 'in-rail') {
      expect(go).toBeUndefined()
      return
    }
    expect(go?.trim().length).toBeGreaterThan(0)
    expect(go?.length).toBeLessThanOrEqual(20)
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

  it('keeps the numbered guides off the server copy too', () => {
    // The guide is the "where" side of the split, same as the hint.
    const guides = TOUR_STEPS.flatMap((k) => [...(TOUR_STEP_TARGETS[k].guide ?? [])])
    expect(guides.length).toBeGreaterThan(0)
    expect(guides.filter((g) => serverCopy.includes(g))).toEqual([])
  })

  it('guides the two steps testers stalled on, in short lines', () => {
    for (const key of ['listing_saved', 'review_or_correction'] as const) {
      const guide = TOUR_STEP_TARGETS[key].guide ?? []
      expect(guide.length, key).toBeGreaterThanOrEqual(3)
      for (const line of guide) {
        expect(line.trim().length, line).toBeGreaterThan(0)
        expect(line.length, line).toBeLessThanOrEqual(80)
        // Site copy voice: no em dashes.
        expect(line, line).not.toContain('\u2014')
      }
    }
  })
})

describe('TOUR_STEP_TARGETS — selector order', () => {
  it('tries the star rating first and the correction trigger last', () => {
    // Testers said they "didn't notice the rating scale until after I wrote
    // my review": the spotlight landed on #review-body, which sits BELOW the
    // stars, and scrolled them past the rating. The rating fieldset now leads.
    //
    // The correction trigger renders ABOVE the reviews section. A comma-joined
    // selector resolves in DOCUMENT order, not list order, so it would always
    // land on the wrong one. The ordered list is the fix.
    //
    // #review-body must stay in the list: evidence detection reads a submitted
    // form with `form.querySelector(selector)`, and the review form is found
    // by its text box.
    const { selectors } = TOUR_STEP_TARGETS.review_or_correction
    expect(selectors[0]).toBe('[data-tour="review-rating"]')
    expect(selectors.indexOf('#review-body')).toBeGreaterThan(0)
    expect(selectors.indexOf('#review-body')).toBeLessThan(
      selectors.indexOf('[data-tour="write-review"]')
    )
    expect(selectors.indexOf('[data-tour="report-correction"]')).toBe(selectors.length - 1)
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
    go: 'Go',
    hint: 'somewhere',
  }
  const listingScoped: TourTarget = {
    kind: 'listing-scoped',
    selectors: ['[data-tour="save-listing"]'],
    href: null,
    fallbackHref: '/discover',
    go: 'Go',
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

describe('travelHref', () => {
  const step5 = TOUR_STEP_TARGETS.review_or_correction

  it('offers no trip on a listing page that holds the review box', () => {
    // The founder's 2026-10-01 bug: on a listing page the row must offer
    // "Show me", never "Find a listing" back to Discover.
    expect(travelHref(planSpotlight(step5, true))).toBeNull()
  })

  it('offers Discover when the review box is not on the page', () => {
    expect(travelHref(planSpotlight(step5, false))).toBe('/discover')
  })

  it('offers no trip for the in-rail step', () => {
    expect(travelHref(planSpotlight(TOUR_STEP_TARGETS.final_reflection, false))).toBeNull()
  })

  it('offers the page route for a page-kind step that is elsewhere', () => {
    expect(travelHref(planSpotlight(TOUR_STEP_TARGETS.search_ran, false))).toBe('/search')
  })
})

describe('parseLastListing', () => {
  const ok = { id: 'abc', name: 'Sweet Auburn Bread', href: '/atlanta-ga/business/sweet-auburn' }

  it('reads a well-formed record', () => {
    expect(parseLastListing(JSON.stringify(ok))).toEqual(ok)
  })

  it.each([
    ['null', null],
    ['empty', ''],
    ['not JSON', '{nope'],
    ['an array', '[]'],
    ['no id', JSON.stringify({ ...ok, id: '' })],
    ['no name', JSON.stringify({ ...ok, name: '' })],
    ['a number for a name', JSON.stringify({ ...ok, name: 4 })],
    ['an external href', JSON.stringify({ ...ok, href: 'https://evil.example' })],
    ['a protocol-relative href', JSON.stringify({ ...ok, href: '//evil.example/x' })],
    ['a backslash href', JSON.stringify({ ...ok, href: '/\\evil.example' })],
  ])('rejects %s', (_label, raw) => {
    expect(parseLastListing(raw as string | null)).toBeNull()
  })
})

describe('travelButton', () => {
  const step3 = TOUR_STEP_TARGETS.listing_saved
  const last: LastListing = {
    id: 'other',
    name: 'Sweet Auburn Bread',
    href: '/atlanta-ga/business/sweet-auburn',
  }

  it('offers nothing when there is nowhere to go', () => {
    expect(travelButton(step3, null, { last, ownListingId: null, pathname: '/search' })).toBeNull()
  })

  it('offers the last listing back by name', () => {
    expect(
      travelButton(step3, '/discover', { last, ownListingId: 'mine', pathname: '/search' })
    ).toEqual({ href: last.href, label: 'Back to Sweet Auburn Bread' })
  })

  it('keeps Discover when nothing is remembered', () => {
    expect(
      travelButton(step3, '/discover', { last: null, ownListingId: null, pathname: '/search' })
    ).toEqual({ href: '/discover', label: step3.go })
  })

  it('never sends a tester back to their own listing', () => {
    expect(
      travelButton(step3, '/discover', { last, ownListingId: 'other', pathname: '/search' })
    ).toEqual({ href: '/discover', label: step3.go })
  })

  it('does not offer the page the tester is already on', () => {
    expect(
      travelButton(step3, '/discover', { last, ownListingId: null, pathname: last.href })
    ).toEqual({ href: '/discover', label: step3.go })
  })

  it('trims a long name so the button stays one line', () => {
    const long = { ...last, name: 'The Very Long Name Of A Family Restaurant' }
    const trip = travelButton(step3, '/discover', { last: long, ownListingId: null, pathname: '/' })
    expect(trip?.label.endsWith('\u2026')).toBe(true)
    expect(trip?.label.length).toBeLessThanOrEqual('Back to '.length + 25)
  })

  it('ignores the remembered listing for a page-kind step', () => {
    const search = TOUR_STEP_TARGETS.search_ran
    expect(travelButton(search, '/search', { last, ownListingId: null, pathname: '/' })).toEqual({
      href: '/search',
      label: search.go,
    })
  })
})

// Founder, 2026-10-15: "for browse a collection we need a button that
// navigates to collections." The button vanished once the step was done.
describe('revisitButton', () => {
  const collections = TOUR_STEP_TARGETS.collection_browsed

  it('a finished collection step offers the trip back to /collections', () => {
    expect(revisitButton(collections, '/')).toEqual({
      href: '/collections',
      label: 'Go to collections',
    })
    expect(revisitButton(collections, '/collections/some-slug')).toEqual({
      href: '/collections',
      label: 'Go to collections',
    })
  })

  it('offers nothing on the page the tester is already on', () => {
    expect(revisitButton(collections, '/collections')).toBeNull()
  })

  it('every page step offers its own trip, and no other kind does', () => {
    for (const key of TOUR_STEPS) {
      const target = TOUR_STEP_TARGETS[key]
      const button = revisitButton(target, '/somewhere-else')
      if (target.kind === 'page') {
        expect(button).toEqual({ href: target.href, label: target.go })
      } else {
        expect(button).toBeNull()
      }
    }
  })
})
