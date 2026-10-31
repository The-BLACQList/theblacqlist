import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  countedReceiptHref,
  countedScreen,
  isReceiptId,
  joinedMap,
} from '@/lib/spend/counted-receipt'

// Ticket 166, Part A: the counted screen is the owner's alone.

const OWNER = 'u-owner'
const OTHER = 'u-other'
const RECEIPT_ID = '0b9a3c1e-5d7f-4a2b-9c8d-1e2f3a4b5c6d'

describe('countedScreen', () => {
  it('shows the owner their approved receipt', () => {
    expect(
      countedScreen({
        readFailed: false,
        receipt: { user_id: OWNER, status: 'approved' },
        viewerId: OWNER,
      })
    ).toBe('show')
  })

  it("is a 404 for anyone else's receipt, even an approved one", () => {
    expect(
      countedScreen({
        readFailed: false,
        receipt: { user_id: OWNER, status: 'approved' },
        viewerId: OTHER,
      })
    ).toBe('not_found')
  })

  it('is a 404 when there is no row', () => {
    expect(countedScreen({ readFailed: false, receipt: null, viewerId: OWNER })).toBe('not_found')
  })

  it.each(['pending_review', 'rejected', 'something_new'])(
    'sends the owner of a %s receipt back to My receipts',
    (status) => {
      expect(
        countedScreen({ readFailed: false, receipt: { user_id: OWNER, status }, viewerId: OWNER })
      ).toBe('redirect')
    }
  )

  it('shows the error state when the read fails, whatever came back', () => {
    expect(countedScreen({ readFailed: true, receipt: null, viewerId: OWNER })).toBe('error')
    expect(
      countedScreen({
        readFailed: true,
        receipt: { user_id: OTHER, status: 'approved' },
        viewerId: OWNER,
      })
    ).toBe('error')
  })
})

describe('isReceiptId', () => {
  it('takes a uuid and nothing else', () => {
    expect(isReceiptId(RECEIPT_ID)).toBe(true)
    expect(isReceiptId(RECEIPT_ID.toUpperCase())).toBe(true)
    expect(isReceiptId('not-a-receipt')).toBe(false)
    expect(isReceiptId(`${RECEIPT_ID}x`)).toBe(false)
    expect(isReceiptId('')).toBe(false)
  })
})

describe('joinedMap', () => {
  it('is true only for a listed receipt that stays in the totals', () => {
    expect(joinedMap({ listing_id: 'l-1', aggregate_opt_out: false })).toBe(true)
    expect(joinedMap({ listing_id: null, aggregate_opt_out: false })).toBe(false)
    expect(joinedMap({ listing_id: 'l-1', aggregate_opt_out: true })).toBe(false)
  })
})

describe('the counted page', () => {
  const src = readFileSync(
    path.resolve(process.cwd(), 'app/account/receipts/[id]/counted/page.tsx'),
    'utf8'
  )

  it('reads only the signed-in member’s receipt', () => {
    expect(src).toContain(".eq('user_id', user.id)")
    expect(src).toContain("if (screen === 'not_found') notFound()")
    expect(src).toContain("if (screen === 'redirect') redirect('/account/receipts')")
  })

  it('sends the map button to the plain map, with no ?you=1 yet', () => {
    expect(src).toContain('href="/flow-map"')
    expect(src).not.toContain('you=1')
  })

  it('has the failure copy and a way back', () => {
    expect(src).toContain('We couldn&apos;t load this receipt.')
    expect(src).toContain('Back to My receipts')
  })

  it('animates the ring only when motion is allowed', () => {
    const css = readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8')
    const at = css.indexOf('.blacq-counted-ring {')
    const block = css.lastIndexOf('@media (prefers-reduced-motion: no-preference)', at)
    expect(at).toBeGreaterThan(-1)
    expect(block).toBeGreaterThan(-1)
    expect(css.slice(block, at)).not.toContain('}\n}')
  })
})

describe('the Counted row', () => {
  it('links an approved receipt to its counted screen', () => {
    const src = readFileSync(
      path.resolve(process.cwd(), 'components/spend/ReceiptListRow.tsx'),
      'utf8'
    )
    expect(src).toContain('href={countedReceiptHref(id)}')
    expect(countedReceiptHref(RECEIPT_ID)).toBe(`/account/receipts/${RECEIPT_ID}/counted`)
  })
})
