// =============================================================================
// Map popup geometry + pin-layer filtering
// =============================================================================
// /map renders the trust-tier ladder through two technologies: GL `circle`
// layers for most pins, and DOM `maplibregl.Marker` buttons for claimed+ at
// street zoom (the logo-in-ring identity markers). They have wildly different
// heights, so a single popup offset cannot serve both — at 18px the card landed
// on top of a 74px-tall logo marker and swallowed the next click.
//
// These two helpers are the shared source of truth for that split:
//   • popupOffsetFor()  — how far to clear the pin, per renderer
//   • buildPinsFilter() — which listings the circle layer still owns
// Both are pure so tests/map-popup.test.ts can guard them; MapExplore holds the
// only copy of "does this listing have a DOM marker right now".
// =============================================================================

// Type-only imports — erased at compile time, so this module stays free of the
// maplibre-gl runtime and can be unit-tested without a browser environment.
import type { FilterSpecification, PositionAnchor } from 'maplibre-gl'

export type TrustTier = 'unclaimed' | 'claimed' | 'verified' | 'certified'

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

/**
 * A complete offset for every anchor MapLibre can flip to. Keyed off MapLibre's
 * own `PositionAnchor` on purpose: if the library ever adds an anchor, the
 * literal in `popupOffsetFor` stops compiling instead of silently shipping a
 * `[0, 0]` for it — which is exactly the card-on-top-of-the-pin bug.
 */
export type PopupOffset = Record<PopupAnchor, OffsetPoint>

/** GL circle radii, mirrored from the `pins` / `pins-unclaimed` paint specs. */
export const TIER_RADIUS: Record<TrustTier, number> = {
  certified: 9,
  verified: 7,
  claimed: 5,
  unclaimed: 3.5,
}

/** Circle stroke widths, mirrored from the same paint specs. */
const TIER_STROKE: Record<TrustTier, number> = {
  certified: 2.5,
  verified: 1.75,
  claimed: 1.5,
  unclaimed: 1.5,
}

/** Breathing room between the top of the pin and the tip of the card. */
const GAP = 8

/**
 * Measured heights of the DOM markers, which use `anchor: 'bottom'` — the whole
 * element (ring + tip + name label) stacks *above* the coordinate.
 *
 *   verified/certified — 48px ring + 7px tip + ~16px label ≈ 71, +glow ≈ 74
 *   claimed            — 18px dot + 7px tip + ~16px label ≈ 41
 *
 * Kept in sync with `.blacq-logo-marker*` in app/globals.css.
 */
const DOM_MARKER_HEIGHT = { logo: 74, claimed: 41 } as const

/** Half-width of each renderer, for the left/right anchors. */
const DOM_MARKER_HALF_WIDTH = { logo: 27, claimed: 12 } as const

function hasLogoRing(tier: TrustTier): boolean {
  return tier === 'verified' || tier === 'certified'
}

/** Mirrors MapLibre's own scalar-offset normalization for the corner anchors. */
function diagonal(value: number): number {
  return Math.round((value / Math.SQRT2) * 10) / 10
}

/**
 * Build the full nine-anchor offset object for a popup pointing at `tier`.
 *
 * MapLibre zeroes any anchor an offset object omits, so every key must be
 * present or the card jumps onto the pin the moment it flips near a viewport
 * edge. `up` is the only asymmetric direction: both renderers sit entirely
 * above their coordinate, so a card placed below only needs the gap.
 */
export function popupOffsetFor(
  tier: TrustTier,
  hasDomMarker: boolean
): PopupOffset {
  const kind = hasLogoRing(tier) ? 'logo' : 'claimed'

  const up = hasDomMarker
    ? DOM_MARKER_HEIGHT[kind] + GAP
    : Math.round(TIER_RADIUS[tier] + TIER_STROKE[tier] + GAP)

  const down = GAP
  const side = hasDomMarker
    ? DOM_MARKER_HALF_WIDTH[kind] + GAP
    : Math.round(TIER_RADIUS[tier] + TIER_STROKE[tier] + GAP)

  const upDiag = diagonal(up)
  const downDiag = diagonal(down)
  const sideDiag = diagonal(side)

  return {
    center: [0, 0],
    top: [0, down],
    bottom: [0, -up],
    left: [side, 0],
    right: [-side, 0],
    'top-left': [sideDiag, downDiag],
    'top-right': [-sideDiag, downDiag],
    'bottom-left': [sideDiag, -upDiag],
    'bottom-right': [-sideDiag, -upDiag],
  }
}

/**
 * Filter for the `pins` circle layer.
 *
 * The layer used to carry `maxzoom: 13` and hand over to DOM markers wholesale.
 * That left a hole: DOM markers are capped at 60 per viewport, so the 61st
 * claimed+ listing had no circle *and* no marker — invisible and unclickable.
 * Now the layer stays on at every zoom and excludes only the ids that actually
 * got a marker, so every claimed+ listing has exactly one renderer.
 *
 * `renderedMarkerIds` is bounded by that same 60-marker cap, so the `in`
 * literal stays small.
 */
export function buildPinsFilter(renderedMarkerIds: readonly string[]): FilterSpecification {
  const base: FilterSpecification = [
    'all',
    ['!', ['has', 'point_count']],
    ['!=', ['get', 'trustTier'], 'unclaimed'],
  ]
  if (renderedMarkerIds.length === 0) return base
  return [...base, ['!', ['in', ['get', 'id'], ['literal', [...renderedMarkerIds]]]]]
}
