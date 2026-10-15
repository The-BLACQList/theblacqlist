// The cover shown on BLACQLight stories, city guides and collections. A cover
// can be one of our licensed editorial photos, which ship with the site in
// public/images/editorial (see docs/blacqlist/design/editorial-image-licenses.md).
// Store it as `/images/editorial/<file>.webp` and it renders as is.
//
// This lives here, not in resolveMediaPath, on purpose. resolveMediaPath also
// resolves listing covers and logos, and the Canva license forbids putting a
// pool photo on a listing (restriction 1). Only editorial pages call this.

import { resolveMediaPath } from '@/lib/listings/coverImage'

const EDITORIAL_PATH = /^\/images\/editorial\/[a-z0-9-]+\.(webp|jpg|jpeg|png)$/

/**
 * Resolve a story, guide or collection `cover_image_path`, or null when it has
 * none. Storage keys and full URLs still go through resolveMediaPath.
 */
export function resolveEditorialCover(path: string | null | undefined): string | null {
  if (path && EDITORIAL_PATH.test(path)) return path
  return resolveMediaPath(path)
}
