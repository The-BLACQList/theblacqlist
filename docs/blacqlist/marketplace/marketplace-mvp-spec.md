# Marketplace MVP Spec — The BLACQList

**Status:** Implemented (2026-05-11)
**Scope:** Foundation only — CTA-based marketplace, no checkout, no Stripe Connect

---

## What Was Built

The BLACQList Marketplace allows Black-owned businesses to list products and services with outbound CTAs (Shop Now, Book Now, Request Quote). Customers are linked to the vendor's external store or booking page. No payment processing occurs on the platform.

---

## Public Routes

| Route | Description |
|---|---|
| `/marketplace` | Hub page — hero, featured products (8), featured services (8), vendor CTA |
| `/marketplace/products` | Products index — up to 48 active products, grid layout |
| `/marketplace/products/[slug]` | Product detail page — image, price, description, Shop Now CTA |
| `/marketplace/services` | Services index — up to 48 active services, grid layout |
| `/marketplace/services/[slug]` | Service detail page — delivery mode, price, Book Now/Request Quote CTA |
| `/vendors/[slug]` | Vendor storefront — listing info, all active products and services for that vendor |

All public pages use ISR caching: `revalidate = 3600` (index pages), `revalidate = 1800` (detail and vendor pages).

---

## Owner/Vendor Routes (Dashboard)

| Route | Description |
|---|---|
| `/dashboard/products` | Products list — all products across owner's listings, status, edit link |
| `/dashboard/products/new` | Create product form |
| `/dashboard/products/[productId]/edit` | Edit product form |
| `/dashboard/services` | Services list — all services across owner's listings, status, edit link |
| `/dashboard/services/new` | Create service form |
| `/dashboard/services/[serviceId]/edit` | Edit service form |

---

## Admin Routes

| Route | Description |
|---|---|
| `/admin/marketplace` | Admin marketplace view — stats by status, recent products/services table |

---

## Data Model

### `marketplace_products`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `listing_id` | uuid | FK → listings.id |
| `name` | text | Max 200 chars |
| `slug` | text | Scoped to listing — UNIQUE(listing_id, slug) |
| `global_slug` | text | UNIQUE — used in public URL |
| `description` | text | Max 2000 chars |
| `price_cents` | integer | Nullable — cents |
| `compare_at_price_cents` | integer | Nullable — strikethrough price |
| `price_display_text` | text | Override display string |
| `cover_image_url` | text | External image URL (V1) |
| `category_id` | uuid | FK → categories.id, nullable |
| `tags` | text[] | Array of tag strings |
| `shipping_options` | text | shipping / pickup / both / digital / none |
| `return_policy_note` | text | Free text |
| `external_purchase_url` | text | Outbound CTA destination |
| `status` | text | draft / active / archived |
| `created_by` | uuid | FK → users.id |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated by trigger |

### `marketplace_services`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `listing_id` | uuid | FK → listings.id |
| `name` | text | Max 200 chars |
| `slug` | text | Scoped to listing — UNIQUE(listing_id, slug) |
| `global_slug` | text | UNIQUE — used in public URL |
| `description` | text | Max 2000 chars |
| `starting_price_cents` | integer | Nullable |
| `price_display_text` | text | Override display string |
| `duration_text` | text | e.g. "1 hour" |
| `delivery_mode` | text | virtual / in_person / travel / hybrid |
| `booking_url` | text | Outbound CTA destination |
| `cover_image_url` | text | External image URL (V1) |
| `status` | text | draft / active / archived |
| `created_by` | uuid | FK → users.id |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated by trigger |

---

## RLS Policies

Both tables use a single SELECT policy:
- Public (unauthenticated or any authenticated): `status = 'active'` AND the joined listing has `status = 'published'`
- Owner (authenticated): listing's `owner_user_id = auth.uid()`

INSERT and UPDATE require authentication and listing ownership verification in the server action (not in RLS).

---

## CTA Click Tracking

Route: `POST /api/marketplace/cta-click`

Fires on every outbound CTA click. Inserts into `analytics_events` with:
- `event_name: "cta_click"`
- `entity_type: "product" | "service"`
- `entity_id`, `listing_id`
- `properties.cta_type`, `properties.destination_url`
- `user_id` if session exists (best-effort)

Tracking is fire-and-forget — uses `navigator.sendBeacon()` with `fetch` keepalive fallback. Never blocks navigation.

---

## Slug Strategy

- `slug` — scoped per listing, UNIQUE(listing_id, slug)
- `global_slug` — `{listing.slug}-{product-slug}`, UNIQUE globally
- Public URL uses `global_slug`: `/marketplace/products/[global_slug]`
- Collision avoidance: timestamp suffix appended if conflict detected at creation

---

## Image Strategy (V1)

`cover_image_url` stores an external URL. Vendors paste a URL; no upload required. V2 will migrate to Supabase Storage with direct upload.

---

## Not Built at MVP

- Checkout, cart, or order management
- Stripe Connect or any payment processing
- Product/service image upload (V1 is URL-only)
- Category filtering on index pages
- Search within marketplace
- Vendor analytics beyond CTA click events
- Package options / pricing tiers for services
- Admin approval workflow for marketplace listings (auto-publish on status='active')

---

## Migration

**File:** `supabase/migrations/20260511000002_marketplace_foundation.sql`

Creates `marketplace_products` and `marketplace_services` tables with:
- CHECK constraints on status, shipping_options, delivery_mode, prices
- UNIQUE constraints on scoped and global slugs
- RLS policies
- `update_updated_at()` trigger applied to both tables
