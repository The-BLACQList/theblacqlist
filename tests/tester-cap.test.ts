import { describe, it, expect } from 'vitest'

import { TESTER_CAP, formatTesterNumber, isTesterCapFull } from '@/lib/tester/cap'
import { SHARED_LINK_MAX_USES, parseTesterRole } from '@/lib/tester/links'

// The shared tester link (founder, 2026-10-13): 15 testers in total, a
// visible tester number, and a role each new person picks on /t.

describe('TESTER_CAP', () => {
  it('is 15, matching the trigger in 20261014000000_shared_tester_link.sql', () => {
    expect(TESTER_CAP).toBe(15)
  })

  it('caps a shared link at the same number of people', () => {
    expect(SHARED_LINK_MAX_USES).toBe(TESTER_CAP)
  })
})

describe('formatTesterNumber', () => {
  it.each([
    [1, 'Tester 01'],
    [7, 'Tester 07'],
    [15, 'Tester 15'],
    [123, 'Tester 123'],
  ])('shows %i as %s', (n, label) => {
    expect(formatTesterNumber(n)).toBe(label)
  })
})

describe('parseTesterRole', () => {
  it('accepts only the two roles, exactly', () => {
    expect(parseTesterRole('owner')).toBe('owner')
    expect(parseTesterRole('supporter')).toBe('supporter')
    for (const raw of ['', 'admin', 'Owner', ' owner', 'shared']) {
      expect(parseTesterRole(raw)).toBeNull()
    }
  })
})

describe('isTesterCapFull', () => {
  it('matches only the trigger’s P0001 tester_cap_full', () => {
    expect(isTesterCapFull({ code: 'P0001', message: 'tester_cap_full' })).toBe(true)
    expect(isTesterCapFull({ code: 'P0001', message: 'something else' })).toBe(false)
    expect(isTesterCapFull({ code: '23505', message: 'tester_cap_full' })).toBe(false)
    expect(isTesterCapFull({ code: 'P0001' })).toBe(false)
    expect(isTesterCapFull(null)).toBe(false)
  })
})
