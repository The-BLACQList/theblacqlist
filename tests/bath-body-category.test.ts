// =============================================================================
// Bath & Body subcategory (ticket 257)
// =============================================================================
// The migration and supabase/seed.sql must agree on the id, slug and parent,
// so every environment files the same listings under the same row. The search
// words and the add-business guide must point at it.
// =============================================================================

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

import { GUIDE_ANSWERS } from '@/lib/categories/sorting-guide'
import { CATEGORY_KEYWORDS } from '@/lib/search/categoryKeywords'

const ID = 'c0000002-0022-0000-0000-000000000008'
const RETAIL = 'c0000001-0000-0000-0000-000000000022'
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('Bath & Body', () => {
  it('is added under Retail & Gifts by slug, and a re-run does nothing', () => {
    const sql = read('supabase/migrations/20261205000000_bath_body_subcategory.sql')
    expect(sql).toMatch(new RegExp(`'${ID}',\\s*'Bath & Body',\\s*'bath-body',\\s*'retail-gifts',\\s*8`))
    expect(sql).toContain('JOIN categories p ON p.slug = v.parent_slug AND p.parent_id IS NULL')
    expect(sql).toContain('ON CONFLICT (slug) DO NOTHING')
    // Additive only.
    expect(sql.replace(/^--.*$/gm, '')).not.toMatch(/\b(DELETE|UPDATE|DROP|ALTER)\b/i)
  })

  it('has the same row in seed.sql', () => {
    expect(read('supabase/seed.sql')).toMatch(
      new RegExp(`'${ID}',\\s*'Bath & Body',\\s*'bath-body',\\s*'${RETAIL}',\\s*8,\\s*true`)
    )
  })

  it('owns the bath words, which Health & Wellness Products gave up', () => {
    for (const w of ['soap', 'lotion', 'body butter', 'shea butter', 'deodorant', 'toiletries']) {
      expect(CATEGORY_KEYWORDS['bath-body'], w).toContain(w)
      expect(CATEGORY_KEYWORDS['health-wellness-products'], w).not.toContain(w)
    }
  })

  it('is offered to makers on the add-business guide', () => {
    const make = GUIDE_ANSWERS.find((a) => a.id === 'make_sell')!
    expect(make.candidates.map((c) => c.slug)).toContain('bath-body')
  })
})
