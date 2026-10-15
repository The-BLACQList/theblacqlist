// Simplicity M1 + P5 (founder, 2026-10-15): saved places need a way back.
import { describe, it, expect } from 'vitest'

import { mainNavLinks } from '@/components/nav/nav-links'
import { showsSavedToast } from '@/components/ui/saved-toast'

describe('mainNavLinks', () => {
  it('has no Saved link for signed-out visitors', () => {
    expect(mainNavLinks(false).some((l) => l.href === '/account/saved')).toBe(false)
  })

  it('puts Saved right after Map for signed-in visitors', () => {
    const hrefs = mainNavLinks(true).map((l) => l.href)
    expect(hrefs.indexOf('/account/saved')).toBe(hrefs.indexOf('/map') + 1)
    expect(hrefs).toHaveLength(mainNavLinks(false).length + 1)
  })
})

describe('showsSavedToast', () => {
  it('shows the note everywhere except the saved page itself', () => {
    expect(showsSavedToast('/discover')).toBe(true)
    expect(showsSavedToast('/atlanta-ga/business/some-place')).toBe(true)
    expect(showsSavedToast('/account/saved')).toBe(false)
  })
})
