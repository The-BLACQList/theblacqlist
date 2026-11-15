# Ticket 211: The brand directory, departments and price ranges

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** none
**Gates:** a migration (GATE-DATA). It goes to staging first, with a down plan, and reaches prod on the founder's word. `[Needs professional review]` Counsel should confirm the source rule below before the first directory brand is public. Everything public stays behind `FEATURE_MARKETPLACE_OPEN`.
**Decision record:**
- Founder, 2026-11-07: the catalog is Growth and Premium sellers, plus a curated directory of Black-owned brands we don't sell for, each with Where to buy.
- 2026-11-08, Q1 C: a brand is listed only from a source, and the brand attests to claim it. The claim itself is ticket 212.
- 2026-11-08, Q2 B: directory items show a price range from the brand.

## Why

Shop can't be "as wide as Amazon" from storefronts alone. Most of what a shopper buys every week, like hot sauce, pancake mix or shea butter, comes from Black-owned brands sold in grocery and drug stores. We don't sell for those brands, but we can point to them.

## Scope

In:
- **Migration** `directory_brands`:
  - `id`, `name`, `slug` (unique);
  - `website_url`, `city`, `state`, `description`, `logo_path`;
  - `source_url text NOT NULL` and `source_note text NOT NULL`, which say where we learned the brand is Black-owned;
  - `status`, one of `draft`, `listed` or `hidden`;
  - `claimed_by` (FK to profiles, SET NULL), `attested_at`, `attest_version`, all filled by ticket 212;
  - `created_by`, `updated_by`, `created_at`, `updated_at`.
- **Migration** `directory_products`:
  - `id`, `brand_id` (FK, CASCADE), `name`, `global_slug`, `description`, `image_path`;
  - `department`, `product_type`;
  - `price_low_cents`, `price_high_cents`, with `CHECK (price_low_cents > 0 AND price_high_cents >= price_low_cents)`;
  - `size_text`, such as "5 oz";
  - `status`, one of `draft`, `listed` or `hidden`;
  - the audit fields.
- **Migration: departments.**
  - Add a `department` column to both `directory_products` and `marketplace_products`. It's text with a CHECK limited to these values: `grocery_pantry`, `produce_meat_seafood`, `beauty_hair`, `clothing_shoes`, `home_kitchen`, `kids_baby`, `health_wellness`.
  - `marketplace_services` count as the `services` department in code. No column is needed for them.
  - Add `product_type` text to both tables. The list of types for each department lives in code (`lib/marketplace/departments.ts`). Example for Beauty & hair: Hair care, Skin & body, Makeup, Fragrance.
  - Existing products get a department from a one-time mapping of their `category_id`. Write the mapping and show the counts on staging first.
- **Slugs.** `global_slug` must be unique across both `marketplace_products` and `directory_products`. Check this in code on insert, so ticket 217 can serve both from `/marketplace/products/[slug]`.
- **RLS.**
  - The public can read `listed` brands, and `listed` products of `listed` brands.
  - Writes go through the service role from admin routes only. The claimed brand's own edits come in 212.
- **Admin** at `/admin/marketplace/directory`:
  - add and edit a brand. Source URL and source note are required, and the brand can't be set to `listed` without them;
  - add and edit its products, with department, type, price range and an image upload to the existing storage bucket pattern;
  - set the listed or hidden status.
- **Seller product form.** `/dashboard/products/new` and `/edit` get Department and Type selects. They're required for new items. If 222, the product editor rebuild, has merged first, add them there instead.

Out:
- Claim and attest, which is 212.
- Stockists, which is 213.
- Any public page. Those are 215 to 217.
- Bulk import. The founder adds brands by hand first. A CSV import comes later, if the hand-added list proves the model.

## Checks

- On staging, an admin can't set a brand to `listed` with an empty source. The server returns `422 SOURCE_REQUIRED`.
- A price range with the high end below the low end is rejected, both by the DB CHECK and by the zod schema.
- Signed out, an anon read of a `draft` or `hidden` brand or product returns nothing.
- Every existing `marketplace_products` row has a department after the backfill. The staging count is posted in the PR.
- The down migration drops the two new tables and the two new columns, and has been tested on staging.
