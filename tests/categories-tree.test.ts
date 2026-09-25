// =============================================================================
// Discover sidebar category tree
// =============================================================================
// The rules behind components/discovery/CategoryTree.tsx: A to Z at both
// levels, empty categories hidden only when real counts exist, the active pick
// never hidden, and a picked subcategory opens its parent.
// =============================================================================

import { describe, it, expect } from 'vitest'

import { buildCategoryTree } from '@/lib/categories/tree'

const cat = (id: string, name: string, parent_id: string | null = null) => ({
  id,
  name,
  slug: id,
  parent_id,
})

// Out of order on purpose, the way the query hands them over.
const categories = [
  cat('food-dining', 'Food & Dining'),
  cat('bakeries', 'Bakeries', 'food-dining'),
  cat('arts-culture', 'Arts & Culture'),
  cat('bbq', 'BBQ', 'food-dining'),
  cat('legal-financial', 'Legal & Financial'),
  cat('galleries', 'Galleries', 'arts-culture'),
]

const names = (tree: ReturnType<typeof buildCategoryTree>) => tree.map((b) => b.category.name)

describe('buildCategoryTree', () => {
  it('orders parents and subcategories A to Z', () => {
    const tree = buildCategoryTree(categories, undefined, '')
    expect(names(tree)).toEqual(['Arts & Culture', 'Food & Dining', 'Legal & Financial'])
    expect(tree[1]?.children.map((c) => c.category.name)).toEqual(['Bakeries', 'BBQ'])
  })

  it('shows every category, with no count, when counts are not available', () => {
    const tree = buildCategoryTree(categories, undefined, '')
    expect(tree).toHaveLength(3)
    expect(tree.every((b) => b.count === null)).toBe(true)
    expect(tree[1]?.children).toHaveLength(2)
  })

  it('hides zero-count categories once counts exist', () => {
    const tree = buildCategoryTree(
      categories,
      { 'food-dining': 149, bbq: 3, 'arts-culture': 12 },
      ''
    )
    expect(names(tree)).toEqual(['Arts & Culture', 'Food & Dining'])
    expect(tree[1]?.children.map((c) => c.category.slug)).toEqual(['bbq'])
    // A parent with matches and no matching subcategories keeps no children.
    expect(tree[0]?.children).toEqual([])
    expect(tree[1]?.count).toBe(149)
  })

  it('keeps the active category visible even at zero', () => {
    const tree = buildCategoryTree(categories, { 'food-dining': 5 }, 'legal-financial')
    const legal = tree.find((b) => b.category.slug === 'legal-financial')
    expect(legal).toMatchObject({ active: true, count: 0 })
  })

  it('keeps an active zero-count subcategory and its parent, and expands the parent', () => {
    const tree = buildCategoryTree(categories, { 'food-dining': 0 }, 'bakeries')
    const food = tree.find((b) => b.category.slug === 'food-dining')
    expect(food?.expanded).toBe(true)
    expect(food?.children.map((c) => c.category.slug)).toEqual(['bakeries'])
    expect(food?.children[0]?.active).toBe(true)
  })

  it('does not expand a parent when the parent itself is the pick', () => {
    const tree = buildCategoryTree(categories, undefined, 'food-dining')
    const food = tree.find((b) => b.category.slug === 'food-dining')
    expect(food).toMatchObject({ active: true, expanded: false })
  })

  it('treats a count of 0 as a number, not as missing', () => {
    const tree = buildCategoryTree(categories, {}, '')
    expect(tree).toEqual([])
  })
})
