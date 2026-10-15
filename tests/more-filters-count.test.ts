import { describe, expect, it } from 'vitest'

import { countMoreFilters } from '@/components/discovery/moreFiltersCount'

const none = { category: '', prices: [], locationTypes: [], attrs: [], trustTier: '' }

describe('countMoreFilters', () => {
  it('is 0 when nothing inside the group is set', () => {
    expect(countMoreFilters(none)).toBe(0)
  })

  it('counts every picked value once', () => {
    expect(
      countMoreFilters({
        category: 'food',
        prices: ['$', '$$'],
        locationTypes: ['virtual'],
        attrs: ['wifi', 'patio'],
        trustTier: 'verified',
      })
    ).toBe(7)
  })
})
