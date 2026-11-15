-- =============================================================================
-- Team members (ticket 107, 2026-11-15).
--
-- The people behind a page: a name, an optional role ("Head Barista"), a short
-- optional bio and an optional photo, in the order the owner sets. One member
-- may be marked the founder or owner; the page shows that card first and
-- larger (ticket 184's founder spotlight).
--
-- Plan limits (TIER_LIMITS.teamMembers in lib/stripe/features.ts): Free and
-- Starter 0, Growth 5, Premium unlimited. Checked by the server action when a
-- member is added. The public read shows only the first ones the page's
-- current plan allows, by sort_order. Nothing is deleted when a page moves
-- down a plan, the same rule as photos and posts (ticket 105).
--
-- photo_path: a file the owner uploaded through POST /api/upload with
-- media_role=team, stored under listings/{listing_id}/team/. No media row, so
-- it never counts toward the plan's photos (the ticket's "storage, not
-- photoLimit" rule).
--
-- Deleting a member deletes the row (and the app removes its photo), the same
-- as listing_posts and listing_buttons. The ticket's draft listed deleted_at;
-- no other owner-edited child table soft-deletes, and a removed person should
-- not linger in the database.
--
-- RLS: like listing_posts without the date window. Anyone can read members on
-- published, non-deleted pages; the owner reads and writes their own.
--
-- Down:
--   DROP TABLE IF EXISTS public.listing_team_members;
--   (then remove the files under listings/*/team/ in the listing-media bucket)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.listing_team_members (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id  uuid        NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  role        text        NULL,
  bio         text        NULL,
  photo_path  text        NULL,
  is_founder  boolean     NOT NULL DEFAULT false,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_team_members_name_check
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT listing_team_members_role_check
    CHECK (role IS NULL OR char_length(btrim(role)) BETWEEN 1 AND 60),
  CONSTRAINT listing_team_members_bio_check
    CHECK (bio IS NULL OR char_length(btrim(bio)) BETWEEN 1 AND 400),
  CONSTRAINT listing_team_members_photo_check
    CHECK (photo_path IS NULL OR photo_path LIKE 'listings/' || listing_id::text || '/team/%')
);

-- The page read and the owner's list, in the owner's order.
CREATE INDEX IF NOT EXISTS listing_team_members_listing_idx
  ON public.listing_team_members (listing_id, sort_order);

-- At most one founder card a page.
CREATE UNIQUE INDEX IF NOT EXISTS listing_team_members_one_founder_idx
  ON public.listing_team_members (listing_id)
  WHERE is_founder;

ALTER TABLE public.listing_team_members ENABLE ROW LEVEL SECURITY;

-- Anon: read members on published, non-deleted pages.
DROP POLICY IF EXISTS "listing_team_members: anon read" ON public.listing_team_members;
CREATE POLICY "listing_team_members: anon read"
  ON public.listing_team_members FOR SELECT TO anon
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

-- Authenticated: read members on published pages, and every member on pages they own.
DROP POLICY IF EXISTS "listing_team_members: authenticated read" ON public.listing_team_members;
CREATE POLICY "listing_team_members: authenticated read"
  ON public.listing_team_members FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
    OR listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- Owner: insert / update / delete members on pages they own.
DROP POLICY IF EXISTS "listing_team_members: owner insert" ON public.listing_team_members;
CREATE POLICY "listing_team_members: owner insert"
  ON public.listing_team_members FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_team_members: owner update" ON public.listing_team_members;
CREATE POLICY "listing_team_members: owner update"
  ON public.listing_team_members FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "listing_team_members: owner delete" ON public.listing_team_members;
CREATE POLICY "listing_team_members: owner delete"
  ON public.listing_team_members FOR DELETE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );
