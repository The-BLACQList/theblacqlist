// =============================================================================
// Map popup geometry
// =============================================================================
// The preview card is anchored on a numbered pin, which is a DOM marker centered
// on the listing coordinate. MapLibre zeroes every anchor an offset object
// omits, so all nine keys must be present or the card jumps onto the pin the
// moment it flips near a viewport edge.
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

/** The selected pin is 64px wide, so it reaches 32px from its coordinate. */
export const SELECTED_PIN_RADIUS = 32
/** Height of the dark name pill that hangs under the selected pin. */
export const NAME_PILL_HEIGHT = 30
const GAP = 12

function diagonal(value: number): number {
  return Math.round((value / Math.SQRT2) * 10) / 10
}

/**
 * Offsets that keep the card clear of the selected pin.
 * A card placed below the pin also has to clear the name pill.
 */
export function popupOffset(radius: number = SELECTED_PIN_RADIUS): PopupOffset {
  const side = radius + GAP
  const up = radius + GAP
  const down = radius + NAME_PILL_HEIGHT + GAP
  const sideDiag = diagonal(side)
  return {
    center: [0, 0],
    top: [0, down],
    bottom: [0, -up],
    left: [side, 0],
    right: [-side, 0],
    'top-left': [sideDiag, diagonal(down)],
    'top-right': [-sideDiag, diagonal(down)],
    'bottom-left': [sideDiag, -diagonal(up)],
    'bottom-right': [-sideDiag, -diagonal(up)],
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
