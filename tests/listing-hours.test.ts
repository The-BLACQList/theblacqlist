import { describe, expect, it } from 'vitest'
import { parseWeeklyHours, WEEK_DAYS } from '@/lib/listings/hours'

function week(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const day of WEEK_DAYS) out[day] = { open: '09:00', close: '17:00', closed: false }
  return { ...out, ...overrides }
}

describe('parseWeeklyHours', () => {
  it('accepts a full week', () => {
    expect(parseWeeklyHours(week())?.monday).toEqual({ open: '09:00', close: '17:00', closed: false })
  })

  it('trims seconds from time inputs', () => {
    const parsed = parseWeeklyHours(week({ monday: { open: '09:00:00', close: '17:30:00', closed: false } }))
    expect(parsed?.monday).toEqual({ open: '09:00', close: '17:30', closed: false })
  })

  it('lets a closed day have empty times', () => {
    const parsed = parseWeeklyHours(week({ sunday: { open: '', close: '', closed: true } }))
    expect(parsed?.sunday).toEqual({ open: '09:00', close: '17:00', closed: true })
  })

  it('drops extra keys', () => {
    const parsed = parseWeeklyHours(week({ holiday: { open: '1', close: '2', closed: false } }))
    expect(parsed && Object.keys(parsed)).toEqual([...WEEK_DAYS])
  })

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'mon 9-5'],
    ['a missing day', (() => { const w = week(); delete w.friday; return w })()],
    ['an open day with no times', week({ monday: { open: '', close: '', closed: false } })],
    ['a bad time', week({ monday: { open: '25:00', close: '17:00', closed: false } })],
    ['closed as a string', week({ monday: { open: '09:00', close: '17:00', closed: 'false' } })],
  ])('refuses %s', (_label, value) => {
    expect(parseWeeklyHours(value)).toBeNull()
  })
})
