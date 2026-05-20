# Ticket 071: Products table migration and API endpoints — GET /api/listings/[id]/products, GET /api/products/[id]

---

## Status
Draft

## Phase
Phase 13: Marketplace Foundation

## Priority
P3 — Low

## Estimate
M (2–4h)

## Feature Area
Marketplace

---

## Context

Products are the child records that make vendor listings functional as storefronts. A vendor listing without products is an empty shell — this migration and its two read endpoints are the data foundation that every other marketplace ticket builds on.

The `products` table is a child of `listings` (specifically `listing_type = 'vendor'` listings, established by Ticket 070). Two public GET endpoints expose the product catalog: one lists all active products for a vendor, the other returns a single product by its own ID. Both are ISR-compatible and require no authentication — they are public-facing catalog pages.

**Important translation flag:** The `products` table stores a `status` enum (`'active'` / `'inactive'` / `'deleted'`). The API layer exposes this as `is_active: boolean` (computed as `status = 'active'`). This translation is intentional — it simplifies the frontend contract and hides internal lifecycle states. Do not expose the raw `status` enum in the API response.

Sources: `docs/blacqlist/architecture/api-contract.md` § Marketplace (Part C); `docs/blacqlist/data/database-schema-plan.md` § Commerce; `docs/blacqlist/architecture/architecture-decisions.md` ADR-003 (Supabase).

---

## User Story

As a visitor browsing a vendor's storefront, I want to see the vendor's product catalog load quickly, so that I can decide what to buy or inquire about without friction.

---

## Scope

**In scope:**
- Migration: `products` table creation with all fields defined below
- Index: `products_listing_id_idx` on `(listing_id)` for catalog list queries
- Index: `products_listing_slug_idx` on `(listing_id, slug)` — unique, vendor-scoped
- Index: `products_display_order_idx` on `(listing_id, display_order)` for ordered catalog render
- `GET /api/listings/[id]/products` Route Handler — returns paginated active products for a vendor listing
- `GET /api/products/[id]` Route Handler — returns a single active product by its own UUID
- Both endpoints filter `WHERE status = 'active' AND deleted_at IS NULL`
- Both endpoints are ISR-compatible (can be cached at the CDN layer); no `no-store` header
- `is_active: boolean` computed in the Route Handler from `status = 'active'` — never return the raw `status` field
- Standard response envelope: `{ data: Product[] | Product, meta?: {...} }`

**Out of scope:**
- Product creation, update, delete (Ticket 073)
- Vendor storefront page UI (Ticket 072)
- Admin product moderation (Ticket 074)
- Vendor extension table migration (depends on Ticket 070 which must exist first)
- Product sub-pages (`/vendor/[slug]/products/[product-slug]`) — ADR-010 notes this as V2

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 070 — Vendor listing extension table | Blocking ticket | Not started |
| Ticket 009 — `listings` base table | Blocking ticket | Not started |
| Ticket 013 — RLS policies | Blocking ticket | Not started |
| Ticket 002 — Supabase setup | Infrastructure | Not started |

---

## UX Notes

- **Consumer of this API:** Ticket 072 (Vendor storefront page) fetches `GET /api/listings/[id]/products` to populate the product grid section
- **Route Handler paths:** `app/api/listings/[id]/products/route.ts` and `app/api/products/[id]/route.ts`
- **Entry points:** Called by the Vendor storefront page Server Component on initial render
- **No UI in this ticket** — this is a data/API ticket only

---

## Design Notes

No UI in this ticket. The API response shape governs how Ticket 072 renders product cards. Ensure the response includes all fields the product card needs: `id`, `name`, `description`, `price_cents`, `slug`, `display_order`, `stock_count`, `category`, `is_active`, `images` (array of media attachment paths), `created_at`.

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` § Commerce
- **Entities involved:** `products` (new), `listings`, `media_attachments`
- **Operations:** SELECT only on both endpoints
- **Migration required:** Yes — `products` table

### products table definition

```sql
CREATE TABLE products (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id      uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  price_cents     integer NOT NULL CHECK (price_cents >= 0),
  category        text,
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive', 'deleted')),
  stock_count     integer,           -- NULL means unlimited / untracked
  display_order   integer NOT NULL DEFAULT 0,
  slug            text NOT NULL,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Vendor-scoped slug uniqueness (slug must be unique within a vendor's catalog)
CREATE UNIQUE INDEX products_listing_slug_unique_idx
  ON products (listing_id, slug)
  WHERE deleted_at IS NULL;

CREATE INDEX products_listing_id_idx       ON products (listing_id);
CREATE INDEX products_display_order_idx    ON products (listing_id, display_order);
CREATE INDEX products_status_idx           ON products (listing_id, status) WHERE deleted_at IS NULL;

-- updated_at trigger (standard pattern)
CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Images:** Product images are stored as rows in the existing `media_attachments` table using `entity_type = 'product'` and `entity_id = products.id`. The Route Handler joins `media_attachments` to assemble the `images` array.

**RLS policies:**
- `anon` and `authenticated` can SELECT products where `status = 'active' AND deleted_at IS NULL`
- Owners and admins can SELECT all products for their listing regardless of status (enforced in the dashboard, not in these public endpoints)
- Enforce in public endpoints via explicit `WHERE` clause, not relying on RLS alone

**Validation rules:**
- `price_cents >= 0` — enforced at DB level; `0` is a valid price (free items)
- `slug` must be non-empty, lowercase, hyphenated; validated at the service layer in Ticket 073
- Max 100 products per vendor — enforced in Ticket 073 create action, not here

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` § Marketplace (Part C)

### GET /api/listings/[id]/products

**Request:**
- Path param: `id` — UUID of the listing (vendor listing)
- Query params: `page` (default 1), `limit` (default 20, max 100)
- No auth required

**Response (200):**
```typescript
{
  data: Array<{
    id: string               // UUID
    name: string
    description: string | null
    price_cents: number
    category: string | null
    is_active: boolean       // computed: status === 'active'
    stock_count: number | null
    display_order: number
    slug: string
    images: Array<{
      path: string           // Supabase Storage path — NOT the CDN URL
      file_type: string
    }>
    created_at: string       // ISO 8601
  }>
  meta: {
    total: number
    page: number
    limit: number
  }
}
```

**Error codes:**

| Code | HTTP | Condition |
|---|---|---|
| `LISTING_NOT_FOUND` | 404 | No listing with this ID exists or `listing_type != 'vendor'` |
| `VALIDATION_ERROR` | 400 | `page` or `limit` is not a positive integer |
| `INTERNAL_ERROR` | 500 | Unexpected DB error |

**Caching:** `Cache-Control: s-maxage=3600, stale-while-revalidate=86400` — ISR 1h

### GET /api/products/[id]

**Request:**
- Path param: `id` — UUID of the product
- No auth required

**Response (200):** Same shape as a single product from the list endpoint (no `meta` wrapper), plus the parent listing reference: `listing_id: string`, `listing_slug: string`, `listing_name: string`.

**Error codes:**

| Code | HTTP | Condition |
|---|---|---|
| `PRODUCT_NOT_FOUND` | 404 | Product does not exist, is inactive, or is soft-deleted |
| `INTERNAL_ERROR` | 500 | Unexpected DB error |

**Caching:** Same ISR headers as list endpoint.

---

## Implementation Notes

**Files to create:**
- `supabase/migrations/[timestamp]_create_products_table.sql` — migration for the `products` table
- `app/api/listings/[id]/products/route.ts` — Route Handler for listing product catalog
- `app/api/products/[id]/route.ts` — Route Handler for single product detail
- `lib/services/products.ts` — data-access functions: `getProductsByListingId()`, `getProductById()`
- `types/marketplace.ts` — `Product`, `ProductListResponse`, `ProductDetailResponse` TypeScript interfaces

**Files to modify:**
- `types/index.ts` — re-export marketplace types if a barrel file exists

**Key patterns:**
- Use the anon Supabase client (not service role) in both Route Handlers — these are public reads
- Join `media_attachments` in a single query using `LEFT JOIN media_attachments ma ON ma.entity_type = 'product' AND ma.entity_id = p.id`; aggregate paths into an array using `json_agg` or a Supabase `.select()` with embedded relations
- **Never return the raw `status` field** — compute `is_active` in the service layer: `is_active: product.status === 'active'`
- Apply `WHERE p.status = 'active' AND p.deleted_at IS NULL` in `getProductsByListingId()` and `getProductById()`
- Order by `display_order ASC, created_at ASC` in the list endpoint
- Validate that the listing exists and `listing_type = 'vendor'` before querying products; return `LISTING_NOT_FOUND` otherwise
- Set ISR cache headers using `Response` constructor with `Cache-Control` header — do not use `next: { revalidate }` in Route Handlers (that option is for `fetch()` calls in Server Components)

**Do not:**
- Expose the `status` enum in any API response — always translate to `is_active: boolean`
- Return soft-deleted products (`deleted_at IS NOT NULL`) in public endpoints
- Store CDN URLs in the `images` array — store only `path` values; the frontend generates URLs via `supabase.storage.from('listing-media').getPublicUrl(path)`

---

## Acceptance Criteria

- [ ] Given a valid vendor listing ID with active products, `GET /api/listings/[id]/products` returns a paginated list with `is_active: true` for all items
- [ ] Given a valid vendor listing ID with no active products, the endpoint returns `{ data: [], meta: { total: 0, page: 1, limit: 20 } }` with HTTP 200 (not 404)
- [ ] Given a listing ID for a non-vendor listing, the endpoint returns 404 with `code: 'LISTING_NOT_FOUND'`
- [ ] Given a non-existent listing ID, the endpoint returns 404 with `code: 'LISTING_NOT_FOUND'`
- [ ] `GET /api/products/[id]` returns the correct product with `is_active: boolean`, `listing_id`, `listing_slug`, and `images` array
- [ ] Given a product with `status = 'inactive'`, `GET /api/products/[id]` returns 404 with `code: 'PRODUCT_NOT_FOUND'`
- [ ] Given a soft-deleted product (`deleted_at IS NOT NULL`), both endpoints exclude it from results
- [ ] The `images` array contains Supabase Storage paths (not CDN URLs); the raw `status` enum is never present in any response
- [ ] Products are ordered by `display_order ASC` in the list endpoint
- [ ] Pagination returns the correct `meta.total`, `meta.page`, and `meta.limit` values
- [ ] `tsc --noEmit` passes with zero errors on the new types and Route Handlers
- [ ] Both endpoints set `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`

---

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| Listing not found | Invalid listing ID or wrong entity type | 404 `{ error: "Listing not found.", code: "LISTING_NOT_FOUND" }` | Client shows "Page not found" |
| Product not found | Product inactive, deleted, or non-existent | 404 `{ error: "Product not found.", code: "PRODUCT_NOT_FOUND" }` | Client shows "Product not available" |
| DB query error | Supabase returns an error | 500 `{ error: "Something went wrong.", code: "INTERNAL_ERROR" }` | Client shows error state with retry |
| Invalid pagination params | `page=0` or `limit=abc` | 400 `{ error: "Validation failed.", code: "VALIDATION_ERROR" }` | Client falls back to defaults |

---

## Edge Cases

- Vendor with 0 active products (all inactive or none created) — list endpoint returns empty array with 200, not 404
- `price_cents = 0` — valid free product; `is_active: true`; must not be filtered out
- `stock_count = 0` — product is out of stock; still returned by the public API; the UI in Ticket 072 decides whether to show an "Out of stock" label
- Product `slug` contains a URL-unsafe character that somehow reached the DB — Route Handler must handle DB lookup by UUID (`id`), not by slug; slug is for display and vendor-scoped uniqueness only
- Large catalog (100 products at max) — pagination with `page=5&limit=20` must return the correct window; `meta.total` reflects the total active product count, not just the current page
- Race condition: product is deactivated between the list endpoint being called and the detail endpoint being called — detail endpoint correctly returns 404

---

## Accessibility Notes

No UI in this ticket. Accessibility requirements are scoped to Ticket 072 (storefront page) which consumes these endpoints.

---

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | Happy path: list products | Anonymous | `GET /api/listings/[valid-vendor-id]/products` | 200 with product array; all items have `is_active: true`; no `status` field in response |
| QA-2 | Empty catalog | Anonymous | `GET /api/listings/[vendor-id-with-no-active-products]/products` | 200 with `{ data: [], meta: { total: 0 } }` |
| QA-3 | Non-vendor listing | Anonymous | `GET /api/listings/[business-listing-id]/products` | 404 `LISTING_NOT_FOUND` |
| QA-4 | Single product detail | Anonymous | `GET /api/products/[valid-product-id]` | 200 with product; `listing_id`, `listing_slug`, `images` array present; no `status` field |
| QA-5 | Inactive product excluded | Anonymous | `GET /api/products/[inactive-product-id]` | 404 `PRODUCT_NOT_FOUND` |
| QA-6 | Pagination | Anonymous | `GET /api/listings/[id]/products?page=2&limit=5` | Returns second page of 5; `meta.page=2`, `meta.limit=5`, `meta.total` reflects full count |

---

## Security Notes

- Both endpoints are public (no auth) — do not leak `status` enum, internal IDs beyond `listing_id`, or soft-deleted records
- Validate the `id` path parameter is a valid UUID before issuing any DB query; return 400 if malformed (prevents potential injection attempts and avoids DB errors on non-UUID strings)
- Do not expose `deleted_at` timestamps in any response field

---

## Completion Checklist

- [ ] Migration file created, tested on local Supabase instance, and reviewed
- [ ] `GET /api/listings/[id]/products` Route Handler implemented
- [ ] `GET /api/products/[id]` Route Handler implemented
- [ ] `lib/services/products.ts` service functions implemented
- [ ] `types/marketplace.ts` interfaces defined
- [ ] `is_active` translation implemented — `status` enum never returned in responses
- [ ] ISR cache headers set on both endpoints
- [ ] All acceptance criteria verified
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
