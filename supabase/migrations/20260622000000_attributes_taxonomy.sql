-- =============================================================================
-- Migration: Attributes taxonomy + Tags
-- Product: The BLACQList
-- Adds MyListing-grade faceted filtering richness:
--   * attribute_groups   — the facet sections (Identity & Ownership, Amenities, …)
--   * attribute_values   — the selectable options within a group
--   * listing_attributes — junction (which listing has which value)
--   * tags / listing_tags — flat discovery keywords (specced in the schema plan,
--                           never previously migrated; activated here)
--   * is_open_now(listing_id) — SQL port of EntityAtAGlance.isOpenNow() so the
--                           "Open now" filter agrees with the page indicator
-- Design: normalized group→value→junction (NOT EAV / NOT JSONB) so the vocabulary
-- is controlled, referentially sound, and per-option facet counts are cheap.
-- Mirrors the existing `categories` / `tags` conventions exactly.
-- =============================================================================


-- =============================================================================
-- TABLE: attribute_groups
-- One row per faceted filter section. `applies_to` reproduces MyListing's
-- "drag this field onto a listing type": empty array = applies to all entity
-- types; otherwise the group only applies to the listed entity types.
-- =============================================================================
CREATE TABLE attribute_groups (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text        NOT NULL,
  slug          text        NOT NULL,
  description   text,
  icon          text,
  input_type    text        NOT NULL DEFAULT 'checkbox'
                            CHECK (input_type IN ('checkbox','radio')),
  applies_to    text[]      NOT NULL DEFAULT '{}',  -- entity types; empty = all
  display_order integer     NOT NULL DEFAULT 0,
  is_filterable boolean     NOT NULL DEFAULT true,  -- show in the facet sidebar
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX attribute_groups_slug_idx          ON attribute_groups (slug);
CREATE INDEX        attribute_groups_display_order_idx ON attribute_groups (display_order)
  WHERE is_active = true;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON attribute_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE attribute_groups ENABLE ROW LEVEL SECURITY;

-- anon and authenticated users can read active groups (same pattern as categories)
CREATE POLICY "attribute_groups: public read active"
  ON attribute_groups FOR SELECT
  TO anon, authenticated
  USING (is_active = true);


-- =============================================================================
-- TABLE: attribute_values
-- One selectable option within a group. usage_count is denormalized and
-- maintained by a trigger on listing_attributes (mirrors tags.usage_count).
-- =============================================================================
CREATE TABLE attribute_values (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id      uuid        NOT NULL REFERENCES attribute_groups(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  slug          text        NOT NULL,
  icon          text,
  display_order integer     NOT NULL DEFAULT 0,
  usage_count   integer     NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (group_id, slug)
);

CREATE INDEX        attribute_values_group_idx ON attribute_values (group_id, display_order)
  WHERE is_active = true;
CREATE UNIQUE INDEX attribute_values_slug_idx  ON attribute_values (slug);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON attribute_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE attribute_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attribute_values: public read active"
  ON attribute_values FOR SELECT
  TO anon, authenticated
  USING (is_active = true);


-- =============================================================================
-- TABLE: listing_attributes
-- Junction: which listing has which attribute value. Composite PK prevents
-- duplicate assignments. Owner-writable; publicly readable for published rows.
-- =============================================================================
CREATE TABLE listing_attributes (
  listing_id uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  value_id   uuid        NOT NULL REFERENCES attribute_values(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (listing_id, value_id)
);

CREATE INDEX listing_attributes_listing_idx ON listing_attributes (listing_id);
CREATE INDEX listing_attributes_value_idx   ON listing_attributes (value_id);

ALTER TABLE listing_attributes ENABLE ROW LEVEL SECURITY;

-- anon can read attributes of published listings (same shape as listing_hours)
CREATE POLICY "listing_attributes: anon read published"
  ON listing_attributes FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.status = 'published'
        AND listings.deleted_at IS NULL
    )
  );

CREATE POLICY "listing_attributes: authenticated read"
  ON listing_attributes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND (
          (listings.status = 'published' AND listings.deleted_at IS NULL)
          OR listings.owner_user_id = auth.uid()
        )
    )
  );

CREATE POLICY "listing_attributes: owner insert"
  ON listing_attributes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "listing_attributes: owner delete"
  ON listing_attributes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );


-- =============================================================================
-- TRIGGER: maintain attribute_values.usage_count
-- Fires AFTER INSERT and AFTER DELETE on listing_attributes.
-- GREATEST guard prevents the count going below 0 (mirrors save_count trigger).
-- =============================================================================
CREATE OR REPLACE FUNCTION update_attribute_value_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE attribute_values SET usage_count = usage_count + 1 WHERE id = NEW.value_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE attribute_values SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = OLD.value_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listing_attributes_update_usage_count
  AFTER INSERT OR DELETE ON listing_attributes
  FOR EACH ROW EXECUTE FUNCTION update_attribute_value_usage_count();


-- =============================================================================
-- TABLE: tags
-- Flat discovery keywords (e.g. "vegan", "juneteenth", "minority-certified").
-- Specced in docs/blacqlist/data/database-schema-plan.md (Beta) but never
-- migrated until now. Complements attributes — tags are free-ish keywords,
-- attributes are controlled grouped facets.
-- =============================================================================
CREATE TABLE tags (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text        NOT NULL,
  slug        text        NOT NULL,
  usage_count integer     NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tags_slug_idx       ON tags (slug);
CREATE INDEX        tags_usage_count_idx ON tags (usage_count DESC) WHERE is_active = true;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags: public read active"
  ON tags FOR SELECT
  TO anon, authenticated
  USING (is_active = true);


-- =============================================================================
-- TABLE: listing_tags
-- Junction between listings and tags. Same access pattern as listing_attributes.
-- =============================================================================
CREATE TABLE listing_tags (
  listing_id uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tag_id     uuid        NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (listing_id, tag_id)
);

CREATE INDEX listing_tags_listing_idx ON listing_tags (listing_id);
CREATE INDEX listing_tags_tag_idx     ON listing_tags (tag_id);

ALTER TABLE listing_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing_tags: anon read published"
  ON listing_tags FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.status = 'published'
        AND listings.deleted_at IS NULL
    )
  );

CREATE POLICY "listing_tags: authenticated read"
  ON listing_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND (
          (listings.status = 'published' AND listings.deleted_at IS NULL)
          OR listings.owner_user_id = auth.uid()
        )
    )
  );

CREATE POLICY "listing_tags: owner insert"
  ON listing_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "listing_tags: owner delete"
  ON listing_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );


-- =============================================================================
-- TRIGGER: maintain tags.usage_count
-- =============================================================================
CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tags SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = OLD.tag_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listing_tags_update_usage_count
  AFTER INSERT OR DELETE ON listing_tags
  FOR EACH ROW EXECUTE FUNCTION update_tag_usage_count();


-- =============================================================================
-- FUNCTION: is_open_now(listing_id)
-- SQL port of EntityAtAGlance.isOpenNow() so the "Open now" search filter
-- agrees with the open/closed indicator on the listing page.
-- Semantics matched exactly: open when NOT closed AND now >= opens_at AND
-- now < closes_at (close is exclusive). No overnight wrap (same as client).
-- listing_hours.day_of_week is 0=Sunday..6=Saturday, which matches Postgres
-- EXTRACT(DOW). Platform timezone is America/New_York at launch (single tz);
-- per-listing timezone is a documented follow-up.
-- =============================================================================
CREATE OR REPLACE FUNCTION is_open_now(p_listing_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM listing_hours h
    WHERE h.listing_id = p_listing_id
      AND h.is_closed = false
      AND h.day_of_week = EXTRACT(DOW FROM (now() AT TIME ZONE 'America/New_York'))::int
      AND (now() AT TIME ZONE 'America/New_York')::time >= h.opens_at
      AND (now() AT TIME ZONE 'America/New_York')::time <  h.closes_at
  );
$$;
