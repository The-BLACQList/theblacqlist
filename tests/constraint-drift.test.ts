// =============================================================================
// Value-set drift — DB CHECK ↔ constants ↔ zod ↔ discovery UI
// =============================================================================
// The same defect has now shipped twice, in the same file, three lines apart:
//
//   * `entity_type` — the TS union omitted 'restaurant' and 'service_provider',
//     so `/discover?type=service_provider` was a silent 400 on a legitimate URL
//     from May until 2026-08-13.
//   * `location_type` — the TS union was still the ORIGINAL 20260510000000 value
//     set, superseded by 20260524000001 in May. That migration didn't just widen
//     the CHECK, it RENAMED the data (online → virtual, virtual-services →
//     service_area, ships-nationwide → national), so three of the union's five
//     values could not match a row even in principle, and the four values the DB
//     actually serves were rejected by the search validator. Found 2026-08-15.
//
// Both were invisible: the page renders, the query runs, the filter just returns
// nothing or 400s. Nobody sees a stack trace. So the chain is pinned end to end
// here, and every link is asserted against the migration SQL rather than against
// another copy of the same list.
//
// The last describe block is the one that would have caught the *second* bug
// before a user did: a value the DB serves with no way to reach it in the UI.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { VALID_ENTITY_TYPES, VALID_LOCATION_TYPES } from '@/lib/constants/listing'
import { searchSchema } from '@/lib/validations/search'
import { ENTITY_TYPES, LOCATION_TYPES } from '@/components/discovery/facetConstants'

function migration(file: string): string {
  return readFileSync(path.resolve(process.cwd(), 'supabase/migrations', file), 'utf8')
}

function source(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8')
}

/** Pulls the value list out of `CHECK (<column> IN ('a','b',...))`. */
function checkValues(sql: string, column: string): string[] {
  const m = sql.match(new RegExp(`CHECK\\s*\\(\\s*${column}\\s+IN\\s*\\(([^)]*)\\)`, 'i'))
  if (!m?.[1]) throw new Error(`no CHECK (${column} IN (...)) found — the regex went stale`)
  return Array.from(m[1].matchAll(/'([^']+)'/g)).map((v) => v[1] as string)
}

// ── The constants match the live CHECK constraints ──────────────────────────

describe('lib/constants/listing.ts matches the migrations', () => {
  it('the parser actually finds values — a regex matching nothing would pass every test below', () => {
    const found = checkValues(
      migration('20260524000001_fix_entity_location_cta_constraints.sql'),
      'location_type'
    )
    expect(found.length).toBe(6)
  })

  it('VALID_LOCATION_TYPES is exactly the 20260524000001 CHECK', () => {
    // 20260524000001 is the last migration to touch listings_location_type_check.
    // If a later migration adds one, this test is where it gets noticed.
    const fromSql = checkValues(
      migration('20260524000001_fix_entity_location_cta_constraints.sql'),
      'location_type'
    )
    expect([...VALID_LOCATION_TYPES].sort()).toEqual([...fromSql].sort())
  })

  it('VALID_ENTITY_TYPES is exactly the 20260813000000 CHECK — the newest one', () => {
    const fromSql = checkValues(migration('20260813000000_job_entity.sql'), 'entity_type')
    expect([...VALID_ENTITY_TYPES].sort()).toEqual([...fromSql].sort())
  })

  it('carries none of the superseded location values 20260524000001 renamed away', () => {
    // These three were UPDATE'd into their new names by that migration, so a row
    // holding one cannot exist. Their presence in any value set is dead weight
    // that filters to zero and reads like a working filter.
    for (const dead of ['online', 'virtual-services', 'ships-nationwide']) {
      expect(VALID_LOCATION_TYPES as readonly string[]).not.toContain(dead)
    }
  })
})

// ── The search validator accepts everything the DB serves ───────────────────

describe('searchSchema accepts every value the DB can return', () => {
  it.each(VALID_ENTITY_TYPES)('type=%s parses', (value) => {
    expect(searchSchema.safeParse({ type: value }).success).toBe(true)
  })

  it.each(VALID_LOCATION_TYPES)('location_type=%s parses', (value) => {
    expect(searchSchema.safeParse({ location_type: value }).success).toBe(true)
  })

  it('still rejects a value the DB cannot hold', () => {
    expect(searchSchema.safeParse({ location_type: 'online' }).success).toBe(false)
    expect(searchSchema.safeParse({ type: 'nonprofit' }).success).toBe(false)
  })
})

// ── Every value is reachable from the discovery UI ──────────────────────────

describe('the discovery sidebar can reach every value', () => {
  it('offers a chip for every entity_type', () => {
    expect(ENTITY_TYPES.map((t) => t.value).sort()).toEqual([...VALID_ENTITY_TYPES].sort())
  })

  it('offers a chip for every location_type', () => {
    expect(LOCATION_TYPES.map((t) => t.value).sort()).toEqual([...VALID_LOCATION_TYPES].sort())
  })

  it('labels every option in plain language, never the raw slug', () => {
    for (const { value, label } of [...ENTITY_TYPES, ...LOCATION_TYPES]) {
      expect(label).not.toBe(value)
      expect(label).not.toMatch(/_/)
    }
  })

  it('both filter keys are clearable — "Clear all" reads FACET_KEYS', () => {
    // Read as source rather than imported: useFacetParams.ts is a 'use client'
    // module that pulls in next/navigation, which does not load under this
    // suite's `environment: 'node'`. The list is a plain literal, so the text
    // is as authoritative as the binding.
    const facetKeys = source('components/discovery/useFacetParams.ts').match(
      /export const FACET_KEYS = \[([^\]]*)\]/
    )?.[1]
    expect(facetKeys).toBeDefined()
    expect(facetKeys).toContain("'type'")
    expect(facetKeys).toContain("'location_type'")
  })
})
