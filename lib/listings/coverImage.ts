// Resolves the cover image shown for a listing. There is exactly one source of
// a cover: the owner uploads it. When a listing has no cover, this returns
// src=null and the caller renders the designed F-1 fallback
// (components/media/ImageFallback.tsx) — a brand-abstract monogram tile, never
// a photograph that could be mistaken for the business.
//
// This file previously held DEFAULT_COVERS, a per-entity_type set of stock
// photos intended to fill empty covers. That strategy was declined
// [Decision — 2026-08-09]: it contradicted living-commerce-index.md:63
// ("Unclaimed card: never stock photography that could be mistaken for the
// business") and photographic-style-direction.md:25 ("Specificity over stock").
// It was also keyed on a dead axis — 254 of 257 listings are entity_type
// 'business' [Measured — psql prod, 2026-08-09], so it produced one visual
// bucket for the entire directory. The fallback is keyed on category instead,
// and is generated in CSS rather than shipped as files.
//
// See docs/blacqlist/design/default-covers-inventory.md (superseded).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

export interface ResolvedCover {
  /** Image src to render, or null → the caller shows the F-1 ImageFallback. */
  src: string | null
}

/**
 * Turn a stored `cover_image_path` into something next/image can load: a value
 * that is already an absolute URL passes through, anything else is treated as a
 * key in the `listing-media` bucket. Shared by listing covers and by the
 * editorial tables (`collections.cover_image_path`), which store the same shape.
 */
export function resolveMediaPath(path: string | null | undefined): string | null {
  if (!path) return null
  return path.startsWith('http')
    ? path
    : `${SUPABASE_URL}/storage/v1/object/public/listing-media/${path}`
}

/**
 * Resolve a listing's cover image for rendering. An owner-uploaded cover
 * resolves its Supabase Storage path to a public URL (or passes through a value
 * that is already a full URL). With no cover, src is null.
 *
 * `entityType` and `listingId` are retained in the signature: callers pass a
 * listing's identity here and the resolution rule is a likely place to grow
 * again (per-tier or per-category cover sources), so the call sites stay stable.
 */
export function resolveCoverImage(
  coverImagePath: string | null | undefined,
  _entityType: string | null | undefined,
  _listingId: string
): ResolvedCover {
  return { src: resolveMediaPath(coverImagePath) }
}
