// =============================================================================
// The Collective's first look (ticket 161)
// =============================================================================
// lib/spend/collective-first-look.ts picks the hero button on /flow-map. The
// picker is pure, so the three states and the failed-read fallback are pinned
// here rather than checked by eye on the page.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  FIRST_LOOK_SIGN_IN_HREF,
  pickFirstLookState,
} from '@/lib/spend/collective-first-look'

describe('pickFirstLookState', () => {
  it('is out when signed out, whatever the count says', () => {
    expect(pickFirstLookState({ signedIn: false, receiptCount: 0, countFailed: false })).toBe('out')
    expect(pickFirstLookState({ signedIn: false, receiptCount: 3, countFailed: false })).toBe('out')
    expect(pickFirstLookState({ signedIn: false, receiptCount: 0, countFailed: true })).toBe('out')
  })

  it('is new when signed in with no receipts', () => {
    expect(pickFirstLookState({ signedIn: true, receiptCount: 0, countFailed: false })).toBe('new')
  })

  it('is has when signed in with at least one receipt', () => {
    expect(pickFirstLookState({ signedIn: true, receiptCount: 1, countFailed: false })).toBe('has')
    expect(pickFirstLookState({ signedIn: true, receiptCount: 12, countFailed: false })).toBe('has')
  })

  it('falls back to new when the count read fails', () => {
    expect(pickFirstLookState({ signedIn: true, receiptCount: 5, countFailed: true })).toBe('new')
  })
})

describe('the signed-out button', () => {
  it('signs in and comes back to the add form', () => {
    expect(FIRST_LOOK_SIGN_IN_HREF).toBe('/sign-in?next=/account/receipts/new')
  })
})

describe('the three steps', () => {
  const src = readFileSync(
    path.join(process.cwd(), 'components/flow-map/CollectiveFirstLook.tsx'),
    'utf8'
  )

  it('keeps the wording My receipts uses for its empty state (ticket 164)', () => {
    expect(src).toContain("'Shop at a business on the list.'")
    expect(src).toContain("'Add a receipt.'")
    expect(src).toContain("'Your spend joins the map.'")
  })

  it('has no em dashes in what the reader sees', () => {
    const copy = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(copy).not.toContain('—')
  })
})
