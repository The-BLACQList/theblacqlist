// Anchor integrity for the site tour (ticket 280): every selector the tour can
// light, keep live or switch off must still exist in the component that is
// supposed to provide it. A selector that rots is silent: the step comes up
// with nothing lit. Same idea as tests/tester-tour-anchors.test.ts, driven by
// the step table so a target can't be added without an anchor.

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { CUE_INPUT, SILO, SITE_TOUR_END_TARGET, SITE_TOUR_STEPS } from '@/lib/site-tour/steps'

function source(relPath: string): string {
  return readFileSync(path.resolve(process.cwd(), relPath), 'utf8')
}

const ANCHORS: Record<string, { file: string; literals: readonly string[] }> = {
  '[data-site-tour="cue-field"]': {
    file: 'components/home/AiGuide.tsx',
    literals: ["data-site-tour={assistant ? 'cue-field' : undefined}"],
  },
  '[data-site-tour="cue-button"]': {
    file: 'components/home/AiGuide.tsx',
    literals: ["data-site-tour={assistant ? 'cue-button' : undefined}"],
  },
  '[data-site-tour="cue-form"]': {
    file: 'components/home/AiGuide.tsx',
    literals: ["data-site-tour={assistant ? 'cue-form' : undefined}"],
  },
  '[data-site-tour="cue-status"]': {
    file: 'components/home/AiGuide.tsx',
    literals: ["data-site-tour={assistant ? 'cue-status' : undefined}"],
  },
  '[data-site-tour="cue-answer"]': {
    file: 'components/home/AiGuide.tsx',
    literals: ["data-site-tour={assistant ? 'cue-answer' : undefined}"],
  },
  [CUE_INPUT]: { file: 'components/home/AiGuide.tsx', literals: ['id="ai-guide-input"'] },
  '[data-tour="map"]': {
    file: 'components/map/MapExplore.tsx',
    literals: ['data-tour="map"'],
  },
  '[aria-label="Near me, use my location"]': {
    // The phone bar and the round control: both, whichever the screen shows.
    file: 'components/map/MapControls.tsx',
    literals: ['aria-label="Near me, use my location"'],
  },
  '[data-site-tour="blacqlight-title"]': {
    file: 'app/(public)/blacqlight/(index)/page.tsx',
    literals: ['data-site-tour="blacqlight-title"'],
  },
  [SILO]: {
    file: 'components/flow-map/silo/SiloExperience.tsx',
    literals: ['className={`silo${'],
  },
  '#discovery-search': {
    file: 'components/discovery/SearchBar.tsx',
    literals: ['id="discovery-search"'],
  },
  '[data-site-tour="owner-claim"]': {
    file: 'app/(public)/for-business/page.tsx',
    literals: ["data-site-tour={tour ? 'owner-claim' : undefined}"],
  },
  '[data-site-tour="owner-add"]': {
    file: 'app/(public)/for-business/page.tsx',
    literals: ["data-site-tour={tour ? 'owner-add' : undefined}"],
  },
  '#plans-h': { file: 'app/(public)/for-business/page.tsx', literals: ['id="plans-h"'] },
}

describe('site tour anchors', () => {
  const targets = [...SITE_TOUR_STEPS.filter((s) => !s.held), ...Object.values(SITE_TOUR_END_TARGET)]
  const used = new Set([
    CUE_INPUT,
    ...targets.flatMap((t) => [...t.selectors, ...(t.live ?? []), ...(t.off ?? [])]),
  ])

  it('declares an anchor for every selector the tour uses', () => {
    expect([...used].filter((s) => !(s in ANCHORS))).toEqual([])
  })

  it('declares no anchor for a selector nothing uses', () => {
    expect(Object.keys(ANCHORS).filter((s) => !used.has(s))).toEqual([])
  })

  it.each(Object.entries(ANCHORS))('%s exists in its component', (selector, anchor) => {
    const src = source(anchor.file)
    for (const literal of anchor.literals) {
      expect(src, `${selector} in ${anchor.file}`).toContain(literal)
    }
  })

  it('gives the phone map bar the same Near Me name, so both go off', () => {
    expect(source('components/map/MapPhoneBar.tsx')).toContain(
      'aria-label="Near me, use my location"'
    )
  })

  it('lights something on every step that shows', () => {
    for (const target of targets) expect(target.selectors.length).toBeGreaterThan(0)
  })
})

describe('what the tour reads inside The Collective', () => {
  const stage = source('components/flow-map/silo/SiloExperience.tsx')
  const tour = source('components/site-tour/SiteTour.tsx')

  it('the opening still puts its state on the section', () => {
    expect(stage).toContain('` intro-${intro}`')
    expect(tour).toContain("['intro-wait', 'intro-play', 'intro-skip']")
  })

  it('the Demo / Live switch and the figures are still where the tour looks', () => {
    expect(stage).toContain('className="silo-view"')
    expect(stage).toContain('className="switch" role="group" aria-label="Map data"')
    expect(stage).toContain('<dl className="kpis">')
  })
})

describe('the tour follows the Cue answer', () => {
  it('Keep Chatting carries its hook', () => {
    expect(source('components/home/AiGuide.tsx')).toContain('data-site-tour="keep-chatting"')
  })

  it('the bar sends every signal the tour listens for', () => {
    const bar = source('components/home/AiGuide.tsx')
    for (const name of ['CUE_ASKED', 'CUE_ANSWERED', 'CUE_STOPPED', 'CUE_FALLBACK', 'CUE_COMMAND']) {
      expect(bar).toContain(name)
    }
  })
})

describe('motion', () => {
  it('holds every tour animation and transition behind no-preference', () => {
    const css = source('app/globals.css')
    const start = css.indexOf('.blq-tour-')
    const rules = css.slice(start)
    // Blank out the no-preference blocks, then look for what is left.
    let rest = ''
    let i = 0
    const marker = '@media (prefers-reduced-motion: no-preference)'
    while (i < rules.length) {
      const at = rules.indexOf(marker, i)
      if (at === -1) {
        rest += rules.slice(i)
        break
      }
      rest += rules.slice(i, at)
      let depth = 0
      let j = rules.indexOf('{', at)
      for (; j < rules.length; j++) {
        if (rules[j] === '{') depth++
        if (rules[j] === '}' && --depth === 0) break
      }
      i = j + 1
    }
    const moving = rest
      .split('}')
      .filter((rule) => rule.includes('.blq-tour-'))
      .filter((rule) => /\b(animation|transition)\s*:/.test(rule.split('{').pop() ?? ''))
      .filter((rule) => !/\b(animation|transition)\s*:\s*none/.test(rule))
    expect(moving).toEqual([])
  })
})
