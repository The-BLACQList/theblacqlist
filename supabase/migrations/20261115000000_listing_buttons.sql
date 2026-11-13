-- =============================================================================
-- Extra buttons by plan (owner-experience round 2, part B, 2026-11-13).
--
-- A page keeps its one main button on listing_details_business.cta_type. Paid
-- plans add buttons beyond it: Starter 1, Growth 2, Premium 3 (TIER_LIMITS
-- .extraButtons in lib/stripe/features.ts). The limit is checked by the server
-- action on add; the public read shows only the first ones the current plan
-- allows, in position order (lib/listings/pageButtons.ts). Nothing is deleted
-- when a page moves down a plan.
--
-- type: every main-button type except 'message'. The inbox has its own
-- automatic Message button, so an extra one would only repeat it. Keep in step
-- with EXTRA_BUTTON_TYPES.
-- value: an https link, an email address for 'email', or NULL for 'call'
-- (which uses the page's phone number).
--
-- RLS: the same policies as listing_faqs / listing_links. Anyone can read
-- buttons on published pages; the owner reads and writes their own.
--
-- Down:
--   DROP TABLE IF EXISTS public.listing_buttons;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.listing_buttons (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id     uuid        NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  type           text        NOT NULL,
  value          text        NULL,
  label_override text        NULL,
  position       integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_buttons_type_check
    CHECK (type IN ('book','order','call','email','visit','get-quote','shop',
                    'subscribe','contact','commission','inquire','get-tickets','rsvp',
                    'register','learn-more','apply','buy-now')),
  CONSTRAINT listing_buttons_value_check
    CHECK (
      (type = 'call' AND value IS NULL)
      OR (type <> 'call' AND value IS NOT NULL AND char_length(value) BETWEEN 1 AND 2048)
    ),
  CONSTRAINT listing_buttons_label_check
    CHECK (label_override IS NULL OR char_length(label_override) BETWEEN 1 AND 50)
);

CREATE INDEX IF NOT EXISTS listing_buttons_listing_id_idx
  ON public.listing_buttons (listing_id, position);

ALTER TABLE public.listing_buttons ENABLE ROW LEVEL SECURITY;

-- Anon: read buttons on published, non-deleted pages.
DROP POLICY IF EXISTS "listing_buttons: anon read published" ON public.listing_buttons;
CREATE POLICY "listing_buttons: anon read published"
  ON public.listing_buttons FOR SELECT TO anon
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

-- Authenticated: read buttons on published pages or pages they own.
DROP POLICY IF EXISTS "listing_buttons: authenticated read" ON public.listing_buttons;
CREATE POLICY "listing_buttons: authenticated read"
  ON public.listing_buttons FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE (status = 'published' AND deleted_at IS NULL)
         OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

-- Owner: insert / update / delete buttons on pages they own.
DROP POLICY IF EXISTS "listing_buttons: owner insert" ON public.listing_buttons;
CREATE POLICY "listing_buttons: owner insert"
  ON public.listing_buttons FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_buttons: owner update" ON public.listing_buttons;
CREATE POLICY "listing_buttons: owner update"
  ON public.listing_buttons FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "listing_buttons: owner delete" ON public.listing_buttons;
CREATE POLICY "listing_buttons: owner delete"
  ON public.listing_buttons FOR DELETE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );
