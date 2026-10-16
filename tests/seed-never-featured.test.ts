// =============================================================================
// Seed data never marks a listing Featured
// =============================================================================
// Featured is earned weekly by award_weekly_featured()
// (20261005000000_earned_featured.sql). The city corpus files used to carry
// "is_featured": true on 3 to 6 listings each, and the seed script copied the
// flag through. The 2026-10-15 batch put 30 unearned flags on prod, and
// because /discover sorts featured first, every card on the first page read
// "Featured" (founder report 2026-10-16).
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const DATA_DIR = join(__dirname, '..', 'scripts', 'data')
const corpusFiles = readdirSync(DATA_DIR).filter((f) => /^listings-.+\.json$/.test(f))

describe('seed data and Featured', () => {
  it('finds the city corpus files', () => {
    expect(corpusFiles.length).toBeGreaterThan(0)
  })

  it.each(corpusFiles)('%s has no listing marked featured', (file) => {
    const rows = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')) as { is_featured?: boolean }[]
    expect(rows.filter((r) => r.is_featured === true)).toEqual([])
  })

  it('the seed script writes is_featured: false, never the corpus value', () => {
    const src = readFileSync(join(__dirname, '..', 'scripts', 'seed-launch-listings.ts'), 'utf8')
    expect(src).toContain('is_featured: false,')
    expect(src).not.toMatch(/is_featured:\s*listing\.is_featured/)
  })
})
