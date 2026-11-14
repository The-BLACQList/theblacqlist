# Ticket 221: Sell-ready catalog schema: variants, stock, images, files, shipping, purchasable view

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 211 for `department` and `product_type`. If 211 hasn't merged, this ticket adds the columns.
**Gates:** a migration (GATE-DATA). It goes to staging first with a down plan, and reaches prod on the founder's word. It doesn't change who can see what today: `FEATURE_CART` is closed by default, and the purchasable view returns nothing until the flags are on and a seller is onboarded.
**Decision record:** founder, 2026-11-13. Sold-out items are removed from the Shop. Both physical and digital products are sold. Photos for physical items are real uploads only.

## Why

`marketplace_products` (20260511000002) has a price, an external cover URL, an external purchase URL and a status. It has no stock, no variants, no uploaded photos, no files and no seller trust. A cart needs all of that, plus one place that answers "can this be bought right now".

## Scope

In. Migration `2026112xxxxxxx_marketplace_catalog.sql`, idempotent, with a written Down plan:

- **`marketplace_products`** gets new columns:
  - `product_kind` (`physical` or `digital`), default `physical`;
  - `review_status` (`pending`, `approved` or `rejected`), default `pending`;
  - `approved_at` and `approved_by`;
  - `return_policy_days` (0 to 90), plus `return_policy_note`;
  - `restricted_category` (null, `food`, `cosmetics`, `childrens`, `supplements`), plus `restricted_attested_at`.

  `external_purchase_url` stays for history, but code stops reading it for products. The archive is kept, with no drop.
- **`product_variants`:**
  - `id`, `product_id` (FK CASCADE);
  - `option1_name/value`, `option2_name/value`;
  - `sku`, `price_cents int CHECK > 0`;
  - `stock_mode` (`tracked` or `unlimited`), `quantity int CHECK >= 0`;
  - `low_stock_threshold`, `position`, `is_active`, and timestamps.

  Every product has at least one variant. The backfill creates one default variant per existing product from `price_cents`, with `stock_mode` set to `unlimited` and the product set to inactive (`status = draft`) until the seller confirms stock. Post the counts on staging.
- **`product_images`:**
  - `id`, `product_id`, `storage_path`, `position`, `alt`;
  - `provenance jsonb`, which holds `checked_at`, `c2pa`, `iptc_source_type`, `exif_software` and `verdict` (`clean`, `ai_tagged` or `unknown`);
  - `attested_by`, `attested_at`, `attest_version`.

  A CHECK requires an attestation on every image.
- **`product_files`:**
  - `id`, `product_id`, `storage_path` in the new private bucket `product-files`;
  - `filename`, `mime`, `bytes`, `sha256`;
  - `scan_status` (`not_scanned`, `clean`, `flagged`).
- **`shipping_profiles`:**
  - `id`, `listing_id`, `name`;
  - `base_cents`, `additional_item_cents`, `free_over_cents` (nullable);
  - `processing_days_min`, `processing_days_max` (1 to 10);
  - `ships_to` (text[], default the 50 states plus DC).

  Products reference `shipping_profile_id`; it's required when `product_kind = physical`. Products also get an optional `ships_to_override text[]`. Cottage-food rules often bar shipping across state lines, so a food product can be limited to the seller's own state. Checkout (226) rejects an address outside the allowed list.
- **`seller_status`**, one row per listing:
  - `trust` (`new` or `trusted`), `approved_count`;
  - `strikes`, `suspended_at`, `suspended_reason`.
- **`stock_reservations`:**
  - `id`, `variant_id`, `quantity`;
  - `checkout_session_id`, `expires_at`, `committed_at`, `released_at`.

  This ticket creates the table; 226 uses it.
- **`moderation_queue.queue_type`:** add `product_review` and `listing_report` to the CHECK. The latest CHECK is in `20261113000002_messaging.sql`; copy its list and add the two.
- **The `marketplace_purchasable_products` view, `security_invoker`.** A product is purchasable when all of these hold:
  - `status = active` and `review_status = approved`;
  - the listing is visible and on Growth or above (reuse the predicate from `20261028000000_marketplace_hide_below_growth.sql`);
  - the seller isn't suspended;
  - the seller's `seller_accounts` row (224) has `charges_enabled` and `payouts_enabled`;
  - at least one active variant has `stock_mode = unlimited` or `quantity - reserved > 0`.

  The view exposes `in_stock_variant_count` and `min_price_cents`. The flag check (`FEATURE_CART` and `FEATURE_MARKETPLACE_OPEN`) stays in code, in `lib/marketplace/purchasable.ts`, because env isn't visible to SQL. It's one function that every reader calls.
- **RLS:**
  - Anon and authenticated users read products, images and variants only through the view or a join to it.
  - Sellers read and write their own rows, matched by listing ownership as in the existing marketplace policies.
  - `product_files` is never readable by the public. Downloads go through 228.
  - `seller_status` and `stock_reservations` take service-role writes only.
- **Storage:** a private `product-files` bucket. Product photos go to the existing public listing-media pattern under `products/{product_id}/`.
- **Readers switched to the view:**
  - `EntityShopSection` (`components/entity-page/EntityShopSection.tsx`);
  - `/marketplace` and `/marketplace/products`;
  - the sitemap;
  - `lib/marketplace/visibility.ts`.

  When the view is empty, these show the existing empty or "opening soon" states.
- **Regenerate the types.**

Out:
- The editor UI (222), review (223), Connect (224) and checkout (226).

## Checks

Migration tests, using `tests/migrations/helpers.ts` `withScratchDb`:
- **Anon can't see** a product that is:
  - draft;
  - pending review;
  - from a suspended seller;
  - below Growth;
  - without payouts;
  - with every variant at 0.
- **Restocking** a variant from 0 to 1 makes the product visible again.
- **Anon gets 0 rows** from `product_files`.
- **The backfill** leaves no product without a variant.
- **The down migration** drops the new objects and restores the old CHECK. It's tested on staging.
