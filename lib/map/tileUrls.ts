/**
 * Basemap tile URLs. The browser asks for plain z/x/y tiles
 * (`/api/map/tiles/v1/metros/12/1088/1638`), and the route reads each one out
 * of the PMTiles file in storage. A plain GET with no Range header is a
 * response Vercel's CDN can keep, so a tile costs a storage read once per CDN
 * region, not once per visitor per zoom.
 *
 * [Decision — founder, 2026-10-14: map imagery is too slow on first load and
 * on zoom, a must-fix before launch.]
 *
 * Bump TILES_VERSION whenever a tile file in storage is replaced. The CDN keeps
 * tiles for a year, so a new file needs new URLs.
 */
export const TILES_VERSION = 'v1'

/** The tile files the route can read, by the name used in the URL. */
export const TILE_ARCHIVES = ['metros'] as const
export type TileArchive = (typeof TILE_ARCHIVES)[number]

/** Deepest zoom any tile file holds. Anything deeper is not a tile we have. */
export const MAX_TILE_ZOOM = 15

/** MapLibre tile template for one archive, on the given origin. */
export function tileTemplate(origin: string, archive: TileArchive): string {
  return `${origin}/api/map/tiles/${TILES_VERSION}/${archive}/{z}/{x}/{y}`
}

export interface TileRequest {
  archive: TileArchive
  z: number
  x: number
  y: number
}

/**
 * Validates the route's path segments. Returns null for anything that is not
 * a real tile address, so the route can answer 404 without touching storage.
 * Any `v<number>` version is accepted: a tab opened before a version bump
 * keeps working (it gets the current file under its old URLs).
 */
export function parseTileRequest(params: {
  version: string
  archive: string
  z: string
  x: string
  y: string
}): TileRequest | null {
  if (!/^v\d{1,3}$/.test(params.version)) return null
  const archive = TILE_ARCHIVES.find((a) => a === params.archive)
  if (!archive) return null
  const [z, x, y] = [params.z, params.x, params.y].map((s) => (/^\d{1,6}$/.test(s) ? Number(s) : NaN))
  if (z === undefined || x === undefined || y === undefined) return null
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) return null
  if (z > MAX_TILE_ZOOM) return null
  const size = 2 ** z
  if (x >= size || y >= size) return null
  return { archive, z, x, y }
}
