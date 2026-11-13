// Scoped image resolution for the sample pages (ticket 184).
//
// `resolveCoverImage` deliberately refuses anything that is not an owner upload:
// a photograph on a named business implies it depicts that business
// [Decision — 2026-08-09], so there is no stock fallback and there never will be.
// The sample pages are the one place a repo asset IS the right picture — "Test
// Business 123" is not a business — but that exception must not leak into live
// resolution. So it lives here, keyed on the render mode, and
// lib/listings/coverImage.ts is untouched.
//
// In 'live' mode this is `resolveCoverImage`, byte for byte. In 'example' mode a
// path under /images/example/ passes through as a public asset; anything else
// still goes through the live rule, so a fixture cannot smuggle an arbitrary
// src either.

import type { EntityRenderMode } from '@/lib/entity-page/template'
import { resolveCoverImage, type ResolvedCover } from '@/lib/listings/coverImage'

/**
 * The only shape an example asset path may take: one flat, lowercase file name
 * directly under /images/example/. No nested folders, no `..`, no query string,
 * no uppercase — the tests enumerate the directory against this pattern.
 */
export const EXAMPLE_ASSET_PATH = /^\/images\/example\/[a-z0-9-]+\.(webp|jpg|jpeg|png)$/

export function isExampleAssetPath(path: string | null | undefined): path is string {
  return typeof path === 'string' && EXAMPLE_ASSET_PATH.test(path)
}

/**
 * Resolve a cover for rendering, honouring example assets only in example mode.
 * Same return shape as `resolveCoverImage` so TemplateHero needs no branching.
 */
export function resolveEntityCover(
  coverImagePath: string | null | undefined,
  entityType: string | null | undefined,
  listingId: string,
  mode: EntityRenderMode = 'live'
): ResolvedCover {
  if (mode === 'example' && isExampleAssetPath(coverImagePath)) {
    return { src: coverImagePath }
  }
  return resolveCoverImage(coverImagePath, entityType, listingId)
}
