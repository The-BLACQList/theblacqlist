-- ─── Certification rule alignment ────────────────────────────────────────────
--
-- WHY THIS EXISTS
-- `auto_grant_certified()` (20260518000000_certified_badge.sql) implements the
-- V1 design criteria. Those were superseded by founder decision 009 on
-- 2026-08-06, which `lib/services/trust/certification.ts` implements. The two
-- have disagreed ever since — the SQL nightly sweep and the TypeScript
-- post-review path could reach opposite verdicts on the same listing.
--
-- Four rules existed across the repo before this migration:
--
--   source                              reviews  rating  clock   anchor
--   data-model.md / entity-content-model  >= 6    >= 4.0   90 d   published_at
--   20260518000000_certified_badge.sql    >= 10     —      6 mo   created_at
--   lib/stripe/features.ts (comment)         6    >= 4.0   90 d   "active"
--   decision 009 / certification.ts          5      —      90 d   claim approval
--
-- THE ALIGNED RULE (decisions 031 + 032, 2026-08-22) — six criteria, one rule,
-- two callers. This function is the nightly safety net; `certification.ts` is
-- the fast path invoked when an admin publishes a review. Both must agree.
--
--   1. trust_tier = 'verified'                (never skips claimed -> certified)
--   2. status = 'published' AND deleted_at IS NULL
--   3. >= 5 published reviews                 (decision 009)
--   4. average published rating >= 3.5        (amends 009; see below)
--   5. >= 90 days since the earliest approved claim   (decision 009's anchor)
--   6. business details complete              (preserved from the V1 SQL)
--
-- Two criteria that decision 009 did not carry are deliberately restored here
-- and added to the TypeScript twin in the same PR:
--
--   * The rating floor. 009 recorded no floor, so five one-star reviews plus
--     90 days would have earned the top trust badge — and there is no
--     automated revocation path (data-model.md: "certification is an
--     achievement, not a continuously recalculated score"). The floor is 3.5,
--     not the V1 4.0, so one bad review out of five does not disqualify an
--     otherwise good listing.  [Decision — founder, 2026-08-22] (031)
--
--   * Business-details completeness. Present in the V1 SQL, absent from 009.
--     A trust badge must not point at a page with no description or no way to
--     contact the business.  [Decision — founder, 2026-08-22] (032)
--
-- TWO PROPERTIES INHERITED FROM THE V1 SQL, KEPT INTENTIONALLY
--
--   * The join to `listing_details_business` is also a listing-type filter.
--     Events and jobs write to their own details tables, so they can never be
--     auto-certified here. That is correct — a 30-day job posting cannot
--     accumulate 90 days of tenure — but it fell out of a join rather than a
--     decision, so it is stated explicitly now.
--
--   * `listings.review_count` and `listings.avg_rating` are denormalized and
--     trigger-maintained over published reviews only
--     (20260630000000_fix_count_triggers_security_definer.sql). Reading them
--     is what lets both callers agree without duplicating an aggregate.
--
-- ONE DELIBERATE TIGHTENING vs. the V1 SQL: the completeness checks use
-- `nullif(btrim(x), '')` throughout. The V1 version only rejected an empty
-- string on `description` and accepted whitespace elsewhere; the TypeScript
-- twin trims every field, so the SQL is brought up to match rather than the
-- other way round.
--
-- KNOWN TRADEOFF: decision 009's recorded condition was that thresholds live
-- as named constants in `certification.ts` "so future tuning is a one-line
-- change + PR." Duplicating them as SQL literals breaks that property.
-- Mitigation is this cross-reference and its twin in the TypeScript file.
-- Accepted deliberately — the alternative is either deleting this path (which
-- reopens the day-90 coverage gap for a listing that stops receiving reviews)
-- or reading constants from the database in TypeScript, which is more
-- machinery than a three-number rule warrants.
--
-- ROLLBACK: re-apply 20260518000000_certified_badge.sql to restore the prior
-- function body, and `SELECT cron.unschedule('auto-grant-certified')` to stop
-- the sweep. No data is migrated by this file, so there is nothing to undo
-- beyond the function definition and the schedule.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auto_grant_certified()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH eligible AS (
    SELECT l.id
    FROM listings l
    JOIN listing_details_business d ON d.listing_id = l.id
    JOIN LATERAL (
      -- Earliest approved claim, mirroring the TypeScript query exactly:
      -- claims where status = 'approved', ordered by reviewed_at, limit 1.
      SELECT c.reviewed_at
      FROM claims c
      WHERE c.listing_id  = l.id
        AND c.status      = 'approved'
        AND c.reviewed_at IS NOT NULL
      ORDER BY c.reviewed_at
      LIMIT 1
    ) claim ON true
    WHERE l.trust_tier   = 'verified'
      AND l.status       = 'published'
      AND l.deleted_at   IS NULL
      AND l.review_count >= 5
      AND l.avg_rating   >= 3.5
      AND claim.reviewed_at <= now() - interval '90 days'
      -- Business details complete
      AND nullif(btrim(d.description), '') IS NOT NULL
      AND (
        nullif(btrim(d.phone), '') IS NOT NULL
        OR nullif(btrim(d.email), '') IS NOT NULL
      )
      AND (
        nullif(btrim(d.website_url), '') IS NOT NULL
        OR nullif(btrim(d.address_line_1), '') IS NOT NULL
      )
      AND nullif(btrim(d.city_text), '') IS NOT NULL
      AND nullif(btrim(d.state), '') IS NOT NULL
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

COMMENT ON FUNCTION auto_grant_certified() IS
  'Nightly safety net for BLACQList Certified. Implements decisions 031+032 '
  '(2026-08-22): verified + published + >=5 published reviews + avg rating '
  '>=3.5 + >=90 days since earliest approved claim + complete business '
  'details. Twin of evaluateCertification() in '
  'lib/services/trust/certification.ts — change both together.';

-- ─── Execution privileges ────────────────────────────────────────────────────
-- Without these, any anonymous client could invoke the promotion sweep
-- directly. Matches the pattern established by
-- 20260816000000_rate_limit_counters.sql. This function was previously the
-- only SECURITY DEFINER function in `public` missing both `SET search_path`
-- and a REVOKE block.
REVOKE ALL ON FUNCTION auto_grant_certified() FROM PUBLIC;
REVOKE ALL ON FUNCTION auto_grant_certified() FROM anon;
REVOKE ALL ON FUNCTION auto_grant_certified() FROM authenticated;
GRANT EXECUTE ON FUNCTION auto_grant_certified() TO service_role;

-- ─── Nightly schedule ────────────────────────────────────────────────────────
-- 20260518000001_certified_badge_cron.sql was deliberately NOT re-run during
-- §2B7 Part 1 (2026-08-20): pg_cron had never been enabled, so all four
-- schedules in the repo silently registered nothing, and the certified job was
-- held back specifically because the function implemented a superseded rule.
-- The function now matches the decision, so the fourth schedule is registered
-- here. `cron.schedule` upserts by name, so this is idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'auto-grant-certified',
      '0 3 * * *',
      'SELECT auto_grant_certified()'
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled — skipping auto-grant-certified schedule.';
  END IF;
END $$;
