-- =============================================================================
-- Review author names on public listing pages
--
-- [Decision — founder, 2026-11-19] A review shows its author as first name plus
-- last initial ("Jasmine R."), built from profiles.display_name. A person with
-- no display name still shows as "A Customer".
--
-- Why: profiles RLS is "authenticated read own" (20260510000001), so the
-- listing page, which reads as the visitor, could never see a reviewer's
-- display_name. Every review on every live listing showed "A Customer".
-- Opening profiles to public read would expose full names (many people type
-- their full name into Display Name), so instead:
--
--   1. short_display_name(text): "Jasmine Renee Roberts" -> "Jasmine R.".
--      One word stays as it is. Anything with an @ returns NULL, so a display
--      name typed as an email address is never shown.
--   2. review_author_names(listing): for one listing, the short name of each
--      author of a PUBLISHED review. The full display_name never leaves the
--      database. SECURITY DEFINER because the caller cannot read profiles.
--
-- The privacy policy says so (app/(public)/privacy/PrivacyPolicy.tsx), and the
-- Display Name field in account settings carries a hint.
--
-- GATE-DATA: staging first, after the founder's OK; production with the merge.
-- If the code ships first, the RPC errors, the page logs nothing user-facing
-- and every review keeps showing "A Customer", as before.
--
-- Down (one transaction):
--   DROP FUNCTION IF EXISTS review_author_names(uuid);
--   DROP FUNCTION IF EXISTS short_display_name(text);
--   NOTIFY pgrst, 'reload schema';
-- =============================================================================

CREATE OR REPLACE FUNCTION short_display_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN w IS NULL OR cardinality(w) = 0 THEN NULL
    WHEN position('@' IN p_name) > 0 THEN NULL
    WHEN cardinality(w) = 1 THEN w[1]
    ELSE w[1] || ' ' || upper(left(w[cardinality(w)], 1)) || '.'
  END
  FROM (
    SELECT CASE
      WHEN btrim(coalesce(p_name, '')) = '' THEN NULL
      ELSE regexp_split_to_array(btrim(p_name), '\s+')
    END AS w
  ) AS parts
$$;

CREATE OR REPLACE FUNCTION review_author_names(p_listing_id uuid)
RETURNS TABLE (reviewer_user_id uuid, short_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT r.reviewer_user_id, short_display_name(p.display_name)
  FROM reviews r
  JOIN profiles p ON p.id = r.reviewer_user_id
  WHERE r.listing_id = p_listing_id
    AND r.status = 'published'
    AND short_display_name(p.display_name) IS NOT NULL
$$;

REVOKE ALL ON FUNCTION review_author_names(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION review_author_names(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
