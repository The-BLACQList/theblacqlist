// =============================================================================
// lib/listings/subcategoryApplyPlan.ts: the checks the ticket 170 apply script
// runs on a decided sheet before it writes anything.
// =============================================================================
// APPLY stays inside the listing's current group. MOVE may cross groups, for
// listings filed in the wrong one. Both must land on a subcategory.
// =============================================================================

import { describe, it, expect } from 'vitest'

import { planSubcategoryRows, type PlanCategory, type SheetRow } from '@/lib/listings/subcategoryApplyPlan'

const FOOD = 'g-food'
const ARTS = 'g-arts'
const cats = new Map<string, PlanCategory>(
  [
    { id: FOOD, name: 'Food & Dining', parent_id: null },
    { id: ARTS, name: 'Arts & Culture', parent_id: null },
    { id: 'c-bakery', name: 'Bakeries', parent_id: FOOD },
    { id: 'c-theater', name: 'Theater', parent_id: ARTS },
  ].map((c) => [c.id, c])
)

const row = (over: Partial<SheetRow>): SheetRow => ({
  listing_id: 'L1',
  name: 'Test',
  current_category_id: FOOD,
  suggested_category_id: 'c-bakery',
  DECISION: 'APPLY',
  ...over,
})

describe('planSubcategoryRows', () => {
  it('plans an APPLY to a child of the same group', () => {
    const plan = planSubcategoryRows([row({})], cats)
    expect(plan.problems).toEqual([])
    expect(plan.planned).toEqual([
      { id: 'L1', name: 'Test', decision: 'APPLY', from: FOOD, to: 'c-bakery', toName: 'Bakeries' },
    ])
  })

  it('refuses an APPLY that crosses groups and points at MOVE', () => {
    const plan = planSubcategoryRows([row({ suggested_category_id: 'c-theater' })], cats)
    expect(plan.planned).toEqual([])
    expect(plan.problems[0]).toMatch(/Use MOVE/)
  })

  it('plans a MOVE across groups', () => {
    const plan = planSubcategoryRows([row({ DECISION: 'move', suggested_category_id: 'c-theater' })], cats)
    expect(plan.problems).toEqual([])
    expect(plan.planned[0]).toMatchObject({ decision: 'MOVE', from: FOOD, to: 'c-theater' })
  })

  it('refuses a MOVE onto a top-level group', () => {
    const plan = planSubcategoryRows([row({ DECISION: 'MOVE', suggested_category_id: ARTS })], cats)
    expect(plan.planned).toEqual([])
    expect(plan.problems[0]).toMatch(/top-level group/)
  })

  it('refuses a move to where the listing already is', () => {
    const plan = planSubcategoryRows(
      [row({ DECISION: 'MOVE', current_category_id: 'c-theater', suggested_category_id: 'c-theater' })],
      cats
    )
    expect(plan.problems[0]).toMatch(/already in "Theater"/)
  })

  it('refuses an unknown category id', () => {
    const plan = planSubcategoryRows([row({ suggested_category_id: 'nope' })], cats)
    expect(plan.problems[0]).toMatch(/is not a category/)
  })

  it('counts SKIP and blank as skipped, flags anything else', () => {
    const plan = planSubcategoryRows(
      [row({ DECISION: 'SKIP' }), row({ listing_id: 'L2', DECISION: '' }), row({ listing_id: 'L3', DECISION: 'maybe' })],
      cats
    )
    expect(plan.planned).toEqual([])
    expect(plan.skipped).toBe(3)
    expect(plan.problems).toEqual(['line 4: DECISION "maybe" is not APPLY, MOVE or SKIP'])
  })

  it('flags a listing that appears twice', () => {
    const plan = planSubcategoryRows([row({}), row({})], cats)
    expect(plan.planned).toHaveLength(1)
    expect(plan.problems[0]).toMatch(/appears twice/)
  })

  it('flags blank ids', () => {
    const plan = planSubcategoryRows(
      [
        row({ listing_id: '' }),
        row({ listing_id: 'L2', current_category_id: '' }),
        row({ listing_id: 'L3', suggested_category_id: '' }),
      ],
      cats
    )
    expect(plan.planned).toEqual([])
    expect(plan.problems).toHaveLength(3)
  })
})
