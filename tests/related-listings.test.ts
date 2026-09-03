// =============================================================================
// PR 5 · bug 2 — "You Might Also Like" showed the wrong listings
// =============================================================================
// The rail was fed by ONE query that matched on category_id alone. Two
// consequences the founder saw on the walkthrough:
//
//   1. Type bleed. A job posting and a restaurant that share a category are
//      "related", so a restaurant page recommended a job opening.
//   2. No locality. Ordering by save_count alone put a well-saved business
//      three states away above the one down the street.
//
// The fix is two queries — a local pass and a national pass, both pinning
// entity_type and category_id — merged local-first. The merge is a pure
// function in its own module precisely so it can be tested here without
// dragging `@/lib/supabase/server` (and therefore `next/headers`) into a
// vitest `env: node` run.
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { mergeRelated, RELATED_LIMIT } from '@/lib/listings/related'

function source(relPath: string): string {
  return readFileSync(path.resolve(process.cwd(), relPath), 'utf8')
}

const row = (id: string) => ({ id })

describe('mergeRelated', () => {
  it('puts local results ahead of national ones', () => {
    // The whole point of the second query. Both passes arrive already ordered
    // by save_count, so a re-sort here would undo the locality preference — the
    // merge deliberately never sorts.
    const merged = mergeRelated([row('local-1'), row('local-2')], [row('far-1'), row('far-2')])
    expect(merged.map((r) => r.id)).toEqual(['local-1', 'local-2', 'far-1', 'far-2'])
  })

  it('de-duplicates rows that appear in both passes', () => {
    // Guaranteed to happen: the national pass is unfiltered by city, so every
    // local match is also in it.
    const merged = mergeRelated([row('a'), row('b')], [row('a'), row('c'), row('b')])
    expect(merged.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('caps at RELATED_LIMIT', () => {
    const many = Array.from({ length: 20 }, (_, i) => row(`n-${i}`))
    expect(mergeRelated(many, [])).toHaveLength(RELATED_LIMIT)
    expect(mergeRelated([], many)).toHaveLength(RELATED_LIMIT)
  })

  it('stops taking local rows once the cap is reached', () => {
    const local = Array.from({ length: RELATED_LIMIT + 3 }, (_, i) => row(`l-${i}`))
    const merged = mergeRelated(local, [row('far')])
    expect(merged).toHaveLength(RELATED_LIMIT)
    expect(merged.some((r) => r.id === 'far')).toBe(false)
  })

  it('honours an explicit limit', () => {
    expect(mergeRelated([row('a'), row('b'), row('c')], [], 2).map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('treats a failed query (null) as empty rather than throwing', () => {
    // Supabase returns { data: null } on error. The rail degrades to whatever
    // the other pass found; it never takes the page down.
    expect(mergeRelated(null, [row('a')]).map((r) => r.id)).toEqual(['a'])
    expect(mergeRelated([row('a')], null).map((r) => r.id)).toEqual(['a'])
    expect(mergeRelated(null, undefined)).toEqual([])
  })
})

describe('the related queries pin type and locality', () => {
  const src = source('lib/listings/entityPage.ts')

  it('both passes filter on entity_type as well as category_id', () => {
    // THE type-bleed fix. Without the entity_type predicate a job posting is a
    // valid "related" card for a restaurant.
    const base = src.slice(src.indexOf('const relatedBase'), src.indexOf('const relatedLocalQuery'))
    expect(base).toContain("eq('entity_type', raw.entity_type)")
    expect(base).toContain("eq('category_id', raw.category_id)")
    expect(base).toContain("eq('status', 'published')")
    expect(base).toContain("is('deleted_at', null)")
    expect(base).toContain("neq('id', raw.id)")
  })

  it('the local pass matches the city-less cohort when the listing has no city', () => {
    // `.eq('city_id', null)` matches nothing in PostgREST — a national or
    // online-only listing would silently lose its local pass. Its real cohort is
    // other city-less listings.
    expect(src).toMatch(/raw\.city_id\s*\n?\s*\?\s*relatedBase\(\)\.eq\('city_id', raw\.city_id\)/)
    expect(src).toMatch(/:\s*relatedBase\(\)\.is\('city_id', null\)/)
  })

  it('selects city_id, without which the local pass cannot be built', () => {
    expect(src).toContain('city_id,')
    expect(src).toMatch(/city_id: string \| null/)
  })

  it('runs both passes inside the existing Promise.all and merges them', () => {
    expect(src).toContain('relatedLocalQuery,')
    expect(src).toContain('relatedBase(),')
    expect(src).toContain('mergeRelated(')
  })
})

describe('EntityRelatedDiscovery', () => {
  const src = source('components/entity-page/EntityRelatedDiscovery.tsx')

  it('keeps the fewer-than-3 hide rule', () => {
    // Spec rule, unchanged by this PR — narrowing the query makes thin rails
    // MORE likely, so this guard matters more now, not less.
    expect(src).toContain('if (!related || related.length < 3) return null')
  })

  it('names the scroller after the entity type instead of "businesses"', () => {
    // The rail is entity_type-scoped now, so a rail of job postings announcing
    // itself as "Related businesses" is simply wrong.
    expect(src).not.toContain('aria-label="Related businesses"')
    expect(src).toContain('aria-label={relatedLabel}')
    expect(src).toContain('ENTITY_TYPE_LABEL[entity.entity_type]')
  })
})
