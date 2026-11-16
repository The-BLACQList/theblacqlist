-- =============================================================================
-- Highlights and process steps: "Why Choose Us", "How It Works" (ticket 195,
-- 2026-11-15).
--
-- A business page shows three or four icon bullets (kind 'highlight') or
-- numbered steps (kind 'step'). Plan limits: Free 0, Starter 4, Growth and
-- Premium 6 (TIER_LIMITS.highlights). The limit is checked by the server
-- action when one is added; the page shows the first ones the plan allows,
-- in the owner's order, and nothing is deleted when a page moves down a plan
-- (ticket 105). The editor keeps one kind per page; the column is per row so
-- the section can render either.
--
-- `icon` is a name from the allow-list in
-- components/entity-page/highlightIcons.ts (HIGHLIGHT_ICONS). The server
-- action writes only allow-listed names; the CHECK here keeps the column to
-- a short kebab-case name, and an unknown name renders as a spark.
--
-- RLS: as listing_faqs. Anyone reads highlights on published, non-deleted
-- pages; the owner reads and writes their own.
--
-- Down:
--   DROP TABLE IF EXISTS public.listing_highlights;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.listing_highlights (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id  uuid        NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  kind        text        NOT NULL,
  icon        text        NULL,
  title       text        NOT NULL,
  text        text        NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_highlights_kind_check
    CHECK (kind IN ('highlight', 'step')),
  CONSTRAINT listing_highlights_icon_check
    CHECK (icon IS NULL OR icon ~ '^[a-z][a-z-]{0,39}$'),
  CONSTRAINT listing_highlights_title_check
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 60),
  CONSTRAINT listing_highlights_text_check
    CHECK (text IS NULL OR char_length(btrim(text)) BETWEEN 1 AND 160)
);

-- The page read and the owner's list, in the owner's order.
CREATE INDEX IF NOT EXISTS listing_highlights_listing_idx
  ON public.listing_highlights (listing_id, sort_order);

DROP TRIGGER IF EXISTS set_updated_at ON public.listing_highlights;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.listing_highlights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.listing_highlights ENABLE ROW LEVEL SECURITY;

-- Anon: read highlights on published, non-deleted pages.
DROP POLICY IF EXISTS "listing_highlights: anon read" ON public.listing_highlights;
CREATE POLICY "listing_highlights: anon read"
  ON public.listing_highlights FOR SELECT TO anon
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

-- Authenticated: read highlights on published pages, and every item on pages they own.
DROP POLICY IF EXISTS "listing_highlights: authenticated read" ON public.listing_highlights;
CREATE POLICY "listing_highlights: authenticated read"
  ON public.listing_highlights FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE (status = 'published' AND deleted_at IS NULL)
         OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

-- Owner: insert / update / delete highlights on pages they own.
DROP POLICY IF EXISTS "listing_highlights: owner insert" ON public.listing_highlights;
CREATE POLICY "listing_highlights: owner insert"
  ON public.listing_highlights FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_highlights: owner update" ON public.listing_highlights;
CREATE POLICY "listing_highlights: owner update"
  ON public.listing_highlights FOR UPDATE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_highlights: owner delete" ON public.listing_highlights;
CREATE POLICY "listing_highlights: owner delete"
  ON public.listing_highlights FOR DELETE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );
