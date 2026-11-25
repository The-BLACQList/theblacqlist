-- =============================================================================
-- Admin Unpublish for Pages, Put Back, and the do-not-re-add marks (ticket 284)
-- =============================================================================
-- Until now an admin could take down a job (ticket 235) and nothing else.
--
--   * admin_hide_page():      published → unpublished, with a reason. The status
--                             change, the audit row and the mark are one
--                             transaction: all of it happens or none of it.
--   * admin_page_hide():      the admin hide a Page is under right now, or no
--                             row. Reads the audit log, so an event the expiry
--                             sweep hid, or a job, never counts.
--   * admin_put_back_page():  undoes that hide, with its own reason. Keeps the
--                             first published_at and clears the mark.
--   * page_do_not_re_add:     Pages the seed scripts must not add again. No
--                             foreign key to listings, so a mark outlives a full
--                             delete. No owner name, email or phone.
--   * Once a marked Page is fully deleted, a published row with its slug can't
--     be inserted. This is the backstop for supabase/seeds/*.sql, which can't
--     check the marks: such a seed stops with an error instead of putting the
--     Page back. The app never inserts a published row, so adding a business is
--     unaffected.
--   * Reviews: the read rule now also asks whether the Page is public, so
--     reviews of a hidden Page aren't readable through the data API. Authors
--     still read their own, and owners the reviews of their own Pages. A closed
--     job's page is public (ticket 155), so its reviews stay readable. Review
--     photo rows and ratings follow: their rules read this one.
--   * review_author_names(): same Page check, so the short names of a hidden
--     Page's reviewers aren't readable either.
--
-- Reads and writes no listing when it is applied. Safe to run twice. Works with
-- the code before ticket 284, so it can be applied first.
--
-- Down:
--   DROP TRIGGER IF EXISTS listings_refuse_marked_insert ON public.listings;
--   DROP FUNCTION IF EXISTS public.listings_refuse_marked_insert();
--   DROP FUNCTION IF EXISTS public.admin_put_back_page(uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.admin_hide_page(uuid, uuid, text, text, boolean);
--   DROP FUNCTION IF EXISTS public.admin_page_hide(uuid);
--   DROP TABLE IF EXISTS public.page_do_not_re_add;  -- loses the marks
--   DROP POLICY IF EXISTS "reviews: anon read published" ON public.reviews;
--   CREATE POLICY "reviews: anon read published" ON public.reviews
--     FOR SELECT TO anon USING (status = 'published');
--   DROP POLICY IF EXISTS "reviews: authenticated read published or own" ON public.reviews;
--   CREATE POLICY "reviews: authenticated read published or own" ON public.reviews
--     FOR SELECT TO authenticated
--     USING (status = 'published' OR reviewer_user_id = auth.uid());
--   review_author_names: re-run its CREATE OR REPLACE from 20261129000000.
-- =============================================================================


-- ─── 1. The marks ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.page_do_not_re_add (
  page_id   uuid        NOT NULL PRIMARY KEY,  -- no foreign key, on purpose
  slug      text        NOT NULL,
  name      text        NOT NULL,
  city_slug text,
  city_name text,
  reason    text        NOT NULL
            CHECK (reason IN ('owner_asked', 'closed', 'not_eligible', 'duplicate', 'other')),
  marked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS page_do_not_re_add_slug_idx ON public.page_do_not_re_add (slug);

-- No policies: only the server (service_role) reads or writes it.
ALTER TABLE public.page_do_not_re_add ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.page_do_not_re_add FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_do_not_re_add TO service_role;


-- ─── 2. Which admin hide is a Page under now? ────────────────────────────────
-- The newest audit row that hid or put back the Page, if it is ours. If the
-- sweep or anything else hid it after us, there is no row.

CREATE OR REPLACE FUNCTION public.admin_page_hide(p_listing_id uuid)
RETURNS TABLE (hidden_at timestamptz, reason text, note text, marked boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT latest.created_at,
         latest.after_state ->> 'reason',
         latest.after_state ->> 'note',
         EXISTS (SELECT 1 FROM page_do_not_re_add m WHERE m.page_id = p_listing_id)
  FROM (
    SELECT a.action, a.created_at, a.after_state
    FROM admin_audit_log a
    WHERE a.target_table = 'listings'
      AND a.target_id = p_listing_id
      AND (
        a.action IN ('unpublish_page', 'put_back_page')
        OR a.after_state ->> 'status' IN ('unpublished', 'published')
      )
    ORDER BY a.created_at DESC
    LIMIT 1
  ) latest
  JOIN listings l ON l.id = p_listing_id
  WHERE latest.action = 'unpublish_page'
    AND l.status = 'unpublished'
    AND l.deleted_at IS NULL
    AND l.entity_type <> 'job';
$$;


-- ─── 3. Hide ─────────────────────────────────────────────────────────────────
-- Returns 'ok', 'not_found', 'is_job' or 'not_published'. Anything else raises
-- and nothing is written.

CREATE OR REPLACE FUNCTION public.admin_hide_page(
  p_listing_id uuid,
  p_admin_id   uuid,
  p_reason     text,
  p_note       text,
  p_mark       boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing listings%ROWTYPE;
  v_note    text := nullif(btrim(coalesce(p_note, '')), '');
  v_mark    boolean := coalesce(p_mark, false);
  v_city_slug text;
  v_city_name text;
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'An admin is required.';
  END IF;
  IF p_reason IS NULL
     OR p_reason NOT IN ('owner_asked', 'closed', 'not_eligible', 'duplicate', 'other') THEN
    RAISE EXCEPTION 'Unknown reason.';
  END IF;
  IF p_reason = 'other' AND v_note IS NULL THEN
    RAISE EXCEPTION 'A note is required for this reason.';
  END IF;

  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND OR v_listing.deleted_at IS NOT NULL THEN RETURN 'not_found'; END IF;
  IF v_listing.entity_type = 'job' THEN RETURN 'is_job'; END IF;
  IF v_listing.status <> 'published' THEN RETURN 'not_published'; END IF;

  UPDATE listings
  SET status = 'unpublished', last_admin_updated_at = now()
  WHERE id = p_listing_id;

  IF v_mark THEN
    SELECT c.slug, c.name INTO v_city_slug, v_city_name
    FROM cities c WHERE c.id = v_listing.city_id;

    INSERT INTO page_do_not_re_add (page_id, slug, name, city_slug, city_name, reason)
    VALUES (p_listing_id, v_listing.slug, v_listing.name, v_city_slug, v_city_name, p_reason)
    ON CONFLICT (page_id) DO UPDATE
      SET slug = EXCLUDED.slug, name = EXCLUDED.name,
          city_slug = EXCLUDED.city_slug, city_name = EXCLUDED.city_name,
          reason = EXCLUDED.reason, marked_at = now();
  END IF;

  -- clock_timestamp: two actions in one transaction must still sort.
  INSERT INTO admin_audit_log
    (admin_user_id, action, target_table, target_id, before_state, after_state, created_at)
  VALUES
    (p_admin_id, 'unpublish_page', 'listings', p_listing_id,
     jsonb_build_object('status', 'published'),
     jsonb_strip_nulls(jsonb_build_object(
       'status', 'unpublished', 'reason', p_reason, 'note', v_note,
       'do_not_re_add', v_mark, 'name', v_listing.name, 'slug', v_listing.slug)),
     clock_timestamp());

  RETURN 'ok';
END;
$$;


-- ─── 4. Put Back ─────────────────────────────────────────────────────────────
-- Returns 'ok', 'not_found', 'is_job', 'not_hidden' (status isn't unpublished)
-- or 'not_ours' (something other than admin_hide_page hid it).

CREATE OR REPLACE FUNCTION public.admin_put_back_page(
  p_listing_id uuid,
  p_admin_id   uuid,
  p_reason     text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing listings%ROWTYPE;
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
  v_cleared integer;
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'An admin is required.';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required.';
  END IF;

  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND OR v_listing.deleted_at IS NOT NULL THEN RETURN 'not_found'; END IF;
  IF v_listing.entity_type = 'job' THEN RETURN 'is_job'; END IF;
  IF v_listing.status <> 'unpublished' THEN RETURN 'not_hidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM admin_page_hide(p_listing_id)) THEN RETURN 'not_ours'; END IF;

  -- published_at is left alone, so the Page doesn't come back as new.
  UPDATE listings
  SET status = 'published', last_admin_updated_at = now()
  WHERE id = p_listing_id;

  DELETE FROM page_do_not_re_add WHERE page_id = p_listing_id;
  GET DIAGNOSTICS v_cleared = ROW_COUNT;

  INSERT INTO admin_audit_log
    (admin_user_id, action, target_table, target_id, before_state, after_state, created_at)
  VALUES
    (p_admin_id, 'put_back_page', 'listings', p_listing_id,
     jsonb_build_object('status', 'unpublished'),
     jsonb_build_object('status', 'published', 'reason', v_reason, 'mark_cleared', v_cleared > 0),
     clock_timestamp());

  RETURN 'ok';
END;
$$;


-- ─── 5. Never insert a published row with a marked slug ──────────────────────

CREATE OR REPLACE FUNCTION public.listings_refuse_marked_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- A BEFORE trigger runs ahead of ON CONFLICT (slug) DO NOTHING. While the
  -- hidden Page still exists, let that skip the row as it always has.
  IF EXISTS (SELECT 1 FROM page_do_not_re_add m WHERE m.slug = NEW.slug)
     AND NOT EXISTS (SELECT 1 FROM listings l WHERE l.slug = NEW.slug) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = format('The page "%s" is marked do-not-re-add.', NEW.slug);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_refuse_marked_insert ON public.listings;
CREATE TRIGGER listings_refuse_marked_insert
  BEFORE INSERT ON public.listings
  FOR EACH ROW WHEN (NEW.status = 'published')
  EXECUTE FUNCTION public.listings_refuse_marked_insert();


-- ─── 6. Reviews of a hidden Page aren't public ───────────────────────────────

DROP POLICY IF EXISTS "reviews: anon read published" ON public.reviews;
CREATE POLICY "reviews: anon read published"
  ON public.reviews FOR SELECT TO anon
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = reviews.listing_id
        AND l.deleted_at IS NULL
        AND (l.status = 'published' OR (l.status = 'closed' AND l.entity_type = 'job'))
    )
  );

DROP POLICY IF EXISTS "reviews: authenticated read published or own" ON public.reviews;
CREATE POLICY "reviews: authenticated read published or own"
  ON public.reviews FOR SELECT TO authenticated
  USING (
    reviewer_user_id = auth.uid()
    OR (
      status = 'published'
      AND EXISTS (
        SELECT 1 FROM public.listings l
        WHERE l.id = reviews.listing_id
          AND (
            l.owner_user_id = auth.uid()
            OR (
              l.deleted_at IS NULL
              AND (l.status = 'published' OR (l.status = 'closed' AND l.entity_type = 'job'))
            )
          )
      )
    )
  );


-- The short reviewer names (20261129000000) follow the same rule: no names from
-- a Page the caller can't see. Same body as before, plus the Page check.
CREATE OR REPLACE FUNCTION public.review_author_names(p_listing_id uuid)
RETURNS TABLE (reviewer_user_id uuid, short_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT r.reviewer_user_id, short_display_name(p.display_name)
  FROM reviews r
  JOIN profiles p ON p.id = r.reviewer_user_id
  JOIN listings l ON l.id = r.listing_id
  WHERE r.listing_id = p_listing_id
    AND r.status = 'published'
    AND (
      l.owner_user_id = auth.uid()
      OR (
        l.deleted_at IS NULL
        AND (l.status = 'published' OR (l.status = 'closed' AND l.entity_type = 'job'))
      )
    )
    AND short_display_name(p.display_name) IS NOT NULL
$$;


-- ─── 7. Who may call what ────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.admin_page_hide(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_hide_page(uuid, uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_put_back_page(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.listings_refuse_marked_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_page_hide(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_hide_page(uuid, uuid, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_put_back_page(uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
