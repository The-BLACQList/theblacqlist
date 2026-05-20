-- ─── Certified badge auto-grant ───────────────────────────────────────────────
-- Creates auto_grant_certified() Postgres function.
-- Called by pg_cron (see 20260518000001_certified_badge_cron.sql) and by the
-- auto-grant-certified Edge Function for manual invocation.
--
-- Note: listings.certification_auto_granted_at already exists from the initial
-- schema migration. No column addition needed.

-- ─── auto_grant_certified() ───────────────────────────────────────────────────
-- Upgrades listings from trust_tier='verified' to 'certified' when all criteria
-- are met. Returns a JSON object with the count of newly certified listings.
--
-- Criteria:
--   1. trust_tier = 'verified' (never downgrades already-certified listings)
--   2. status = 'published' and not soft-deleted
--   3. review_count >= 10
--   4. created_at <= now() - interval '6 months'
--   5. Business details complete: description, contact (phone or email),
--      presence (website_url or address_line_1), city_text, state

CREATE OR REPLACE FUNCTION auto_grant_certified()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH eligible AS (
    SELECT l.id
    FROM listings l
    JOIN listing_details_business d ON d.listing_id = l.id
    WHERE l.trust_tier    = 'verified'
      AND l.status        = 'published'
      AND l.deleted_at    IS NULL
      AND l.review_count  >= 10
      AND l.created_at    <= now() - interval '6 months'
      AND d.description   IS NOT NULL
      AND d.description   <> ''
      AND (d.phone IS NOT NULL OR d.email IS NOT NULL)
      AND (d.website_url IS NOT NULL OR d.address_line_1 IS NOT NULL)
      AND d.city_text     IS NOT NULL
      AND d.state         IS NOT NULL
  )
  UPDATE listings
  SET trust_tier                    = 'certified',
      certification_auto_granted_at = now()
  WHERE id IN (SELECT id FROM eligible)
    AND trust_tier = 'verified';  -- second guard: never downgrade

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN jsonb_build_object('certified', updated_count);
END;
$$;
