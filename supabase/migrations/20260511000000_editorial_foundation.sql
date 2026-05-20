-- ─────────────────────────────────────────────────────────────────────────────
-- Editorial Foundation — BLACQLight, Guides, Guide Sections
-- Phase: V1 editorial tables (editorial_articles, guides, guide_sections)
-- Collections and collection_items were already added in the initial MVP migration.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── editorial_articles (BLACQLight) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS editorial_articles (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title            text NOT NULL,
  slug             text NOT NULL UNIQUE,
  subtitle         text,
  body             text,
  cover_image_path text,
  author_name      text NOT NULL DEFAULT 'The BLACQList Team',
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'published')),
  published_at     timestamptz,
  meta_description text,
  tags             text[],
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS editorial_articles_slug_idx
  ON editorial_articles (slug);

CREATE INDEX IF NOT EXISTS editorial_articles_status_published_idx
  ON editorial_articles (status, published_at DESC);

-- ── guides ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guides (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title            text NOT NULL,
  slug             text NOT NULL UNIQUE,
  subtitle         text,
  description      text,
  cover_image_path text,
  city             text,
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'published')),
  published_at     timestamptz,
  meta_description text,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS guides_slug_idx
  ON guides (slug);

CREATE INDEX IF NOT EXISTS guides_status_published_idx
  ON guides (status, published_at DESC);

-- ── guide_sections ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guide_sections (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id      uuid NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  heading       text NOT NULL,
  body          text,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS guide_sections_guide_order_idx
  ON guide_sections (guide_id, display_order);

-- ── updated_at triggers ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER editorial_articles_updated_at
  BEFORE UPDATE ON editorial_articles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER guides_updated_at
  BEFORE UPDATE ON guides
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER guide_sections_updated_at
  BEFORE UPDATE ON guide_sections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE editorial_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guides              ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_sections      ENABLE ROW LEVEL SECURITY;

-- Public: read published only
CREATE POLICY "public read published articles"
  ON editorial_articles FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "public read published guides"
  ON guides FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "public read sections of published guides"
  ON guide_sections FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guides g
      WHERE g.id = guide_sections.guide_id
        AND g.status = 'published'
    )
  );

-- Service role bypasses RLS for all admin writes (no additional policy needed).
