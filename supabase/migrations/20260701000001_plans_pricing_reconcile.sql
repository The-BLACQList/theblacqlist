-- =============================================================================
-- Migration: reconcile plans to the 4-tier model + extend listings.tier
-- =============================================================================
-- Aligns the DB with the documented monetization spec (4 tiers):
--   Free $0 / Starter $19 ($182/yr) / Growth $49 ($470/yr) / Premium $99 ($950/yr)
-- Annual prices are ~20% off.
--
-- The originally-shipped code was 3-tier (free/standard/premium at $19/$49).
-- This renames standard->starter and premium->growth, and adds a new $99 premium.
-- Also backfills plan_key (checkout + upgrade filter plans by plan_key; without
-- it every paid tier 422'd / showed "Coming Soon" — the paid flow was dead).
--
-- Safe on a fresh DB (plans empty -> renames touch 0 rows, upserts insert), on an
-- existing 3-tier DB (renames + upserts), AND on re-apply against an already-4-tier
-- DB. Idempotent: the legacy renames are guarded (NOT EXISTS) so a second run is a
-- no-op instead of colliding on the plans.name unique index or downgrading a real
-- premium listing. Stripe price IDs are NOT touched here (set post-deploy via
-- `pnpm stripe:sync-price-ids`).
--
-- Down / rollback (run manually if needed):
--   ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_tier_check;
--   UPDATE listings SET tier='premium' WHERE tier='growth';
--   UPDATE listings SET tier='standard' WHERE tier='starter';
--   ALTER TABLE listings ADD CONSTRAINT listings_tier_check
--     CHECK (tier IN ('free','standard','premium'));
--   DELETE FROM plans WHERE name='premium';  -- the newly added $99 tier
--   ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_name_check;
--   UPDATE plans SET name='premium',  plan_key='premium',  price_monthly=49, price_yearly=490 WHERE name='growth';
--   UPDATE plans SET name='standard', plan_key='standard', price_monthly=19, price_yearly=190 WHERE name='starter';
--   ALTER TABLE plans ADD CONSTRAINT plans_name_check CHECK (name IN ('free','standard','premium'));
-- =============================================================================

-- 1. Extend the listings.tier CHECK to the 4-tier vocabulary. The inline column
--    CHECK from the initial schema is named listings_tier_check (verify with
--    `supabase db push --dry-run` before applying).
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_tier_check;

UPDATE listings SET tier = 'starter' WHERE tier = 'standard';
-- Guard premium->growth: once the new 4-tier premium ($99) plan exists (i.e. this
-- migration already ran), 'premium' is a legitimate current tier, so a re-apply must
-- NOT downgrade real premium listings to growth.
UPDATE listings SET tier = 'growth'  WHERE tier = 'premium'
  AND NOT EXISTS (SELECT 1 FROM plans WHERE name = 'premium' AND price_monthly = 99);

ALTER TABLE listings
  ADD CONSTRAINT listings_tier_check CHECK (tier IN ('free','starter','growth','premium'));

-- 2. Drop the old plans.name CHECK (locked to free/standard/premium) so the new
--    tier names are allowed, then rename existing rows BEFORE upserting so the
--    upsert's ON CONFLICT (name) matches the renamed rows instead of duplicating.
--    premium->growth first, which frees the 'premium' name for the new $99 tier.
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_name_check;

-- Guarded so a re-apply is a no-op: on the second run 'premium' is the new $99 tier
-- and 'growth'/'starter' already exist, so renaming would collide on plans_name_idx.
UPDATE plans SET name = 'growth',  plan_key = 'growth'
  WHERE name = 'premium'  AND NOT EXISTS (SELECT 1 FROM plans p2 WHERE p2.name = 'growth');
UPDATE plans SET name = 'starter', plan_key = 'starter'
  WHERE name = 'standard' AND NOT EXISTS (SELECT 1 FROM plans p2 WHERE p2.name = 'starter');

-- 3. Upsert the canonical 4-tier definition. stripe_price_id_* are intentionally
--    omitted so any real IDs already set are preserved.
INSERT INTO plans (name, plan_key, price_monthly, price_yearly, features, is_active, display_order)
VALUES
  ('free',    'free',    0.00,  0.00,
    '["basic_listing","contact_info","1_photo","category_listing","city_listing"]'::jsonb, true, 0),
  ('starter', 'starter', 19.00, 182.00,
    '["everything_in_free","verified_badge","priority_search_placement","owner_analytics_dashboard","10_photos","respond_to_reviews","remove_powered_by_badge"]'::jsonb, true, 1),
  ('growth',  'growth',  49.00, 470.00,
    '["everything_in_starter","20_photos","featured_collection_placement","editorial_eligibility","marketplace_category_spotlight","priority_support"]'::jsonb, true, 2),
  ('premium', 'premium', 99.00, 950.00,
    '["everything_in_growth","unlimited_photos","sponsored_spotlight_credit","homepage_featured_placement","dedicated_support","early_access"]'::jsonb, true, 3)
ON CONFLICT (name) DO UPDATE SET
  plan_key      = EXCLUDED.plan_key,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly  = EXCLUDED.price_yearly,
  features      = EXCLUDED.features,
  is_active     = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order;

-- 4. Re-add the name CHECK with the 4-tier vocabulary (section 2 dropped it).
ALTER TABLE plans
  ADD CONSTRAINT plans_name_check CHECK (name IN ('free','starter','growth','premium'));
