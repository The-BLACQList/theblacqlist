import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { planCategoryTitleCase } from '@/lib/categories/title-case-plan'
import { toTitleCase } from '@/lib/text/title-case'

// Ticket 205. Labels saved in the database follow the same Title Case rule as
// the source (docs/blacqlist/design/title-case.md).

const root = path.resolve(__dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

describe('seeded labels', () => {
  it('seeds every category name in Title Case', () => {
    const seed = read('supabase/seed.sql')
    const names = [
      ...seed.matchAll(/\(\s*'c0[0-9a-f-]{34}'\s*,\s*'((?:[^']|'')+)'\s*,\s*'[a-z0-9-]+'/g),
    ].map((m) => m[1]!.replace(/''/g, "'"))
    expect(names.length).toBeGreaterThan(200)
    expect(names.filter((n) => toTitleCase(n) !== n)).toEqual([])
  })

  it('migrates the old quick-start presets to the casing new pages get', () => {
    const sql = read('supabase/migrations/20261119000000_title_case_saved_labels.sql')
    const quickStart = read('lib/listings/quickStart.ts')
    for (const [from, to] of [
      ['Email me', 'Email Me'],
      ['Follow me', 'Follow Me'],
      ['Work with me', 'Work with Me'],
    ]) {
      expect(sql).toMatch(new RegExp(`WHEN '${from}'\\s+THEN '${to}'`))
      expect(quickStart).toContain(`labelOverride: '${to}'`)
    }
  })
})

describe('planCategoryTitleCase', () => {
  it('renames only names that are not in Title Case', () => {
    expect(
      planCategoryTitleCase([
        { id: '1', slug: 'hair-braiding', name: 'Hair braiding' },
        { id: '2', slug: 'hr-staffing', name: 'HR & Staffing' },
        { id: '3', slug: 'food-dining', name: 'Food & Dining' },
        { id: '4', slug: 'black-owned-books', name: 'Black-owned books and more' },
      ])
    ).toEqual([
      { id: '1', slug: 'hair-braiding', from: 'Hair braiding', to: 'Hair Braiding' },
      {
        id: '4',
        slug: 'black-owned-books',
        from: 'Black-owned books and more',
        to: 'Black-Owned Books and More',
      },
    ])
  })
})
