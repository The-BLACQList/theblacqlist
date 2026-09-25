/**
 * Alphabetical ordering for category pickers.
 *
 * The `categories` table carries a `display_order` that the public site uses for
 * curated layouts (homepage tiles, avenue order). A picker is a different job:
 * an owner scanning thirty names for their own wants A to Z. So pickers sort by
 * name here and `display_order` stays untouched for everything else.
 *
 * Pure and client-safe. Used by the owner submit forms and the discover filters.
 */

export interface CategoryLike {
  id: string
  name: string
  parent_id: string | null
}

/** Case- and accent-insensitive A to Z. "arts & culture" sorts with "Arts". */
export function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
}

export interface CategoryGroup<T extends CategoryLike> {
  parent: T
  children: T[]
}

/**
 * Top-level categories A to Z, each with its own subcategories A to Z.
 *
 * A child whose parent is missing from the list (inactive parent, partial load)
 * is dropped rather than promoted to the top level, so a picker never offers a
 * subcategory with no visible home.
 */
export function groupCategoriesByParent<T extends CategoryLike>(
  categories: readonly T[]
): CategoryGroup<T>[] {
  const childrenByParent = new Map<string, T[]>()
  for (const c of categories) {
    if (c.parent_id === null) continue
    const list = childrenByParent.get(c.parent_id)
    if (list) list.push(c)
    else childrenByParent.set(c.parent_id, [c])
  }

  return categories
    .filter((c) => c.parent_id === null)
    .sort(byName)
    .map((parent) => ({
      parent,
      children: [...(childrenByParent.get(parent.id) ?? [])].sort(byName),
    }))
}
