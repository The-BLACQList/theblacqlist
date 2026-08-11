# Default Cover Images — Asset Inventory

> ## ⛔ SUPERSEDED — 2026-08-09. Do not source photos against this document.
>
> **The strategy this document specifies was declined** `[Decision — 2026-08-09]`. No type-based default cover photos will be sourced, committed, or rendered. `DEFAULT_COVERS`, `FALLBACK_TYPE`, and `defaultCoverFor` have been removed from `lib/listings/coverImage.ts`; `public/defaults/covers/` was never created and will not be. `scripts/optimize-default-covers.ts` was never written.
>
> **What replaced it.** A listing with no cover renders the designed **F-1 "Monogram + Node Field"** fallback — `components/media/ImageFallback.tsx`, reached through `components/media/CoverImage.tsx`. It is a brand-abstract tile generated in CSS at render time from the business name and its **category**: dark ground, sparse gold node field jittered deterministically from the listing id, monogram in a Q-style ring, category named beneath. It ships **zero image files** and needs no per-type or per-category asset sets.
>
> **Why it was declined — three reasons, in order of weight:**
>
> 1. **It contradicted two approved design documents.** `living-commerce-index.md:63` had already ruled *"Unclaimed card: never stock photography that could be mistaken for the business."* `photographic-style-direction.md:25` requires *"Specificity over stock."* This inventory was added 2026-06-28, after both, and quietly reversed them. A generic photo on a card headed with a real business name reads as a photo *of that business* — the "generic-by-design defaults, not claims about a specific business" framing below does not survive contact with the rendered card.
> 2. **It was keyed on a dead axis.** 254 of 257 listings are `entity_type = 'business'` (98.8%) `[Measured — psql prod, 2026-08-09]`. The key yields **one** visual bucket for effectively the whole directory. The spec below already half-detected this ("note the seed skew") and answered it with "aim 4–6 photos" — four photos across 254 listings is ~64 listings per image. Category is the live axis: 23 distinct values, top 7 covering ~71%.
> 3. **The `≥40% real covers` target it served moved.** Real covers now arrive **only** from owners through the upload flywheel `[Decision — 2026-08-09]`; ≥40% is a post-launch metric rather than a launch blocker. There is no gap for stock to fill in the meantime.
>
> **Where the licensed photos went.** The 12 licensed JPEGs in `public/images/listings/` were repointed from this dead listing-cover pool to **page and editorial imagery** — the slot `photographic-style-direction.md:407` actually asks for. See `editorial-image-licenses.md`.
>
> **What still stands in this document.** Only the licensing rule: *no asset enters the product without a recorded license* (`.claude/rules/3d-assets.md`). That rule now governs `editorial-image-licenses.md`. Everything below is retained as the record of a considered and rejected approach — **it is not a work order.**

---

<details>
<summary><strong>Original document (superseded) — retained for the decision record</strong></summary>

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

</details>
