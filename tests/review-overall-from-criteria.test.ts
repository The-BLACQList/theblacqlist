import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { overallFromCriteria } from '@/lib/reviews/overall'

const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8')

describe('overallFromCriteria', () => {
  it('returns null when nothing is rated', () => {
    expect(overallFromCriteria([])).toBeNull()
    expect(overallFromCriteria([0, 0])).toBeNull()
  })

  it('uses a single rating as the overall', () => {
    expect(overallFromCriteria([4])).toEqual({ average: 4, stars: 4, count: 1 })
  })

  it('averages and rounds to the nearest whole star', () => {
    expect(overallFromCriteria([5, 4, 4])).toMatchObject({ stars: 4, count: 3 })
    expect(overallFromCriteria([5, 4, 4])?.average).toBeCloseTo(4.333, 3)
    expect(overallFromCriteria([5, 4])).toMatchObject({ average: 4.5, stars: 5 })
    expect(overallFromCriteria([3, 4])).toMatchObject({ average: 3.5, stars: 4 })
    expect(overallFromCriteria([1, 2, 2, 2])).toMatchObject({ average: 1.75, stars: 2 })
  })

  it('ignores values outside 1 to 5 and non-whole numbers', () => {
    expect(overallFromCriteria([0, 6, -1, 2.5, NaN, 3])).toEqual({ average: 3, stars: 3, count: 1 })
  })
})

describe('the overall rating comes from the categories', () => {
  const action = read('lib/actions/reviews/createReview.ts')
  const form = read('components/entity-page/ReviewForm.tsx')

  it('the server derives the rating with the shared helper', () => {
    expect(action).toMatch(/overallFromCriteria\(/)
  })

  it('the server only keeps category ids that are active criteria', () => {
    expect(action).toMatch(/from\('review_criteria'\)/)
    expect(action).toMatch(/activeCriterionIds\.has\(/)
  })

  it('the form shows the same computed overall', () => {
    expect(form).toMatch(/overallFromCriteria\(/)
  })

  it('the form explains why submit is unavailable instead of a silent grey button', () => {
    expect(form).toMatch(/aria-describedby=\{rating === 0 \? HINT_ID : undefined\}/)
  })
})
