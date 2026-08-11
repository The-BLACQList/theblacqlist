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

export interface ResolvedRemoteImage {
  src: string
  /**
   * False when the host is outside `images.remotePatterns`. Pass straight to
   * next/image's `unoptimized` prop.
   */
  unoptimized: boolean
}

/**
 * True when next/image's optimizer will accept this URL — i.e. it matches an
 * entry in `images.remotePatterns` at next.config.ts:11-28. Kept deliberately
 * in sync with that block by hand: the config cannot be imported into app code
 * (it pulls in the Sentry wrapper), so if a pattern is added there, add it here.
 */
function isOptimizerAllowed(url: URL): boolean {
  if (!url.pathname.startsWith('/storage/v1/object/public/')) return false
  // `*.supabase.co` in a remotePattern matches exactly one label, so a deeper
  // host like a.b.supabase.co is NOT allowed there — an endsWith check would
  // wrongly mark it optimizable and earn a 400.
  if (url.protocol === 'https:' && /^[^.]+\.supabase\.co$/.test(url.hostname)) return true
  // Local Supabase dev server. `host` carries the port, which is the whole
  // point of the second remotePattern.
  return url.protocol === 'http:' && url.host === '127.0.0.1:54321'
}

/**
 * Resolve an owner-supplied marketplace image URL for rendering.
 *
 * `products.cover_image_url` and `services.cover_image_url` hold an arbitrary
 * external URL by design — the column comment at
 * `20260511000002_marketplace_foundation.sql:18` reads "MVP: external image
 * URL; V2: storage path" — and the create/update actions only check that the
 * value starts with `https://`. So an owner can, and will, paste a Shopify,
 * Etsy, or Squarespace URL.
 *
 * Those hosts are not in `images.remotePatterns`, and next/image responds to an
 * unlisted host with **400 from /_next/image** — the image does not render at
 * all. Three ways out, and only one is right:
 *
 *   - Whitelist the hosts in next.config.ts. Rejected: the set is unbounded
 *     (it is whatever an owner pastes), so it cannot be enumerated, and a
 *     wildcard remote pattern turns our optimizer into an open proxy.
 *   - Hide the image when the host is unlisted. Rejected: the owner filled the
 *     field and would see a placeholder with no explanation.
 *   - Render it unoptimized. `unoptimized` skips /_next/image entirely and
 *     emits a plain <img>, so no host check applies. That is what this does.
 *
 * The cost is that off-platform images are not resized or re-encoded, which is
 * the honest trade for an MVP field that accepts any host. It goes away when
 * the column moves to Storage paths in V2; at that point every value takes the
 * optimized branch on its own.
 *
 * Returns null for an absent or unparseable value — the caller renders its
 * placeholder. Non-http(s) schemes (`javascript:`, `data:`) are rejected here
 * rather than reaching an <img src>.
 */
export function resolveRemoteImage(
  rawUrl: string | null | undefined
): ResolvedRemoteImage | null {
  if (!rawUrl) return null

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  return { src: url.toString(), unoptimized: !isOptimizerAllowed(url) }
}
