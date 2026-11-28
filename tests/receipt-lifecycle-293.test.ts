// =============================================================================
// Receipt lifecycle fixes (ticket 293)
// =============================================================================
// Pinned here:
//   * a spend that fails to save puts the receipt back to waiting, never
//     "approved but not counted", and writes nothing to the flow graph;
//   * the admin sees a result line after Approve or Reject (fixed codes only);
//   * My Spending doesn't say only "our team" approves;
//   * an unlisted receipt past its wait doesn't open an edit form.
// =============================================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { approvePendingReceipt } from '@/lib/spend/applyReceiptReview'
import {
  ADMIN_RECEIPT_RESULTS,
  adminReceiptResultCode,
  adminReceiptsResultHref,
  isResultOk,
  parseAdminReceiptResult,
  parseAdminReceiptTab,
} from '@/lib/admin/receiptReviewResult'
import { UNLISTED_CANT_APPROVE } from '@/lib/spend/unlisted'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

// A fake service client that records writes. The guarded status update finds
// one pending row; `spendFails` makes the spend_events insert fail.
function fakeClient({ spendFails }: { spendFails: boolean }) {
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
        single: async () =>
          table === 'spend_events' && spendFails
            ? { data: null, error: { message: 'insert failed' } }
            : { data: { id: 'new-id' }, error: null },
        then(resolve: (v: unknown) => void) {
          resolve({ data: [{ id: 'r1' }], error: null })
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

describe('approvePendingReceipt when the spend does not save', () => {
  it('puts the receipt back to waiting and reports a failure', async () => {
    const { client, writes } = fakeClient({ spendFails: true })
    const result = await approvePendingReceipt(client, RECEIPT, { userId: 'o1', role: 'owner' })

    expect(result).toEqual({ ok: false, reason: 'failed' })
    const statusWrites = writes.filter((w) => w.table === 'receipt_uploads' && w.op === 'update')
    expect(statusWrites).toHaveLength(2)
    const revert = statusWrites[1]!
    expect(revert.values).toEqual({
      status: 'pending_review',
      reviewed_by: null,
      reviewed_at: null,
      verified_by_role: null,
    })
    // Only undoes this approval: the row must still read approved.
    expect(revert.filters).toContainEqual(['id', 'r1'])
    expect(revert.filters).toContainEqual(['status', 'approved'])
  })

  it('writes nothing to the flow graph', async () => {
    const { client, writes } = fakeClient({ spendFails: true })
    await approvePendingReceipt(client, RECEIPT, { userId: 'a1', role: 'admin' })
    expect(writes.some((w) => w.table === 'flow_nodes' || w.table === 'flow_edges')).toBe(false)
  })

  it('still counts once when the spend saves', async () => {
    const { client, writes } = fakeClient({ spendFails: false })
    const result = await approvePendingReceipt(client, RECEIPT, { userId: 'o1', role: 'owner' })
    expect(result).toEqual({ ok: true, listingName: "Mama's Kitchen" })
    expect(writes.filter((w) => w.table === 'spend_events')).toHaveLength(1)
    expect(writes.filter((w) => w.table === 'receipt_uploads' && w.op === 'update')).toHaveLength(1)
    expect(writes.some((w) => w.table === 'flow_nodes')).toBe(true)
  })

  it('keeps opted-out spend out of the flow graph', async () => {
    const { client, writes } = fakeClient({ spendFails: false })
    await approvePendingReceipt(
      client,
      { ...RECEIPT, aggregate_opt_out: true },
      { userId: 'o1', role: 'owner' }
    )
    expect(writes.filter((w) => w.table === 'spend_events')).toHaveLength(1)
    expect(writes.some((w) => w.table === 'flow_nodes' || w.table === 'flow_edges')).toBe(false)
  })
})

describe('admin result line', () => {
  it('maps each action result to a code', () => {
    expect(adminReceiptResultCode('approve', { success: true })).toBe('approved')
    expect(adminReceiptResultCode('reject', { success: true })).toBe('sent_back')
    expect(adminReceiptResultCode('approve', { error: 'This receipt was already reviewed.' })).toBe(
      'already_reviewed'
    )
    expect(
      adminReceiptResultCode('approve', { error: 'Only pending receipts can be approved.' })
    ).toBe('already_reviewed')
    expect(
      adminReceiptResultCode('reject', { error: 'Only pending receipts can be rejected.' })
    ).toBe('already_reviewed')
    expect(adminReceiptResultCode('approve', { error: UNLISTED_CANT_APPROVE })).toBe('unlisted')
    expect(
      adminReceiptResultCode('approve', { error: 'Failed to approve receipt. Please try again.' })
    ).toBe('failed')
    expect(adminReceiptResultCode('reject', null)).toBe('failed')
  })

  it('has a line for every code, and only successes read as OK', () => {
    for (const code of Object.keys(ADMIN_RECEIPT_RESULTS)) {
      expect(
        ADMIN_RECEIPT_RESULTS[code as keyof typeof ADMIN_RECEIPT_RESULTS].length
      ).toBeGreaterThan(5)
    }
    expect(isResultOk('approved')).toBe(true)
    expect(isResultOk('sent_back')).toBe(true)
    expect(isResultOk('already_reviewed')).toBe(false)
    expect(isResultOk('failed')).toBe(false)
  })

  it('never uses the word "verified"', () => {
    for (const line of Object.values(ADMIN_RECEIPT_RESULTS)) {
      expect(line.toLowerCase()).not.toContain('verified')
    }
  })

  it('goes back to the same tab', () => {
    expect(adminReceiptsResultHref('needs_admin', 'approved')).toBe(
      '/admin/receipts?result=approved'
    )
    expect(adminReceiptsResultHref('pending_review', 'failed')).toBe(
      '/admin/receipts?status=pending_review&result=failed'
    )
  })

  it('reads only known tabs and codes from the URL', () => {
    expect(parseAdminReceiptTab('waiting')).toBe('waiting')
    expect(parseAdminReceiptTab('nope')).toBe('needs_admin')
    expect(parseAdminReceiptTab(undefined)).toBe('needs_admin')
    expect(parseAdminReceiptResult('approved')).toBe('approved')
    expect(parseAdminReceiptResult('<script>')).toBeNull()
    expect(parseAdminReceiptResult('toString')).toBeNull()
    expect(parseAdminReceiptResult(undefined)).toBeNull()
  })

  it('the admin page uses the wrappers, not .bind(null, null)', () => {
    const page = read('app/admin/receipts/page.tsx')
    expect(page).not.toContain('.bind(null, null)')
    expect(page).toContain('adminApproveReceiptForm.bind(null, activeFilter)')
    expect(page).toContain('adminRejectReceiptForm.bind(null, activeFilter)')
    expect(page).toContain('role="status"')
  })
})

describe('shopper wording and the edit guard', () => {
  it('My Spending does not say only our team approves', () => {
    const page = read('app/account/spending/page.tsx')
    expect(page).not.toMatch(/our team approves/)
    expect(page).toContain('approved.')
  })

  it('the edit page sends a stopped unlisted receipt back to My Receipts', () => {
    const page = read('app/account/receipts/[id]/edit/page.tsx')
    expect(page).toMatch(
      /unlistedWait\(receipt, new Date\(\)\) === 'stopped'\) \{\s*redirect\('\/account\/receipts'\)/
    )
    expect(page).toMatch(/listing_id,\s*created_at,/)
  })
})
