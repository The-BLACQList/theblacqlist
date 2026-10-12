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
})

describe('freeMonthHold', () => {
  it('holds while the month waits for a live page', () => {
    expect(freeMonthHold({ status: 'waiting', hasPage: true }, PAGE)).toBe('waiting')
  })

  it('holds when the month is ready on this page', () => {
    expect(freeMonthHold(ready(PAGE), PAGE)).toBe('ready')
  })

  it('does not hold when the month belongs to another page', () => {
    expect(freeMonthHold(ready(OTHER), PAGE)).toBeNull()
  })

  it('holds when this page is one the owner can pick, unless it already pays', () => {
    const page = (listingId: string, paid: boolean) => ({
      listingId,
      listingName: null,
      currentTier: 'free' as const,
      paid,
    })
    expect(
      freeMonthHold({ status: 'pick', pages: [page(PAGE, false), page(OTHER, false)] }, PAGE)
    ).toBe('ready')
    expect(
      freeMonthHold({ status: 'pick', pages: [page(PAGE, true), page(OTHER, false)] }, PAGE)
    ).toBeNull()
  })

  it('does not hold once the month is used or saved, or for non-testers', () => {
    expect(freeMonthHold({ status: 'used', tier: 'starter' }, PAGE)).toBeNull()
    expect(
      freeMonthHold(
        { status: 'saved', listingId: PAGE, listingName: null, currentTier: 'starter' },
        PAGE
      )
    ).toBeNull()
    expect(freeMonthHold(null, PAGE)).toBeNull()
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
    expect(html).not.toContain('Use your free month')
  })

  it('points Starter at the free month instead of a paid checkout', () => {
    const html = render('ready')
    expect(html).not.toContain('Upgrade to Starter')
    expect(html).toContain('href="#free-month"')
    expect(html).toContain('Use your free month')
  })

  it('shows no buy button while the month waits for a live page', () => {
    const html = render('waiting')
    expect(html).not.toContain('Upgrade to Starter')
    expect(html).toContain('Your first month is free')
  })
})
