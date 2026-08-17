// =============================================================================
// updateReceiptSubmissionAction — receipt manual correction
// =============================================================================
// OCR on a photographed receipt is wrong often enough that a correction path is
// part of the feature, not a follow-up to it. This suite pins the three things
// that make the correction path safe to expose:
//
//   * ownership — `receipt_uploads` has owner SELECT and INSERT policies but no
//     UPDATE policy, so this action writes through the service client and RLS
//     cannot be what stops one user editing another's receipt. The scoping in
//     the action IS the authorization; if it regresses, nothing else catches it.
//   * the pending-only restriction — an approved receipt's amount is already
//     folded into the community totals, so editing one would silently desync
//     them. The status is re-asserted on the write, not only read beforehand.
//   * the photo — an edit that only fixes the amount must not detach the image
//     the user already uploaded.
//   * the storage lifecycle — a replaced photo leaves the previous object
//     referenced by nothing. Nothing ever lists this bucket, and account
//     deletion collects paths from `file_path`, so an unreferenced object is
//     invisible and permanent. Which of the two objects is the orphan depends on
//     whether the write landed, and the wrong answer deletes a live image.
//
// Validation itself is shared with the create path via `parseReceiptFields`, so
// only the parity is asserted here; `receipt-submission.test.ts` owns the depth.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => {
  const state: {
    user: { id: string } | null
    existing: { id: string; status: string; file_path: string | null } | null
    uploadError: { message: string } | null
    updateError: { code?: string; message: string; details?: string; hint?: string } | null
    // Whether the guarded UPDATE matched a row. A miss is not an error — the
    // status filter simply found nothing — so it has to be modelled separately.
    updateMatched: boolean
    removeError: { message: string } | null
  } = {
    user: null,
    existing: null,
    uploadError: null,
    updateError: null,
    updateMatched: true,
    removeError: null,
  }

  // Records what actually reached Supabase, so the ownership and status filters
  // can be asserted directly rather than inferred from the return value.
  const calls: {
    uploadBucket: string | null
    uploadPath: string | null
    selectFilters: [string, unknown][]
    updated: Record<string, unknown> | null
    updateFilters: [string, unknown][]
    removed: string[]
  } = {
    uploadBucket: null,
    uploadPath: null,
    selectFilters: [],
    updated: null,
    updateFilters: [],
    removed: [],
  }

  const createClient = vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
  }))

  const createServiceClient = vi.fn(() => ({
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, _file: unknown, _opts: { contentType: string }) {
            calls.uploadBucket = bucket
            calls.uploadPath = path
            return { error: state.uploadError }
          },
          async remove(paths: string[]) {
            calls.removed.push(...paths)
            return { error: state.removeError }
          },
        }
      },
    },
    from() {
      let mode: 'select' | 'update' = 'select'
      const builder = {
        select() {
          mode = 'select'
          return builder
        },
        update(row: Record<string, unknown>) {
          mode = 'update'
          calls.updated = row
          return builder
        },
        eq(column: string, value: unknown) {
          ;(mode === 'update' ? calls.updateFilters : calls.selectFilters).push([column, value])
          return builder
        },
        async maybeSingle() {
          return { data: state.existing, error: null }
        },
        // The update chain ends on `.select('id')` and is awaited directly. It
        // returns the matched rows, which is how the action distinguishes "the
        // write landed" from "the status guard matched nothing".
        then(resolve: (v: { data: unknown; error: unknown }) => unknown) {
          const data = state.updateError
            ? null
            : state.updateMatched
              ? [{ id: 'matched-row' }]
              : []
          return Promise.resolve({ data, error: state.updateError }).then(resolve)
        },
      }
      return builder
    },
  }))

  return { state, calls, createClient, createServiceClient }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: h.createClient,
  createServiceClient: h.createServiceClient,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { updateReceiptSubmissionAction } from '@/lib/actions/spend/updateReceiptSubmission'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const RECEIPT_ID = '33333333-3333-4333-8333-333333333333'
const LISTING_ID = '22222222-2222-4222-8222-222222222222'
const EXISTING_PATH = `${USER_ID}/1786000000000-abc.jpg`

function form(overrides: Record<string, string | File> = {}): FormData {
  const fd = new FormData()
  fd.set('receipt_id', RECEIPT_ID)
  fd.set('raw_business_name', "Sylvia's Kitchen")
  fd.set('amount_dollars', '42.50')
  fd.set('purchase_date', '2026-08-01')
  for (const [k, v] of Object.entries(overrides)) {
    if (v === '') fd.delete(k)
    else fd.set(k, v)
  }
  return fd
}

function photo(type = 'image/jpeg', name = 'receipt.jpg'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type })
}

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  h.state.user = { id: USER_ID }
  h.state.existing = { id: RECEIPT_ID, status: 'pending_review', file_path: EXISTING_PATH }
  h.state.uploadError = null
  h.state.updateError = null
  h.state.updateMatched = true
  h.state.removeError = null
  h.calls.uploadBucket = null
  h.calls.uploadPath = null
  h.calls.selectFilters = []
  h.calls.updated = null
  h.calls.updateFilters = []
  h.calls.removed = []
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('authorization', () => {
  it('refuses an unauthenticated edit', async () => {
    h.state.user = null
    const res = await updateReceiptSubmissionAction(null, form())
    expect(res).toMatchObject({ error: expect.stringContaining('signed in') })
    expect(h.calls.updated).toBeNull()
  })

  it('refuses an edit with no receipt id', async () => {
    const res = await updateReceiptSubmissionAction(null, form({ receipt_id: '' }))
    expect(res).toMatchObject({ error: expect.any(String) })
    expect(h.calls.updated).toBeNull()
  })

  it('scopes the lookup to the caller, so another user’s receipt is not found', async () => {
    // With no UPDATE policy on receipt_uploads, this filter IS the ownership
    // check — there is no RLS behind it to catch a regression.
    h.state.existing = null
    const res = await updateReceiptSubmissionAction(null, form())
    expect(res).toMatchObject({ error: 'Receipt not found.' })
    expect(h.calls.selectFilters).toContainEqual(['user_id', USER_ID])
    expect(h.calls.updated).toBeNull()
  })

  it('re-asserts the owner on the write, not only on the read', async () => {
    await updateReceiptSubmissionAction(null, form())
    expect(h.calls.updateFilters).toContainEqual(['user_id', USER_ID])
    expect(h.calls.updateFilters).toContainEqual(['id', RECEIPT_ID])
  })
})

describe('the pending-only restriction', () => {
  it('refuses an approved receipt — its amount is already in the community totals', async () => {
    h.state.existing = { id: RECEIPT_ID, status: 'approved', file_path: null }
    const res = await updateReceiptSubmissionAction(null, form())
    expect(res).toMatchObject({ error: expect.stringContaining('approved') })
    expect(h.calls.updated).toBeNull()
  })

  it('refuses a rejected receipt and points at a new submission', async () => {
    h.state.existing = { id: RECEIPT_ID, status: 'rejected', file_path: null }
    const res = await updateReceiptSubmissionAction(null, form())
    expect(res).toMatchObject({ error: expect.stringContaining('Submit a new one') })
    expect(h.calls.updated).toBeNull()
  })

  it('re-asserts pending_review on the write, closing the read-to-write window', async () => {
    // An approval landing between the lookup and the update would otherwise be
    // overwritten by the user's edit.
    await updateReceiptSubmissionAction(null, form())
    expect(h.calls.updateFilters).toContainEqual(['status', 'pending_review'])
  })

  it('never writes a status of its own', async () => {
    await updateReceiptSubmissionAction(null, form())
    expect(h.calls.updated).not.toHaveProperty('status')
  })
})

describe('field parity with the create path', () => {
  it('rejects an amount the create form would also reject', async () => {
    const res = await updateReceiptSubmissionAction(null, form({ amount_dollars: '-5' }))
    expect(res).toMatchObject({ fieldErrors: { amount_dollars: expect.any(String) } })
    expect(h.calls.updated).toBeNull()
  })

  it('requires a business name or a listing', async () => {
    const res = await updateReceiptSubmissionAction(null, form({ raw_business_name: '' }))
    expect(res).toMatchObject({ fieldErrors: { raw_business_name: expect.any(String) } })
    expect(h.calls.updated).toBeNull()
  })

  it('writes the corrected values as integer cents', async () => {
    await updateReceiptSubmissionAction(null, form({ amount_dollars: '19.99' }))
    expect(h.calls.updated).toMatchObject({
      amount_cents: 1999,
      purchase_date: '2026-08-01',
      raw_business_name: "Sylvia's Kitchen",
    })
  })

  it('persists a newly attached listing so the receipt reaches the aggregates', async () => {
    await updateReceiptSubmissionAction(null, form({ listing_id: LISTING_ID }))
    expect(h.calls.updated).toMatchObject({ listing_id: LISTING_ID })
  })
})

describe('the photo', () => {
  it('keeps the existing photo when no replacement is attached', async () => {
    await updateReceiptSubmissionAction(null, form())
    expect(h.calls.uploadBucket).toBeNull()
    expect(h.calls.updated).toMatchObject({ file_path: EXISTING_PATH })
  })

  it('replaces the photo when a new one is attached', async () => {
    await updateReceiptSubmissionAction(null, form({ receipt_file: photo() }))
    expect(h.calls.uploadBucket).toBe('receipt-uploads')
    expect(h.calls.updated?.file_path).toBe(h.calls.uploadPath)
    expect(h.calls.updated?.file_path).not.toBe(EXISTING_PATH)
  })

  it('surfaces an upload failure instead of saving the edit without it', async () => {
    h.state.uploadError = { message: 'Bucket not found' }
    const res = await updateReceiptSubmissionAction(null, form({ receipt_file: photo() }))
    expect(res).toMatchObject({ error: expect.any(String) })
    expect(h.calls.updated).toBeNull()
  })

  it('rejects an unsupported type before touching storage', async () => {
    const res = await updateReceiptSubmissionAction(
      null,
      form({ receipt_file: photo('image/gif', 'a.gif') })
    )
    expect(res).toMatchObject({ fieldErrors: { receipt_file: expect.any(String) } })
    expect(h.calls.uploadBucket).toBeNull()
    expect(h.calls.updated).toBeNull()
  })
})

// ─── Storage cleanup ─────────────────────────────────────────────────────────
// Every branch below decides which of two objects is the orphan, and getting it
// backwards deletes a receipt image the row is still using. That asymmetry is
// why these are separate cases rather than one "cleanup happens" assertion.
//
// Non-vacuity: before the fix no code path called `storage.remove` at all, so
// the first two cases failed on an empty `calls.removed`. The third and fourth
// are the guards in the dangerous direction — they pass both before and after,
// and exist so an over-eager cleanup cannot be introduced later without a red
// test. `[Observed — tests/receipt-correction.test.ts, 2026-08-17]`
describe('storage cleanup on replacement', () => {
  it('removes the superseded object once the write has landed', async () => {
    await updateReceiptSubmissionAction(null, form({ receipt_file: photo() }))
    expect(h.calls.removed).toEqual([EXISTING_PATH])
  })

  it('removes the new object, not the old one, when the write fails', async () => {
    // The row still points at the old path, so removing that would destroy the
    // image the receipt is still using.
    h.state.updateError = { code: '42501', message: 'permission denied' }
    await updateReceiptSubmissionAction(null, form({ receipt_file: photo() }))
    expect(h.calls.removed).toEqual([h.calls.uploadPath])
    expect(h.calls.removed).not.toContain(EXISTING_PATH)
  })

  it('removes nothing when the edit attaches no replacement', async () => {
    await updateReceiptSubmissionAction(null, form({ amount_dollars: '19.99' }))
    expect(h.calls.removed).toEqual([])
  })

  it('removes nothing when the receipt never had a photo', async () => {
    h.state.existing = { id: RECEIPT_ID, status: 'pending_review', file_path: null }
    await updateReceiptSubmissionAction(null, form({ receipt_file: photo() }))
    expect(h.calls.removed).toEqual([])
  })

  it('still reports success when the removal itself fails', async () => {
    // The row is already correct. A failed cleanup leaves an orphan, which is a
    // storage-hygiene problem — not a reason to tell the user their edit failed.
    h.state.removeError = { message: 'Object not found' }
    const res = await updateReceiptSubmissionAction(null, form({ receipt_file: photo() }))
    expect(res).toMatchObject({ success: true })
  })
})

describe('the guarded write matching no rows', () => {
  it('reports the edit as unsaved rather than as success', async () => {
    // The status filter held: the receipt was reviewed between the read and the
    // write. Postgres raises no error for a zero-row update, so without the row
    // count this returned `success` while nothing had changed.
    h.state.updateMatched = false
    const res = await updateReceiptSubmissionAction(null, form())
    expect(res).toMatchObject({ error: expect.stringContaining('reviewed') })
    expect(res).not.toHaveProperty('success')
  })

  it('treats the replacement as the orphan, keeping the stored image', async () => {
    h.state.updateMatched = false
    await updateReceiptSubmissionAction(null, form({ receipt_file: photo() }))
    expect(h.calls.removed).toEqual([h.calls.uploadPath])
    expect(h.calls.removed).not.toContain(EXISTING_PATH)
  })
})

describe('update failures', () => {
  it('logs the Postgres error so a handled return is not the only evidence', async () => {
    h.state.updateError = { code: '42501', message: 'permission denied' }
    const res = await updateReceiptSubmissionAction(null, form())
    expect(res).toMatchObject({ error: 'Failed to save your changes. Please try again.' })
    expect(errorSpy).toHaveBeenCalledWith(
      '[updateReceiptSubmission] update failed:',
      expect.objectContaining({ code: '42501' })
    )
  })

  it('never logs user-entered text', async () => {
    h.state.updateError = { code: '42501', message: 'nope' }
    await updateReceiptSubmissionAction(null, form({ notes: 'private note' }))
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('private note')
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("Sylvia's Kitchen")
  })
})
