// =============================================================================
// Uploaded page videos (ticket 130): the rules both sides of an upload share
// =============================================================================
// The browser checks type and size before it asks for an upload URL, the
// server checks them again before it issues one, and the listing-video bucket
// (20261007000000) enforces both a third time on the bytes. These constants are
// the one place the first two read from, and they match the bucket exactly.
// =============================================================================

export const LISTING_VIDEO_BUCKET = 'listing-video'

/** Matches the bucket's file_size_limit (50 MB). */
export const LISTING_VIDEO_MAX_BYTES = 50 * 1024 * 1024

/** The only source of a stored video's extension. `file.name` is never used. */
export const LISTING_VIDEO_TYPES: Record<string, 'mp4' | 'mov' | 'webm'> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

/** For the file picker's `accept`. Extensions too, for systems that don't know a .mov's type. */
export const LISTING_VIDEO_ACCEPT = [
  ...Object.keys(LISTING_VIDEO_TYPES),
  '.mp4',
  '.m4v',
  '.mov',
  '.webm',
].join(',')

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const PATH_RE = new RegExp(`^listings/(${UUID})/video/${UUID}\\.(mp4|mov|webm)$`)

export function isListingVideoType(mime: string): boolean {
  return Object.hasOwn(LISTING_VIDEO_TYPES, mime)
}

const EXTENSION_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
}

/**
 * The type to upload a picked file as, or null when it isn't one we take.
 * Some browsers leave `file.type` empty for a .mov, and Safari calls an .m4v
 * `video/x-m4v`, so those fall back to the extension. The server still checks
 * the bytes, so a wrong guess fails there, not on the page.
 */
export function resolveListingVideoType(type: string, fileName: string): string | null {
  if (isListingVideoType(type)) return type
  if (type && type !== 'video/x-m4v') return null
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_TYPES[ext] ?? null
}

export function buildListingVideoPath(listingId: string, mime: string): string | null {
  const ext = LISTING_VIDEO_TYPES[mime]
  if (!ext) return null
  return `listings/${listingId}/video/${crypto.randomUUID()}.${ext}`
}

/** True when `path` is a video path inside this listing's own folder. */
export function isListingVideoPath(path: string, listingId: string): boolean {
  const m = PATH_RE.exec(path)
  return m !== null && m[1] === listingId
}

/** The folder every video for one listing lives in. */
export function listingVideoFolder(listingId: string): string {
  return `listings/${listingId}/video`
}

export function listingVideoPublicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${LISTING_VIDEO_BUCKET}/${path}`
}

/** "48 MB" style copy for limits and errors. */
export function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`
}
