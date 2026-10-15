// Simplicity M1 + P5 (founder, 2026-10-15): saved places need a way back.
import { describe, it, expect } from 'vitest'

import { MAIN_NAV_LINKS, SAVED_LINK } from '@/components/nav/nav-links'
import { showsSavedToast } from '@/components/ui/saved-toast'

describe('nav links', () => {
  it('keeps Saved out of the main links (it sits beside My Account)', () => {
    expect(MAIN_NAV_LINKS.some((l) => l.href === SAVED_LINK.href)).toBe(false)
  })

  it('points Saved at the saved places page', () => {
    expect(SAVED_LINK).toEqual({ label: 'Saved', href: '/account/saved' })
  })
})

describe('showsSavedToast', () => {
  it('shows the note everywhere except the saved page itself', () => {
    expect(showsSavedToast('/discover')).toBe(true)
    expect(showsSavedToast('/atlanta-ga/business/some-place')).toBe(true)
    expect(showsSavedToast('/account/saved')).toBe(false)
  })
})
