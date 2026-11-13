-- =============================================================================
-- Happening now posts (owner-experience round 2, part F, 2026-11-13).
--
-- A short, dated post an owner puts at the top of their page: a headline, an
-- optional line of text, an optional image and an optional button. It also
-- shows in the "Happening now" strip on city and category pages.
--
-- Shown when status = 'active' and now() is inside [starts_at, ends_at).
-- Nothing expires a post: visibility is decided when it is read, so no cron.
-- 'ended' is an owner ending a post early; a post past ends_at is ended
-- whatever its status says.
--
-- Plan limits (TIER_LIMITS.activePosts in lib/stripe/features.ts): Free 0,
-- Starter 1, Growth 3, Premium 5, counting active posts that have not
-- ended (live or scheduled). Checked by the server action when a post goes
-- active. The public read shows only the first ones the page's current plan
-- allows, by creation order (lib/listings/happeningNow.ts). Nothing is deleted
-- when a page moves down a plan.
--
-- image_path: a file the owner uploaded through POST /api/upload with
-- media_role=post, stored under listings/{listing_id}/post/. No media row, so
-- it never counts toward the plan's photos.
--
-- RLS: like listing_buttons, plus the date window. Anyone can read live posts
-- on published pages; the owner reads and writes all of their own.
--
-- Down:
--   DROP TABLE IF EXISTS public.listing_posts;
--   (then remove the files under listings/*/post/ in the listing-media bucket)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.listing_posts (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id   uuid        NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  headline     text        NOT NULL,
  body         text        NULL,
  image_path   text        NULL,
  button_label text        NULL,
  button_url   text        NULL,
  starts_at    timestamptz NOT NULL DEFAULT now(),
  ends_at      timestamptz NOT NULL,
  status       text        NOT NULL DEFAULT 'draft',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_posts_status_check
    CHECK (status IN ('draft', 'active', 'ended')),
  CONSTRAINT listing_posts_headline_check
    CHECK (char_length(btrim(headline)) BETWEEN 1 AND 80),
  CONSTRAINT listing_posts_body_check
    CHECK (body IS NULL OR char_length(body) BETWEEN 1 AND 200),
  CONSTRAINT listing_posts_window_check
    CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '30 days'),
  CONSTRAINT listing_posts_button_check
    CHECK (
      (button_url IS NULL AND button_label IS NULL)
      OR (
        button_url IS NOT NULL
        AND button_url ~* '^https://'
        AND char_length(button_url) <= 2048
        AND (button_label IS NULL OR char_length(button_label) BETWEEN 1 AND 30)
      )
    ),
  CONSTRAINT listing_posts_image_check
    CHECK (image_path IS NULL OR image_path LIKE 'listings/' || listing_id::text || '/post/%')
);

-- The page read and the owner's list.
CREATE INDEX IF NOT EXISTS listing_posts_listing_idx
  ON public.listing_posts (listing_id, ends_at);

-- The city and category strip: live posts, soonest ending first.
CREATE INDEX IF NOT EXISTS listing_posts_live_idx
  ON public.listing_posts (ends_at)
  WHERE status = 'active';

ALTER TABLE public.listing_posts ENABLE ROW LEVEL SECURITY;

-- Anon: read live posts on published, non-deleted pages.
DROP POLICY IF EXISTS "listing_posts: anon read live" ON public.listing_posts;
CREATE POLICY "listing_posts: anon read live"
  ON public.listing_posts FOR SELECT TO anon
  USING (
    status = 'active'
    AND starts_at <= now()
    AND ends_at > now()
    AND listing_id IN (
      SELECT id FROM public.listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

-- Authenticated: read live posts on published pages, and every post on pages they own.
DROP POLICY IF EXISTS "listing_posts: authenticated read" ON public.listing_posts;
CREATE POLICY "listing_posts: authenticated read"
  ON public.listing_posts FOR SELECT TO authenticated
  USING (
    (
      status = 'active'
      AND starts_at <= now()
      AND ends_at > now()
      AND listing_id IN (
        SELECT id FROM public.listings
        WHERE status = 'published' AND deleted_at IS NULL
      )
    )
    OR listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- Owner: insert / update / delete posts on pages they own.
DROP POLICY IF EXISTS "listing_posts: owner insert" ON public.listing_posts;
CREATE POLICY "listing_posts: owner insert"
  ON public.listing_posts FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_posts: owner update" ON public.listing_posts;
CREATE POLICY "listing_posts: owner update"
  ON public.listing_posts FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "listing_posts: owner delete" ON public.listing_posts;
CREATE POLICY "listing_posts: owner delete"
  ON public.listing_posts FOR DELETE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );
