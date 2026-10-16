/**
 * Business levels: where a business sits in the supply chain.
 *
 * The same four levels The Collective maps (flow map vision §1), stored on
 * every listing now so the Discover filter works today and The Collective
 * reads the same columns later. Spec: docs/blacqlist/product/business-levels-2026-10.md.
 *
 * Each category sets a default level and the levels it allows
 * (categories.default_level / allowed_levels). A listing has one main level
 * (listings.primary_level) plus optional extras (listings.extra_levels).
 * Local is the default and goes unsaid on cards, the same rule as Black-Owned.
 */

export const BUSINESS_LEVELS = ['grower', 'maker', 'supplier', 'local'] as const

export type BusinessLevel = (typeof BUSINESS_LEVELS)[number]

export interface LevelMeta {
  /** Singular name, used in the owner's "What's your main role?" question. */
  label: string
  /** The filter label on Discover. */
  plural: string
  /** The card and hero pill. Null for local, which goes unsaid. */
  pill: string | null
  /** One plain line an owner reads when picking. */
  description: string
  /** Lower case noun for the empty state ("No suppliers listed yet"). */
  emptyNoun: string
}

export const LEVEL_META: Record<BusinessLevel, LevelMeta> = {
  grower: {
    label: 'Grower',
    plural: 'Growers & raw goods',
    pill: 'Grower',
    description: 'You grow, raise or harvest the raw goods: farms, gardens, ranches.',
    emptyNoun: 'growers',
  },
  maker: {
    label: 'Maker',
    plural: 'Makers',
    pill: 'Maker',
    description: 'You make the product yourself: food, crafts, goods, your own line.',
    emptyNoun: 'makers',
  },
  supplier: {
    label: 'Supplier',
    plural: 'Suppliers',
    pill: 'Supplier',
    description: 'You sell to other businesses: wholesale, distribution, supplies.',
    emptyNoun: 'suppliers',
  },
  local: {
    label: 'Local business',
    plural: 'Local businesses',
    pill: null,
    description: 'You serve shoppers directly: a shop, restaurant, salon or service. Online shops count.',
    emptyNoun: 'local businesses',
  },
}

export function isBusinessLevel(value: unknown): value is BusinessLevel {
  return typeof value === 'string' && (BUSINESS_LEVELS as readonly string[]).includes(value)
}

/** The pill text for a listing's main level, or null when nothing should show. */
export function levelPill(primary: string | null | undefined): string | null {
  return isBusinessLevel(primary) ? LEVEL_META[primary].pill : null
}

/** Display names for a listing's extras, in the canonical order ("Also: Supplier"). */
export function extraLevelLabels(extras: readonly string[] | null | undefined): string[] {
  if (!extras || extras.length === 0) return []
  return BUSINESS_LEVELS.filter((l) => extras.includes(l)).map((l) => LEVEL_META[l].label)
}

export interface CategoryLevels {
  default_level: BusinessLevel
  allowed_levels: BusinessLevel[]
}

/**
 * The levels a category allows, cleaned and in canonical order.
 *
 * Reads the category row as stored (a child already carries its own values,
 * inherited or overridden by the migration). A missing or malformed row reads
 * as local only, which is what a category added later starts as.
 */
export function levelsForCategory(
  category: { default_level?: string | null; allowed_levels?: readonly string[] | null } | null | undefined
): CategoryLevels {
  const raw = category?.allowed_levels ?? []
  const allowed = BUSINESS_LEVELS.filter((l) => raw.includes(l))
  const fallback: CategoryLevels = { default_level: 'local', allowed_levels: ['local'] }
  if (allowed.length === 0) return fallback
  const def = category?.default_level
  const default_level = isBusinessLevel(def) && allowed.includes(def) ? def : allowed[0]!
  return { default_level, allowed_levels: allowed }
}

export type LevelValidation =
  | { ok: true; primary: BusinessLevel; extras: BusinessLevel[] }
  | { ok: false; error: string }

/**
 * Checks an owner's pick against what the category allows. Mirrors the
 * database CHECKs so a bad pick fails with a plain message instead of a
 * constraint error: the main level must be allowed, extras must be allowed,
 * and the main level is never repeated as an extra.
 */
export function validateLevels(
  primary: unknown,
  extras: unknown,
  allowed: readonly BusinessLevel[]
): LevelValidation {
  if (!isBusinessLevel(primary) || !allowed.includes(primary)) {
    return { ok: false, error: 'Pick a main role this category allows.' }
  }
  const list = Array.isArray(extras) ? extras : []
  for (const e of list) {
    if (!isBusinessLevel(e) || !allowed.includes(e)) {
      return { ok: false, error: 'One of the extra roles is not allowed for this category.' }
    }
    if (e === primary) {
      return { ok: false, error: 'Your main role is already set. Pick a different extra.' }
    }
  }
  const unique = BUSINESS_LEVELS.filter((l) => (list as string[]).includes(l))
  return { ok: true, primary, extras: unique }
}
