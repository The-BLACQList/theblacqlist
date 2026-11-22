// Simplicity M1 + P5 (founder, 2026-10-15): saved places need a way back.
import { describe, it, expect } from 'vitest'

import { MAIN_NAV_LINKS, SAVED_LINK, accountMenuLinks } from '@/components/nav/nav-links'
import { showsSavedToast } from '@/components/ui/saved-toast'

describe('nav links', () => {
  it('keeps Saved out of the main links (it sits in the My Account menu)', () => {
    expect(MAIN_NAV_LINKS.some((l) => l.href === SAVED_LINK.href)).toBe(false)
  })

  it('puts Home first in the main links', () => {
    expect(MAIN_NAV_LINKS[0]).toEqual({ label: 'Home', href: '/' })
  })

  it('points Saved at the saved places page', () => {
    expect(SAVED_LINK).toEqual({ label: 'Saved', href: '/account/saved' })
  })
})

describe('the My Account menu (ticket 252)', () => {
  it('puts My Business first for owners, then Account Overview, Saved, Messages, Settings', () => {
    expect(accountMenuLinks({ isOwner: true, messagingOn: true }).map((l) => l.label)).toEqual([
      'My Business',
      'Account Overview',
      'Saved',
      'Messages',
      'Settings',
    ])
  })

  it('leaves out My Business for members and Messages when messaging is off', () => {
    const links = accountMenuLinks({ isOwner: false, messagingOn: false })
    expect(links.map((l) => l.label)).toEqual(['Account Overview', 'Saved', 'Settings'])
  })

  it('sends owners to the dashboard inbox and members to their own', () => {
    const inbox = (isOwner: boolean) =>
      accountMenuLinks({ isOwner, messagingOn: true }).find((l) => l.label === 'Messages')?.href
    expect(inbox(true)).toBe('/dashboard/messages')
    expect(inbox(false)).toBe('/account/messages')
  })
})

describe('showsSavedToast', () => {
  it('shows the note everywhere except the saved page itself', () => {
    expect(showsSavedToast('/discover')).toBe(true)
    expect(showsSavedToast('/atlanta-ga/business/some-place')).toBe(true)
    expect(showsSavedToast('/account/saved')).toBe(false)
  })
})
