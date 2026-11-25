// Ticket 284: the do-not-re-add marks. Read by the launch seed (which skips a
// match) and by admin review of a new Page (which warns, never blocks).
//
// No server-only imports: scripts/seed-launch-listings.ts runs this under tsx.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface PageMark {
  page_id: string
  slug: string
  name: string
  city_slug: string | null
  city_name: string | null
  reason: string
  marked_at: string
}

const PAGE_SIZE = 1000

/**
 * Every mark, or a thrown error. A failed read must never look like "no marks":
 * the seed would add back a business that asked to come off.
 */
export async function loadPageMarks(client: SupabaseClient): Promise<PageMark[]> {
  const marks: PageMark[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('page_do_not_re_add')
      .select('page_id, slug, name, city_slug, city_name, reason, marked_at')
      .order('page_id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Could not read the do-not-re-add marks: ${error.message}`)
    const rows = (data ?? []) as PageMark[]
    marks.push(...rows)
    if (rows.length < PAGE_SIZE) return marks
  }
}

/** Case, accents, punctuation and spacing don't make a different business. */
export function nameKey(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’‘`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export interface MarkCandidate {
  slug?: string | null
  name: string
  citySlug?: string | null
  cityName?: string | null
}

/**
 * The mark this business matches: the same slug, or the same name in the same
 * city. When either side has no city, the name alone is enough. That can match
 * a different business, so every caller shows the match to a person.
 */
export function findPageMark(
  marks: readonly PageMark[],
  candidate: MarkCandidate
): PageMark | null {
  const bySlug = candidate.slug ? marks.find((m) => m.slug === candidate.slug) : undefined
  if (bySlug) return bySlug

  const name = nameKey(candidate.name)
  if (!name) return null
  return (
    marks.find((m) => {
      if (nameKey(m.name) !== name) return false
      if (m.city_slug && candidate.citySlug) return m.city_slug === candidate.citySlug
      const markCity = nameKey(m.city_name)
      const city = nameKey(candidate.cityName)
      return !markCity || !city || markCity === city
    }) ?? null
  )
}
