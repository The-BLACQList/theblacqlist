# Default Cover Images — Asset Inventory

**Purpose:** type-based default cover photos shown on any listing with no uploaded cover (`cover_image_path IS NULL`), so the directory never renders a wall of initials placeholders. Resolved by `lib/listings/coverImage.ts` (`resolveCoverImage`), keyed by `entity_type`.

**Status:** wiring shipped (helper + EntityCard + EntityPageHero + CollectionBusinessCard + OG image). **Photos pending** — `DEFAULT_COVERS` arrays in `lib/listings/coverImage.ts` are empty, so listings still show the initials placeholder (no regression) until photos are added here and to `public/defaults/covers/<type>/`.

---

## Rules (per `.claude/rules/3d-assets.md` → Asset Licensing)

- **No asset enters the product without a recorded license.** Source/author/license/commercial-use captured below before the file is committed.
- Default sources: **Unsplash** (Unsplash License — free commercial use, no attribution required) and **Pexels** (Pexels License — free commercial use, no attribution required). Attribution is recorded here regardless, as good practice.
- Photos are **generic-by-design defaults**, not claims about a specific business. Alt text stays `""` (decorative) — the business name is already the page/card heading.
- Curation intent: warm, editorial, representative of Black-owned business settings where natural; avoid anything that reads as a specific named storefront.

## Spec

- **Format / size:** 16:9, ~1600×900, optimized WebP, target ≤ ~150 KB each.
- **Location:** `public/defaults/covers/<entity_type>/<n>.webp` (served directly by Next from `/public`).
- **Entity types (DB `listings_entity_type_check`):** `business`, `restaurant`, `service_provider`, `professional`, `creative`, `vendor`, `event`.
- **Variety:** a type may carry several photos; `resolveCoverImage` picks one deterministically per listing id (`hash(id) % set.length`) so the same type doesn't repeat one image across the grid. **Note the seed skew:** ~all 254 seeded listings are `entity_type='business'`, so the **business** set most needs 4–6 photos to avoid a wall of identical covers; the other types are lower-volume today.
- **Optimization:** `scripts/optimize-default-covers.ts` (sharp) resizes/compresses approved originals → WebP.

---

## Inventory

> Fill one row per committed photo. `n` matches the filename (`<type>/<n>.webp`).

### business  _(highest priority — carries ~all seeded listings; aim 4–6)_
| n | source URL | author | license | size | status |
|---|---|---|---|---|---|
| _pending_ | | | | | |

### restaurant
| n | source URL | author | license | size | status |
|---|---|---|---|---|---|
| _pending_ | | | | | |

### service_provider
| n | source URL | author | license | size | status |
|---|---|---|---|---|---|
| _pending_ | | | | | |

### professional
| n | source URL | author | license | size | status |
|---|---|---|---|---|---|
| _pending_ | | | | | |

### creative
| n | source URL | author | license | size | status |
|---|---|---|---|---|---|
| _pending_ | | | | | |

### vendor
| n | source URL | author | license | size | status |
|---|---|---|---|---|---|
| _pending_ | | | | | |

### event
| n | source URL | author | license | size | status |
|---|---|---|---|---|---|
| _pending_ | | | | | |
