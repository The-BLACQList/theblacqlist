-- =============================================================================
-- Credentials, awards and press (ticket 192, 2026-11-15).
--
-- The trust a business brings with it: a licence or certification for a
-- professional, an award for a cafe, a press mention for a studio. Each item
-- has a kind, a title, an optional issuer ("Texas Board of Barbering", "Houston
-- Chronicle"), an optional year and an optional https link, in the order the
-- owner sets. The page groups them by kind.
--
-- Plan: Starter and up (FEATURE_MIN_TIER.credentials). Adding is checked by the
-- server action; the page loader reads the table only for a page whose plan
-- shows the section. Nothing is deleted when a page moves down a plan, the
-- same rule as photos and posts (ticket 105): an upgrade shows them again.
--
-- No publication logos (licensing): press items are text links.
--
-- A year in the future is refused by the app (a CHECK can't read the clock
-- immutably); the table only bounds it.
--
-- RLS: as listing_faqs. Anyone reads items on published, non-deleted pages;
-- the owner reads and writes their own.
--
-- Down:
--   DROP TABLE IF EXISTS public.listing_credentials;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.listing_credentials (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id  uuid        NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  kind        text        NOT NULL,
  title       text        NOT NULL,
  issuer      text        NULL,
  year        integer     NULL,
  url         text        NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_credentials_kind_check
    CHECK (kind IN ('license', 'certification', 'award', 'press')),
  CONSTRAINT listing_credentials_title_check
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  CONSTRAINT listing_credentials_issuer_check
    CHECK (issuer IS NULL OR char_length(btrim(issuer)) BETWEEN 1 AND 80),
  CONSTRAINT listing_credentials_year_check
    CHECK (year IS NULL OR year BETWEEN 1900 AND 2100),
  CONSTRAINT listing_credentials_url_check
    CHECK (url IS NULL OR (url LIKE 'https://%' AND char_length(url) <= 500))
);

-- The page read and the owner's list, in the owner's order.
CREATE INDEX IF NOT EXISTS listing_credentials_listing_idx
  ON public.listing_credentials (listing_id, sort_order);

DROP TRIGGER IF EXISTS set_updated_at ON public.listing_credentials;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.listing_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.listing_credentials ENABLE ROW LEVEL SECURITY;

-- Anon: read items on published, non-deleted pages.
DROP POLICY IF EXISTS "listing_credentials: anon read" ON public.listing_credentials;
CREATE POLICY "listing_credentials: anon read"
  ON public.listing_credentials FOR SELECT TO anon
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

-- Authenticated: read items on published pages, and every item on pages they own.
DROP POLICY IF EXISTS "listing_credentials: authenticated read" ON public.listing_credentials;
CREATE POLICY "listing_credentials: authenticated read"
  ON public.listing_credentials FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE (status = 'published' AND deleted_at IS NULL)
         OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

-- Owner: insert / update / delete items on pages they own.
DROP POLICY IF EXISTS "listing_credentials: owner insert" ON public.listing_credentials;
CREATE POLICY "listing_credentials: owner insert"
  ON public.listing_credentials FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_credentials: owner update" ON public.listing_credentials;
CREATE POLICY "listing_credentials: owner update"
  ON public.listing_credentials FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "listing_credentials: owner delete" ON public.listing_credentials;
CREATE POLICY "listing_credentials: owner delete"
  ON public.listing_credentials FOR DELETE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );
