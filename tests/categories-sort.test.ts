// =============================================================================
// Category picker ordering
// =============================================================================
// Owner pickers (add business, add event, add job) list categories A to Z. The
// public site keeps `display_order`; this helper is only for pickers.
// =============================================================================

import { describe, it, expect } from 'vitest'

import { byName, groupCategoriesByParent } from '@/lib/categories/sort'

const cat = (id: string, name: string, parent_id: string | null = null) => ({
  id,
  name,
  parent_id,
})

describe('byName', () => {
  it('sorts A to Z, ignoring case and accents', () => {
    const names = [cat('1', 'technology'), cat('2', 'Arts & Culture'), cat('3', 'Éducation'), cat('4', 'beauty')]
      .sort(byName)
      .map((c) => c.name)
    expect(names).toEqual(['Arts & Culture', 'beauty', 'Éducation', 'technology'])
  })
})

describe('groupCategoriesByParent', () => {
  // Deliberately out of order, the way display_order hands them over.
  const input = [
    cat('food', 'Food & Dining'),
    cat('bakery', 'Bakeries', 'food'),
    cat('arts', 'Arts & Culture'),
    cat('bbq', 'BBQ', 'food'),
    cat('legal', 'Legal & Financial'),
    cat('asian', 'Asian Cuisine', 'food'),
    cat('gallery', 'Galleries', 'arts'),
  ]

  it('orders parents A to Z and each parent’s children A to Z', () => {
    const groups = groupCategoriesByParent(input)
    expect(groups.map((g) => g.parent.name)).toEqual([
      'Arts & Culture',
      'Food & Dining',
      'Legal & Financial',
    ])
    expect(groups[1]?.children.map((c) => c.name)).toEqual(['Asian Cuisine', 'Bakeries', 'BBQ'])
  })

  it('gives a parent with no subcategories an empty child list', () => {
    const legal = groupCategoriesByParent(input).find((g) => g.parent.id === 'legal')
    expect(legal?.children).toEqual([])
  })

  it('drops a subcategory whose parent is missing instead of promoting it', () => {
    const groups = groupCategoriesByParent([...input, cat('orphan', 'Aardvark Care', 'gone')])
    const everyId = groups.flatMap((g) => [g.parent.id, ...g.children.map((c) => c.id)])
    expect(everyId).not.toContain('orphan')
  })

  it('does not reorder the caller’s array', () => {
    const copy = [...input]
    groupCategoriesByParent(input)
    expect(input).toEqual(copy)
  })
})
