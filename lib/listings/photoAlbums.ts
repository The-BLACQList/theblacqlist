import { canAccess } from '@/lib/stripe/features'
import type { GalleryImage } from '@/types'

// Photo albums (ticket 193): the rules shared by the owner's actions, the
// dashboard and the page loader. Pure. The gallery's chip row, filter and
// lightbox already work from GalleryImage.album (lib/listings/galleryAlbums).

export const ALBUM_NAME_MAX = 40
/** Albums a page: enough to organise 50 photos, few enough for one chip row. */
export const ALBUMS_MAX = 12

/** Filing photos under albums comes with Growth and up. */
export function albumsAllowed(tier: string | null): boolean {
  return canAccess(tier, 'photo_albums')
}

export type ParsedAlbum = { ok: true; value: string | null } | { ok: false; error: string }

/** An album name as the table's CHECK takes it: one line, 1–40 characters. Blank → unfiled. */
export function parseAlbumName(value: unknown): ParsedAlbum {
  if (value === null || value === undefined) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false, error: 'Enter an album name.' }
  const name = value.replace(/\s+/g, ' ').trim()
  if (!name) return { ok: true, value: null }
  if (name.length > ALBUM_NAME_MAX) {
    return { ok: false, error: `Keep album names to ${ALBUM_NAME_MAX} characters.` }
  }
  return { ok: true, value: name }
}

/** id → album, from `media_attachments` rows. Rows without an album are left out. */
export function toAlbumMap(rows: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!Array.isArray(rows)) return out
  for (const r of rows as Record<string, unknown>[]) {
    if (typeof r?.id !== 'string' || typeof r.album !== 'string') continue
    const album = r.album.trim()
    if (album) out[r.id] = album
  }
  return out
}

/** Album names with how many photos each holds, in order of first appearance. */
export function albumCounts(
  ids: readonly string[],
  byId: Readonly<Record<string, string>>
): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const id of ids) {
    const album = byId[id]
    if (album) counts.set(album, (counts.get(album) ?? 0) + 1)
  }
  return [...counts].map(([name, count]) => ({ name, count }))
}

/** The page's images with their albums set. Images not in the map stay unfiled. */
export function withAlbums(
  images: readonly GalleryImage[],
  byId: Readonly<Record<string, string>>
): GalleryImage[] {
  return images.map((img) => (byId[img.id] ? { ...img, album: byId[img.id] } : img))
}

/** Filing a photo under `album`: a new album needs room under ALBUMS_MAX. */
export function checkAlbumFile(
  tier: string | null,
  album: string,
  existing: readonly string[]
): string | null {
  if (!albumsAllowed(tier)) return 'Photo albums come with Growth. Upgrade to sort your photos.'
  if (!existing.includes(album) && new Set(existing).size >= ALBUMS_MAX) {
    return `Your page has ${ALBUMS_MAX} albums. Use one of them, or rename one.`
  }
  return null
}
