import { describe, expect, it } from 'vitest'
import { framePadding, MIN_FRAME } from '@/lib/map/framePadding'

// Ticket 285: the map must always have something left to frame into.
describe('framePadding', () => {
  it('clears the bar and the sheet on a tall phone', () => {
    expect(framePadding({ boxHeight: 788, bar: 134, sheet: 351 })).toEqual({ top: 142, bottom: 359, left: 16, right: 16 })
  })

  it.each([334, 319, 200, 80, 40])('leaves room to frame in a %ipx map', (boxHeight) => {
    const { top, bottom } = framePadding({ boxHeight, bar: 134, sheet: 351 })
    expect(top + bottom).toBeLessThanOrEqual(Math.max(0, boxHeight - MIN_FRAME))
  })
})
