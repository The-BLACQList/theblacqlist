import { describe, expect, it } from 'vitest'
import {
  CLOSE_UP_DESK,
  CLOSE_UP_PHONE,
  buildCloseUp,
  closeUpFloorY,
  closeUpLineCount,
  closeUpPulseCount,
} from '@/lib/spend/collective-closeup'
import { CATEGORY_FAMILIES } from '@/lib/spend/silo-layout'

describe('closeUpLineCount', () => {
  it.each([
    [0, 0],
    [1, 3],
    [9, 3],
    [10, 8],
    [49, 8],
    [50, 14],
    [199, 14],
    [200, 20],
    [100_000, 20],
  ])('%i purchases light %i lines', (purchases, lines) => {
    expect(closeUpLineCount(purchases, 1_000)).toBe(lines)
  })

  it('never draws more lines than there are businesses', () => {
    expect(closeUpLineCount(9, 1)).toBe(1)
    expect(closeUpLineCount(49, 6)).toBe(6)
    expect(closeUpLineCount(1_204, 12)).toBe(12)
    expect(closeUpLineCount(500, 0)).toBe(0)
  })
})

describe('closeUpPulseCount', () => {
  it('runs from one pulse to five, and none without a line', () => {
    expect(closeUpPulseCount(0)).toBe(0)
    expect(closeUpPulseCount(1)).toBe(1)
    expect(closeUpPulseCount(3)).toBe(1)
    expect(closeUpPulseCount(20)).toBe(5)
  })
})

describe.each([
  ['desk', CLOSE_UP_DESK],
  ['phone', CLOSE_UP_PHONE],
])('buildCloseUp on %s', (_name, view) => {
  it('draws the same picture every time', () => {
    expect(buildCloseUp(14, view)).toEqual(buildCloseUp(14, view))
  })

  it('shows dots and no lines before the first receipt', () => {
    const art = buildCloseUp(0, view)
    expect(art.lines).toEqual([])
    expect(art.pulses).toEqual([])
    expect(art.dots.some((dot) => dot.lit)).toBe(false)
    expect(art.dots).toHaveLength(49)
  })

  it('starts every line on the Shoppers floor and ends it on a lit dot', () => {
    const art = buildCloseUp(20, view)
    expect(art.lines).toHaveLength(20)

    for (const line of art.lines) {
      const boardX = line.from.x / view.k + view.ox
      expect(line.from.y).toBeCloseTo(closeUpFloorY(boardX, -6) * view.k, 0)
      expect(art.dots.some((dot) => dot.lit && dot.x === line.to.x && dot.y === line.to.y)).toBe(
        true
      )
    }
  })

  it('lights one dot per line', () => {
    expect(buildCloseUp(8, view).dots.filter((dot) => dot.lit)).toHaveLength(8)
  })

  it('only uses the Silo family colors', () => {
    const colors = new Set(CATEGORY_FAMILIES.map((family) => family.color))
    for (const dot of buildCloseUp(20, view).dots) expect(colors.has(dot.color)).toBe(true)
  })
})
