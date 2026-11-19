// =============================================================================
// Review author short names (founder, 2026-11-19: "fix it", on Creative's #360
// notes). Migration 20261130000000_review_name_format.sql replaces
// short_display_name(); review_author_names() is unchanged.
//
// The first block reads the source and always runs. The second runs the real
// function on a scratch Postgres (tests/migrations/helpers.ts) and skips when
// none is reachable, as the other migration tests do. Staging and prod are
// en_US.UTF-8, so run it on a UTF-8 database for the accented cases.
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DB_REACHABLE, MIGRATIONS_DIR, applyFile, query, withScratchDb } from './helpers'

const FILE = path.join(MIGRATIONS_DIR, '20261130000000_review_name_format.sql')
const sql = readFileSync(FILE, 'utf8')

// [Display Name as typed, what a review shows]
const CASES: [string | null, string | null][] = [
  ['Jasmine Renee Roberts', 'Jasmine R.'],
  ['Jasmine', 'Jasmine'],
  ['  Jasmine   Roberts  ', 'Jasmine R.'],
  ['jasmine roberts', 'Jasmine R.'],
  ['DeShawn mcKay', 'DeShawn M.'],
  ['Marcus Taylor Jr.', 'Marcus T.'],
  ['Marcus Taylor, Jr.', 'Marcus T.'],
  ['Owen Price III', 'Owen P.'],
  ['Marcus Jr', 'Marcus'],
  ['Owen V', 'Owen V.'],
  ['Dr. Priya Nair', 'Priya N.'],
  ['Dr. Priya Nair Jr.', 'Priya N.'],
  ['Dr. Nair', 'Dr. N.'],
  ['Roberts, Jasmine', 'Jasmine R.'],
  ['Kofi (KA)', 'Kofi K.'],
  ['Kofi 🙂', 'Kofi'],
  ['🙂 Kofi Asante', 'Kofi A.'],
  ['José ñúñez', 'José Ñ.'],
  ['jroberts88', 'Jroberts88'],
  ['jasmine@example.com', null],
  ['Jasmine R @home', null],
  ['🙂', null],
  ['   ', null],
  ['', null],
  [null, null],
]

describe('review name format migration (source)', () => {
  it('replaces short_display_name only', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION short_display_name\(p_name text\)/)
    expect(sql).not.toMatch(/FUNCTION review_author_names/)
    expect(sql).not.toMatch(/(CREATE|DROP|ALTER) POLICY|ALTER TABLE|GRANT|REVOKE/)
  })

  it('stays immutable with a pinned search_path and is not a definer', () => {
    expect(sql).toMatch(/IMMUTABLE\nSET search_path = public/)
    expect(sql).not.toMatch(/SECURITY DEFINER/)
  })

  it('still never shows anything with an @', () => {
    expect(sql).toMatch(/position\('@' IN p_name\) > 0 THEN\s+RETURN NULL/)
  })
})

describe.skipIf(!DB_REACHABLE)('migration 20261130000000 (review name format)', () => {
  it('shortens each Display Name as the founder decided', async () => {
    await withScratchDb('review_name_format', (url) => {
      applyFile(url, FILE)
      const lit = (s: string | null) => (s === null ? 'NULL' : `'${s.replace(/'/g, "''")}'`)
      const rows = query<{ i: number; out: string | null }>(
        url,
        CASES.map(([name], i) => `SELECT ${i} AS i, short_display_name(${lit(name)}) AS out`).join(
          ' UNION ALL '
        )
      )
      const got = new Map(rows.map((r) => [r.i, r.out]))
      for (const [i, [name, want]] of CASES.entries()) {
        expect([name, got.get(i)]).toEqual([name, want])
      }
    })
  })
})
