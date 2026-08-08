// =============================================================================
// Map preview-card geometry + pin-layer ownership
// =============================================================================
// Guards the two defects behind "clicking an upgraded pin does nothing / the
// card covers the pin":
//
//   • popupOffsetFor() — the card must clear whichever renderer is on screen.
//     A scalar MapLibre offset normalizes to a radius, so 18px cleared a 3.5px
//     dot and buried a 74px logo marker. A partial offset object is just as
//     bad: MapLibre zeroes every anchor the object omits, so the card snaps
//     onto the pin the moment it flips near a viewport edge.
//
//   • buildPinsFilter() — the circle layer used to switch off wholesale above
//     z13 while DOM markers were capped at 60 per viewport, leaving the 61st
//     claimed+ listing with no renderer at all. The filter now drops exactly
//     the ids that got a marker, so coverage is a complement, not a guess.
// =============================================================================

import { describe, it, expect } from 'vitest'

import {
  buildPinsFilter,
  popupOffsetFor,
  POPUP_ANCHORS,
  TIER_RADIUS,
  type PopupAnchor,
  type TrustTier,
} from '@/lib/map/popupOffset'

const ALL_TIERS: TrustTier[] = ['unclaimed', 'claimed', 'verified', 'certified']

/** Upward clearance is what keeps the card off the pin — `bottom` anchor. */
function clearance(tier: TrustTier, hasDomMarker: boolean): number {
  return -popupOffsetFor(tier, hasDomMarker).bottom[1]
}

describe('popupOffsetFor', () => {
  it('defines every anchor MapLibre can flip to', () => {
    // Any anchor left out of the object is treated as [0, 0].
    for (const tier of ALL_TIERS) {
      for (const hasDomMarker of [false, true]) {
        const offset = popupOffsetFor(tier, hasDomMarker)
        expect(Object.keys(offset).sort()).toEqual([...POPUP_ANCHORS].sort())
        for (const anchor of POPUP_ANCHORS as readonly PopupAnchor[]) {
          expect(offset[anchor]).toHaveLength(2)
          expect(Number.isFinite(offset[anchor][0])).toBe(true)
          expect(Number.isFinite(offset[anchor][1])).toBe(true)
        }
      }
    }
  })

  it('clears the GL circle by its radius plus its stroke', () => {
    // Tight enough that a 3.5px dot keeps the behavior the founder called
    // correct, loose enough that the ring is never touched.
    for (const tier of ALL_TIERS) {
      const gap = clearance(tier, false) - TIER_RADIUS[tier]
      expect(gap).toBeGreaterThanOrEqual(8)
      expect(gap).toBeLessThanOrEqual(12)
    }
  })

  it('clears the full height of a logo marker, which stacks above its point', () => {
    // Ring 48 + tip 7 + label ~16 ≈ 74px of marker above the coordinate.
    for (const tier of ['verified', 'certified'] as TrustTier[]) {
      expect(clearance(tier, true)).toBeGreaterThanOrEqual(74)
    }
  })

  it('clears the shorter claimed marker without over-shooting', () => {
    // 18px dot + tip + label — a logo-sized offset here would float the card.
    const claimed = clearance('claimed', true)
    expect(claimed).toBeGreaterThanOrEqual(41)
    expect(claimed).toBeLessThan(clearance('verified', true))
  })

  it('always clears a DOM marker by more than the circle it replaces', () => {
    // The regression that produced the bug report: one offset for both.
    for (const tier of ['claimed', 'verified', 'certified'] as TrustTier[]) {
      expect(clearance(tier, true)).toBeGreaterThan(clearance(tier, false))
    }
  })

  it('places the card above the point and never below it on the bottom anchor', () => {
    for (const tier of ALL_TIERS) {
      for (const hasDomMarker of [false, true]) {
        expect(popupOffsetFor(tier, hasDomMarker).bottom[1]).toBeLessThan(0)
        // The `top` anchor puts the card underneath, where nothing is drawn —
        // it only needs the gap, not the marker height.
        expect(popupOffsetFor(tier, hasDomMarker).top[1]).toBeGreaterThan(0)
      }
    }
  })

  it('mirrors the side anchors so an edge flip stays symmetric', () => {
    const offset = popupOffsetFor('certified', true)
    expect(offset.left[0]).toBeGreaterThan(0)
    expect(offset.right[0]).toBe(-offset.left[0])
    expect(offset['bottom-right'][0]).toBe(-offset['bottom-left'][0])
    expect(offset['top-right'][0]).toBe(-offset['top-left'][0])
  })
})

describe('buildPinsFilter', () => {
  const BASE = [
    'all',
    ['!', ['has', 'point_count']],
    ['!=', ['get', 'trustTier'], 'unclaimed'],
  ]

  /**
   * `FilterSpecification` is a wide union (it admits `false` and the legacy
   * non-expression forms), so index into the result as a plain array here
   * rather than sprinkling narrowing through every assertion.
   */
  function clauses(ids: readonly string[]): unknown[] {
    return buildPinsFilter(ids) as unknown as unknown[]
  }

  it('is the plain claimed+ filter when no DOM markers are rendered', () => {
    // Below z13 every claimed+ listing is a circle. An empty `in` clause here
    // would be harmless but noisy; the layer spec stays minimal instead.
    expect(clauses([])).toEqual(BASE)
  })

  it('excludes exactly the ids that got a marker', () => {
    const filter = clauses(['a', 'b'])
    expect(filter.slice(0, 3)).toEqual(BASE)
    expect(filter[3]).toEqual(['!', ['in', ['get', 'id'], ['literal', ['a', 'b']]]])
  })

  it('still excludes unclaimed, which never gets a marker', () => {
    // The circle layer is claimed+ only; unclaimed has its own layer with no
    // zoom cutoff, and that is the path that always worked.
    expect(clauses(['a'])).toContainEqual(['!=', ['get', 'trustTier'], 'unclaimed'])
  })

  it('copies the id list so a later mutation cannot rewrite a live filter', () => {
    const ids = ['a']
    const filter = clauses(ids)
    ids.push('b')
    expect(filter[3]).toEqual(['!', ['in', ['get', 'id'], ['literal', ['a']]]])
  })
})
