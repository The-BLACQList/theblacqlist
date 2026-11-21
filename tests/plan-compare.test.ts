// =============================================================================
// Ticket 239: the plan comparison grid
// =============================================================================
// Founder 2026-11-21: side by side, it must be obvious how much more each step
// up gives. The grid on /pricing and Upgrade is built from the limits the code
// enforces, so these checks pin it to lib/stripe/features.ts, and keep the
// rule that a tier nobody can buy shows no values.
// =============================================================================

import { describe, it, expect } from 'vitest'

import {
  COMPARE_TIERS,
  compareOpen,
  planCompareGroups,
  visibleCompareGroups,
  type CompareCell,
  type CompareRow,
} from '@/lib/stripe/planCompare'
import { canAccess, photoLimit, videoLimit } from '@/lib/stripe/features'
import type { PlanAvailability } from '@/lib/stripe/availability'

function findRow(label: string, groups = planCompareGroups()): CompareRow {
  const r = groups.flatMap((g) => g.rows).find((x) => x.label === label)
  if (!r) throw new Error(`no row ${label}`)
  return r
}

const text = (c: CompareCell) => (c.kind === 'value' ? c.text : c.kind)
const ALL_OPEN = { free: true, starter: true, growth: true, premium: true }

describe('planCompareGroups', () => {
  it('prints the photo and video limits the code enforces', () => {
    const photos = findRow('Photos')
    const videos = findRow('Videos')
    for (const tier of COMPARE_TIERS) {
      expect(text(photos.cells[tier])).toBe(String(photoLimit(tier)))
      const v = videoLimit(tier)
      expect(text(videos.cells[tier])).toBe(v === 0 ? 'no' : v === null ? 'No limit' : String(v))
    }
  })

  it('marks a step up only where a plan beats the one to its left', () => {
    const photos = findRow('Photos')
    // Free is the baseline, so nothing in its column is gold.
    expect(photos.cells.free).toEqual({ kind: 'value', text: '3', up: false })
    expect(photos.cells.starter).toMatchObject({ text: '10', up: true })
    expect(photos.cells.premium).toMatchObject({ text: '50', up: true })
    // Map pin is the same on every plan: no gold after Free.
    const pin = findRow('Map pin')
    expect(pin.cells.starter).toEqual({ kind: 'yes', up: false })
  })

  it('shows the full page layout from Starter, matching the gate', () => {
    const layout = findRow('Full page layout')
    expect(canAccess('free', 'chapters_layout')).toBe(false)
    expect(layout.cells.free).toEqual({ kind: 'no' })
    expect(layout.cells.starter).toEqual({ kind: 'yes', up: true })
    expect(layout.cells.growth).toEqual({ kind: 'yes', up: false })
  })

  it('prints analytics history as 30 days on Starter and 12 months on Growth', () => {
    const a = findRow('Views, saves, and taps')
    expect(a.cells.free).toEqual({ kind: 'no' })
    expect(text(a.cells.starter)).toBe('30 days')
    expect(a.cells.growth).toMatchObject({ text: '12 months', up: true })
  })

  it('never marks a Free cell as a step up', () => {
    for (const r of planCompareGroups().flatMap((g) => g.rows)) {
      const c = r.cells.free
      if (c.kind !== 'no') expect(c.up).toBe(false)
    }
  })

  it('prints unlimited as No limit', () => {
    expect(text(findRow('Common questions').cells.growth)).toBe('No limit')
  })

  // Ticket 238: Free's pages are never stated, so the grid has no pages row.
  it('has no pages row', () => {
    const labels = planCompareGroups().flatMap((g) => g.rows.map((r) => r.label.toLowerCase()))
    expect(labels.some((l) => l.includes('pages'))).toBe(false)
  })

  it('has no em dashes', () => {
    for (const g of planCompareGroups()) {
      expect(g.title).not.toContain('—')
      for (const r of g.rows) {
        expect(r.label).not.toContain('—')
        expect(r.note ?? '').not.toContain('—')
      }
    }
  })
})

describe('visibleCompareGroups', () => {
  it('keeps every row while every plan is open', () => {
    const all = planCompareGroups().flatMap((g) => g.rows).length
    expect(visibleCompareGroups(ALL_OPEN).flatMap((g) => g.rows)).toHaveLength(all)
  })

  it('drops rows only a closed plan would fill', () => {
    const open = { free: true, starter: true, growth: true, premium: false }
    const labels = visibleCompareGroups(open).flatMap((g) => g.rows.map((r) => r.label))
    expect(labels).not.toContain('Coupons and deals')
    expect(labels).not.toContain('A named support contact')
    expect(labels).toContain('Storefront products and services')
  })

  it('with only Free and Starter open, Growth-only rows go too', () => {
    const open = { free: true, starter: true, growth: false, premium: false }
    const labels = visibleCompareGroups(open).flatMap((g) => g.rows.map((r) => r.label))
    expect(labels).not.toContain('Storefront products and services')
    expect(labels).not.toContain('Events at a time')
    expect(labels).toContain('Full page layout')
  })
})

describe('compareOpen', () => {
  const availability = {
    starter: { monthly: true, annual: true },
    growth: { monthly: false, annual: false },
    premium: { monthly: false, annual: false },
  } as unknown as PlanAvailability

  it('opens Free and any plan for sale', () => {
    expect(compareOpen(availability)).toEqual({
      free: true,
      starter: true,
      growth: false,
      premium: false,
    })
  })

  it('opens the owner’s own plan even when it has stopped selling', () => {
    expect(compareOpen(availability, 'growth').growth).toBe(true)
  })
})
