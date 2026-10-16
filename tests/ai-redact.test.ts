// =============================================================================
// Street addresses and the owner's own name never reach a prompt
// =============================================================================
// The Privacy Policy says: "We don't send your phone number, email, street
// address or your own name to the AI." These tests hold the address and name
// half of that promise, and the false positives that would damage ordinary copy.
// Pure functions only; nothing here touches a database.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { ownerNamesFrom } from '@/lib/ai/ownerName'
import {
  ownerNameTerms,
  PromptRedactionError,
  REDACTED,
  redactOwnerName,
  redactStreetAddresses,
} from '@/lib/ai/redact'
import { buildPromptVars, type GenerateContext } from '@/lib/ai/provider'
import { sanitizeForPrompt } from '@/lib/ai/sanitize'

describe('REDACTED', () => {
  it('is the same marker email and phone already use', () => {
    expect(REDACTED).toBe('[removed]')
    expect(sanitizeForPrompt('Email owner@example.com', 200)).toBe('Email [removed]')
  })
})

describe('redactStreetAddresses — removes addresses', () => {
  const cases: Array<[string, string]> = [
    ['Visit us at 123 Main St.', 'Visit us at [removed]'],
    ['4800 Martin Luther King Jr Blvd', '[removed]'],
    ['123 W. 5th St. Suite 200, Detroit, MI 48201', '[removed]'],
    ['77 Peachtree Street NW, Atlanta, GA 30303', '[removed]'],
    ['1500 Florida Ave NE', '[removed]'],
    ['2200 N Main Street Apt 3B', '[removed]'],
    ['901 Broad Street #4', '[removed]'],
    ['10 Kercheval Ave Ste. 5 is home', '[removed] is home'],
    ['12 Oak Run Rd', '[removed]'],
    ['find us at 123 main st today', 'find us at [removed] today'],
    ['1200 W GRAND AVE', '[removed]'],
    ['PO Box 55', '[removed]'],
    ['Mail P.O. Box 1234 for orders', 'Mail [removed] for orders'],
    ['post office box 9', '[removed]'],
  ]
  it.each(cases)('%s', (input, expected) => {
    expect(redactStreetAddresses(input)).toBe(expected)
  })

  it('removes every address, not just the first', () => {
    expect(redactStreetAddresses('Now at 12 Elm St and 400 Oak Ave.')).toBe(
      'Now at [removed] and [removed]'
    )
  })
})

describe('redactStreetAddresses — leaves ordinary copy alone', () => {
  const untouched = [
    'Open 24 hours',
    'We have 3 locations',
    'Serving since 1998',
    'Over 20 years in business',
    'Over 20 Years On The Square',
    'Rated 5 stars',
    '2 for 1 Tuesdays',
    'Top 10 in Chicago',
    'Wings $15 or 2 for $25',
    'Plates from $12.50',
    'Open 7 days a week',
    '10 Best Way To Eat',
    '100 Percent Black Owned Place',
    'Our 3 Kids Run The Place',
    '5 Kids Way',
    'Since 2004 Serving The Southside Way',
    '1 Love Drive-In',
    'Over 30 Great Ways',
    '12 Days Of Christmas Market Place',
    'Three generations, 1 family',
  ]
  it.each(untouched)('%s', (input) => {
    expect(redactStreetAddresses(input)).toBe(input)
  })
})

describe('ownerNameTerms', () => {
  it('takes the full name and each name word of 3+ letters, longest first', () => {
    expect(ownerNameTerms(['Keisha Brown'], 'Soul Spot')).toEqual(['Keisha Brown', 'Keisha', 'Brown'])
  })

  it('keeps any name word that is also in the business name', () => {
    // "Keisha Brown" running "Keisha's Kitchen" keeps "Keisha".
    expect(ownerNameTerms(['Keisha Brown'], "Keisha's Kitchen")).toEqual(['Keisha Brown', 'Brown'])
  })

  it('keeps the full name when the business is named after it', () => {
    expect(ownerNameTerms(['Keisha Brown'], 'Keisha Brown Catering')).toEqual([])
  })

  it('returns nothing when the owner has no name on file', () => {
    expect(ownerNameTerms([], 'Soul Spot')).toEqual([])
    expect(ownerNameTerms([null, undefined, '', '   '], 'Soul Spot')).toEqual([])
  })

  it('skips titles, short words and email-shaped names', () => {
    expect(ownerNameTerms(['Chef Mike Lee'], 'Soul Spot')).toEqual(['Chef Mike Lee', 'Mike', 'Lee'])
    expect(ownerNameTerms(['Al Wu'], 'Soul Spot')).toEqual(['Al Wu'])
    expect(ownerNameTerms(['owner@example.com'], 'Soul Spot')).toEqual([])
  })

  it('merges names from more than one source without repeats', () => {
    expect(ownerNameTerms(['Keisha Brown', 'keisha brown', 'Keisha B'], 'Soul Spot')).toEqual([
      'Keisha Brown',
      'Keisha B',
      'Keisha',
      'Brown',
    ])
  })
})

describe('redactOwnerName', () => {
  const terms = ownerNameTerms(['Keisha Brown'], "Keisha's Kitchen")

  it('removes the full name and last name as whole words, any case', () => {
    expect(redactOwnerName('Keisha Brown and Ms. brown run the place.', terms)).toBe(
      '[removed] and Ms. [removed] run the place.'
    )
  })

  it('does not touch the name inside a longer word', () => {
    expect(redactOwnerName('Browning onions since dawn.', terms)).toBe('Browning onions since dawn.')
  })

  it('leaves the business name in the text alone', () => {
    expect(redactOwnerName("Welcome to Keisha's Kitchen.", terms)).toBe("Welcome to Keisha's Kitchen.")
  })

  it('does nothing with no terms', () => {
    expect(redactOwnerName('Keisha Brown runs it.', [])).toBe('Keisha Brown runs it.')
  })

  it('matches names with accents and across extra spaces', () => {
    const t = ownerNameTerms(['Renée  Okafor'], 'Soul Spot')
    expect(redactOwnerName('Ask for renée   okafor or Renée.', t)).toBe('Ask for [removed] or [removed].')
  })
})

describe('sanitizeForPrompt — the full pass', () => {
  it('removes every email and phone, not just the first', () => {
    const out = sanitizeForPrompt('a@b.com, c@d.com, 312-555-1212 or (773) 555-1212', 200)
    expect(out.match(/\[removed\]/g)).toHaveLength(4)
    for (const leaked of ['a@b.com', 'c@d.com', '312', '773', '555']) {
      expect(out).not.toContain(leaked)
    }
  })

  it('removes the address and the owner name together', () => {
    const redaction = { ownerNameTerms: ownerNameTerms(['Keisha Brown'], 'Soul Spot') }
    expect(
      sanitizeForPrompt('Keisha Brown cooks at 123 Main St. Call Keisha!', 200, redaction)
    ).toBe('[removed] cooks at [removed] Call [removed]!')
  })

  it('fails closed with a fixed code and no text when redaction throws', () => {
    // A term that is not a string makes the name pass throw.
    const broken = { ownerNameTerms: [{} as unknown as string] }
    let thrown: unknown
    try {
      sanitizeForPrompt('Keisha Brown at 123 Main St', 200, broken)
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(PromptRedactionError)
    expect((thrown as Error).message).toBe('prompt_redaction_failed')
    expect((thrown as Error).message).not.toContain('Main')
  })
})

describe('buildPromptVars with an owner name', () => {
  const CTX: GenerateContext = {
    listingName: "Keisha's Kitchen",
    categoryName: 'Restaurant',
    cityName: 'Detroit',
    tagline: 'Keisha Brown cooks Sunday dinner every day',
    description: 'Find Keisha and Chef Brown at 4800 Woodward Ave, Detroit, MI 48201. Since 1998.',
    pageViews30d: 1,
    ctaClicks30d: 1,
    saves30d: 1,
    shares30d: 1,
    pageViews7d: 1,
  }
  const redaction = { ownerNameTerms: ownerNameTerms(['Keisha Brown'], CTX.listingName) }
  const vars = buildPromptVars(CTX, redaction)

  it('never removes the name from the business name field', () => {
    expect(vars.listing_name).toBe("Keisha's Kitchen")
  })

  it('removes the name and address from the tagline and description', () => {
    expect(vars.tagline).toBe('[removed] cooks Sunday dinner every day')
    expect(vars.description_excerpt).toBe('Find Keisha and Chef [removed] at [removed]. Since 1998.')
  })

  it('still removes addresses without a name on file', () => {
    expect(buildPromptVars(CTX).description_excerpt).toBe(
      'Find Keisha and Chef Brown at [removed]. Since 1998.'
    )
  })
})

describe('ownerNamesFrom', () => {
  it('reads the profile name and the sign-up name, without repeats', () => {
    expect(ownerNamesFrom({ display_name: 'keisha brown', full_name: 'Keisha M Brown' }, 'Keisha Brown')).toEqual([
      'Keisha Brown',
      'Keisha M Brown',
    ])
  })

  it('returns an empty list with no name on file', () => {
    expect(ownerNamesFrom({}, null)).toEqual([])
    expect(ownerNamesFrom(null, '  ')).toEqual([])
    expect(ownerNamesFrom({ display_name: 42, name: ['x'] }, undefined)).toEqual([])
  })
})
