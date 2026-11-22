// =============================================================================
// Ticket 244: keep the selected pin centred on a phone
// =============================================================================
// Founder 2026-11-21: on a phone, the pin a visitor selects sits in the middle
// of the map they can actually see, and stays there until they move the map.
// The visible map is the strip between the floating search bar (top) and the
// card sheet (bottom), so "centred" means centred in that strip, not in the
// whole map box. Pure maths, so it is unit-testable without a browser.
// =============================================================================
import { NAME_PILL_HEIGHT, TILE_TOP_LIFT } from '@/lib/map/popupOffset'

/** Below this the strip is too thin to aim at; fall back to the map's middle. */
export const MIN_STRIP = 80

export interface FollowFrame {
  /** Map box top and bottom, in viewport pixels. */
  mapTop: number
  mapBottom: number
  /** Bottom of the floating search bar and chips, or null if none. */
  barBottom: number | null
  /** Top of the card sheet, or null if none. */
  sheetTop: number | null
}

/**
 * How far the mark's coordinate sits below its visual middle. A selected
 * pin on a phone runs from its top (TILE_TOP_LIFT above the tip) to the
 * bottom of the name pill under the tip, so its middle is above the tip. A
 * dot is centred on its point.
 */
export function markLift(mark: 'tile' | 'dot'): number {
  return mark === 'dot' ? 0 : (TILE_TOP_LIFT - NAME_PILL_HEIGHT) / 2
}

/**
 * The MapLibre `offset` (from the map box centre to where the coordinate
 * lands) that puts the mark in the middle of the visible strip. Used with easeTo, which unlike `padding` does
 * not change the map's padding for later moves.
 */
export function followOffset(frame: FollowFrame, mark: 'tile' | 'dot'): [number, number] {
  const { mapTop, mapBottom } = frame
  const top = Math.max(mapTop, frame.barBottom ?? mapTop)
  const bottom = Math.min(mapBottom, frame.sheetTop ?? mapBottom)
  const lift = markLift(mark)
  if (bottom - top < MIN_STRIP) return [0, lift]
  const stripMiddle = (top + bottom) / 2
  const boxMiddle = (mapTop + mapBottom) / 2
  return [0, Math.round(stripMiddle - boxMiddle + lift)]
}
