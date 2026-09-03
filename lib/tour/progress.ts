// The rail's progress arithmetic, kept out of the component so it can be
// tested. vitest runs in a node environment with no jsdom, so anything that
// stays inside a .tsx file can only ever be checked by reading its source text.
//
// One rule dominates this file and is the reason `completedAt` is threaded
// through every function that reports completion:
//
//   ⚠ `doneCount` can legitimately read 4/6 or 5/6 while the tour IS complete.
//
// Completion is the four REFLECTION-GATED steps. `listing_opened` and
// `collection_browsed` are un-gated progress ticks that never block it, and
// `collection_browsed` is genuinely skippable. So `completedAt` is the sole
// authority on "finished" — a rail that derived it from 6-of-6 would ship
// "5/6" printed next to "Tour complete" on day one.

import { TOUR_STEPS, isReflectionGated, type TourStepKey } from './steps'

export type ProgressStatus = 'done' | 'reflect' | 'act' | 'retry'

/**
 * The minimum a step must carry for this module to reason about it. Structural
 * on purpose: the rail's own local mirror of the API payload widens `key` to
 * `string`, and this file must accept that without importing the component.
 */
export interface ProgressStep {
  key: string
  title: string
  status: ProgressStatus
}

export interface ProgressSnapshot {
  steps: readonly ProgressStep[]
  completedAt: string | null
}

/** How many steps are finished. Progress, never completion — see the header. */
export function doneCount(steps: readonly ProgressStep[]): number {
  return steps.filter((s) => s.status === 'done').length
}

/**
 * The step the rail should have expanded: the first one that is not done.
 *
 * Returns null when every step is done — the completion panel's condition is
 * `completedAt`, not this, but a null here is what tells the accordion there is
 * nothing left to expand.
 */
export function currentStepKey(steps: readonly ProgressStep[]): string | null {
  return steps.find((s) => s.status !== 'done')?.key ?? null
}

/**
 * A cheap, order-sensitive encoding of everything the rail renders differently.
 *
 * The bounded retry chain compares fingerprints to decide whether a refetch
 * learned anything, so this must change whenever ANY visible verdict changes —
 * including the completion stamp, which can arrive without a status moving.
 */
export function statusFingerprint(snapshot: ProgressSnapshot | null): string {
  if (snapshot === null) return ''
  const steps = snapshot.steps.map((s) => `${s.key}:${s.status}`).join('|')
  return `${steps}#${snapshot.completedAt ?? ''}`
}

/**
 * Steps that are un-gated, still not done, and therefore optional at the end.
 *
 * These are what the completion panel renders dimmed as "Optional — you never
 * browsed a collection" rather than as unfinished work, which is the honest
 * reading once `completedAt` is set.
 */
export function optionalUnfinishedSteps(
  snapshot: ProgressSnapshot
): readonly ProgressStep[] {
  if (snapshot.completedAt === null) return []
  return snapshot.steps.filter(
    (s) =>
      s.status !== 'done' &&
      TOUR_STEPS.includes(s.key as TourStepKey) &&
      !isReflectionGated(s.key as TourStepKey)
  )
}

/**
 * What to write into the rail's live region, or null when nothing changed that
 * a person needs told.
 *
 * Returns null on first load: a live region announces CHANGES, and a snapshot
 * with no predecessor is a starting state, not a change. (A region that mounts
 * with its content already in it is not announced anyway.)
 *
 * Order is by consequence — finishing the tour outranks finishing a step,
 * which outranks a step becoming writable — because only one string can be
 * announced per update and stacking them is how live regions get ignored.
 */
export function announceTransition(
  prev: ProgressSnapshot | null,
  next: ProgressSnapshot
): string | null {
  if (prev === null) return null

  if (prev.completedAt === null && next.completedAt !== null) {
    return 'Tour complete. You finished all four written steps — your trial is ready to claim.'
  }

  const before = new Map(prev.steps.map((s) => [s.key, s.status]))

  const newlyDone = next.steps.find(
    (s) => s.status === 'done' && before.get(s.key) !== undefined && before.get(s.key) !== 'done'
  )
  if (newlyDone) {
    const remaining = next.steps.find((s) => s.status !== 'done')
    return remaining
      ? `${newlyDone.title} — done. Next: ${remaining.title}.`
      : `${newlyDone.title} — done.`
  }

  const newlyReflect = next.steps.find(
    (s) => s.status === 'reflect' && before.get(s.key) !== undefined && before.get(s.key) !== 'reflect'
  )
  if (newlyReflect) {
    return `${newlyReflect.title} — we can see it. Write your reflection to finish the step.`
  }

  return null
}
