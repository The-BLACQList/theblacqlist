import { describe, expect, it } from 'vitest'
import {
  EMPTY_POST_JOB,
  endOfDayEastern,
  easternToday,
  firstStepWithError,
  latestCloseDay,
  validatePostJob,
  validatePostJobStep,
  type PostJobValues,
} from '@/lib/validations/postJob'

const UUID = '3f0c2a9e-6a41-4b86-9d0e-1f2a3b4c5d6e'
const CAT = '7b1d2c3e-4f50-4a61-8b72-93a4b5c6d7e8'

const good: PostJobValues = {
  ...EMPTY_POST_JOB,
  hiringListingId: UUID,
  name: 'Line Cook',
  tagline: 'Hot line, fast kitchen, good team',
  categoryId: CAT,
  employmentType: 'full-time',
  workplaceType: 'on-site',
  salaryMin: '18',
  salaryMax: '22',
  salaryPeriod: 'hour',
  applyEmail: 'hiring@example.com',
  description: 'Run the grill station during dinner service.',
}

describe('postJobSchema', () => {
  it('accepts a complete paid role', () => {
    expect(validatePostJob(good)).toEqual({})
  })

  it('requires pay for a non-volunteer role', () => {
    const e = validatePostJob({ ...good, salaryMin: '', salaryMax: '', salaryPeriod: '' })
    expect(e.salaryMin).toBeDefined()
    expect(e.salaryMax).toBeDefined()
    expect(e.salaryPeriod).toBeDefined()
  })

  it('does not require pay for a volunteer role', () => {
    const e = validatePostJob({
      ...good,
      employmentType: 'volunteer',
      salaryMin: '',
      salaryMax: '',
      salaryPeriod: '',
    })
    expect(e).toEqual({})
  })

  it('rejects a maximum below the minimum', () => {
    expect(validatePostJob({ ...good, salaryMin: '30', salaryMax: '20' }).salaryMax).toBeDefined()
  })

  it('requires a period when a figure is given', () => {
    expect(validatePostJob({ ...good, salaryPeriod: '' }).salaryPeriod).toBeDefined()
  })

  it('requires an apply link or an email', () => {
    const e = validatePostJob({ ...good, applyEmail: '', applyUrl: '' })
    expect(e.applyUrl ?? e.applyEmail).toBeDefined()
  })

  it('accepts a link alone', () => {
    expect(validatePostJob({ ...good, applyEmail: '', applyUrl: 'https://example.com/apply' })).toEqual({})
  })

  it('rejects a non-http apply link', () => {
    expect(
      validatePostJob({ ...good, applyEmail: '', applyUrl: 'javascript:alert(1)' }).applyUrl
    ).toBeDefined()
  })

  it('rejects a closing date in the past', () => {
    expect(validatePostJob({ ...good, closesAt: '2020-01-01' }).closesAt).toBeDefined()
  })

  it('accepts today and a future closing date', () => {
    expect(validatePostJob({ ...good, closesAt: easternToday() })).toEqual({})
    expect(validatePostJob({ ...good, closesAt: latestCloseDay() })).toEqual({})
  })

  it('enforces the summary and description lengths', () => {
    expect(validatePostJob({ ...good, tagline: 'short' }).tagline).toBeDefined()
    expect(validatePostJob({ ...good, description: 'too short' }).description).toBeDefined()
    expect(validatePostJob({ ...good, description: 'x'.repeat(2001) }).description).toBeDefined()
  })

  it('has no default kind of work', () => {
    expect(validatePostJob({ ...good, employmentType: '' }).employmentType).toBeDefined()
  })
})

describe('step validation', () => {
  it('only reports the fields of the step asked about', () => {
    const empty = validatePostJobStep(EMPTY_POST_JOB, 0)
    expect(empty.name).toBeDefined()
    expect(empty.salaryMin).toBeUndefined()
    expect(empty.description).toBeUndefined()
  })

  it('finds the first step with an error', () => {
    expect(firstStepWithError({ description: 'x' })).toBe(2)
    expect(firstStepWithError({ salaryMin: 'x', name: 'y' })).toBe(0)
    expect(firstStepWithError({})).toBeNull()
  })

  it('caps the closing date at 90 days from today', () => {
    expect(validatePostJob({ ...good, closesAt: '2999-01-01' }).closesAt).toMatch(/90 days/)
    expect(latestCloseDay(new Date('2026-10-30T16:00:00Z'))).toBe('2027-01-28')
  })

  it('stores the closing day as the end of that day in Eastern time', () => {
    const iso = endOfDayEastern('2026-12-05')
    const d = new Date(iso)
    expect(d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })).toBe('2026-12-05')
  })
})
