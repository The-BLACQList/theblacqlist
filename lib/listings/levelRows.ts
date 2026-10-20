import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { isBusinessLevel, levelsForCategory, type CategoryLevels } from '@/lib/listings/levels'

// Level columns are read on their own, never inside the main listing or
// category selects. A database without 20261017000000_business_levels.sql
// (staging before GATE-DATA, every Preview until then) rejects the whole
// select when one column is missing, which emptied /discover and 404'd every
// business page. Read apart, a missing column only means no pills.

type LooseClient = Pick<SupabaseClient, 'from'>

/** A thrown read counts as a failed one: levels are never worth an error page. */
async function safely(
  run: () => PromiseLike<{ data: unknown; error: unknown }>
): Promise<{ data: unknown; error: unknown }> {
  try {
    return await run()
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Sets primary_level, extra_levels and open_to_partnerships on each entity,
 * in place. Fail-soft: on any error every entity reads as local with no
 * extras and not open to partnerships (no pills).
 *
 * open_to_partnerships (ticket 134) rides on this read because it is the same
 * kind of thing: a small card pill that is never worth an error page.
 */
export async function attachLevels(
  supabase: unknown,
  entities: {
    id: string
    primary_level?: string
    extra_levels?: string[]
    open_to_partnerships?: boolean
  }[]
): Promise<void> {
  for (const e of entities) {
    e.primary_level = 'local'
    e.extra_levels = []
    e.open_to_partnerships = false
  }
  if (entities.length === 0) return
  const ids = [...new Set(entities.map((e) => e.id))]
  const { data, error } = await safely(() =>
    (supabase as LooseClient).from('listings').select('id, primary_level, extra_levels, open_to_partnerships').in('id', ids)
  )
  if (error || !data) return

  type Row = { id: string; primary_level: unknown; extra_levels: unknown; open_to_partnerships: unknown }
  const byId = new Map<string, Row>()
  for (const row of data as Row[]) {
    byId.set(row.id, row)
  }
  for (const e of entities) {
    const row = byId.get(e.id)
    if (!row) continue
    if (isBusinessLevel(row.primary_level)) e.primary_level = row.primary_level
    e.extra_levels = Array.isArray(row.extra_levels) ? row.extra_levels.filter(isBusinessLevel) : []
    e.open_to_partnerships = row.open_to_partnerships === true
  }
}

/**
 * The level rules for each category id, or null when the database has no
 * level columns yet. Callers treat null as "levels are off": no role step,
 * no primary_level on insert.
 */
export async function loadCategoryLevels(
  supabase: unknown,
  ids: readonly string[]
): Promise<Map<string, CategoryLevels> | null> {
  if (ids.length === 0) return new Map()
  const { data, error } = await safely(() =>
    (supabase as LooseClient)
      .from('categories')
      .select('id, default_level, allowed_levels')
      .in('id', [...new Set(ids)])
  )
  if (error || !data) return null
  const out = new Map<string, CategoryLevels>()
  for (const row of data as { id: string; default_level: string | null; allowed_levels: string[] | null }[]) {
    out.set(row.id, levelsForCategory(row))
  }
  return out
}
