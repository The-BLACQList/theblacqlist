-- =============================================================================
-- Migration: subscription tiebreak in search ranking (`priority_placement`)
-- Product: The BLACQList
--
-- Wires the Growth+ `priority_placement` entitlement, which until now existed
-- only as a union member and a weight in lib/stripe/features.ts with ZERO call
-- sites — a paid feature sold in live public copy that delivered nothing.
--
-- Shape settled at decision-log 020 (2026-08-08):
--   • Growth+ only          — features.ts:77 FEATURE_MIN_TIER weight 2 is
--                             authoritative. Binary, not laddered: Premium gets
--                             no more ranking weight than Growth.
--   • A tiebreak, not a boost — it reorders only listings that already matched
--                             about equally well. A subscription never outranks
--                             a better match.
--   • Search results only   — browse, city, and category pages keep today's
--                             ordering exactly.
--   • Disclosed once, site-wide, at /how-ranking-works.
--
-- -----------------------------------------------------------------------------
-- SIGNATURE: 13 args. This is NOT the 12-arg function from 20260622000001.
-- -----------------------------------------------------------------------------
-- 20260707000000 (the Black-Owned/Ally pivot) inserted `p_ownership_label`
-- BEFORE p_sort, changing the signature, and correctly DROPped the 12-arg
-- overload so only one function exists. The app always sends that argument —
-- `p_ownership_label` is a required field of ResolvedFacetParams
-- (lib/listings/facets.ts:73, always set at :169) — so EVERY real call resolves
-- to the 13-arg overload.
--
-- An earlier draft of this migration did CREATE OR REPLACE on the 12-arg
-- signature. Because that signature no longer existed, "OR REPLACE" silently
-- became CREATE: it re-introduced the dead overload, left the live function
-- untouched (so the tiebreak did nothing at all), and made any call that omits
-- p_ownership_label ambiguous. Caught on the staging rehearsal, 2026-08-09.
-- Hence the explicit DROP below — it removes that stale overload if a database
-- has it, and is a no-op on one that does not.
--
-- -----------------------------------------------------------------------------
-- WHY "search results only" is load-bearing, not a preference:
--   With no query, `rank` is hardcoded to 0 for EVERY row (see the CASE in the
--   `filtered` CTE below). There is no relevance band in browse — one band
--   would be the entire result set — so a tiebreak there would silently sort
--   the whole main discovery surface paid-above-free. That is a boost wearing a
--   tiebreak's name. It is excluded.
--
-- THREE CONSTRAINTS THIS MUST NEVER VIOLATE (repeated at the ORDER BY):
--   1. Never keyed off `ownership_label`. moderation-policy.md:48 forbids making
--      any paid tier, placement, or badge contingent on Black-Owned vs Ally.
--      Note the structural guarantee this ORDER BY already provides: editorial
--      centering sits ABOVE the paid key, so a paying Ally listing can never be
--      lifted above a Black-Owned listing. Money operates strictly *within* an
--      ownership group. That property is why the paid key goes where it does.
--   2. Never touches the map presence ladder. The shipped N7 promise is
--      "prominence earned by trust, never sold" — map prominence is trust_tier
--      only, and nothing here reaches it.
--   3. Never displaces `is_featured`. That is the MANUAL sponsored placement
--      engine (admin-scheduled, labeled "Sponsored" on the card). It stays the
--      first key; the tier tiebreak must not compete with it.
--
-- Ranking on `listings.tier` is safe because the column is downgrade-honest:
-- lib/services/billing/webhookHandlers.ts:160 sets tier='free' on cancellation,
-- so a churned business loses the tiebreak. It is not a permanent stamp.
--
-- BAND WIDTH IS MEASURED, NOT ASSUMED. round(rank, 2), sampled against the real
-- staging corpus (399 published listings, 2026-08-09):
--   query        results  bands@2dp  largest band
--   restaurant       56       5           38
--   hair salon       15      13            3
--   coffee           14       6            4
--   law firm         12      10            2
--   fitness          13       6            4
-- 1dp merges genuinely different match qualities (hair salon 0.92/0.95/0.97/
-- 0.99 collapse into one). 3dp makes the key never fire on precise queries
-- (hair salon and law firm drop to zero multi-member bands). 2dp is the middle
-- that fires on real near-ties and not on real quality gaps. The large bands on
-- broad queries (restaurant: 38) are NOT a rounding artifact — those rows carry
-- identical ts_rank at every precision, i.e. they are genuine ties.
--
-- `facet_counts` is not modified — facet counts are unordered.
--
-- Body below is copied verbatim from 20260707000000_listings_ownership_label
-- except for exactly two changes, each marked ▲ NEW.
-- =============================================================================

-- Remove the dead 12-arg overload if present. No-op where it is already absent.
-- Without this, a call that omits p_ownership_label is ambiguous and errors.
DROP FUNCTION IF EXISTS search_listings_faceted(
  text, uuid, uuid, text, text, text, text[], uuid[], boolean, text, int, int
);

CREATE OR REPLACE FUNCTION search_listings_faceted(
  p_q                text    DEFAULT NULL,
  p_category_id      uuid    DEFAULT NULL,
  p_city_id          uuid    DEFAULT NULL,
  p_entity_type      text    DEFAULT NULL,
  p_trust_tier       text    DEFAULT NULL,
  p_location_type    text    DEFAULT NULL,
  p_price_ranges     text[]  DEFAULT NULL,
  p_attribute_values uuid[]  DEFAULT NULL,
  p_open_now         boolean DEFAULT NULL,
  p_ownership_label  text    DEFAULT NULL,
  p_sort             text    DEFAULT 'relevance',
  p_limit            int     DEFAULT 24,
  p_offset           int     DEFAULT 0
)
RETURNS TABLE (id uuid, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      l.id,
      l.is_featured,
      l.ownership_label,
      l.published_at,
      l.save_count,
      l.avg_rating,
      l.review_count,
      l.name,
      -- ▲ NEW (1 of 2): Growth+ `priority_placement` weight. Binary by design —
      -- 'premium' is not worth more here than 'growth'. Read straight off
      -- listings.tier; no join, and deliberately NOT off ownership_label.
      CASE WHEN l.tier IN ('growth', 'premium') THEN 1 ELSE 0 END AS tier_weight,
      CASE
        WHEN p_q IS NOT NULL AND p_q <> ''
        THEN ts_rank(l.search_vector, websearch_to_tsquery('english', p_q))
        ELSE 0
      END AS rank
    FROM listings l
    LEFT JOIN listing_details_business d ON d.listing_id = l.id
    WHERE l.status = 'published'
      AND l.deleted_at IS NULL
      AND l.flag_status = 'none'
      AND (p_q IS NULL OR p_q = '' OR l.search_vector @@ websearch_to_tsquery('english', p_q))
      AND (p_category_id    IS NULL OR l.category_id     = p_category_id)
      AND (p_city_id        IS NULL OR l.city_id         = p_city_id)
      AND (p_entity_type    IS NULL OR l.entity_type     = p_entity_type)
      AND (p_trust_tier     IS NULL OR l.trust_tier      = p_trust_tier)
      AND (p_location_type  IS NULL OR l.location_type   = p_location_type)
      AND (p_ownership_label IS NULL OR l.ownership_label = p_ownership_label)
      AND (
        p_price_ranges IS NULL
        OR array_length(p_price_ranges, 1) IS NULL
        OR d.price_range = ANY (p_price_ranges)
      )
      AND (p_open_now IS NOT TRUE OR is_open_now(l.id))
      -- Attributes: AND across groups, OR within a group.
      -- A listing fails if there exists a selected group for which it has NONE
      -- of that group's selected values.
      AND (
        p_attribute_values IS NULL
        OR array_length(p_attribute_values, 1) IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM attribute_values sel
          WHERE sel.id = ANY (p_attribute_values)
          GROUP BY sel.group_id
          HAVING NOT EXISTS (
            SELECT 1
            FROM listing_attributes la
            JOIN attribute_values av ON av.id = la.value_id
            WHERE la.listing_id = l.id
              AND av.group_id = sel.group_id
              AND la.value_id = ANY (p_attribute_values)
          )
        )
      )
  ),
  counted AS (
    SELECT f.*, count(*) OVER () AS total_count
    FROM filtered f
  )
  SELECT c.id, c.total_count
  FROM counted c
  ORDER BY
    c.is_featured DESC,                              -- manual sponsored placement (unchanged, stays top)
    (c.ownership_label = 'black_owned') DESC,        -- editorial centering (unchanged, stays above money)
    -- ▲ NEW (2 of 2): three keys replace the single relevance key.
    --
    -- (a) The relevance BAND, not the raw rank. Rounding to 2dp collapses
    --     near-ties into one bucket, so the paid weight below can only reorder
    --     listings that matched about equally well. Width is measured — see the
    --     staging distribution table in the header.
    CASE WHEN p_sort = 'relevance' THEN round(c.rank::numeric, 2) END DESC NULLS LAST,
    --
    -- (b) The paid tiebreak, INSIDE a band. Gated on a real query: with p_q
    --     empty every rank is 0, so one band would be the whole result set —
    --     browse/city/category are deliberately excluded (see header).
    --     Sits BELOW the editorial key on purpose: a paying Ally listing can
    --     never be lifted above a Black-Owned one (moderation-policy.md:48).
    --     Sits BELOW is_featured on purpose: it never displaces the manual
    --     sponsored slot. Never touches the map ladder (trust, never sold).
    CASE WHEN p_sort = 'relevance' AND p_q IS NOT NULL AND p_q <> ''
         THEN c.tier_weight END                             DESC NULLS LAST,
    --
    -- (c) The exact rank, which separates listings WITHIN a band once the paid
    --     weight is equal. Ordering among same-tier listings is unchanged.
    CASE WHEN p_sort = 'relevance' THEN c.rank END          DESC NULLS LAST,
    --
    -- Explicit sorts are untouched: if a user asked for alphabetical, money
    -- does not perturb it.
    CASE WHEN p_sort = 'rating'    THEN c.avg_rating END    DESC NULLS LAST,
    CASE WHEN p_sort = 'reviews'   THEN c.review_count END  DESC NULLS LAST,
    CASE WHEN p_sort = 'newest'    THEN c.published_at END  DESC NULLS LAST,
    CASE WHEN p_sort = 'saves'     THEN c.save_count END    DESC NULLS LAST,
    CASE WHEN p_sort = 'name'      THEN c.name END          ASC,
    -- stable tiebreakers
    c.save_count DESC,
    c.published_at DESC NULLS LAST,
    c.id
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION search_listings_faceted(
  text, uuid, uuid, text, text, text, text[], uuid[], boolean, text, text, int, int
) TO anon, authenticated;

-- Ask PostgREST to reload its schema cache (mirrors 20260707000000:155).
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- DOWN PLAN (GATE-DATA rollback — run manually, not automatically)
-- =============================================================================
-- Re-apply the previous definition by running section 2 of:
--   supabase/migrations/20260707000000_listings_ownership_label.sql
-- (lines 47-155 — the DROP of the 12-arg overload, the CREATE of the 13-arg
-- function, its GRANT, and the NOTIFY). Section 1 of that file adds a column and
-- an index and must NOT be re-run as part of a rollback of this migration.
--
-- Because that section begins with `CREATE FUNCTION` (not CREATE OR REPLACE),
-- drop this version first:
--   DROP FUNCTION IF EXISTS search_listings_faceted(
--     text, uuid, uuid, text, text, text, text[], uuid[], boolean, text, text, int, int
--   );
--
-- Effect of rolling back: search ordering returns to relevance-only within the
-- is_featured / black_owned bands. `priority_placement` goes back to delivering
-- nothing, so the Growth plan bullet "Priority search placement"
-- (lib/stripe/plans.ts) would again be unbacked — pair a rollback with a copy
-- change, and with the /how-ranking-works page, if it is not brief.
-- No data is read or written in either direction; this is function DDL only.
-- =============================================================================
