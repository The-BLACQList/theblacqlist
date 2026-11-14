/**
 * Which stored category names need Title Case (ticket 205).
 *
 * Used by scripts/ops/title-case-categories.ts for categories an admin added
 * from a category request before approval started saving names in Title Case.
 * Pure: it only compares strings.
 */

import { toTitleCase } from '@/lib/text/title-case'

export interface CategoryNameRow {
  id: string
  slug: string
  name: string
}

export interface CategoryRename {
  id: string
  slug: string
  from: string
  to: string
}

export function planCategoryTitleCase(rows: readonly CategoryNameRow[]): CategoryRename[] {
  return rows.flatMap((r) => {
    const to = toTitleCase(r.name.trim())
    return to === r.name ? [] : [{ id: r.id, slug: r.slug, from: r.name, to }]
  })
}
