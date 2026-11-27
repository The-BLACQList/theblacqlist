// =============================================================================
// Ticket 289: plan lines follow the jobs switch
// =============================================================================
// Founder 2026-11-27: "We'll take jobs off altogether." With FEATURE_JOBS_OPEN
// off, /jobs and /add-job are closed, so no plan card, compare row, /pricing
// line or Cue plan answer may sell job postings. With jobs open, every line is
// exactly as written before.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { PLANS, planFeatures } from '@/lib/stripe/plans'
import { planCompareGroups, visibleCompareGroups } from '@/lib/stripe/planCompare'

const read = (f: string) => readFileSync(path.resolve(process.cwd(), f), 'utf8')
const ALL_OPEN = { free: true, starter: true, growth: true, premium: true }

describe('plan lines with jobs closed (ticket 289)', () => {
  it('no plan line mentions a job', () => {
    for (const p of PLANS) {
      for (const line of planFeatures(p, { jobsOpen: false })) {
        expect(line, `${p.slug}: ${line}`).not.toMatch(/\bjobs?\b/i)
      }
      expect(p.finePrint ?? '', p.slug).not.toMatch(/\bjobs?\b/i)
    }
  })

  it('keeps every other line, in order', () => {
    for (const p of PLANS) {
      const closed = planFeatures(p, { jobsOpen: false })
      const kept = p.features.filter((l) => !/\bjob posting/i.test(l))
      expect(closed.length, p.slug).toBe(kept.length)
    }
  })

  it('with jobs open, the lines are exactly as written', () => {
    for (const p of PLANS) {
      expect(planFeatures(p, { jobsOpen: true })).toEqual(p.features)
    }
    // Non-vacuity: Growth and Premium do sell job postings when open.
    const growth = PLANS.find((p) => p.slug === 'growth')!
    const premium = PLANS.find((p) => p.slug === 'premium')!
    expect(growth.features.some((l) => /job/i.test(l))).toBe(true)
    expect(premium.features.some((l) => /job/i.test(l))).toBe(true)
  })

  it('the compare grid has no job row or job wording', () => {
    for (const groups of [
      planCompareGroups({ jobsOpen: false }),
      visibleCompareGroups(ALL_OPEN, { jobsOpen: false }),
    ]) {
      for (const g of groups) {
        expect(g.title).not.toMatch(/hiring|\bjobs?\b/i)
        for (const r of g.rows) {
          expect(r.label).not.toMatch(/\bjobs?\b/i)
          expect(r.note ?? '').not.toMatch(/\bjobs?\b/i)
        }
      }
    }
    const open = planCompareGroups().flatMap((g) => g.rows.map((r) => r.label))
    expect(open).toContain('Job postings every 30 days')
  })

  it('every page that prints plans reads the jobs switch', () => {
    for (const f of [
      'app/(public)/pricing/page.tsx',
      'app/(public)/for-business/page.tsx',
      'app/dashboard/upgrade/page.tsx',
    ]) {
      expect(read(f), f).toMatch(/isFeatureEnabled\('jobsOpen'\)/)
    }
    // Every /pricing sentence that names jobs is behind the switch.
    const pricing = read('app/(public)/pricing/page.tsx')
    for (const m of pricing.matchAll(/^.*\bjobs?\b.*$/gim)) {
      if (/jobsOpen|isFeatureEnabled|^\s*(\/\/|\*)/.test(m[0])) continue
      throw new Error(`/pricing names jobs outside the switch: ${m[0].trim()}`)
    }
    expect(read('lib/ai/cue/owner/help.ts')).toMatch(/planFeatures\(p, \{ jobsOpen \}\)/)
    for (const f of [
      'app/(public)/pricing/PricingPlans.tsx',
      'app/dashboard/upgrade/UpgradePlans.tsx',
    ]) {
      expect(read(f), f).not.toMatch(/plan\.features/)
    }
  })
})
