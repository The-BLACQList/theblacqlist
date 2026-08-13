// =============================================================================
// createReceiptSubmissionAction — receipt intake
// =============================================================================
// This suite exists because three defects shipped together and none of them
// were visible from the UI:
//
//   * uploads targeted a bucket named 'receipts'; the only receipt bucket that
//     has ever existed is 'receipt-uploads'
//   * the resulting "Bucket not found" error was swallowed and the row inserted
//     with file_path = null, so the form reported success while the photo was
//     never stored
//   * the INSERT error branch logged nothing, and a handled `return { error }`
//     never reaches Vercel's runtime-error table — so a real production failure
//     left no trace anywhere
//
// The bucket name and the no-silent-discard behaviour are the two things most
// likely to regress, so they are asserted directly rather than through a mock
// that would accept any bucket.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => {
  const state: {
    user: { id: string } | null
    uploadError: { message: string } | null
    insertError: { code?: string; message: string; details?: string; hint?: string } | null
  } = { user: null, uploadError: null, insertError: null }

  // Records what actually reached Supabase so the test can assert on the
  // bucket name and storage path rather than trusting the call happened.
  const calls: {
    uploadBucket: string | null
    uploadPath: string | null
    uploadContentType: string | null
    inserted: Record<string, unknown> | null
  } = { uploadBucket: null, uploadPath: null, uploadContentType: null, inserted: null }

  const createClient = vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
  }))

  const createServiceClient = vi.fn(() => ({
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, _file: unknown, opts: { contentType: string }) {
            calls.uploadBucket = bucket
            calls.uploadPath = path
            calls.uploadContentType = opts.contentType
            return { error: state.uploadError }
          },
        }
      },
    },
    from() {
      const builder = {
        insert(row: Record<string, unknown>) {
          calls.inserted = row
          return builder
        },
        select: () => builder,
        single: async () =>
          state.insertError
            ? { data: null, error: state.insertError }
            : { data: { id: 'receipt-1' }, error: null },
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

import { createReceiptSubmissionAction } from '@/lib/actions/spend/createReceiptSubmission'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const LISTING_ID = '22222222-2222-4222-8222-222222222222'

function form(overrides: Record<string, string | File> = {}): FormData {
  const fd = new FormData()
  fd.set('raw_business_name', "Sylvia's Kitchen")
  fd.set('amount_dollars', '42.50')
  fd.set('purchase_date', '2026-08-01')
  fd.set('client_idempotency_key', 'idem-1')
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
  h.state.uploadError = null
  h.state.insertError = null
  h.calls.uploadBucket = null
  h.calls.uploadPath = null
  h.calls.uploadContentType = null
  h.calls.inserted = null
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('auth and validation', () => {
  it('refuses an unauthenticated submission', async () => {
    h.state.user = null
    const res = await createReceiptSubmissionAction(null, form())
    expect(res).toMatchObject({ error: expect.stringContaining('signed in') })
    expect(h.calls.inserted).toBeNull()
  })

  it('requires a business name or a listing', async () => {
    const res = await createReceiptSubmissionAction(null, form({ raw_business_name: '' }))
    expect(res).toMatchObject({ fieldErrors: { raw_business_name: expect.any(String) } })
    expect(h.calls.inserted).toBeNull()
  })

  it('accepts a listing with no typed name', async () => {
    const fd = form({ raw_business_name: '', listing_id: LISTING_ID })
    const res = await createReceiptSubmissionAction(null, fd)
    expect(res).toMatchObject({ success: true })
    expect(h.calls.inserted).toMatchObject({ listing_id: LISTING_ID, raw_business_name: null })
  })

  it.each(['', '0', '-5', 'abc'])('rejects amount %j', async (amount) => {
    const res = await createReceiptSubmissionAction(null, form({ amount_dollars: amount }))
    expect(res).toMatchObject({ fieldErrors: { amount_dollars: expect.any(String) } })
    expect(h.calls.inserted).toBeNull()
  })

  it('converts dollars to integer cents', async () => {
    await createReceiptSubmissionAction(null, form({ amount_dollars: '42.505' }))
    expect(h.calls.inserted).toMatchObject({ amount_cents: 4251 })
  })

  it('requires a purchase date', async () => {
    const res = await createReceiptSubmissionAction(null, form({ purchase_date: '' }))
    expect(res).toMatchObject({ fieldErrors: { purchase_date: expect.any(String) } })
  })

  it('requires an idempotency key', async () => {
    const res = await createReceiptSubmissionAction(null, form({ client_idempotency_key: '' }))
    expect(res).toMatchObject({ error: expect.any(String) })
    expect(h.calls.inserted).toBeNull()
  })

  it('drops a malformed listing_id instead of sending it to Postgres', async () => {
    await createReceiptSubmissionAction(null, form({ listing_id: 'not-a-uuid' }))
    expect(h.calls.inserted).toMatchObject({ listing_id: null })
  })
})

describe('file upload', () => {
  it('uploads to receipt-uploads — the only receipt bucket that exists', async () => {
    await createReceiptSubmissionAction(null, form({ receipt_file: photo() }))
    expect(h.calls.uploadBucket).toBe('receipt-uploads')
  })

  it('writes a bucket-relative path under the user id, with no redundant prefix', async () => {
    await createReceiptSubmissionAction(null, form({ receipt_file: photo() }))
    expect(h.calls.uploadPath).toMatch(/^11111111-1111-4111-8111-111111111111\/\d+-[0-9a-f-]+\.jpg$/)
    expect(h.calls.uploadPath).not.toContain('receipts/')
  })

  it('stores the uploaded path on the row', async () => {
    await createReceiptSubmissionAction(null, form({ receipt_file: photo() }))
    expect(h.calls.inserted?.file_path).toBe(h.calls.uploadPath)
  })

  it('accepts HEIC — the form promises it and iPhone library picks deliver it', async () => {
    await createReceiptSubmissionAction(null, form({ receipt_file: photo('image/heic', 'IMG.heic') }))
    expect(h.calls.uploadContentType).toBe('image/heic')
    expect(h.calls.uploadPath).toMatch(/\.heic$/)
  })

  it('derives the extension from the MIME type, not the filename', async () => {
    await createReceiptSubmissionAction(null, form({ receipt_file: photo('image/png', 'no-extension') }))
    expect(h.calls.uploadPath).toMatch(/\.png$/)
  })

  it('rejects an unsupported type before touching storage', async () => {
    const res = await createReceiptSubmissionAction(
      null,
      form({ receipt_file: photo('image/gif', 'a.gif') })
    )
    expect(res).toMatchObject({ fieldErrors: { receipt_file: expect.any(String) } })
    expect(h.calls.uploadBucket).toBeNull()
    expect(h.calls.inserted).toBeNull()
  })

  it('surfaces an upload failure instead of silently saving without the photo', async () => {
    h.state.uploadError = { message: 'Bucket not found' }
    const res = await createReceiptSubmissionAction(null, form({ receipt_file: photo() }))
    expect(res).toMatchObject({ error: expect.any(String) })
    // The regression that shipped: this used to insert with file_path = null
    // and report success.
    expect(h.calls.inserted).toBeNull()
    expect(errorSpy).toHaveBeenCalled()
  })

  it('submits without a file when none is attached', async () => {
    const res = await createReceiptSubmissionAction(null, form())
    expect(res).toMatchObject({ success: true })
    expect(h.calls.uploadBucket).toBeNull()
    expect(h.calls.inserted).toMatchObject({ file_path: null })
  })
})

describe('insert failures', () => {
  it('logs the Postgres error so a handled return is not the only evidence', async () => {
    h.state.insertError = { code: '42P01', message: 'relation "receipt_uploads" does not exist' }
    const res = await createReceiptSubmissionAction(null, form())
    expect(res).toMatchObject({ error: 'Failed to submit receipt. Please try again.' })
    expect(errorSpy).toHaveBeenCalledWith(
      '[createReceiptSubmission] insert failed:',
      expect.objectContaining({ code: '42P01' })
    )
  })

  it('never logs user-entered text', async () => {
    h.state.insertError = { code: '42P01', message: 'nope' }
    await createReceiptSubmissionAction(null, form({ notes: 'private note' }))
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('private note')
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("Sylvia's Kitchen")
  })

  it('reports a duplicate distinctly', async () => {
    h.state.insertError = { code: '23505', message: 'duplicate key' }
    const res = await createReceiptSubmissionAction(null, form())
    expect(res).toMatchObject({ error: expect.stringContaining('already been submitted') })
  })
})
