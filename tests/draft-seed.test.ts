import { describe, expect, it } from 'vitest'

import { firstSentence, foldFounderStory } from '@/lib/listings/draftSeed'

describe('firstSentence', () => {
  it('returns the first sentence of the about text', () => {
    expect(firstSentence('We bake bread. We also make cakes.')).toBe('We bake bread.')
  })

  it('returns the whole text when there is no sentence end', () => {
    expect(firstSentence('Family-run bakery in the West End')).toBe(
      'Family-run bakery in the West End'
    )
  })

  it('does not split on a decimal point', () => {
    expect(firstSentence('Open 7.5 hours a day. Closed Mondays.')).toBe('Open 7.5 hours a day.')
  })

  it('cuts a long sentence at a word boundary', () => {
    const out = firstSentence(`${'word '.repeat(40)}end.`, 60)
    expect(out.length).toBeLessThanOrEqual(60)
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toMatch(/ …$/)
  })

  it('returns an empty string for blank text', () => {
    expect(firstSentence('   ')).toBe('')
  })
})

describe('foldFounderStory', () => {
  it('appends the story as its own paragraph', () => {
    expect(foldFounderStory('We bake bread.', 'My grandmother taught me.')).toBe(
      'We bake bread.\n\nMy grandmother taught me.'
    )
  })

  it('leaves the description alone when the story is empty', () => {
    expect(foldFounderStory('We bake bread.', '  ')).toBe('We bake bread.')
    expect(foldFounderStory('We bake bread.', null)).toBe('We bake bread.')
  })

  it('does not add the story twice', () => {
    const once = foldFounderStory('We bake bread.', 'Since 1990.')
    expect(foldFounderStory(once, 'Since 1990.')).toBe(once)
  })
})
