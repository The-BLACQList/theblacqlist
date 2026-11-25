// The site tour's decisions (ticket 280): which steps show, when it opens on
// its own, what it remembers, where the light goes, what the CSV counts.

import { describe, expect, it } from 'vitest'

import { ANALYTICS_EVENTS, VALID_EVENT_NAMES } from '@/lib/analytics/constants'
import {
  collectiveBody,
  SITE_TOUR_ANSWERS,
  SITE_TOUR_BUTTONS,
  SITE_TOUR_CHAPTERS,
  SITE_TOUR_COPY,
  SITE_TOUR_END,
  SITE_TOUR_OPENING,
  SITE_TOUR_QUESTION,
  SITE_TOUR_QUIT_NOTE,
  SITE_TOUR_WAIT,
} from '@/lib/site-tour/copy'
import { captionMode, clip, lightPath, mapRoom, scrollFor, union } from '@/lib/site-tour/layout'
import { siteTourTotals } from '@/lib/site-tour/report'
import { countsAsVisit, isSiteTourHiddenPath } from '@/lib/site-tour/routes'
import {
  canRetake,
  decideOpening,
  earliest,
  readMemory,
  readRun,
  SITE_TOUR_KEY,
  SITE_TOUR_RUN_KEY,
  writeMemory,
  writeRun,
} from '@/lib/site-tour/state'
import {
  buildItems,
  indexAfterAnswer,
  indexOfKey,
  itemKey,
  mapStepFits,
  nextIndex,
  previousIndex,
  visibleSteps,
  type SiteTourContext,
} from '@/lib/site-tour/steps'

const ON: SiteTourContext = { cue: true, stories: true, collective: true, ownerReview: true }
const OFF: SiteTourContext = { cue: false, stories: false, collective: false, ownerReview: false }
const TALL = { width: 390, height: 844 }
const keys = (path: 'shopper' | 'owner', ctx: SiteTourContext) =>
  visibleSteps(path, ctx).map((step) => step.key)

function store(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}
const broken = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

describe('paths', () => {
  it('shows the five shopper steps and the four owner steps when everything is on', () => {
    expect(keys('shopper', ON)).toEqual(['cue', 'answer', 'map', 'blacqlight', 'collective'])
    expect(keys('owner', ON)).toEqual([
      'owner-search',
      'owner-add',
      'owner-collective',
      'owner-free',
    ])
  })

  it('leaves out what is switched off', () => {
    expect(keys('shopper', OFF)).toEqual(['map'])
    expect(keys('owner', OFF)).toEqual(['owner-search', 'owner-add', 'owner-free'])
    expect(keys('shopper', { ...ON, stories: false })).not.toContain('blacqlight')
  })

  it('needs both The Collective and owner receipt review for the owner step', () => {
    expect(keys('owner', { ...ON, ownerReview: false })).not.toContain('owner-collective')
    expect(keys('owner', { ...ON, collective: false })).not.toContain('owner-collective')
  })

  it.each(['shopper', 'owner'] as const)('%s: held steps never show', (path) => {
    for (const step of visibleSteps(path, ON)) expect(step.held).not.toBe(true)
  })

  it('opens a chapter only when it has a step, and ends with the end card', () => {
    const shapes = buildItems('shopper', { ...OFF, cue: true }).map((item) => item.kind)
    expect(shapes).toEqual(['chapter', 'step', 'step', 'step', 'end'])
    const chapters = buildItems('shopper', ON).flatMap((i) =>
      i.kind === 'chapter' ? [i.chapter] : []
    )
    expect(chapters).toEqual(['shopper-1', 'shopper-3'])
  })

  it('counts only the steps that show', () => {
    const counts = buildItems('owner', OFF).flatMap((i) =>
      i.kind === 'step' ? [`${i.number} of ${i.total}`] : []
    )
    expect(counts).toEqual(['1 of 3', '2 of 3', '3 of 3'])
  })

  it('goes Back over chapters and over the answer, and to the question from the first step', () => {
    const items = buildItems('shopper', ON)
    const at = (key: string) => items.findIndex((i) => i.kind === 'step' && i.step.key === key)
    expect(previousIndex(items, at('cue'), TALL)).toBe(-1)
    expect(previousIndex(items, at('map'), TALL)).toBe(at('cue'))
    expect(previousIndex(items, at('blacqlight'), TALL)).toBe(at('map'))
  })

  it('skips the answer after a stop or a timeout', () => {
    const items = buildItems('shopper', ON)
    const cue = items.findIndex((i) => i.kind === 'step' && i.step.key === 'cue')
    const next = items[indexAfterAnswer(items, cue, TALL)]
    expect(next?.kind === 'step' && next.step.key).toBe('map')
  })

  it('leaves the map step out, both ways, where too little map shows (DR-023)', () => {
    const items = buildItems('shopper', ON)
    const sideways = { width: 844, height: 390 }
    const at = (key: string) => indexOfKey(items, key)
    expect(itemKey(items[nextIndex(items, at('answer'), TALL)])).toBe('map')
    // On to the next chapter; the numbers keep the gap.
    expect(nextIndex(items, at('answer'), sideways)).toBe(at('map') + 1)
    expect(itemKey(items[indexAfterAnswer(items, at('cue'), sideways)])).not.toBe('map')
    expect(previousIndex(items, at('blacqlight'), sideways)).toBe(at('cue'))
    expect(items.find((i) => itemKey(i) === 'blacqlight')).toMatchObject({ number: 4 })
  })

  it('leaves a chapter card out with its only step', () => {
    const items = buildItems('shopper', { ...ON, cue: false })
    expect(itemKey(items[0])).toBe('shopper-1')
    expect(nextIndex(items, -1, TALL)).toBe(0)
    expect(nextIndex(items, -1, { width: 667, height: 375 })).toBe(indexOfKey(items, 'map') + 1)
  })

  it.each([
    [1440, 900, true],
    [390, 844, true],
    [390, 664, true],
    [360, 560, true],
    [844, 390, false],
    [667, 375, false],
    [320, 256, false],
    [195, 422, false],
  ])('the map step in %i by %i: %s', (width, height, fits) => {
    expect(mapStepFits({ width, height })).toBe(fits)
  })

  it('turns the map light on at 52px and off below 44px', () => {
    expect(mapRoom(51, false)).toBe(false)
    expect(mapRoom(52, false)).toBe(true)
    expect(mapRoom(44, true)).toBe(true)
    expect(mapRoom(43, true)).toBe(false)
  })
})

describe('when it opens', () => {
  const at = (pathname: string, memory: object = {}, accountSeenAt: string | null = null) =>
    decideOpening({ memory, accountSeenAt, pathname })

  it('opens on its own only on a first landing at home or For Business', () => {
    expect(at('/')).toBe('welcome')
    expect(at('/for-business')).toBe('welcome')
    expect(at('/search')).toBe('prompt')
    expect(at('/blacqbook/some-place')).toBe('prompt')
  })

  it('never opens over a visitor who landed deeper and then went home', () => {
    expect(at('/', { firstPath: '/search' })).toBe('prompt')
  })

  it('stays quiet once shown, ended, finished, or known to the account', () => {
    const date = '2026-11-24T00:00:00.000Z'
    expect(at('/', { seenAt: date })).toBe('none')
    expect(at('/', { endedAt: date })).toBe('none')
    expect(at('/', { completedAt: date })).toBe('none')
    expect(at('/', {}, date)).toBe('none')
  })

  it('stays quiet when storage is off, since it could never remember the answer', () => {
    expect(decideOpening({ memory: null, accountSeenAt: null, pathname: '/' })).toBe('none')
  })

  it.each([
    '/admin',
    '/admin/listings',
    '/sign-in',
    '/sign-up',
    '/onboarding',
    '/account',
    '/account/settings',
    '/dashboard',
    '/claim/abc',
    '/add-business',
    '/t/token',
  ])('never shows on %s', (path) => {
    expect(isSiteTourHiddenPath(path)).toBe(true)
  })

  it.each(['/', '/for-business', '/search', '/map', '/blacqlight', '/flow-map', '/example'])(
    'may show on %s',
    (path) => {
      expect(isSiteTourHiddenPath(path)).toBe(false)
    }
  )

  it('does not let the coming-soon page use up the first visit', () => {
    expect(countsAsVisit('/coming-soon')).toBe(false)
    expect(countsAsVisit('/sign-in')).toBe(true)
  })
})

describe('what it remembers', () => {
  it('survives storage that throws', () => {
    expect(readMemory(broken)).toBeNull()
    expect(writeMemory({ seenAt: '2026-11-24' }, broken)).toBe(false)
    expect(readRun(broken)).toBeNull()
    expect(() => writeRun({ path: 'owner', key: 'owner-add', start: 'home' }, broken)).not.toThrow()
  })

  it('adds to what is there instead of replacing it', () => {
    const s = store()
    writeMemory({ firstPath: '/' }, s)
    writeMemory({ seenAt: '2026-11-24T00:00:00.000Z' }, s)
    expect(readMemory(s)).toMatchObject({ firstPath: '/', seenAt: '2026-11-24T00:00:00.000Z' })
  })

  it('ignores junk', () => {
    expect(readMemory(store({ [SITE_TOUR_KEY]: '{' }))).toBeNull()
    expect(readMemory(store({ [SITE_TOUR_KEY]: '{"seenAt":5,"endedAt":"x"}' }))).toEqual({})
    expect(readRun(store({ [SITE_TOUR_RUN_KEY]: '{"path":"x","key":"map"}' }))).toBeNull()
    expect(readRun(store({ [SITE_TOUR_RUN_KEY]: '{"path":"owner","key":3}' }))).toBeNull()
  })

  it('keeps a run so a reload can resume it, and forgets it when told', () => {
    const s = store()
    writeRun({ path: 'owner', key: 'owner-free', start: 'footer' }, s)
    expect(readRun(s)).toEqual({ path: 'owner', key: 'owner-free', start: 'footer' })
    writeRun(null, s)
    expect(readRun(s)).toBeNull()
  })

  it('offers Take the Tour for 30 days from the first visit', () => {
    const seen = '2026-11-01T00:00:00.000Z'
    const day = (n: number) => Date.parse(seen) + n * 86_400_000
    expect(canRetake(seen, day(29))).toBe(true)
    expect(canRetake(seen, day(30))).toBe(false)
    expect(canRetake(null, day(0))).toBe(false)
    expect(canRetake('nonsense', day(0))).toBe(false)
  })

  it('keeps the earlier of two dates', () => {
    expect(earliest('2026-11-02', '2026-11-01')).toBe('2026-11-01')
    expect(earliest(null, '2026-11-01')).toBe('2026-11-01')
    expect(earliest('2026-11-01', 'nonsense')).toBe('2026-11-01')
    expect(earliest(undefined, null)).toBeNull()
  })
})

describe('where things go', () => {
  it('uses the sheet on phones, narrow tablets and short windows', () => {
    expect(captionMode('bar', 1440, 900, false)).toBe('bar')
    expect(captionMode('bar', 390, 844, false)).toBe('sheet')
    expect(captionMode('bar', 900, 900, false)).toBe('sheet')
    expect(captionMode('bar', 1440, 599, false)).toBe('sheet')
    expect(captionMode('collective', 1440, 799, false)).toBe('sheet')
    expect(captionMode('collective', 1440, 900, false)).toBe('collective')
    expect(captionMode('bar', 1440, 700, true)).toBe('sheet')
  })

  it('leaves a target that already fits where it is', () => {
    const fits = { x: 0, y: 200, w: 100, h: 50 }
    expect(scrollFor({ target: fits, scrollY: 40, headerBottom: 64, captionTop: 700 })).toBe(40)
  })

  it('brings a hidden target clear of the header and the caption', () => {
    const base = { scrollY: 500, headerBottom: 64, captionTop: 700 }
    const above = { x: 0, y: -100, w: 100, h: 50 }
    expect(scrollFor({ ...base, target: above })).toBe(500 - 100 - 74)
    const below = { x: 0, y: 900, w: 100, h: 50 }
    expect(scrollFor({ ...base, target: below })).toBe(500 + 950 - 688)
    const tall = { x: 0, y: 900, w: 100, h: 2000 }
    expect(scrollFor({ ...base, target: tall })).toBe(500 + 900 - 74)
  })

  it('squares a corner the clear area cuts, and draws nothing outside it', () => {
    const area = { x: 0, y: 0, w: 100, h: 100 }
    expect(lightPath({ x: 200, y: 0, w: 50, h: 50, r: 8 }, area)).toBe('')
    expect(lightPath({ x: 10, y: 10, w: 50, h: 50, r: 8 }, area)).toContain('A8 8')
    expect(lightPath({ x: 10, y: 10, w: 50, h: 200, r: 8 }, area)).toContain('A0 0')
    expect(clip({ x: 90, y: 90, w: 50, h: 50 }, area)).toEqual({ x: 90, y: 90, w: 10, h: 10 })
    expect(union([])).toBeNull()
  })
})

describe('the CSV', () => {
  const row = (event_name: string, properties: unknown, created_at = '2026-11-24T05:00:00Z') => ({
    event_name,
    created_at,
    properties,
  })

  it('counts by day, event, path, start, step and button', () => {
    const viewed = row('site_tour_step_viewed', { path: 'owner', step: 'owner-add', start: 'home' })
    expect(siteTourTotals([viewed, viewed])).toEqual([
      '2026-11-24,site_tour_step_viewed,owner,home,owner-add,,2',
    ])
  })

  it('lets nothing through that is not on its own list', () => {
    expect(
      siteTourTotals([
        row('site_tour_cta', { path: '=HYPERLINK("x")', cta: 'a,b', start: 7, step: null }),
        row('listing_viewed', {}),
        row('site_tour_shown', null),
      ])
    ).toEqual(['2026-11-24,site_tour_cta,,,,,1', '2026-11-24,site_tour_shown,,,,,1'])
  })

  it('has every event on the list the endpoint accepts', () => {
    const names = Object.values(ANALYTICS_EVENTS).filter((name) => name.startsWith('site_tour_'))
    expect(names).toHaveLength(7)
    for (const name of names) expect(VALID_EVENT_NAMES.has(name)).toBe(true)
  })
})

describe('the words', () => {
  const steps = Object.values(SITE_TOUR_COPY) as { title: string; body: string; note?: string }[]
  const bodies = [
    ...steps.flatMap((s) => [s.body, s.note ?? '']),
    SITE_TOUR_WAIT.body,
    ...Object.values(SITE_TOUR_END).map((e) => e.body),
    ...Object.values(SITE_TOUR_QUIT_NOTE),
    ...(['shopper', 'owner'] as const).flatMap((p) => [collectiveBody(p, true), collectiveBody(p, false)]),
  ]
  const titles = [
    SITE_TOUR_OPENING,
    ...steps.map((s) => s.title),
    SITE_TOUR_WAIT.title,
    ...Object.values(SITE_TOUR_CHAPTERS).map((c) => c.title),
    ...Object.values(SITE_TOUR_END).flatMap((e) => [e.title, e.go.label, e.other.label]),
    ...Object.values(SITE_TOUR_BUTTONS),
    ...Object.values(SITE_TOUR_ANSWERS),
  ]
  const all = [...bodies, ...titles, SITE_TOUR_QUESTION]

  it('always says The BLACQList', () => {
    for (const text of all) expect(text.replace(/The BLACQList/g, '')).not.toContain('BLACQList')
  })

  it('never says verified, marketplace, Shop, The Cart or drafts', () => {
    for (const text of all) {
      expect(text).not.toMatch(/\bverified\b|marketplace|\bShop\b|The Cart|\bdrafts?\b/i)
    }
  })

  it('uses Title Case for titles and buttons', () => {
    const small = /^(a|an|the|to|of|in|for|on|and|or|with|at|it)$/
    for (const text of titles) {
      for (const word of text.split(/[\s·]+/).filter(Boolean)) {
        if (small.test(word)) continue
        expect(word[0], `${word} in "${text}"`).toBe(word[0]?.toUpperCase())
      }
    }
  })

  it('never names Cue to an owner', () => {
    const owner = [
      ...visibleSteps('owner', ON).flatMap((s) => [SITE_TOUR_COPY[s.key].title, SITE_TOUR_COPY[s.key].body]),
      SITE_TOUR_END.owner.title,
      SITE_TOUR_END.owner.body,
      collectiveBody('owner', true),
      collectiveBody('owner', false),
    ]
    for (const text of owner) expect(text).not.toMatch(/\bCue\b/)
  })
})
