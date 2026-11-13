import { describe, expect, it } from 'vitest'

import { founderFirst, splitFounderBio } from '@/lib/listings/team'
import type { TeamMember } from '@/types'

const member = (id: string, isFounder?: boolean): TeamMember => ({
  id,
  name: id,
  role: null,
  bio: null,
  photo: null,
  ...(isFounder === undefined ? {} : { isFounder }),
})

describe('founderFirst', () => {
  it('moves founders to the front and keeps everyone else in order', () => {
    const team = [member('a'), member('b', true), member('c', false), member('d', true)]
    expect(founderFirst(team).map((m) => m.id)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('leaves a team with no founder untouched and does not mutate the input', () => {
    const team = [member('a'), member('b')]
    const sorted = founderFirst(team)
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b'])
    expect(sorted).not.toBe(team)
    expect(team.map((m) => m.id)).toEqual(['a', 'b'])
  })
})

describe('splitFounderBio', () => {
  it('pulls the first sentence as the quote, without its full stop, and keeps the rest', () => {
    expect(
      splitFounderBio(
        'Coffee brought my family here. I opened the café in 2014 and roast every batch.'
      )
    ).toEqual({
      quote: 'Coffee brought my family here',
      rest: 'I opened the café in 2014 and roast every batch.',
    })
  })

  it('keeps a question or exclamation mark on the quote', () => {
    expect(splitFounderBio('Why not us? Because we can.')).toEqual({
      quote: 'Why not us?',
      rest: 'Because we can.',
    })
  })

  it('makes a one-sentence bio all quote', () => {
    expect(splitFounderBio('Every cup tells a story.')).toEqual({
      quote: 'Every cup tells a story',
      rest: null,
    })
  })

  it('gives up on the quote when the first sentence runs past 140 characters', () => {
    const long = `${'word '.repeat(30).trim()}. Short tail.`
    expect(splitFounderBio(long)).toEqual({ quote: null, rest: long })
  })

  it('returns nothing for an empty or missing bio', () => {
    expect(splitFounderBio(null)).toEqual({ quote: null, rest: null })
    expect(splitFounderBio('   ')).toEqual({ quote: null, rest: null })
  })
})
