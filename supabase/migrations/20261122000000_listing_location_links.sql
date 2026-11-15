-- =============================================================================
-- Multi-location accounts (ticket 110, 2026-11-15).
--
-- One Premium plan covers up to 3 of an owner's business pages: the page the
-- subscription is on (the "primary") and up to 2 linked locations. A linked
-- location takes the primary's tier while the primary is on a plan with
-- multi_location (Premium); below that it goes back to Free. Still one Stripe
-- subscription and one price: this is an entitlement change, not a billing
-- one, and no Stripe product changes.
--
-- One row a linked location. The primary has no row of its own; it is the
-- page the subscription's metadata names.
--
-- Who writes what:
--   * Linking and unlinking go through server actions that check ownership,
--     the plan and the limit, then write with the service client, because
--     they also set the linked page's tier, which the entitlement guard
--     (20260926000000) stops an owner's client from changing. So there is no
--     INSERT, UPDATE or DELETE policy.
--   * The Stripe webhook keeps linked tiers in step with the primary
--     (lib/services/billing/locationTiers.ts).
--   * A drop below Premium never deletes a link or a page: the linked pages
--     go to Free (content over Free's limits is hidden, not deleted, as for any
--     downgrade) and come back when the plan does.
--
-- No chains: a primary can't be a linked location, and a linked location
-- can't be anyone's primary. The trigger below enforces it; the actions check
-- it first so the owner gets a sentence instead of an error code.
--
-- Down:
--   DROP TABLE IF EXISTS public.listing_location_links;
--   DROP FUNCTION IF EXISTS public.listing_location_links_no_chain();
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.listing_location_links (
  location_listing_id uuid        NOT NULL PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  primary_listing_id  uuid        NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  owner_user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_location_links_not_self
    CHECK (location_listing_id <> primary_listing_id)
);

CREATE INDEX IF NOT EXISTS listing_location_links_primary_idx
  ON public.listing_location_links (primary_listing_id, created_at);

CREATE OR REPLACE FUNCTION public.listing_location_links_no_chain()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.listing_location_links
    WHERE location_listing_id = NEW.primary_listing_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'A linked location can''t be another page''s primary.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.listing_location_links
    WHERE primary_listing_id = NEW.location_listing_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'A page with linked locations can''t be linked to another page.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_location_links_no_chain ON public.listing_location_links;
CREATE TRIGGER listing_location_links_no_chain
  BEFORE INSERT OR UPDATE ON public.listing_location_links
  FOR EACH ROW EXECUTE FUNCTION public.listing_location_links_no_chain();

ALTER TABLE public.listing_location_links ENABLE ROW LEVEL SECURITY;

-- The public page's "Also At" list: links whose primary is published.
DROP POLICY IF EXISTS "listing_location_links: public read" ON public.listing_location_links;
CREATE POLICY "listing_location_links: public read"
  ON public.listing_location_links FOR SELECT TO anon, authenticated
  USING (
    primary_listing_id IN (
      SELECT id FROM public.listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

-- The owner sees their own links, published or not.
DROP POLICY IF EXISTS "listing_location_links: owner read" ON public.listing_location_links;
CREATE POLICY "listing_location_links: owner read"
  ON public.listing_location_links FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

-- No INSERT, UPDATE or DELETE policy: the server writes with the service client.
REVOKE INSERT, UPDATE, DELETE ON public.listing_location_links FROM anon, authenticated;
