import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { UpgradePlans } from '@/app/dashboard/upgrade/UpgradePlans'
import { freeMonthHold, type FreeMonthHold } from '@/lib/tour/freeMonthHold'
import type { FreeMonthState } from '@/lib/tour/freeMonth'

// 2026-10-11: a tester clicked "Upgrade to Starter" under a saved free month
// and reached a $19-today Stripe page. While the month is unclaimed for the
// page the plan cards act on, the cards point at the month instead.

const PAGE = 'listing-1'
const OTHER = 'listing-2'

const ready = (listingId: string): FreeMonthState => ({
  status: 'ready',
  listingId,
  listingName: 'Hampton Greens',
  currentTier: 'free',
  openTier: null,
  attach: false,
  paying: false,
})

describe('freeMonthHold', () => {
  it('holds while the month waits for a live page', () => {
    expect(freeMonthHold({ status: 'waiting', hasPage: true })).toBe('waiting')
  })

  it('holds when the month is ready, on whichever of the owner\'s pages (ticket 238)', () => {
    expect(freeMonthHold(ready(PAGE))).toBe('ready')
    expect(freeMonthHold(ready(OTHER))).toBe('ready')
  })

  it('holds while the owner picks a page, paying or not (ticket 136)', () => {
    const page = (listingId: string, paid: boolean) => ({
      listingId,
      listingName: null,
      currentTier: 'free' as const,
      paid,
    })
    expect(freeMonthHold({ status: 'pick', pages: [page(PAGE, false), page(OTHER, false)] })).toBe(
      'ready'
    )
    expect(freeMonthHold({ status: 'pick', pages: [page(PAGE, true), page(OTHER, true)] })).toBe(
      'ready'
    )
  })

  it('holds for a page that already pays, so a bigger plan points at the month', () => {
    const paying: FreeMonthState = {
      status: 'ready',
      listingId: PAGE,
      listingName: 'Hampton Greens',
      currentTier: 'starter',
      openTier: null,
      attach: false,
      paying: true,
    }
    expect(freeMonthHold(paying)).toBe('ready')
  })

  it('does not hold once the month is used, or for non-testers', () => {
    expect(freeMonthHold({ status: 'used', tier: 'starter' })).toBeNull()
    expect(freeMonthHold(null)).toBeNull()
  })
})

describe('UpgradePlans with a free month', () => {
  const render = (hold: FreeMonthHold) =>
    renderToStaticMarkup(
      createElement(UpgradePlans, {
        primaryListingId: PAGE,
        currentTier: 'free',
        canManage: false,
        availability: { starter: { monthly: true, annual: true } },
        freeMonthHold: hold,
      })
    )

  it('offers the paid upgrade when there is no free month', () => {
    const html = render(null)
    expect(html).toContain('Upgrade to Starter')
    expect(html).not.toContain('Use Your Free Month')
  })

  it('points Starter at the free month instead of a paid checkout', () => {
    const html = render('ready')
    expect(html).not.toContain('Upgrade to Starter')
    expect(html).toContain('href="#free-month"')
    expect(html).toContain('Use Your Free Month')
  })

  it('shows no buy button while the month waits for a live page', () => {
    const html = render('waiting')
    expect(html).not.toContain('Upgrade to Starter')
    expect(html).toContain('Your first month is free')
  })
})
