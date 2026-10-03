// =============================================================================
// Seeds never invent a listing's identity or amenity tags (2026-10-03)
// =============================================================================
// Founder: "I see at least 2 businesses that are labelled "Black-Man Owned" but
// are described as "Black-Woman Owned" remove all of the ownership labels untill
// owners choose themselves."
//
// The attribute backfill handed out Black-Woman-Owned to even rows and
// Black-Man-Owned to odd rows, plus veteran, minority-certified, wheelchair
// access, parking and dietary tags the same way. Only an owner can state those.
// The one tag a seed may attach is Black-Owned, and only where the researched
// listings.ownership_label says black_owned.
// =============================================================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..')
const BLACK_OWNED = 'a2000000-0001-0000-0000-000000000001'

function sqlFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = path.join(dir, name)
    if (statSync(path.join(ROOT, rel)).isDirectory()) return sqlFiles(rel)
    return name.endsWith('.sql') ? [rel] : []
  })
}

/** Every INSERT INTO listing_attributes statement, up to its semicolon, comments stripped. */
function attributeInserts(rel: string): string[] {
  const src = readFileSync(path.join(ROOT, rel), 'utf8').replace(/--.*$/gm, '')
  return [...src.matchAll(/INSERT INTO listing_attributes[\s\S]*?;/gi)].map((m) => m[0])
}

const FILES = ['supabase/seed.sql', ...sqlFiles('supabase/seeds'), ...sqlFiles('scripts')]

describe('seeded listing tags', () => {
  it('finds the backfill files it guards', () => {
    expect(FILES).toContain('supabase/seeds/003_attribute_backfill.sql')
    expect(FILES).toContain('scripts/staging-attributes-seed.sql')
  })

  for (const rel of FILES) {
    const inserts = attributeInserts(rel)
    if (inserts.length === 0) continue

    it(`${rel} attaches only Black-Owned, and only from ownership_label`, () => {
      for (const sql of inserts) {
        const ids = sql.match(/a2000000-\d{4}-0000-0000-\d{12}/g) ?? []
        expect(ids, sql).toEqual([BLACK_OWNED])
        expect(sql).toMatch(/ownership_label\s*=\s*'black_owned'/)
        expect(sql).not.toMatch(/row_number\(\)|%\s*\d/)
      }
    })
  }
})
