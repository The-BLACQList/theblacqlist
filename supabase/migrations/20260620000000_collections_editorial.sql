-- ─────────────────────────────────────────────────────────────────────────────
-- Collections → editorial surface
-- Adds narrative depth to Collections so they can be the primary editorial
-- surface: a cover/subtitle/body on the collection, a per-business blurb +
-- headline on each item, and reusable editorial sections (mirrors guide_sections).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── collections: editorial fields ───────────────────────────────────────────
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS body text;
-- cover_image_path already exists on collections.

-- ── collection_items: per-business editorial context ─────────────────────────
ALTER TABLE collection_items
  ADD COLUMN IF NOT EXISTS headline text, -- optional pill, e.g. "Editor's pick"
  ADD COLUMN IF NOT EXISTS blurb text; -- "why it's in this collection"

-- ── collection_sections (mirrors guide_sections) ─────────────────────────────
CREATE TABLE IF NOT EXISTS collection_sections (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  heading       text NOT NULL,
  body          text,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS collection_sections_order_idx
  ON collection_sections (collection_id, display_order);

-- set_updated_at() was defined in the editorial foundation migration.
DROP TRIGGER IF EXISTS collection_sections_updated_at ON collection_sections;
CREATE TRIGGER collection_sections_updated_at
  BEFORE UPDATE ON collection_sections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE collection_sections ENABLE ROW LEVEL SECURITY;

-- Public reads sections only for active collections (mirror guide_sections policy).
DROP POLICY IF EXISTS "public read sections of active collections" ON collection_sections;
CREATE POLICY "public read sections of active collections"
  ON collection_sections FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_sections.collection_id
        AND c.is_active = true
    )
  );

-- collections / collection_items already have public-read RLS; service role
-- (admin writes) bypasses RLS, so no additional write policies are needed.
