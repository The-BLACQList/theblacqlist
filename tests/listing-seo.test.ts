import { describe, expect, it } from 'vitest'

import {
  SEO_DESCRIPTION_MAX,
  SEO_DESCRIPTION_MIN,
  SEO_TITLE_MAX,
  listingMetaText,
  rulesSeo,
} from '@/lib/listings/seo'

const BASE = {
  name: 'Sweet Auburn Bread Co.',
  tagline: 'Fresh bread daily.',
  categoryName: 'Bakery',
  locationLabel: 'Atlanta, GA',
}

describe('listingMetaText', () => {
  it('builds the same text the page always built when no meta fields are set', () => {
    expect(listingMetaText(BASE)).toEqual({
      title: 'Sweet Auburn Bread Co. in Atlanta, GA',
      description:
        'Fresh bread daily. Bakery in Atlanta, GA. Discover and support Black-owned businesses on The BLACQList.',
    })
  })

  it('prefers the owner meta title and description', () => {
    const out = listingMetaText({
      ...BASE,
      metaTitle: 'Best sourdough in Atlanta',
      metaDescription: 'Hand-shaped sourdough baked every morning on Auburn Ave.',
    })
    expect(out.title).toBe('Best sourdough in Atlanta')
    expect(out.description).toBe('Hand-shaped sourdough baked every morning on Auburn Ave.')
  })

  it('ignores whitespace-only meta fields', () => {
    expect(listingMetaText({ ...BASE, metaTitle: '  ', metaDescription: '' }).title).toBe(
      'Sweet Auburn Bread Co. in Atlanta, GA'
    )
  })

  it('says Online for a page with no city', () => {
    expect(listingMetaText({ ...BASE, locationLabel: null }).title).toBe(
      'Sweet Auburn Bread Co. in Online'
    )
  })
})

describe('rulesSeo', () => {
  it('fits the title and description limits', () => {
    const out = rulesSeo(BASE)
    expect(out.title.length).toBeLessThanOrEqual(SEO_TITLE_MAX)
    expect(out.description.length).toBeGreaterThanOrEqual(SEO_DESCRIPTION_MIN)
    expect(out.description.length).toBeLessThanOrEqual(SEO_DESCRIPTION_MAX)
    expect(out.title).toContain('Sweet Auburn Bread Co.')
  })

  it('always gives at least the minimum description, even with almost nothing', () => {
    const out = rulesSeo({ name: 'Jo', tagline: null, categoryName: null, locationLabel: null })
    expect(out.description.length).toBeGreaterThanOrEqual(SEO_DESCRIPTION_MIN)
  })

  it('cuts a very long tagline instead of dropping it', () => {
    const out = rulesSeo({ ...BASE, tagline: 'We bake '.repeat(40) })
    expect(out.description.length).toBeLessThanOrEqual(SEO_DESCRIPTION_MAX)
    expect(out.description.startsWith('We bake')).toBe(true)
  })

  it('shortens a long name to fit the title', () => {
    const out = rulesSeo({
      ...BASE,
      name: 'The Very Long Name Bakery and Coffee House of Southwest Atlanta',
    })
    expect(out.title.length).toBeLessThanOrEqual(SEO_TITLE_MAX)
  })

  it('uses no em dashes', () => {
    const out = rulesSeo(BASE)
    expect(out.title + out.description).not.toContain('—')
  })
})
