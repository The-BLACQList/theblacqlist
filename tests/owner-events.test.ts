import { describe, expect, it } from 'vitest'

import { EVENT_NO_END_GRACE_HOURS, isEventOver } from '@/lib/events/eventOver'
import {
  eventAllowanceLine,
  ownerEventStatusLabel,
  splitOwnerEvents,
  type OwnerEventRow,
} from '@/lib/events/ownerEvents'

// Ticket 106. The "is it over" rule is shared by the nightly sweep and the
// owner's Events tab, so an event is never "Upcoming" on the tab after the
// site has taken it down.

const NOW = new Date('2026-11-14T12:00:00Z')
const hours = (h: number) => new Date(NOW.getTime() + h * 60 * 60 * 1_000).toISOString()

describe('isEventOver', () => {
  it('is over once the end time has passed', () => {
    expect(isEventOver(hours(-5), hours(-1), NOW)).toBe(true)
    expect(isEventOver(hours(-5), hours(1), NOW)).toBe(false)
  })

  it('gives an event with no end the grace window after it starts', () => {
    expect(isEventOver(hours(-(EVENT_NO_END_GRACE_HOURS - 1)), null, NOW)).toBe(false)
    expect(isEventOver(hours(-(EVENT_NO_END_GRACE_HOURS + 1)), null, NOW)).toBe(true)
  })

  it('never calls an unknown or unreadable date over', () => {
    expect(isEventOver(null, null, NOW)).toBe(false)
    expect(isEventOver('not a date', null, NOW)).toBe(false)
    expect(isEventOver(hours(-100), 'not a date', NOW)).toBe(false)
  })
})

function row(id: string, startsAt: string | null, endsAt: string | null = null): OwnerEventRow {
  return { id, name: id, status: 'published', startsAt, endsAt, publicUrl: `/atlanta/event/${id}` }
}

describe('splitOwnerEvents', () => {
  it('puts upcoming soonest first and past latest first', () => {
    const { upcoming, past } = splitOwnerEvents(
      [
        row('next-month', hours(24 * 30)),
        row('last-week', hours(-24 * 7), hours(-24 * 7 + 3)),
        row('tomorrow', hours(24)),
        row('last-month', hours(-24 * 30), hours(-24 * 30 + 3)),
        row('running-now', hours(-2), hours(2)),
      ],
      NOW
    )

    expect(upcoming.map((r) => r.id)).toEqual(['running-now', 'tomorrow', 'next-month'])
    expect(past.map((r) => r.id)).toEqual(['last-week', 'last-month'])
  })

  it('keeps an event with no date under upcoming, where the owner can fix it', () => {
    const { upcoming, past } = splitOwnerEvents([row('no-date', null)], NOW)
    expect(upcoming).toHaveLength(1)
    expect(past).toHaveLength(0)
  })
})

describe('ownerEventStatusLabel', () => {
  it.each([
    ['published', false, 'Live'],
    ['pending', false, 'In review'],
    ['draft', false, 'Draft'],
    ['rejected', false, 'Not approved'],
    ['unpublished', true, 'Ended'],
    ['unpublished', false, 'Unpublished'],
    ['flagged', false, 'Hidden'],
  ])('%s (over: %s) reads "%s"', (status, over, label) => {
    expect(ownerEventStatusLabel(status, over)).toBe(label)
  })
})

describe('eventAllowanceLine', () => {
  it('counts what is left on a capped plan', () => {
    expect(eventAllowanceLine(3, 1)).toBe('1 of 3 active events used. 2 left.')
  })

  it('never shows a negative count for an owner over the cap', () => {
    expect(eventAllowanceLine(3, 4)).toBe('4 of 3 active events used. 0 left.')
  })

  it('says unlimited on Premium', () => {
    expect(eventAllowanceLine(null, 7)).toBe('Your plan includes unlimited events.')
  })
})
