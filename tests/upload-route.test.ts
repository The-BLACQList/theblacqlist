// =============================================================================
// POST /api/upload — the consolidated upload endpoint
// =============================================================================
// Three endpoints were merged into one. The merge is only worth doing if the
// strictest behavior of each survives it, so this suite pins the properties
// that were previously true on one endpoint and false on the others:
//
//   * the stored extension and content-type come from a server-side MIME map,
//     never from `file.name` or an unvalidated client string. /api/upload/
//     [bucket] took both from the client, which let extension, content-type
//     and actual bytes disagree.
//   * every write is ownership-checked. /api/upload/[bucket] had no check at
//     all — any signed-in user could write into a private bucket.
//   * the plan photo limit and the compensating delete apply to every gallery
//     upload, not only the ones that came through the dashboard.
//   * one response shape. The mismatch between `{ data: { path } }` and a
//     caller reading `{ path }` is what silently broke owner verification, so
//     the shape is asserted rather than assumed.
//
// The add-business pre-creation case is pinned deliberately: `entity_id` may
// name a listing row that does not exist yet, and that must stay allowed while
// a row owned by someone else stays denied.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state: {
    user: { id: string } | null
    listing: { id: string; owner_user_id: string | null; tier: string | null } | null
    photoCount: number
    uploadError: { message: string } | null
    insertError: { message: string } | null
  } = {
    user: null,
    listing: null,
    photoCount: 0,
    uploadError: null,
    insertError: null,
  }

  // What actually reached Supabase. The path and content-type are the whole
  // point of the consolidation, so they are recorded rather than inferred.
  const calls: {
    uploadBucket: string | null
    uploadPath: string | null
    uploadContentType: string | null
    inserted: Record<string, unknown> | null
    removed: { bucket: string; paths: string[] }[]
  } = {
    uploadBucket: null,
    uploadPath: null,
    uploadContentType: null,
    inserted: null,
    removed: [],
  }

  const createClient = vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from() {
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      Object.assign(builder, {
        select: chain,
        eq: chain,
        is: chain,
        maybeSingle: async () => ({ data: state.listing, error: null }),
      })
      return builder
    },
  }))

  const createServiceClient = vi.fn(() => ({
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, _body: unknown, opts: { contentType: string }) {
            calls.uploadBucket = bucket
            calls.uploadPath = path
            calls.uploadContentType = opts.contentType
            return { error: state.uploadError }
          },
          async remove(paths: string[]) {
            calls.removed.push({ bucket, paths })
            return { error: null }
          },
        }
      },
    },
    from() {
      let mode: 'count' | 'order' | 'insert' = 'count'
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      Object.assign(builder, {
        select(_cols: string, opts?: { count?: string; head?: boolean }) {
          if (!opts?.head) mode = mode === 'insert' ? 'insert' : 'order'
          return builder
        },
        insert(row: Record<string, unknown>) {
          mode = 'insert'
          calls.inserted = row
          return builder
        },
        eq: chain,
        order: chain,
        limit: chain,
        async maybeSingle() {
          // The display_order lookup. `null` means an empty gallery.
          return { data: state.photoCount > 0 ? { display_order: state.photoCount - 1 } : null }
        },
        async single() {
          return state.insertError
            ? { data: null, error: state.insertError }
            : { data: { id: 'media-1' }, error: null }
        },
        // The head/count query ends on `.eq()` and is awaited directly.
        then(resolve: (v: { count: number }) => unknown) {
          return Promise.resolve({ count: state.photoCount }).then(resolve)
        },
      })
      return builder
    },
  }))

  return { state, calls, createClient, createServiceClient }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: h.createClient,
  createServiceClient: h.createServiceClient,
}))

import { POST } from '@/app/api/upload/route'
import type { NextRequest } from 'next/server'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ID = '99999999-9999-4999-8999-999999999999'
const LISTING_ID = '22222222-2222-4222-8222-222222222222'

function file(type = 'image/jpeg', name = 'photo.jpg', bytes = 3): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

function req(fields: Record<string, string | File>): NextRequest {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return {
    async formData() {
      return fd
    },
  } as unknown as NextRequest
}

function listingMedia(overrides: Record<string, string | File> = {}): NextRequest {
  return req({
    file: file(),
    bucket: 'listing-media',
    entity_id: LISTING_ID,
    media_role: 'gallery',
    ...overrides,
  })
}

function verificationDoc(overrides: Record<string, string | File> = {}): NextRequest {
  return req({
    file: file(),
    bucket: 'verification-docs',
    entity_id: LISTING_ID,
    purpose: 'listing_verification',
    ...overrides,
  })
}

async function body(res: Awaited<ReturnType<typeof POST>>) {
  return (await res.json()) as {
    data?: { path?: string; mediaId?: string }
    error?: string
    code?: string
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.state.user = { id: USER_ID }
  h.state.listing = { id: LISTING_ID, owner_user_id: USER_ID, tier: 'premium' }
  h.state.photoCount = 0
  h.state.uploadError = null
  h.state.insertError = null
  h.calls.uploadBucket = null
  h.calls.uploadPath = null
  h.calls.uploadContentType = null
  h.calls.inserted = null
  h.calls.removed = []
})

describe('authentication', () => {
  it('refuses an anonymous upload before reading the file', async () => {
    h.state.user = null
    const res = await POST(listingMedia())
    expect(res.status).toBe(401)
    expect((await body(res)).code).toBe('AUTH_REQUIRED')
    expect(h.calls.uploadBucket).toBeNull()
  })
})

describe('input validation', () => {
  it('rejects a bucket that is not one of the two allowed', async () => {
    // receipt-uploads used to be reachable here. It is not a typo that it is
    // gone: receipts are written by row-scoped server actions.
    const res = await POST(listingMedia({ bucket: 'receipt-uploads' }))
    expect(res.status).toBe(400)
    expect((await body(res)).code).toBe('VALIDATION_ERROR')
    expect(h.calls.uploadBucket).toBeNull()
  })

  it('rejects a missing file', async () => {
    const res = await POST(req({ bucket: 'listing-media', entity_id: LISTING_ID }))
    expect(res.status).toBe(400)
    expect(h.calls.uploadBucket).toBeNull()
  })

  it('rejects a zero-byte file', async () => {
    const res = await POST(listingMedia({ file: file('image/jpeg', 'empty.jpg', 0) }))
    expect(res.status).toBe(400)
    expect(h.calls.uploadBucket).toBeNull()
  })

  it('rejects an entity_id that is not a UUID', async () => {
    const res = await POST(listingMedia({ entity_id: '../../etc/passwd' }))
    expect(res.status).toBe(400)
    expect(h.calls.uploadBucket).toBeNull()
  })

  it('rejects an unknown media_role', async () => {
    const res = await POST(listingMedia({ media_role: 'banner' }))
    expect(res.status).toBe(400)
    expect(h.calls.uploadBucket).toBeNull()
  })

  it('rejects an unknown purpose', async () => {
    const res = await POST(verificationDoc({ purpose: 'whatever' }))
    expect(res.status).toBe(400)
    expect(h.calls.uploadBucket).toBeNull()
  })
})

describe('MIME and size, per bucket', () => {
  it('rejects a PDF into listing-media — the bucket does not allow it', async () => {
    const res = await POST(listingMedia({ file: file('application/pdf', 'a.pdf') }))
    expect(res.status).toBe(400)
    expect((await body(res)).code).toBe('INVALID_FILE_TYPE')
    expect(h.calls.uploadBucket).toBeNull()
  })

  it('rejects WebP into verification-docs — the bucket does not allow it', async () => {
    const res = await POST(verificationDoc({ file: file('image/webp', 'a.webp') }))
    expect(res.status).toBe(400)
    expect((await body(res)).code).toBe('INVALID_FILE_TYPE')
  })

  it('accepts a PDF into verification-docs', async () => {
    const res = await POST(verificationDoc({ file: file('application/pdf', 'licence.pdf') }))
    expect(res.status).toBe(201)
    expect(h.calls.uploadPath).toMatch(/\.pdf$/)
  })

  it('applies the tighter logo limit, not the bucket default', async () => {
    const big = new File([new Uint8Array(3 * 1024 * 1024)], 'logo.png', { type: 'image/png' })
    const res = await POST(listingMedia({ file: big, media_role: 'logo' }))
    expect(res.status).toBe(413)
    expect((await body(res)).code).toBe('FILE_TOO_LARGE')
  })

  it('accepts at the cover limit what it refuses at the logo limit', async () => {
    const mid = () => new File([new Uint8Array(3 * 1024 * 1024)], 'x.png', { type: 'image/png' })
    const ok = await POST(listingMedia({ file: mid(), media_role: 'cover' }))
    expect(ok.status).toBe(201)
  })
})

describe('the stored path and content-type are server-controlled', () => {
  it('derives the extension from the MIME map, never from the filename', async () => {
    // The old endpoint took `.pop()` off the client's filename. A file claiming
    // to be a PNG while named `.php` stored as `.php`.
    await POST(listingMedia({ file: file('image/png', 'payload.php') }))
    expect(h.calls.uploadPath).toMatch(/\.png$/)
    expect(h.calls.uploadPath).not.toContain('php')
  })

  it('does not carry the client filename into the stored path at all', async () => {
    await POST(listingMedia({ file: file('image/jpeg', 'my holiday photo.jpg') }))
    expect(h.calls.uploadPath).not.toContain('holiday')
  })

  it('writes listing media under the listing and its role', async () => {
    await POST(listingMedia({ media_role: 'logo' }))
    expect(h.calls.uploadPath).toMatch(new RegExp(`^listings/${LISTING_ID}/logo/`))
  })

  it('separates listing verification from claim uploads by path', async () => {
    await POST(verificationDoc())
    expect(h.calls.uploadPath).toMatch(new RegExp(`^listings/${LISTING_ID}/verification/`))
  })

  it('keeps the claim path unchanged, so in-flight claim uploads still resolve', async () => {
    h.state.listing = null // a claim id names no listing row
    await POST(req({ file: file(), bucket: 'verification-docs', entity_id: LISTING_ID }))
    expect(h.calls.uploadPath).toMatch(new RegExp(`^claims/${LISTING_ID}/`))
  })

  it('gives two uploads of the same file distinct paths', async () => {
    await POST(listingMedia())
    const first = h.calls.uploadPath
    await POST(listingMedia())
    expect(h.calls.uploadPath).not.toBe(first)
  })
})

describe('ownership', () => {
  it('refuses listing media for a listing owned by someone else', async () => {
    h.state.listing = { id: LISTING_ID, owner_user_id: OTHER_ID, tier: 'premium' }
    const res = await POST(listingMedia())
    expect(res.status).toBe(403)
    expect((await body(res)).code).toBe('FORBIDDEN')
    expect(h.calls.uploadBucket).toBeNull()
  })

  it('allows listing media before the listing row exists — the add-business case', async () => {
    // MediaStep uploads against a client-generated id and creates the listing
    // with that same id afterwards. A missing row here is normal.
    h.state.listing = null
    const res = await POST(listingMedia())
    expect(res.status).toBe(201)
  })

  it('refuses a verification document when the listing does not exist', async () => {
    // Unlike listing media, there is no pre-creation case: the flow is only
    // reachable from a claimed listing's dashboard.
    h.state.listing = null
    const res = await POST(verificationDoc())
    expect(res.status).toBe(403)
    expect(h.calls.uploadBucket).toBeNull()
  })

  it('refuses a verification document for a listing owned by someone else', async () => {
    h.state.listing = { id: LISTING_ID, owner_user_id: OTHER_ID, tier: 'premium' }
    const res = await POST(verificationDoc())
    expect(res.status).toBe(403)
    expect(h.calls.uploadBucket).toBeNull()
  })
})

describe('the plan photo limit', () => {
  it('refuses a gallery upload once the tier limit is reached', async () => {
    h.state.listing = { id: LISTING_ID, owner_user_id: USER_ID, tier: 'free' } // 1 photo
    h.state.photoCount = 1
    const res = await POST(listingMedia())
    expect(res.status).toBe(400)
    expect((await body(res)).code).toBe('PLAN_LIMIT')
    expect(h.calls.uploadBucket).toBeNull()
  })

  it('does not apply the gallery limit to a logo', async () => {
    h.state.listing = { id: LISTING_ID, owner_user_id: USER_ID, tier: 'free' }
    h.state.photoCount = 5
    const res = await POST(listingMedia({ media_role: 'logo' }))
    expect(res.status).toBe(201)
  })

  it('cannot enforce a limit before the listing exists, and does not pretend to', async () => {
    h.state.listing = null
    h.state.photoCount = 99
    const res = await POST(listingMedia())
    expect(res.status).toBe(201)
  })
})

describe('the media_attachments row', () => {
  it('appends after the highest existing display_order', async () => {
    h.state.photoCount = 3
    await POST(listingMedia())
    expect(h.calls.inserted).toMatchObject({ display_order: 3, entity_id: LISTING_ID })
  })

  it('starts an empty gallery at zero', async () => {
    await POST(listingMedia())
    expect(h.calls.inserted).toMatchObject({ display_order: 0 })
  })

  it('records the mapped content-type, not the client string', async () => {
    await POST(listingMedia({ file: file('image/png', 'a.png') }))
    expect(h.calls.inserted).toMatchObject({ file_type: 'image/png', uploaded_by: USER_ID })
  })

  it('writes no row for a logo, a cover, or a verification document', async () => {
    await POST(listingMedia({ media_role: 'cover' }))
    expect(h.calls.inserted).toBeNull()
    await POST(verificationDoc())
    expect(h.calls.inserted).toBeNull()
  })

  it('removes the uploaded object when the row insert fails', async () => {
    // Otherwise the object is in the bucket with nothing pointing at it —
    // invisible, permanent, and it grows on every retry.
    h.state.insertError = { message: 'constraint violation' }
    const res = await POST(listingMedia())
    expect(res.status).toBe(500)
    expect(h.calls.removed).toEqual([{ bucket: 'listing-media', paths: [h.calls.uploadPath] }])
  })
})

describe('failures and the response shape', () => {
  it('reports a storage failure rather than claiming success', async () => {
    h.state.uploadError = { message: 'Bucket not found' }
    const res = await POST(listingMedia())
    expect(res.status).toBe(500)
    expect((await body(res)).code).toBe('UPLOAD_FAILED')
    expect(h.calls.inserted).toBeNull()
  })

  it('returns the path under `data`, which is what every caller reads', async () => {
    // VerificationUploadForm read `{ path }` off the top level against an
    // endpoint that returned `{ data: { path } }`, so every document reached
    // the server action as an empty string and submission was unreachable.
    const res = await POST(verificationDoc())
    const json = await body(res)
    expect(json.data?.path).toBe(h.calls.uploadPath)
    expect(json.data?.path).toEqual(expect.any(String))
  })

  it('returns the media id alongside the path for a gallery upload', async () => {
    const json = await body(await POST(listingMedia()))
    expect(json.data).toMatchObject({ path: expect.any(String), mediaId: 'media-1' })
  })

  it('pairs a machine-readable code with every human-readable error', async () => {
    const json = await body(await POST(listingMedia({ bucket: 'nope' })))
    expect(json.error).toEqual(expect.any(String))
    expect(json.code).toEqual(expect.any(String))
  })
})
