// Anchor integrity: every selector in lib/tour/targets.ts must resolve to a
// real element in a real component.
//
// This is the highest-value file in the M4.13 set, because the failure it
// catches is SILENT. A selector that rots breaks no build, throws no error, and
// logs nothing — it produces a "Show me" button that does nothing at all when a
// tester clicks it. That is the same class of quiet failure
// tests/tester-tour-render-mode.test.ts was written for.
//
// vitest runs in a node environment with no jsdom (vitest.config.ts), so there
// is no DOM to query. Source text is the only available evidence, and it is
// enough: the question here is "does this string still exist in the file that
// is supposed to provide it", not "does it render".
//
// The list is DRIVEN BY `TOUR_STEP_TARGETS`, not hand-written, so a target
// cannot be added without an anchor entry — a hand-maintained list would drift
// out of date in exactly the direction that makes this test useless.

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { TOUR_STEP_TARGETS } from '@/lib/tour/targets'
import { TOUR_STEPS, type TourStepKey } from '@/lib/tour/steps'

function source(relPath: string): string {
  return readFileSync(path.resolve(process.cwd(), relPath), 'utf8')
}

/**
 * For each selector: the file that is supposed to provide it, and the literal
 * text that must appear there. The literal is the JSX form, not the CSS form —
 * `#review-body` is written `id="review-body"` in the component.
 */
const ANCHORS: Record<string, { file: string; literals: readonly string[]; minCount?: number }> = {
  '#discovery-search': {
    file: 'components/discovery/SearchBar.tsx',
    literals: ['id="discovery-search"'],
  },
  'section[aria-label="Discovery results"]': {
    file: 'components/discovery/DiscoveryGrid.tsx',
    literals: ['aria-label="Discovery results"'],
  },
  '[data-tour="save-listing"]': {
    file: 'components/entity-page/SaveButton.tsx',
    literals: ['data-tour="save-listing"'],
    // BOTH variants must carry it. A listing page renders the hero button, the
    // mobile quick-action bar and the desktop quick-action bar; anchoring only
    // one of them is the bug where the tour spotlights an invisible control.
    minCount: 2,
  },
  'a[href^="/collections/"]': {
    file: 'components/editorial/CollectionCard.tsx',
    literals: ['href={`/collections/${slug}`}'],
  },
  '#review-body': {
    file: 'components/entity-page/ReviewForm.tsx',
    literals: ['id="review-body"'],
  },
  '[data-tour="write-review"]': {
    // The form mounts on intent, so `#review-body` is absent until this trigger
    // is clicked. It is the only step-5 anchor a tester sees on arrival.
    file: 'components/entity-page/ReviewFormDisclosure.tsx',
    literals: ['data-tour="write-review"'],
  },
  '[data-tour="report-correction"]': {
    file: 'components/entity-page/ReportCorrectionForm.tsx',
    literals: ['data-tour="report-correction"'],
  },
}

describe('tour anchors — every selector has a provider', () => {
  const allSelectors = TOUR_STEPS.flatMap((key: TourStepKey) => [
    ...TOUR_STEP_TARGETS[key].selectors,
  ])

  it('declares an anchor for every selector the tour can use', () => {
    // Driven from the target table: adding a selector without adding its
    // anchor entry fails here rather than failing silently in a tester's face.
    const undeclared = allSelectors.filter((s) => !(s in ANCHORS))
    expect(undeclared).toEqual([])
  })

  it('declares no anchor for a selector nothing uses', () => {
    const orphaned = Object.keys(ANCHORS).filter((s) => !allSelectors.includes(s))
    expect(orphaned).toEqual([])
  })

  it.each(Object.entries(ANCHORS))('%s exists in its component', (selector, anchor) => {
    const src = source(anchor.file)
    for (const literal of anchor.literals) {
      expect(src, `${selector} → ${anchor.file}`).toContain(literal)
      if (anchor.minCount !== undefined) {
        const count = src.split(literal).length - 1
        expect(count, `${literal} occurrences in ${anchor.file}`).toBeGreaterThanOrEqual(
          anchor.minCount
        )
      }
    }
  })
})

describe('tour anchors — the collections prefix is not the index link', () => {
  it('leaves the footer collections link unmatched by the card selector', () => {
    // `a[href^="/collections/"]` requires the trailing segment. The footer
    // links `/collections` exactly, so it correctly does not match — if the
    // footer ever gained a trailing slash, step 4 would spotlight the footer.
    // The footer builds its links from a data array, so the literal is the
    // object-property form, not a JSX attribute.
    const footer = source('components/nav/public-footer.tsx')
    expect(footer).toContain("href: '/collections'")
    expect(footer).not.toContain("href: '/collections/'")
  })
})

describe('spotlight CSS — the ring must not outrank the header', () => {
  const css = source('app/globals.css')

  it('defines the spotlight class', () => {
    expect(css).toContain('.blacq-tour-spotlight')
  })

  it('does not reuse the map-pin highlight', () => {
    // `.blacq-map-highlight` also sets width/height/border-radius:50% — it is a
    // PIN. Applying it to the search input would turn the input into a gold dot.
    const block = spotlightBlock(css)
    expect(block).not.toMatch(/border-radius:\s*50%/)
    expect(block).not.toMatch(/\bwidth:\s*22px/)
  })

  it('declares no z-index and no position', () => {
    // The site header is `fixed z-50`. A spotlight that raises its target above
    // the header is the same defect as a z-50 rail, laundered through CSS — and
    // the existing z-index scan in tester-tour-rail.test.ts cannot see it,
    // because it only reads .tsx files.
    const block = spotlightBlock(css)
    expect(block).not.toMatch(/\bz-index\s*:/)
    expect(block).not.toMatch(/\bposition\s*:/)
  })

  it('uses outline, not box-shadow alone, for the ring', () => {
    // A box-shadow ring is CLIPPED by any ancestor `overflow: hidden`, and card
    // grids clip. Outlines are not clipped and cost no layout.
    expect(spotlightBlock(css)).toMatch(/\boutline\s*:/)
  })

  it('puts the pulse inside a no-preference motion query', () => {
    // The house pattern is `.blacq-reveal`: motion lives INSIDE
    // `prefers-reduced-motion: no-preference`, so the reduced variant is a
    // genuine static ring rather than an animation someone remembered to kill.
    const idx = css.indexOf('.blacq-tour-spotlight')
    expect(idx).toBeGreaterThan(-1)

    const animated = /animation\s*:\s*blacq-tour-pulse/.test(css)
    if (animated) {
      const queryIdx = css.indexOf('@media (prefers-reduced-motion: no-preference)')
      expect(queryIdx, 'no-preference query must exist when the pulse does').toBeGreaterThan(-1)
      // The animation declaration must sit after the opening of a
      // no-preference block, never in the base rule.
      const base = spotlightBlock(css)
      expect(base).not.toMatch(/animation\s*:\s*blacq-tour-pulse/)
    }
  })
})

/** The body of the base `.blacq-tour-spotlight` rule, braces excluded. */
function spotlightBlock(css: string): string {
  const start = css.indexOf('.blacq-tour-spotlight')
  if (start === -1) return ''
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}
