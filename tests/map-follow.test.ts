// =============================================================================
// Ticket 244: the selected pin stays centred on a phone
// =============================================================================
// Founder 2026-11-21: on a phone the selected pin sits in the middle of the map
// the visitor can see (between the search bar and the card sheet) until they
// move the map. followOffset is the maths behind that.
// =============================================================================
import { describe, it, expect } from 'vitest'
import { followOffset, markLift, MIN_STRIP } from '@/lib/map/followOffset'
import { NAME_PILL_HEIGHT, TILE_TOP_LIFT } from '@/lib/map/popupOffset'

// A 390x844 phone: map box from 56 to 844, bar to 190, sheet from 470.
const PHONE = { mapTop: 56, mapBottom: 844, barBottom: 190, sheetTop: 470 }

describe('followOffset', () => {
  it('puts a dot in the middle of the strip between bar and sheet', () => {
    const [x, y] = followOffset(PHONE, 'dot')
    expect(x).toBe(0)
    // Strip middle 330, box middle 450: the point lands 120px above centre.
    expect(y).toBe(330 - 450)
  })

  it('centres a square on its tile and name, not on its tip', () => {
    const [, y] = followOffset(PHONE, 'tile')
    expect(y).toBe(330 - 450 + markLift('tile'))
    // The tip sits below the middle by half of what rises above it less the pill.
    expect(markLift('tile')).toBe((TILE_TOP_LIFT - NAME_PILL_HEIGHT) / 2)
    expect(markLift('dot')).toBe(0)
  })

  it('follows the sheet as it grows', () => {
    const closed = followOffset(PHONE, 'dot')[1]
    const open = followOffset({ ...PHONE, sheetTop: 320 }, 'dot')[1]
    expect(open).toBeLessThan(closed)
  })

  it('uses the whole box when there is no bar or sheet', () => {
    expect(followOffset({ mapTop: 0, mapBottom: 800, barBottom: null, sheetTop: null }, 'dot')).toEqual([0, 0])
  })

  it('falls back to the box middle when the strip is too thin', () => {
    const thin = { ...PHONE, sheetTop: PHONE.barBottom + MIN_STRIP - 1 }
    expect(followOffset(thin, 'dot')).toEqual([0, 0])
  })
})
