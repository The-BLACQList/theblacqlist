// Resolves the cover image shown for a listing. Owner-uploaded covers win;
// when a listing has no cover we fall back to a type-based default photo so the
// directory never renders a wall of initials placeholders.
// See docs/blacqlist/design/default-covers-inventory.md for the photo sources.
//
// DEFAULT_COVERS is keyed by the listing's entity_type. The keys cover every
// value the DB CHECK constraint (listings_entity_type_check) allows —
// 'restaurant' and 'service_provider' are real DB values even though they are
// absent from the narrower TS `EntityType` union — so the param is typed
// `string`. Unknown/unmapped types fall back to the `business` set.
//
// Files live under public/defaults/covers/<type>/. A type may carry several
// photos; one is picked deterministically per listing id so the same type does
// not render an identical image across the grid. While a type's array is empty,
// resolveCoverImage returns src=null and callers show the initials placeholder
// (no 404, no regression) — approved photos are then a pure data drop-in.

const DEFAULT_COVERS: Record<string, string[]> = {
  business: [],
  restaurant: [],
  service_provider: [],
  professional: [],
  creative: [],
  vendor: [],
  event: [],
}

const FALLBACK_TYPE = 'business'

// FNV-1a string hash → stable non-negative int (no Math.random, so SSR and the
// client agree). Used only to spread a type's default photos across its listings.
function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * The type-based default cover for a listing, chosen deterministically by id.
 * Returns null when no default photo is configured for the type yet.
 */
export function defaultCoverFor(
  entityType: string | null | undefined,
  listingId: string
): string | null {
  const set = DEFAULT_COVERS[entityType ?? ''] ?? DEFAULT_COVERS[FALLBACK_TYPE] ?? []
  if (set.length === 0) return null
  if (set.length === 1) return set[0] ?? null
  return set[hashString(listingId) % set.length] ?? null
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

export interface ResolvedCover {
  /** Image src to render, or null → the caller shows the initials placeholder. */
  src: string | null
  /** True when src is a type default rather than the owner's uploaded cover. */
  isDefault: boolean
}

/**
 * Resolve a listing's cover image for rendering. Owner-uploaded covers win,
 * resolving a Supabase Storage path to its public URL (or passing through a
 * value that is already a full URL). Otherwise returns the type default.
 */
export function resolveCoverImage(
  coverImagePath: string | null | undefined,
  entityType: string | null | undefined,
  listingId: string
): ResolvedCover {
  if (coverImagePath) {
    const src = coverImagePath.startsWith('http')
      ? coverImagePath
      : `${SUPABASE_URL}/storage/v1/object/public/listing-media/${coverImagePath}`
    return { src, isDefault: false }
  }
  return { src: defaultCoverFor(entityType, listingId), isDefault: true }
}
