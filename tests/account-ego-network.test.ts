// =============================================================================
// Ticket 114: the /account "Your place in The Collective" ego network
// =============================================================================
// The panel's numbers must match /account/spending for the same user, so the
// grouping is checked against `buildTotals` from lib/spend/personal-spend.ts.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  EGO_RING_NARROW,
  EGO_RING_WIDE,
  egoNodeLabel,
  layoutEgoRing,
  summarizeEgoSpend,
  type EgoReceipt,
} from '@/lib/account/egoNetwork'
import { buildTotals } from '@/lib/spend/personal-spend'

const receipts: EgoReceipt[] = [
  { amount_cents: 8400, status: 'approved', listing_id: 'b' },
  { amount_cents: 3000, status: 'approved', listing_id: 'a' },
  { amount_cents: 4000, status: 'approved', listing_id: 'a' },
  { amount_cents: 7000, status: 'approved', listing_id: 'c' },
  { amount_cents: 1250, status: 'approved', listing_id: null },
  { amount_cents: 9999, status: 'pending_review', listing_id: 'd' },
  { amount_cents: 5000, status: 'rejected', listing_id: 'e' },
]

describe('summarizeEgoSpend', () => {
  it('groups approved spend by listing, biggest first, ties by id', () => {
    const summary = summarizeEgoSpend(receipts)
    expect(summary.businesses).toEqual([
      { listingId: 'b', amountCents: 8400, receiptCount: 1 },
      { listingId: 'a', amountCents: 7000, receiptCount: 2 },
      { listingId: 'c', amountCents: 7000, receiptCount: 1 },
    ])
  })

  it('keeps unmatched money in the total but not in the business count', () => {
    const summary = summarizeEgoSpend(receipts)
    expect(summary.totalCents).toBe(8400 + 7000 + 7000 + 1250)
    expect(summary.unmatchedCents).toBe(1250)
    expect(summary.businesses).toHaveLength(3)
  })

  it('counts pending as a count only, and ignores rejected', () => {
    const summary = summarizeEgoSpend(receipts)
    expect(summary.pendingReceiptCount).toBe(1)
    expect(summary.businesses.find((b) => b.listingId === 'd')).toBeUndefined()
    expect(summary.businesses.find((b) => b.listingId === 'e')).toBeUndefined()
  })

  it('matches buildTotals, so /account and /account/spending agree', () => {
    const summary = summarizeEgoSpend(receipts)
    const totals = buildTotals(receipts.map((r) => ({ ...r, purchase_date: '2026-09-01' })))
    expect(summary.totalCents).toBe(totals.approvedAmountCents)
    expect(summary.approvedReceiptCount).toBe(totals.approvedReceiptCount)
    expect(summary.pendingReceiptCount).toBe(totals.pendingReceiptCount)
    expect(summary.businesses.length).toBe(totals.businessCount)
  })

  it('returns an empty summary for a new user', () => {
    expect(summarizeEgoSpend([])).toEqual({
      totalCents: 0,
      unmatchedCents: 0,
      businesses: [],
      approvedReceiptCount: 0,
      pendingReceiptCount: 0,
    })
  })
})

describe('layoutEgoRing', () => {
  it('returns no nodes for zero businesses', () => {
    expect(layoutEgoRing(0, EGO_RING_WIDE)).toEqual([])
  })

  it('starts at the top and keeps every node inside the frame', () => {
    for (const ring of [EGO_RING_WIDE, EGO_RING_NARROW]) {
      for (let n = 1; n <= 8; n += 1) {
        const nodes = layoutEgoRing(n, ring)
        expect(nodes).toHaveLength(n)
        const [first] = nodes
        expect(first?.x).toBeCloseTo(ring.cx, 1)
        expect(first?.y).toBeLessThan(ring.cy)
        for (const node of nodes) {
          expect(node.x).toBeGreaterThan(0)
          expect(node.x).toBeLessThan(ring.width)
          expect(node.y).toBeGreaterThan(0)
          expect(node.y).toBeLessThan(ring.height)
          expect(node.labelY).toBeGreaterThan(0)
          expect(node.labelY).toBeLessThan(ring.height)
        }
      }
    }
  })

  it('anchors labels away from the center', () => {
    const nodes = layoutEgoRing(4, EGO_RING_WIDE)
    expect(nodes.map((n) => n.anchor)).toEqual(['middle', 'start', 'middle', 'end'])
  })
})

describe('egoNodeLabel', () => {
  it('formats "{category} · ${amount}"', () => {
    expect(egoNodeLabel('Coffee', '$84')).toBe('Coffee · $84')
  })

  it('trims long categories', () => {
    expect(egoNodeLabel('Health and Wellness Services', '$12')).toBe('Health and Well… · $12')
  })
})

describe('/account copy', () => {
  const page = readFileSync(path.join(process.cwd(), 'app/account/(overview)/page.tsx'), 'utf8')
  const panel = readFileSync(
    path.join(process.cwd(), 'components/account/CollectivePanel.tsx'),
    'utf8'
  )

  it('never falls back to the email prefix in the greeting', () => {
    expect(page).not.toMatch(/email\?\.split\('@'\)/)
  })

  it('has no em dashes in user-facing copy', () => {
    for (const source of [page, panel]) {
      const strings = source.match(/>[^<>{}]*</g) ?? []
      for (const s of strings) expect(s).not.toContain('—')
    }
  })
})
