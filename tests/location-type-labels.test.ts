// =============================================================================
// PR 5 · bug 3 — raw location slugs on the listing page
// =============================================================================
// EntityAtAGlance rendered `location_type.replace(/-/g, ' ')` + capitalize.
// That is a no-op on all six stored values, because none of them contains a
// hyphen — they are snake_case enum keys. So a "comes to you" business read
//
//     Service_area
//
// on its own page, while Discover's facet said "Comes to you" for the same row.
// Three label sets existed and two disagreed. The vocabulary now lives once, in
// LOCATION_TYPE_META, and the facet derives from it.
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { LOCATION_TYPES, LOCATION_TYPE_LABEL } from '@/components/discovery/facetConstants'
import { LOCATION_TYPE_META, VALID_LOCATION_TYPES } from '@/lib/constants/listing'

function source(relPath: string): string {
  return readFileSync(path.resolve(process.cwd(), relPath), 'utf8')
}

describe('LOCATION_TYPE_META', () => {
  it('covers every value the DB CHECK allows', () => {
    // A missing key is a runtime crash on the entity page, not a type error at
    // the call site — the lookup is indexed by a value that came from the DB.
    expect(Object.keys(LOCATION_TYPE_META).sort()).toEqual([...VALID_LOCATION_TYPES].sort())
  })

  it('is plain language, never the raw slug', () => {
    for (const [value, meta] of Object.entries(LOCATION_TYPE_META)) {
      expect(meta.label, `${value} label`).not.toContain('_')
      expect(meta.label.toLowerCase(), `${value} label`).not.toBe(value)
      expect(meta.label.trim().length).toBeGreaterThan(0)
    }
  })

  it('reads "Comes to you" for service_area — the value the founder saw broken', () => {
    expect(LOCATION_TYPE_META.service_area.label).toBe('Comes to you')
  })
})

describe('the Discover facet derives from the same table', () => {
  it('offers exactly the six values, in the CHECK constraint order', () => {
    expect(LOCATION_TYPES.map((t) => t.value)).toEqual([...VALID_LOCATION_TYPES])
  })

  it('uses the shared labels rather than a second hand-written list', () => {
    for (const { value, label } of LOCATION_TYPES) {
      expect(label).toBe(LOCATION_TYPE_META[value].label)
    }
    expect(LOCATION_TYPE_LABEL.service_area).toBe('Comes to you')
  })
})

describe('EntityAtAGlance', () => {
  const src = source('components/entity-page/EntityAtAGlance.tsx')

  it('renders the shared label', () => {
    expect(src).toContain('LOCATION_TYPE_META[entity.location_type].label')
  })

  it('no longer hyphen-replaces and capitalizes the raw value', () => {
    // The transform that did nothing. Its presence is what made the bug look
    // handled during review.
    expect(src).not.toMatch(/location_type\.replace\(/)
  })
})
