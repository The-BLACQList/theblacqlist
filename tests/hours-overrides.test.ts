import { describe, expect, it } from 'vitest'
import {
  formatOverrideDate,
  futureDateKey,
  localDateKey,
  overrideDayHours,
  overrideFor,
  sortOverrides,
  upcomingOverrides,
} from '@/lib/listings/hoursOverrides'
import { isOpenNow } from '@/lib/listings/openStatus'
import type { DayHours, HoursOverride, WeeklyHours } from '@/types'

// Fri 13 Nov 2026, 10:00 local — inside the weekday hours below.
const NOW = new Date(2026, 10, 13, 10, 0)
const WEEKDAY: DayHours = { open: '09:00', close: '17:00', closed: false }
const CLOSED: DayHours = { open: '00:00', close: '00:00', closed: true }
const HOURS: WeeklyHours = {
  monday: WEEKDAY,
  tuesday: WEEKDAY,
  wednesday: WEEKDAY,
  thursday: WEEKDAY,
  friday: WEEKDAY,
  saturday: CLOSED,
  sunday: CLOSED,
}

const closedToday: HoursOverride = {
  date: '2026-11-13',
  closed: true,
  open: null,
  close: null,
  label: 'Staff holiday',
}
const lateToday: HoursOverride = {
  date: '2026-11-13',
  closed: false,
  open: '07:00',
  close: '21:00',
  label: null,
}
const nextWeek: HoursOverride = { ...closedToday, date: '2026-11-20', label: 'Private event' }

describe('date keys', () => {
  it('pads month and day', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('rolls over months and years', () => {
    expect(futureDateKey(new Date(2026, 10, 25), 7)).toBe('2026-12-02')
    expect(futureDateKey(new Date(2026, 11, 30), 3)).toBe('2027-01-02')
    expect(futureDateKey(NOW, 0)).toBe(localDateKey(NOW))
  })
})

describe('overrideFor', () => {
  it('finds today’s override and ignores other days', () => {
    expect(overrideFor([nextWeek, closedToday], NOW)).toBe(closedToday)
    expect(overrideFor([nextWeek], NOW)).toBeNull()
  })
  it('is null with nothing to read', () => {
    expect(overrideFor(undefined, NOW)).toBeNull()
    expect(overrideFor([], NOW)).toBeNull()
  })
})

describe('upcomingOverrides', () => {
  const yesterday: HoursOverride = { ...closedToday, date: '2026-11-12' }
  const edge: HoursOverride = { ...closedToday, date: futureDateKey(NOW, 30) }
  const beyond: HoursOverride = { ...closedToday, date: futureDateKey(NOW, 31) }

  it('keeps today through 30 days ahead, soonest first', () => {
    expect(upcomingOverrides([beyond, edge, nextWeek, yesterday, closedToday], NOW)).toEqual([
      closedToday,
      nextWeek,
      edge,
    ])
  })
  it('honours a different window and an empty input', () => {
    expect(upcomingOverrides([nextWeek, closedToday], NOW, 3)).toEqual([closedToday])
    expect(upcomingOverrides(undefined, NOW)).toEqual([])
  })
  it('does not mutate the input', () => {
    const input = [nextWeek, closedToday]
    sortOverrides(input)
    expect(input).toEqual([nextWeek, closedToday])
  })
})

describe('overrideDayHours', () => {
  it('closed wins, open needs both times', () => {
    expect(overrideDayHours(closedToday)).toEqual(CLOSED)
    expect(overrideDayHours(lateToday)).toEqual({ open: '07:00', close: '21:00', closed: false })
    expect(overrideDayHours({ ...lateToday, close: null })).toBeNull()
  })
})

describe('formatOverrideDate', () => {
  it('reads as a short weekday and date, never shifted by the zone', () => {
    expect(formatOverrideDate('2026-11-26')).toBe('Thu, Nov 26')
    expect(formatOverrideDate('2027-01-01')).toBe('Fri, Jan 1')
  })
})

describe('isOpenNow with overrides', () => {
  it('reads the weekly hours as before when there are none', () => {
    expect(isOpenNow(HOURS, undefined, NOW)).toEqual({ open: true, label: 'Open · Closes 5:00 PM' })
    expect(isOpenNow(HOURS, [], NOW)).toEqual({ open: true, label: 'Open · Closes 5:00 PM' })
  })
  it('a closed override wins over the weekly hours and names the reason', () => {
    expect(isOpenNow(HOURS, [closedToday], NOW)).toEqual({
      open: false,
      label: 'Closed today · Staff holiday',
    })
    expect(isOpenNow(HOURS, [{ ...closedToday, label: null }], NOW)).toEqual({
      open: false,
      label: 'Closed today',
    })
  })
  it('an open override replaces the day’s times', () => {
    expect(isOpenNow(HOURS, [lateToday], NOW)).toEqual({
      open: true,
      label: 'Open · Closes 9:00 PM',
    })
    const early = new Date(2026, 10, 13, 6, 30)
    expect(isOpenNow(HOURS, [lateToday], early)).toEqual({
      open: false,
      label: 'Closed · Opens 7:00 AM',
    })
  })
  it('an override on another day changes nothing today', () => {
    expect(isOpenNow(HOURS, [nextWeek], NOW)).toEqual({
      open: true,
      label: 'Open · Closes 5:00 PM',
    })
  })
  it('an open override with no times falls back to the week', () => {
    expect(isOpenNow(HOURS, [{ ...lateToday, open: null }], NOW)).toEqual({
      open: true,
      label: 'Open · Closes 5:00 PM',
    })
  })
})
