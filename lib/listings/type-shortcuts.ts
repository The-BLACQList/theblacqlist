/**
 * What the discover "Type" shortcuts mean.
 *
 * Every imported listing is `entity_type='business'` [Measured — prod SQL,
 * 2026-09-24], so a shortcut that filters on `entity_type` alone returns zero
 * for Restaurants, Services, Professionals and Creatives. The directory already
 * knows what a listing is through its category (149 listings sit under Food &
 * Dining) and through where it operates. So a shortcut matches a listing when:
 *
 *   - its own `entity_type` is the type (kept, so a real `restaurant` row still
 *     matches), OR
 *   - its category is one of the mapped parents, or a child of one, OR
 *   - its `location_type` is one of the mapped location types.
 *
 * [Decision — founder, 2026-09-24] "Type shortcuts map to categories."
 *
 * This file is the ONE place the mapping lives. The SQL functions take the
 * resolved ids and location types as arguments rather than carrying their own
 * copy, and the homepage avenue counts, the sponsored-placement filter, the
 * legacy fallback query and the sidebar count rollup all read it from here.
 * tests/type-shortcuts.test.ts checks every slug against supabase/seed.sql.
 *
 * Pure and client-safe.
 */

import { PRODUCTS_SERVICES_LOCATION_TYPES } from '@/lib/constants/listing'
import type { EntityType, LocationType } from '@/types'

/** Parent category slugs per type. Each parent brings all of its children. */
export const TYPE_CATEGORY_SLUGS: Readonly<Partial<Record<EntityType, readonly string[]>>> = {
  restaurant: ['food-dining'],
  professional: ['professional-services', 'legal-financial', 'healthcare', 'technology'],
  creative: [
    'creative-media',
    'arts-culture',
    'photography-videography',
    'books-publishing',
    'social-media-marketing',
  ],
}

/**
 * Location types per type. Services is the same axis as the homepage's
 * Products & Services avenue, so the two read the same constant.
 */
export const TYPE_LOCATION_TYPES: Readonly<Partial<Record<EntityType, readonly LocationType[]>>> = {
  service_provider: PRODUCTS_SERVICES_LOCATION_TYPES,
}

export interface CategoryNode {
  id: string
  slug: string
  parent_id: string | null
}

export interface TypeMatchable {
  entity_type: string
  category_id: string | null
  location_type: string | null
}

export function typeCategorySlugs(type: string | null | undefined): readonly string[] {
  if (!type) return []
  return TYPE_CATEGORY_SLUGS[type as EntityType] ?? []
}

export function typeLocationTypes(type: string | null | undefined): readonly LocationType[] {
  if (!type) return []
  return TYPE_LOCATION_TYPES[type as EntityType] ?? []
}

/** True when the type reaches past its own `entity_type`. */
export function isMappedType(type: string | null | undefined): boolean {
  return typeCategorySlugs(type).length > 0 || typeLocationTypes(type).length > 0
}

/** The mapped parent category ids plus every child of those parents. */
export function expandTypeCategoryIds(
  type: string | null | undefined,
  categories: readonly CategoryNode[]
): string[] {
  const slugs = new Set(typeCategorySlugs(type))
  if (slugs.size === 0) return []
  const parentIds = new Set(categories.filter((c) => slugs.has(c.slug)).map((c) => c.id))
  return categories
    .filter((c) => parentIds.has(c.id) || (c.parent_id !== null && parentIds.has(c.parent_id)))
    .map((c) => c.id)
}

/**
 * The same test the SQL type predicate runs, for rows already in memory.
 * `typeCategoryIds` must come from expandTypeCategoryIds for the same type.
 */
export function listingMatchesType(
  type: string,
  listing: TypeMatchable,
  typeCategoryIds: ReadonlySet<string> | readonly string[]
): boolean {
  if (listing.entity_type === type) return true
  const ids = typeCategoryIds instanceof Set ? typeCategoryIds : new Set(typeCategoryIds)
  if (listing.category_id && ids.has(listing.category_id)) return true
  const locs: readonly string[] = typeLocationTypes(type)
  return listing.location_type !== null && locs.includes(listing.location_type)
}

/**
 * The type predicate as a PostgREST `.or()` filter, for the queries that do not
 * go through the RPC. Values are UUIDs and fixed enum strings, so no quoting is
 * needed, but anything else is rejected rather than interpolated.
 */
export function typeOrFilter(type: string, typeCategoryIds: readonly string[]): string {
  const safe = /^[a-z0-9_-]+$/i
  if (!safe.test(type)) throw new Error('typeOrFilter: unexpected type value')
  const parts = [`entity_type.eq.${type}`]
  const ids = typeCategoryIds.filter((id) => safe.test(id))
  if (ids.length > 0) parts.push(`category_id.in.(${ids.join(',')})`)
  const locs = typeLocationTypes(type)
  if (locs.length > 0) parts.push(`location_type.in.(${locs.join(',')})`)
  return parts.join(',')
}

/** One `facet_kind='cell'` row from facet_counts, already parsed. */
export interface FacetCell extends TypeMatchable {
  count: number
}

/** `entity_type|category_id|location_type`, with empty segments for NULL. */
export function parseCellKey(key: string, count: number): FacetCell | null {
  const parts = key.split('|')
  if (parts.length !== 3 || !parts[0]) return null
  return {
    entity_type: parts[0],
    category_id: parts[1] || null,
    location_type: parts[2] || null,
    count,
  }
}

export interface RollupOptions {
  /** The entity types to report a count for (the sidebar's chips). */
  types: readonly string[]
  /** The active type filter, if any. Category counts respect it. */
  activeType?: string | null
  /** The active category id, if any. Type counts respect it. */
  activeCategoryId?: string | null
}

/**
 * Turns the cells into the sidebar's two count maps.
 *
 * The cells come from facet_counts' `frame`: every active filter EXCEPT category
 * and type. So each map can ignore its own selection (picking Food & Dining must
 * not turn every other category to 0) while respecting the other one.
 *
 *   category[slug] — cells that match the active type; a parent counts itself
 *                    plus all of its children, matching the search predicate
 *                    `category_id = p OR parent_id = p`.
 *   type[type]     — cells inside the active category, per listingMatchesType.
 */
export function rollupCells(
  cells: readonly FacetCell[],
  categories: readonly CategoryNode[],
  opts: RollupOptions
): { category: Record<string, number>; type: Record<string, number> } {
  const byId = new Map(categories.map((c) => [c.id, c]))

  const activeTypeIds = opts.activeType
    ? new Set(expandTypeCategoryIds(opts.activeType, categories))
    : null

  const category: Record<string, number> = {}
  for (const cell of cells) {
    if (
      opts.activeType &&
      activeTypeIds &&
      !listingMatchesType(opts.activeType, cell, activeTypeIds)
    ) {
      continue
    }
    const own = cell.category_id ? byId.get(cell.category_id) : undefined
    if (!own) continue
    category[own.slug] = (category[own.slug] ?? 0) + cell.count
    const parent = own.parent_id ? byId.get(own.parent_id) : undefined
    if (parent) category[parent.slug] = (category[parent.slug] ?? 0) + cell.count
  }

  const inActiveCategory = (cell: FacetCell): boolean => {
    if (!opts.activeCategoryId) return true
    if (cell.category_id === opts.activeCategoryId) return true
    const own = cell.category_id ? byId.get(cell.category_id) : undefined
    return own?.parent_id === opts.activeCategoryId
  }

  const typeIds = new Map(opts.types.map((t) => [t, new Set(expandTypeCategoryIds(t, categories))]))
  const type: Record<string, number> = {}
  for (const t of opts.types) type[t] = 0
  for (const cell of cells) {
    if (!inActiveCategory(cell)) continue
    for (const t of opts.types) {
      if (listingMatchesType(t, cell, typeIds.get(t) ?? new Set()))
        type[t] = (type[t] ?? 0) + cell.count
    }
  }

  return { category, type }
}
