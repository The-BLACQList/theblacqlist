// The site tour's two paths (ticket 280), as plain data. No DOM here: vitest
// runs without one, so every decision that can live here does.

import type { SiteTourChapterKey, SiteTourStepKey } from '@/lib/site-tour/copy'

export type SiteTourPath = 'shopper' | 'owner'

/** What is switched on right now. A step whose need is off doesn't show. */
export interface SiteTourContext {
  cue: boolean
  stories: boolean
  collective: boolean
  ownerReview: boolean
}

export interface SiteTourTarget {
  /** Where the step happens. `view=live` is the owner's Collective. */
  href: string
  /** Every selector listed here is lit. Order is the order of the openings. */
  selectors: readonly string[]
  /** Corner radius of the light, in px. */
  radius: number
  /** Space between the target and the light's edge, in px. */
  pad: number
  /** Parts the visitor can use while this step is up. Empty = the card only. */
  live?: readonly string[]
  /** Parts inside the live ones that stay off during the tour. */
  off?: readonly string[]
  /** The page's own scroll is the step (map, Collective): never scroll it. */
  fixed?: boolean
  /** Start the target this far below the header (default 10). */
  top?: number
  /** Where the caption sits on a wide screen. */
  caption?: 'bar' | 'side-left' | 'collective'
}

export interface SiteTourStep extends SiteTourTarget {
  key: SiteTourStepKey
  path: SiteTourPath
  chapter: SiteTourChapterKey
  /** Built but not shown: waiting on the founder (ticket 280, "Held"). */
  held?: boolean
  needs?: (ctx: SiteTourContext) => boolean
}

const BAR = '[data-site-tour="cue-field"]'
const BAR_BUTTON = '[data-site-tour="cue-button"]'
export const CUE_FORM = '[data-site-tour="cue-form"]'
export const CUE_STATUS = '[data-site-tour="cue-status"]'
export const CUE_ANSWER = '[data-site-tour="cue-answer"]'
export const CUE_INPUT = '#ai-guide-input'
export const SILO = 'section.silo'

export const SITE_TOUR_STEPS: readonly SiteTourStep[] = [
  {
    key: 'cue',
    path: 'shopper',
    chapter: 'shopper-1',
    href: '/',
    selectors: [BAR, BAR_BUTTON],
    radius: 32,
    pad: 4,
    live: [CUE_FORM, CUE_STATUS, CUE_ANSWER],
    needs: (ctx) => ctx.cue,
  },
  {
    key: 'answer',
    path: 'shopper',
    chapter: 'shopper-1',
    href: '/',
    selectors: [CUE_ANSWER],
    radius: 16,
    pad: 0,
    live: [CUE_FORM, CUE_STATUS, CUE_ANSWER],
    needs: (ctx) => ctx.cue,
  },
  {
    key: 'map',
    path: 'shopper',
    chapter: 'shopper-1',
    href: '/map',
    selectors: ['[data-tour="map"]'],
    radius: 0,
    pad: 0,
    live: ['[data-tour="map"]'],
    off: ['[aria-label="Near me, use my location"]'],
    fixed: true,
    caption: 'side-left',
  },
  {
    key: 'sample-page',
    path: 'shopper',
    chapter: 'shopper-2',
    href: '/example',
    selectors: [],
    radius: 0,
    pad: 0,
    held: true,
  },
  {
    key: 'save',
    path: 'shopper',
    chapter: 'shopper-2',
    href: '/example',
    selectors: [],
    radius: 24,
    pad: 4,
    held: true,
  },
  {
    key: 'blacqlight',
    path: 'shopper',
    chapter: 'shopper-3',
    href: '/blacqlight',
    selectors: ['[data-site-tour="blacqlight-title"]'],
    radius: 0,
    pad: 0,
    needs: (ctx) => ctx.stories,
  },
  {
    key: 'collective',
    path: 'shopper',
    chapter: 'shopper-3',
    href: '/flow-map',
    selectors: [SILO],
    radius: 2,
    pad: 0,
    fixed: true,
    caption: 'collective',
    needs: (ctx) => ctx.collective,
  },
  {
    key: 'owner-search',
    path: 'owner',
    chapter: 'owner-1',
    href: '/search',
    selectors: ['#discovery-search'],
    radius: 22,
    pad: 4,
  },
  {
    key: 'owner-sample',
    path: 'owner',
    chapter: 'owner-2',
    href: '/example',
    selectors: [],
    radius: 0,
    pad: 0,
    held: true,
  },
  {
    key: 'owner-add',
    path: 'owner',
    chapter: 'owner-2',
    href: '/for-business',
    selectors: ['[data-site-tour="owner-add"]'],
    radius: 24,
    pad: 4,
  },
  {
    key: 'owner-collective',
    path: 'owner',
    chapter: 'owner-3',
    href: '/flow-map?view=live',
    selectors: [SILO],
    radius: 2,
    pad: 0,
    fixed: true,
    caption: 'collective',
    needs: (ctx) => ctx.collective && ctx.ownerReview,
  },
  {
    key: 'owner-free',
    path: 'owner',
    chapter: 'owner-3',
    href: '/for-business',
    selectors: ['#plans-h'],
    radius: 12,
    pad: 10,
    top: 40,
  },
]

/** The last card: the bar again for shoppers, Find My Business for owners. */
export const SITE_TOUR_END_TARGET: Record<SiteTourPath, SiteTourTarget> = {
  shopper: { href: '/', selectors: [BAR, BAR_BUTTON], radius: 32, pad: 4 },
  owner: {
    href: '/for-business',
    selectors: ['[data-site-tour="owner-claim"]'],
    radius: 24,
    pad: 4,
  },
}

export function visibleSteps(path: SiteTourPath, ctx: SiteTourContext): SiteTourStep[] {
  return SITE_TOUR_STEPS.filter(
    (step) => step.path === path && !step.held && (step.needs ? step.needs(ctx) : true)
  )
}

export type SiteTourItem =
  | { kind: 'chapter'; chapter: SiteTourChapterKey; href: string }
  | { kind: 'step'; step: SiteTourStep; number: number; total: number }
  | { kind: 'end'; path: SiteTourPath; target: SiteTourTarget }

/** The whole path in order. A chapter card shows only when its chapter has a step. */
export function buildItems(path: SiteTourPath, ctx: SiteTourContext): SiteTourItem[] {
  const steps = visibleSteps(path, ctx)
  const items: SiteTourItem[] = []
  let chapter: SiteTourChapterKey | null = null
  steps.forEach((step, i) => {
    if (step.chapter !== chapter) {
      chapter = step.chapter
      items.push({ kind: 'chapter', chapter, href: step.href })
    }
    items.push({ kind: 'step', step, number: i + 1, total: steps.length })
  })
  items.push({ kind: 'end', path, target: SITE_TOUR_END_TARGET[path] })
  return items
}

/** The step before this one; -1 when the one before is the question. */
export function previousIndex(items: readonly SiteTourItem[], index: number): number {
  for (let i = index - 1; i >= 0; i--) {
    const item = items[i]
    // Cue's answer is gone once the visitor leaves the home page, so Back from
    // a later page goes to the bar, not to an empty answer.
    if (item?.kind === 'step' && item.step.key !== 'answer') return i
  }
  return -1
}

/** The step after the answer: where Next and a timed-out wait go. */
export function indexAfterAnswer(items: readonly SiteTourItem[], index: number): number {
  let next = index + 1
  const item = items[next]
  if (item?.kind === 'step' && item.step.key === 'answer') next++
  return Math.min(next, items.length - 1)
}

export function pathOf(href: string): string {
  return href.split('?')[0] ?? href
}
