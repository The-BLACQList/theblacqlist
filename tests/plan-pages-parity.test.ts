// Ticket 238: the pages a plan covers live in two places, TIER_LIMITS (the
// app's copy and the owner's "N of M Pages Covered") and plan_page_cap() in
// the migration (what the database enforces). This keeps them equal for every
// paid plan. Free is 0 in the database on purpose: the table only records
// paid coverage, and a Free owner's pages are all Free pages.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { TIER_LIMITS, pageCap } from '@/lib/stripe/features'

const SQL = readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20261201000000_owner_plan_pages.sql'),
  'utf8'
)

function sqlCaps(): Record<string, number> {
  const fn = SQL.slice(SQL.indexOf('FUNCTION public.plan_page_cap'))
  const body = fn.slice(0, fn.indexOf('$$;'))
  const caps: Record<string, number> = {}
  for (const m of body.matchAll(/WHEN '(\w+)'\s+THEN (\d+)/g)) caps[m[1]!] = Number(m[2])
  return caps
}

describe('pages a plan covers', () => {
  it('matches the founder decision: Free 1, Starter 1, Growth 2, Premium 3', () => {
    expect(['free', 'starter', 'growth', 'premium'].map((t) => pageCap(t))).toEqual([1, 1, 2, 3])
    expect(pageCap(null)).toBe(1)
    expect(pageCap('unknown')).toBe(1)
  })

  it('is the same in the database for every paid plan', () => {
    const caps = sqlCaps()
    expect(caps).toEqual({
      premium: TIER_LIMITS.premium.pagesCovered,
      growth: TIER_LIMITS.growth.pagesCovered,
      starter: TIER_LIMITS.starter.pagesCovered,
    })
  })
})
