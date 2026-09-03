// lib/tour/progress.ts — the rail's progress arithmetic and its live-region copy.
//
// The case this file exists to pin down: `doneCount` can legitimately read 4/6
// or 5/6 while the tour IS complete, because completion is the four
// reflection-gated steps and `collection_browsed` is genuinely skippable. A
// rail that derived "finished" from 6-of-6 would print "5/6" next to "Tour
// complete" on day one.

import { describe, expect, it } from 'vitest'

import {
  announceTransition,
  currentStepKey,
  doneCount,
  optionalUnfinishedSteps,
  statusFingerprint,
  type ProgressSnapshot,
  type ProgressStatus,
  type ProgressStep,
} from '@/lib/tour/progress'
import { TOUR_STEPS, isReflectionGated } from '@/lib/tour/steps'
import { TOUR_STEP_COPY } from '@/lib/tour/verify'

/** A snapshot in the real six-step shape, with titles that match the server copy. */
function snapshot(
  statuses: Partial<Record<string, ProgressStatus>>,
  completedAt: string | null = null
): ProgressSnapshot {
  return {
    steps: TOUR_STEPS.map((key) => ({
      key,
      title: TOUR_STEP_COPY[key].title,
      status: statuses[key] ?? 'act',
    })),
    completedAt,
  }
}

const ALL_ACT = snapshot({})

describe('doneCount', () => {
  it('counts nothing on a fresh enrollment', () => {
    expect(doneCount(ALL_ACT.steps)).toBe(0)
  })

  it('counts only done, never reflect or retry', () => {
    const steps = snapshot({
      search_ran: 'done',
      listing_opened: 'done',
      listing_saved: 'reflect',
      collection_browsed: 'retry',
    }).steps
    expect(doneCount(steps)).toBe(2)
  })

  it('reads 5 of 6 while the tour is complete', () => {
    // The load-bearing case. All four gated steps are done, so the server has
    // stamped completedAt — but collection_browsed was skipped. The rail must
    // read completion off completedAt, never off this number.
    const snap = snapshot(
      {
        search_ran: 'done',
        listing_opened: 'done',
        listing_saved: 'done',
        review_or_correction: 'done',
        final_reflection: 'done',
      },
      '2026-09-02T12:00:00Z'
    )
    expect(doneCount(snap.steps)).toBe(5)
    expect(snap.completedAt).not.toBeNull()
  })

  it('can read 4 of 6 while the tour is complete', () => {
    // Both un-gated ticks missed: the tester searched from a deep link, saved
    // from a city page, and never opened a collection.
    const snap = snapshot(
      {
        search_ran: 'done',
        listing_saved: 'done',
        review_or_correction: 'done',
        final_reflection: 'done',
      },
      '2026-09-02T12:00:00Z'
    )
    expect(doneCount(snap.steps)).toBe(4)
  })
})

describe('currentStepKey', () => {
  it('is the first step on a fresh enrollment', () => {
    expect(currentStepKey(ALL_ACT.steps)).toBe('search_ran')
  })

  it('skips over done steps in order', () => {
    const steps = snapshot({ search_ran: 'done', listing_opened: 'done' }).steps
    expect(currentStepKey(steps)).toBe('listing_saved')
  })

  it('returns a reflect step — it is not done until the reflection lands', () => {
    const steps = snapshot({ search_ran: 'reflect' }).steps
    expect(currentStepKey(steps)).toBe('search_ran')
  })

  it('returns a retry step rather than skipping past a failed read', () => {
    // A read failure must never advance the accordion past the step — that
    // would hide the retry copy the tester needs to see.
    const steps = snapshot({ search_ran: 'retry' }).steps
    expect(currentStepKey(steps)).toBe('search_ran')
  })

  it('is null when every step is done', () => {
    const steps = TOUR_STEPS.map<ProgressStep>((key) => ({
      key,
      title: TOUR_STEP_COPY[key].title,
      status: 'done',
    }))
    expect(currentStepKey(steps)).toBeNull()
  })
})

describe('statusFingerprint', () => {
  it('is empty for no snapshot', () => {
    expect(statusFingerprint(null)).toBe('')
  })

  it('is stable across identical snapshots', () => {
    expect(statusFingerprint(snapshot({ search_ran: 'done' }))).toBe(
      statusFingerprint(snapshot({ search_ran: 'done' }))
    )
  })

  it('changes when any status changes', () => {
    expect(statusFingerprint(snapshot({ search_ran: 'done' }))).not.toBe(
      statusFingerprint(snapshot({ search_ran: 'reflect' }))
    )
  })

  it('changes when only completedAt arrives', () => {
    // The retry chain exits early when the fingerprint moves. A completion
    // stamp can land with no status change — the final reflection's step is
    // already `done` when the sweep runs — so it must move the fingerprint or
    // the chain keeps polling a tour that has already finished.
    const before = snapshot({ final_reflection: 'done' }, null)
    const after = snapshot({ final_reflection: 'done' }, '2026-09-02T12:00:00Z')
    expect(statusFingerprint(before)).not.toBe(statusFingerprint(after))
  })

  it('distinguishes which step moved, not just how many did', () => {
    expect(statusFingerprint(snapshot({ search_ran: 'done' }))).not.toBe(
      statusFingerprint(snapshot({ listing_opened: 'done' }))
    )
  })
})

describe('optionalUnfinishedSteps', () => {
  it('is empty while the tour is unfinished', () => {
    // Before completion nothing is "optional" — it is all still ahead of them.
    expect(optionalUnfinishedSteps(snapshot({ search_ran: 'done' }))).toEqual([])
  })

  it('names the skipped un-gated steps once the tour is complete', () => {
    const snap = snapshot(
      {
        search_ran: 'done',
        listing_opened: 'done',
        listing_saved: 'done',
        review_or_correction: 'done',
        final_reflection: 'done',
      },
      '2026-09-02T12:00:00Z'
    )
    expect(optionalUnfinishedSteps(snap).map((s) => s.key)).toEqual(['collection_browsed'])
  })

  it('never names a reflection-gated step', () => {
    // A gated step cannot be outstanding at completion — the server stamps
    // completedAt from those four. If one ever appears here, the completion
    // sweep and this module disagree, and the rail would invite a tester to
    // treat required work as optional.
    const snap = snapshot({}, '2026-09-02T12:00:00Z')
    for (const step of optionalUnfinishedSteps(snap)) {
      expect(isReflectionGated(step.key as never), step.key).toBe(false)
    }
  })

  it('ignores keys that are not tour steps', () => {
    const snap: ProgressSnapshot = {
      steps: [{ key: 'not_a_step', title: 'Nope', status: 'act' }],
      completedAt: '2026-09-02T12:00:00Z',
    }
    expect(optionalUnfinishedSteps(snap)).toEqual([])
  })
})

describe('announceTransition', () => {
  it('says nothing on first load', () => {
    // A live region announces CHANGES. A snapshot with no predecessor is a
    // starting state — and a region that mounts with content already in it is
    // not announced by screen readers anyway.
    expect(announceTransition(null, ALL_ACT)).toBeNull()
  })

  it('says nothing when nothing changed', () => {
    expect(announceTransition(ALL_ACT, snapshot({}))).toBeNull()
  })

  it('announces completion above everything else', () => {
    // Priority order is by consequence, and only one string can be announced
    // per update — stacking them is how live regions get ignored.
    const prev = snapshot({ search_ran: 'done' }, null)
    const next = snapshot(
      { search_ran: 'done', final_reflection: 'done' },
      '2026-09-02T12:00:00Z'
    )
    const message = announceTransition(prev, next)
    expect(message).toContain('Tour complete')
    expect(message).toContain('four written steps')
  })

  it('does not re-announce completion on a later refetch', () => {
    const done = snapshot({ search_ran: 'done' }, '2026-09-02T12:00:00Z')
    expect(announceTransition(done, done)).toBeNull()
  })

  it('announces a newly finished step and names what is next', () => {
    const message = announceTransition(ALL_ACT, snapshot({ search_ran: 'done' }))
    expect(message).toBe(
      `${TOUR_STEP_COPY.search_ran.title} — done. Next: ${TOUR_STEP_COPY.listing_opened.title}.`
    )
  })

  it('drops the "next" clause when nothing is left', () => {
    const prev = snapshot({
      search_ran: 'done',
      listing_opened: 'done',
      listing_saved: 'done',
      collection_browsed: 'done',
      review_or_correction: 'done',
    })
    const next = snapshot({
      search_ran: 'done',
      listing_opened: 'done',
      listing_saved: 'done',
      collection_browsed: 'done',
      review_or_correction: 'done',
      final_reflection: 'done',
    })
    expect(announceTransition(prev, next)).toBe(
      `${TOUR_STEP_COPY.final_reflection.title} — done.`
    )
  })

  it('announces a step becoming writable, and never tells them to redo it', () => {
    // `reflect` means the evidence is already in — the tester did the thing.
    // Copy that reads like an instruction to go do it again is exactly the
    // class of lie verify.ts's `retry` strings exist to prevent.
    const message = announceTransition(ALL_ACT, snapshot({ search_ran: 'reflect' }))
    expect(message).toContain('we can see it')
    expect(message).toContain('Write your reflection')
  })

  it('prefers a newly done step over a newly reflect one', () => {
    const next = snapshot({ search_ran: 'done', listing_saved: 'reflect' })
    const message = announceTransition(ALL_ACT, next)
    expect(message).toContain('done')
    expect(message).not.toContain('Write your reflection')
  })

  it('says nothing about a step the previous snapshot had never heard of', () => {
    // A step that appears mid-session is a payload shape change, not something
    // the tester just accomplished — announcing it would be a false claim.
    const prev: ProgressSnapshot = {
      steps: [{ key: 'search_ran', title: 'Run a real search', status: 'act' }],
      completedAt: null,
    }
    const next: ProgressSnapshot = {
      steps: [
        { key: 'search_ran', title: 'Run a real search', status: 'act' },
        { key: 'listing_opened', title: 'Open a listing', status: 'done' },
      ],
      completedAt: null,
    }
    expect(announceTransition(prev, next)).toBeNull()
  })

  it('never announces a step going backwards', () => {
    // A read failure moves a step from `done` to `retry`. That is a
    // measurement problem, not progress, and must stay silent.
    const prev = snapshot({ search_ran: 'done' })
    const next = snapshot({ search_ran: 'retry' })
    expect(announceTransition(prev, next)).toBeNull()
  })
})
