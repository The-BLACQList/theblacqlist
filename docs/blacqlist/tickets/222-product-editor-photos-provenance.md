# Ticket 222: Product editor, photo uploads with an AI provenance check and attestation

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 221
**Gates:** no migration beyond 221. Behind `FEATURE_CART` for the seller dashboard entry point. A new dependency for C2PA parsing, if one is used, needs its licence noted in the PR.
**Decision record:** founder, 2026-11-13, pick 4. "Physical products cannot be represented with AI generated images." The rule is uploads only, no pasted URLs, an attestation, a provenance check, review of the first products, then spot checks.

## Why

The current product form (`components/marketplace/ProductForm`, actions in `lib/actions/marketplace/*`) takes an external image URL and has no zod schema. Sellers need one simple screen to sell: photos, price, options, stock, shipping and returns.

## Scope

In:
- **The editor** at `/dashboard/products/new` and `/[id]/edit`, rebuilt as on round 3 board R3-6:
  - **Type:** Physical or Digital.
  - **Basics:** title, description, department and type (from 211), and tags.
  - **Photos:** up to 8, dragged to reorder, with alt text. For a physical product, the attestation "Real photos of this item. No AI-generated or AI-altered product." is required per upload batch. The version text lives in `lib/marketplace/photoPolicy.ts`.
  - **Options and stock:**
    - up to 2 options, which generate variant rows;
    - each row has price, SKU, stock or Unlimited, and Active;
    - a low-stock alert field.
  - **Shipping profile** for physical products: pick one or create one inline.
  - **Return policy:** days, with presets None (defects only), 14 and 30, plus a note. The platform minimum is shown as fixed text.
  - **Restricted items:** if the department or type is food, cosmetics, children's or supplements, show the matching attestation from `prohibited-and-restricted-items.md`.
  - **Digital:** file upload to `product-files` (allowlist pdf, zip, epub, mp3, wav, mp4, png, jpg; 200 MB cap), plus a "Made with AI" disclosure toggle as the digital policy defines it.
- **The server actions** `createProduct`, `updateProduct` and `archiveProduct` are rewritten with zod `.strict()`. They follow `lib/actions/dashboard/deals.ts`: FormData in, `{ error, fieldErrors }` out, integer cents.
  - Seller edits never touch `review_status` or `approved_*`.
  - Saving a product from a `new` seller sets `review_status = pending` and queues it, per 223.
  - A `trusted` seller's save is approved, and 1 in 10 is queued as a spot check.
  - Archiving hides a product; nothing is deleted.
- **The upload route.** `app/api/upload/route.ts` gets a `product` role, and `lib/media/provenance.ts` is new:
  - The provenance check reads the **original bytes before** `lib/media/prepareImage.ts` strips metadata. It looks for:
    - a C2PA manifest or JUMBF box with an assertion `digitalSourceType` of `trainedAlgorithmicMedia` or `compositeWithTrainedAlgorithmicMedia`;
    - IPTC/XMP `Iptc4xmpExt:DigitalSourceType` with the same values;
    - EXIF/XMP `Software` or `CreatorTool` matching a maintained list of known generators, kept in `lib/media/aiGenerators.ts`.
  - On a physical product, a hit returns 422 `AI_IMAGE_REJECTED` with the plain message "This photo carries an AI-generated tag, so it can't be used for a physical product." A digital product accepts it and records it.
  - The verdict is stored on `product_images.provenance`.
  - `unknown` means no metadata, which is the normal case for phone photos after sharing. It's allowed, and review and spot checks catch the rest. The PR and the photo policy say so plainly: the check catches tagged images, not every AI image.
  - Keep `lib/security/file-signature.ts` checks and `prepareImage` resizing as they are.
  - **Never store the original bytes.** Only the `prepareImage` output is stored, so EXIF GPS location in sellers' photos never reaches the public. A test asserts that a stored product image has no GPS tags.
- **No pasted image URLs** for products. The `cover_image_url` field is no longer written.

Out:
- The review queue UI (223) and bulk CSV import.

## Checks

- **Unit tests for `provenance.ts`** use fixtures in `tests/fixtures/provenance/`:
  - a C2PA-signed image with `trainedAlgorithmicMedia`, which is rejected;
  - an IPTC DigitalSourceType image, which is rejected;
  - an image with a generator `Software` tag, which is rejected;
  - a plain camera JPEG, which is clean;
  - a stripped PNG, which is unknown.
- **The zod schemas** reject unknown fields, negative stock, a price of 0, more than 2 options and more than 8 photos.
- **A seller can't approve their own product** by posting extra fields.
- **E2E:** a seller creates a physical product with 2 sizes and stock, uploads a clean photo with the attestation, and the product shows as "In review".
