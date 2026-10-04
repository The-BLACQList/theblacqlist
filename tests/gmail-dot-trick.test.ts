// Gmail dot trick filter (2026-10-04). Shapes mirror the bot rows removed from
// the waitlist that day, rebuilt from their pattern, not copied from real
// addresses.

import { describe, it, expect } from 'vitest'

import { isGmailDotTrick } from '@/lib/security/gmail-dot-trick'

describe('isGmailDotTrick', () => {
  it.each([
    'a.bc.d.ef12@gmail.com',
    'ab.c.de.f.g1.23@gmail.com',
    'a.b.c.d.e.f.g.h.i12@gmail.com',
    'abc.def.ghi.jk12@googlemail.com',
    'a.b.c.d+news@gmail.com',
    'abcdef1.2@gmail.com',
    'A.B.C.D12@GMAIL.COM',
  ])('rejects %s', (email) => {
    expect(isGmailDotTrick(email)).toBe(true)
  })

  it.each([
    'firstlast@gmail.com',
    'first.last@gmail.com',
    'first.m.last@gmail.com',
    'first.last92@gmail.com',
    'first.last.92@gmail.com',
    'first.last+a.b.c.d@gmail.com',
    'a.b.c.d.e@example.com',
    'h.name@company.test',
    'not-an-email',
  ])('allows %s', (email) => {
    expect(isGmailDotTrick(email)).toBe(false)
  })
})
