import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 193: photo albums. What is pinned here:
//   * the album name rules, and the Growth+ gate with its 12-album bound.
//   * the owner's actions write `media_attachments.album`, scoped to the page.
//   * the gallery shows album chips at two albums, not at one, and not below
//     Growth (applyTierGates drops the albums, nothing is deleted).
//   * the migration, and the fail-soft reads in the loader and the editor.

const PAGE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_PAGE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const P1 = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001'
const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000002'
const P3 = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000003'
const STRANGER = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000099'

type Row = Record<string, unknown>

const h = vi.hoisted(() => {
  const state = {
    user: null as { id: string } | null,
    listing: null as Row | null,
    photos: [] as Row[],
    failWrite: false,
  }
  const writes: { row: Row; where: Record<string, unknown> }[] = []

  function query(table: string) {
    let op: 'select' | 'update' = 'select'
    let payload: Row = {}
    const eqs: Record<string, unknown> = {}
    let single = false
    const matches = (r: Row) => Object.entries(eqs).every(([k, v]) => r[k] === v)
    const run = () => {
      if (table === 'listings') {
        const l = state.listing
        const ok = l && state.user && l.owner_user_id === state.user.id && eqs.id === l.id
        return { data: ok ? l : null, error: null }
      }
      if (op === 'update') {
        if (state.failWrite) return { data: null, error: { message: 'denied' } }
        for (const r of state.photos.filter(matches)) Object.assign(r, payload)
        writes.push({ row: payload, where: { ...eqs } })
        return { data: null, error: null }
      }
      const out = state.photos.filter(matches).map((r) => ({ id: r.id, album: r.album }))
      return { data: single ? (out[0] ?? null) : out, error: null }
    }
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      is: () => q,
      not: () => q,
      eq: (col: string, val: unknown) => {
        eqs[col] = val
        return q
      },
      update: (row: Row) => {
        op = 'update'
        payload = row
        return q
      },
      maybeSingle: () => {
        single = true
        return q
      },
      then(resolve: (v: { data: unknown; error: unknown }) => void) {
        return resolve(run())
      },
    }
    return q
  }

  const client = { from: (t: string) => query(t) }
  return {
    state,
    writes,
    createClient: vi.fn(async () => client),
    createServiceClient: vi.fn(() => client),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: h.createClient,
  createServiceClient: h.createServiceClient,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/dashboard/revalidateEditors', () => ({ revalidateOwnerEditors: vi.fn() }))
vi.mock('@/lib/dashboard/guard', () => ({
  getOwnerSession: async () => (h.state.user ? { user: h.state.user } : null),
}))

import {
  ALBUMS_MAX,
  ALBUM_NAME_MAX,
  albumCounts,
  albumsAllowed,
  checkAlbumFile,
  parseAlbumName,
  toAlbumMap,
  withAlbums,
} from '@/lib/listings/photoAlbums'
import { renameAlbumAction, setPhotoAlbumAction } from '@/lib/actions/dashboard/photoAlbums'
import { applyTierGates } from '@/lib/entity-page/sections'
import { canAccess } from '@/lib/stripe/features'
import { EntityMediaGallery } from '@/components/entity-page/EntityMediaGallery'
import type { EntityPageData, GalleryImage } from '@/types'

function read(file: string): string {
  return readFileSync(join(__dirname, '..', file), 'utf8')
}

function photo(id: string, album: string | null = null, entityId = PAGE): Row {
  return { id, entity_type: 'listing', entity_id: entityId, album }
}

const img = (id: string, album?: string): GalleryImage => ({
  id,
  src: `/images/example/${id}.webp`,
  alt: id,
  ...(album ? { album } : {}),
})

function entityWith(images: GalleryImage[]): EntityPageData {
  return { images, details: { videos: [] }, faqs: [] } as unknown as EntityPageData
}

function gallery(entity: EntityPageData): string {
  return renderToStaticMarkup(createElement(EntityMediaGallery, { entity, images: entity.images }))
}

beforeEach(() => {
  h.writes.length = 0
  h.state.user = { id: 'owner-1' }
  h.state.failWrite = false
  h.state.photos = [photo(P1), photo(P2), photo(P3), photo(STRANGER, null, OTHER_PAGE)]
  h.state.listing = {
    id: PAGE,
    slug: 'cafe',
    status: 'published',
    entity_type: 'business',
    tier: 'growth',
    owner_user_id: 'owner-1',
    cities: { slug: 'houston' },
  }
})

// ── The rules ────────────────────────────────────────────────────────────────

describe('parseAlbumName', () => {
  it('trims and collapses spaces', () => {
    expect(parseAlbumName('  Main   Room ')).toEqual({ ok: true, value: 'Main Room' })
  })

  it('takes blank, null or missing as unfiled', () => {
    expect(parseAlbumName('   ')).toEqual({ ok: true, value: null })
    expect(parseAlbumName(null)).toEqual({ ok: true, value: null })
    expect(parseAlbumName(undefined)).toEqual({ ok: true, value: null })
  })

  it('refuses a name over the limit, and a non-string', () => {
    expect(parseAlbumName('x'.repeat(ALBUM_NAME_MAX))).toEqual({
      ok: true,
      value: 'x'.repeat(ALBUM_NAME_MAX),
    })
    expect(parseAlbumName('x'.repeat(ALBUM_NAME_MAX + 1))).toMatchObject({ ok: false })
    expect(parseAlbumName(42)).toMatchObject({ ok: false })
  })
})

describe('album helpers', () => {
  it('toAlbumMap keeps only rows with a real album', () => {
    expect(
      toAlbumMap([
        { id: P1, album: 'Food' },
        { id: P2, album: null },
        { id: P3, album: '  ' },
        { id: 4, album: 'Bad id' },
      ])
    ).toEqual({ [P1]: 'Food' })
    expect(toAlbumMap(null)).toEqual({})
  })

  it('albumCounts counts photos per album in first-seen order', () => {
    expect(albumCounts([P1, P2, P3], { [P2]: 'Drinks', [P1]: 'Food', [P3]: 'Drinks' })).toEqual([
      { name: 'Food', count: 1 },
      { name: 'Drinks', count: 2 },
    ])
  })

  it('withAlbums files mapped images and leaves the input alone', () => {
    const images = [img('a'), img('b')]
    const out = withAlbums(images, { a: 'Food' })
    expect(out.map((i) => i.album)).toEqual(['Food', undefined])
    expect(images[0]).not.toHaveProperty('album')
  })
})

describe('the plan', () => {
  it('photo albums come with Growth and up', () => {
    expect(canAccess('starter', 'photo_albums')).toBe(false)
    expect(canAccess('growth', 'photo_albums')).toBe(true)
    expect(canAccess('premium', 'photo_albums')).toBe(true)
    expect(albumsAllowed(null)).toBe(false)
  })

  it('checkAlbumFile needs Growth and stops new albums at the bound', () => {
    expect(checkAlbumFile('starter', 'Food', [])).toMatch(/come with Growth/)
    expect(checkAlbumFile('growth', 'Food', [])).toBeNull()
    const full = Array.from({ length: ALBUMS_MAX }, (_, i) => `Album ${i}`)
    expect(checkAlbumFile('growth', 'One More', full)).toMatch(/12 albums/)
    expect(checkAlbumFile('growth', 'Album 3', full)).toBeNull()
  })
})

// ── The gallery ──────────────────────────────────────────────────────────────

describe('album chips on the page', () => {
  const two = [img('a', 'Food'), img('b', 'Drinks'), img('c')]
  const one = [img('a', 'Food'), img('b', 'Food'), img('c')]

  it('show at two albums on a Growth page', () => {
    const html = gallery(applyTierGates(entityWith(two), 'growth'))
    expect(html).toContain('data-testid="gallery-albums"')
    expect(html).toContain('Food')
    expect(html).toContain('Drinks')
  })

  it('do not show at one album', () => {
    expect(gallery(applyTierGates(entityWith(one), 'growth'))).not.toContain('gallery-albums')
  })

  it('do not show below Growth, and the albums are kept, not deleted', () => {
    const entity = entityWith(two)
    const gated = applyTierGates(entity, 'starter')
    expect(gated.images.map((i) => i.album)).toEqual([undefined, undefined, undefined])
    expect(gated.images.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(gallery(gated)).not.toContain('gallery-albums')
    expect(entity.images.map((i) => i.album)).toEqual(['Food', 'Drinks', undefined])
  })
})

// ── The owner's actions ──────────────────────────────────────────────────────

describe('setPhotoAlbumAction', () => {
  it('files a photo, writing the column scoped to the page', async () => {
    const res = await setPhotoAlbumAction({ listingId: PAGE, mediaId: P1, album: ' Food ' })
    expect(res).toEqual({ success: true })
    expect(h.writes).toEqual([
      {
        row: { album: 'Food' },
        where: { id: P1, entity_type: 'listing', entity_id: PAGE },
      },
    ])
    expect(h.state.photos.find((p) => p.id === P1)?.album).toBe('Food')
  })

  it('takes a photo out of its album with a blank name, on any plan', async () => {
    h.state.photos[0] = photo(P1, 'Food')
    h.state.listing = { ...h.state.listing, tier: 'free' }
    const res = await setPhotoAlbumAction({ listingId: PAGE, mediaId: P1, album: '' })
    expect(res).toEqual({ success: true })
    expect(h.writes[0]?.row).toEqual({ album: null })
  })

  it('refuses filing below Growth', async () => {
    h.state.listing = { ...h.state.listing, tier: 'starter' }
    const res = await setPhotoAlbumAction({ listingId: PAGE, mediaId: P1, album: 'Food' })
    expect(res).toEqual({ error: expect.stringMatching(/come with Growth/) })
    expect(h.writes).toEqual([])
  })

  it('refuses a photo from another page, and another owner’s page', async () => {
    expect(
      await setPhotoAlbumAction({ listingId: PAGE, mediaId: STRANGER, album: 'Food' })
    ).toEqual({ error: 'Photo not found.' })
    h.state.user = { id: 'someone-else' }
    expect(await setPhotoAlbumAction({ listingId: PAGE, mediaId: P1, album: 'Food' })).toEqual({
      error: expect.stringMatching(/Page not found/),
    })
    expect(h.writes).toEqual([])
  })

  it('stops a 13th album but still files into an existing one', async () => {
    h.state.photos = Array.from({ length: ALBUMS_MAX + 1 }, (_, i) =>
      photo(
        `bbbbbbbb-bbbb-4bbb-8bbb-${String(i + 1).padStart(12, '0')}`,
        i < ALBUMS_MAX ? `A${i}` : null
      )
    )
    const last = h.state.photos[ALBUMS_MAX]?.id
    expect(await setPhotoAlbumAction({ listingId: PAGE, mediaId: last, album: 'New' })).toEqual({
      error: expect.stringMatching(/12 albums/),
    })
    expect(await setPhotoAlbumAction({ listingId: PAGE, mediaId: last, album: 'A0' })).toEqual({
      success: true,
    })
  })

  it('reports a failed write', async () => {
    h.state.failWrite = true
    const res = await setPhotoAlbumAction({ listingId: PAGE, mediaId: P1, album: 'Food' })
    expect(res).toEqual({ error: expect.stringMatching(/try again/) })
  })
})

describe('renameAlbumAction', () => {
  beforeEach(() => {
    h.state.photos = [
      photo(P1, 'Food'),
      photo(P2, 'Food'),
      photo(P3, 'Drinks'),
      photo(STRANGER, 'Food', OTHER_PAGE),
    ]
  })

  it('renames every photo in the album on this page only', async () => {
    expect(await renameAlbumAction({ listingId: PAGE, from: 'Food', to: 'Menu' })).toEqual({
      success: true,
    })
    expect(h.state.photos.map((p) => p.album)).toEqual(['Menu', 'Menu', 'Drinks', 'Food'])
    expect(h.writes[0]?.where).toEqual({ entity_type: 'listing', entity_id: PAGE, album: 'Food' })
  })

  it('a blank name takes the photos out of the album, on any plan', async () => {
    h.state.listing = { ...h.state.listing, tier: 'free' }
    expect(await renameAlbumAction({ listingId: PAGE, from: 'Food', to: '' })).toEqual({
      success: true,
    })
    expect(h.state.photos.map((p) => p.album)).toEqual([null, null, 'Drinks', 'Food'])
  })

  it('refuses an album the page does not have', async () => {
    expect(await renameAlbumAction({ listingId: PAGE, from: 'Nope', to: 'Menu' })).toEqual({
      error: 'Album not found.',
    })
    expect(h.writes).toEqual([])
  })
})

// ── The migration and the reads ──────────────────────────────────────────────

describe('migration 20261124000000_media_albums', () => {
  const sql = read('supabase/migrations/20261124000000_media_albums.sql')

  it('adds a nullable album column with a 1–40 CHECK', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS album text NULL/)
    expect(sql).toMatch(/album IS NULL OR char_length\(btrim\(album\)\) BETWEEN 1 AND 40/)
    expect(ALBUM_NAME_MAX).toBe(40)
  })

  it('changes no policy', () => {
    expect(sql).not.toMatch(/CREATE POLICY|DROP POLICY|GRANT/i)
  })

  it('is in the generated types', () => {
    const types = read('lib/supabase/types.ts')
    const block = types.slice(types.indexOf('      media_attachments: {'))
    expect(block.slice(0, 2500).match(/album\??: string \| null/g)).toHaveLength(3)
  })
})

describe('fail-soft reads', () => {
  it('the page loader reads albums separately, for Growth+ only', () => {
    const src = read('lib/listings/entityPage.ts')
    expect(src).toMatch(/albumsAllowed\(raw\.tier\)/)
    expect(src).toMatch(/error \? \{\} : toAlbumMap\(data\)/)
  })

  it('the editor shows no album controls when the column is missing', () => {
    expect(read('lib/listings/finishData.ts')).toMatch(/albums: albumError \? null : toAlbumMap/)
  })
})
