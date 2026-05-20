-- Monetization Foundation
-- Additive only: plan_key column + 3 placeholder tables (subscriptions, sponsored_placements, sponsor_campaigns)
-- No Stripe wiring, no checkout logic, no subscription enforcement at this stage.

-- ─── 1. plans: add plan_key slug ────────────────────────────────────────────

ALTER TABLE plans ADD COLUMN IF NOT EXISTS plan_key text;

CREATE UNIQUE INDEX IF NOT EXISTS plans_plan_key_idx
  ON plans (plan_key)
  WHERE plan_key IS NOT NULL;

-- ─── 2. shared updated_at trigger function ───────────────────────────────────
-- CREATE OR REPLACE is safe even if this function already exists from a prior migration.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── 3. subscriptions (placeholder — no Stripe wiring yet) ───────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id             uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id                uuid REFERENCES plans(id) ON DELETE SET NULL,
  status                 text NOT NULL DEFAULT 'inactive'
                           CHECK (status IN ('active','inactive','canceled','past_due','trialing')),
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  stripe_subscription_id text,
  stripe_customer_id     text,
  created_at             timestamptz DEFAULT now() NOT NULL,
  updated_at             timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS subscriptions_listing_id_idx ON subscriptions (listing_id);
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx   ON subscriptions (user_id);

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- ─── 4. sponsored_placements (placeholder) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS sponsored_placements (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id               uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  placement_type           text NOT NULL CHECK (placement_type IN ('spotlight','boost')),
  placement_zone           text,   -- 'homepage' | 'city' | 'category' | 'search'
  starts_at                timestamptz,
  ends_at                  timestamptz,
  status                   text NOT NULL DEFAULT 'inactive'
                             CHECK (status IN ('active','inactive','scheduled','expired','canceled')),
  price_cents              integer,
  stripe_payment_intent_id text,
  created_at               timestamptz DEFAULT now() NOT NULL,
  updated_at               timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS sponsored_placements_listing_id_idx
  ON sponsored_placements (listing_id);

CREATE INDEX IF NOT EXISTS sponsored_placements_active_idx
  ON sponsored_placements (status, ends_at)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS sponsored_placements_updated_at ON sponsored_placements;
CREATE TRIGGER sponsored_placements_updated_at
  BEFORE UPDATE ON sponsored_placements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE sponsored_placements ENABLE ROW LEVEL SECURITY;
-- No public read policies yet — added when frontend rendering of placements is implemented.

-- ─── 5. sponsor_campaigns (placeholder) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS sponsor_campaigns (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sponsor_name   text NOT NULL,
  contact_email  text NOT NULL,
  campaign_type  text NOT NULL
                   CHECK (campaign_type IN ('city_spotlight','platform_partner','community_partner','editorial')),
  target_cities  text[],
  budget_cents   integer,
  starts_at      timestamptz,
  ends_at        timestamptz,
  status         text NOT NULL DEFAULT 'inquiry'
                   CHECK (status IN ('inquiry','proposal','active','completed','canceled')),
  notes          text,
  created_at     timestamptz DEFAULT now() NOT NULL,
  updated_at     timestamptz DEFAULT now() NOT NULL
);

DROP TRIGGER IF EXISTS sponsor_campaigns_updated_at ON sponsor_campaigns;
CREATE TRIGGER sponsor_campaigns_updated_at
  BEFORE UPDATE ON sponsor_campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE sponsor_campaigns ENABLE ROW LEVEL SECURITY;
-- Admin UI required before reads are needed — no policies yet.
