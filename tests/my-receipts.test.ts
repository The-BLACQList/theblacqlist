import { describe, it, expect } from 'vitest'

import { countedTotalCents, receiptTally, sortReceipts, tallyLine } from '@/lib/spend/my-receipts'

function r(
  status: string,
  amount_cents: number,
  purchase_date: string,
  created_at = `${purchase_date}T12:00:00Z`
) {
  return { status, amount_cents, purchase_date, created_at }
}

const MIXED = [
  r('approved', 2500, '2026-10-20'),
  r('pending_review', 1200, '2026-10-29'),
  r('approved', 4000, '2026-10-25'),
  r('rejected', 900, '2026-10-01'),
  r('approved', 1000, '2026-10-10'),
  r('approved', 600, '2026-10-12'),
]

describe('receiptTally', () => {
  it('counts each status under its shopper word', () => {
    expect(receiptTally(MIXED)).toEqual({ counted: 4, waiting: 1, needsFix: 1 })
  })

  it('is all zeros with no receipts', () => {
    expect(receiptTally([])).toEqual({ counted: 0, waiting: 0, needsFix: 0 })
  })

  it('ignores a status it does not know', () => {
    expect(receiptTally([r('archived', 100, '2026-10-01')])).toEqual({
      counted: 0,
      waiting: 0,
      needsFix: 0,
    })
  })
})

describe('tallyLine', () => {
  it('reads like the ticket', () => {
    expect(tallyLine({ counted: 4, waiting: 1, needsFix: 1 })).toBe(
      '4 counted · 1 waiting · 1 needs a fix'
    )
  })

  it('leaves out the parts at zero', () => {
    expect(tallyLine({ counted: 0, waiting: 1, needsFix: 0 })).toBe('1 waiting')
  })

  it('agrees in number', () => {
    expect(tallyLine({ counted: 0, waiting: 0, needsFix: 2 })).toBe('2 need a fix')
  })
})

describe('countedTotalCents', () => {
  it('sums approved receipts only', () => {
    expect(countedTotalCents(MIXED)).toBe(2500 + 4000 + 1000 + 600)
  })

  it('is zero when everything is still waiting', () => {
    expect(countedTotalCents([r('pending_review', 1200, '2026-10-29')])).toBe(0)
  })

  it('never counts a receipt that needs a fix', () => {
    expect(countedTotalCents([r('rejected', 900, '2026-10-01')])).toBe(0)
  })
})

describe('sortReceipts', () => {
  it('puts needs-a-fix rows first, then the rest newest first', () => {
    const sorted = sortReceipts(MIXED)
    expect(sorted.map((x) => [x.status, x.purchase_date])).toEqual([
      ['rejected', '2026-10-01'],
      ['pending_review', '2026-10-29'],
      ['approved', '2026-10-25'],
      ['approved', '2026-10-20'],
      ['approved', '2026-10-12'],
      ['approved', '2026-10-10'],
    ])
  })

  it('sorts several needs-a-fix rows newest first among themselves', () => {
    const sorted = sortReceipts([
      r('rejected', 1, '2026-09-01'),
      r('approved', 2, '2026-10-30'),
      r('rejected', 3, '2026-10-01'),
    ])
    expect(sorted.map((x) => x.amount_cents)).toEqual([3, 1, 2])
  })

  it('breaks a same-day tie by when it was added', () => {
    const sorted = sortReceipts([
      r('approved', 1, '2026-10-20', '2026-10-20T09:00:00Z'),
      r('approved', 2, '2026-10-20', '2026-10-21T09:00:00Z'),
    ])
    expect(sorted.map((x) => x.amount_cents)).toEqual([2, 1])
  })

  it('leaves the input untouched', () => {
    const input = [r('approved', 1, '2026-10-01'), r('rejected', 2, '2026-09-01')]
    sortReceipts(input)
    expect(input.map((x) => x.amount_cents)).toEqual([1, 2])
  })
})
