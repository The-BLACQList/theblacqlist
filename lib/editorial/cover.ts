// The cover shown on a BLACQLight story. A story cover can be one of our
// licensed editorial photos, which ship with the site in public/images/editorial
// (see docs/blacqlist/design/editorial-image-licenses.md). Store it as
// `/images/editorial/<file>.webp` and it renders as is.
//
// This lives here, not in resolveMediaPath, on purpose. resolveMediaPath also
// resolves listing covers and logos, and the Canva license forbids putting a
// pool photo on a listing (restriction 1). Only story pages call this.

import { resolveMediaPath } from '@/lib/listings/coverImage'

const EDITORIAL_PATH = /^\/images\/editorial\/[a-z0-9-]+\.(webp|jpg|jpeg|png)$/

/** Resolve a story's `cover_image_path`, or null when it has none. */
export function resolveStoryCover(path: string | null | undefined): string | null {
  if (path && EDITORIAL_PATH.test(path)) return path
  return resolveMediaPath(path)
}
