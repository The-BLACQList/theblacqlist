import { describe, it, expect, vi, beforeEach } from 'vitest'

// Tickets 130 and 105: a page's videos. Each video is a row in listing_videos,
// a YouTube/Vimeo link or a file the owner uploaded straight to storage.
// What is pinned here:
//   * start: type, size, ownership, the plan's video limit and the rate limit
//     are checked before a one-time upload URL is issued, and the path is
//     always the server's.
//   * finish: a row only points at an object that is in this listing's
//     folder, really exists, and whose stored type and first bytes are video.
//     Anything else is removed from storage. Finishing twice adds one row.
//   * the limit: Starter holds 1 video, Growth 3, Premium any number. A paid
//     page at its limit is told to remove one; only Free is told to upgrade.
//   * remove and reorder work on every plan, and files no row uses are
//     removed, except a young one that may be an upload still in flight.

const LISTING_ID = '0b6f5c7e-1d2a-4c3b-9e8f-7a6b5c4d3e2f'
const OTHER_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const FOLDER = `listings/${LISTING_ID}/video`
const NAME = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d.mp4'
const PATH = `${FOLDER}/${NAME}`
const OLD_NAME = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.mov'
const OLD = `${FOLDER}/${OLD_NAME}`

const MP4_HEADER = [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]

type Row = {
  id: string
  kind: 'embed' | 'file'
  embed_url?: string | null
  file_path: string | null
  position: number
}

const h = vi.hoisted(() => {
  const state = {
    user: null as { id: string } | null,
    listing: null as Record<string, unknown> | null,
    rows: [] as Row[],
    insertFails: false,
    rateOk: true,
    objects: [] as { name: string; created_at?: string; metadata: Record<string, unknown> }[],
    header: [] as number[],
  }
  const inserts: Record<string, unknown>[] = []
  const removed: string[][] = []
  const signed: string[] = []
  let nextId = 1

  function videosQuery() {
    let op: 'select' | 'insert' | 'delete' | 'update' = 'select'
    let payload: Record<string, unknown> = {}
    const filters: Record<string, unknown> = {}
    const q = {
      select: () => q,
      order: () => q,
      eq: (col: string, val: unknown) => {
        filters[col] = val
        return q
      },
      insert: (row: Record<string, unknown>) => {
        op = 'insert'
        payload = row
        return q
      },
      delete: () => {
        op = 'delete'
        return q
      },
      update: (row: Record<string, unknown>) => {
        op = 'update'
        payload = row
        return q
      },
      then(resolve: (v: { data: unknown; error: unknown }) => void) {
        const mine = (r: Row) =>
          (!('id' in filters) || r.id === filters.id) &&
          (!('listing_id' in filters) || filters.listing_id === LISTING_ID)
        if (op === 'select') {
          const data = [...state.rows].sort((a, b) => a.position - b.position)
          return resolve({ data, error: null })
        }
        if (op === 'insert') {
          if (state.insertFails) return resolve({ data: null, error: { message: 'denied' } })
          inserts.push(payload)
          const row = { id: `v${nextId++}`, file_path: null, ...payload } as Row
          state.rows.push(row)
          return resolve({ data: [{ id: row.id }], error: null })
        }
        if (op === 'delete') {
          const gone = state.rows.filter(mine)
          state.rows = state.rows.filter((r) => !mine(r))
          return resolve({ data: gone.map((r) => ({ id: r.id })), error: null })
        }
        for (const r of state.rows.filter(mine)) Object.assign(r, payload)
        return resolve({ data: null, error: null })
      },
    }
    return q
  }

  function makeUserClient() {
    return {
      from(table: string) {
        if (table === 'listing_videos') return videosQuery()
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          maybeSingle: async () => ({ data: state.listing, error: null }),
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
    inserts,
    removed,
    signed,
    storage,
    resetIds: () => {
      nextId = 1
    },
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
  addListingVideoLinkAction,
  finishListingVideoUploadAction,
  moveListingVideoAction,
  removeListingVideoAction,
  startListingVideoUploadAction,
} from '@/lib/actions/dashboard/updateListingVideo'

const fetchMock = vi.fn(async () => new Response(new Uint8Array(h.state.header), { status: 206 }))

function setTier(tier: string) {
  h.state.listing = { ...h.state.listing, tier }
}

function embed(id: string, position: number): Row {
  return { id, kind: 'embed', embed_url: `https://youtu.be/${id}`, file_path: null, position }
}

const STARTER_FULL = 'Your plan includes 1 video. Remove one to add another.'
const GROWTH_FULL = 'Your plan includes up to 3 videos. Remove one to add another.'
const FREE_LOCKED = 'A video is part of Starter. Upgrade to add one to your page.'

beforeEach(() => {
  vi.clearAllMocks()
  h.inserts.length = 0
  h.removed.length = 0
  h.signed.length = 0
  h.resetIds()
  h.state.user = { id: 'u1' }
  h.state.listing = {
    id: LISTING_ID,
    slug: 'cafe',
    entity_type: 'business',
    tier: 'starter',
    cities: { slug: 'atlanta' },
  }
  h.state.rows = []
  h.state.insertFails = false
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

  it('refuses a Free page with the upgrade line', async () => {
    setTier('free')
    expect(await startListingVideoUploadAction(LISTING_ID, 'video/mp4', 10)).toEqual({
      error: FREE_LOCKED,
    })
    expect(h.signed).toHaveLength(0)
  })

  it('refuses a Starter page that already has its one video, without an upgrade line', async () => {
    h.state.rows = [embed('a', 0)]
    expect(await startListingVideoUploadAction(LISTING_ID, 'video/mp4', 10)).toEqual({
      error: STARTER_FULL,
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
  it('adds the upload at the end of the list and removes files no video uses', async () => {
    setTier('growth')
    h.state.rows = [embed('a', 0)]
    h.state.objects.push({ name: OLD_NAME, metadata: { mimetype: 'video/quicktime' } })
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toEqual({ success: true })
    expect(h.inserts).toEqual([
      { listing_id: LISTING_ID, position: 1, kind: 'file', file_path: PATH },
    ])
    expect(h.removed).toEqual([[OLD]])
    expect(fetchMock).toHaveBeenCalledWith(
      `https://x.supabase.co/storage/v1/object/public/listing-video/${PATH}`,
      expect.objectContaining({ headers: { Range: 'bytes=0-11' } })
    )
  })

  it('leaves a young unused file alone, since it may be another upload in flight', async () => {
    setTier('growth')
    h.state.objects.push({
      name: OLD_NAME,
      created_at: new Date().toISOString(),
      metadata: { mimetype: 'video/quicktime' },
    })
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toEqual({ success: true })
    expect(h.removed).toHaveLength(0)
  })

  it('adds one row when the same upload is finished twice', async () => {
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toEqual({ success: true })
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toEqual({ success: true })
    expect(h.inserts).toHaveLength(1)
  })

  it('lets Growth add a third video and refuses a fourth', async () => {
    setTier('growth')
    h.state.rows = [embed('a', 0), embed('b', 1)]
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toEqual({ success: true })
    expect(h.state.rows).toHaveLength(3)

    const fourth = `${FOLDER}/bbbbbbbb-cccc-4ddd-8eee-ffffffffffff.mp4`
    expect(await finishListingVideoUploadAction(LISTING_ID, fourth)).toEqual({
      error: GROWTH_FULL,
    })
    expect(h.state.rows).toHaveLength(3)
  })

  it('has no limit on Premium', async () => {
    setTier('premium')
    h.state.rows = [embed('a', 0), embed('b', 1), embed('c', 2), embed('d', 3)]
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toEqual({ success: true })
    expect(h.inserts).toEqual([expect.objectContaining({ position: 4 })])
  })

  it('refuses a path outside this listing, without saving or deleting', async () => {
    const foreign = `listings/${OTHER_ID}/video/${NAME}`
    expect(await finishListingVideoUploadAction(LISTING_ID, foreign)).toHaveProperty('error')
    expect(await finishListingVideoUploadAction(LISTING_ID, `${FOLDER}/../x.mp4`)).toHaveProperty(
      'error'
    )
    expect(h.inserts).toHaveLength(0)
    expect(h.removed).toHaveLength(0)
  })

  it('reports an upload that never arrived', async () => {
    h.state.objects = []
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toEqual({
      error: 'The upload did not finish. Please try again.',
    })
    expect(h.inserts).toHaveLength(0)
  })

  it('removes an object whose stored type is not video', async () => {
    h.state.objects = [{ name: NAME, metadata: { mimetype: 'text/html', size: 10 } }]
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toHaveProperty('error')
    expect(h.removed).toEqual([[PATH]])
    expect(h.inserts).toHaveLength(0)
  })

  it('removes an object whose bytes are not the type it claims', async () => {
    h.state.header = [0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e, 0, 0, 0, 0, 0, 0] // "<html>"
    const result = await finishListingVideoUploadAction(LISTING_ID, PATH)
    expect(result).toHaveProperty('error')
    expect(h.removed).toEqual([[PATH]])
    expect(h.inserts).toHaveLength(0)
  })

  it('removes the object when the header cannot be read', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toHaveProperty('error')
    expect(h.removed).toEqual([[PATH]])
  })

  it('refuses a Free page', async () => {
    setTier('free')
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toEqual({ error: FREE_LOCKED })
    expect(h.inserts).toHaveLength(0)
  })

  it('removes the object when the database refuses the row', async () => {
    h.state.insertFails = true
    expect(await finishListingVideoUploadAction(LISTING_ID, PATH)).toHaveProperty('error')
    expect(h.removed).toEqual([[PATH]])
  })
})

describe('addListingVideoLinkAction', () => {
  function form(url: string) {
    const fd = new FormData()
    fd.set('listing_id', LISTING_ID)
    fd.set('video_embed_url', url)
    return fd
  }

  it('adds the link at the end of the list', async () => {
    setTier('growth')
    h.state.rows = [embed('a', 0)]
    const result = await addListingVideoLinkAction(null, form('https://youtu.be/abc'))
    expect(result).toHaveProperty('success', true)
    expect(h.inserts).toEqual([
      { listing_id: LISTING_ID, position: 1, kind: 'embed', embed_url: 'https://youtu.be/abc' },
    ])
  })

  it('asks for a link when the box is empty', async () => {
    expect(await addListingVideoLinkAction(null, form('  '))).toEqual({
      error: 'Paste a YouTube or Vimeo link.',
    })
    expect(h.inserts).toHaveLength(0)
  })

  it('points other links to the upload instead', async () => {
    expect(await addListingVideoLinkAction(null, form('https://example.com/clip.mp4'))).toEqual({
      error: 'Links work from YouTube or Vimeo. To use another video, upload the file.',
    })
  })

  it('refuses a page at its limit', async () => {
    h.state.rows = [embed('a', 0)]
    expect(await addListingVideoLinkAction(null, form('https://youtu.be/abc'))).toEqual({
      error: STARTER_FULL,
    })
    expect(h.inserts).toHaveLength(0)
  })
})

describe('removeListingVideoAction', () => {
  it('removes one video by id, even on Free, and removes its file', async () => {
    setTier('free')
    h.state.rows = [embed('a', 0), { id: 'f', kind: 'file', file_path: PATH, position: 1 }]
    expect(await removeListingVideoAction(LISTING_ID, 'f')).toEqual({ success: true })
    expect(h.state.rows.map((r) => r.id)).toEqual(['a'])
    expect(h.removed).toEqual([[PATH]])
  })

  it('keeps files other videos still use', async () => {
    setTier('growth')
    h.state.rows = [embed('a', 0), { id: 'f', kind: 'file', file_path: PATH, position: 1 }]
    expect(await removeListingVideoAction(LISTING_ID, 'a')).toEqual({ success: true })
    expect(h.removed).toHaveLength(0)
  })

  it('reports a video that is not on the page', async () => {
    expect(await removeListingVideoAction(LISTING_ID, 'nope')).toEqual({
      error: 'Could not remove the video. Please try again.',
    })
  })
})

describe('moveListingVideoAction', () => {
  it('swaps a video with the one above and numbers the list from 0', async () => {
    // Older rows can share a position; the move still lands.
    h.state.rows = [embed('a', 0), embed('b', 0), embed('c', 5)]
    expect(await moveListingVideoAction(LISTING_ID, 'c', 'up')).toEqual({ success: true })
    const order = [...h.state.rows].sort((x, y) => x.position - y.position)
    expect(order.map((r) => [r.id, r.position])).toEqual([
      ['a', 0],
      ['c', 1],
      ['b', 2],
    ])
  })

  it('works on a lower plan, so an owner can choose what shows', async () => {
    setTier('starter')
    h.state.rows = [embed('a', 0), embed('b', 1), embed('c', 2)]
    expect(await moveListingVideoAction(LISTING_ID, 'c', 'up')).toEqual({ success: true })
    expect(await moveListingVideoAction(LISTING_ID, 'c', 'up')).toEqual({ success: true })
    const first = [...h.state.rows].sort((x, y) => x.position - y.position)[0]
    expect(first?.id).toBe('c')
  })

  it('does nothing past either end', async () => {
    h.state.rows = [embed('a', 0), embed('b', 1)]
    expect(await moveListingVideoAction(LISTING_ID, 'a', 'up')).toEqual({ success: true })
    expect(await moveListingVideoAction(LISTING_ID, 'b', 'down')).toEqual({ success: true })
    expect(h.state.rows.map((r) => [r.id, r.position])).toEqual([
      ['a', 0],
      ['b', 1],
    ])
  })
})
