import { describe, expect, it } from 'vitest'

import { trustMarkTier } from '@/components/entity-page/TrustTierLabel'
import { quickBarVisibility } from '@/lib/entity-page/quickBar'

// Ticket 232: today's listing page for thin listings.

describe('quickBarVisibility', () => {
  it('keeps both bars hidden while the hero button is on screen', () => {
    expect(quickBarVisibility({ isIntersecting: true, boundingClientRect: { top: 400 } })).toEqual({
      bottom: false,
      top: false,
    })
  })

  it('shows only the phone bar when the hero button is still below the fold', () => {
    // The 768 first-load case: a tall hero pushed the button under the fold and
    // the top bar faded in over the hero.
    expect(quickBarVisibility({ isIntersecting: false, boundingClientRect: { top: 900 } })).toEqual({
      bottom: true,
      top: false,
    })
  })

  it('shows both bars once the hero button has scrolled up past the top', () => {
    expect(quickBarVisibility({ isIntersecting: false, boundingClientRect: { top: -60 } })).toEqual({
      bottom: true,
      top: true,
    })
  })
})

describe('trustMarkTier', () => {
  it('follows the trust ladder', () => {
    expect(trustMarkTier('unclaimed')).toBe(0)
    expect(trustMarkTier('claimed')).toBe(1)
    expect(trustMarkTier('verified')).toBe(2)
    expect(trustMarkTier('certified')).toBe(3)
  })
})
