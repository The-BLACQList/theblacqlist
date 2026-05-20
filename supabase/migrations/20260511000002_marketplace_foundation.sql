-- Marketplace Foundation — MVP
-- Phase: V1 (CTA-only; no Stripe Connect, no checkout)
-- Products and services with outbound purchase/booking CTAs.
-- Full transactional marketplace (Stripe Connect) is V2.

-- ─── marketplace_products ─────────────────────────────────────────────────────

CREATE TABLE marketplace_products (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id             uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  name                   text NOT NULL,
  slug                   text NOT NULL,          -- scoped slug: unique within a listing
  global_slug            text NOT NULL UNIQUE,   -- for public URL: /marketplace/products/[global_slug]
  description            text,
  price_cents            integer,                -- null = contact for pricing
  compare_at_price_cents integer,
  price_display_text     text,                   -- e.g. "Starting at $50" or "$25–$100"
  cover_image_url        text,                   -- MVP: external image URL; V2: storage path
  category_id            uuid REFERENCES categories(id) ON DELETE SET NULL,
  tags                   text[] DEFAULT '{}',
  shipping_options       text NOT NULL DEFAULT 'shipping',
  return_policy_note     text,
  external_purchase_url  text,
  status                 text NOT NULL DEFAULT 'draft',
  created_by             uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mp_name_length    CHECK (char_length(name) BETWEEN 2 AND 200),
  CONSTRAINT mp_status         CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT mp_shipping       CHECK (shipping_options IN ('shipping', 'pickup', 'both', 'digital', 'none')),
  CONSTRAINT mp_price_pos      CHECK (price_cents IS NULL OR price_cents > 0),
  CONSTRAINT mp_compare_pos    CHECK (compare_at_price_cents IS NULL OR compare_at_price_cents > 0),
  UNIQUE (listing_id, slug)
);

CREATE INDEX marketplace_products_listing_id_idx ON marketplace_products (listing_id);
CREATE INDEX marketplace_products_status_idx     ON marketplace_products (status);
CREATE INDEX marketplace_products_category_idx   ON marketplace_products (category_id);

CREATE TRIGGER set_marketplace_products_updated_at
  BEFORE UPDATE ON marketplace_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── marketplace_services ─────────────────────────────────────────────────────

CREATE TABLE marketplace_services (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id           uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  slug                 text NOT NULL,          -- scoped slug: unique within a listing
  global_slug          text NOT NULL UNIQUE,   -- for public URL: /marketplace/services/[global_slug]
  description          text,
  starting_price_cents integer,               -- null = contact for pricing
  price_display_text   text,
  duration_text        text,                  -- e.g. "30 min", "1–2 hours", "varies"
  delivery_mode        text NOT NULL DEFAULT 'in_person',
  package_options      jsonb,                 -- [{name, price_display, description}]
  booking_url          text,                  -- outbound booking / request URL
  cover_image_url      text,
  status               text NOT NULL DEFAULT 'draft',
  created_by           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ms_name_length CHECK (char_length(name) BETWEEN 2 AND 200),
  CONSTRAINT ms_status       CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT ms_delivery     CHECK (delivery_mode IN ('virtual', 'in_person', 'travel', 'hybrid')),
  CONSTRAINT ms_price_nonneg CHECK (starting_price_cents IS NULL OR starting_price_cents >= 0),
  UNIQUE (listing_id, slug)
);

CREATE INDEX marketplace_services_listing_id_idx ON marketplace_services (listing_id);
CREATE INDEX marketplace_services_status_idx     ON marketplace_services (status);

CREATE TRIGGER set_marketplace_services_updated_at
  BEFORE UPDATE ON marketplace_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_services ENABLE ROW LEVEL SECURITY;

-- Public + non-owner authenticated: only active items on published listings
-- Owners: all their own items (including draft/archived)
CREATE POLICY "marketplace_products_read"
  ON marketplace_products FOR SELECT
  USING (
    (
      status = 'active'
      AND EXISTS (
        SELECT 1 FROM listings
        WHERE listings.id = marketplace_products.listing_id
          AND listings.status = 'published'
          AND listings.deleted_at IS NULL
      )
    )
    OR
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM listings
        WHERE listings.id = marketplace_products.listing_id
          AND listings.owner_user_id = auth.uid()
          AND listings.deleted_at IS NULL
      )
    )
  );

CREATE POLICY "marketplace_products_insert"
  ON marketplace_products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
        AND listings.deleted_at IS NULL
    )
  );

CREATE POLICY "marketplace_products_update"
  ON marketplace_products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = marketplace_products.listing_id
        AND listings.owner_user_id = auth.uid()
        AND listings.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
        AND listings.deleted_at IS NULL
    )
  );

CREATE POLICY "marketplace_services_read"
  ON marketplace_services FOR SELECT
  USING (
    (
      status = 'active'
      AND EXISTS (
        SELECT 1 FROM listings
        WHERE listings.id = marketplace_services.listing_id
          AND listings.status = 'published'
          AND listings.deleted_at IS NULL
      )
    )
    OR
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM listings
        WHERE listings.id = marketplace_services.listing_id
          AND listings.owner_user_id = auth.uid()
          AND listings.deleted_at IS NULL
      )
    )
  );

CREATE POLICY "marketplace_services_insert"
  ON marketplace_services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
        AND listings.deleted_at IS NULL
    )
  );

CREATE POLICY "marketplace_services_update"
  ON marketplace_services FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = marketplace_services.listing_id
        AND listings.owner_user_id = auth.uid()
        AND listings.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
        AND listings.deleted_at IS NULL
    )
  );
