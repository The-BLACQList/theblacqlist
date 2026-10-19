/**
 * The Creators & Influencers category belongs to the creator type alone.
 *
 * [Decision — founder, 2026-10-08] Creators add themselves only, through the
 * creator sign-up path (ticket 132), which asks "I'm 18 or older". A business
 * page filed under Creators would skip that check and would not get the
 * creator filters, so the business path never offers or accepts these
 * categories, and a creator page never takes a category outside them.
 *
 * Pure and client-safe.
 */

import { TYPE_CATEGORY_SLUGS } from '@/lib/listings/type-shortcuts'

export const CREATOR_PARENT_SLUG = TYPE_CATEGORY_SLUGS.creator?.[0] ?? 'creators-influencers'

export interface CategoryLike {
  id: string
  slug: string
  parent_id: string | null
}

/** True for the Creators & Influencers parent and every one of its children. */
export function isCreatorCategory(
  category: CategoryLike,
  categories: readonly CategoryLike[]
): boolean {
  if (category.slug === CREATOR_PARENT_SLUG) return true
  if (!category.parent_id) return false
  const parent = categories.find((c) => c.id === category.parent_id)
  return parent?.slug === CREATOR_PARENT_SLUG
}

/** The category tree the business path offers: everything except Creators. */
export function withoutCreatorCategories<T extends CategoryLike>(categories: readonly T[]): T[] {
  return categories.filter((c) => !isCreatorCategory(c, categories))
}

/** The Creators subcategories, in display order: what the creator path offers. */
export function creatorSubcategories<T extends CategoryLike>(categories: readonly T[]): T[] {
  const parent = categories.find((c) => c.slug === CREATOR_PARENT_SLUG && !c.parent_id)
  if (!parent) return []
  return categories.filter((c) => c.parent_id === parent.id)
}
