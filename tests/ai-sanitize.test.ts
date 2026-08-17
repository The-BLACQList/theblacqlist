// =============================================================================
// AI prompt sanitization and output validation
// =============================================================================
// These two functions are the only thing standing between owner-typed text and
// a prompt, and between model text and an owner's live page. Everything else in
// lib/ai/ is orchestration around them.
//
// The contact-detail patterns are deliberately loose (see lib/ai/sanitize.ts):
// a false positive costs one refused generation the owner can retry, a false
// negative publishes someone's phone number. The tests below assert that
// direction of error, not symmetry.
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  MAX_DESCRIPTION_CHARS,
  MAX_OUTPUT_CHARS,
  stripHtml,
  redactContactPatterns,
  sanitizeForPrompt,
  validateOutput,
  rejectionCode,
} from '@/lib/ai/sanitize'

describe('stripHtml', () => {
  it('removes tags and keeps the text between them', () => {
    expect(stripHtml('<p>Hello <strong>world</strong></p>')).toContain('Hello')
    expect(stripHtml('<p>Hello <strong>world</strong></p>')).not.toContain('<')
  })

  it('does not leave a script body in the output', () => {
    const out = stripHtml('<script>alert("x")</script>Real copy')
    expect(out).not.toContain('alert')
    expect(out).toContain('Real copy')
  })
})

describe('redactContactPatterns', () => {
  it('redacts an email address', () => {
    expect(redactContactPatterns('Reach me at owner@example.com today')).not.toContain(
      'owner@example.com'
    )
  })

  it('redacts a phone number written with separators', () => {
    const out = redactContactPatterns('Call (313) 555-0142 for a booking')
    expect(out).not.toContain('555-0142')
  })

  it('leaves ordinary copy untouched', () => {
    const clean = 'We have been braiding hair in Detroit since 2011.'
    expect(redactContactPatterns(clean)).toBe(clean)
  })
})

describe('sanitizeForPrompt', () => {
  it('returns an empty string for null and undefined', () => {
    expect(sanitizeForPrompt(null, MAX_DESCRIPTION_CHARS)).toBe('')
    expect(sanitizeForPrompt(undefined, MAX_DESCRIPTION_CHARS)).toBe('')
  })

  it('truncates to the limit', () => {
    const long = 'a'.repeat(MAX_DESCRIPTION_CHARS + 500)
    expect(sanitizeForPrompt(long, MAX_DESCRIPTION_CHARS).length).toBeLessThanOrEqual(
      MAX_DESCRIPTION_CHARS
    )
  })

  it('strips markup and redacts contact details before truncating', () => {
    const out = sanitizeForPrompt('<b>Call 313-555-0142</b>', MAX_DESCRIPTION_CHARS)
    expect(out).not.toContain('<b>')
    expect(out).not.toContain('555-0142')
  })
})

describe('validateOutput', () => {
  it('accepts ordinary copy within the limit', () => {
    expect(validateOutput('A warm neighborhood barbershop in Midtown.', 320).ok).toBe(true)
  })

  it('rejects an empty or whitespace-only response', () => {
    expect(validateOutput('', 320).ok).toBe(false)
    expect(validateOutput('   \n  ', 320).ok).toBe(false)
  })

  it('rejects output that leaked an email address', () => {
    const result = validateOutput('Book with us at owner@example.com', 320)
    expect(result.ok).toBe(false)
  })

  it('rejects output that leaked a phone number', () => {
    const result = validateOutput('Call (313) 555-0142 to book today', 320)
    expect(result.ok).toBe(false)
  })

  it('rejects a model refusal rather than publishing it as copy', () => {
    const result = validateOutput("I'm sorry, I can't help with that request.", 320)
    expect(result.ok).toBe(false)
  })

  it('rejects output longer than the agent limit', () => {
    expect(validateOutput('a'.repeat(400), 320).ok).toBe(false)
  })

  it('never accepts output past the global ceiling, whatever the agent asks for', () => {
    // A future agent definition with a careless maxChars must not be able to
    // widen the hard cap. sanitize.ts takes the min of the two.
    const result = validateOutput('a'.repeat(MAX_OUTPUT_CHARS + 1), MAX_OUTPUT_CHARS + 5_000)
    expect(result.ok).toBe(false)
  })
})

describe('rejectionCode', () => {
  it('namespaces the reason so audit rows are greppable', () => {
    expect(rejectionCode('contains_email')).toBe('output_rejected:contains_email')
  })
})
