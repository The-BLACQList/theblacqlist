// =============================================================================
// "I shopped here" (ticket 162): the prefill parser and the button's rule
// =============================================================================
// The `?listing=` id arrives in a URL anyone can edit, so anything that isn't a
// single plain UUID must prefill nothing. The button shows only to signed-in
// readers, only while The Collective is open, and never on an event or a job.
// =============================================================================

import { describe, expect, it } from 'vitest'

import { parseListingParam, showShoppedHere } from '@/lib/spend/receipt-prefill'
import { localIsoDay, receiptDateBounds } from '@/lib/spend/receipt-input'

const ID = '22222222-2222-4222-8222-222222222222'

describe('parseListingParam', () => {
  it('accepts a listing id', () => {
    expect(parseListingParam(ID)).toBe(ID)
  })

  it('lowercases an uppercase id', () => {
    expect(parseListingParam(ID.toUpperCase())).toBe(ID)
  })

  it('trims stray whitespace', () => {
    expect(parseListingParam(`  ${ID} `)).toBe(ID)
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['garbage', 'not-an-id'],
    ['an id with extra text', `${ID}x`],
    ['an injection attempt', `${ID}' or 1=1`],
  ])('prefills nothing when %s', (_label, value) => {
    expect(parseListingParam(value)).toBeNull()
  })

  it('prefills nothing for a repeated param', () => {
    expect(parseListingParam([ID, ID])).toBeNull()
  })
})

describe('showShoppedHere', () => {
  const open = { signedIn: true, entityType: 'business', collectiveOpen: true }

  it('shows for a signed-in reader on a business while The Collective is open', () => {
    expect(showShoppedHere(open)).toBe(true)
  })

  it('hides when signed out', () => {
    expect(showShoppedHere({ ...open, signedIn: false })).toBe(false)
  })

  it('hides while The Collective is covered', () => {
    expect(showShoppedHere({ ...open, collectiveOpen: false })).toBe(false)
  })

  it.each(['event', 'job'])('hides on a %s', (entityType) => {
    expect(showShoppedHere({ ...open, entityType })).toBe(false)
  })

  it.each(['creator', 'organization'])('shows on a %s', (entityType) => {
    expect(showShoppedHere({ ...open, entityType })).toBe(true)
  })
})

describe('the form date window', () => {
  it('runs from 90 days ago to today', () => {
    expect(receiptDateBounds('2026-10-31')).toEqual({ min: '2026-08-02', max: '2026-10-31' })
  })

  it('crosses a year boundary', () => {
    expect(receiptDateBounds('2027-01-15')).toEqual({ min: '2026-10-17', max: '2027-01-15' })
  })

  it('uses the device day, not the UTC day', () => {
    // 11:30 pm local on Oct 31 stays Oct 31 whatever the offset.
    expect(localIsoDay(new Date(2026, 9, 31, 23, 30))).toBe('2026-10-31')
  })
})
