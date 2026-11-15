-- =============================================================================
-- Holiday and special hours (ticket 196, 2026-11-15).
--
-- One row per listing per date that differs from the weekly hours: closed all
-- day ("Thanksgiving"), or open with its own times ("Open late for the
-- market"). All plans: hours are basic. Business pages only; the server action
-- refuses jobs and events, which have no weekly hours.
--
-- `date` is the listing's local calendar date. `open` and `close` are "HH:MM"
-- like the weekly hours in listing_details_business.hours, and an open day
-- needs both, closing after opening (the open/closed status has no overnight
-- rule). A closed day keeps no times.
--
-- The page reads the next 30 days (with a day's slack either side for time
-- zones). Past rows are purged by the daily expiry cron
-- (purgePastHoursOverrides in lib/services/expiry/sweeps.ts).
--
-- RLS: as listing_faqs. Anyone reads rows on published, non-deleted pages;
-- the owner reads and writes their own.
--
-- Down:
--   DROP TABLE IF EXISTS public.listing_hours_overrides;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.listing_hours_overrides (
  listing_id  uuid        NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  date        date        NOT NULL,
  closed      boolean     NOT NULL DEFAULT false,
  open        text        NULL,
  close       text        NULL,
  label       text        NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, date),
  CONSTRAINT listing_hours_overrides_open_check
    CHECK (open IS NULL OR open ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT listing_hours_overrides_close_check
    CHECK (close IS NULL OR close ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT listing_hours_overrides_times_check
    CHECK (
      (closed AND open IS NULL AND close IS NULL)
      OR (NOT closed AND open IS NOT NULL AND close IS NOT NULL AND close > open)
    ),
  CONSTRAINT listing_hours_overrides_label_check
    CHECK (label IS NULL OR char_length(btrim(label)) BETWEEN 1 AND 60)
);

-- The purge sweeps by date across every listing; the page read uses the
-- primary key (listing_id, date).
CREATE INDEX IF NOT EXISTS listing_hours_overrides_date_idx
  ON public.listing_hours_overrides (date);

DROP TRIGGER IF EXISTS set_updated_at ON public.listing_hours_overrides;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.listing_hours_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.listing_hours_overrides ENABLE ROW LEVEL SECURITY;

-- Anon: read rows on published, non-deleted pages.
DROP POLICY IF EXISTS "listing_hours_overrides: anon read" ON public.listing_hours_overrides;
CREATE POLICY "listing_hours_overrides: anon read"
  ON public.listing_hours_overrides FOR SELECT TO anon
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

-- Authenticated: read rows on published pages, and every row on pages they own.
DROP POLICY IF EXISTS "listing_hours_overrides: authenticated read" ON public.listing_hours_overrides;
CREATE POLICY "listing_hours_overrides: authenticated read"
  ON public.listing_hours_overrides FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE (status = 'published' AND deleted_at IS NULL)
         OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

-- Owner: insert / update / delete rows on pages they own.
DROP POLICY IF EXISTS "listing_hours_overrides: owner insert" ON public.listing_hours_overrides;
CREATE POLICY "listing_hours_overrides: owner insert"
  ON public.listing_hours_overrides FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_hours_overrides: owner update" ON public.listing_hours_overrides;
CREATE POLICY "listing_hours_overrides: owner update"
  ON public.listing_hours_overrides FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "listing_hours_overrides: owner delete" ON public.listing_hours_overrides;
CREATE POLICY "listing_hours_overrides: owner delete"
  ON public.listing_hours_overrides FOR DELETE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );
