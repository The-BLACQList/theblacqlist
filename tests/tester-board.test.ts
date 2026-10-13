// The admin testers board rules (ticket 137).

import { describe, expect, it } from 'vitest'

import {
  QUIET_DAYS,
  daysSince,
  endWarning,
  freeMonthText,
  lastActiveAt,
  needsYou,
  needsYouReason,
  spotStatus,
  walkStates,
  type BoardEnrollment,
  type BoardStep,
} from '@/lib/tester/board'

const NOW = new Date('2026-10-13T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

function enrollment(over: Partial<BoardEnrollment> = {}): BoardEnrollment {
  return {
    is_owner: false,
    listing_id: null,
    started_at: daysAgo(1),
    completed_at: null,
    trial_granted_at: null,
    ended_at: null,
    ...over,
  }
}

const step = (
  key: BoardStep['step_key'],
  at: string,
  reflected: string | null = null
): BoardStep => ({
  step_key: key,
  completed_at: at,
  reflected_at: reflected,
})

describe('lastActiveAt', () => {
  it('is the start when there are no steps', () => {
    const e = enrollment({ started_at: daysAgo(5) })
    expect(lastActiveAt(e, [])).toBe(daysAgo(5))
  })

  it('takes the newest of steps and answers', () => {
    const e = enrollment({ started_at: daysAgo(9) })
    const steps = [step('search_ran', daysAgo(8), daysAgo(2)), step('listing_opened', daysAgo(4))]
    expect(lastActiveAt(e, steps)).toBe(daysAgo(2))
  })
})

describe('daysSince', () => {
  it('floors to whole days and never goes negative', () => {
    expect(daysSince(daysAgo(2.9), NOW)).toBe(2)
    expect(daysSince(new Date(NOW.getTime() + 60_000).toISOString(), NOW)).toBe(0)
  })
})

describe('spotStatus', () => {
  it('a new tester with no steps has just joined', () => {
    expect(spotStatus(enrollment(), [], NOW)).toEqual({
      state: 'just_joined',
      label: 'Just joined',
    })
  })

  it('a tester with recent steps is walking', () => {
    const s = spotStatus(enrollment(), [step('search_ran', daysAgo(1))], NOW)
    expect(s.state).toBe('walking')
  })

  it(`goes quiet at ${QUIET_DAYS} days without activity, and says how long`, () => {
    const e = enrollment({ started_at: daysAgo(10) })
    expect(spotStatus(e, [step('search_ran', daysAgo(QUIET_DAYS - 0.5))], NOW).state).toBe(
      'walking'
    )
    expect(spotStatus(e, [step('search_ran', daysAgo(5))], NOW)).toEqual({
      state: 'quiet',
      label: 'Quiet 5 days',
    })
  })

  it('a tester who never took a step still goes quiet', () => {
    expect(spotStatus(enrollment({ started_at: daysAgo(4) }), [], NOW).state).toBe('quiet')
  })

  it('a finished supporter is done, however long ago', () => {
    const e = enrollment({ started_at: daysAgo(20), completed_at: daysAgo(15) })
    expect(spotStatus(e, [], NOW).state).toBe('done')
  })

  it('a finished owner with an unclaimed month is waiting', () => {
    const e = enrollment({ listing_id: 'l1', completed_at: daysAgo(1) })
    expect(spotStatus(e, [], NOW).state).toBe('free_waiting')
    const noPage = enrollment({ is_owner: true, completed_at: daysAgo(1) })
    expect(spotStatus(noPage, [], NOW).state).toBe('free_waiting')
  })

  it('a claimed month reads as used', () => {
    const e = enrollment({
      listing_id: 'l1',
      completed_at: daysAgo(3),
      trial_granted_at: daysAgo(2),
    })
    expect(spotStatus(e, [], NOW).state).toBe('free_used')
  })

  it('ended wins over everything', () => {
    const e = enrollment({ listing_id: 'l1', completed_at: daysAgo(3), ended_at: daysAgo(1) })
    expect(spotStatus(e, [], NOW).state).toBe('ended')
  })
})

describe('needsYou', () => {
  it('flags quiet testers and waiting free months only', () => {
    expect(needsYou({ state: 'quiet', label: 'Quiet 4 days' })).toBe(true)
    expect(needsYou({ state: 'free_waiting', label: 'Free month waiting' })).toBe(true)
    for (const state of ['just_joined', 'walking', 'done', 'free_used', 'ended'] as const) {
      expect(needsYou({ state, label: '' })).toBe(false)
    }
  })

  it('words the chip reason', () => {
    expect(needsYouReason({ state: 'quiet', label: 'Quiet 4 days' })).toBe('quiet 4 days')
    expect(needsYouReason({ state: 'free_waiting', label: 'Free month waiting' })).toBe(
      'free month waiting'
    )
  })
})

describe('walkStates', () => {
  const steps = [step('search_ran', daysAgo(6)), step('listing_opened', daysAgo(6))]

  it('marks the first open step as stuck for a quiet tester', () => {
    const w = walkStates(steps, { state: 'quiet', label: '' })
    expect(w.search_ran).toBe('done')
    expect(w.listing_saved).toBe('stuck')
    expect(w.collection_browsed).toBe('todo')
  })

  it('marks it as next for everyone else', () => {
    expect(walkStates(steps, { state: 'walking', label: '' }).listing_saved).toBe('next')
  })

  it('marks nothing next for an ended tester', () => {
    const w = walkStates(steps, { state: 'ended', label: '' })
    expect(Object.values(w).filter((s) => s === 'next' || s === 'stuck')).toHaveLength(0)
  })
})

describe('free month copy', () => {
  it('describes each owner case and skips supporters', () => {
    expect(freeMonthText(enrollment())).toBe('Not for supporters')
    expect(freeMonthText(enrollment({ is_owner: true }))).toBe('Earned when they finish')
    expect(freeMonthText(enrollment({ is_owner: true, completed_at: daysAgo(1) }))).toBe(
      'Earned, not claimed yet'
    )
    expect(
      freeMonthText(
        enrollment({ is_owner: true, completed_at: daysAgo(2), trial_granted_at: daysAgo(1) })
      )
    ).toBe('Claimed')
  })

  it('warns before ending an owner whose month is not claimed', () => {
    expect(endWarning(enrollment())).toBeNull()
    expect(endWarning(enrollment({ listing_id: 'l1' }))).toMatch(/can no longer earn/)
    expect(endWarning(enrollment({ listing_id: 'l1', completed_at: daysAgo(1) }))).toMatch(
      /takes away their free month/
    )
    expect(
      endWarning(
        enrollment({ listing_id: 'l1', completed_at: daysAgo(2), trial_granted_at: daysAgo(1) })
      )
    ).toBeNull()
    expect(endWarning(enrollment({ listing_id: 'l1', ended_at: daysAgo(1) }))).toBeNull()
  })
})
