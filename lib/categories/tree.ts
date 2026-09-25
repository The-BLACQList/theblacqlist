/**
 * The discover sidebar's category tree, as data.
 *
 * Kept out of the component so the rules are unit-testable (vitest here is
 * node-only, with no DOM): which categories show, in what order, and which
 * parents start expanded.
 *
 * Pure and client-safe.
 */

import { groupCategoriesByParent, type CategoryLike } from '@/lib/categories/sort'

export interface TreeCategory extends CategoryLike {
  slug: string
}

export interface CategoryTreeLeaf<T extends TreeCategory> {
  category: T
  /** null when counts are not available: show the row, no badge. */
  count: number | null
  active: boolean
}

export interface CategoryTreeBranch<T extends TreeCategory> extends CategoryTreeLeaf<T> {
  children: CategoryTreeLeaf<T>[]
  /** Starts open because the active filter is one of its children. */
  expanded: boolean
}

/**
 * Parents A to Z, each with its visible children A to Z.
 *
 * `counts` is keyed by category slug, and a parent's count already includes its
 * children (the rollup happens server side). When `counts` is undefined the
 * directory has no per-category numbers yet, so everything shows: hiding rows
 * on a missing number would make the tree look empty. When counts exist, a row
 * with 0 is hidden unless it is the active filter, so the visitor can always
 * see and clear what they picked.
 */
export function buildCategoryTree<T extends TreeCategory>(
  categories: readonly T[],
  counts: Record<string, number> | undefined,
  activeSlug: string
): CategoryTreeBranch<T>[] {
  const leaf = (category: T): CategoryTreeLeaf<T> => ({
    category,
    count: counts ? (counts[category.slug] ?? 0) : null,
    active: category.slug === activeSlug,
  })
  const visible = (l: CategoryTreeLeaf<T>) => l.count === null || l.count > 0 || l.active

  const tree: CategoryTreeBranch<T>[] = []
  for (const { parent, children } of groupCategoriesByParent(categories)) {
    const kids = children.map(leaf).filter(visible)
    const self = leaf(parent)
    // A parent stays if it has matches of its own or a child still showing. The
    // second case only matters for an active child under a 0-count parent, which
    // the rollup should never produce, but losing the active filter's home would
    // strand it.
    if (!visible(self) && kids.length === 0) continue
    tree.push({ ...self, children: kids, expanded: kids.some((k) => k.active) })
  }
  return tree
}
