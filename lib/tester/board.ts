// The rules behind the admin testers board (ticket 137): what each spot says,
// who needs the founder today, and where a quiet tester stopped. Pure and free
// of server imports so the unit tests can pin every case.

import { TOUR_STEPS, type TourStepKey } from '@/lib/tour/steps'

/**
 * A live tester who hasn't finished and hasn't touched the tour for this many
 * days is "quiet". The founder didn't pick a number in the 2026-10-13
 * workshop, so the mockup's 3 stands.
 */
export const QUIET_DAYS = 3

const DAY_MS = 24 * 60 * 60 * 1000

export interface BoardEnrollment {
  is_owner: boolean
  listing_id: string | null
  started_at: string
  completed_at: string | null
  trial_granted_at: string | null
  ended_at: string | null
}

export interface BoardStep {
  step_key: TourStepKey
  completed_at: string
  reflected_at: string | null
}

export type SpotState =
  | 'just_joined'
  | 'walking'
  | 'quiet'
  | 'done'
  | 'free_waiting'
  | 'free_used'
  | 'ended'

export interface SpotStatus {
  state: SpotState
  label: string
}

export type WalkState = 'done' | 'stuck' | 'next' | 'todo'

/** An owner tester has a page on the enrollment, or said they own a business. */
export function isOwnerTester(e: Pick<BoardEnrollment, 'is_owner' | 'listing_id'>): boolean {
  return e.is_owner || e.listing_id !== null
}

/** The newest moment we saw them: joining, any step, or any answer. */
export function lastActiveAt(e: Pick<BoardEnrollment, 'started_at'>, steps: BoardStep[]): string {
  let latest = e.started_at
  for (const s of steps) {
    if (s.completed_at > latest) latest = s.completed_at
    if (s.reflected_at && s.reflected_at > latest) latest = s.reflected_at
  }
  return latest
}

/** Whole days between `iso` and `now`, never negative. */
export function daysSince(iso: string, now: Date): number {
  const ms = now.getTime() - new Date(iso).getTime()
  return ms <= 0 ? 0 : Math.floor(ms / DAY_MS)
}

export function spotStatus(e: BoardEnrollment, steps: BoardStep[], now: Date): SpotStatus {
  if (e.ended_at) return { state: 'ended', label: 'Ended' }
  if (e.trial_granted_at) return { state: 'free_used', label: 'Free month used' }
  if (e.completed_at) {
    return isOwnerTester(e)
      ? { state: 'free_waiting', label: 'Free month waiting' }
      : { state: 'done', label: 'Done' }
  }
  const idle = daysSince(lastActiveAt(e, steps), now)
  if (idle >= QUIET_DAYS) return { state: 'quiet', label: `Quiet ${idle} days` }
  if (steps.length === 0) return { state: 'just_joined', label: 'Just joined' }
  return { state: 'walking', label: 'Walking' }
}

/** Quiet testers and finished owners with an unclaimed month. */
export function needsYou(status: SpotStatus): boolean {
  return status.state === 'quiet' || status.state === 'free_waiting'
}

/** What the Needs you chip says after "Tester 07 · ". */
export function needsYouReason(status: SpotStatus): string {
  return status.state === 'free_waiting' ? 'free month waiting' : status.label.toLowerCase()
}

/**
 * Each tour step in order. The first step not done is where a quiet
 * tester is stuck, or simply next for everyone else.
 */
export function walkStates(steps: BoardStep[], status: SpotStatus): Record<TourStepKey, WalkState> {
  const done = new Set(steps.map((s) => s.step_key))
  let marked = false
  const out = {} as Record<TourStepKey, WalkState>
  for (const key of TOUR_STEPS) {
    if (done.has(key)) {
      out[key] = 'done'
    } else if (!marked && status.state !== 'ended') {
      out[key] = status.state === 'quiet' ? 'stuck' : 'next'
      marked = true
    } else {
      out[key] = 'todo'
    }
  }
  return out
}

export function freeMonthText(e: BoardEnrollment): string {
  if (!isOwnerTester(e)) return 'Not for supporters'
  if (e.trial_granted_at) return 'Claimed'
  if (e.completed_at) return 'Earned, not claimed yet'
  return 'Earned when they finish'
}

/**
 * The line shown before ending an owner whose month isn't claimed. Ending
 * closes an unclaimed free month for good (lib/tour/freeMonth.ts).
 */
export function endWarning(e: BoardEnrollment): string | null {
  if (e.ended_at || !isOwnerTester(e) || e.trial_granted_at) return null
  return e.completed_at
    ? 'Ending now takes away their free month. They have not claimed it yet.'
    : 'Ending now means they can no longer earn their free month.'
}

// What the page hands the board. Plain data, so it crosses into the client
// component as props. Dates arrive already formatted on the server so the
// browser's time zone can't make the first render disagree with the server's.

export interface BoardWalkStep {
  key: TourStepKey
  title: string
  state: WalkState
  prompt: string | null
  answer: string | null
  answeredText: string | null
}

export interface BoardTester {
  id: string
  number: number
  /** "Tester 07" */
  label: string
  email: string | null
  owner: boolean
  pageName: string | null
  pageHref: string | null
  joinedText: string
  lastActiveText: string
  status: SpotStatus
  freeMonth: string
  endWarning: string | null
  endedText: string | null
  walk: BoardWalkStep[]
}
