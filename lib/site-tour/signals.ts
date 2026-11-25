// How the home bar and the site tour talk (ticket 280): window events, so
// neither imports the other and the bar works the same with the tour off.

import type { SiteTourStart } from '@/lib/site-tour/state'

export const CUE_ASKED = 'blq:cue-asked'
export const CUE_ANSWERED = 'blq:cue-answered'
export const CUE_STOPPED = 'blq:cue-stopped'
/** Cancelable: preventDefault keeps the visitor here instead of going to /search. */
export const CUE_FALLBACK = 'blq:cue-fallback'
/** The tour asking the bar to do something. */
export const CUE_COMMAND = 'blq:cue-command'
export const SITE_TOUR_START = 'blq:site-tour:start'

export type CueCommand = { type: 'stop' } | { type: 'ask'; words: string }

/** Returns false when a listener called preventDefault. */
export function signal(name: string, detail?: unknown, cancelable = false): boolean {
  if (typeof window === 'undefined') return true
  return window.dispatchEvent(new CustomEvent(name, { detail, cancelable }))
}

export function sendCueCommand(command: CueCommand): void {
  signal(CUE_COMMAND, command)
}

export function requestSiteTour(start: SiteTourStart): void {
  signal(SITE_TOUR_START, { start })
}
