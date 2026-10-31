// Ticket 172: "lawyer" also searches "law", "dentists" also searches "dental".
import { describe, it, expect } from 'vitest'
import { WORD_FAMILIES, expandSearchQuery } from '@/lib/search/wordFamilies'
import { rpcArgs } from '@/lib/listings/facets'

describe('expandSearchQuery', () => {
  it('adds the family of a single word', () => {
    expect(expandSearchQuery('lawyer')).toBe('lawyer OR law OR legal OR attorney')
    expect(expandSearchQuery('dentist')).toBe('dentist OR dental OR dentistry')
  })

  it('folds plurals and capitals onto the family', () => {
    expect(expandSearchQuery('Lawyers')).toBe('Lawyers OR law OR legal OR attorney')
    expect(expandSearchQuery('dentists')).toBe('dentists OR dental OR dentistry')
  })

  it('works the other way for the reported cases', () => {
    expect(expandSearchQuery('law').split(' OR ')).toContain('lawyer')
    expect(expandSearchQuery('dental').split(' OR ')).toContain('dentist')
  })

  it('keeps every other word required', () => {
    expect(expandSearchQuery('divorce lawyer')).toBe(
      'divorce lawyer OR divorce law OR divorce legal OR divorce attorney'
    )
    expect(expandSearchQuery('atlanta dentists')).toBe(
      'atlanta dentists OR atlanta dental OR atlanta dentistry'
    )
  })

  it('leaves words with no family alone', () => {
    for (const q of ['lawn', 'lawn care', 'coffee', 'bakery', 'soul food', 'accountant']) {
      expect(expandSearchQuery(q), q).toBe(q)
    }
  })

  it('goes one way only where a word is also a surname', () => {
    expect(expandSearchQuery('baker')).toBe('baker OR bakery')
    expect(expandSearchQuery('bakery')).toBe('bakery')
  })

  it('leaves the search alone when the visitor used quotes, a minus or OR', () => {
    for (const q of ['"law office"', 'lawyer -divorce', 'lawyer or dentist', 'lawyer OR dentist']) {
      expect(expandSearchQuery(q), q).toBe(q)
    }
  })

  it('leaves a search with too many combinations alone', () => {
    // 4 x 4 = 16 alternatives, over the cap of 12.
    expect(expandSearchQuery('lawyer attorney')).toBe('lawyer attorney')
  })

  it('trims and leaves an empty search empty', () => {
    expect(expandSearchQuery('   ')).toBe('')
    expect(expandSearchQuery('  plumber ')).toBe('plumber OR plumbing')
  })

  it('has lowercase single-word keys and never adds the key to itself', () => {
    for (const [key, words] of Object.entries(WORD_FAMILIES)) {
      expect(key, key).toMatch(/^[a-z]+$/)
      expect(words, key).not.toContain(key)
    }
  })
})

describe('rpcArgs', () => {
  it('sends the widened search to the database', () => {
    expect(rpcArgs({ p_q: 'lawyers' }).p_q).toBe('lawyers OR law OR legal OR attorney')
  })

  it('leaves a null search and other args alone', () => {
    expect(rpcArgs({ p_q: null, p_city_id: 'c1' })).toEqual({ p_q: null, p_city_id: 'c1' })
  })
})
