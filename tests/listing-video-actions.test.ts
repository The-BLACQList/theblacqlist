import { describe, it, expect, vi, beforeEach } from 'vitest'

// Ticket 130: owners upload their own page video. The browser sends the file
// straight to storage, so these actions are the only server code that sees it.
// What is pinned here:
//   * start: type, size, ownership, plan and rate limit are checked before a
//     one-time upload URL is issued, and the path is always the server's.
//   * finish: the page only points at an object that is in this listing's
//     folder, really exists, and whose stored type and first bytes are video.
//     Anything else is removed from storage.
//   * a page keeps one video: saving an upload clears the link, saving a link
//     clears the upload, and files the page no longer uses are removed.

const LISTING_ID = '0b6f5c7e-1d2a-4c3b-9e8f-7a6b5c4d3e2f'
const OTHER_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const FOLDER = `listings/${LISTING_ID}/video`
const NAME = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d.mp4'
const PATH = `${FOLDER}/${NAME}`
const OLD = `${FOLDER}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.mov`

const MP4_HEADER = [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]

const h = vi.hoisted(() => {
  const state = {
    user: null as { id: string } | null,
    listing: null as Record<string, unknown> | null,
    video: null as Record<string, unknown> | null,
    detailsRow: true,
    rateOk: true,
    objects: [] as { name: string; metadata: Record<string, unknown> }[],
    header: [] as number[],
  }
  const updates: Record<string, unknown>[] = []
  const removed: string[][] = []
  const signed: string[] = []

  function makeUserClient() {
    return {
      from(table: string) {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          maybeSingle: async () => ({
            data: table === 'listings' ? state.listing : state.video,
            error: null,
          }),
          update: (row: Record<string, unknown>) => {
            updates.push(row)
            return {
              eq: () => ({
                select: async () => ({
                  data: state.detailsRow ? [{ listing_id: 'x' }] : [],
                  error: null,
                }),
              }),
            }
          },
        }
        return builder
      },
    }
  }

  const storage = {
    list: vi.fn(async (_folder: string, opts?: { search?: string }) => ({
      data: state.objects.filter((o) => !opts?.search || o.name.includes(opts.search)),
      error: null,
    })),
    remove: vi.fn(async (paths: string[]) => {
      removed.push(paths)
      return { data: [], error: null }
    }),
    createSignedUploadUrl: vi.fn(async (path: string) => {
      signed.push(path)
      return { data: { signedUrl: `https://x.supabase.co/sign/${path}?token=t` }, error: null }
    }),
  }

  return {
    state,
    updates,
    removed,
    signed,
    storage,
    createClient: vi.fn(async () => makeUserClient()),
    createServiceClient: vi.fn(() => ({ storage: { from: () => storage } })),
    getOwnerSession: vi.fn(async () => (state.user ? { user: state.user } : null)),
    checkRateLimit: vi.fn(async () => state.rateOk),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: h.createClient,
  createServiceClient: h.createServiceClient,
}))
vi.mock('@/lib/dashboard/guard', () => ({ getOwnerSession: h.getOwnerSession }))
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: h.checkRateLimit }))
vi.mock('@/lib/dashboard/revalidateEditors', () => ({ revalidateOwnerEditors: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/listings/url', () => ({ buildEntityUrl: () => '/l/x' }))

import {
  finishListingVideoUploadAction,
  removeListingVideoAction,
  startListingVideoUploadAction,
  updateListingVideoAction,
} from '@/lib/actions/dashboard/updateListingVideo'

const fetchMock = vi.fn(async () => new Response(new Uint8Array(h.state.header), { status: 206 }))

beforeEach(() => {
  vi.clearAllMocks()
  h.updates.length = 0
  h.removed.length = 0
  h.signed.length = 0
  h.state.user = { id: 'u1' }
  h.state.listing = {
    id: LISTING_ID,
    slug: 'cafe',
    entity_type: 'business',
    tier: 'starter',
    cities: { slug: 'atlanta' },
  }
  h.state.video = { video_embed_url: null, video_path: null }
  h.state.detailsRow = true
  h.state.rateOk = true
  h.state.objects = [{ name: NAME, metadata: { mimetype: 'video/mp4', size: 4_000_000 } }]
  h.state.header = MP4_HEADER
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubGlobal('fetch', fetchMock)
})

describe('startListingVideoUploadAction', () => {
  it('issues an upload URL for a server-chosen path in the listing folder', async () => {
    const result = await startListingVideoUploadAction(LISTING_ID, 'video/quicktime', 1_000_000)
    expect('path' in result && result.path).toMatch(new RegExp(`^${FOLDER}/[0-9a-f-]{36}\\.mov$`))
    expect(h.signed).toHaveLength(1)
  })

  it('refuses other types and files over 50 MB before touching storage', async () => {
    expect(await startListingVideoUploadAction(LISTING_ID, 'video/x-msvideo', 10)).toEqual({
      error: 'Choose an MP4, MOV, or WebM video.',
    })
    const big = await startListingVideoUploadAction(LISTING_ID, 'video/mp4', 50 * 1024 * 1024 + 1)
    expect(big).toEqual({ error: 'Videos can be up to 50 MB.' })
    expect(await startListingVideoUploadAction(LISTING_ID, 'video/mp4', 0)).toHaveProperty('error')
    expect(h.signed).toHaveLength(0)
  })

  it('refuses a page the owner does not own', async () => {
    h.state.listing = null
    expect(await startListingVideoUploadAction(LISTING_ID, 'video/mp4', 10)).toHaveProperty('error')
    expect(h.signed).toHaveLength(0)
  })

  it('refuses a Free page', async () => {
    h.state.listing = { ...h.state.listing, tier: 'free' }
    const result = await startListingVideoUploadAction(LISTING_ID, 'video/mp4', 10)
    expect(result).toEqual({
      error: 'A video is part of Starter. Upgrade to add one to your page.',
    })
    expect(h.signed).toHaveLength(0)
  })

  it('stops at the rate limit', async () => {
    h.state.rateOk = false
    const result = await startListingVideoUploadAction(LISTING_ID, 'video/mp4', 10)
    expect(result).toHaveProperty('error')
    expect(h.checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'video_upload', identifier: 'u1' })
    )
    expect(h.signed).toHaveLength(0)
  })
})

describe('finishListingVideoUploadAction', () => {
  it('saves the upload, clears the link and removes older files', async () => {
    h.state.objects.push({ name: OLD.split('/').pop()!, metadata: { mimetype: 'video/quicktime' } })
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toEqual({ success: true })
    expect(h.updates).toEqual([{ video_embed_url: null, video_path: PATH }])
    expect(h.removed).toEqual([[OLD]])
    expect(fetchMock).toHaveBeenCalledWith(
      `https://x.supabase.co/storage/v1/object/public/listing-video/${PATH}`,
      expect.objectContaining({ headers: { Range: 'bytes=0-11' } })
    )
  })

  it('refuses a path outside this listing, without saving or deleting', async () => {
    const foreign = `listings/${OTHER_ID}/video/${NAME}`
    expect(await finishListingVideoUploadAction(LISTING_ID, foreign)).toHaveProperty('error')
    expect(await finishListingVideoUploadAction(LISTING_ID, `${FOLDER}/../x.mp4`)).toHaveProperty(
      'error'
    )
    expect(h.updates).toHaveLength(0)
    expect(h.removed).toHaveLength(0)
  })

  it('reports an upload that never arrived', async () => {
    h.state.objects = []
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toEqual({
      error: 'The upload did not finish. Please try again.',
    })
    expect(h.updates).toHaveLength(0)
  })

  it('removes an object whose stored type is not video', async () => {
    h.state.objects = [{ name: NAME, metadata: { mimetype: 'text/html', size: 10 } }]
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toHaveProperty('error')
    expect(h.removed).toEqual([[PATH]])
    expect(h.updates).toHaveLength(0)
  })

  it('removes an object whose bytes are not the type it claims', async () => {
    h.state.header = [0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e, 0, 0, 0, 0, 0, 0] // "<html>"
    const result = await finishListingVideoUploadAction(LISTING_ID, PATH)
    expect(result).toHaveProperty('error')
    expect(h.removed).toEqual([[PATH]])
    expect(h.updates).toHaveLength(0)
  })

  it('removes the object when the header cannot be read', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toHaveProperty('error')
    expect(h.removed).toEqual([[PATH]])
  })

  it('refuses a Free page', async () => {
    h.state.listing = { ...h.state.listing, tier: 'free' }
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toHaveProperty('error')
    expect(h.updates).toHaveLength(0)
  })

  it('removes the object when the page has no details row to save to', async () => {
    h.state.detailsRow = false
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toHaveProperty('error')
    expect(h.removed).toEqual([[PATH]])
  })
})

describe('updateListingVideoAction (link)', () => {
  function form(url: string) {
    const fd = new FormData()
    fd.set('listing_id', LISTING_ID)
    fd.set('video_embed_url', url)
    return fd
  }

  it('saving a link clears the upload and removes its file', async () => {
    h.state.video = { video_embed_url: null, video_path: PATH }
    const result = await updateListingVideoAction(null, form('https://youtu.be/abc'))
    expect(result).toHaveProperty('success', true)
    expect(h.updates).toEqual([{ video_embed_url: 'https://youtu.be/abc', video_path: null }])
    expect(h.removed).toEqual([[PATH]])
  })

  it('points other links to the upload instead', async () => {
    const result = await updateListingVideoAction(null, form('https://example.com/clip.mp4'))
    expect(result).toEqual({
      error: 'Links work from YouTube or Vimeo. To use another video, upload the file.',
    })
  })
})

describe('removeListingVideoAction', () => {
  it('clears both columns and removes stored files, even on Free', async () => {
    h.state.listing = { ...h.state.listing, tier: 'free' }
    expect(await removeListingVideoAction(LISTING_ID)).toEqual({ success: true })
    expect(h.updates).toEqual([{ video_embed_url: null, video_path: null }])
    expect(h.removed).toEqual([[PATH]])
  })
})
