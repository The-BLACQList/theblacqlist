// =============================================================================
// Ticket 285: room for a phone's search bar and sheet when the map frames an area
// =============================================================================
// MapLibre refuses to frame anything when the padding is bigger than the map, which
// a phone on its side reached with the fixed 150 + 360. Pure maths, so it is
// unit-testable without a browser.
// =============================================================================

/** The map keeps at least this much height to frame into. */
export const MIN_FRAME = 80

const SIDE = 16
const GAP = 8

export interface FrameEdges {
  boxHeight: number
  /** Height the search bar and chips take from the top of the map box. */
  bar: number
  /** Height the sheet takes from the bottom of the map box. */
  sheet: number
}

export function framePadding({ boxHeight, bar, sheet }: FrameEdges) {
  const top = bar + GAP
  const bottom = sheet + GAP
  const room = Math.max(0, boxHeight - MIN_FRAME)
  const scale = Math.min(1, room / (top + bottom))
  return { top: Math.floor(top * scale), bottom: Math.floor(bottom * scale), left: SIDE, right: SIDE }
}
