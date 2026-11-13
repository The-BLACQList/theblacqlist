// =============================================================================
// Owners verify receipts (ticket 183)
// =============================================================================
// Pinned here:
//   * an owner sees a first name and one initial, never more;
//   * only the listing's owner reviews, never their own receipt, only once;
//   * admins get unmatched, unclaimed, and 7-day-old receipts;
//   * the receipt photo opens for the owner only while it waits for them;
//   * a review writes once, even if owner and admin press together.
// =============================================================================

import { describe, expect, it } from 'vitest'

import {
  ADMIN_FALLBACK_DAYS,
  OWNER_REJECT_REASONS,
  UNKNOWN_BUYER,
  adminFallbackCutoff,
  canViewReceiptFile,
  maskBuyerName,
  needsAdminReview,
  ownerCanReview,
  pendingReviewLine,
  pickOwnerRejectionReason,
  receiptPrivacyNote,
  shouldNotifyOwner,
} from '@/lib/spend/owner-receipts'
import { OTHER_FIX_REASON } from '@/lib/spend/receipt-emails'
import { approvePendingReceipt, rejectPendingReceipt } from '@/lib/spend/applyReceiptReview'

describe('maskBuyerName', () => {
  it.each([
    ['Jordan Smith', 'Jordan S.'],
    ['  jordan   smith  ', 'jordan S.'],
    ['Jordan Avery Smith', 'Jordan S.'],
    ['Jordan', 'Jordan'],
    ['Zoë Ångström', 'Zoë Å.'],
    ['Jordan 3', 'Jordan'],
  ])('%s → %s', (input, out) => {
    expect(maskBuyerName(input)).toBe(out)
  })

  it('never shows an email address or nothing', () => {
    expect(maskBuyerName('jordan@example.com')).toBe(UNKNOWN_BUYER)
    expect(maskBuyerName('')).toBe(UNKNOWN_BUYER)
    expect(maskBuyerName('   ')).toBe(UNKNOWN_BUYER)
    expect(maskBuyerName(null)).toBe(UNKNOWN_BUYER)
    expect(maskBuyerName(undefined)).toBe(UNKNOWN_BUYER)
  })

  it('never carries the full last name', () => {
    expect(maskBuyerName('Jordan Smith')).not.toContain('Smith')
  })
})

describe('ownerCanReview', () => {
  const pending = { user_id: 'shopper', status: 'pending_review' }

  it('lets the owner review a waiting receipt', () => {
    expect(ownerCanReview({ receipt: pending, listingOwnerId: 'owner', viewerId: 'owner' })).toBe(
      'ok'
    )
  })

  it("says not_found for someone else's business, an unclaimed one, or nothing", () => {
    expect(ownerCanReview({ receipt: pending, listingOwnerId: 'owner', viewerId: 'other' })).toBe(
      'not_found'
    )
    expect(ownerCanReview({ receipt: pending, listingOwnerId: null, viewerId: 'owner' })).toBe(
      'not_found'
    )
    expect(ownerCanReview({ receipt: null, listingOwnerId: 'owner', viewerId: 'owner' })).toBe(
      'not_found'
    )
  })

  it("won't let an owner verify their own purchase", () => {
    expect(
      ownerCanReview({
        receipt: { user_id: 'owner', status: 'pending_review' },
        listingOwnerId: 'owner',
        viewerId: 'owner',
      })
    ).toBe('own_receipt')
  })

  it('refuses a receipt already reviewed', () => {
    for (const status of ['approved', 'rejected']) {
      expect(
        ownerCanReview({
          receipt: { user_id: 'shopper', status },
          listingOwnerId: 'owner',
          viewerId: 'owner',
        })
      ).toBe('not_pending')
    }
  })
})

describe('needsAdminReview', () => {
  const now = new Date('2026-11-13T12:00:00Z')
  const day = 24 * 60 * 60 * 1000
  const ago = (d: number) => new Date(now.getTime() - d * day).toISOString()

  it('sends unclaimed receipts to admins straight away', () => {
    expect(needsAdminReview({ listing_id: 'l1', created_at: ago(0) }, null, now)).toBe(true)
  })

  it('never asks an admin to approve an unmatched receipt: it waits for the business', () => {
    expect(needsAdminReview({ listing_id: null, created_at: ago(0) }, null, now)).toBe(false)
    expect(needsAdminReview({ listing_id: null, created_at: ago(30) }, null, now)).toBe(false)
  })

  it('leaves a claimed business its receipts for 7 days', () => {
    expect(needsAdminReview({ listing_id: 'l1', created_at: ago(6.9) }, 'owner', now)).toBe(false)
    expect(
      needsAdminReview({ listing_id: 'l1', created_at: ago(ADMIN_FALLBACK_DAYS) }, 'owner', now)
    ).toBe(true)
  })

  it('has a matching cutoff', () => {
    expect(adminFallbackCutoff(now)).toBe(ago(ADMIN_FALLBACK_DAYS))
  })
})

describe('canViewReceiptFile', () => {
  const receipt = { user_id: 'shopper', status: 'pending_review', listing_id: 'l1' }

  it('opens for the shopper and admins, whatever the status', () => {
    for (const status of ['pending_review', 'approved', 'rejected']) {
      const r = { ...receipt, status }
      expect(
        canViewReceiptFile({
          viewerId: 'shopper',
          isAdmin: false,
          receipt: r,
          listingOwnerId: null,
        })
      ).toBe(true)
      expect(
        canViewReceiptFile({ viewerId: 'admin', isAdmin: true, receipt: r, listingOwnerId: null })
      ).toBe(true)
    }
  })

  it('opens for the owner only while the receipt waits for them', () => {
    const owner = { viewerId: 'owner', isAdmin: false, listingOwnerId: 'owner' }
    expect(canViewReceiptFile({ ...owner, receipt })).toBe(true)
    expect(canViewReceiptFile({ ...owner, receipt: { ...receipt, status: 'approved' } })).toBe(
      false
    )
  })

  it('stays closed to anyone else', () => {
    expect(
      canViewReceiptFile({ viewerId: 'other', isAdmin: false, receipt, listingOwnerId: null })
    ).toBe(false)
    expect(
      canViewReceiptFile({ viewerId: 'other', isAdmin: false, receipt, listingOwnerId: 'owner' })
    ).toBe(false)
    expect(
      canViewReceiptFile({
        viewerId: 'owner',
        isAdmin: false,
        receipt: { ...receipt, listing_id: null },
        listingOwnerId: 'owner',
      })
    ).toBe(false)
  })
})

describe('pickOwnerRejectionReason', () => {
  it('saves a preset word for word', () => {
    expect(pickOwnerRejectionReason(OWNER_REJECT_REASONS[0], 'ignored')).toBe(
      OWNER_REJECT_REASONS[0]
    )
  })
  it('saves typed text for Other, trimmed and capped', () => {
    expect(pickOwnerRejectionReason(OTHER_FIX_REASON, '  Wrong store  ')).toBe('Wrong store')
    expect(pickOwnerRejectionReason(OTHER_FIX_REASON, 'x'.repeat(500))).toHaveLength(200)
    expect(pickOwnerRejectionReason(OTHER_FIX_REASON, '   ')).toBeNull()
  })
  it('refuses anything else', () => {
    expect(pickOwnerRejectionReason('made up', null)).toBeNull()
    expect(pickOwnerRejectionReason(null, null)).toBeNull()
  })
})

describe('shouldNotifyOwner', () => {
  it('emails a claimed business, never the shopper themself', () => {
    expect(shouldNotifyOwner('owner', 'shopper')).toBe(true)
    expect(shouldNotifyOwner('owner', 'owner')).toBe(false)
    expect(shouldNotifyOwner(null, 'shopper')).toBe(false)
  })
})

describe('shopper copy follows the flag', () => {
  it('only mentions the business when owner review is on', () => {
    expect(receiptPrivacyNote(false)).not.toMatch(/business/)
    expect(receiptPrivacyNote(true)).toMatch(/business you bought from/)
    expect(receiptPrivacyNote(true)).toMatch(/first name and last initial/)
    expect(pendingReviewLine(false)).toMatch(/3 business days/)
    expect(pendingReviewLine(true)).toMatch(/business or our team/)
  })
})

// ── The race guard ─────────────────────────────────────────────────────────
// A fake service client that records writes. `pendingRows` is how many rows
// the guarded status update finds: 1 the first time, 0 once someone else
// reviewed it.

function fakeClient(pendingRows: number) {
  const writes: { table: string; op: string; values?: unknown; filters: [string, unknown][] }[] = []
  const client = {
    from(table: string) {
      const rec = {
        table,
        op: 'select',
        values: undefined as unknown,
        filters: [] as [string, unknown][],
      }
      const b = {
        select: () => b,
        insert(values: unknown) {
          rec.op = 'insert'
          rec.values = values
          writes.push(rec)
          return b
        },
        update(values: unknown) {
          rec.op = 'update'
          rec.values = values
          writes.push(rec)
          return b
        },
        eq(col: string, v: unknown) {
          rec.filters.push([col, v])
          return b
        },
        maybeSingle: async () => ({
          data: table === 'listings' ? { city_id: 'c1', name: "Mama's Kitchen" } : null,
          error: null,
        }),
        single: async () => ({ data: { id: 'new-id' }, error: null }),
        then(resolve: (v: unknown) => void) {
          // Awaiting the guarded update chain (.update().eq().eq().select()).
          resolve({
            data: Array.from({ length: pendingRows }, () => ({ id: 'r1' })),
            error: null,
          })
        },
      }
      return b
    },
  }
  return { client: client as never, writes }
}

const RECEIPT = {
  id: 'r1',
  listing_id: 'l1',
  amount_cents: 2500,
  purchase_date: '2026-11-03',
  aggregate_opt_out: false,
}

describe('approvePendingReceipt', () => {
  it('only updates a receipt still pending, and records who verified it', async () => {
    const { client, writes } = fakeClient(1)
    const result = await approvePendingReceipt(client, RECEIPT, { userId: 'o1', role: 'owner' })
    expect(result).toEqual({ ok: true, listingName: "Mama's Kitchen" })
    const status = writes.find((w) => w.table === 'receipt_uploads')!
    expect(status.filters).toContainEqual(['status', 'pending_review'])
    expect(status.values).toMatchObject({ status: 'approved', verified_by_role: 'owner' })
    expect(writes.some((w) => w.table === 'spend_events')).toBe(true)
    expect(writes.some((w) => w.table === 'flow_nodes')).toBe(true)
  })

  it('refuses a receipt for a business that is not on The BLACQList, writing nothing', async () => {
    const { client, writes } = fakeClient(1)
    const result = await approvePendingReceipt(
      client,
      { ...RECEIPT, listing_id: null },
      { userId: 'a1', role: 'admin' }
    )
    expect(result).toEqual({ ok: false, reason: 'unlisted' })
    expect(writes).toEqual([])
  })

  it('writes nothing else when someone reviewed it first', async () => {
    const { client, writes } = fakeClient(0)
    const result = await approvePendingReceipt(client, RECEIPT, { userId: 'a1', role: 'admin' })
    expect(result).toEqual({ ok: false, reason: 'already_reviewed' })
    expect(writes.map((w) => w.table)).toEqual(['receipt_uploads'])
  })
})

describe('rejectPendingReceipt', () => {
  it('is guarded the same way', async () => {
    const first = fakeClient(1)
    expect(
      await rejectPendingReceipt(first.client, 'r1', { userId: 'o1', role: 'owner' }, 'x')
    ).toEqual({ ok: true })
    expect(first.writes[0]!.filters).toContainEqual(['status', 'pending_review'])
    expect(first.writes[0]!.values).toMatchObject({ status: 'rejected', verified_by_role: 'owner' })

    const second = fakeClient(0)
    expect(
      await rejectPendingReceipt(second.client, 'r1', { userId: 'a1', role: 'admin' }, 'x')
    ).toEqual({ ok: false, reason: 'already_reviewed' })
  })
})
