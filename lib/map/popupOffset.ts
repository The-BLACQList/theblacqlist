// =============================================================================
// Map popup geometry
// =============================================================================
// The preview card is anchored on the selected square or dot. Since ticket 244
// a claimed page is a rounded-square tile standing on a caret whose tip is the
// listing coordinate, so the tile sits above the point, not around it. MapLibre zeroes every
// anchor an offset object omits, so all nine keys must be present or the card
// jumps onto the pin the moment it flips near a viewport edge.
// Type-only import so this stays unit-testable without a browser.
// =============================================================================
import type { PositionAnchor } from 'maplibre-gl'

export const POPUP_ANCHORS = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const satisfies readonly PositionAnchor[]

export type PopupAnchor = PositionAnchor
export type OffsetPoint = [number, number]
export type PopupOffset = Record<PopupAnchor, OffsetPoint>

/** The selected logo tile is 56px square (globals.css `.blacq-pin-selected`). */
export const SELECTED_TILE = 56
/** The caret under the tile; its tip is the coordinate. */
export const PIN_CARET = 6
/** The dark name pill under the tip, with its 6px gap (phones only). */
export const NAME_PILL_HEIGHT = 32
/** A selected dot's radius plus its ring (components/map/mapLayers.ts). */
export const SELECTED_DOT_RADIUS = 9
const GAP = 12

/** How far above the coordinate the selected tile's centre and top are. */
export const TILE_CENTER_LIFT = PIN_CARET + SELECTED_TILE / 2
export const TILE_TOP_LIFT = PIN_CARET + SELECTED_TILE

/**
 * Offsets, from the coordinate, that keep the card clear of what is selected.
 * A square (a claimed page) stands above its point, so the card sits beside
 * the tile, above it, or below the name pill. A dot (any other business) is
 * centred on its point, so the card just clears its ring.
 */
export function popupOffset(mark: 'tile' | 'dot' = 'tile'): PopupOffset {
  if (mark === 'dot') {
    const r = SELECTED_DOT_RADIUS + GAP
    return {
      center: [0, 0],
      top: [0, r],
      bottom: [0, -r],
      left: [r, 0],
      right: [-r, 0],
      'top-left': [r, -SELECTED_DOT_RADIUS],
      'top-right': [-r, -SELECTED_DOT_RADIUS],
      'bottom-left': [r, SELECTED_DOT_RADIUS],
      'bottom-right': [-r, SELECTED_DOT_RADIUS],
    }
  }
  const side = SELECTED_TILE / 2 + GAP
  const above = TILE_TOP_LIFT + GAP
  const below = NAME_PILL_HEIGHT + GAP
  return {
    center: [0, -TILE_CENTER_LIFT],
    top: [0, below],
    bottom: [0, -above],
    left: [side, -TILE_CENTER_LIFT],
    right: [-side, -TILE_CENTER_LIFT],
    // Near the top edge: the card's top lines up with the tile's top.
    'top-left': [side, -TILE_TOP_LIFT],
    'top-right': [-side, -TILE_TOP_LIFT],
    // Near the bottom edge: the card's bottom lines up with the caret tip.
    'bottom-left': [side, 0],
    'bottom-right': [-side, 0],
  }
}

/**
 * Which side of the pin the card opens on. The default is beside the pin, to
 * its right; near the right edge it flips left, and near the top or bottom it
 * shifts so the card is not clipped. `x` and `y` are the pin's pixel position
 * in the map container.
 */
export function popupAnchor(
  x: number,
  y: number,
  width: number,
  height: number,
  cardWidth = 300,
  cardHeight = 120
): PopupAnchor {
  const horizontal = x > width - cardWidth ? 'right' : 'left'
  if (y < cardHeight) return `top-${horizontal}`
  if (y > height - cardHeight) return `bottom-${horizontal}`
  return horizontal
}
